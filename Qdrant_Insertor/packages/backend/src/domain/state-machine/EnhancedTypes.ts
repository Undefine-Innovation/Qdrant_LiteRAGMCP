// src/domain/state-machine/enhanced-types.ts

import { Logger } from '@logging/logger.js';
import { StateMachineTask } from './types.js';

/**
 * 增强的状态机基础状态枚举
 * 扩展原有基础状态，添加更多细粒度状态
 */
export enum EnhancedBaseState {
  NEW = 'NEW',
  INITIALIZING = 'INITIALIZING',
  VALIDATING = 'VALIDATING',
  PROCESSING = 'PROCESSING',
  UPLOADING = 'UPLOADING',
  INDEXING = 'INDEXING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  RETRYING = 'RETRYING',
  DEAD = 'DEAD',
}

/**
 * 增强的状态机事件枚举
 * 扩展原有基础事件，添加更多细粒度事件
 */
export enum EnhancedBaseEvent {
  START = 'start',
  INITIALIZE = 'initialize',
  VALIDATE = 'validate',
  PROCESS = 'process',
  UPLOAD = 'upload',
  INDEX = 'index',
  COMPLETE = 'complete',
  FAIL = 'fail',
  CANCEL = 'cancel',
  RETRY = 'retry',
  PAUSE = 'pause',
  RESUME = 'resume',
}

/**
 * 状态转换验证结果
 */
export interface StateTransitionValidationResult {
  /** 是否验证通过 */
  valid: boolean;
  /** 错误信息（如果验证失败） */
  error?: string;
  /** 警告信息 */
  warnings?: string[];
}

/**
 * 状态转换日志条目
 */
export interface StateTransitionLog {
  /** 日志ID */
  id: string;
  /** 任务ID */
  taskId: string;
  /** 源状态 */
  fromState: string;
  /** 目标状态 */
  toState: string;
  /** 触发事件 */
  event: string;
  /** 转换时间戳 */
  timestamp: number;
  /** 转换结果 */
  success: boolean;
  /** 错误信息（如果转换失败） */
  error?: string;
  /** 上下文信息 */
  context?: Record<string, unknown>;
  /** 执行时长（毫秒） */
  duration?: number;
}

/**
 * 状态机指标统计
 */
export interface StateMachineMetrics {
  /** 总任务数 */
  totalTasks: number;
  /** 各状态的任务数量 */
  tasksByState: Record<string, number>;
  /** 各类型的任务数量 */
  tasksByType: Record<string, number>;
  /** 平均执行时间（毫秒） */
  averageExecutionTime: number;
  /** 成功率 */
  successRate: number;
  /** 失败率 */
  failureRate: number;
  /** 重试率 */
  retryRate: number;
}

/**
 * 状态转换验证器接口
 */
export interface StateTransitionValidator {
  /**
   * 验证状态转换是否合法
   * @param fromState 源状态
   * @param toState 目标状态
   * @param event 触发事件
   * @param context 状态机上下文
   * @returns 验证结果
   */
  validateTransition(
    fromState: string,
    toState: string,
    event: string,
    context?: Record<string, unknown>,
  ): Promise<StateTransitionValidationResult>;
}

/**
 * 状态转换日志记录器接口
 */
export interface StateTransitionLogger {
  /**
   * 记录状态转换日志
   * @param log 日志条目
   * @returns 无返回值
   */
  logTransition(log: StateTransitionLog): Promise<void>;

  /**
   * 获取任务的状态转换历史
   * @param taskId 任务ID
   * @param limit 限制条数
   * @returns 状态转换日志列表
   */
  getTransitionHistory(
    taskId: string,
    limit?: number,
  ): Promise<StateTransitionLog[]>;

  /**
   * 清理过期的日志条目
   * @param olderThan 过期时间阈值（毫秒）
   * @returns 清理的条目数量
   */
  cleanupExpiredLogs(olderThan: number): Promise<number>;
}

/**
 * 增强的状态机配置接口
 * 扩展原有配置，添加验证和日志相关配置
 */
export interface EnhancedStateMachineConfig<
  Context extends Record<string, unknown> = Record<string, unknown>,
> {
  /** 状态机类型标识符 */
  taskType: string;
  /** 初始状态 */
  initialState: string;
  /** 终态列表 */
  finalStates: string[];
  /** 状态转换规则 */
  transitions: Array<{
    /** 源状态 */
    from: string;
    /** 目标状态 */
    to: string;
    /** 触发事件 */
    event: string;
    /** 转换条件函数（可选） */
    condition?: (context: Context) => boolean | Promise<boolean>;
    /** 转换动作函数（可选） */
    action?: (context: Context) => void | Promise<void>;
    /** 转换前验证函数（可选） */
    beforeTransition?: (context: Context) => void | Promise<void>;
    /** 转换后处理函数（可选） */
    afterTransition?: (context: Context) => void | Promise<void>;
    /** 错误处理函数（可选） */
    onError?: (error: Error, context: Context) => void | Promise<void>;
  }>;
  /** 最大重试次数 */
  maxRetries?: number;
  /** 是否启用持久化 */
  enablePersistence?: boolean;
  /** 是否启用状态转换验证 */
  enableValidation?: boolean;
  /** 是否启用状态转换日志 */
  enableLogging?: boolean;
  /** 状态转换验证器（可选） */
  validator?: StateTransitionValidator;
  /** 状态转换日志记录器（可选） */
  logger?: StateTransitionLogger;
  /** 自定义指标收集器（可选） */
  metricsCollector?: (metrics: StateMachineMetrics) => void;
}

/**
 * 增强的状态机策略接口
 * 扩展原有策略接口，添加验证和日志功能
 */
export interface EnhancedStateMachineStrategy<
  Context extends Record<string, unknown> = Record<string, unknown>,
> {
  /** 策略标识符 */
  readonly strategyId: string;
  /** 增强的状态机配置 */
  readonly config: EnhancedStateMachineConfig<Context>;
  /** 处理状态转换 */
  handleTransition(
    taskId: string,
    event: string,
    context?: Context,
  ): Promise<boolean>;
  /** 获取当前状态 */
  getCurrentState(taskId: string): Promise<string | null>;
  /** 创建新任务 */
  createTask(
    taskId: string,
    initialContext?: Context,
  ): Promise<StateMachineTask>;
  /** 执行任务逻辑 */
  executeTask(taskId: string): Promise<void>;
  /** 处理错误 */
  handleError(taskId: string, error: Error): Promise<void>;
  /** 验证状态转换 */
  validateTransition(
    taskId: string,
    event: string,
    context?: Context,
  ): Promise<StateTransitionValidationResult>;
  /** 获取状态转换历史 */
  getTransitionHistory(
    taskId: string,
    limit?: number,
  ): Promise<StateTransitionLog[]>;
  /** 获取任务指标 */
  getTaskMetrics(): Promise<StateMachineMetrics>;
}

/**
 * 增强的状态机引擎接口
 * 扩展原有引擎接口，添加验证、日志和指标功能
 */
export interface IEnhancedStateMachineEngine {
  /** 注册状态机策略 */
  registerStrategy(
    strategy: EnhancedStateMachineStrategy<Record<string, unknown>>,
  ): void;
  /** 获取已注册的策略ID列表 */
  getRegisteredStrategies(): string[];
  /** 获取已注册的策略 */
  getStrategy(
    taskType: string,
  ): EnhancedStateMachineStrategy<Record<string, unknown>> | null;
  /** 创建新任务 */
  createTask(
    taskType: string,
    taskId: string,
    initialContext?: Record<string, unknown>,
  ): Promise<StateMachineTask>;
  /** 触发状态转换 */
  transitionState(
    taskId: string,
    event: string,
    context?: Record<string, unknown>,
  ): Promise<boolean>;
  /** 验证状态转换 */
  validateTransition(
    taskId: string,
    event: string,
    context?: Record<string, unknown>,
  ): Promise<StateTransitionValidationResult>;
  /** 获取任务状态 */
  getTask(taskId: string): Promise<StateMachineTask | null>;
  /** 获取指定状态的任务列表 */
  getTasksByStatus(status: string): Promise<StateMachineTask[]>;
  /** 获取指定类型的任务列表 */
  getTasksByType(taskType: string): Promise<StateMachineTask[]>;
  /** 执行任务 */
  executeTask(taskId: string): Promise<void>;
  /** 处理任务错误 */
  handleTaskError(taskId: string, error: Error): Promise<void>;
  /** 清理过期任务 */
  cleanupExpiredTasks(olderThan?: number): Promise<number>;
  /** 获取状态转换历史 */
  getTransitionHistory(
    taskId: string,
    limit?: number,
  ): Promise<StateTransitionLog[]>;
  /** 获取全局指标 */
  getGlobalMetrics(): Promise<StateMachineMetrics>;
  /** 获取策略指标 */
  getStrategyMetrics(taskType: string): Promise<StateMachineMetrics>;
  /** 批量创建任务 */
  createTasks(
    taskType: string,
    taskIds: string[],
    initialContext?: Record<string, unknown>,
  ): Promise<StateMachineTask[]>;
  /** 批量执行任务 */
  executeTasks(taskIds: string[], concurrency?: number): Promise<void>;
  /** 取消任务 */
  cancelTask(taskId: string): Promise<boolean>;
  /** 重试任务 */
  retryTask(taskId: string): Promise<boolean>;
  /** 暂停任务 */
  pauseTask(taskId: string): Promise<boolean>;
  /** 恢复任务 */
  resumeTask(taskId: string): Promise<boolean>;
}

/**
 * 默认状态转换验证器实现
 */
export class DefaultStateTransitionValidator
  implements StateTransitionValidator
{
  constructor(private readonly logger?: Logger) {}

  async validateTransition(
    fromState: string,
    toState: string,
    event: string,
    context?: Record<string, unknown>,
  ): Promise<StateTransitionValidationResult> {
    // 基础验证逻辑
    if (!fromState || !toState || !event) {
      return {
        valid: false,
        error: '状态转换参数不完整',
      };
    }

    // 检查是否为相同状态
    if (fromState === toState) {
      return {
        valid: false,
        error: '不能转换到相同状态',
      };
    }

    // 可以在这里添加更多自定义验证逻辑
    const warnings: string[] = [];

    // 检查上下文中的关键信息
    if (context) {
      if (context.error && !toState.includes('FAIL')) {
        warnings.push('上下文中包含错误信息，但目标状态不是失败状态');
      }
    }

    this.logger?.debug(
      `状态转换验证通过: ${fromState} -> ${toState} (事件: ${event})`,
    );

    return {
      valid: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }
}

/**
 * 默认状态转换日志记录器实现
 */
export class DefaultStateTransitionLogger implements StateTransitionLogger {
  private logs: Map<string, StateTransitionLog[]> = new Map();

  async logTransition(log: StateTransitionLog): Promise<void> {
    const taskLogs = this.logs.get(log.taskId) || [];
    taskLogs.push(log);
    this.logs.set(log.taskId, taskLogs);

    // 保持最近100条记录
    if (taskLogs.length > 100) {
      taskLogs.splice(0, taskLogs.length - 100);
    }
  }

  async getTransitionHistory(
    taskId: string,
    limit?: number,
  ): Promise<StateTransitionLog[]> {
    const taskLogs = this.logs.get(taskId) || [];
    return limit ? taskLogs.slice(-limit) : [...taskLogs];
  }

  async cleanupExpiredLogs(olderThan: number): Promise<number> {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [taskId, logs] of this.logs.entries()) {
      const validLogs = logs.filter((log) => now - log.timestamp <= olderThan);
      const removedCount = logs.length - validLogs.length;
      cleanedCount += removedCount;

      if (validLogs.length === 0) {
        this.logs.delete(taskId);
      } else {
        this.logs.set(taskId, validLogs);
      }
    }

    return cleanedCount;
  }
}
