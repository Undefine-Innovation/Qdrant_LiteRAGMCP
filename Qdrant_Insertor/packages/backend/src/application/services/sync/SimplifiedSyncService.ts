/**
 * 简化的同步服务
 * 替换复杂的SyncStateMachine，提供核心的文档同步功能
 */

import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';
import { IEmbeddingProvider } from '@domain/interfaces/embedding.js';
import { ISplitter } from '@domain/interfaces/splitter.js';
import { Logger } from '@logging/logger.js';
import {
  DocId,
  ChunkMeta,
  Doc,
  DocumentChunk,
  PointId,
} from '@domain/entities/types.js';
import { Point } from '@domain/repositories/IQdrantRepo.js';
import { makePointId } from '@domain/utils/id.js';
import {
  SimplifiedSyncStateMachine,
  SyncStatus,
  SyncTask,
} from '@domain/sync/SimplifiedSyncStateMachine.js';

/**
 * 简化的同步服务
 * 实现文档的核心同步流程：分割 -> 嵌入 -> 同步
 */
export class SimplifiedSyncService {
  private readonly stateMachine: SimplifiedSyncStateMachine;

  constructor(
    private readonly sqliteRepo: ISQLiteRepo,
    private readonly qdrantRepo: IQdrantRepo,
    private readonly embeddingProvider: IEmbeddingProvider,
    private readonly splitter: ISplitter,
    private readonly logger: Logger,
  ) {
    this.stateMachine = new SimplifiedSyncStateMachine(logger);
  }

  /**
   * 触发文档同步
   * @param docId - 文档ID
   */
  public async triggerSync(docId: DocId): Promise<void> {
    this.logger.info(`开始文档同步: ${docId}`);

    try {
      await this.executeSync(docId);
    } catch (error) {
      await this.handleSyncError(docId, error as Error);
    }
  }

  /**
   * 执行同步流程
   * @param docId - 文档ID
   */
  private async executeSync(docId: DocId): Promise<void> {
    const task = this.stateMachine.getOrCreateTask(docId);

    // 如果是重试状态，继续执行
    if (task.status === SyncStatus.RETRYING) {
      await this.continueSync(docId);
      return;
    }

    // 1. 分割文档
    await this.splitDocument(docId);

    // 2. 生成嵌入
    await this.generateEmbeddings(docId);

    // 3. 标记为已同步
    await this.markAsSynced(docId);
  }

  /**
   * 继续同步（用于重试场景）
   * @param docId - 文档ID
   */
  private async continueSync(docId: DocId): Promise<void> {
    const task = this.stateMachine.getTaskStatus(docId);
    if (!task || task.status !== SyncStatus.RETRYING) {
      throw new Error(`无效的重试状态: ${task?.status || 'undefined'}`);
    }

    // 简化重试逻辑：总是从头开始，避免复杂的错误消息判断
    await this.splitDocument(docId);
    await this.generateEmbeddings(docId);
    await this.markAsSynced(docId);
  }

  /**
   * 分割文档
   * @param docId - 文档ID
   */
  private async splitDocument(docId: DocId): Promise<void> {
    this.logger.info(`[${docId}] 开始分割文档...`);

    const doc: Doc | undefined = await this.sqliteRepo.getDoc(docId);
    if (!doc) {
      throw new Error(`文档 ${docId} 未找到`);
    }

    if (!doc.content || doc.content.trim().length === 0) {
      this.logger.warn(`[${docId}] 文档内容为空，跳过分割和嵌入生成`);
      await this.sqliteRepo.markDocAsSynced(docId);
      this.stateMachine.transitionState(docId, SyncStatus.SYNCED);
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

    const chunks: DocumentChunk[] = chunkTexts.map((content, index) => ({
      content,
      index,
    }));

    try {
      this.logger.info(
        `[${docId}] 开始添加chunks到数据库，数量 ${chunks.length}`,
      );
      await this.sqliteRepo.addChunks(docId, chunks);

      this.stateMachine.transitionState(docId, SyncStatus.SPLIT_OK);
      this.logger.info(`[${docId}] 文档分割完成`);
    } catch (error) {
      this.logger.error(`[${docId}] 添加chunks到数据库失败`, {
        error: (error as Error).message,
        chunksCount: chunks.length,
      });
      throw error;
    }
  }

  /**
   * 生成嵌入
   * @param docId - 文档ID
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

    try {
      await this.qdrantRepo.upsertCollection(doc.collectionId, points);
      this.stateMachine.transitionState(docId, SyncStatus.EMBED_OK);
      this.logger.info(`[${docId}] 嵌入生成完成`);
    } catch (error) {
      this.logger.error(`[${docId}] 嵌入生成失败`, {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 标记为已同步
   * @param docId - 文档ID
   */
  private async markAsSynced(docId: DocId): Promise<void> {
    try {
      await this.sqliteRepo.markDocAsSynced(docId);
      this.stateMachine.transitionState(docId, SyncStatus.SYNCED);
      this.logger.info(`[${docId}] 文档同步完成`);
    } catch (error) {
      this.logger.error(`[${docId}] 标记同步失败`, {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 处理同步错误
   * @param docId - 文档ID
   * @param error - 错误对象
   */
  private async handleSyncError(docId: DocId, error: Error): Promise<void> {
    this.logger.error(`[${docId}] 同步失败: ${error.message}`);

    // 标记为失败状态
    this.stateMachine.transitionState(docId, SyncStatus.FAILED, error.message);

    // 简化重试逻辑
    if (this.stateMachine.canRetry(docId)) {
      this.stateMachine.transitionState(docId, SyncStatus.RETRYING);
      this.scheduleRetry(docId);
    } else {
      this.stateMachine.transitionState(docId, SyncStatus.DEAD);
      this.logger.error(`[${docId}] 重试次数超限，标记为DEAD状态`);
    }
  }

  /**
   * 安排重试
   * @param docId - 文档ID
   */
  private scheduleRetry(docId: DocId): void {
    setTimeout(() => {
      this.logger.info(`[${docId}] 开始重试同步`);
      this.triggerSync(docId).catch((retryError) => {
        this.logger.error(`[${docId}] 重试失败: ${retryError.message}`);
      });
    }, 5000); // 5秒后重试
  }

  /**
   * 获取同步任务状态
   * @param docId - 文档ID
   * @returns 同步任务状态或undefined
   */
  public getSyncStatus(docId: DocId): SyncTask | undefined {
    return this.stateMachine.getTaskStatus(docId);
  }

  /**
   * 获取所有同步任务
   * @returns 所有同步任务数组
   */
  public getAllSyncTasks(): SyncTask[] {
    return this.stateMachine.getAllTasks();
  }

  /**
   * 获取指定状态的任务数量
   * @param status - 同步状态
   * @returns 任务数量
   */
  public getTaskCountByStatus(status: SyncStatus): number {
    return this.stateMachine.getTaskCountByStatus(status);
  }

  /**
   * 获取任务统计信息
   * @returns 按状态分组的任务统计
   */
  public getStats(): Record<SyncStatus, number> {
    return this.stateMachine.getStats();
  }

  /**
   * 清理已完成的任务
   * @returns void
   */
  public cleanupCompletedTasks(): void {
    this.stateMachine.cleanupCompletedTasks();
  }

  /**
   * 获取指定状态的同步作业数量 - 兼容原有接口
   * @param status - 同步状态
   * @returns 作业数量
   */
  public getSyncJobCountByStatus(status: SyncStatus): number {
    return this.getTaskCountByStatus(status);
  }

  /**
   * 获取重试统计信息 - 兼容原有接口
   * @returns 重试统计信息
   */
  public getRetryStats(): { totalRetries: number; activeRetries: number } {
    const retryingCount = this.getTaskCountByStatus(SyncStatus.RETRYING);
    const totalRetries = this.getAllSyncTasks().reduce(
      (sum, task) => sum + task.retries,
      0,
    );

    return { totalRetries, activeRetries: retryingCount };
  }

  /**
   * 取消指定文档的所有重试任务 - 兼容原有接口
   * @param docId - 文档ID
   * @returns 取消的任务数量
   */
  public cancelAllRetriesForDoc(docId: DocId): number {
    const task = this.stateMachine.getTaskStatus(docId);
    if (task && task.status === SyncStatus.RETRYING) {
      return this.stateMachine.transitionState(
        docId,
        SyncStatus.FAILED,
        '重试已取消',
      )
        ? 1
        : 0;
    }
    return 0;
  }

  /**
   * 获取活跃重试任务数量 - 兼容原有接口
   * @returns 活跃重试任务数量
   */
  public getActiveRetryTaskCount(): number {
    return this.getTaskCountByStatus(SyncStatus.RETRYING);
  }
}
