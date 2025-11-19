import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { ChunkRepository } from './index.js';
import {
  PointId,
  SearchResult,
  DocId,
  CollectionId,
  PaginationQuery,
  PaginatedResponse,
} from '@domain/entities/types.js';

/**
 * PostgreSQL高级操作管理器
 * 负责高级查询和复杂操作
 */
export class PostgreSQLAdvancedOperations {
  private readonly chunkRepository: ChunkRepository;

  /**
   * 创建PostgreSQLAdvancedOperations实例
   * @param dataSource TypeORM数据源
   * @param logger 日志记录器
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: Logger,
  ) {
    this.chunkRepository = new ChunkRepository(dataSource, logger);
  }

  /**
   * 根据点ID获取块列表
   * @param pointIds 点ID数组
   * @param collectionId 集合ID
   * @returns 搜索结果数组
   */
  async getChunksByPointIds(
    pointIds: PointId[],
    collectionId: CollectionId,
  ): Promise<SearchResult[]> {
    try {
      const chunks = await this.chunkRepository.findByPointIds(pointIds);

      return chunks.map((chunk) => ({
        id: chunk.id as string,
        pointId: chunk.pointId as PointId,
        docId: chunk.docId as DocId,
        collectionId: chunk.collectionId as CollectionId,
        chunkIndex: chunk.chunkIndex,
        title: chunk.title,
        content: chunk.content || '',
        score: 1.0, // 默认分数
      }));
    } catch (error) {
      this.logger.error(`根据点ID获取块列表失败`, {
        pointIds,
        collectionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 获取文档的块列表
   * @param docId 文档ID
   * @returns 文档块数组
   */
  async getDocumentChunks(docId: DocId): Promise<
    Array<{
      pointId: PointId;
      docId: DocId;
      collectionId: CollectionId;
      chunkIndex: number;
      title?: string;
      content: string;
    }>
  > {
    try {
      const chunks = await this.chunkRepository.findByDocId(docId);

      return chunks.map((chunk) => ({
        pointId: chunk.pointId as PointId,
        docId: chunk.docId as DocId,
        collectionId: chunk.collectionId as CollectionId,
        chunkIndex: chunk.chunkIndex,
        title: chunk.title,
        content: chunk.content || '',
      }));
    } catch (error) {
      this.logger.error(`获取文档的块列表失败`, {
        docId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 分页获取文档的块列表
   * @param docId 文档ID
   * @param query 分页查询参数
   * @returns 分页的文档块响应
   */
  async getDocumentChunksPaginated(
    docId: DocId,
    query: PaginationQuery,
  ): Promise<
    PaginatedResponse<{
      pointId: PointId;
      docId: DocId;
      collectionId: CollectionId;
      chunkIndex: number;
      title?: string;
      content: string;
    }>
  > {
    try {
      const { page = 1, limit = 20 } = query;
      const skip = (page - 1) * limit;

      const [chunks, total] = await Promise.all([
        this.chunkRepository.findByDocId(docId),
        this.chunkRepository.countByDocId(docId),
      ]);

      const totalPages = Math.ceil(total / limit);
      const paginatedChunks = chunks.slice(skip, skip + limit);

      return {
        data: paginatedChunks.map((chunk) => ({
          pointId: chunk.pointId as PointId,
          docId: chunk.docId as DocId,
          collectionId: chunk.collectionId as CollectionId,
          chunkIndex: chunk.chunkIndex,
          title: chunk.title,
          content: chunk.content || '',
        })),
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
      this.logger.error(`分页获取文档的块列表失败`, {
        docId,
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 检索块通过ID列表的文本内容
   * @param pointIds 点ID数组
   * @returns 块文本内容映射
   */
  async getChunkTexts(
    pointIds: PointId[],
  ): Promise<Record<string, { content: string }>> {
    try {
      const chunks = await this.chunkRepository.findByPointIds(pointIds);

      const result: Record<string, { content: string }> = {};
      chunks.forEach((chunk) => {
        result[chunk.pointId] = {
          content: chunk.content || '',
        };
      });

      return result;
    } catch (error) {
      this.logger.error(`检索块文本内容失败`, {
        pointIds,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
