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
import { SyncJobStatus, SyncJobEvent, SyncJob } from '@domain/sync/types.js';
import { ErrorCategory, RetryStats } from '@domain/sync/retry.js';
import { createErrorClassifier } from '@domain/sync/ErrorClassifier.js';
import { createRetryScheduler } from '@domain/sync/RetryScheduler.js';
import { IRetryScheduler } from '@domain/sync/RetrySchedulerInterface.js';

/**
 * 持久化同步状态机
 * 扩展原有的SyncStateMachine，添加状态持久化功能
 */
export class PersistentSyncStateMachine {
  private readonly errorClassifier = createErrorClassifier();
  private readonly retryScheduler: IRetryScheduler;
  private readonly memoryJobs: Map<string, SyncJob> = new Map(); // 内存缓存

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
    this.retryScheduler = createRetryScheduler(logger);
  }

  /**
   * 初始化状态机，从数据库恢复未完成的同步作业
   */
  async initialize(): Promise<void> {
    this.logger.info('初始化持久化同步状态机...');
    
    // 从数据库加载未完成的同步作业
    const unfinishedJobs = this.sqliteRepo.syncJobs.getByStatus(SyncJobStatus.NEW);
    const splitOkJobs = this.sqliteRepo.syncJobs.getByStatus(SyncJobStatus.SPLIT_OK);
    const embedOkJobs = this.sqliteRepo.syncJobs.getByStatus(SyncJobStatus.EMBED_OK);
    const retryingJobs = this.sqliteRepo.syncJobs.getByStatus(SyncJobStatus.RETRYING);
    const failedJobs = this.sqliteRepo.syncJobs.getByStatus(SyncJobStatus.FAILED);

    const allUnfinishedJobs = [
      ...unfinishedJobs,
      ...splitOkJobs,
      ...embedOkJobs,
      ...retryingJobs,
      ...failedJobs,
    ];

    // 将作业加载到内存中
    for (const job of allUnfinishedJobs) {
      this.memoryJobs.set(job.docId, job);
      
      // 根据状态决定是否需要重新处理
      if (job.status === SyncJobStatus.RETRYING || job.status === SyncJobStatus.FAILED) {
        // 检查是否需要重新调度重试
        if (this.shouldRetryJob(job)) {
          this.logger.info(`[初始化] 重新调度重试: ${job.docId}`);
          await this.scheduleRetryForJob(job);
        } else {
          // 标记为DEAD状态
          await this.updateJobStatus(job.docId, SyncJobStatus.DEAD, '系统重启后重试次数超限');
        }
      }
    }

    this.logger.info(`从数据库恢复了 ${allUnfinishedJobs.length} 个未完成的同步作业`);
  }

  /**
   * 触发指定文档的同步过程
   */
  public async triggerSync(docId: DocId): Promise<void> {
    const job = await this.getOrCreateSyncJob(docId);

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
    const job = await this.getOrCreateSyncJob(docId);
    const startTime = Date.now();

    // 记录开始时间
    await this.updateJobStatus(job.docId, job.status, undefined, {
      started_at: startTime,
    });

    try {
      // 1. 分割文档
      await this.splitDocument(docId);

      // 2. 生成嵌入
      await this.generateEmbeddings(docId);

      // 3. 标记为已同步
      await this.markAsSynced(docId, startTime);
    } catch (error: unknown) {
      await this.handleSyncError(docId, error as Error, startTime);
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
      await this.markDocAsSynced(docId);
      await this.updateJobStatus(docId, SyncJobStatus.SYNCED);
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
      await this.updateJobStatus(docId, SyncJobStatus.SPLIT_OK);
      this.logger.info(`[${docId}] 文档分割完成`);
    } catch (error) {
      this.logger.error(`[${docId}] 添加chunks到数据库失败`, {
        error: (error as Error).message,
        stack: (error as Error).stack,
        chunksCount: chunks.length,
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
    await this.updateJobStatus(docId, SyncJobStatus.EMBED_OK);
    this.logger.info(`[${docId}] 嵌入生成完成`);
  }

  /**
   * 标记为已同步
   */
  private async markAsSynced(docId: DocId, startTime: number): Promise<void> {
    await this.markDocAsSynced(docId);
    const duration = Date.now() - startTime;
    await this.updateJobStatus(docId, SyncJobStatus.SYNCED, undefined, {
      completed_at: Date.now(),
      duration_ms: duration,
      progress: 100,
    });
    this.logger.info(`[${docId}] 文档同步完成，耗时: ${duration}ms`);
  }

  /**
   * 处理重试逻辑
   */
  private async handleRetry(docId: string, error: Error, startTime: number): Promise<void> {
    const job = await this.getOrCreateSyncJob(docId);
    const errorCategory = this.errorClassifier.classify(error);
    const retryStrategy = this.errorClassifier.getRetryStrategy(error);

    // 检查是否为永久错误
    if (!this.errorClassifier.isTemporary(error)) {
      await this.updateJobStatus(docId, SyncJobStatus.DEAD, error.message, {
        completed_at: Date.now(),
        duration_ms: Date.now() - startTime,
        error_category: errorCategory,
      });
      this.logger.error(`[${docId}] 遇到永久错误，标记为DEAD状态`, {
        errorCategory,
        errorMessage: error.message,
      });
      return;
    }

    // 检查重试次数是否超过限制
    if (job.retries >= retryStrategy.maxRetries) {
      await this.updateJobStatus(docId, SyncJobStatus.DEAD, error.message, {
        completed_at: Date.now(),
        duration_ms: Date.now() - startTime,
        error_category: errorCategory,
      });
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

    await this.updateJobStatus(docId, SyncJobStatus.RETRYING, error.message, {
      last_attempt_at: Date.now(),
      error_category: errorCategory,
      last_retry_strategy: JSON.stringify(retryStrategy),
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
  private async handleSyncError(docId: DocId, error: Error, startTime: number): Promise<void> {
    this.logger.error(`[${docId}] 同步失败，错误: ${error.message}`);

    const job = await this.getOrCreateSyncJob(docId);
    const errorCategory = this.errorClassifier.classify(error);

    // 记录详细的错误信息
    this.logger.error(`[${docId}] 同步错误详情`, {
      errorCategory,
      errorMessage: error.message,
      stack: error.stack,
      currentStatus: job.status,
      retryCount: job.retries,
    });

    // 更新作业状态为失败
    await this.updateJobStatus(docId, SyncJobStatus.FAILED, error.message, {
      last_attempt_at: Date.now(),
      error_category: errorCategory,
    });

    // 处理重试逻辑
    await this.handleRetry(docId, error, startTime);
  }

  /**
   * 获取或创建同步作业
   */
  private async getOrCreateSyncJob(docId: string): Promise<SyncJob> {
    // 首先检查内存缓存
    let job = this.memoryJobs.get(docId);
    
    if (!job) {
      // 从数据库获取
      job = this.sqliteRepo.syncJobs.getByDocId(docId) || undefined;
      
      if (!job) {
        // 创建新作业
        const newJob: Omit<SyncJob, 'id'> = {
          docId,
          status: SyncJobStatus.NEW,
          retries: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        const jobId = this.sqliteRepo.syncJobs.create(newJob);
        job = { ...newJob, id: jobId };
      }
      
      // 缓存到内存
      this.memoryJobs.set(docId, job);
    }
    
    return job;
  }

  /**
   * 更新作业状态
   */
  private async updateJobStatus(
    docId: string,
    status: SyncJobStatus,
    error?: string,
    additionalFields?: {
      started_at?: number;
      completed_at?: number;
      duration_ms?: number;
      error_category?: ErrorCategory;
      last_retry_strategy?: string;
      progress?: number;
      last_attempt_at?: number;
    }
  ): Promise<void> {
    const job = await this.getOrCreateSyncJob(docId);
    
    // 更新内存中的作业
    job.status = status;
    job.updatedAt = Date.now();
    if (error) {
      job.error = error;
    }
    if (status === SyncJobStatus.RETRYING) {
      job.retries += 1;
      job.lastAttemptAt = Date.now();
    }
    
    // 更新数据库
    this.sqliteRepo.syncJobs.update(job.id, {
      ...job,
      ...additionalFields,
    });
    
    // 更新内存缓存
    this.memoryJobs.set(docId, job);
  }

  /**
   * 标记文档为已同步
   */
  private async markDocAsSynced(docId: DocId): Promise<void> {
    await this.sqliteRepo.markDocAsSynced(docId);
  }

  /**
   * 判断是否应该重试作业
   */
  private shouldRetryJob(job: SyncJob): boolean {
    const errorCategory = job.error ? this.errorClassifier.classify(new Error(job.error)) : ErrorCategory.UNKNOWN;
    const retryStrategy = this.errorClassifier.getRetryStrategy(new Error(job.error || 'Unknown error'));
    
    return this.errorClassifier.isTemporary(new Error(job.error || 'Unknown error')) && 
           job.retries < retryStrategy.maxRetries;
  }

  /**
   * 为作业调度重试
   */
  private async scheduleRetryForJob(job: SyncJob): Promise<void> {
    if (!job.error) return;
    
    const error = new Error(job.error);
    const errorCategory = this.errorClassifier.classify(error);
    const retryStrategy = this.errorClassifier.getRetryStrategy(error);
    
    this.retryScheduler.scheduleRetry(
      job.docId,
      error,
      errorCategory,
      job.retries,
      retryStrategy,
      () => this.executeSync(job.docId as DocId),
    );
  }

  /**
   * 获取同步作业状态
   */
  public getSyncJobStatus(docId: string): SyncJob | undefined {
    return this.memoryJobs.get(docId);
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
    // 清理内存中的已完成作业
    const now = Date.now();
    const cleanupThreshold = 24 * 60 * 60 * 1000; // 24小时

    for (const [docId, job] of this.memoryJobs.entries()) {
      if (
        (job.status === SyncJobStatus.SYNCED ||
          job.status === SyncJobStatus.DEAD) &&
        now - job.updatedAt > cleanupThreshold
      ) {
        this.memoryJobs.delete(docId);
        this.logger.info(`清理已完成同步作业: ${docId}`);
      }
    }

    // 清理重试任务
    this.retryScheduler.cleanupCompletedTasks();
    
    // 清理数据库中的过期记录
    const cleanedCount = this.sqliteRepo.syncJobs.cleanup(7);
    if (cleanedCount > 0) {
      this.logger.info(`清理了 ${cleanedCount} 个过期的同步作业记录`);
    }
  }

  /**
   * 获取所有同步作业状态
   */
  public getAllSyncJobs(): SyncJob[] {
    return Array.from(this.memoryJobs.values());
  }

  /**
   * 获取指定状态的同步作业数量
   */
  public getSyncJobCountByStatus(status: SyncJobStatus): number {
    return Array.from(this.memoryJobs.values()).filter(
      (job) => job.status === status,
    ).length;
  }

  /**
   * 获取同步作业统计信息
   */
  public getSyncJobStats() {
    return this.sqliteRepo.syncJobs.getStats();
  }
}