/**
 * Domain types 主导出文件
 * 重新导出所有域相关的类型定义
 */

// 同步相关类型
export * from './sync/types.js';

// 状态机相关类型
export * from './state-machine/types.js';

// ID 工具类型
export * from './utils/id.js';

// 实体类型
export * from './entities/types.js';
/**
 *
 */
export {
  CollectionEntity,
  DocEntity,
  ChunkEntity,
  DocStatus,
  ChunkStatus,
} from './entities/index.js';

// 值对象类型
export * from './value-objects/index.js';

// 聚合类型
export * from './aggregates/index.js';

// 事件系统类型（使用命名空间导出避免冲突）
import * as EventTypes from './events/index.js';
/**
 *
 */
export { EventTypes };

// 重新导出关键事件类型，避免命名冲突
/**
 *
 */
export type {
  IDomainEvent,
  CollectionDomainEvent,
  DocumentDomainEvent,
  ChunkDomainEvent,
  EventPriority,
  EventStatus,
  EventType,
} from './events/IDomainEventInterface.js';

/**
 *
 */
export type {
  IEventPublisher,
  IEventBus,
  IEventHandler,
  IEventStore,
  IEventHandlingResult,
  IEventRetryConfig,
  IEventStatistics,
} from './events/IEventPublisher.js';

// 聚合仓储接口类型
export * from './repositories/IAggregateRepository.js';

// 主要服务接口类型
export * from './repositories/ISQLiteRepo.js';
export * from './repositories/IQdrantRepo.js';
export * from './repositories/ITransactionManager.js';

// 事件系统服务
/**
 *
 */
export {
  EventSystemService,
  EventSystemServiceFactory,
} from './services/EventSystemService.js';
