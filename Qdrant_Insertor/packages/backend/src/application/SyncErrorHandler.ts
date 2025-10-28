import { Logger } from '../logger.js';
import { SyncJobStatus, SyncJob } from '../domain/sync/types.js';
import { ErrorCategory, RetryStats } from '../domain/sync/retry.js';
import { createErrorClassifier } from '../domain/sync/ErrorClassifier.js';
import { createRetryScheduler } from '../domain/sync/RetryScheduler.js';
import { IRetryScheduler } from '../domain/sync/RetrySchedulerInterface.js';
import { SyncJobManager } from './SyncJobManager.js';

/**
 * 同步错误处理器
 * 负责处理同步过程中的错误和重试逻辑
 */
export class SyncErrorHandler {
  private readonly errorClassifier = createErrorClassifier();
  private readonly retryScheduler: IRetryScheduler;
  private readonly logger: Logger;

  constructor(
    private readonly syncJobManager: SyncJobManager,
    logger: Logger,
  ) {
    this.logger = logger;
    this.retryScheduler = createRetryScheduler(logger);
  }

  /**
   * 获取重试统计信息
   *
   * @returns 重试统计
   */
  getRetryStats(): RetryStats {
    return this.retryScheduler.getRetryStats();
  }

  /**
   * 取消指定文档的所有重试任务
   *
   * @param docId - 文档ID
   * @returns 取消的任务数量
   */
  cancelAllRetriesForDoc(docId: string): number {
    return this.retryScheduler.cancelAllRetriesForDoc(docId);
  }

  /**
   * 获取活跃重试任务数量
   *
   * @returns 活跃任务数量
   */
  getActiveRetryTaskCount(): number {
    return this.retryScheduler.getActiveTaskCount();
  }

  /**
   * 处理重试逻辑
   *
   * @param docId - 文档ID
   * @param error - 错误对象
   * @param startTime - 开始时间
   */
  async handleRetry(
    docId: string,
    error: Error,
    startTime: number,
  ): Promise<void> {
    const job = await this.syncJobManager.getOrCreateSyncJob(docId);
    const errorCategory = this.errorClassifier.classify(error);
    const retryStrategy = this.errorClassifier.getRetryStrategy(error);

    // 检查是否为永久错误
    if (!this.errorClassifier.isTemporary(error)) {
      await this.syncJobManager.updateJobStatus(
        docId,
        SyncJobStatus.DEAD,
        error.message,
        {
          completed_at: Date.now(),
          duration_ms: Date.now() - startTime,
          error_category: errorCategory,
        },
      );
      return;
    }

    // 检查重试次数是否超过限制
    if (job.retries >= retryStrategy.maxRetries) {
      await this.syncJobManager.updateJobStatus(
        docId,
        SyncJobStatus.DEAD,
        error.message,
        {
          completed_at: Date.now(),
          duration_ms: Date.now() - startTime,
          error_category: errorCategory,
        },
      );
      return;
    }

    await this.syncJobManager.updateJobStatus(
      docId,
      SyncJobStatus.RETRYING,
      error.message,
      {
        last_attempt_at: Date.now(),
        error_category: errorCategory,
        last_retry_strategy: JSON.stringify(retryStrategy),
      },
    );

    // 使用重试调度器调度重试
    this.retryScheduler.scheduleRetry(
      docId,
      error,
      errorCategory,
      job.retries,
      retryStrategy,
      () => this.executeSync(docId), // 这里需要传入执行函数
    );
  }

  /**
   * 处理同步错误
   *
   * @param docId - 文档ID
   * @param error - 错误对象
   * @param startTime - 开始时间
   */
  async handleSyncError(
    docId: string,
    error: Error,
    startTime: number,
  ): Promise<void> {
    const job = await this.syncJobManager.getOrCreateSyncJob(docId);
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
    await this.syncJobManager.updateJobStatus(
      docId,
      SyncJobStatus.FAILED,
      error.message,
      {
        last_attempt_at: Date.now(),
        error_category: errorCategory,
      },
    );

    // 处理重试逻辑
    await this.handleRetry(docId, error, startTime);
  }

  /**
   * 判断是否应该重试作业
   *
   * @param job - 同步作业
   * @returns 是否应该重试
   */
  shouldRetryJob(job: SyncJob): boolean {
    const errorCategory = job.error
      ? this.errorClassifier.classify(new Error(job.error))
      : ErrorCategory.UNKNOWN;
    const retryStrategy = this.errorClassifier.getRetryStrategy(
      new Error(job.error || 'Unknown error'),
    );

    return (
      this.errorClassifier.isTemporary(
        new Error(job.error || 'Unknown error'),
      ) && job.retries < retryStrategy.maxRetries
    );
  }

  /**
   * 为作业调度重试
   *
   * @param job - 同步作业
   */
  async scheduleRetryForJob(job: SyncJob): Promise<void> {
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
      () => this.executeSync(job.docId),
    );
  }

  /**
   * 清理已完成的任务
   */
  cleanupCompletedTasks(): void {
    this.retryScheduler.cleanupCompletedTasks();
  }

  /**
   * 设置执行同步的方法
   * @param executeSyncMethod - 执行同步的方法
   */
  setExecuteSyncMethod(
    executeSyncMethod: (docId: string) => Promise<void>,
  ): void {
    this.executeSync = executeSyncMethod;
  }

  /**
   * 执行同步的占位符方法
   * 实际实现应该在外部提供
   */
  private executeSync(docId: string): Promise<void> {
    // 这个方法应该在外部注入
    throw new Error('executeSync method must be injected');
  }
}
