/**
 * 聚合模块主导出文件
 * 导出所有聚合相关的类型和实现
 */

// 聚合根基类
export {
  AggregateRoot,
  AggregateRootManager,
  AggregateRootFactory,
} from './AggregateRoot.js';

// 聚合根实现
export { CollectionAggregate } from './CollectionAggregate.js';
export { DocumentAggregate } from './DocumentAggregate.js';

// 聚合工厂
export { AggregateFactory } from './AggregateFactory.js';

// 聚合间业务规则和事件处理
export {
  AggregateBusinessRules,
  AggregateEventHandler,
  AggregateCoordinator,
} from './AggregateBusinessRules.js';

// 向后兼容的事件导出
export {
  type CollectionDomainEvent,
  CollectionCreatedEvent,
  CollectionUpdatedEvent,
  DocumentAddedEvent,
  DocumentRemovedEvent,
} from './CollectionAggregate.js';

export {
  type DocumentDomainEvent,
  DocumentCreatedEvent,
  DocumentContentUpdatedEvent,
  DocumentStatusChangedEvent,
  ChunkAddedEvent,
  ChunkEmbeddingGeneratedEvent,
} from './DocumentAggregate.js';
