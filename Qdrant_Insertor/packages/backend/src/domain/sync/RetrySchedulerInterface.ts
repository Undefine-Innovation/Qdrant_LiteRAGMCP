import {
  RetryStrategy,
  RetryTask,
  RetryStats,
  ErrorCategory,
} from './retry.js';

/**
 * 重试调度器接�?
 */
export interface IRetryScheduler {
  /**
   * 调度重试任务
   * @param docId 文档ID
   * @param error 错误对象
   * @param errorCategory 错误分类
   * @param retryCount 当前重试次数
   * @param strategy 重试策略
   * @param callback 重试回调函数
   * @returns 重试任务ID
   */
  scheduleRetry(
    docId: string,
    error: Error,
    errorCategory: ErrorCategory,
    retryCount: number,
    strategy: RetryStrategy,
    callback: () => Promise<void>,
  ): string;

  /**
   * 取消重试任务
   * @param taskId 任务ID
   * @returns 是否成功取消
   */
  cancelRetry(taskId: string): boolean;

  /**
   * 获取重试统计信息
   * @returns 重试统计信息
   */
  getRetryStats(): RetryStats;

  /**
   * 清理已完成的任务
   */
  cleanupCompletedTasks(): void;

  /**
   * 获取活跃任务数量
   * @returns 活跃任务数量
   */
  getActiveTaskCount(): number;

  /**
   * 取消指定文档的所有重试任�?
   * @param docId 文档ID
   * @returns 取消的任务数�?
   */
  cancelAllRetriesForDoc(docId: string): number;
}
