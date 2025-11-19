import {
  CollectionId,
  DocId,
  PaginationQuery,
  PaginatedResponse,
} from '../entities/types.js';
import {
  CollectionAggregate,
  DocumentAggregate,
} from '../aggregates/index.js';

/**
 * 聚合仓库接口，只定义领域层所需的最小操作集合
 */
export interface IAggregateRepository<T, ID> {
  /** 保存聚合根 */
  save?(aggregate: T): Promise<void>;
  /** 通过ID查找聚合根 */
  findById(id: ID): Promise<T | null>;
  /** 根据ID删除聚合根 */
  delete(id: ID): Promise<boolean>;
}

/**
 * 集合聚合仓库接口
 */
export interface ICollectionAggregateRepository
  extends IAggregateRepository<CollectionAggregate, CollectionId> {
  save(aggregate: CollectionAggregate): Promise<void>;
  findByName(name: string): Promise<CollectionAggregate | null>;
  existsByName(name: string, excludeId?: CollectionId): Promise<boolean>;
  findSystemCollections(): Promise<CollectionAggregate[]>;
  findNonSystemCollections(): Promise<CollectionAggregate[]>;
  findAll(): Promise<CollectionAggregate[]>;
  findPaginated(
    query: PaginationQuery,
  ): Promise<PaginatedResponse<CollectionAggregate>>;
  getDocumentCount(id: CollectionId): Promise<number>;
  getCompletedDocumentCount(id: CollectionId): Promise<number>;
  updateCollection(
    id: CollectionId,
    data: { status?: 'active' | 'inactive' | 'archived' },
  ): Promise<CollectionAggregate | null>;
}

/**
 * 文档聚合仓库接口
 */
export interface IDocumentAggregateRepository
  extends IAggregateRepository<DocumentAggregate, DocId> {
  save?(aggregate: DocumentAggregate): Promise<void>;
  findByCollectionAndKey(
    collectionId: CollectionId,
    key: string,
  ): Promise<DocumentAggregate | null>;

  existsByCollectionAndKey(
    collectionId: CollectionId,
    key: string,
    excludeId?: DocId,
  ): Promise<boolean>;

  findByCollectionId(collectionId: CollectionId): Promise<DocumentAggregate[]>;

  findByCollectionIdPaginated(
    collectionId: CollectionId,
    pagination: PaginationQuery,
  ): Promise<PaginatedResponse<DocumentAggregate>>;

  findPaginated(
    pagination: PaginationQuery,
  ): Promise<PaginatedResponse<DocumentAggregate>>;

  getChunkCount(id: DocId): Promise<number>;
  getCompletedChunkCount(id: DocId): Promise<number>;
  getFailedChunkCount(id: DocId): Promise<number>;
}
