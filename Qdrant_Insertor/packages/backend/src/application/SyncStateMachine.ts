import { SQLiteRepo } from '../infrastructure/SQLiteRepo.js';
import { IQdrantRepo } from '../domain/IQdrantRepo.js';
import { IEmbeddingProvider } from '../domain/embedding.js';
import { ISplitter } from '../domain/splitter.js';
import { Logger } from '../logger.js';
import {
  DocId,
  ChunkMeta,
  Doc,
  DocumentChunk,
  PointId,
} from '../domain/types.js';
import { Point } from '../domain/IQdrantRepo.js';
import { makePointId } from '../domain/utils/id.js';
import { SyncJobStatus, SyncJobEvent, SyncJob } from '../domain/sync/types.js';
import { ErrorCategory, RetryStats } from '../domain/sync/retry.js';
import { createErrorClassifier } from '../domain/sync/ErrorClassifier.js';
import { createRetryScheduler } from '../domain/sync/RetryScheduler.js';
import { IRetryScheduler } from '../domain/sync/RetrySchedulerInterface.js';
import { SyncStateMachineCore } from './SyncStateMachineCore.js';

/**
 * @class SyncStateMachine
 * @description 管理文档同步的状态机，负责协调文档的分割、嵌入生成和 Qdrant 同步。
 */
export class SyncStateMachine {
  private readonly stateMachineCore: SyncStateMachineCore;
  private readonly errorClassifier = createErrorClassifier();
  private readonly retryScheduler: IRetryScheduler;

  /**
   * @constructor
   * @param {SQLiteRepo} sqliteRepo - SQLite 仓库实例，用于访问 SQLite 数据库。
   * @param {IQdrantRepo} qdrantRepo - Qdrant 仓库实例，用于与 Qdrant 向量数据库交互。
   * @param {IEmbeddingProvider} embeddingProvider - 嵌入提供者实例，用于生成文档内容的嵌入向量。
   * @param {ISplitter} splitter - 文档分割器实例，用于将文档内容分割成块。
   * @param {Logger} logger - 日志记录器实例，用于记录同步过程中的信息和错误。
   */
  constructor(
    private readonly sqliteRepo: SQLiteRepo,
    private readonly qdrantRepo: IQdrantRepo,
    private readonly embeddingProvider: IEmbeddingProvider,
    private readonly splitter: ISplitter,
    private readonly logger: Logger,
  ) {
    this.stateMachineCore = new SyncStateMachineCore(logger);
    this.retryScheduler = createRetryScheduler(logger);
  }

  /**
   * @method triggerSync
   * @description 触发指定文档的同步过程。包括文档分割、嵌入生成和 Qdrant 向量数据库的更新。
   * @param {DocId} docId - 需要同步的文档 ID。
   * @returns {Promise<void>}
   */
  public async triggerSync(docId: DocId): Promise<void> {
    const job = this.stateMachineCore.getOrCreateSyncJob(docId);

    // 如果是重试状态，直接执行同步逻辑
    if (job.status === SyncJobStatus.RETRYING) {
      await this.executeSync(docId);
      return;
    }

    this.logger.info(`触发文档同步: ${docId}`);
    await this.executeSync(docId);
  }

  /**
   * 执行同步逻辑
   */
  private async executeSync(docId: DocId): Promise<void> {
    const job = this.stateMachineCore.getOrCreateSyncJob(docId);

    try {
      // 1. 分割文档
      await this.splitDocument(docId);

      // 2. 生成嵌入
      await this.generateEmbeddings(docId);

      // 3. 标记为已同步
      await this.markAsSynced(docId);
    } catch (error: unknown) {
      await this.handleSyncError(docId, error as Error);
    }
  }

  /**
   * 分割文档
   */
  private async splitDocument(docId: DocId): Promise<void> {
    this.logger.info(`[${docId}] 开始分割文档...`);

    const doc: Doc | undefined = await this.sqliteRepo.getDoc(docId);
    if (!doc) {
      throw new Error(`文档 ${docId} 未找到`);
    }

    if (!doc.content || doc.content.trim().length === 0) {
      this.logger.warn(`[${docId}] 文档内容为空，跳过分割和嵌入生成。`);
      await this.sqliteRepo.markDocAsSynced(docId);
      this.stateMachineCore.transitionState(docId, SyncJobEvent.META_UPDATED);
      return;
    }

    const chunks: DocumentChunk[] = this.splitter.split(doc.content as string, {
      name: doc.name ?? '',
    });

    try {
      this.logger.info(
        `[${docId}] 开始添加chunks到数据库，数量: ${chunks.length}`,
      );
      await this.sqliteRepo.addChunks(docId, chunks);
      this.stateMachineCore.transitionState(docId, SyncJobEvent.CHUNKS_SAVED);
      this.logger.info(`[${docId}] 文档分割完成`);
    } catch (error) {
      this.logger.error(`[${docId}] 添加chunks到数据库失败`, {
        error: (error as Error).message,
        stack: (error as Error).stack,
        chunksCount: chunks.length,
        firstChunk: chunks[0]
          ? {
              content: chunks[0].content.substring(0, 100),
              titleChain: chunks[0].titleChain,
            }
          : null,
      });
      throw error;
    }
  }

  /**
   * 生成嵌入
   */
  private async generateEmbeddings(docId: DocId): Promise<void> {
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
    const embeddings = await this.embeddingProvider.generate(contents);

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

    await this.qdrantRepo.upsertCollection(doc.collectionId, points);
    this.stateMachineCore.transitionState(docId, SyncJobEvent.VECTORS_INSERTED);
    this.logger.info(`[${docId}] 嵌入生成完成`);
  }

  /**
   * 标记为已同步
   */
  private async markAsSynced(docId: DocId): Promise<void> {
    await this.sqliteRepo.markDocAsSynced(docId);
    this.stateMachineCore.transitionState(docId, SyncJobEvent.META_UPDATED);
    this.logger.info(`[${docId}] 文档同步完成`);
  }

  /**
   * 处理重试逻辑
   */
  private async handleRetry(docId: string, error: Error): Promise<void> {
    const job = this.stateMachineCore.getOrCreateSyncJob(docId);
    const errorCategory = this.errorClassifier.classify(error);
    const retryStrategy = this.errorClassifier.getRetryStrategy(error);

    // 检查是否为永久错误
    if (!this.errorClassifier.isTemporary(error)) {
      this.stateMachineCore.transitionState(
        docId,
        SyncJobEvent.RETRIES_EXCEEDED,
      );
      this.logger.error(`[${docId}] 遇到永久错误，标记为DEAD状态`, {
        errorCategory,
        errorMessage: error.message,
      });
      return;
    }

    // 检查重试次数是否超过限制
    if (job.retries >= retryStrategy.maxRetries) {
      this.stateMachineCore.transitionState(
        docId,
        SyncJobEvent.RETRIES_EXCEEDED,
      );
      this.logger.error(
        `[${docId}] 重试次数超过限制 (${retryStrategy.maxRetries})，标记为DEAD状态`,
        {
          errorCategory,
          retryCount: job.retries,
          maxRetries: retryStrategy.maxRetries,
        },
      );
      return;
    }

    this.stateMachineCore.transitionState(docId, SyncJobEvent.RETRY, {
      errorMessage: error.message,
    });

    // 使用重试调度器调度重试
    this.retryScheduler.scheduleRetry(
      docId,
      error,
      errorCategory,
      job.retries,
      retryStrategy,
      () => this.executeSync(docId as DocId),
    );

    this.logger.info(
      `[${docId}] 已调度重试 (${job.retries}/${retryStrategy.maxRetries})`,
      {
        errorCategory,
        retryCount: job.retries,
        maxRetries: retryStrategy.maxRetries,
        strategy: retryStrategy,
      },
    );
  }

  /**
   * 处理同步错误
   */
  private async handleSyncError(docId: DocId, error: Error): Promise<void> {
    this.logger.error(`[${docId}] 同步失败，错误: ${error.message}`);

    const job = this.stateMachineCore.getOrCreateSyncJob(docId);
    const errorCategory = this.errorClassifier.classify(error);

    // 记录详细的错误信息
    this.logger.error(`[${docId}] 同步错误详情`, {
      errorCategory,
      errorMessage: error.message,
      stack: error.stack,
      currentStatus: job.status,
      retryCount: job.retries,
    });

    // 如果当前状态已经是重试状态，转换到失败状态
    if (job.status === SyncJobStatus.RETRYING) {
      this.stateMachineCore.transitionState(docId, SyncJobEvent.ERROR, {
        errorMessage: error.message,
      });
    } else {
      this.stateMachineCore.transitionState(docId, SyncJobEvent.ERROR, {
        errorMessage: error.message,
      });
    }

    // 处理重试逻辑
    await this.handleRetry(docId, error);

    // 注意：不再在这里直接调用executeSync，而是由重试调度器处理
  }

  /**
   * 获取同步作业状态
   */
  public getSyncJobStatus(docId: string): SyncJob | undefined {
    return this.stateMachineCore.getSyncJobStatus(docId);
  }

  /**
   * 获取重试统计信息
   */
  public getRetryStats(): RetryStats {
    return this.retryScheduler.getRetryStats();
  }

  /**
   * 取消指定文档的所有重试任务
   */
  public cancelAllRetriesForDoc(docId: string): number {
    return this.retryScheduler.cancelAllRetriesForDoc(docId);
  }

  /**
   * 获取活跃重试任务数量
   */
  public getActiveRetryTaskCount(): number {
    return this.retryScheduler.getActiveTaskCount();
  }

  /**
   * 清理已完成的同步作业和重试任务
   */
  public cleanupCompletedJobs(): void {
    // 清理同步作业
    this.stateMachineCore.cleanupCompletedJobs();

    // 清理重试任务
    this.retryScheduler.cleanupCompletedTasks();
  }

  /**
   * 获取所有同步作业状态
   */
  public getAllSyncJobs(): SyncJob[] {
    return this.stateMachineCore.getAllSyncJobs();
  }

  /**
   * 获取指定状态的同步作业数量
   */
  public getSyncJobCountByStatus(status: SyncJobStatus): number {
    return this.stateMachineCore.getSyncJobCountByStatus(status);
  }
}
