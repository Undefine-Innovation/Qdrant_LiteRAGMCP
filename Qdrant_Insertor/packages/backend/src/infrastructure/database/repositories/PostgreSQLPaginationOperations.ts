import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { DocRepository, ChunkRepository } from './index.js';
import {
  DocId,
  CollectionId,
  PaginationQuery,
  PaginatedResponse,
} from '@domain/entities/types.js';

/**
 * PostgreSQL分页操作管理器
 * 负责分页查询相关操作
 */
export class PostgreSQLPaginationOperations {
  private readonly docRepository: DocRepository;
  private readonly chunkRepository: ChunkRepository;

  /**
   * 创建PostgreSQLPaginationOperations实例
   * @param dataSource TypeORM数据源
   * @param logger 日志记录器
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: Logger,
  ) {
    this.docRepository = new DocRepository(dataSource, logger);
    this.chunkRepository = new ChunkRepository(dataSource, logger);
  }

  /**
   * 分页获取文档
   * @param collectionId 集合ID
   * @param query 分页查询参数
   * @returns 分页结果
   */
  async getDocsPaginated(
    collectionId: CollectionId,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    try {
      const { page = 1, limit = 20, sort, order } = query;
      const skip = (page - 1) * limit;

      const [docs, total] = await Promise.all([
        this.docRepository.findByCollectionId(collectionId) as unknown as Promise<Array<Record<string, unknown>>>,
        this.docRepository.countByCollectionId(collectionId),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: (docs as Array<Record<string, unknown>>).slice(skip, skip + limit),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      this.logger.error(`分页获取文档失败`, {
        collectionId,
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 分页获取文档块
   * @param docId 文档ID
   * @param query 分页查询参数
   * @returns 分页结果
   */
  async getChunksPaginated(
    docId: DocId,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    try {
      const { page = 1, limit = 20, sort, order } = query;
      const skip = (page - 1) * limit;

      const [chunks, total] = await Promise.all([
        this.chunkRepository.findByDocId(docId) as unknown as Promise<Array<Record<string, unknown>>>,
        this.chunkRepository.countByDocId(docId),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: (chunks as Array<Record<string, unknown>>).slice(skip, skip + limit),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      this.logger.error(`分页获取文档块失败`, {
        docId,
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
