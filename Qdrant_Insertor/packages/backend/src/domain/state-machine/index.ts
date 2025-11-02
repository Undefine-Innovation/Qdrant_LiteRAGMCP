// src/domain/state-machine/index.ts

/**
 * 状态机框架模块
 * 提供基于策略模式的通用状态管理功能
 */

// 类型定义
/** 状态机相关类型定义 */
export * from './types.js';

// 基础类
/** 基础状态机引擎实现 */
export { BaseStateMachineEngine } from './BaseStateMachineEngine.js';
/** 基础状态机策略实现 */
export { BaseStateMachineStrategy } from './BaseStateMachineStrategy.js';

// 具体策略实现
/** 批量上传状态机策略及相关类型 */
export {
  BatchUploadStrategy,
  BatchUploadState,
  BatchUploadEvent,
} from './BatchUploadStrategy.js';
/**
 * 批量上传上下文类型
 */
export type { BatchUploadContext } from './BatchUploadStrategy.js';
