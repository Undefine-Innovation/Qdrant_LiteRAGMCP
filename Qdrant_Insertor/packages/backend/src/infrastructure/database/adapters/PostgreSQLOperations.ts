import { Logger } from '@logging/logger.js';
import {
  CollectionId,
  DocId,
  PointId,
  SearchResult,
  DocumentChunk,
  ChunkMeta as ChunkMetaType,
  PaginationQuery,
  PaginatedResponse,
  Doc as DomainDoc,
} from '@domain/entities/types.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';
import { DatabaseMigration } from '@domain/interfaces/IDatabaseRepository.js';

/**
 * PostgreSQL操作处理器
 * 负责PostgreSQL特定的数据库操作
 */
export class PostgreSQLOperations {
  constructor(
    private readonly qdrantRepo: IQdrantRepo | undefined,
    private readonly logger: Logger,
    private readonly query: (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>,
    private readonly transaction: (
      callback: () => Promise<void | boolean>,
    ) => Promise<void | boolean>,
  ) {}

  /**
   * 删除一个集合及其所有关联的文档和块
   * @param collectionId 要删除的集合ID
   */
  async deleteCollection(collectionId: CollectionId): Promise<void> {
    await this.transaction(async () => {
      // 删除关联的块（使用PostgreSQL的级联删除）
      await this.query('DELETE FROM chunks WHERE collection_id = $1', [
        collectionId,
      ]);

      // 删除关联的文档
      await this.query('DELETE FROM docs WHERE collection_id = $1', [
        collectionId,
      ]);

      // 删除集合
      await this.query('DELETE FROM collections WHERE id = $1', [collectionId]);

      // 从Qdrant删除向量数据
      if (this.qdrantRepo) {
        await this.qdrantRepo.deletePointsByCollection(collectionId);
      }

      this.logger.info(`删除集合成功`, { collectionId });
    });
  }

  /**
   * 删除一个文档及其所有关联的块
   * @param docId 要删除的文档ID
   * @returns 如果找到并删除了文档，则返回true，否则返回false
   */
  async deleteDoc(docId: DocId): Promise<boolean> {
    return (await this.transaction(async () => {
      // 删除关联的块
      await this.query('DELETE FROM chunks WHERE doc_id = $1', [docId]);

      // 删除文档
      const result = await this.query(
        'DELETE FROM docs WHERE id = $1 RETURNING id',
        [docId],
      );

      const success = result.length > 0;

      if (success) {
        // 从Qdrant删除向量数据
        if (this.qdrantRepo) {
          await this.qdrantRepo.deletePointsByDoc(docId);
        }

        this.logger.info(`删除文档成功`, { docId });
      }

      return success;
    })) as boolean;
  }

  /**
   * 检索块通过ID列表的详细信息
   * @param pointIds 点ID数组
   * @param collectionId 集合ID
   * @returns 搜索结果数组
   */
  async getChunksByPointIds(
    pointIds: PointId[],
    collectionId: CollectionId,
  ): Promise<SearchResult[]> {
    try {
      // 使用PostgreSQL的ANY和数组操作优化查询
      const chunks = await this.query(
        `SELECT 
          c.point_id, 
          c.doc_id, 
          c.collection_id, 
          c.chunk_index, 
          c.title, 
          c.content,
          ts_rank_cd(to_tsvector('english', c.content), plainto_tsquery('english', $1)) as score
        FROM chunks c 
        WHERE c.point_id = ANY($2) AND c.collection_id = $3
        ORDER BY c.chunk_index`,
        ['', pointIds, collectionId],
      );

      return chunks.map((chunk: Record<string, unknown>) => {
        const c = chunk;
        return {
          pointId: c['point_id'] as PointId,
          docId: c['doc_id'] as DocId,
          collectionId: c['collection_id'] as CollectionId,
          chunkIndex: Number(c['chunk_index']),
          title: String(c['title'] ?? ''),
          content: String(c['content'] ?? ''),
          score: parseFloat(String(c['score'] ?? '0')) || 0,
        } as SearchResult;
      });
    } catch (error) {
      this.logger.error(`获取块详细信息失败`, {
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
      const chunks = await this.query(
        `SELECT 
          point_id, 
          doc_id, 
          collection_id, 
          chunk_index, 
          title, 
          content
        FROM chunks 
        WHERE doc_id = $1 
        ORDER BY chunk_index`,
        [docId],
      );

      return chunks.map((chunk: Record<string, unknown>) => {
        const c = chunk;
        return {
          pointId: c['point_id'] as PointId,
          docId: c['doc_id'] as DocId,
          collectionId: c['collection_id'] as CollectionId,
          chunkIndex: Number(c['chunk_index']),
          title: String(c['title'] ?? ''),
          content: String(c['content'] ?? ''),
        };
      });
    } catch (error) {
      this.logger.error(`获取文档块列表失败`, {
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
      const { page = 1, limit = 10 } = query;
      const offset = (page - 1) * limit;

      const [chunks, totalResult] = await Promise.all([
        this.query(
          `SELECT 
            point_id, 
            doc_id, 
            collection_id, 
            chunk_index, 
            title, 
            content
          FROM chunks 
          WHERE doc_id = $1 
          ORDER BY chunk_index
          LIMIT $2 OFFSET $3`,
          [docId, limit, offset],
        ),
        this.query('SELECT COUNT(*) as count FROM chunks WHERE doc_id = $1', [
          docId,
        ]),
      ]);
      const total = parseInt(String(totalResult[0]?.['count'] ?? '0'));
      const totalPages = Math.ceil(total / limit);

      return {
        data: chunks.map((chunk: Record<string, unknown>) => {
          const c = chunk;
          return {
            pointId: c['point_id'] as PointId,
            docId: c['doc_id'] as DocId,
            collectionId: c['collection_id'] as CollectionId,
            chunkIndex: Number(c['chunk_index']),
            title: String(c['title'] ?? ''),
            content: String(c['content'] ?? ''),
          };
        }),
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
      this.logger.error(`分页获取文档块列表失败`, {
        docId,
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 获取文档
   * @param docId 文档ID
   * @returns 文档对象
   */
  async getDoc(docId: DocId): Promise<DomainDoc | undefined> {
    try {
      const result = await this.query(
        `SELECT 
          id, 
          key, 
          collection_id, 
          name, 
          size_bytes, 
          mime, 
          created_at, 
          updated_at, 
          deleted, 
          content
        FROM docs 
        WHERE id = $1`,
        [docId],
      );

      if (result.length === 0) {
        return undefined;
      }

      const doc = result[0] as Record<string, unknown>;
      return {
        id: doc['id'] as DocId,
        docId: doc['key'] as DocId,
        collectionId: doc['collection_id'] as CollectionId,
        key: doc['key'] as string,
        name: doc['name'] as string,
        size_bytes: doc['size_bytes'] as number,
        mime: doc['mime'] as string,
        created_at:
          doc['created_at'] instanceof Date
            ? (doc['created_at'] as Date).getTime()
            : doc['created_at'],
        updated_at:
          doc['updated_at'] instanceof Date
            ? (doc['updated_at'] as Date).getTime()
            : doc['updated_at'],
        deleted: Boolean(doc['deleted']),
        content: doc['content'] as string,
      } as DomainDoc;
    } catch (error) {
      this.logger.error(`获取文档失败`, {
        docId,
        error: error instanceof Error ? error.message : String(error),
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
      const chunkMetas = await this.query(
        `SELECT 
          id, 
          doc_id, 
          chunk_index, 
          token_count, 
          embedding_status, 
          synced_at, 
          error, 
          created_at, 
          updated_at, 
          point_id, 
          collection_id
        FROM chunk_metas 
        WHERE doc_id = $1 
        ORDER BY chunk_index`,
        [docId],
      );

      return chunkMetas.map((meta: Record<string, unknown>) => {
        const m = meta;
        return {
          id: m['id'] as DocId,
          docId: m['doc_id'] as DocId,
          chunkIndex: Number(m['chunk_index']),
          tokenCount: Number(m['token_count']),
          embeddingStatus: m['embedding_status'] as
            | 'pending'
            | 'processing'
            | 'completed'
            | 'failed',
          syncedAt: m['synced_at'],
          error: m['error'],
          created_at: m['created_at'],
          updated_at: m['updated_at'],
          pointId: m['point_id'] as PointId,
          collectionId: m['collection_id'] as CollectionId,
        } as ChunkMetaType;
      });
    } catch (error) {
      this.logger.error(`获取文档块元数据失败`, {
        docId,
        error: error instanceof Error ? error.message : String(error),
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
      const chunkMetas = await this.query(
        `SELECT 
          id, 
          doc_id, 
          chunk_index, 
          token_count, 
          embedding_status, 
          synced_at, 
          error, 
          created_at, 
          updated_at, 
          point_id, 
          collection_id
        FROM chunk_metas 
        WHERE collection_id = $1 
        ORDER BY doc_id, chunk_index`,
        [collectionId],
      );

      return chunkMetas.map((meta: Record<string, unknown>) => {
        const m = meta;
        return {
          id: m['id'] as DocId,
          docId: m['doc_id'] as DocId,
          chunkIndex: Number(m['chunk_index']),
          tokenCount: Number(m['token_count']),
          embeddingStatus: m['embedding_status'] as
            | 'pending'
            | 'processing'
            | 'completed'
            | 'failed',
          syncedAt: m['synced_at'],
          error: m['error'],
          created_at: m['created_at'],
          updated_at: m['updated_at'],
          pointId: m['point_id'] as PointId,
          collectionId: m['collection_id'] as CollectionId,
        } as ChunkMetaType;
      });
    } catch (error) {
      this.logger.error(`获取集合块元数据失败`, {
        collectionId,
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
      // 使用PostgreSQL的ANY操作符优化查询
      const chunks = await this.query(
        'SELECT point_id, content FROM chunks WHERE point_id = ANY($1)',
        [pointIds],
      );

      const result: Record<string, { content: string }> = {};
      for (const chunk of chunks) {
        const pointId = String((chunk as Record<string, unknown>)['point_id'] ?? '');
        result[pointId] = {
          content: String((chunk as Record<string, unknown>)['content'] ?? ''),
        };
      }

      return result;
    } catch (error) {
      this.logger.error(`获取块文本内容失败`, {
        pointIds,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 添加文档块
   * @param docId 文档ID
   * @param documentChunks 文档块数组
   */
  async addChunks(
    docId: DocId,
    documentChunks: DocumentChunk[],
  ): Promise<void> {
    await this.transaction(async () => {
      // 使用PostgreSQL的批量插入优化性能
      const chunks = documentChunks.map((chunk, index) => ({
        pointId: `${docId}_${index}` as PointId,
        docId,
        collectionId: '' as CollectionId, // DocumentChunk没有collectionId字段，使用空字符串
        chunkIndex: index,
        title: chunk.titleChain?.join(' > ') || '',
        content: chunk.content,
      }));

      // 构建批量插入SQL
      const values = chunks
        .map(
          (chunk, index) =>
            `($${index * 6 + 1}, $${index * 6 + 2}, $${index * 6 + 3}, $${index * 6 + 4}, $${index * 6 + 5}, $${index * 6 + 6})`,
        )
        .join(', ');

      const parameters = chunks.flatMap((chunk) => [
        chunk.pointId,
        chunk.docId,
        chunk.collectionId,
        chunk.chunkIndex,
        chunk.title,
        chunk.content,
      ]);

      await this.query(
        `INSERT INTO chunks (point_id, doc_id, collection_id, chunk_index, title, content) 
         VALUES ${values} 
         ON CONFLICT (point_id) DO UPDATE SET 
           content = EXCLUDED.content,
           title = EXCLUDED.title,
           updated_at = CURRENT_TIMESTAMP`,
        parameters,
      );

      this.logger.debug(`添加文档块成功`, {
        docId,
        count: chunks.length,
      });
      return undefined;
    });
  }

  /**
   * 标记文档为已同步
   * @param docId 文档ID
   */
  async markDocAsSynced(docId: DocId): Promise<void> {
    try {
      await this.query(
        'UPDATE docs SET synced_at = CURRENT_TIMESTAMP WHERE id = $1',
        [docId],
      );

      this.logger.debug(`标记文档为已同步`, { docId });
    } catch (error) {
      this.logger.error(`标记文档为已同步失败`, {
        docId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 获取所有集合的ID
   * @returns 包含所有集合ID的数组
   */
  async getAllCollectionIds(): Promise<CollectionId[]> {
    try {
      const result = await this.query('SELECT id FROM collections ORDER BY id');
      return result.map(
        (row: Record<string, unknown>) => row['id'] as CollectionId,
      );
    } catch (error) {
      this.logger.error(`获取所有集合ID失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 列出已删除的文档
   * @returns 已删除的文档数组
   */
  async listDeletedDocs(): Promise<DomainDoc[]> {
    try {
      const result = await this.query(
        `SELECT 
          id, 
          key, 
          collection_id, 
          name, 
          size_bytes, 
          mime, 
          created_at, 
          updated_at, 
          deleted, 
          content
        FROM docs 
        WHERE deleted = true 
        ORDER BY updated_at DESC`,
      );

      return result.map((doc: Record<string, unknown>) => {
        const d = doc;
        return {
          id: d['id'] as DocId,
          docId: d['key'] as DocId,
          collectionId: d['collection_id'] as CollectionId,
          key: d['key'] as string,
          name: d['name'] as string,
          size_bytes: Number(d['size_bytes']),
          mime: d['mime'] as string,
          created_at:
            d['created_at'] instanceof Date
              ? (d['created_at'] as Date).getTime()
              : d['created_at'],
          updated_at:
            d['updated_at'] instanceof Date
              ? (d['updated_at'] as Date).getTime()
              : d['updated_at'],
          deleted: Boolean(d['deleted']),
          content: d['content'] as string,
        } as DomainDoc;
      });
    } catch (error) {
      this.logger.error(`列出已删除文档失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 硬删除文档
   * @param docId 文档ID
   */
  async hardDelete(docId: DocId): Promise<void> {
    try {
      await this.transaction(async () => {
        // 删除关联的块
        await this.query('DELETE FROM chunks WHERE doc_id = $1', [docId]);

        // 删除文档
        await this.query('DELETE FROM docs WHERE id = $1', [docId]);
        return undefined;
      });

      this.logger.debug(`硬删除文档成功`, { docId });
    } catch (error) {
      this.logger.error(`硬删除文档失败`, {
        docId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 批量删除块元数据
   * @param pointIds 要删除的点ID数组
   */
  async deleteBatch(pointIds: PointId[]): Promise<void> {
    try {
      // 使用PostgreSQL的ANY操作符优化批量删除
      await this.query('DELETE FROM chunks WHERE point_id = ANY($1)', [
        pointIds,
      ]);

      this.logger.debug(`批量删除块成功`, {
        count: pointIds.length,
      });
    } catch (error) {
      this.logger.error(`批量删除块失败`, {
        pointIds,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
