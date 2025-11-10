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
   * 创建持久化同步状态机实例
   * @param sqliteRepo SQLite 仓库实例
   * @param qdrantRepo Qdrant 仓库实例
   * @param embeddingProvider 嵌入提供者
   * @param splitter 文本分割器
   * @param logger 日志记录器
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

    try {
      for (const status of statuses) {
        try {
          const jobs = await this.sqliteRepo.syncJobs.getByStatus(status);
          unfinishedJobs.push(...jobs);
        } catch (error) {
          this.logger.warn(`查询状态 ${status} 的同步作业失败`, {
            error: error instanceof Error ? error.message : String(error),
          });
          // 继续查询其他状态
        }
      }
    } catch (error) {
      this.logger.warn('加载未完成的同步作业失败，将从空状态开始', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    this.logger.info(`找到 ${unfinishedJobs.length} 个未完成的同步作业`);

    // 恢复状态机状态
    for (const job of unfinishedJobs) {
      try {
        // 使用getOrCreateSyncJob方法
        await this.syncJobManager.getOrCreateSyncJob(job.docId);
        this.logger.info(`恢复同步作业: ${job.docId} - ${job.status}`);
      } catch (error) {
        this.logger.error(`恢复同步作业失败: ${job.docId}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
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
      // 更新状态为SPLIT_OK
      await this.syncJobManager.updateJobStatus(docId, SyncJobStatus.SPLIT_OK);

      // 2. 生成嵌入
      await this.documentProcessor.generateEmbeddings(docId);
      // 更新状态为EMBED_OK
      await this.syncJobManager.updateJobStatus(docId, SyncJobStatus.EMBED_OK);

      // 3. 标记为已同步
      await this.documentProcessor.markDocAsSynced(docId);
      // 更新状态为SYNCED
      await this.syncJobManager.updateJobStatus(docId, SyncJobStatus.SYNCED);

      this.logger.info(`同步操作完成: ${docId}，所有步骤均已成功执行`);
    } catch (error) {
      this.logger.error(`同步操作失败: ${docId}`, error);
      // 更新状态为FAILED
      await this.syncJobManager.updateJobStatus(
        docId,
        SyncJobStatus.FAILED,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  /**
   * 获取同步作业状态
   * @param docId 文档ID
   * @returns 同步作业状态
   */
  public getSyncJobStatus(docId: string) {
    return this.syncJobManager.getSyncJobStatus(docId);
  }

  /**
   * 获取所有同步作业
   * @returns 所有同步作业列表
   */
  public getAllSyncJobs() {
    return this.syncJobManager.getAllSyncJobs();
  }

  /**
   * 获取指定状态的同步作业数量
   * @param status 同步作业状态
   * @returns 指定状态的同步作业数量
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
   * @returns 同步作业统计信息
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
   * @returns 活跃重试任务数量
   */
  public getActiveRetryTaskCount(): number {
    return this.syncJobManager.getSyncJobCountByStatus(SyncJobStatus.RETRYING);
  }
}
