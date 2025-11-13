/**
 * Domain层主导出文件
 * 按照DDD架构重新组织，导出所有领域相关的类型和实现
 */

// 实体和聚合根
export type {
  Collection as CollectionEntity,
  Doc as DocEntity,
  Chunk as ChunkEntity,
} from './entities/index.js';
export { DocStatus, ChunkStatus } from './entities/index.js';
export {
  AggregateRoot,
  AggregateRootManager,
  AggregateRootFactory,
  CollectionAggregate,
  DocumentAggregate,
  AggregateFactory,
  AggregateBusinessRules,
  AggregateEventHandler,
  AggregateCoordinator,
  type CollectionDomainEvent,
  type DocumentDomainEvent,
} from './aggregates/index.js';

// 值对象
export * from './value-objects/index.js';

// 领域服务（纯粹的领域逻辑，不包含基础设施依赖）
export * from './services/index.js';

// 仓储接口（仅接口定义，不包含实现）
export * from './repositories/index.js';

// 领域事件
export * from './events/index.js';

// 领域类型和常量
export type {
  CollectionId,
  DocId,
  PointId,
  Collection,
  Doc,
  ChunkMeta,
  ChunkTextRow,
  Chunk,
  ChunkWithVector,
  SearchFilters,
  SearchRequest,
  UnifiedSearchResult,
  DocumentChunk,
  SplitStrategy,
  SplitOptions,
  QdrantPointPayload,
  QdrantSearchHit,
  CreateCollectionRequest,
  CreateCollectionResponse,
  ListCollectionsResponse,
  GetCollectionResponse,
  CreateDocRequest,
  CreateDocResponse,
  ListDocsResponse,
  GetDocResponse,
  UpdateDocRequest,
  UpdateDocResponse,
  SearchResponse,
  RetrievalResultType,
  RetrievalResultDTO,
  PaginationQuery,
  PaginationMeta,
  PaginatedResponse,
  PageQuery,
  PageMeta,
  Paginated,
  Stats,
  Health,
} from './types.js';

// 状态机（领域逻辑）
export * from './state-machine/index.js';

// 工具类
export * from './utils/id.js';
