// src/domain/state-machine/SyncStateMachineStrategy.ts

import { Logger } from '@logging/logger.js';
import { EnhancedBaseStateMachineStrategy } from './EnhancedBaseStateMachineStrategy.js';
import {
  EnhancedStateMachineConfig,
  StateTransitionValidationResult,
  StateTransitionLog,
  StateMachineMetrics,
  DefaultStateTransitionValidator,
  DefaultStateTransitionLogger,
} from './EnhancedTypes.js';
import { StateMachineTask, StatePersistence } from './types.js';
import { SyncJobStatus, SyncJobEvent, SyncJob } from '@domain/sync/types.js';
import { SyncJobStatusMapper } from '@domain/sync/SyncJobStatusMapper.js';
import {
  ISQLiteRepo,
  IQdrantRepo,
  IEmbeddingProvider,
  ISplitter,
} from '@domain/interfaces/index.js';
import {
  DocId,
  ChunkMeta,
  DocumentChunk,
  PointId,
} from '@domain/entities/types.js';
import { Point } from '@domain/repositories/IQdrantRepo.js';
import { makePointId } from '@domain/utils/id.js';

/**
 * 同步状态机策略
 * 实现文档同步任务的状态管理和执行逻辑
 */
export class SyncStateMachineStrategy extends EnhancedBaseStateMachineStrategy {
  private readonly sqliteRepo: ISQLiteRepo;
  private readonly qdrantRepo: IQdrantRepo;
  private readonly embeddingProvider: IEmbeddingProvider;
  private readonly splitter: ISplitter;

  /**
   * 构造函数
   * @param sqliteRepo - SQLite 仓库实例
   * @param qdrantRepo - Qdrant 仓库实例
   * @param embeddingProvider - 嵌入提供者实例
   * @param splitter - 文档分割器实例
   * @param persistence - 状态持久化实现
   * @param logger - 日志记录器
   */
  constructor(
    sqliteRepo: ISQLiteRepo,
    qdrantRepo: IQdrantRepo,
    embeddingProvider: IEmbeddingProvider,
    splitter: ISplitter,
    persistence: StatePersistence,
    logger: Logger,
  ) {
    interface SyncContext extends Record<string, unknown> {
      docId?: DocId;
      retryCount?: number;
      errorMessage?: string;
    }

    const config: EnhancedStateMachineConfig<SyncContext> = {
      taskType: 'document_sync',
      initialState: SyncJobStatus.NEW,
      finalStates: [SyncJobStatus.SYNCED, SyncJobStatus.DEAD],
      maxRetries: 3,
      enablePersistence: true,
      enableValidation: true,
      enableLogging: true,
      validator: new DefaultStateTransitionValidator(logger),
      logger: new DefaultStateTransitionLogger(),
      transitions: [
        // NEW -> SPLIT_OK
        {
          from: SyncJobStatus.NEW,
          to: SyncJobStatus.SPLIT_OK,
          event: SyncJobEvent.CHUNKS_SAVED,
          beforeTransition: async (context) => {
            logger.info(`准备分割文档: ${context.docId}`);
          },
          action: async (context) => {
            // 分割逻辑在executeTask中处理
          },
          afterTransition: async (context) => {
            logger.info(`文档分割完成: ${context.docId}`);
          },
        },
        // SPLIT_OK -> EMBED_OK
        {
          from: SyncJobStatus.SPLIT_OK,
          to: SyncJobStatus.EMBED_OK,
          event: SyncJobEvent.VECTORS_INSERTED,
          beforeTransition: async (context) => {
            logger.info(`准备生成嵌入: ${context.docId}`);
          },
          action: async (context) => {
            // 嵌入生成逻辑在executeTask中处理
          },
          afterTransition: async (context) => {
            logger.info(`嵌入生成完成: ${context.docId}`);
          },
        },
        // EMBED_OK -> SYNCED
        {
          from: SyncJobStatus.EMBED_OK,
          to: SyncJobStatus.SYNCED,
          event: SyncJobEvent.META_UPDATED,
          beforeTransition: async (context) => {
            logger.info(`准备更新元数据: ${context.docId}`);
          },
          action: async (context) => {
            // 元数据更新逻辑在executeTask中处理
          },
          afterTransition: async (context) => {
            logger.info(`文档同步完成: ${context.docId}`);
          },
        },
        // 任何状态 -> FAILED
        {
          from: SyncJobStatus.NEW,
          to: SyncJobStatus.FAILED,
          event: SyncJobEvent.ERROR,
          action: async (context) => {
            logger.error(
              `文档同步失败: ${context.docId}, 错误: ${context.errorMessage}`,
            );
          },
        },
        {
          from: SyncJobStatus.SPLIT_OK,
          to: SyncJobStatus.FAILED,
          event: SyncJobEvent.ERROR,
          action: async (context) => {
            logger.error(
              `文档同步失败: ${context.docId}, 错误: ${context.errorMessage}`,
            );
          },
        },
        {
          from: SyncJobStatus.EMBED_OK,
          to: SyncJobStatus.FAILED,
          event: SyncJobEvent.ERROR,
          action: async (context) => {
            logger.error(
              `文档同步失败: ${context.docId}, 错误: ${context.errorMessage}`,
            );
          },
        },
        // FAILED -> RETRYING
        {
          from: SyncJobStatus.FAILED,
          to: SyncJobStatus.RETRYING,
          event: SyncJobEvent.RETRY,
          condition: (context) => {
            return (context.retryCount || 0) < 3;
          },
          action: async (context) => {
            logger.info(
              `开始重试文档同步: ${context.docId}, 第${context.retryCount}次`,
            );
          },
        },
        // RETRYING -> SPLIT_OK (重试成功)
        {
          from: SyncJobStatus.RETRYING,
          to: SyncJobStatus.SPLIT_OK,
          event: SyncJobEvent.CHUNKS_SAVED,
          action: async (context) => {
            logger.info(`重试成功，文档分割完成: ${context.docId}`);
          },
        },
        // RETRYING -> EMBED_OK (重试成功)
        {
          from: SyncJobStatus.RETRYING,
          to: SyncJobStatus.EMBED_OK,
          event: SyncJobEvent.VECTORS_INSERTED,
          action: async (context) => {
            logger.info(`重试成功，嵌入生成完成: ${context.docId}`);
          },
        },
        // RETRYING -> SYNCED (重试成功)
        {
          from: SyncJobStatus.RETRYING,
          to: SyncJobStatus.SYNCED,
          event: SyncJobEvent.META_UPDATED,
          action: async (context) => {
            logger.info(`重试成功，文档同步完成: ${context.docId}`);
          },
        },
        // RETRYING -> FAILED (重试失败)
        {
          from: SyncJobStatus.RETRYING,
          to: SyncJobStatus.FAILED,
          event: SyncJobEvent.ERROR,
          action: async (context) => {
            logger.error(
              `重试失败: ${context.docId}, 错误: ${context.errorMessage}`,
            );
          },
        },
        // FAILED -> DEAD (重试次数超限)
        {
          from: SyncJobStatus.FAILED,
          to: SyncJobStatus.DEAD,
          event: SyncJobEvent.RETRIES_EXCEEDED,
          action: async (context) => {
            logger.error(`重试次数超限，文档同步标记为死亡: ${context.docId}`);
          },
        },
      ],
    };

    super('document_sync', config, persistence, logger);

    this.sqliteRepo = sqliteRepo;
    this.qdrantRepo = qdrantRepo;
    this.embeddingProvider = embeddingProvider;
    this.splitter = splitter;
  }

  /**
   * 执行同步任务
   * @param taskId - 任务ID
   * @returns 无返回值
   */
  async executeTask(taskId: string): Promise<void> {
    const task = await this.persistence.getTask(taskId);
    if (!task) {
      throw new Error(`任务 ${taskId} 不存在`);
    }

    const docId = task.context?.docId as DocId;
    if (!docId) {
      throw new Error(`任务 ${taskId} 缺少文档ID`);
    }

    try {
      // 读取执行前的任务状态（在 markTaskStarted 之前保存）
      const previousTask = task; // 已在上方读取过
      const previousState = previousTask.status;

      // 标记任务开始（会把状态临时标记为PROCESSING）
      await this.markTaskStarted(taskId);

      // 使用执行前的状态作为分支依据，避免被 PROCESSING 覆盖
      let currentState = previousState
        ? SyncJobStatusMapper.toDomainStatusSafe(previousState as string)
        : null;

      // 循环执行状态机，直到进入终态或没有可用转换
      while (currentState && !this.config.finalStates.includes(currentState)) {
        if (
          currentState === SyncJobStatus.NEW ||
          currentState === SyncJobStatus.RETRYING
        ) {
          await this.splitDocument(taskId, docId);
        } else if (currentState === SyncJobStatus.SPLIT_OK) {
          await this.generateEmbeddings(taskId, docId);
        } else if (currentState === SyncJobStatus.EMBED_OK) {
          await this.markAsSynced(taskId, docId);
        } else if (currentState === SyncJobStatus.SYNCED) {
          this.logger.info(`文档 ${docId} 已经同步完成`);
          break;
        } else {
          // 如果遇到未知状态，抛出以触发错误处理
          throw new Error(`无效的状态: ${currentState}`);
        }

        // 读取最新状态继续下一步
        const rawState = await this.getCurrentState(taskId);
        currentState = rawState
          ? SyncJobStatusMapper.toDomainStatusSafe(rawState as string)
          : null;
      }
    } catch (error) {
      this.logger.error(`同步任务执行失败: ${taskId}, 错误: ${error}`);

      // 触发错误状态转换
      await this.handleTransition(taskId, SyncJobEvent.ERROR, {
        docId,
        errorMessage: (error as Error).message,
      });

      throw error;
    }
  }

  /**
   * 分割文档
   * @param taskId - 任务ID
   * @param docId - 文档ID
   * @returns 无返回值
   */
  private async splitDocument(taskId: string, docId: DocId): Promise<void> {
    this.logger.info(`[${docId}] 开始分割文档...`);

    const doc = await this.sqliteRepo.getDoc(docId);
    if (!doc) {
      throw new Error(`文档 ${docId} 未找到`);
    }

    if (!doc.content || doc.content.trim().length === 0) {
      this.logger.warn(`[${docId}] 文档内容为空，跳过分割和嵌入生成。`);
      await this.sqliteRepo.markDocAsSynced(docId);
      await this.handleTransition(taskId, SyncJobEvent.META_UPDATED, { docId });
      return;
    }

    const rawChunks = (await this.splitter.split(doc.content as string, {
      name: doc.name ?? '',
    })) as unknown[];

    const chunkTexts: string[] = rawChunks.map((item) => {
      if (typeof item === 'string') {
        return item;
      } else if (item && typeof item === 'object' && 'content' in item) {
        const chunkItem = item as { content: unknown };
        return typeof chunkItem.content === 'string'
          ? chunkItem.content
          : String(chunkItem.content);
      } else {
        return String(item);
      }
    });

    // 转换为 DocumentChunk 格式
    const chunks: DocumentChunk[] = chunkTexts.map((content, index) => ({
      content,
      index,
    }));

    try {
      this.logger.info(
        `[${docId}] 开始添加chunks到数据库，数量 ${chunks.length}`,
      );
      await this.sqliteRepo.addChunks(docId, chunks);

      // 触发状态转换
      await this.handleTransition(taskId, SyncJobEvent.CHUNKS_SAVED, { docId });

      this.logger.info(`[${docId}] 文档分割完成，chunks已成功保存到数据库`);
    } catch (error) {
      this.logger.error(`[${docId}] 添加chunks到数据库失败`, {
        error: (error as Error).message,
        stack: (error as Error).stack,
        chunksCount: chunks.length,
        firstChunk: chunkTexts[0]
          ? {
              content: chunkTexts[0].substring(0, 100),
            }
          : null,
      });
      throw error;
    }
  }

  /**
   * 生成嵌入
   * @param taskId - 任务ID
   * @param docId - 文档ID
   * @returns 无返回值
   */
  private async generateEmbeddings(
    taskId: string,
    docId: DocId,
  ): Promise<void> {
    this.logger.info(`[${docId}] 开始生成嵌入...`);

    const chunkMetas: ChunkMeta[] =
      await this.sqliteRepo.getChunkMetasByDocId(docId);
    const chunkMetasWithContent = await Promise.all(
      chunkMetas.map(async (cm) => {
        const chunkText = await this.sqliteRepo.getChunkTexts([cm.pointId]);
        return { ...cm, content: chunkText?.[cm.pointId]?.content || '' };
      }),
    );

    const contents = chunkMetasWithContent.map((cm) => cm.content);
    const embeddings = await this.embeddingProvider.generateBatch(contents);

    if (embeddings.length !== chunkMetasWithContent.length) {
      throw new Error('嵌入数量与分块数量不匹配');
    }

    const doc = await this.sqliteRepo.getDoc(docId);
    if (!doc) {
      throw new Error(`文档 ${docId} 未找到`);
    }

    const points: Point[] = chunkMetasWithContent.map(
      (chunkMeta: ChunkMeta & { content: string }, index: number) => ({
        id: makePointId(chunkMeta.docId, chunkMeta.chunkIndex) as PointId,
        vector: embeddings[index],
        payload: {
          docId: chunkMeta.docId,
          collectionId: chunkMeta.collectionId,
          chunkIndex: chunkMeta.chunkIndex,
          content: chunkMeta.content,
          contentHash: chunkMeta.contentHash,
          titleChain: chunkMeta.titleChain,
        },
      }),
    );

    // 先执行Qdrant插入操作
    await this.qdrantRepo.upsertCollection(doc.collectionId, points);

    // 触发状态转换
    await this.handleTransition(taskId, SyncJobEvent.VECTORS_INSERTED, {
      docId,
    });

    this.logger.info(`[${docId}] 嵌入生成完成，向量点已成功插入Qdrant`);
  }

  /**
   * 标记为已同步
   * @param taskId - 任务ID
   * @param docId - 文档ID
   * @returns 无返回值
   */
  private async markAsSynced(taskId: string, docId: DocId): Promise<void> {
    // 先更新数据库中的同步状态
    await this.sqliteRepo.markDocAsSynced(docId);

    // 触发状态转换
    await this.handleTransition(taskId, SyncJobEvent.META_UPDATED, { docId });

    this.logger.info(`[${docId}] 文档同步完成，所有操作均已成功执行`);
  }

  /**
   * 创建同步任务
   * @param docId - 文档ID
   * @returns 任务ID
   */
  async createSyncTask(docId: DocId): Promise<string> {
    const taskId = `sync_${docId}_${Date.now()}`;

    await this.createTask(taskId, {
      docId,
      taskType: 'document_sync',
    });

    return taskId;
  }

  /**
   * 获取同步任务状态
   * @param docId - 文档ID
   * @returns 同步任务状态
   */
  async getSyncTaskStatus(docId: DocId): Promise<SyncJob | null> {
    const tasks = await this.persistence.getTasksByType('document_sync');
    const syncTask = tasks.find((task) => task.context?.docId === docId);

    if (!syncTask) {
      return null;
    }

    return {
      id: syncTask.id,
      docId,
      status: syncTask.status as SyncJobStatus,
      retries: syncTask.retries,
      lastAttemptAt: syncTask.lastAttemptAt,
      error: syncTask.error,
      createdAt: syncTask.createdAt,
      updatedAt: syncTask.updatedAt,
    };
  }

  /**
   * 获取所有同步任务
   * @returns 同步任务列表
   */
  async getAllSyncTasks(): Promise<SyncJob[]> {
    const tasks = await this.persistence.getTasksByType('document_sync');

    return tasks.map((task) => ({
      id: task.id,
      docId: task.context?.docId as DocId,
      status: task.status as SyncJobStatus,
      retries: task.retries,
      lastAttemptAt: task.lastAttemptAt,
      error: task.error,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    }));
  }

  /**
   * 获取指定状态的同步任务数量
   * @param status - 同步任务状态
   * @returns 指定状态的同步任务数量
   */
  async getSyncTaskCountByStatus(status: SyncJobStatus): Promise<number> {
    const tasks = await this.persistence.getTasksByType('document_sync');
    return tasks.filter((task) => task.status === status).length;
  }

  /**
   * 兼容旧命名：获取指定状态的同步任务数量（别名）
   * @param status - 同步任务状态
   * @returns 指定状态的同步任务数量
   */
  async getSyncJobCountByStatus(status: SyncJobStatus): Promise<number> {
    return this.getSyncTaskCountByStatus(status);
  }
}
