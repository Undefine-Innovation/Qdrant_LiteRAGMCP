import { Logger } from '@logging/logger.js';
import {
  IStateMachineService,
  TaskExecutionOptions,
  BatchUploadFile,
  BatchUploadOptions,
  BatchUploadBatch,
} from '@domain/repositories/IStateMachineService.js';
import { BaseStateMachineEngine } from '@domain/state-machine/BaseStateMachineEngine.js';
import { BatchUploadStrategy } from '@domain/state-machine/BatchUploadStrategy.js';
import { InMemoryStatePersistence } from '@infrastructure/state-machine/StatePersistence.js';
import {
  IStateMachineEngine,
  StateMachineTask,
  StateMachineContext,
} from '@domain/state-machine/types.js';
import { BatchUploadContext } from '@domain/state-machine/BatchUploadStrategy.js';
import { DataSource } from 'typeorm';

/**
 * 状态机服务实现
 * 提供状态机的统一管理和使用接口
 * @description 实现IStateMachineService接口以遵循DIP
 */
export class StateMachineService implements IStateMachineService {
  private engine: IStateMachineEngine;

  /**
   * 构造函数
   * @param logger 日志记录器
   * @param dataSource TypeORM数据源实例，可选
   */
  constructor(private readonly logger: Logger) {
    // 目前仅使用内存持久化实现
    const persistence = new InMemoryStatePersistence(logger);

    this.engine = new BaseStateMachineEngine(logger, persistence);

    this.initializeStrategies();
  }

  /**
   * 初始化持久化层
   * @param persistence 状态持久化实例
   * @returns {Promise<void>} 返回初始化结果
   */
  // 持久化表初始化逻辑已移除，当前仅支持内存状态机

  /**
   * 初始化状态机策略
   * @returns {void} 返回初始化结果
   */
  private initializeStrategies(): void {
    // 注册批量上传策略
    const batchUploadStrategy = new BatchUploadStrategy(
      // 使用类型断言访问私有属性
      (this.engine as any).persistence, // eslint-disable-line @typescript-eslint/no-explicit-any -- 访问引擎私有属性
      this.logger,
    );
    this.engine.registerStrategy(batchUploadStrategy);

    this.logger.info('状态机策略初始化完成');
  }

  /**
   * 创建批量上传任务
   * @param batchId 批次ID
   * @param files 文件列表
   * @param collectionId 集合ID
   * @param options 批量上传选项
   * @returns {Promise<StateMachineTask>} 返回创建的状态机任务
   */
  async createBatchUploadTask(
    batchId: string,
    files: BatchUploadFile[],
    collectionId: string,
    options?: BatchUploadOptions,
  ): Promise<StateMachineTask> {
    const context: BatchUploadContext = {
      taskId: batchId,
      taskType: 'batch_upload',
      batchId,
      files,
      collectionId,
      options,
    };

    return await this.engine.createTask('batch_upload', batchId, context);
  }

  /**
   * 执行批量上传任务
   * @param batchId 批次ID
   * @returns {Promise<void>} 返回执行结果
   */
  async executeBatchUploadTask(batchId: string): Promise<void> {
    await this.engine.executeTask(batchId);
  }

  /**
   * 获取任务状态
   * @param taskId 任务ID
   * @returns {Promise<StateMachineTask | null>} 返回任务状态
   */
  async getTaskStatus(taskId: string): Promise<StateMachineTask | null> {
    return await this.engine.getTask(taskId);
  }

  /**
   * 获取指定状态的任务列表
   * @param status 任务状态
   * @returns {Promise<StateMachineTask[]>} 返回任务列表
   */
  async getTasksByStatus(status: string): Promise<StateMachineTask[]> {
    return await this.engine.getTasksByStatus(status);
  }

  /**
   * 获取批量上传任务列表
   * @returns {Promise<StateMachineTask[]>} 返回批量上传任务列表
   */
  async getBatchUploadTasks(): Promise<StateMachineTask[]> {
    return await this.engine.getTasksByType('batch_upload');
  }

  /**
   * 取消任务
   * @param taskId 任务ID
   * @returns {Promise<boolean>} 返回取消结果
   */
  async cancelTask(taskId: string): Promise<boolean> {
    return await this.engine.transitionState(taskId, 'cancel');
  }

  /**
   * 重试任务
   * @param taskId 任务ID
   * @returns {Promise<boolean>} 返回重试结果
   */
  async retryTask(taskId: string): Promise<boolean> {
    return await this.engine.transitionState(taskId, 'retry');
  }

  /**
   * 清理过期任务
   * @param olderThan 过期时间阈值（可选）
   * @returns {Promise<number>} 返回清理的任务数量
   */
  async cleanupExpiredTasks(olderThan?: number): Promise<number> {
    return await this.engine.cleanupExpiredTasks(olderThan);
  }

  /**
   * 获取任务统计信息
   * @returns {Promise<Record<string, Record<string, number>>>} 返回任务统计信息
   */
  async getTaskStats(): Promise<Record<string, Record<string, number>>> {
    const tasks = await this.engine.getTasksByType('batch_upload');

    const stats: Record<string, Record<string, number>> = {
      batch_upload: {},
    };

    // 按状态分组统计
    tasks.forEach((task) => {
      const status = task.status;
      if (!stats['batch_upload'][status]) {
        stats['batch_upload'][status] = 0;
      }
      stats['batch_upload'][status]++;
    });

    return stats;
  }

  /**
   * 批量创建任务
   * @param batches 批次列表
   * @returns {Promise<StateMachineTask[]>} 返回创建的任务列表
   */
  async createBatchUploadTasks(
    batches: BatchUploadBatch[],
  ): Promise<StateMachineTask[]> {
    const taskIds = batches.map((batch) => batch.batchId);
    const tasks: StateMachineTask[] = [];

    for (const batch of batches) {
      const task = await this.createBatchUploadTask(
        batch.batchId,
        batch.files,
        batch.collectionId,
        batch.options,
      );
      tasks.push(task);
    }

    return tasks;
  }

  /**
   * 批量执行任务
   * @param batchIds 批次ID列表
   * @param concurrency 并发数量
   * @returns {Promise<void>} 返回执行结果
   */
  async executeBatchUploadTasks(
    batchIds: string[],
    concurrency: number = 3,
  ): Promise<void> {
    // 由于 IStateMachineEngine 没有 executeTasks 方法，我们逐一执行任务
    for (const batchId of batchIds) {
      try {
        await this.engine.executeTask(batchId);
      } catch (error) {
        this.logger.error(`执行批量上传任务失败: ${batchId}, 错误: ${error}`);
        // 继续执行其他任务，不中断
      }
    }
  }

  /**
   * 获取状态机引擎实例
   * 用于高级操作和扩展
   * @returns {IStateMachineEngine} 返回状态机引擎实例
   */
  getEngine(): IStateMachineEngine {
    return this.engine;
  }
}
