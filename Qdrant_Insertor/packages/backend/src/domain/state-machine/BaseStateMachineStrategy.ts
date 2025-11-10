// src/domain/state-machine/BaseStateMachineStrategy.ts

import { Logger } from '@logging/logger.js';
import {
  StateMachineStrategy as IStateMachineStrategy,
  StateMachineConfig,
  StateMachineTask,
  StateMachineContext,
  StateTransition,
  StatePersistence,
  BaseState,
  BaseEvent,
} from '@domain/state-machine/types.js';

/**
 * 基础状态机策略实现
 * 提供状态机的通用功能和状态转换逻辑
 */
/**
 * 基础状态机策略实现
 * 提供状态机的通用功能和状态转换逻辑
 */
export abstract class BaseStateMachineStrategy
  implements IStateMachineStrategy
{
  protected transitions: Map<string, Map<string, StateTransition>> = new Map();

  /**
   * 构造函数
   * @param strategyId - 策略标识符
   * @param config - 状态机配置
   * @param persistence - 状态持久化实现
   * @param logger - 日志记录器
   */
  constructor(
    public readonly strategyId: string,
    public readonly config: StateMachineConfig,
    protected readonly persistence: StatePersistence,
    protected readonly logger: Logger,
  ) {
    this.initializeTransitions();
  }

  /**
   * 初始化状态转换规则
   * @returns 无返回值
   */
  protected initializeTransitions(): void {
    // 清空现有转换规则
    this.transitions.clear();

    // 构建转换规则映射表
    for (const transition of this.config.transitions) {
      if (!this.transitions.has(transition.from)) {
        this.transitions.set(transition.from, new Map());
      }

      const fromTransitions = this.transitions.get(transition.from)!;
      fromTransitions.set(transition.event, transition);
    }

    this.logger.info(
      `状态机策略 ${this.strategyId} 初始化完成，共 ${this.config.transitions.length} 个转换规则`,
    );
  }

  /**
   * 处理状态转换
   * @param taskId - 任务ID
   * @param event - 事件
   * @param context - 上下文
   * @returns 是否成功转换状态
   */
  async handleTransition(
    taskId: string,
    event: string,
    context?: StateMachineContext,
  ): Promise<boolean> {
    const task = await this.persistence.getTask(taskId);
    if (!task) {
      this.logger.error(`任务 ${taskId} 不存在`);
      return false;
    }

    const currentState = task.status;
    const transitions = this.transitions.get(currentState);

    if (!transitions) {
      this.logger.error(`状态 ${currentState} 没有定义转换规则`);
      return false;
    }

    const transition = transitions.get(event);
    if (!transition) {
      this.logger.error(`状态 ${currentState} 不允许事件 ${event}`);
      return false;
    }

    // 检查转换条件
    if (transition.condition && context) {
      try {
        const conditionResult = await transition.condition(context);
        if (!conditionResult) {
          this.logger.warn(
            `状态转换条件不满足: ${currentState} -> ${transition.to} (事件: ${event})`,
          );
          return false;
        }
      } catch (error) {
        this.logger.error(`状态转换条件检查失败: ${error}`);
        return false;
      }
    }

    // 执行转换动作
    if (transition.action && context) {
      try {
        await transition.action(context);
      } catch (error) {
        this.logger.error(`状态转换动作执行失败: ${error}`);
        return false;
      }
    }

    // 更新任务状态
    await this.persistence.updateTask(taskId, {
      status: transition.to,
      updatedAt: Date.now(),
      context: context ? { ...task.context, ...context } : task.context,
    });

    this.logger.info(
      `任务 ${taskId} 状态转换: ${currentState} -> ${transition.to} (事件: ${event})`,
    );
    return true;
  }

  /**
   * 获取当前状态
   * @param taskId - 任务ID
   * @returns 当前状态
   */
  async getCurrentState(taskId: string): Promise<string | null> {
    const task = await this.persistence.getTask(taskId);
    return task ? task.status : null;
  }

  /**
   * 创建新任务
   * @param taskId - 任务ID
   * @param initialContext - 初始上下文
   * @returns 状态机任务
   */
  async createTask(
    taskId: string,
    initialContext?: StateMachineContext,
  ): Promise<StateMachineTask> {
    const now = Date.now();
    const task: StateMachineTask = {
      id: taskId,
      taskType: this.config.taskType,
      status: this.config.initialState,
      retries: 0,
      createdAt: now,
      updatedAt: now,
      progress: 0,
      context: initialContext || {},
    };

    await this.persistence.saveTask(task);
    this.logger.info(
      `创建新任务: ${taskId}, 类型: ${this.config.taskType}, 初始状态: ${this.config.initialState}`,
    );
    return task;
  }

  /**
   * 执行任务逻辑
   * 子类需要实现具体的执行逻辑
   * @param taskId - 任务ID
   * @returns 无返回值
   */
  abstract executeTask(taskId: string): Promise<void>;

  /**
   * 处理错误
   * @param taskId - 任务ID
   * @param error - 错误对象
   * @returns 无返回值
   */
  async handleError(taskId: string, error: Error): Promise<void> {
    const task = await this.persistence.getTask(taskId);
    if (!task) {
      this.logger.error(`任务 ${taskId} 不存在，无法处理错误`);
      return;
    }

    // 检查是否达到最大重试次数
    const maxRetries = this.config.maxRetries || 3;
    if (task.retries >= maxRetries) {
      // 超过最大重试次数，标记为失败
      await this.persistence.updateTask(taskId, {
        status: BaseState.FAILED,
        error: error.message,
        completedAt: Date.now(),
      });
      this.logger.error(
        `任务 ${taskId} 超过最大重试次数，标记为失败: ${error.message}`,
      );
      return;
    }

    // 增加重试次数并更新错误信息
    await this.persistence.updateTask(taskId, {
      retries: task.retries + 1,
      lastAttemptAt: Date.now(),
      error: error.message,
    });

    // 尝试重试
    await this.handleTransition(taskId, BaseEvent.RETRY, {
      taskId,
      taskType: this.config.taskType,
      error: error.message,
      retryCount: task.retries + 1,
    });

    this.logger.info(
      `任务 ${taskId} 将进行第 ${task.retries + 1} 次重试: ${error.message}`,
    );
  }

  /**
   * 检查是否为终态
   * @param status - 状态
   * @returns 是否为终态
   */
  protected isFinalState(status: string): boolean {
    return this.config.finalStates.includes(status);
  }

  /**
   * 获取状态的所有可能转换
   * @param status - 状态
   * @returns 状态转换列表
   */
  protected getAvailableTransitions(status: string): StateTransition[] {
    const transitions = this.transitions.get(status);
    return transitions ? Array.from(transitions.values()) : [];
  }

  /**
   * 更新任务进度
   * @param taskId - 任务ID
   * @param progress - 进度值
   * @returns 无返回值
   */
  protected async updateProgress(
    taskId: string,
    progress: number,
  ): Promise<void> {
    await this.persistence.updateTask(taskId, {
      progress: Math.max(0, Math.min(100, progress)),
    });
  }

  /**
   * 标记任务开始
   * @param taskId - 任务ID
   * @returns 无返回值
   */
  protected async markTaskStarted(taskId: string): Promise<void> {
    await this.persistence.updateTask(taskId, {
      startedAt: Date.now(),
      status: BaseState.PROCESSING,
    });
  }

  /**
   * 标记任务完成
   * @param taskId - 任务ID
   * @returns 无返回值
   */
  protected async markTaskCompleted(taskId: string): Promise<void> {
    await this.persistence.updateTask(taskId, {
      status: BaseState.COMPLETED,
      completedAt: Date.now(),
      progress: 100,
    });
  }

  /**
   * 标记任务失败
   * @param taskId - 任务ID
   * @param error - 错误信息
   * @returns 无返回值
   */
  protected async markTaskFailed(taskId: string, error: string): Promise<void> {
    await this.persistence.updateTask(taskId, {
      status: BaseState.FAILED,
      error,
      completedAt: Date.now(),
    });
  }

  /**
   * 标记任务取消
   * @param taskId - 任务ID
   * @returns 无返回值
   */
  protected async markTaskCancelled(taskId: string): Promise<void> {
    await this.persistence.updateTask(taskId, {
      status: BaseState.CANCELLED,
      completedAt: Date.now(),
    });
  }
}
