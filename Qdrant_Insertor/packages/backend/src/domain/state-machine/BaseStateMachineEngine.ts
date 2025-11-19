// src/domain/state-machine/BaseStateMachineEngine.ts

import { Logger } from '@logging/logger.js';
import {
  IStateMachineEngine,
  StateMachineStrategy,
  StateMachineTask,
  StateMachineContext,
  StatePersistence,
} from '@domain/state-machine/types.js';
import { InMemoryStatePersistence } from '@infrastructure/state-machine/StatePersistence.js';

/**
 * 基础状态机引擎实现
 * 提供状态机的核心功能和策略管理
 */
export class BaseStateMachineEngine implements IStateMachineEngine {
  private strategies: Map<string, StateMachineStrategy> = new Map();
  private persistence: StatePersistence;

  /**
   * 构造函数
   * @param logger 日志记录器
   * @param persistence 状态持久化实现，可选
   */
  constructor(
    private readonly logger: Logger,
    persistence?: StatePersistence,
  ) {
    // 如果没有提供持久化实现，使用内存实现
    this.persistence = persistence || new InMemoryStatePersistence(logger);
  }

  /**
   * 注册状态机策略
   * @param strategy - 状态机策略
   * @returns 无返回值
   */
  registerStrategy(strategy: StateMachineStrategy): void {
    if (this.strategies.has(strategy.strategyId)) {
      throw new Error(`策略 ${strategy.strategyId} 已经注册`);
    }

    this.strategies.set(strategy.strategyId, strategy);
    this.logger.info(`注册状态机策略: ${strategy.strategyId}`);
  }

  /**
   * 获取已注册的策略
   * @param taskType - 任务类型
   * @returns 状态机策略
   */
  getStrategy(taskType: string): StateMachineStrategy | null {
    return this.strategies.get(taskType) || null;
  }

  /**
   * 创建新任务
   * @param taskType - 任务类型
   * @param taskId - 任务ID
   * @param initialContext - 初始上下文
   * @returns 状态机任务
   */
  async createTask(
    taskType: string,
    taskId: string,
    initialContext?: StateMachineContext,
  ): Promise<StateMachineTask> {
    const strategy = this.getStrategy(taskType);
    if (!strategy) {
      throw new Error(`未找到任务类型 ${taskType} 的策略`);
    }

    // 检查任务是否已存在
    const existingTask = await this.persistence.getTask(taskId);
    if (existingTask) {
      throw new Error(`任务 ${taskId} 已存在`);
    }

    return await strategy.createTask(taskId, initialContext);
  }

  /**
   * 触发状态转换
   * @param taskId - 任务ID
   * @param event - 事件
   * @param context - 上下文
   * @returns 是否成功转换状态
   */
  async transitionState(
    taskId: string,
    event: string,
    context?: StateMachineContext,
  ): Promise<boolean> {
    const task = await this.persistence.getTask(taskId);
    if (!task) {
      this.logger.error(`任务 ${taskId} 不存在，无法进行状态转换`);
      return false;
    }

    const strategy = this.getStrategy(task.taskType);
    if (!strategy) {
      this.logger.error(`未找到任务类型 ${task.taskType} 的策略`);
      return false;
    }

    try {
      return await strategy.handleTransition(taskId, event, context);
    } catch (error) {
      this.logger.error(`状态转换失败: ${error}`);
      return false;
    }
  }

  /**
   * 获取任务状态
   * @param taskId - 任务ID
   * @returns 状态机任务
   */
  async getTask(taskId: string): Promise<StateMachineTask | null> {
    return await this.persistence.getTask(taskId);
  }

  /**
   * 获取指定状态的任务列表
   * @param status - 状态
   * @returns 状态机任务列表
   */
  async getTasksByStatus(status: string): Promise<StateMachineTask[]> {
    return await this.persistence.getTasksByStatus(status);
  }

  /**
   * 获取指定类型的任务列表
   * @param taskType - 任务类型
   * @returns 状态机任务列表
   */
  async getTasksByType(taskType: string): Promise<StateMachineTask[]> {
    return await this.persistence.getTasksByType(taskType);
  }

  /**
   * 执行任务
   * @param taskId - 任务ID
   * @returns 无返回值
   */
  async executeTask(taskId: string): Promise<void> {
    const task = await this.persistence.getTask(taskId);
    if (!task) {
      throw new Error(`任务 ${taskId} 不存在`);
    }

    const strategy = this.getStrategy(task.taskType);
    if (!strategy) {
      throw new Error(`未找到任务类型 ${task.taskType} 的策略`);
    }

    try {
      this.logger.info(`开始执行任务: ${taskId} (类型: ${task.taskType})`);
      await strategy.executeTask(taskId);
      this.logger.info(`任务执行完成: ${taskId}`);
    } catch (error) {
      this.logger.error(`任务执行失败: ${taskId}, 错误: ${error}`);
      await strategy.handleError(taskId, error as Error);
      throw error;
    }
  }

  /**
   * 处理任务错误
   * @param taskId - 任务ID
   * @param error - 错误对象
   * @returns 无返回值
   */
  async handleTaskError(taskId: string, error: Error): Promise<void> {
    const task = await this.persistence.getTask(taskId);
    if (!task) {
      this.logger.error(`任务 ${taskId} 不存在，无法处理错误`);
      return;
    }

    const strategy = this.getStrategy(task.taskType);
    if (!strategy) {
      this.logger.error(`未找到任务类型 ${task.taskType} 的策略`);
      return;
    }

    await strategy.handleError(taskId, error);
  }

  /**
   * 清理过期任务
   * @param olderThan - 过期时间阈值（毫秒）
   * @returns 清理的任务数量
   */
  async cleanupExpiredTasks(
    olderThan: number = 24 * 60 * 60 * 1000,
  ): Promise<number> {
    this.logger.info(`开始清理过期任务 (超过 ${olderThan}ms)`);
    const deletedCount = await this.persistence.cleanupExpiredTasks(olderThan);
    this.logger.info(`清理完成，共删除 ${deletedCount} 个过期任务`);
    return deletedCount;
  }

  /**
   * 获取所有已注册的策略
   * @returns 策略ID列表
   */
  getRegisteredStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * 获取任务统计信息
   * @returns 任务统计信息
   */
  async getTaskStats(): Promise<Record<string, Record<string, number>>> {
    const stats: Record<string, Record<string, number>> = {};

    // 获取所有策略的任务统计
    for (const strategyId of this.strategies.keys()) {
      const tasks = await this.persistence.getTasksByType(strategyId);
      stats[strategyId] = {};

      for (const task of tasks) {
        const status = task.status;
        if (!stats[strategyId][status]) {
          stats[strategyId][status] = 0;
        }
        stats[strategyId][status]++;
      }
    }

    return stats;
  }

  /**
   * 批量创建任务
   * @param taskType - 任务类型
   * @param taskIds - 任务ID列表
   * @param initialContext - 初始上下文
   * @returns 状态机任务列表
   */
  async createTasks(
    taskType: string,
    taskIds: string[],
    initialContext?: StateMachineContext,
  ): Promise<StateMachineTask[]> {
    const strategy = this.getStrategy(taskType);
    if (!strategy) {
      throw new Error(`未找到任务类型 ${taskType} 的策略`);
    }

    const tasks: StateMachineTask[] = [];
    const errors: string[] = [];

    for (const taskId of taskIds) {
      try {
        const task = await this.createTask(taskType, taskId, initialContext);
        tasks.push(task);
      } catch (error) {
        errors.push(`创建任务 ${taskId} 失败: ${error}`);
      }
    }

    if (errors.length > 0) {
      this.logger.warn(`批量创建任务时发生错误: ${errors.join('; ')}`);
    }

    this.logger.info(
      `批量创建任务完成: 成功 ${tasks.length} 个，失败 ${errors.length} 个`,
    );
    return tasks;
  }

  /**
   * 批量执行任务
   * @param taskIds - 任务ID列表
   * @param concurrency - 并发数
   * @returns 无返回值
   */
  async executeTasks(
    taskIds: string[],
    concurrency: number = 5,
  ): Promise<void> {
    this.logger.info(
      `开始批量执行任务: ${taskIds.length} 个任务，并发数: ${concurrency}`,
    );

    // 分批执行任务
    for (let i = 0; i < taskIds.length; i += concurrency) {
      const batch = taskIds.slice(i, i + concurrency);
      const promises = batch.map((taskId) =>
        this.executeTask(taskId).catch((error) => {
          this.logger.error(`批量执行任务失败: ${taskId}, 错误: ${error}`);
        }),
      );

      await Promise.all(promises);
    }

    this.logger.info(`批量执行任务完成`);
  }

  /**
   * 取消任务
   * @param taskId - 任务ID
   * @returns 是否成功取消
   */
  async cancelTask(taskId: string): Promise<boolean> {
    const task = await this.persistence.getTask(taskId);
    if (!task) {
      this.logger.error(`任务 ${taskId} 不存在，无法取消`);
      return false;
    }

    const strategy = this.getStrategy(task.taskType);
    if (!strategy) {
      this.logger.error(`未找到任务类型 ${task.taskType} 的策略`);
      return false;
    }

    try {
      const success = await strategy.handleTransition(taskId, 'cancel');
      if (success) {
        this.logger.info(`任务已取消: ${taskId}`);
      }
      return success;
    } catch (error) {
      this.logger.error(`取消任务失败: ${taskId}, 错误: ${error}`);
      return false;
    }
  }

  /**
   * 重试任务
   * @param taskId - 任务ID
   * @returns 是否成功重试
   */
  async retryTask(taskId: string): Promise<boolean> {
    const task = await this.persistence.getTask(taskId);
    if (!task) {
      this.logger.error(`任务 ${taskId} 不存在，无法重试`);
      return false;
    }

    const strategy = this.getStrategy(task.taskType);
    if (!strategy) {
      this.logger.error(`未找到任务类型 ${task.taskType} 的策略`);
      return false;
    }

    try {
      const success = await strategy.handleTransition(taskId, 'retry');
      if (success) {
        // 重试成功后，重新执行任务
        await this.executeTask(taskId);
      }
      return success;
    } catch (error) {
      this.logger.error(`重试任务失败: ${taskId}, 错误: ${error}`);
      return false;
    }
  }

  /**
   * 获取状态持久化实例
   * @returns 状态持久化实例
   */
  getPersistence(): StatePersistence {
    return this.persistence;
  }
}
