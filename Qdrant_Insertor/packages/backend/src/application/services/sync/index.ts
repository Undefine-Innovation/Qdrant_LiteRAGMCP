/**
 * 同步状态机模块服务
 *
 * 提供系统同步状态机相关的服务，包括同步处理、作业管理和错误处理
 */

/** 简化的同步服务 - 替换复杂的状态机实现 */
export { SimplifiedSyncService } from './SimplifiedSyncService.js';

/** 简化的同步状态机 */
export {
  SimplifiedSyncStateMachine,
  SyncStatus,
} from '@domain/sync/SimplifiedSyncStateMachine.js';

/** 保持向后兼容性的导出 - 使用简化实现 */
export { SimplifiedSyncService as SyncStateMachine } from './SimplifiedSyncService.js';
export { SimplifiedSyncService as PersistentSyncStateMachine } from './SimplifiedSyncService.js';

/** 同步状态机核心 - 保持向后兼容 */
export { SimplifiedSyncStateMachine as SyncStateMachineCore } from '@domain/sync/SimplifiedSyncStateMachine.js';

/** 同步作业管理器 */
export { SyncJobManager } from './SyncJobManager.js';

/** 文档同步处理器 */
export { DocumentSyncProcessor } from './DocumentSyncProcessor.js';

/** 同步错误处理器 */
export { SyncErrorHandler } from './SyncErrorHandler.js';
