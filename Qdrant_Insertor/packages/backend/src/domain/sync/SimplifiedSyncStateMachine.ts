/**
 * 简化的同步状态机
 * 将复杂的状态机实现简化为基本的枚举和转换函数
 */

import { Logger } from '@logging/logger.js';
import { DocId } from '@domain/entities/types.js';

/**
 * 简化的同步状态枚举
 */
export enum SyncStatus {
  NEW = 'NEW',
  SPLIT_OK = 'SPLIT_OK',
  EMBED_OK = 'EMBED_OK',
  SYNCED = 'SYNCED',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
  DEAD = 'DEAD',
}

/**
 * 简化的同步任务接口
 */
export interface SyncTask {
  id: string;
  docId: DocId;
  status: SyncStatus;
  retries: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
  lastAttemptAt?: number;
}

/**
 * 简化的状态转换规则
 */
const STATE_TRANSITIONS: Record<SyncStatus, SyncStatus[]> = {
  [SyncStatus.NEW]: [SyncStatus.SPLIT_OK, SyncStatus.FAILED],
  [SyncStatus.SPLIT_OK]: [SyncStatus.EMBED_OK, SyncStatus.FAILED],
  [SyncStatus.EMBED_OK]: [SyncStatus.SYNCED, SyncStatus.FAILED],
  [SyncStatus.SYNCED]: [], // 终态
  [SyncStatus.FAILED]: [SyncStatus.RETRYING, SyncStatus.DEAD],
  [SyncStatus.RETRYING]: [
    SyncStatus.SPLIT_OK,
    SyncStatus.EMBED_OK,
    SyncStatus.SYNCED,
    SyncStatus.FAILED,
  ],
  [SyncStatus.DEAD]: [], // 终态
};

/**
 * 简化的同步状态机实现
 */
export class SimplifiedSyncStateMachine {
  private tasks: Map<string, SyncTask> = new Map();
  private docIdToTaskId: Map<DocId, string> = new Map(); // 优化查找性能
  private readonly maxRetries = 3;

  constructor(private readonly logger: Logger) {}

  /**
   * 创建或获取同步任务
   * @param docId - 文档ID
   * @returns 同步任务对象
   */
  getOrCreateTask(docId: DocId): SyncTask {
    // 使用Map优化查找性能
    const existingTaskId = this.docIdToTaskId.get(docId);
    if (existingTaskId) {
      const existingTask = this.tasks.get(existingTaskId);
      if (existingTask) {
        return existingTask;
      }
      // 清理无效的映射
      this.docIdToTaskId.delete(docId);
    }

    const newTask: SyncTask = {
      id: `sync_${docId}_${Date.now()}`,
      docId,
      status: SyncStatus.NEW,
      retries: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.tasks.set(newTask.id, newTask);
    this.docIdToTaskId.set(docId, newTask.id);
    this.logger.debug(`创建同步任务: ${docId}`);
    return newTask;
  }

  /**
   * 验证状态转换是否合法
   * @param from - 当前状态
   * @param to - 目标状态
   * @returns 是否允许转换
   */
  private isValidTransition(from: SyncStatus, to: SyncStatus): boolean {
    return STATE_TRANSITIONS[from]?.includes(to) || false;
  }

  /**
   * 转换状态
   * @param docId - 文档ID
   * @param newStatus - 新状态
   * @param error - 可选的错误信息
   * @returns 转换是否成功
   */
  transitionState(
    docId: DocId,
    newStatus: SyncStatus,
    error?: string,
  ): boolean {
    const task = this.getOrCreateTask(docId);

    if (!this.isValidTransition(task.status, newStatus)) {
      this.logger.error(
        `无效的状态转换: ${task.status} -> ${newStatus} (文档: ${docId})`,
      );
      return false;
    }

    const oldStatus = task.status;
    task.status = newStatus;
    task.updatedAt = Date.now();

    if (error) {
      task.error = error;
    }

    if (newStatus === SyncStatus.RETRYING) {
      task.retries += 1;
      task.lastAttemptAt = Date.now();
    }

    // 更新任务在Map中的引用
    this.tasks.set(task.id, task);
    this.logger.info(`状态转换成功: ${docId} ${oldStatus} -> ${newStatus}`);
    return true;
  }

  /**
   * 获取任务状态
   * @param docId - 文档ID
   * @returns 同步任务对象或undefined
   */
  getTaskStatus(docId: DocId): SyncTask | undefined {
    const taskId = this.docIdToTaskId.get(docId);
    return taskId ? this.tasks.get(taskId) : undefined;
  }

  /**
   * 获取所有任务
   * @returns 所有同步任务数组
   */
  getAllTasks(): SyncTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 获取指定状态的任务数量
   * @param status - 同步状态
   * @returns 任务数量
   */
  getTaskCountByStatus(status: SyncStatus): number {
    let count = 0;
    for (const task of this.tasks.values()) {
      if (task.status === status) count++;
    }
    return count;
  }

  /**
   * 检查是否可以重试
   * @param docId - 文档ID
   * @returns 是否可以重试
   */
  canRetry(docId: DocId): boolean {
    const task = this.getTaskStatus(docId);
    if (!task || task.status !== SyncStatus.FAILED) {
      return false;
    }
    return task.retries < this.maxRetries;
  }

  /**
   * 检查是否应该标记为DEAD
   * @param docId - 文档ID
   * @returns 是否应该标记为DEAD
   */
  shouldMarkAsDead(docId: DocId): boolean {
    const task = this.getTaskStatus(docId);
    if (!task || task.status !== SyncStatus.FAILED) {
      return false;
    }
    return task.retries >= this.maxRetries;
  }

  /**
   * 清理已完成的任务
   */
  cleanupCompletedTasks(): void {
    const now = Date.now();
    const cleanupThreshold = 24 * 60 * 60 * 1000; // 24小时

    for (const [taskId, task] of this.tasks.entries()) {
      if (
        (task.status === SyncStatus.SYNCED ||
          task.status === SyncStatus.DEAD) &&
        now - task.updatedAt > cleanupThreshold
      ) {
        this.tasks.delete(taskId);
        this.docIdToTaskId.delete(task.docId); // 同时清理映射
        this.logger.debug(`清理已完成任务: ${task.docId}`);
      }
    }
  }

  /**
   * 获取任务统计信息
   * @returns 各状态的任务数量统计
   */
  getStats(): Record<SyncStatus, number> {
    // 使用Object.fromEntries简化初始化
    const stats: Record<SyncStatus, number> = Object.fromEntries(
      Object.values(SyncStatus).map((status) => [status, 0]),
    ) as Record<SyncStatus, number>;

    for (const task of this.tasks.values()) {
      stats[task.status]++;
    }

    return stats;
  }
}
