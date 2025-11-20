/**
 * 文档聚合仓储（重构后）
 * 基于TypeORM实现文档聚合的持久化操作
 */

import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import {
  DocId,
  CollectionId,
  PaginationQuery,
  PaginatedResponse,
} from '@domain/entities/types.js';
import { DocumentAggregate } from '@domain/aggregates/index.js';
import { IDocumentAggregateRepository } from '@domain/repositories/IAggregateRepository.js';

// 导入拆分后的模块
import { DocumentAggregateQueries } from './DocumentAggregateQueries.js';
import { DocumentAggregateOperations } from './DocumentAggregateOperations.js';

/**
 * 文档聚合仓储（重构后）
 * 基于TypeORM实现文档聚合的持久化操作
 */
export class DocumentAggregateRepository
  extends DocumentAggregateOperations
  implements IDocumentAggregateRepository
{
  private readonly queries: DocumentAggregateQueries;

  /**
   * 构造函数
   * @param dataSource TypeORM数据源
   * @param logger 日志记录器
   */
  constructor(dataSource: DataSource, logger: Logger) {
    const docRepository = new (require('./DocRepository.js').DocRepository)(dataSource, logger);
    const chunkRepository = new (require('./ChunkRepository.js').ChunkRepository)(dataSource, logger);
    super(dataSource, logger, docRepository, chunkRepository);
    this.queries = new DocumentAggregateQueries(dataSource, logger, docRepository, chunkRepository);
  }

  // 继承所有查询方法
  async findById(id: DocId): Promise<DocumentAggregate | null> {
    return this.queries.findById(id);
  }

  async findByCollectionAndKey(
    collectionId: CollectionId,
    key: string,
  ): Promise<DocumentAggregate | null> {
    return this.queries.findByCollectionAndKey(collectionId, key);
  }

  async findByCollectionId(
    collectionId: CollectionId,
  ): Promise<DocumentAggregate[]> {
    return this.queries.findByCollectionId(collectionId);
  }

  async findByCollectionIdPaginated(
    collectionId: CollectionId,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<DocumentAggregate>> {
    return this.queries.findByCollectionIdPaginated(collectionId, query);
  }

  async findByStatus(status: string): Promise<DocumentAggregate[]> {
    return this.queries.findByStatus(status);
  }

  async findByCollectionIdAndStatus(
    collectionId: CollectionId,
    status: string,
  ): Promise<DocumentAggregate[]> {
    return this.queries.findByCollectionIdAndStatus(collectionId, status);
  }

  async findProcessable(
    collectionId?: CollectionId,
    limit?: number,
  ): Promise<DocumentAggregate[]> {
    return this.queries.findProcessable(collectionId, limit);
  }

  async findDeleted(collectionId?: CollectionId): Promise<DocumentAggregate[]> {
    return this.queries.findDeleted(collectionId);
  }

  async findFailed(collectionId?: CollectionId): Promise<DocumentAggregate[]> {
    return this.queries.findFailed(collectionId);
  }

  async findCompleted(
    collectionId?: CollectionId,
  ): Promise<DocumentAggregate[]> {
    return this.queries.findCompleted(collectionId);
  }

  async findPaginated(
    query: PaginationQuery,
  ): Promise<PaginatedResponse<DocumentAggregate>> {
    return this.queries.findPaginated(query);
  }

  async existsByCollectionAndKey(
    collectionId: CollectionId,
    key: string,
    excludeId?: DocId,
  ): Promise<boolean> {
    return this.queries.existsByCollectionAndKey(collectionId, key, excludeId);
  }

  async getChunkCount(id: DocId): Promise<number> {
    return this.queries.getChunkCount(id);
  }

  async getCompletedChunkCount(id: DocId): Promise<number> {
    return this.queries.getCompletedChunkCount(id);
  }

  async getFailedChunkCount(id: DocId): Promise<number> {
    return this.queries.getFailedChunkCount(id);
  }

  // 继承所有操作方法
  async save(aggregate: DocumentAggregate): Promise<void> {
    return super.save(aggregate);
  }

  async delete(id: DocId): Promise<boolean> {
    return super.delete(id);
  }

  async softDelete(id: DocId): Promise<boolean> {
    return super.softDelete(id);
  }

  async restore(id: DocId): Promise<boolean> {
    return super.restore(id);
  }

  async canBeDeleted(id: DocId): Promise<boolean> {
    return super.canBeDeleted(id);
  }

  async batchUpdateStatus(ids: DocId[], status: string): Promise<number> {
    return super.batchUpdateStatus(ids, status);
  }

  validateAggregate(aggregate: DocumentAggregate): {
    valid: boolean;
    errors: string[];
  } {
    return super.validateAggregate(aggregate);
  }

  createAggregate(
    id: DocId,
    collectionId: CollectionId,
    key: string,
    name: string,
    content: string,
    sizeBytes: number,
    mime: string,
  ): DocumentAggregate {
    return super.createAggregate(
      id,
      collectionId,
      key,
      name,
      content,
      sizeBytes,
      mime,
    );
  }

  getAggregateStats(aggregate: DocumentAggregate): {
    totalChunks: number;
    totalSize: number;
    averageChunkSize: number;
    hasContent: boolean;
  } {
    return super.getAggregateStats(aggregate);
  }
}

// 重新导出所有相关类和接口
export { DocumentAggregateCore } from './DocumentAggregateCore.js';
export { DocumentAggregateQueries } from './DocumentAggregateQueries.js';
export { DocumentAggregateOperations } from './DocumentAggregateOperations.js';
