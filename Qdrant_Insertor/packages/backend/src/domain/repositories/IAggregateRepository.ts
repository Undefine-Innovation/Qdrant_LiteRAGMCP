import { CollectionAggregate } from '../aggregates/CollectionAggregate.js';
import { DocumentAggregate } from '../aggregates/DocumentAggregate.js';
import { CollectionId, DocId, PointId } from '../entities/types.js';
import { PaginationQuery, PaginatedResponse } from '../entities/types.js';

/**
 * 集合聚合仓储接口
 * 定义集合聚合的持久化操作
 */
export interface ICollectionAggregateRepository {
  /**
   * 保存集合聚合
   * @param aggregate 集合聚合
   * @returns 保存结果
   */
  save(aggregate: CollectionAggregate): Promise<void>;

  /**
   * 根据ID查找集合聚合
   * @param id 集合ID
   * @returns 集合聚合或null
   */
  findById(id: CollectionId): Promise<CollectionAggregate | null>;

  /**
   * 根据名称查找集合聚合
   * @param name 集合名称
   * @returns 集合聚合或null
   */
  findByName(name: string): Promise<CollectionAggregate | null>;

  /**
   * 检查集合名称是否已存在
   * @param name 集合名称
   * @param excludeId 排除的集合ID（用于更新时检查）
   * @returns 是否存在
   */
  existsByName(name: string, excludeId?: CollectionId): Promise<boolean>;

  /**
   * 获取所有集合聚合
   * @returns 集合聚合数组
   */
  findAll(): Promise<CollectionAggregate[]>;

  /**
   * 分页获取集合聚合
   * @param query 分页查询参数
   * @returns 分页的集合聚合响应
   */
  findPaginated(
    query: PaginationQuery,
  ): Promise<PaginatedResponse<CollectionAggregate>>;

  /**
   * 根据名称前缀查找集合聚合
   * @param prefix 名称前缀
   * @returns 集合聚合数组
   */
  findByPrefix(prefix: string): Promise<CollectionAggregate[]>;

  /**
   * 根据名称后缀查找集合聚合
   * @param suffix 名称后缀
   * @returns 集合聚合数组
   */
  findBySuffix(suffix: string): Promise<CollectionAggregate[]>;

  /**
   * 查找系统集合聚合
   * @returns 系统集合聚合数组
   */
  findSystemCollections(): Promise<CollectionAggregate[]>;

  /**
   * 查找非系统集合聚合
   * @returns 非系统集合聚合数组
   */
  findNonSystemCollections(): Promise<CollectionAggregate[]>;

  /**
   * 删除集合聚合
   * @param id 集合ID
   * @returns 是否成功删除
   */
  delete(id: CollectionId): Promise<boolean>;

  /**
   * 检查集合是否可以被删除
   * @param id 集合ID
   * @returns 是否可以删除
   */
  canBeDeleted(id: CollectionId): Promise<boolean>;

  /**
   * 获取集合的文档数量
   * @param id 集合ID
   * @returns 文档数量
   */
  getDocumentCount(id: CollectionId): Promise<number>;

  /**
   * 获取集合的已完成文档数量
   * @param id 集合ID
   * @returns 已完成文档数量
   */
  getCompletedDocumentCount(id: CollectionId): Promise<number>;
}

/**
 * 文档聚合仓储接口
 * 定义文档聚合的持久化操作
 */
export interface IDocumentAggregateRepository {
  /**
   * 保存文档聚合
   * @param aggregate 文档聚合
   * @returns 保存结果
   */
  save(aggregate: DocumentAggregate): Promise<void>;

  /**
   * 根据ID查找文档聚合
   * @param id 文档ID
   * @returns 文档聚合或null
   */
  findById(id: DocId): Promise<DocumentAggregate | null>;

  /**
   * 根据集合ID和键值查找文档聚合
   * @param collectionId 集合ID
   * @param key 文档键值
   * @returns 文档聚合或null
   */
  findByCollectionAndKey(
    collectionId: CollectionId,
    key: string,
  ): Promise<DocumentAggregate | null>;

  /**
   * 检查文档键是否已存在于集合中
   * @param collectionId 集合ID
   * @param key 文档键值
   * @param excludeId 排除的文档ID（用于更新时检查）
   * @returns 是否存在
   */
  existsByCollectionAndKey(
    collectionId: CollectionId,
    key: string,
    excludeId?: DocId,
  ): Promise<boolean>;

  /**
   * 根据集合ID查找文档聚合
   * @param collectionId 集合ID
   * @returns 文档聚合数组
   */
  findByCollectionId(collectionId: CollectionId): Promise<DocumentAggregate[]>;

  /**
   * 根据集合ID分页查找文档聚合
   * @param collectionId 集合ID
   * @param query 分页查询参数
   * @returns 分页的文档聚合响应
   */
  findByCollectionIdPaginated(
    collectionId: CollectionId,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<DocumentAggregate>>;

  /**
   * 根据状态查找文档聚合
   * @param status 文档状态
   * @returns 文档聚合数组
   */
  findByStatus(status: string): Promise<DocumentAggregate[]>;

  /**
   * 根据集合ID和状态查找文档聚合
   * @param collectionId 集合ID
   * @param status 文档状态
   * @returns 文档聚合数组
   */
  findByCollectionIdAndStatus(
    collectionId: CollectionId,
    status: string,
  ): Promise<DocumentAggregate[]>;

  /**
   * 查找可以处理的文档聚合
   * @param collectionId 集合ID（可选）
   * @param limit 限制数量
   * @returns 可处理的文档聚合数组
   */
  findProcessable(
    collectionId?: CollectionId,
    limit?: number,
  ): Promise<DocumentAggregate[]>;

  /**
   * 查找已删除的文档聚合
   * @param collectionId 集合ID（可选）
   * @returns 已删除的文档聚合数组
   */
  findDeleted(collectionId?: CollectionId): Promise<DocumentAggregate[]>;

  /**
   * 查找处理失败的文档聚合
   * @param collectionId 集合ID（可选）
   * @returns 处理失败的文档聚合数组
   */
  findFailed(collectionId?: CollectionId): Promise<DocumentAggregate[]>;

  /**
   * 查找处理完成的文档聚合
   * @param collectionId 集合ID（可选）
   * @returns 处理完成的文档聚合数组
   */
  findCompleted(collectionId?: CollectionId): Promise<DocumentAggregate[]>;

  /**
   * 分页获取文档聚合
   * @param query 分页查询参数
   * @returns 分页的文档聚合响应
   */
  findPaginated(
    query: PaginationQuery,
  ): Promise<PaginatedResponse<DocumentAggregate>>;

  /**
   * 删除文档聚合
   * @param id 文档ID
   * @returns 是否成功删除
   */
  delete(id: DocId): Promise<boolean>;

  /**
   * 软删除文档聚合
   * @param id 文档ID
   * @returns 是否成功软删除
   */
  softDelete(id: DocId): Promise<boolean>;

  /**
   * 恢复已删除的文档聚合
   * @param id 文档ID
   * @returns 是否成功恢复
   */
  restore(id: DocId): Promise<boolean>;

  /**
   * 检查文档是否可以被删除
   * @param id 文档ID
   * @returns 是否可以删除
   */
  canBeDeleted(id: DocId): Promise<boolean>;

  /**
   * 获取文档的块数量
   * @param id 文档ID
   * @returns 块数量
   */
  getChunkCount(id: DocId): Promise<number>;

  /**
   * 获取文档的已完成块数量
   * @param id 文档ID
   * @returns 已完成块数量
   */
  getCompletedChunkCount(id: DocId): Promise<number>;

  /**
   * 获取文档的失败块数量
   * @param id 文档ID
   * @returns 失败块数量
   */
  getFailedChunkCount(id: DocId): Promise<number>;

  /**
   * 批量更新文档状态
   * @param ids 文档ID数组
   * @param status 新状态
   * @returns 更新结果
   */
  batchUpdateStatus(ids: DocId[], status: string): Promise<number>;
}

/**
 * 聚合仓储管理器接口
 * 管理所有聚合仓储
 */
export interface IAggregateRepositoryManager {
  /**
   * 集合聚合仓储
   */
  readonly collections: ICollectionAggregateRepository;

  /**
   * 文档聚合仓储
   */
  readonly documents: IDocumentAggregateRepository;

  /**
   * 在事务中执行操作
   * @param operation 事务操作函数
   * @returns 操作结果
   */
  transaction<T>(operation: () => Promise<T>): Promise<T>;

  /**
   * 开始事务
   * @returns 事务上下文
   */
  beginTransaction(): Promise<ITransactionContext>;

  /**
   * 提交事务
   * @param context 事务上下文
   * @returns 提交结果
   */
  commitTransaction(context: ITransactionContext): Promise<void>;

  /**
   * 回滚事务
   * @param context 事务上下文
   * @returns 回滚结果
   */
  rollbackTransaction(context: ITransactionContext): Promise<void>;
}

/**
 * 事务上下文接口
 */
export interface ITransactionContext {
  /**
   * 事务ID
   */
  readonly transactionId: string;

  /**
   * 是否活跃
   */
  readonly isActive: boolean;

  /**
   * 开始时间
   */
  readonly startTime: number;

  /**
   * 提交事务
   */
  commit(): Promise<void>;

  /**
   * 回滚事务
   */
  rollback(): Promise<void>;
}

/**
 * 聚合仓储工厂接口
 * 创建聚合仓储实例
 */
export interface IAggregateRepositoryFactory {
  /**
   * 创建集合聚合仓储
   * @returns 集合聚合仓储实例
   */
  createCollectionRepository(): ICollectionAggregateRepository;

  /**
   * 创建文档聚合仓储
   * @returns 文档聚合仓储实例
   */
  createDocumentRepository(): IDocumentAggregateRepository;

  /**
   * 创建聚合仓储管理器
   * @returns 聚合仓储管理器实例
   */
  createRepositoryManager(): IAggregateRepositoryManager;
}
