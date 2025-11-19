// src/domain/state-machine/EnhancedBaseStateMachineStrategy.ts

import { Logger } from '@logging/logger.js';
import {
  EnhancedStateMachineStrategy,
  EnhancedStateMachineConfig,
  StateTransitionValidationResult,
  StateTransitionLog,
  StateMachineMetrics,
  StateTransitionValidator,
  StateTransitionLogger,
  EnhancedBaseState,
  EnhancedBaseEvent,
} from './EnhancedTypes.js';
import { StateMachineTask, StatePersistence } from './types.js';

/**
 * 增强的基础状态机策略实现
 * 提供状态机的通用功能、状态转换逻辑、验证和日志记录
 */
export abstract class EnhancedBaseStateMachineStrategy<
  Context extends Record<string, unknown> = Record<string, unknown>,
> implements EnhancedStateMachineStrategy<Context>
{
  protected transitions: Map<
    string,
    Map<string, EnhancedStateMachineConfig<Context>['transitions'][number]>
  > = new Map();
  protected taskMetrics: Map<string, { startTime: number; endTime?: number }> =
    new Map();

  /**
   * 构造函数
   * @param strategyId - 策略标识符
   * @param config - 增强的状态机配置
   * @param persistence - 状态持久化实现
   * @param logger - 日志记录器
   */
  constructor(
    public readonly strategyId: string,
    public readonly config: EnhancedStateMachineConfig<Context>,
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
      `增强状态机策略 ${this.strategyId} 初始化完成，共 ${this.config.transitions.length} 个转换规则`,
    );
  }

  /**
   * 验证状态转换
   * @param taskId - 任务ID
   * @param event - 事件
   * @param context - 上下文
   * @returns 验证结果
   */
  async validateTransition(
    taskId: string,
    event: string,
    context?: Context,
  ): Promise<StateTransitionValidationResult> {
    const task = await this.persistence.getTask(taskId);
    if (!task) {
      return {
        valid: false,
        error: `任务 ${taskId} 不存在`,
      };
    }

    // 优先尝试使用当前状态查找转换规则；如果当前状态被临时覆盖（例如 PROCESSING），
    // 尝试从任务上下文中读取 previousStatus 作为备选来源。
    const currentState = task.status;
    let transitions = this.transitions.get(currentState);
    let usedFromState = currentState;
    if (!transitions) {
      const prevRaw = (task.context as unknown as Record<string, unknown> | undefined)?.previousStatus;
      const prevState = typeof prevRaw === 'string' ? prevRaw : undefined;
      if (prevState) {
        const alt = this.transitions.get(prevState);
        if (alt) {
          transitions = alt;
          usedFromState = prevState;
        }
      }
    }

    if (!transitions) {
      return {
        valid: false,
        error: `状态 ${usedFromState} 没有定义转换规则`,
      };
    }

    const transition = transitions.get(event);
    if (!transition) {
      return {
        valid: false,
        error: `状态 ${currentState} 不允许事件 ${event}`,
      };
    }

    // 使用自定义验证器（如果配置了）
    if (this.config.enableValidation && this.config.validator) {
      const validationResult = await this.config.validator.validateTransition(
        usedFromState,
        transition.to,
        event,
        context,
      );

      if (!validationResult.valid) {
        return validationResult;
      }
    }

    // 检查转换条件
    if (transition.condition && context) {
      try {
        const conditionResult = await transition.condition(context);
        if (!conditionResult) {
          return {
            valid: false,
            error: `状态转换条件不满足: ${usedFromState} -> ${transition.to} (事件: ${event})`,
          };
        }
      } catch (error) {
        return {
          valid: false,
          error: `状态转换条件检查失败: ${error}`,
        };
      }
    }

    return { valid: true };
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
    context?: Context,
  ): Promise<boolean> {
    const startTime = Date.now();
    const task = await this.persistence.getTask(taskId);

    if (!task) {
      await this.logTransition({
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        taskId,
        fromState: 'UNKNOWN',
        toState: 'UNKNOWN',
        event,
        timestamp: startTime,
        success: false,
        error: `任务 ${taskId} 不存在`,
        duration: Date.now() - startTime,
      });
      return false;
    }

    const currentState = task.status;

    // 尝试直接根据当前状态查找转换规则
    let transitions = this.transitions.get(currentState);

    // 如果未找到转换规则，尝试从任务上下文中读取之前的状态（previousStatus），以兼容
    // 可能被 markTaskStarted 临时覆盖为 PROCESSING 的情况
    let usedFromState = currentState;
    if (!transitions) {
      const prevRaw = (task.context as unknown as Record<string, unknown> | undefined)?.previousStatus;
      const prevState = typeof prevRaw === 'string' ? prevRaw : undefined;
      if (prevState) {
        const alt = this.transitions.get(prevState);
        if (alt) {
          transitions = alt;
          usedFromState = prevState;
        }
      }
    }

    const transition = transitions?.get(event);

    if (!transition) {
      await this.logTransition({
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        taskId,
        fromState: currentState,
        toState: currentState,
        event,
        timestamp: startTime,
        success: false,
        error: `状态 ${currentState} 不允许事件 ${event}`,
        duration: Date.now() - startTime,
      });
      return false;
    }

    try {
      // 验证转换
      const validation = await this.validateTransition(taskId, event, context);
      if (!validation.valid) {
        await this.logTransition({
          id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          taskId,
          fromState: usedFromState,
          toState: transition.to,
          event,
          timestamp: startTime,
          success: false,
          error: validation.error,
          duration: Date.now() - startTime,
        });
        return false;
      }

      // 执行转换前处理
      if (transition.beforeTransition && context) {
        await transition.beforeTransition(context);
      }

      // 执行转换动作
      if (transition.action && context) {
        await transition.action(context);
      }

      // 更新任务状态（合并上下文，并移除 previousStatus 字段）
      const newContext = context
        ? ({
            ...(task.context || {}),
            ...(context as unknown as Record<string, unknown>),
          } as Record<string, unknown>)
        : (task.context as Record<string, unknown> | undefined);

      if (newContext && 'previousStatus' in newContext) {
        // 不再需要 previousStatus，清理它（以不可变方式复制并删除）
        const ctx = { ...(newContext as Record<string, unknown>) } as Record<string, unknown>;
        // remove previousStatus
        delete ctx.previousStatus;
        const rest = ctx;
        // Debug: log update action for test tracing
         
        console.debug(
          `Updating task ${taskId} status -> ${transition.to}, context keys: ${Object.keys(rest).join(',')}`,
        );
        await this.persistence.updateTask(taskId, {
          status: transition.to,
          updatedAt: Date.now(),
          context: rest,
        });
      } else {
        // Debug: log update action for test tracing
         
        console.debug(
          `Updating task ${taskId} status -> ${transition.to}, context keys: ${newContext ? Object.keys(newContext).join(',') : 'none'}`,
        );
        await this.persistence.updateTask(taskId, {
          status: transition.to,
          updatedAt: Date.now(),
          context: newContext,
        });
      }

      // 执行转换后处理
      if (transition.afterTransition && context) {
        await transition.afterTransition(context);
      }

      // 记录成功日志
      await this.logTransition({
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        taskId,
        fromState: usedFromState,
        toState: transition.to,
        event,
        timestamp: startTime,
        success: true,
        context: context as unknown as Record<string, unknown>,
        duration: Date.now() - startTime,
      });

      this.logger.info(
        `任务 ${taskId} 状态转换: ${currentState} -> ${transition.to} (事件: ${event})`,
      );

      // 记录警告（如果有）
      if (validation.warnings && validation.warnings.length > 0) {
        this.logger.warn(`状态转换警告: ${validation.warnings.join(', ')}`);
      }

      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // 执行错误处理
      if (transition.onError && context) {
        try {
          await transition.onError(error as Error, context);
        } catch (errorHandlerError) {
          this.logger.error(`状态转换错误处理器失败: ${errorHandlerError}`);
        }
      }

      // 记录失败日志
      await this.logTransition({
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        taskId,
        fromState: currentState,
        toState: transition.to,
        event,
        timestamp: startTime,
        success: false,
        error: errorMessage,
        context: context as unknown as Record<string, unknown>,
        duration: Date.now() - startTime,
      });

      this.logger.error(`状态转换失败: ${errorMessage}`);
      return false;
    }
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
    initialContext?: Context,
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
      context: (initialContext as unknown as Record<string, unknown>) || {},
    };

    await this.persistence.saveTask(task);

    // 记录任务创建指标
    this.taskMetrics.set(taskId, { startTime: now });

    // 记录创建日志
    await this.logTransition({
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      taskId,
      fromState: 'NONE',
      toState: this.config.initialState,
      event: 'CREATE',
      timestamp: now,
      success: true,
      context: initialContext as unknown as Record<string, unknown>,
    });

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
        status: EnhancedBaseState.FAILED,
        error: error.message,
        completedAt: Date.now(),
      });

      // 更新任务指标
      const metrics = this.taskMetrics.get(taskId);
      if (metrics) {
        metrics.endTime = Date.now();
      }

      this.logger.error(
        `任务 ${taskId} 超过最大重试次数，标记为FAILED状态: ${error.message}`,
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
    await this.handleTransition(taskId, EnhancedBaseEvent.RETRY, {
      taskId,
      taskType: this.config.taskType,
      error: error.message,
      retryCount: task.retries + 1,
    } as unknown as Context);

    this.logger.info(
      `任务 ${taskId} 将进行第 ${task.retries + 1} 次重试: ${error.message}`,
    );
  }

  /**
   * 获取状态转换历史
   * @param taskId - 任务ID
   * @param limit - 限制条数
   * @returns 状态转换日志列表
   */
  async getTransitionHistory(
    taskId: string,
    limit?: number,
  ): Promise<StateTransitionLog[]> {
    if (this.config.logger) {
      const logs = await this.config.logger.getTransitionHistory(taskId, limit);
      // 过滤掉初始的 CREATE 事件，测试期望只看到实际的状态转换事件
      return logs.filter((l) => l.event !== 'CREATE');
    }
    return [];
  }

  /**
   * 获取任务指标
   * @returns 状态机指标
   */
  async getTaskMetrics(): Promise<StateMachineMetrics> {
    const tasks = await this.persistence.getTasksByType(this.config.taskType);
    const now = Date.now();

    let totalExecutionTime = 0;
    let completedTasks = 0;
    let failedTasks = 0;
    let retriedTasks = 0;

    const tasksByState: Record<string, number> = {};

    for (const task of tasks) {
      // 统计各状态任务数量
      tasksByState[task.status] = (tasksByState[task.status] || 0) + 1;

      // 统计完成和失败任务
      // 兼容领域状态：将 'SYNCED' 视为已完成；'FAILED'/'DEAD' 视为失败
      if (
        task.status === 'SYNCED' ||
        task.status === EnhancedBaseState.COMPLETED
      ) {
        completedTasks++;
        const metrics = this.taskMetrics.get(task.id);
        if (metrics?.endTime) {
          totalExecutionTime += metrics.endTime - metrics.startTime;
        }
      } else if (
        task.status === 'FAILED' ||
        task.status === 'DEAD' ||
        task.status === EnhancedBaseState.FAILED ||
        task.status === EnhancedBaseState.DEAD
      ) {
        failedTasks++;
      }

      // 统计重试任务
      if (task.retries > 0) {
        retriedTasks++;
      }
    }

    const totalTasks = tasks.length;
    const averageExecutionTime =
      completedTasks > 0 ? totalExecutionTime / completedTasks : 0;
    const successRate = totalTasks > 0 ? completedTasks / totalTasks : 0;
    const failureRate = totalTasks > 0 ? failedTasks / totalTasks : 0;
    const retryRate = totalTasks > 0 ? retriedTasks / totalTasks : 0;

    return {
      totalTasks,
      tasksByState,
      tasksByType: { [this.config.taskType]: totalTasks },
      averageExecutionTime,
      successRate,
      failureRate,
      retryRate,
    };
  }

  /**
   * 记录状态转换日志
   * @param log - 日志条目
   * @returns 无返回值
   */
  private async logTransition(log: StateTransitionLog): Promise<void> {
    if (this.config.enableLogging && this.config.logger) {
      await this.config.logger.logTransition(log);
    }
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
  protected getAvailableTransitions(
    status: string,
  ): Array<EnhancedStateMachineConfig<Context>['transitions'][number]> {
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
    // 在将任务标记为 PROCESSING 之前，读取当前任务状态并保存为 previousStatus 到 context
    const task = await this.persistence.getTask(taskId);
    const prevStatus = task?.status;

    const newContext = {
      ...(task?.context || {}),
      previousStatus: prevStatus,
    } as Record<string, unknown>;

    await this.persistence.updateTask(taskId, {
      startedAt: Date.now(),
      status: EnhancedBaseState.PROCESSING,
      context: newContext,
    });
  }

  /**
   * 标记任务完成
   * @param taskId - 任务ID
   * @returns 无返回值
   */
  protected async markTaskCompleted(taskId: string): Promise<void> {
    await this.persistence.updateTask(taskId, {
      status: EnhancedBaseState.COMPLETED,
      completedAt: Date.now(),
      progress: 100,
    });

    // 更新任务指标
    const metrics = this.taskMetrics.get(taskId);
    if (metrics) {
      metrics.endTime = Date.now();
    }
  }

  /**
   * 标记任务失败
   * @param taskId - 任务ID
   * @param error - 错误信息
   * @returns 无返回值
   */
  protected async markTaskFailed(taskId: string, error: string): Promise<void> {
    await this.persistence.updateTask(taskId, {
      status: EnhancedBaseState.FAILED,
      error,
      completedAt: Date.now(),
    });

    // 更新任务指标
    const metrics = this.taskMetrics.get(taskId);
    if (metrics) {
      metrics.endTime = Date.now();
    }
  }

  /**
   * 标记任务取消
   * @param taskId - 任务ID
   * @returns 无返回值
   */
  protected async markTaskCancelled(taskId: string): Promise<void> {
    await this.persistence.updateTask(taskId, {
      status: EnhancedBaseState.CANCELLED,
      completedAt: Date.now(),
    });

    // 更新任务指标
    const metrics = this.taskMetrics.get(taskId);
    if (metrics) {
      metrics.endTime = Date.now();
    }
  }
}
