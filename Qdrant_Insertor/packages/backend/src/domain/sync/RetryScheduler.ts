import {
  RetryStrategy,
  RetryTask,
  RetryStats,
  ErrorCategory,
  DEFAULT_RETRY_STRATEGY,
} from './retry.js';
import { Logger } from '@logging/logger.js';
import { IRetryScheduler } from './RetrySchedulerInterface.js';
import {
  calculateDelay,
  generateTaskId,
  formatDelay,
  calculateSuccessRate,
  calculateAverageRetryTime,
  updateRetryTimes,
} from './RetryUtils.js';

/**
 * 重试调度器实现
 */
export class RetryScheduler implements IRetryScheduler {
  private retryTasks: Map<string, RetryTask> = new Map();
  private retryStats: RetryStats = {
    totalRetries: 0,
    successfulRetries: 0,
    failedRetries: 0,
    averageRetryTimeMs: 0,
    retryCountByCategory: {} as Record<ErrorCategory, number>,
    successCountByCategory: {} as Record<ErrorCategory, number>,
  };
  private retryTimes: number[] = []; // 用于计算平均重试时间

  /**
   * 构造函数
   * @param logger 日志记录器
   */
  constructor(private readonly logger: Logger) {
    // 初始化统计对象
    Object.values(ErrorCategory).forEach((category) => {
      this.retryStats.retryCountByCategory[category] = 0;
      this.retryStats.successCountByCategory[category] = 0;
    });
  }

  /**
   * 调度重试任务
   * @param docId 文档ID
   * @param error 错误对象
   * @param errorCategory 错误分类
   * @param retryCount 重试次数
   * @param strategy 重试策略
   * @param callback 重试回调函数
   * @returns 任务ID
   */
  scheduleRetry(
    docId: string,
    error: Error,
    errorCategory: ErrorCategory,
    retryCount: number,
    strategy: RetryStrategy = DEFAULT_RETRY_STRATEGY,
    callback: () => Promise<void>,
  ): string {
    const taskId = generateTaskId(docId);

    // 计算延迟时间
    const delayMs = calculateDelay(retryCount, strategy);
    const nextRetryAt = Date.now() + delayMs;

    // 创建重试任务
    const task: RetryTask = {
      id: taskId,
      docId,
      errorCategory,
      error,
      retryCount,
      nextRetryAt,
      strategy,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // 调度重试
    const timeoutId = setTimeout(async () => {
      try {
        const startTime = Date.now();
        await callback();
        const endTime = Date.now();

        // 更新成功统计
        this.updateSuccessStats(errorCategory, endTime - startTime);

        // 移除任务
        this.retryTasks.delete(taskId);

        this.logger.info(`[${docId}] 重试成功 (第${retryCount}次重试)`, {
          taskId,
          errorCategory,
          retryCount,
          duration: endTime - startTime,
        });
      } catch (retryError) {
        // 更新失败统计
        this.updateFailureStats(errorCategory);

        // 移除任务
        this.retryTasks.delete(taskId);
        this.logger.error(`[${docId}] 重试失败 (第${retryCount}次重试)`, {
          taskId,
          errorCategory,
          retryCount,
          error: (retryError as Error).message,
        });
      }
    }, delayMs);

    task.timeoutId = timeoutId;
    this.retryTasks.set(taskId, task);

    // 更新总体统计
    this.retryStats.totalRetries++;
    this.retryStats.retryCountByCategory[errorCategory]++;
    this.retryStats.lastRetryAt = Date.now();

    this.logger.info(
      `[${docId}] 已调度重试(${retryCount}/${strategy.maxRetries})`,
      {
        taskId,
        errorCategory,
        retryCount,
        delayMs: formatDelay(delayMs),
        nextRetryAt: new Date(nextRetryAt).toISOString(),
      },
    );

    return taskId;
  }

  /**
   * 取消重试任务
   * @param taskId 任务ID
   * @returns 是否成功取消
   */
  cancelRetry(taskId: string): boolean {
    const task = this.retryTasks.get(taskId);
    if (!task) {
      return false;
    }

    if (task.timeoutId) {
      clearTimeout(task.timeoutId);
    }

    this.retryTasks.delete(taskId);
    this.logger.info(`[${task.docId}] 重试任务已取消`, {
      taskId,
      errorCategory: task.errorCategory,
      retryCount: task.retryCount,
    });

    return true;
  }

  /**
   * 获取重试统计信息
   * @returns 重试统计信息
   */
  getRetryStats(): RetryStats {
    return { ...this.retryStats };
  }

  /**
   * 清理已完成的任务
   * @returns 无返回值
   */
  cleanupCompletedTasks(): void {
    // 由于任务在完成后会自动删除，这里主要是清理过期的任务
    const now = Date.now();
    const cleanupThreshold = 24 * 60 * 60 * 1000; // 24小时

    for (const [taskId, task] of this.retryTasks.entries()) {
      if (now - task.createdAt > cleanupThreshold) {
        if (task.timeoutId) {
          clearTimeout(task.timeoutId);
        }
        this.retryTasks.delete(taskId);
        this.logger.warn(`清理过期重试任务`, {
          taskId,
          docId: task.docId,
          errorCategory: task.errorCategory,
        });
      }
    }
  }

  /**
   * 获取活跃任务数量
   * @returns 活跃任务数量
   */
  getActiveTaskCount(): number {
    return this.retryTasks.size;
  }

  /**
   * 取消指定文档的所有重试任务
   * @param docId 文档ID
   * @returns 取消的任务数量
   */
  public cancelAllRetriesForDoc(docId: string): number {
    const tasks = this.getTasksByDocId(docId);
    let cancelledCount = 0;

    for (const task of tasks) {
      if (this.cancelRetry(task.id)) {
        cancelledCount++;
      }
    }

    return cancelledCount;
  }

  /**
   * 获取任务详情
   * @param taskId 任务ID
   * @returns 任务详情或undefined
   */
  public getTask(taskId: string): RetryTask | undefined {
    return this.retryTasks.get(taskId);
  }

  /**
   * 获取所有活跃任务
   * @returns 活跃任务列表
   */
  public getAllTasks(): RetryTask[] {
    return Array.from(this.retryTasks.values());
  }

  /**
   * 获取指定文档的重试任务
   * @param docId 文档ID
   * @returns 重试任务列表
   */
  public getTasksByDocId(docId: string): RetryTask[] {
    return Array.from(this.retryTasks.values()).filter(
      (task) => task.docId === docId,
    );
  }

  /**
   * 更新成功统计
   * @param errorCategory
   * @param duration
   */
  private updateSuccessStats(
    errorCategory: ErrorCategory,
    duration: number,
  ): void {
    this.retryStats.successfulRetries++;
    this.retryStats.successCountByCategory[errorCategory]++;

    // 更新平均重试时间
    this.retryTimes = updateRetryTimes(this.retryTimes, duration);
    this.retryStats.averageRetryTimeMs = calculateAverageRetryTime(
      this.retryTimes,
    );
  }

  /**
   * 更新失败统计
   * @param errorCategory
   */
  private updateFailureStats(errorCategory: ErrorCategory): void {
    this.retryStats.failedRetries++;
  }
}

/**
 * 创建重试调度器实现
 * @param logger 日志记录器
 * @returns 重试调度器实例
 */
export function createRetryScheduler(logger: Logger): IRetryScheduler {
  return new RetryScheduler(logger);
}
