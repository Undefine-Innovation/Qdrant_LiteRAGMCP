// src/domain/state-machine/types.ts

/**
 * 基础状态机状态枚举
 * 所有具体状态机都应该继承或实现这些基础状态
 */
export enum BaseState {
  NEW = 'NEW',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

/**
 * 基础状态机事件枚举
 * 所有具体状态机都应该继承或实现这些基础事件
 */
export enum BaseEvent {
  START = 'start',
  PROGRESS = 'progress',
  COMPLETE = 'complete',
  FAIL = 'fail',
  CANCEL = 'cancel',
  RETRY = 'retry',
}

/**
 * 状态机任务接口
 * 定义了状态机管理的基本任务结构
 */
export interface StateMachineTask {
  /** 任务唯一标识符 */
  id: string;
  /** 任务类型标识符 */
  taskType: string;
  /** 当前状态 */
  status: string;
  /** 重试次数 */
  retries: number;
  /** 最后一次尝试时间 */
  lastAttemptAt?: number;
  /** 错误信息 */
  error?: string;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
  /** 开始时间 */
  startedAt?: number;
  /** 完成时间 */
  completedAt?: number;
  /** 进度百分比 (0-100) */
  progress: number;
  /** 任务上下文数据 */
  context?: Record<string, unknown>;
}

/**
 * 状态机上下文接口
 * 定义了状态机运行时需要的数据
 */
export interface StateMachineContext {
  /** 任务ID */
  taskId: string;
  /** 任务类型 */
  taskType: string;
  /** 可扩展的上下文数据 */
  [key: string]: unknown;
}

/**
 * 状态转换规则接口
 * 定义了状态转换的基本结构
 */
export interface StateTransition {
  /** 源状态 */
  from: string;
  /** 目标状态 */
  to: string;
  /** 触发事件 */
  event: string;
  /** 转换条件函数（可选） */
  condition?: (context: StateMachineContext) => boolean;
  /** 转换动作函数（可选） */
  action?: (context: StateMachineContext) => Promise<void> | void;
}

/**
 * 状态机配置接口
 * 定义了状态机的基本配置
 */
export interface StateMachineConfig {
  /** 状态机类型标识符 */
  taskType: string;
  /** 初始状态 */
  initialState: string;
  /** 终态列表 */
  finalStates: string[];
  /** 状态转换规则 */
  transitions: StateTransition[];
  /** 最大重试次数 */
  maxRetries?: number;
  /** 是否启用持久化 */
  enablePersistence?: boolean;
}

/**
 * 状态持久化接口
 * 定义了状态持久化的基本操作
 */
export interface StatePersistence {
  /** 保存任务状态 */
  saveTask(task: StateMachineTask): Promise<void>;
  /** 获取任务状态 */
  getTask(taskId: string): Promise<StateMachineTask | null>;
  /** 获取指定状态的任务列表 */
  getTasksByStatus(status: string): Promise<StateMachineTask[]>;
  /** 获取指定类型的任务列表 */
  getTasksByType(taskType: string): Promise<StateMachineTask[]>;
  /** 更新任务状态 */
  updateTask(taskId: string, updates: Partial<StateMachineTask>): Promise<void>;
  /** 删除任务 */
  deleteTask(taskId: string): Promise<void>;
  /** 清理过期任务 */
  cleanupExpiredTasks(olderThan: number): Promise<number>;
}

/**
 * 状态机策略接口
 * 定义了策略模式的状态机行为
 */
export interface StateMachineStrategy {
  /** 策略标识符 */
  readonly strategyId: string;
  /** 状态机配置 */
  readonly config: StateMachineConfig;
  /** 处理状态转换 */
  handleTransition(
    taskId: string,
    event: string,
    context?: StateMachineContext
  ): Promise<boolean>;
  /** 获取当前状态 */
  getCurrentState(taskId: string): Promise<string | null>;
  /** 创建新任务 */
  createTask(taskId: string, initialContext?: StateMachineContext): Promise<StateMachineTask>;
  /** 执行任务逻辑 */
  executeTask(taskId: string): Promise<void>;
  /** 处理错误 */
  handleError(taskId: string, error: Error): Promise<void>;
}

/**
 * 状态机引擎接口
 * 定义了状态机引擎的核心功能
 */
export interface IStateMachineEngine {
  /** 注册状态机策略 */
  registerStrategy(strategy: StateMachineStrategy): void;
  /** 获取已注册的策略 */
  getStrategy(taskType: string): StateMachineStrategy | null;
  /** 创建新任务 */
  createTask(
    taskType: string,
    taskId: string,
    initialContext?: StateMachineContext
  ): Promise<StateMachineTask>;
  /** 触发状态转换 */
  transitionState(
    taskId: string,
    event: string,
    context?: StateMachineContext
  ): Promise<boolean>;
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
}