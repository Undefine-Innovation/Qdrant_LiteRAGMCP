import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { DocRepository } from './index.js';
import {
  DocId,
  CollectionId,
  PointId,
  SearchResult,
  ChunkMeta,
  DocumentChunk,
  PaginatedResponse,
  PaginationQuery,
} from '@domain/entities/types.js';

/**
 * PostgreSQL文档操作管理器
 * 负责文档相关的CRUD操作
 */
export class PostgreSQLDocumentOperations {
  private readonly docRepository: DocRepository;

  /**
   * 创建PostgreSQLDocumentOperations实例
   * @param dataSource TypeORM数据源
   * @param logger 日志记录器
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: Logger,
  ) {
    this.docRepository = new DocRepository(dataSource, logger);
  }

  /**
   * 创建文档
   * @param collectionId 集合ID
   * @param key 文档键
   * @param name 文档名称
   * @param content 文档内容
   * @param sizeBytes 文档大小（字节）
   * @param mime MIME类型
   * @returns 创建的文档ID
   */
  async createDoc(
    collectionId: CollectionId,
    key: string,
    name: string,
    content: string,
    sizeBytes: number,
    mime?: string,
  ): Promise<DocId> {
    try {
      const doc = await this.docRepository.create({
        collectionId,
        key,
        name,
        content,
        size_bytes: sizeBytes,
        mime,
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      this.logger.info(`创建文档成功`, { docId: doc.id, key, collectionId });

      return doc.id as DocId;
    } catch (error) {
      this.logger.error(`创建文档失败`, {
        key,
        collectionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 获取文档
   * @param id 文档ID
   * @returns 文档对象或null
   */
  async getDoc(id: DocId): Promise<Record<string, unknown> | null> {
    try {
      const doc = await this.docRepository.findById(id);
      return doc;
    } catch (error) {
      this.logger.error(`获取文档失败`, {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 根据集合ID和键值获取文档
   * @param collectionId 集合ID
   * @param key 文档键值
   * @returns 文档对象或null
   */
  async getDocByCollectionAndKey(
    collectionId: CollectionId,
    key: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      const doc = await this.docRepository.findByCollectionAndKey(
        collectionId,
        key,
      );
      return doc as Record<string, unknown> | null;
    } catch (error) {
      this.logger.error(`根据集合和键值获取文档失败`, {
        collectionId,
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 根据集合ID获取文档列表
   * @param collectionId 集合ID
   * @returns 文档数组
   */
  async getDocsByCollectionId(collectionId: CollectionId): Promise<Record<string, unknown>[]> {
    try {
      const docs = await this.docRepository.findByCollectionId(collectionId);
      return docs;
    } catch (error) {
      this.logger.error(`根据集合ID获取文档列表失败`, {
        collectionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 更新文档
   * @param id 文档ID
   * @param updates 更新数据
   * @returns 更新结果
   */
  async updateDoc(id: DocId, updates: Partial<Record<string, unknown>>): Promise<Record<string, unknown>> {
    try {
      const doc = await this.docRepository.update(
        { id } as Record<string, unknown>,
        {
          ...updates,
          updated_at: Date.now(),
        },
      );

      this.logger.info(`更新文档成功`, { docId: id });

      return doc;
    } catch (error) {
      this.logger.error(`更新文档失败`, {
        id,
        updates,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 删除文档
   * @param id 文档ID
   * @returns 删除结果
   */
  async deleteDoc(id: DocId): Promise<boolean> {
    try {
      await this.docRepository.delete({ id } as Record<string, unknown>);
      this.logger.info(`删除文档成功`, { docId: id });
      return true;
    } catch (error) {
      this.logger.error(`删除文档失败`, {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // --- Additional methods expected by higher-level adapters ---
  async deleteCollection(collectionId: CollectionId): Promise<void> {
    try {
      // Basic implementation: delete docs belonging to collection
      await this.docRepository.delete({ collectionId } as Record<string, unknown>);
    } catch (error) {
      this.logger.error(`删除集合失败`, {
        collectionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getChunksByPointIds(
    pointIds: PointId[],
    collectionId: CollectionId,
  ): Promise<SearchResult[]> {
    // Minimal stub: return empty array (implementation can be extended)
    this.logger.debug('getChunksByPointIds called (stub)', {
      pointIds,
      collectionId,
    });
    return [];
  }

  async getDocumentChunks(docId: DocId): Promise<Record<string, unknown>[]> {
    this.logger.debug('getDocumentChunks called (stub)', { docId });
    return [];
  }

  async getDocumentChunksPaginated(
    docId: DocId,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    this.logger.debug('getDocumentChunksPaginated called (stub)', {
      docId,
      query,
    });
    return {
      data: [],
      pagination: {
        page: 1,
        limit: 0,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    };
  }

  async getChunkMetasByDocId(docId: DocId): Promise<ChunkMeta[]> {
    this.logger.debug('getChunkMetasByDocId called (stub)', { docId });
    return [];
  }

  async getChunkMetasByCollectionId(
    collectionId: CollectionId,
  ): Promise<ChunkMeta[]> {
    this.logger.debug('getChunkMetasByCollectionId called (stub)', {
      collectionId,
    });
    return [];
  }

  async getChunkTexts(
    pointIds: PointId[],
  ): Promise<Record<string, { content: string }>> {
    this.logger.debug('getChunkTexts called (stub)', { pointIds });
    return {};
  }

  async addChunks(
    docId: DocId,
    documentChunks: DocumentChunk[],
  ): Promise<void> {
    this.logger.debug('addChunks called (stub)', {
      docId,
      count: documentChunks.length,
    });
    return;
  }

  async markDocAsSynced(docId: DocId): Promise<void> {
    this.logger.debug('markDocAsSynced called (stub)', { docId });
    return;
  }

  async getAllCollectionIds(): Promise<CollectionId[]> {
    this.logger.debug('getAllCollectionIds called (stub)');
    return [];
  }

  async listDeletedDocs(): Promise<Record<string, unknown>[]> {
    this.logger.debug('listDeletedDocs called (stub)');
    return [];
  }

  async hardDelete(docId: DocId): Promise<void> {
    this.logger.debug('hardDelete called (stub)', { docId });
    return;
  }

  async deleteBatch(pointIds: PointId[]): Promise<void> {
    this.logger.debug('deleteBatch called (stub)', { pointIds });
    return;
  }
}
