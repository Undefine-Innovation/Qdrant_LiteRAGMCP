import type { FindOptionsWhere, FindManyOptions, DataSource } from 'typeorm';
import {
  BaseRepository,
  PaginationOptions,
  PaginatedResult,
} from './BaseRepository.js';
import { Chunk } from '../entities/Chunk.js';
import { Logger } from '@logging/logger.js';
import { DocId, CollectionId, PointId } from '@domain/entities/types.js';
import { DbSyncJobStatus } from '@domain/sync/SyncJobStatusMapper.js';

/**
 * 块查询功能
 * 提供各种块查询方法
 */
export class ChunkQueries extends BaseRepository<Chunk> {
  constructor(dataSource: DataSource, logger: Logger) {
    super(dataSource, Chunk, logger);
  }

  /**
   * 根据文档ID查找块
   * @param docId - 文档ID
   * @param options - 查询选项
   * @param options.status - 嵌入状态过滤
   * @param options.syncStatus - 同步状态过滤
   * @param options.limit - 结果数量限制
   * @param options.orderBy - 排序字段
   * @param options.includeContent - 是否包含内容字段
   * @returns 块数组
   */
  async findByDocId(
    docId: DocId,
    options: {
      status?: DbSyncJobStatus | string;
      syncStatus?: DbSyncJobStatus | string;
      limit?: number;
      orderBy?: Record<string, 'ASC' | 'DESC'>;
      includeContent?: boolean;
    } = {},
  ): Promise<Chunk[]> {
    try {
      const queryBuilder = this.createQueryBuilder('chunk').where(
        'chunk.docId = :docId',
        { docId },
      );

      if (options.status) {
        queryBuilder.andWhere('chunk.embeddingStatus = :status', {
          status: options.status,
        });
      }

      if (options.syncStatus) {
        queryBuilder.andWhere('chunk.syncStatus = :syncStatus', {
          syncStatus: options.syncStatus,
        });
      }

      if (options.orderBy) {
        Object.entries(options.orderBy).forEach(([field, direction]) => {
          queryBuilder.addOrderBy(`chunk.${field}`, direction);
        });
      } else {
        queryBuilder.addOrderBy('chunk.chunkIndex', 'ASC');
      }

      if (options.limit) {
        queryBuilder.limit(options.limit);
      }

      if (!options.includeContent) {
        queryBuilder.select([
          'chunk.id',
          'chunk.pointId',
          'chunk.docId',
          'chunk.collectionId',
          'chunk.chunkIndex',
          'chunk.title',
          'chunk.contentLength',
          'chunk.tokenCount',
          'chunk.embeddingStatus',
          'chunk.syncStatus',
          'chunk.embeddedAt',
          'chunk.syncedAt',
          'chunk.error',
          'chunk.metadata',
          'chunk.created_at',
          'chunk.updated_at',
        ]);
      }

      const results = await queryBuilder.getMany();
      return results;
    } catch (error) {
      this.logger.error(`根据文档ID查找块失败`, {
        docId,
        options,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据集合ID查找块
   * @param collectionId - 集合ID
   * @param options - 查询选项
   * @param options.status - 嵌入状态过滤
   * @param options.syncStatus - 同步状态过滤
   * @param options.limit - 结果数量限制
   * @param options.orderBy - 排序字段
   * @param options.includeContent - 是否包含内容字段
   * @returns 块数组
   */
  async findByCollectionId(
    collectionId: CollectionId,
    options: {
      status?: DbSyncJobStatus | string;
      syncStatus?: DbSyncJobStatus | string;
      limit?: number;
      orderBy?: Record<string, 'ASC' | 'DESC'>;
      includeContent?: boolean;
    } = {},
  ): Promise<Chunk[]> {
    try {
      const queryBuilder = this.createQueryBuilder('chunk').where(
        'chunk.collectionId = :collectionId',
        { collectionId },
      );

      if (options.status) {
        queryBuilder.andWhere('chunk.embeddingStatus = :status', {
          status: options.status,
        });
      }

      if (options.syncStatus) {
        queryBuilder.andWhere('chunk.syncStatus = :syncStatus', {
          syncStatus: options.syncStatus,
        });
      }

      if (options.orderBy) {
        Object.entries(options.orderBy).forEach(([field, direction]) => {
          queryBuilder.addOrderBy(`chunk.${field}`, direction);
        });
      } else {
        queryBuilder.addOrderBy('chunk.chunkIndex', 'ASC');
      }

      if (options.limit) {
        queryBuilder.limit(options.limit);
      }

      if (!options.includeContent) {
        queryBuilder.select([
          'chunk.id',
          'chunk.pointId',
          'chunk.docId',
          'chunk.collectionId',
          'chunk.chunkIndex',
          'chunk.title',
          'chunk.contentLength',
          'chunk.tokenCount',
          'chunk.embeddingStatus',
          'chunk.syncStatus',
          'chunk.embeddedAt',
          'chunk.syncedAt',
          'chunk.error',
          'chunk.metadata',
          'chunk.created_at',
          'chunk.updated_at',
        ]);
      }

      const results = await queryBuilder.getMany();
      return results;
    } catch (error) {
      this.logger.error(`根据集合ID查找块失败`, {
        collectionId,
        options,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据点ID数组查找块
   * @param pointIds - 点ID数组
   * @param options - 查询选项
   * @param options.includeContent - 是否包含内容字段
   * @param options.orderBy - 排序字段
   * @returns 块数组
   */
  async findByPointIds(
    pointIds: PointId[],
    options: {
      includeContent?: boolean;
      orderBy?: Record<string, 'ASC' | 'DESC'>;
    } = {},
  ): Promise<Chunk[]> {
    try {
      if (pointIds.length === 0) {
        return [];
      }

      const queryBuilder = this.createQueryBuilder('chunk').where(
        'chunk.pointId IN (:...pointIds)',
        { pointIds },
      );

      if (options.orderBy) {
        Object.entries(options.orderBy).forEach(([field, direction]) => {
          queryBuilder.addOrderBy(`chunk.${field}`, direction);
        });
      } else {
        queryBuilder.addOrderBy('chunk.chunkIndex', 'ASC');
      }

      if (!options.includeContent) {
        queryBuilder.select([
          'chunk.id',
          'chunk.pointId',
          'chunk.docId',
          'chunk.collectionId',
          'chunk.chunkIndex',
          'chunk.title',
          'chunk.contentLength',
          'chunk.tokenCount',
          'chunk.embeddingStatus',
          'chunk.syncStatus',
          'chunk.embeddedAt',
          'chunk.syncedAt',
          'chunk.error',
          'chunk.metadata',
          'chunk.created_at',
          'chunk.updated_at',
        ]);
      }

      const results = await queryBuilder.getMany();
      return results;
    } catch (error) {
      this.logger.error(`根据点ID数组查找块失败`, {
        pointIds,
        options,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据点ID查找单个块
   * @param pointId - 点ID
   * @param options - 查询选项
   * @param options.includeContent - 是否包含内容字段
   * @returns 块对象或null
   */
  async findByPointId(
    pointId: PointId,
    options: {
      includeContent?: boolean;
    } = {},
  ): Promise<Chunk | null> {
    try {
      const queryBuilder = this.createQueryBuilder('chunk').where(
        'chunk.pointId = :pointId',
        { pointId },
      );

      if (!options.includeContent) {
        queryBuilder.select([
          'chunk.id',
          'chunk.pointId',
          'chunk.docId',
          'chunk.collectionId',
          'chunk.chunkIndex',
          'chunk.title',
          'chunk.contentLength',
          'chunk.tokenCount',
          'chunk.embeddingStatus',
          'chunk.syncStatus',
          'chunk.embeddedAt',
          'chunk.syncedAt',
          'chunk.error',
          'chunk.metadata',
          'chunk.created_at',
          'chunk.updated_at',
        ]);
      }

      const result = await queryBuilder.getOne();
      return result || null;
    } catch (error) {
      this.logger.error(`根据点ID查找块失败`, {
        pointId,
        options,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 分页获取块
   * @param paginationOptions - 分页选项
   * @param docId - 文档ID过滤
   * @param collectionId - 集合ID过滤
   * @param options - 查询选项
   * @param options.status - 嵌入状态过滤
   * @param options.syncStatus - 同步状态过滤
   * @param options.includeContent - 是否包含内容字段
   * @returns 分页结果
   */
  async findWithPagination(
    paginationOptions: PaginationOptions = {},
    docId?: DocId,
    collectionId?: CollectionId,
    options: {
      status?: 'pending' | 'processing' | 'completed' | 'failed';
      syncStatus?: 'pending' | 'processing' | 'completed' | 'failed';
      includeContent?: boolean;
    } = {},
  ): Promise<PaginatedResult<Chunk>> {
    try {
      const queryBuilder = this.createQueryBuilder('chunk');

      if (docId) {
        queryBuilder.andWhere('chunk.docId = :docId', { docId });
      }

      if (collectionId) {
        queryBuilder.andWhere('chunk.collectionId = :collectionId', {
          collectionId,
        });
      }

      if (options.status) {
        queryBuilder.andWhere('chunk.embeddingStatus = :status', {
          status: options.status,
        });
      }

      if (options.syncStatus) {
        queryBuilder.andWhere('chunk.syncStatus = :syncStatus', {
          syncStatus: options.syncStatus,
        });
      }

      if (!options.includeContent) {
        queryBuilder.select([
          'chunk.id',
          'chunk.pointId',
          'chunk.docId',
          'chunk.collectionId',
          'chunk.chunkIndex',
          'chunk.title',
          'chunk.contentLength',
          'chunk.tokenCount',
          'chunk.embeddingStatus',
          'chunk.syncStatus',
          'chunk.embeddedAt',
          'chunk.syncedAt',
          'chunk.error',
          'chunk.metadata',
          'chunk.created_at',
          'chunk.updated_at',
        ]);
      }

      return await super.findWithPagination(paginationOptions, queryBuilder);
    } catch (error) {
      this.logger.error(`分页获取块失败`, {
        paginationOptions,
        docId,
        collectionId,
        options,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 搜索块内容
   * @param searchText - 搜索文本
   * @param options - 搜索选项
   * @param options.collectionId - 集合ID过滤
   * @param options.docId - 文档ID过滤
   * @param options.limit - 结果数量限制
   * @param options.searchFields - 搜索字段
   * @param options.includeContent - 是否包含内容字段
   * @returns 块数组
   */
  async searchContent(
    searchText: string,
    options: {
      collectionId?: CollectionId;
      docId?: DocId;
      limit?: number;
      searchFields?: string[];
      includeContent?: boolean;
    } = {},
  ): Promise<Chunk[]> {
    try {
      const queryBuilder = this.createQueryBuilder('chunk');

      if (options.collectionId) {
        queryBuilder.andWhere('chunk.collectionId = :collectionId', {
          collectionId: options.collectionId,
        });
      }

      if (options.docId) {
        queryBuilder.andWhere('chunk.docId = :docId', { docId: options.docId });
      }

      const searchFields = options.searchFields || ['content', 'title'];
      let firstField = true;

      for (const field of searchFields) {
        if (firstField) {
          queryBuilder.andWhere(`chunk.${field} ILIKE :searchText`, {
            searchText: `%${searchText}%`,
          });
          firstField = false;
        } else {
          queryBuilder.orWhere(`chunk.${field} ILIKE :searchText`, {
            searchText: `%${searchText}%`,
          });
        }
      }

      if (options.limit) {
        queryBuilder.limit(options.limit);
      }

      if (!options.includeContent) {
        queryBuilder.select([
          'chunk.id',
          'chunk.pointId',
          'chunk.docId',
          'chunk.collectionId',
          'chunk.chunkIndex',
          'chunk.title',
          'chunk.contentLength',
          'chunk.tokenCount',
          'chunk.embeddingStatus',
          'chunk.syncStatus',
          'chunk.embeddedAt',
          'chunk.syncedAt',
          'chunk.error',
          'chunk.metadata',
          'chunk.created_at',
          'chunk.updated_at',
        ]);
      }

      queryBuilder.addOrderBy('chunk.chunkIndex', 'ASC');

      const results = await queryBuilder.getMany();
      return results;
    } catch (error) {
      this.logger.error(`搜索块内容失败`, {
        searchText,
        options,
        error: (error as Error).message,
      });
      throw error;
    }
  }
}
