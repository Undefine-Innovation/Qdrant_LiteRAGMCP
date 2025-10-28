import { SQLiteRepo } from '../infrastructure/SQLiteRepo.js';
import { IQdrantRepo } from '../domain/IQdrantRepo.js';
import { IEmbeddingProvider } from '../domain/embedding.js';
import { ISplitter } from '../domain/splitter.js';
import { Logger } from '../logger.js';
import { DocId } from '../domain/types.js';
import { SyncJobStatus } from '../domain/sync/types.js';
import { SyncJobManager } from './SyncJobManager.js';
import { DocumentSyncProcessor } from './DocumentSyncProcessor.js';
import { SyncErrorHandler } from './SyncErrorHandler.js';

/**
 * 持久化同步状态机
 * 扩展原有的SyncStateMachine，添加状态持久化功能
 */
export class PersistentSyncStateMachine {
  constructor(
    private readonly sqliteRepo: SQLiteRepo,
    private readonly qdrantRepo: IQdrantRepo,
    private readonly embeddingProvider: IEmbeddingProvider,
    private readonly splitter: ISplitter,
    private readonly logger: Logger,
  ) {
    this.syncJobManager = new SyncJobManager(sqliteRepo, logger);
    this.documentProcessor = new DocumentSyncProcessor(
      sqliteRepo,
      qdrantRepo,
      embeddingProvider,
      splitter,
      logger,
    );
    this.errorHandler = new SyncErrorHandler(this.syncJobManager, logger);

    // 注入执行方法
    this.errorHandler.setExecuteSyncMethod((docId: string) =>
      this.executeSync(docId),
    );
  }

  private readonly syncJobManager: SyncJobManager;
  private readonly documentProcessor: DocumentSyncProcessor;
  private readonly errorHandler: SyncErrorHandler;

  /**
   * 初始化状态机，从数据库恢复未完成的同步作业
   */
  async initialize(): Promise<void> {
    this.logger.info('初始化持久化同步状态机...');

    // 从数据库加载未完成的同步作业
    const unfinishedJobs = this.sqliteRepo.syncJobs.getByStatus(
      SyncJobStatus.NEW,
    );
    const splitOkJobs = this.sqliteRepo.syncJobs.getByStatus(
      SyncJobStatus.SPLIT_OK,
    );
    const embedOkJobs = this.sqliteRepo.syncJobs.getByStatus(
      SyncJobStatus.EMBED_OK,
    );
    const retryingJobs = this.sqliteRepo.syncJobs.getByStatus(
      SyncJobStatus.RETRYING,
    );
    const failedJobs = this.sqliteRepo.syncJobs.getByStatus(
      SyncJobStatus.FAILED,
    );

    const allUnfinishedJobs = [
      ...unfinishedJobs,
      ...splitOkJobs,
      ...embedOkJobs,
      ...retryingJobs,
      ...failedJobs,
    ];

    // 将作业加载到内存中
    for (const job of allUnfinishedJobs) {
      await this.syncJobManager.getOrCreateSyncJob(job.docId);

      // 根据状态决定是否需要重新处理
      if (
        job.status === SyncJobStatus.RETRYING ||
        job.status === SyncJobStatus.FAILED
      ) {
        // 检查是否需要重新调度重试
        if (this.errorHandler.shouldRetryJob(job)) {
          this.logger.info(`[初始化] 重新调度重试: ${job.docId}`);
          await this.errorHandler.scheduleRetryForJob(job);
        } else {
          // 标记为DEAD状态
          await this.syncJobManager.updateJobStatus(
            job.docId,
            SyncJobStatus.DEAD,
            '系统重启后重试次数超限',
          );
        }
      }
    }

    this.logger.info(
      `从数据库恢复了 ${allUnfinishedJobs.length} 个未完成的同步作业`,
    );
  }

  /**
   * 触发指定文档的同步过程
   */
  public async triggerSync(docId: DocId): Promise<void> {
    const job = await this.syncJobManager.getOrCreateSyncJob(docId);

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
    const job = await this.syncJobManager.getOrCreateSyncJob(docId);
    const startTime = Date.now();

    // 记录开始时间
    await this.syncJobManager.updateJobStatus(
      job.docId,
      job.status,
      undefined,
      {
        started_at: startTime,
      },
    );

    try {
      // 1. 分割文档
      await this.documentProcessor.splitDocument(docId);

      // 2. 生成嵌入
      await this.documentProcessor.generateEmbeddings(docId);

      // 3. 标记为已同步
      await this.markAsSynced(docId, startTime);
    } catch (error: unknown) {
      await this.errorHandler.handleSyncError(docId, error as Error, startTime);
    }
  }

  /**
   * 标记为已同步
   */
  private async markAsSynced(docId: DocId, startTime: number): Promise<void> {
    await this.documentProcessor.markDocAsSynced(docId);
    const duration = Date.now() - startTime;
    await this.syncJobManager.updateJobStatus(
      docId,
      SyncJobStatus.SYNCED,
      undefined,
      {
        completed_at: Date.now(),
        duration_ms: duration,
        progress: 100,
      },
    );
    this.logger.info(`[${docId}] 文档同步完成，耗时: ${duration}ms`);
  }

  /**
   * 获取同步作业状态
   */
  public getSyncJobStatus(docId: string) {
    return this.syncJobManager.getSyncJobStatus(docId);
  }

  /**
   * 获取重试统计信息
   */
  public getRetryStats() {
    return this.errorHandler.getRetryStats();
  }

  /**
   * 取消指定文档的所有重试任务
   */
  public cancelAllRetriesForDoc(docId: string): number {
    return this.errorHandler.cancelAllRetriesForDoc(docId);
  }

  /**
   * 获取活跃重试任务数量
   */
  public getActiveRetryTaskCount(): number {
    return this.errorHandler.getActiveRetryTaskCount();
  }

  /**
   * 清理已完成的同步作业和重试任务
   */
  public cleanupCompletedJobs(): void {
    // 清理已完成的作业
    this.syncJobManager.cleanupCompletedJobs(7);

    // 清理重试任务
    this.errorHandler.cleanupCompletedTasks();
  }

  /**
   * 获取所有同步作业状态
   */
  public getAllSyncJobs() {
    return this.syncJobManager.getAllSyncJobs();
  }

  /**
   * 获取指定状态的同步作业数量
   */
  public getSyncJobCountByStatus(status: SyncJobStatus): number {
    return this.syncJobManager.getSyncJobCountByStatus(status);
  }

  /**
   * 获取同步作业统计信息
   */
  public getSyncJobStats() {
    return this.syncJobManager.getSyncJobStats();
  }
}
