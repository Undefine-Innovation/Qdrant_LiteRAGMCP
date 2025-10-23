import { SQLiteRepo } from '../infrastructure/SQLiteRepo.js';
import { IQdrantRepo } from '@domain/IQdrantRepo.js';
import { IEmbeddingProvider } from '../domain/embedding.js';
import { ISplitter } from '../domain/splitter.js';
import { Logger } from '../logger.js';
import {
  DocId,
  ChunkMeta,
  Doc,
  DocumentChunk,
  PointId,
} from '@domain/types.js';
import { Point } from '@domain/IQdrantRepo.js';
import { makePointId } from '@domain/utils/id.js';
import { SyncJobStatus, SyncJobEvent, SyncJob, SyncMachineContext, SyncMachineEvent } from '@domain/sync/types.js';

/**
 * @class SyncStateMachine
 * @description 管理文档同步的状态机，负责协调文档的分割、嵌入生成和 Qdrant 同步。
 */
export class SyncStateMachine {
  private readonly maxRetries: number = 3;
  private readonly retryDelayMs: number = 5000; // 5秒重试延迟
  private syncJobs: Map<string, SyncJob> = new Map();

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
  ) {}

  /**
   * 状态转换规则定义
   */
  private readonly stateTransitions: Map<SyncJobStatus, Map<SyncJobEvent, SyncJobStatus>> = new Map([
    [SyncJobStatus.NEW, new Map([
      [SyncJobEvent.CHUNKS_SAVED, SyncJobStatus.SPLIT_OK],
      [SyncJobEvent.ERROR, SyncJobStatus.FAILED],
    ])],
    [SyncJobStatus.SPLIT_OK, new Map([
      [SyncJobEvent.VECTORS_INSERTED, SyncJobStatus.EMBED_OK],
      [SyncJobEvent.ERROR, SyncJobStatus.FAILED],
    ])],
    [SyncJobStatus.EMBED_OK, new Map([
      [SyncJobEvent.META_UPDATED, SyncJobStatus.SYNCED],
      [SyncJobEvent.ERROR, SyncJobStatus.FAILED],
    ])],
    [SyncJobStatus.FAILED, new Map([
      [SyncJobEvent.RETRY, SyncJobStatus.RETRYING],
      [SyncJobEvent.RETRIES_EXCEEDED, SyncJobStatus.DEAD],
    ])],
    [SyncJobStatus.RETRYING, new Map([
      [SyncJobEvent.CHUNKS_SAVED, SyncJobStatus.SPLIT_OK],
      [SyncJobEvent.VECTORS_INSERTED, SyncJobStatus.EMBED_OK],
      [SyncJobEvent.META_UPDATED, SyncJobStatus.SYNCED],
      [SyncJobEvent.ERROR, SyncJobStatus.FAILED],
    ])],
    [SyncJobStatus.SYNCED, new Map()], // 终态
    [SyncJobStatus.DEAD, new Map()], // 终态
  ]);

  /**
   * 创建或获取同步作业
   */
  private getOrCreateSyncJob(docId: string): SyncJob {
    let job = this.syncJobs.get(docId);
    if (!job) {
      job = {
        id: `sync_${docId}_${Date.now()}`,
        docId,
        status: SyncJobStatus.NEW,
        retries: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.syncJobs.set(docId, job);
    }
    return job;
  }

  /**
   * 更新同步作业状态
   */
  private updateSyncJob(docId: string, status: SyncJobStatus, error?: string): SyncJob {
    const job = this.getOrCreateSyncJob(docId);
    job.status = status;
    job.updatedAt = Date.now();
    if (error) {
      job.error = error;
    }
    if (status === SyncJobStatus.RETRYING) {
      job.retries += 1;
      job.lastAttemptAt = Date.now();
    }
    this.syncJobs.set(docId, job);
    return job;
  }

  /**
   * 状态转换方法
   */
  private transitionState(docId: string, event: SyncJobEvent, context?: Partial<SyncMachineContext>): boolean {
    const job = this.getOrCreateSyncJob(docId);
    const transitions = this.stateTransitions.get(job.status);
    
    if (!transitions) {
      this.logger.error(`[${docId}] 无效的状态: ${job.status}`);
      return false;
    }

    const newStatus = transitions.get(event);
    if (!newStatus) {
      this.logger.error(`[${docId}] 不允许的状态转换: ${job.status} + ${event}`);
      return false;
    }

    this.updateSyncJob(docId, newStatus, context?.errorMessage);
    this.logger.info(`[${docId}] 状态转换: ${job.status} -> ${newStatus} (事件: ${event})`);
    return true;
  }

  /**
   * 处理重试逻辑
   */
  private async handleRetry(docId: string, error: Error): Promise<void> {
    const job = this.getOrCreateSyncJob(docId);
    
    if (job.retries >= this.maxRetries) {
      this.transitionState(docId, SyncJobEvent.RETRIES_EXCEEDED);
      this.logger.error(`[${docId}] 重试次数超过限制 (${this.maxRetries})，标记为DEAD状态`);
      return;
    }

    this.transitionState(docId, SyncJobEvent.RETRY, { errorMessage: error.message });
    this.logger.info(`[${docId}] 准备重试 (${job.retries}/${this.maxRetries})，延迟 ${this.retryDelayMs}ms`);
    
    // 延迟后重试
    await new Promise(resolve => setTimeout(resolve, this.retryDelayMs));
  }

  /**
   * @method triggerSync
   * @description 触发指定文档的同步过程。包括文档分割、嵌入生成和 Qdrant 向量数据库的更新。
   * @param {DocId} docId - 需要同步的文档 ID。
   * @returns {Promise<void>}
   */
  public async triggerSync(docId: DocId): Promise<void> {
    const job = this.getOrCreateSyncJob(docId);
    
    // 如果是重试状态，直接执行同步逻辑
    if (job.status === SyncJobStatus.RETRYING) {
      await this.executeSync(docId);
      return;
    }

    this.logger.info(`触发文档同步: ${docId}`); // 记录同步触发信息
    await this.executeSync(docId);
  }

  /**
   * 执行同步逻辑
   */
  private async executeSync(docId: DocId): Promise<void> {
    const job = this.getOrCreateSyncJob(docId);
    
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
      this.transitionState(docId, SyncJobEvent.META_UPDATED);
      return;
    }

    const chunks: DocumentChunk[] = this.splitter.split(
      doc.content as string,
      { name: doc.name ?? '' },
    );

    try {
      this.logger.info(`[${docId}] 开始添加chunks到数据库，数量: ${chunks.length}`);
      await this.sqliteRepo.addChunks(docId, chunks);
      this.transitionState(docId, SyncJobEvent.CHUNKS_SAVED);
      this.logger.info(`[${docId}] 文档分割完成`);
    } catch (error) {
      this.logger.error(`[${docId}] 添加chunks到数据库失败`, {
        error: (error as Error).message,
        stack: (error as Error).stack,
        chunksCount: chunks.length,
        firstChunk: chunks[0] ? {
          content: chunks[0].content.substring(0, 100),
          titleChain: chunks[0].titleChain
        } : null
      });
      throw error;
    }
  }

  /**
   * 生成嵌入
   */
  private async generateEmbeddings(docId: DocId): Promise<void> {
    this.logger.info(`[${docId}] 开始生成嵌入...`);
    
    const chunkMetas: ChunkMeta[] = await this.sqliteRepo.getChunkMetasByDocId(docId);
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
    this.transitionState(docId, SyncJobEvent.VECTORS_INSERTED);
    this.logger.info(`[${docId}] 嵌入生成完成`);
  }

  /**
   * 标记为已同步
   */
  private async markAsSynced(docId: DocId): Promise<void> {
    await this.sqliteRepo.markDocAsSynced(docId);
    this.transitionState(docId, SyncJobEvent.META_UPDATED);
    this.logger.info(`[${docId}] 文档同步完成`);
  }

  /**
   * 处理同步错误
   */
  private async handleSyncError(docId: DocId, error: Error): Promise<void> {
    this.logger.error(`[${docId}] 同步失败，错误: ${error.message}`);
    
    const job = this.getOrCreateSyncJob(docId);
    
    // 如果当前状态已经是重试状态，转换到失败状态
    if (job.status === SyncJobStatus.RETRYING) {
      this.transitionState(docId, SyncJobEvent.ERROR, { errorMessage: error.message });
    } else {
      this.transitionState(docId, SyncJobEvent.ERROR, { errorMessage: error.message });
    }

    // 处理重试逻辑
    await this.handleRetry(docId, error);
    
    // 如果状态是重试，则重新执行同步
    if (job.status === SyncJobStatus.RETRYING) {
      await this.executeSync(docId);
    }
  }

  /**
   * 获取同步作业状态
   */
  public getSyncJobStatus(docId: string): SyncJob | undefined {
    return this.syncJobs.get(docId);
  }

  /**
   * 清理已完成的同步作业
   */
  public cleanupCompletedJobs(): void {
    const now = Date.now();
    const cleanupThreshold = 24 * 60 * 60 * 1000; // 24小时

    for (const [docId, job] of this.syncJobs.entries()) {
      if (
        (job.status === SyncJobStatus.SYNCED || job.status === SyncJobStatus.DEAD) &&
        now - job.updatedAt > cleanupThreshold
      ) {
        this.syncJobs.delete(docId);
        this.logger.info(`清理已完成同步作业: ${docId}`);
      }
    }
  }
}
