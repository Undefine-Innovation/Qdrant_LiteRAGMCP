import {
  DataSource,
  FindOptionsWhere,
  Not,
  In,
  Between,
  EntityManager,
} from 'typeorm';
import {
  BaseRepository,
  PaginationOptions,
  PaginationResult,
  BatchOperationResult,
} from './BaseRepository.js';
import { Doc } from '../entities/Doc.js';
import { Logger } from '@logging/logger.js';
import { DocId, CollectionId } from '@domain/entities/types.js';

// 导入拆分后的模块
import { SimplifiedDocQueries } from './SimplifiedDocQueries.js';
import { SimplifiedDocStatusManagement } from './SimplifiedDocStatusManagement.js';
import { SimplifiedDocBatchOperations } from './SimplifiedDocBatchOperations.js';
import { SimplifiedDocAdvancedQueries } from './SimplifiedDocAdvancedQueries.js';
import { SimplifiedDocStatistics } from './SimplifiedDocStatistics.js';
import { SimplifiedDocTransactionOperations } from './SimplifiedDocTransactionOperations.js';

/**
 * 简化的文档Repository
 * 合并了DocRepository、DocRepositoryBase、DocRepositoryQueries、DocRepositoryStatus和DocRepositoryAdvanced
 * 提供文档相关的所有数据库操作
 */
export class SimplifiedDocRepository extends BaseRepository<Doc> {
  private readonly queryHelper: SimplifiedDocQueries;
  private readonly statusManager: SimplifiedDocStatusManagement;
  private readonly batchOperations: SimplifiedDocBatchOperations;
  private readonly docAdvancedQueries: SimplifiedDocAdvancedQueries;
  private readonly statistics: SimplifiedDocStatistics;
  private readonly transactionOperations: SimplifiedDocTransactionOperations;
  private static readonly VALID_STATUSES = [
    'new',
    'processing',
    'completed',
    'failed',
  ] as const;

  /**
   * 创建SimplifiedDocRepository实例
   * @param dataSource TypeORM数据源
   * @param logger 日志记录器
   */
  constructor(dataSource: DataSource, logger: Logger) {
    super(dataSource, Doc, logger);
    this.queryHelper = new SimplifiedDocQueries(dataSource, logger);
    this.statusManager = new SimplifiedDocStatusManagement(dataSource, logger);
    this.batchOperations = new SimplifiedDocBatchOperations(dataSource, logger);
    this.docAdvancedQueries = new SimplifiedDocAdvancedQueries(
      dataSource,
      logger,
    );
    this.statistics = new SimplifiedDocStatistics(dataSource, logger);
    this.transactionOperations = new SimplifiedDocTransactionOperations(
      dataSource,
      logger,
    );
  }

  // === 基础查询方法 ===

  /**
   * 根据docId查找文档
   * Doc实体使用docId字段作为业务标识符，而非id字段
   * @param docId 文档ID（业务标识符）
   * @returns 找到的文档或null
   */
  async findById(docId: string): Promise<Doc | null> {
    return this.queryHelper.findById(docId);
  }

  /**
   * 根据集合ID和键值查找文档
   * @param collectionId 集合ID
   * @param key 文档键值
   * @returns 找到的文档或null
   */
  async findByCollectionAndKey(
    collectionId: CollectionId,
    key: string,
  ): Promise<Doc | null> {
    return this.queryHelper.findByCollectionAndKey(collectionId, key);
  }

  /**
   * 根据内容哈希查找文档
   * @param contentHash 内容哈希
   * @returns 找到的文档或null
   */
  async findByContentHash(contentHash: string): Promise<Doc | null> {
    return this.queryHelper.findByContentHash(contentHash);
  }

  /**
   * 根据多个内容哈希批量查找文档
   * @param contentHashes 内容哈希数组
   * @returns 找到的文档数组
   */
  async findByContentHashes(contentHashes: string[]): Promise<Doc[]> {
    if (contentHashes.length === 0) {
      return [];
    }
    return this.queryHelper.findByContentHashes(contentHashes);
  }

  // === 查询方法 ===

  /**
   * 根据集合ID查找文档
   * @param collectionId 集合ID
   * @param options 查询选项
   * @param options.status 可选的状态过滤器
   * @param options.limit 可选的限制数量
   * @param options.orderBy 可选的排序字段
   * @returns 文档数组
   */
  async findByCollectionId(
    collectionId: CollectionId,
    options: {
      status?: 'new' | 'processing' | 'completed' | 'failed';
      limit?: number;
      orderBy?: Record<string, 'ASC' | 'DESC'>;
    } = {},
  ): Promise<Doc[]> {
    return this.queryHelper.findByCollectionId(collectionId, options);
  }

  /**
   * 查找所有活跃文档
   * @param options 查询选项
   * @param options.status 可选的状态过滤器
   * @param options.limit 可选的限制数量
   * @param options.orderBy 可选的排序字段
   * @returns 文档数组
   */
  async findAllActive(
    options: {
      status?: 'new' | 'processing' | 'completed' | 'failed';
      limit?: number;
      orderBy?: Record<string, 'ASC' | 'DESC'>;
    } = {},
  ): Promise<Doc[]> {
    return this.queryHelper.findAllActive(options);
  }

  /**
   * 分页查找文档
   * @param page 页码（从1开始）
   * @param pageSize 每页数量
   * @param options 可选的查询选项
   * @param options.collectionId 可选的集合ID过滤器
   * @param options.status 可选的状态过滤器
   * @returns 分页结果
   */
  async findWithPagination(
    page: number,
    pageSize: number,
    options?: {
      collectionId?: CollectionId;
      status?: 'new' | 'processing' | 'completed' | 'failed';
    },
  ): Promise<PaginationResult<Doc>> {
    // 转换参数格式以匹配内部实现
    const paginationOptions: PaginationOptions = { page, pageSize };
    const collectionId = options?.collectionId;
    const status = options?.status;

    return this.queryHelper.findWithPagination(
      paginationOptions,
      collectionId,
      status,
    );
  }

  /**
   * 扩展的分页查询方法，支持更多参数
   * @param paginationOptions 分页选项
   * @param collectionId 可选的集合ID过滤器
   * @param status 可选的状态过滤器
   * @returns 分页结果
   */
  async findWithPaginationExtended(
    paginationOptions: PaginationOptions,
    collectionId?: CollectionId,
    status?: 'new' | 'processing' | 'completed' | 'failed',
  ): Promise<PaginationResult<Doc>> {
    return this.queryHelper.findWithPagination(
      paginationOptions,
      collectionId,
      status,
    );
  }

  /**
   * 获取文档数量
   * @param collectionId 可选的集合ID
   * @param status 可选的状态
   * @returns 文档数量
   */
  async getCount(
    collectionId?: CollectionId,
    status?: 'new' | 'processing' | 'completed' | 'failed',
  ): Promise<number> {
    return this.queryHelper.getCount(collectionId, status);
  }

  /**
   * 统计集合文档数量
   * @param collectionId 集合ID
   * @param status 可选的状态过滤器
   * @returns 文档数量
   */
  async countByCollectionId(
    collectionId: CollectionId,
    status?: 'new' | 'processing' | 'completed' | 'failed',
  ): Promise<number> {
    return this.getCount(collectionId, status);
  }

  /**
   * 统计集合已完成文档数量
   * @param collectionId 集合ID
   * @returns 已完成文档数量
   */
  async countCompletedByCollectionId(
    collectionId: CollectionId,
  ): Promise<number> {
    return this.countByCollectionId(collectionId, 'completed');
  }

  // === 状态管理方法 ===

  /**
   * 软删除文档
   * @param id 文档ID
   * @returns 是否删除成功
   */
  async softDeleteDoc(id: DocId): Promise<boolean> {
    return this.statusManager.softDeleteDoc(id);
  }

  /**
   * 恢复文档
   * @param id 文档ID
   * @returns 是否恢复成功
   */
  async restore(id: DocId): Promise<boolean> {
    return this.statusManager.restore(id);
  }

  /**
   * 批量更新文档状态
   * @param ids 文档ID数组
   * @param status 新状态
   * @returns 批量操作结果
   */
  async batchUpdateStatus(
    ids: DocId[],
    status: 'new' | 'processing' | 'completed' | 'failed',
  ): Promise<BatchOperationResult> {
    return this.statusManager.batchUpdateStatus(ids, status);
  }

  /**
   * 更新文档信息
   * @param id 文档ID
   * @param data 更新数据
   * @returns 更新后的文档
   */
  async updateDocInfo(
    id: DocId,
    data: Partial<Pick<Doc, 'name' | 'mime' | 'size_bytes'>>,
  ): Promise<Doc | null> {
    return this.statusManager.updateDocInfo(id, data);
  }

  // === 高级查询方法 ===

  /**
   * 搜索文档内容
   * @param searchText 搜索文本
   * @param options 搜索选项
   * @param options.collectionId 可选的集合ID过滤器
   * @param options.limit 可选的限制数量
   * @param options.searchFields 可选的搜索字段
   * @returns 匹配的文档数组
   */
  async searchContent(
    searchText: string,
    options: {
      collectionId?: CollectionId;
      limit?: number;
      searchFields?: string[];
    } = {},
  ): Promise<Doc[]> {
    return this.docAdvancedQueries.searchContent(searchText, options);
  }

  /**
   * 查找可处理的文档
   * @param collectionId 集合ID
   * @param limit 限制数量
   * @returns 文档数组
   */
  async findProcessable(
    collectionId: CollectionId,
    limit?: number,
  ): Promise<Doc[]> {
    return this.docAdvancedQueries.findProcessable(collectionId, limit);
  }

  /**
   * 根据时间范围查找文档
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @param options 查询选项
   * @param options.collectionId 可选的集合ID过滤器
   * @param options.status 可选的状态过滤器
   * @param options.limit 可选的限制数量
   * @returns 文档数组
   */
  async findByTimeRange(
    startTime: number,
    endTime: number,
    options: {
      collectionId?: CollectionId;
      status?: 'new' | 'processing' | 'completed' | 'failed';
      limit?: number;
    } = {},
  ): Promise<Doc[]> {
    return this.docAdvancedQueries.findByTimeRange(startTime, endTime, options);
  }

  // === 批量操作方法 ===

  /**
   * 批量软删除文档
   * @param ids 文档ID数组
   * @returns 删除的记录数
   */
  async batchSoftDelete(ids: DocId[]): Promise<number> {
    return this.statusManager.batchSoftDelete(ids);
  }

  /**
   * 批量恢复文档
   * @param ids 文档ID数组
   * @returns 恢复的记录数
   */
  async batchRestore(ids: DocId[]): Promise<number> {
    return this.statusManager.batchRestore(ids);
  }

  // === 统计方法 ===

  /**
   * 获取文档统计信息
   * @param collectionId 可选的集合ID
   * @returns 统计信息
   */
  async getDocStatistics(collectionId?: CollectionId): Promise<{
    total: number;
    new: number;
    processing: number;
    completed: number;
    failed: number;
    deleted: number;
    totalSize: number;
  }> {
    return this.statistics.getDocStatistics(collectionId);
  }

  // === 事务相关方法 ===

  /**
   * 使用事务管理器删除文档
   * @param id 文档ID
   * @param manager 事务管理器
   * @returns 删除结果
   */
  async deleteWithManager(
    id: DocId,
    manager: EntityManager,
  ): Promise<{ affected?: number }> {
    return this.transactionOperations.deleteWithManager(id, manager);
  }

  // === 向后兼容的方法 ===

  async findByStatus(status: string): Promise<Doc[]> {
    return this.queryHelper.findByStatus(status as 'new' | 'processing' | 'completed' | 'failed');
  }

  async findByCollectionIdAndStatus(
    collectionId: CollectionId,
    status: string,
  ): Promise<Doc[]> {
    return this.queryHelper.findByCollectionIdAndStatus(collectionId, status as 'new' | 'processing' | 'completed' | 'failed');
  }

  async findDeleted(collectionId?: CollectionId): Promise<Doc[]> {
    return this.queryHelper.findDeleted(collectionId);
  }

  async findFailed(collectionId?: CollectionId): Promise<Doc[]> {
    return this.queryHelper.findFailed(collectionId);
  }

  async findCompleted(collectionId?: CollectionId): Promise<Doc[]> {
    return this.queryHelper.findCompleted(collectionId);
  }

  async findPaginated(
    page: number,
    limit: number,
    orderBy?: Record<string, 'ASC' | 'DESC'>,
  ): Promise<PaginationResult<Doc>> {
    return this.queryHelper.findPaginated(page, limit, orderBy);
  }

  async findByCollectionIdPaginatedWithSorting(
    collectionId: CollectionId,
    pagination: PaginationOptions,
    orderBy?: Record<string, 'ASC' | 'DESC'>,
  ): Promise<PaginationResult<Doc>> {
    return this.queryHelper.findByCollectionIdPaginatedWithSorting(
      collectionId,
      pagination,
      orderBy,
    );
  }
}
