/**
 * 状态机服务接口
 * @description 定义状态机管理的核心业务接口，遵循依赖倒置原则
 */

import type {
  IStateMachineEngine,
  StateMachineTask,
  StateMachineContext,
} from '../state-machine/types.js';

/**
 * 任务执行选项
 */
export interface TaskExecutionOptions {
  retryCount?: number;
  timeout?: number;
  priority?: 'low' | 'normal' | 'high';
  metadata?: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * 批量上传文件接口
 */
export interface BatchUploadFile {
  id: string;
  name: string;
  size: number;
  type: string;
  path?: string;
}

/**
 * 批量上传选项接口
 */
export interface BatchUploadOptions {
  skipDuplicates?: boolean;
  generateThumbnails?: boolean;
  chunkSize?: number;
}

/**
 * 批量上传批次接口
 */
export interface BatchUploadBatch {
  batchId: string;
  files: BatchUploadFile[];
  collectionId: string;
  options?: BatchUploadOptions;
}

/**
 * 状态机服务接口
 * @description 应用层应该依赖此接口而不是具体实现
 */
export interface IStateMachineService {
  /**
   * 获取状态机引擎实例
   * @returns 状态机引擎
   */
  getEngine(): IStateMachineEngine;

  /**
   * 创建批量上传任务
   * @param batchId 批次ID
   * @param files 文件列表
   * @param collectionId 集合ID
   * @param options 上传选项
   * @returns 创建的任务
   */
  createBatchUploadTask(
    batchId: string,
    files: BatchUploadFile[],
    collectionId: string,
    options?: BatchUploadOptions,
  ): Promise<StateMachineTask>;

  /**
   * 执行批量上传任务
   * @param batchId 批次ID
   */
  executeBatchUploadTask(batchId: string): Promise<void>;

  /**
   * 获取任务状态
   * @param taskId 任务ID
   * @returns 任务信息
   */
  getTaskStatus(taskId: string): Promise<StateMachineTask | null>;

  /**
   * 获取指定状态的任务列表
   * @param status 状态过滤器
   * @returns 任务列表
   */
  getTasksByStatus(status: string): Promise<StateMachineTask[]>;

  /**
   * 获取批量上传任务列表
   * @returns 批量上传任务列表
   */
  getBatchUploadTasks(): Promise<StateMachineTask[]>;

  /**
   * 取消任务
   * @param taskId 任务ID
   * @returns 是否成功取消
   */
  cancelTask(taskId: string): Promise<boolean>;

  /**
   * 重试任务
   * @param taskId 任务ID
   * @returns 是否成功重试
   */
  retryTask(taskId: string): Promise<boolean>;

  /**
   * 清理过期任务
   * @param olderThan 清理早于指定时间的任务（小时）
   * @returns 清理的任务数量
   */
  cleanupExpiredTasks(olderThan?: number): Promise<number>;

  /**
   * 获取任务统计信息
   * @returns 按类型和状态分组的统计信息
   */
  getTaskStats(): Promise<Record<string, Record<string, number>>>;

  /**
   * 批量创建任务
   * @param batches 批次列表
   * @returns 创建的任务列表
   */
  createBatchUploadTasks(
    batches: BatchUploadBatch[],
  ): Promise<StateMachineTask[]>;

  /**
   * 批量执行任务
   * @param batchIds 批次ID列表
   * @param concurrency 并发数
   */
  executeBatchUploadTasks(
    batchIds: string[],
    concurrency?: number,
  ): Promise<void>;
}
