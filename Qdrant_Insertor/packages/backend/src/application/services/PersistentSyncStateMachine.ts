import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';
import { IEmbeddingProvider } from '@domain/entities/embedding.js';
import { ISplitter } from '@domain/services/splitter.js';
import { Logger } from '@logging/logger.js';
import { DocId } from '@domain/entities/types.js';
import { SyncJobStatus } from '@domain/sync/types.js';
import { SyncJobManager } from './SyncJobManager.js';
import { DocumentSyncProcessor } from './DocumentSyncProcessor.js';
import { SyncErrorHandler } from './SyncErrorHandler.js';

/**
 * 持久化同步状态机
 * 扩展原有的SyncStateMachine，添加状态持久化功能
 */
export class PersistentSyncStateMachine {
  /**
   *
   * @param sqliteRepo
   * @param qdrantRepo
   * @param embeddingProvider
   * @param splitter
   * @param logger
   */
  constructor(
    private readonly sqliteRepo: ISQLiteRepo,
    private readonly qdrantRepo: IQdrantRepo,
    private readonly embeddingProvider: IEmbeddingProvider,
    private readonly splitter: ISplitter,
    private readonly logger: Logger,
  ) {
    // 需要类型转换，因为SyncJobManager需要SQLiteRepo而不是ISQLiteRepo
    this.syncJobManager = new SyncJobManager(sqliteRepo as ISQLiteRepo, logger);
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
      this.executeSync(docId as DocId),
    );
  }

  private readonly syncJobManager: SyncJobManager;
  private readonly documentProcessor: DocumentSyncProcessor;
  private readonly errorHandler: SyncErrorHandler;

  /**
   * 初始化状态机，从数据库恢复未完成的同步操作
   */
  async initialize(): Promise<void> {
    this.logger.info('初始化持久化同步状态机...');

    // 从数据库加载未完成的同步作业
    const unfinishedJobs: Array<{
      docId: string;
      status: string;
      createdAt: number;
      updatedAt: number;
    }> = [];

    // 分别查询每个状态
    const statuses = [
      SyncJobStatus.NEW,
      SyncJobStatus.SPLIT_OK,
      SyncJobStatus.EMBED_OK,
      SyncJobStatus.FAILED,
      SyncJobStatus.RETRYING,
    ];

    for (const status of statuses) {
      const jobs = this.sqliteRepo.syncJobs.getByStatus(status);
      unfinishedJobs.push(...jobs);
    }

    this.logger.info(`找到 ${unfinishedJobs.length} 个未完成的同步作业`);

    // 恢复状态机状态
    for (const job of unfinishedJobs) {
      // 使用getOrCreateSyncJob方法
      await this.syncJobManager.getOrCreateSyncJob(job.docId);
      this.logger.info(`恢复同步作业: ${job.docId} - ${job.status}`);
    }

    this.logger.info('持久化同步状态机初始化完成');
  }

  /**
   * 执行同步操作
   * @param docId
   */
  private async executeSync(docId: DocId): Promise<void> {
    this.logger.info(`执行同步操作: ${docId}`);

    try {
      // 1. 分割文档
      await this.documentProcessor.splitDocument(docId);

      // 2. 生成嵌入
      await this.documentProcessor.generateEmbeddings(docId);

      // 3. 标记为已同步
      await this.documentProcessor.markDocAsSynced(docId);

      this.logger.info(`同步操作完成: ${docId}`);
    } catch (error) {
      this.logger.error(`同步操作失败: ${docId}`, error);
      throw error;
    }
  }

  /**
   * 获取同步作业状态
   * @param docId
   */
  public getSyncJobStatus(docId: string) {
    return this.syncJobManager.getSyncJobStatus(docId);
  }

  /**
   * 获取所有同步作业
   */
  public getAllSyncJobs() {
    return this.syncJobManager.getAllSyncJobs();
  }

  /**
   * 获取指定状态的同步作业数量
   * @param status
   */
  public getSyncJobCountByStatus(status: SyncJobStatus): number {
    return this.syncJobManager.getSyncJobCountByStatus(status);
  }

  /**
   * 清理已完成的同步作业
   */
  public cleanupCompletedJobs(): void {
    this.syncJobManager.cleanupCompletedJobs(7); // 默认保留7天
  }

  /**
   * 触发同步操作
   * @param docId
   */
  public async triggerSync(docId: DocId): Promise<void> {
    this.logger.info(`触发同步操作: ${docId}`);

    // 创建新的同步作业
    await this.syncJobManager.getOrCreateSyncJob(docId);

    // 执行同步
    await this.executeSync(docId);
  }

  /**
   * 获取同步作业统计信息
   */
  public getSyncJobStats() {
    const allJobs = this.syncJobManager.getAllSyncJobs();
    return {
      total: allJobs.length,
      successRate:
        allJobs.filter((job) => job.status === SyncJobStatus.SYNCED).length /
        Math.max(allJobs.length, 1),
      avgDuration: 0, // SyncJob接口没有durationMs字段，暂时设为0
      byStatus: allJobs.reduce(
        (acc, job) => {
          acc[job.status] = (acc[job.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }

  /**
   * 获取活跃重试任务数量
   */
  public getActiveRetryTaskCount(): number {
    return this.syncJobManager.getSyncJobCountByStatus(SyncJobStatus.RETRYING);
  }
}
