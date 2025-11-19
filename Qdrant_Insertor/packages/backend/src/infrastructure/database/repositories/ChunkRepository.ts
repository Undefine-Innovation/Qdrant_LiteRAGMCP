import type { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { DocId, CollectionId, PointId } from '@domain/entities/types.js';
import { DbSyncJobStatus } from '@domain/sync/SyncJobStatusMapper.js';
import { ChunkQueries } from './ChunkQueries.js';
import { ChunkBatchOperations } from './ChunkBatchOperations.js';
import { ChunkStatistics } from './ChunkStatistics.js';
import { ChunkTimeQueries } from './ChunkTimeQueries.js';
import { ChunkTransactionHelpers } from './ChunkTransactionHelpers.js';
import {
  BaseRepository,
  PaginationOptions,
  PaginationResult,
  BatchOperationResult,
} from './BaseRepository.js';
import { Chunk } from '../entities/Chunk.js';

/**
 * 块Repository
 * 提供块相关的数据库操作
 * 优化了查询性能和批量操作
 *
 * 此文件已重构为多个模块以提高可维护性：
 * - ChunkQueries: 基本查询功能
 * - ChunkBatchOperations: 批量操作功能
 * - ChunkStatistics: 统计功能
 * - ChunkTimeQueries: 时间范围查询功能
 * - ChunkTransactionHelpers: 事务管理辅助功能
 */
export class ChunkRepository extends BaseRepository<Chunk> {
  private queries: ChunkQueries;
  private batchOperations: ChunkBatchOperations;
  private statistics: ChunkStatistics;
  private timeQueries: ChunkTimeQueries;
  private transactionHelpers: ChunkTransactionHelpers;

  /**
   * 创建ChunkRepository实例
   * @param dataSource TypeORM数据源
   * @param logger 日志记录器
   */
  constructor(dataSource: DataSource, logger: Logger) {
    super(dataSource, Chunk, logger);
    this.queries = new ChunkQueries(dataSource, logger);
    this.batchOperations = new ChunkBatchOperations(dataSource, logger);
    this.statistics = new ChunkStatistics(dataSource, logger);
    this.timeQueries = new ChunkTimeQueries(dataSource, logger);
    this.transactionHelpers = new ChunkTransactionHelpers(dataSource, logger);
  }

  // 基本查询方法 - 委托给ChunkQueries
  async findByDocId(
    docId: DocId,
    options: Record<string, unknown> = {},
  ): Promise<Chunk[]> {
    return this.queries.findByDocId(docId, options);
  }

  async findByCollectionId(
    collectionId: CollectionId,
    options: Record<string, unknown> = {},
  ): Promise<Chunk[]> {
    return this.queries.findByCollectionId(collectionId, options);
  }

  async findByPointIds(
    pointIds: PointId[],
    options: Record<string, unknown> = {},
  ): Promise<Chunk[]> {
    return this.queries.findByPointIds(pointIds, options);
  }

  async findByPointId(
    pointId: PointId,
    options: Record<string, unknown> = {},
  ): Promise<Chunk | null> {
    return this.queries.findByPointId(pointId, options);
  }

  async findWithPagination(
    page: number,
    pageSize: number,
    options?: Record<string, unknown>,
  ): Promise<PaginationResult<Chunk>> {
    // 转换参数格式以匹配内部实现
    const paginationOptions: PaginationOptions = { page, pageSize };
    const docId = options?.docId as DocId | undefined;
    const collectionId = options?.collectionId as CollectionId | undefined;
    const queryOptions = { ...options };
    delete queryOptions.docId;
    delete queryOptions.collectionId;

    return this.queries.findWithPagination(
      paginationOptions,
      docId,
      collectionId,
      queryOptions,
    );
  }

  /**
   * 扩展的分页查询方法，支持更多参数
   * @param paginationOptions - 分页选项
   * @param docId - 文档ID过滤
   * @param collectionId - 集合ID过滤
   * @param options - 查询选项
   * @returns 分页结果
   */
  async findWithPaginationExtended(
    paginationOptions: PaginationOptions,
    docId?: DocId,
    collectionId?: CollectionId,
    options: Record<string, unknown> = {},
  ): Promise<PaginationResult<Chunk>> {
    return this.queries.findWithPagination(
      paginationOptions,
      docId,
      collectionId,
      options,
    );
  }

  async searchContent(
    searchText: string,
    options: Record<string, unknown> = {},
  ): Promise<Chunk[]> {
    return this.queries.searchContent(searchText, options);
  }

  // 批量操作方法 - 委托给ChunkBatchOperations
  async createBatch(
    chunks: Partial<Chunk>[],
    batchSize: number = 100,
  ): Promise<Chunk[]> {
    return this.batchOperations.createBatchWithConfig(chunks, { batchSize });
  }

  async deleteByDocId(docId: DocId): Promise<number> {
    return this.batchOperations.deleteByDocId(docId);
  }

  async deleteByCollectionId(collectionId: CollectionId): Promise<number> {
    return this.batchOperations.deleteByCollectionId(collectionId);
  }

  async deleteByPointIds(
    pointIds: PointId[],
    batchSize: number = 100,
  ): Promise<number> {
    return this.batchOperations.deleteByPointIds(pointIds, batchSize);
  }

  async batchUpdateStatus(
    pointIds: PointId[],
    status: DbSyncJobStatus | string,
  ): Promise<BatchOperationResult> {
    return this.batchOperations.batchUpdateStatus(pointIds, status);
  }

  async batchUpdateSyncStatus(
    pointIds: PointId[],
    syncStatus: DbSyncJobStatus | string,
  ): Promise<BatchOperationResult> {
    return this.batchOperations.batchUpdateSyncStatus(pointIds, syncStatus);
  }

  // 统计方法 - 委托给ChunkStatistics
  async getCount(
    docId?: DocId,
    collectionId?: CollectionId,
    options: Record<string, unknown> = {},
  ): Promise<number> {
    return this.statistics.getCount(docId, collectionId, options);
  }

  async countByDocId(
    docId: DocId,
    options: Record<string, unknown> = {},
  ): Promise<number> {
    return this.statistics.countByDocId(docId, options);
  }

  async countCompletedByDocId(docId: DocId): Promise<number> {
    return this.statistics.countCompletedByDocId(docId);
  }

  async countFailedByDocId(docId: DocId): Promise<number> {
    return this.statistics.countFailedByDocId(docId);
  }

  async getStatistics(
    groupBy: string,
    where?: Record<string, unknown>,
  ): Promise<Record<string, number>> {
    // TypeORM query builder requires explicit casting for complex where conditions
    const result = await this.statistics.getStatistics(
      groupBy,
      where as Record<string, unknown>,
    );
    return result as Record<string, number>;
  }

  // 时间范围查询方法 - 委托给ChunkTimeQueries
  async findByTimeRange(
    startTime: number,
    endTime: number,
    options?: Record<string, unknown>,
  ): Promise<Chunk[]> {
    return this.timeQueries.findByTimeRange(startTime, endTime, options);
  }

  // 事务管理方法 - 委托给ChunkTransactionHelpers
  async createBatchWithManager(
    chunks: Partial<Chunk>[],
    manager: { save: (entities: unknown[]) => Promise<unknown> },
    _batchSize?: number,
  ): Promise<Chunk[]> {
    return this.transactionHelpers.createBatchWithManager(chunks, manager);
  }

  async deleteByDocIdWithManager(
    docId: DocId,
    manager: {
      delete: (
        entity: unknown,
        where: unknown,
      ) => Promise<{ affected?: number }>;
    },
  ): Promise<number> {
    return this.transactionHelpers.deleteByDocIdWithManager(docId, manager);
  }
}
