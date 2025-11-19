import { Logger } from '@logging/logger.js';
import { TypeORMRepositoryDocuments } from './TypeORMRepositoryDocuments.js';
import {
  PointId,
  CollectionId,
  DocId,
  SearchResult,
  ChunkMeta as ChunkMetaType,
  PaginationQuery,
  PaginatedResponse,
} from '@domain/entities/types.js';

/**
 * TypeORM Repository 块相关操作方法
 */
export class TypeORMRepositoryChunks extends TypeORMRepositoryDocuments {
  /**
   * 检索块通过ID列表的详细信息
   * @param pointIds 点ID数组
   * @param collectionId 集合ID
   * @returns 搜索结果数组
   */
  getChunksByPointIds(
    pointIds: PointId[],
    collectionId: CollectionId,
  ): SearchResult[] {
    // 为了保持接口兼容性，这里返回空数组
    // 实际使用应该调用异步版本
    this.logger.warn(
      `getChunksByPointIds是同步方法，请使用asyncGetChunksByPointIds`,
    );
    return [];
  }

  /**
   * 异步版本的getChunksByPointIds
   * @param pointIds 点ID数组
   * @param collectionId 集合ID
   * @returns 搜索结果数组
   */
  async asyncGetChunksByPointIds(
    pointIds: PointId[],
    collectionId: CollectionId,
  ): Promise<SearchResult[]> {
    try {
      const chunks = await this.chunkRepository.findByPointIds(pointIds);

      // 转换为SearchResult格式
      return chunks.map((chunk) => ({
        pointId: chunk.pointId as PointId,
        docId: chunk.docId as DocId,
        collectionId: chunk.collectionId as CollectionId,
        chunkIndex: chunk.chunkIndex,
        title: chunk.title,
        content: chunk.content,
        score: 0, // TypeORM不直接支持FTS评分，设为默认值
      }));
    } catch (error) {
      this.logger.error(`获取块详细信息失败`, {
        pointIds,
        collectionId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 获取文档的块列表
   * @param docId 文档ID
   * @returns 文档块数组
   */
  getDocumentChunks(docId: DocId): Array<{
    pointId: PointId;
    docId: DocId;
    collectionId: CollectionId;
    chunkIndex: number;
    title?: string;
    content: string;
  }> {
    // 为了保持接口兼容性，这里返回空数组
    // 实际使用应该调用异步版本
    this.logger.warn(
      `getDocumentChunks是同步方法，请使用asyncGetDocumentChunks`,
    );
    return [];
  }

  /**
   * 异步版本的getDocumentChunks
   * @param docId 文档ID
   * @returns 文档块数组
   */
  async asyncGetDocumentChunks(docId: DocId): Promise<
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
        content: chunk.content,
      }));
    } catch (error) {
      this.logger.error(`获取文档块列表失败`, {
        docId,
        error: (error as Error).message,
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
  getDocumentChunksPaginated(
    docId: DocId,
    query: PaginationQuery,
  ): PaginatedResponse<{
    pointId: PointId;
    docId: DocId;
    collectionId: CollectionId;
    chunkIndex: number;
    title?: string;
    content: string;
  }> {
    // 为了保持接口兼容性，这里返回空结果
    // 实际使用应该调用异步版本
    this.logger.warn(
      `getDocumentChunksPaginated是同步方法，请使用asyncGetDocumentChunksPaginated`,
    );
    return {
      data: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    };
  }

  /**
   * 异步版本的getDocumentChunksPaginated
   * @param docId 文档ID
   * @param query 分页查询参数
   * @returns 分页的文档块响应
   */
  async asyncGetDocumentChunksPaginated(
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
      const chunks = await this.chunkRepository.findByDocId(docId);

      // 手动实现分页逻辑
      const { page = 1, limit = 10 } = query;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedChunks = chunks.slice(startIndex, endIndex);

      const totalPages = Math.ceil(chunks.length / limit);

      return {
        data: paginatedChunks.map((chunk) => ({
          pointId: chunk.pointId as PointId,
          docId: chunk.docId as DocId,
          collectionId: chunk.collectionId as CollectionId,
          chunkIndex: chunk.chunkIndex,
          title: chunk.title,
          content: chunk.content,
        })),
        pagination: {
          page,
          limit,
          total: chunks.length,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      this.logger.error(`分页获取文档块列表失败`, {
        docId,
        query,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 获取文档的块元数据
   * @param docId 文档ID
   * @returns 块元数据数组
   */
  async getChunkMetasByDocId(docId: DocId): Promise<ChunkMetaType[]> {
    try {
      const chunkMetas = await this.chunkMetaRepository.findByDocId(docId);

      // 转换为领域类型
      return chunkMetas.map(
        (meta) =>
          ({
            id: meta.id as DocId,
            docId: meta.docId as DocId,
            chunkIndex: meta.chunkIndex,
            tokenCount: meta.tokenCount,
            embeddingStatus: meta.embeddingStatus as
              | 'pending'
              | 'processing'
              | 'completed'
              | 'failed',
            syncedAt: meta.syncedAt,
            error: meta.error,
            created_at: meta.created_at,
            updated_at: meta.updated_at,
            pointId: meta.pointId as PointId,
            collectionId: meta.collectionId as CollectionId,
          }) as ChunkMetaType,
      );
    } catch (error) {
      this.logger.error(`获取文档块元数据失败`, {
        docId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 获取集合的块元数据
   * @param collectionId 集合ID
   * @returns 块元数据数组
   */
  async getChunkMetasByCollectionId(
    collectionId: CollectionId,
  ): Promise<ChunkMetaType[]> {
    try {
      const chunkMetas =
        await this.chunkMetaRepository.findByCollectionId(collectionId);

      // 转换为领域类型
      return chunkMetas.map(
        (meta) =>
          ({
            id: meta.id as DocId,
            docId: meta.docId as DocId,
            chunkIndex: meta.chunkIndex,
            tokenCount: meta.tokenCount,
            embeddingStatus: meta.embeddingStatus as
              | 'pending'
              | 'processing'
              | 'completed'
              | 'failed',
            syncedAt: meta.syncedAt,
            error: meta.error,
            created_at: meta.created_at,
            updated_at: meta.updated_at,
            pointId: meta.pointId as PointId,
            collectionId: meta.collectionId as CollectionId,
          }) as ChunkMetaType,
      );
    } catch (error) {
      this.logger.error(`获取集合块元数据失败`, {
        collectionId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 检索块通过ID列表的文本内容
   * @param pointIds 点ID数组
   * @returns 一个记录，将每个pointId映射到其内容和标题
   */
  async getChunkTexts(
    pointIds: PointId[],
  ): Promise<Record<string, { content: string }>> {
    try {
      const chunks = await this.chunkRepository.findByPointIds(pointIds);

      const result: Record<string, { content: string }> = {};
      for (const chunk of chunks) {
        result[String(chunk.pointId)] = {
          content: chunk.content,
        };
      }

      return result;
    } catch (error) {
      this.logger.error(`获取块文本内容失败`, {
        pointIds,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 批量删除块元数据
   * @param pointIds 要删除的点ID数组
   * @returns 无返回值，删除成功或抛出错误
   */
  async deleteBatch(pointIds: PointId[]): Promise<void> {
    try {
      await this.chunkRepository.deleteByPointIds(pointIds);
      this.logger.debug(`批量删除块成功`, {
        count: pointIds.length,
      });
    } catch (error) {
      this.logger.error(`批量删除块失败`, {
        pointIds,
        error: (error as Error).message,
      });
      throw error;
    }
  }
}