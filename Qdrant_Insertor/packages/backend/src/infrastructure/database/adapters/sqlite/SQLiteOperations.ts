import { Logger } from '@logging/logger.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';
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

export class SQLiteOperations {
  constructor(
    private readonly query: (sql: string, params?: unknown[]) => Promise<unknown>,
    private readonly transaction: (fn: () => Promise<unknown>) => Promise<unknown>,
    private readonly logger: Logger,
    private readonly qdrantRepo?: IQdrantRepo,
    private readonly initialization?: { updateFTSTable?: (chunks: unknown[]) => Promise<void> } | undefined,
  ) {}

  async deleteCollection(collectionId: CollectionId): Promise<void> {
    await this.transaction(async () => {
      await this.query('DELETE FROM chunks WHERE collection_id = ?', [
        collectionId,
      ]);
      await this.query('DELETE FROM docs WHERE collection_id = ?', [
        collectionId,
      ]);
      await this.query('DELETE FROM collections WHERE id = ?', [collectionId]);
      if (this.qdrantRepo) {
        await this.qdrantRepo.deletePointsByCollection(collectionId);
      }
      this.logger.info(`删除集合成功`, { collectionId });
    });
  }

  async deleteDoc(docId: DocId): Promise<boolean> {
    return (await this.transaction(async () => {
      await this.query('DELETE FROM chunks WHERE doc_id = ?', [docId]);
      const result = (await this.query(
        'DELETE FROM docs WHERE id = ? RETURNING id',
        [docId],
      )) as Array<Record<string, unknown>>;
      const success = result.length > 0;
      if (success && this.qdrantRepo) {
        await this.qdrantRepo.deletePointsByDoc(docId);
        this.logger.info(`删除文档成功`, { docId });
      }
      return success;
    })) as boolean;
  }

  async getChunksByPointIds(
    pointIds: PointId[],
    collectionId: CollectionId,
  ): Promise<SearchResult[]> {
    try {
      const placeholders = pointIds.map(() => '?').join(',');
      const chunks = (await this.query(
        `SELECT c.point_id, c.doc_id, c.collection_id, c.chunk_index, c.title, c.content, 0 as score FROM chunks c WHERE c.point_id IN (${placeholders}) AND c.collection_id = ? ORDER BY c.chunk_index`,
        [...pointIds, collectionId],
      )) as Array<Record<string, unknown>>;

      return chunks.map((chunk) => ({
        pointId: String(chunk['point_id']) as PointId,
        docId: String(chunk['doc_id']) as DocId,
        collectionId: String(chunk['collection_id']) as CollectionId,
        chunkIndex: Number(chunk['chunk_index']),
        title: String(chunk['title'] ?? ''),
        content: String(chunk['content'] ?? ''),
        score: Number(chunk['score'] ?? 0),
      }));
    } catch (error) {
      this.logger.error(`获取块详细信息失败`, {
        pointIds,
        collectionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getDocumentChunks(docId: DocId) {
    try {
      const chunks = (await this.query(
        `SELECT point_id, doc_id, collection_id, chunk_index, title, content FROM chunks WHERE doc_id = ? ORDER BY chunk_index`,
        [docId],
      )) as Array<Record<string, unknown>>;
      return chunks.map((chunk) => ({
        pointId: String(chunk['point_id']) as PointId,
        docId: String(chunk['doc_id']) as DocId,
        collectionId: String(chunk['collection_id']) as CollectionId,
        chunkIndex: Number(chunk['chunk_index']),
        title: String(chunk['title'] ?? ''),
        content: String(chunk['content'] ?? ''),
      }));
    } catch (error) {
      this.logger.error(`获取文档块列表失败`, {
        docId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getDocumentChunksPaginated(
    docId: DocId,
    queryObj: PaginationQuery,
  ): Promise<PaginatedResponse<SearchResult>> {
    try {
      const { page = 1, limit = 10 } = queryObj;
      const offset = (page - 1) * limit;
      const [chunks, totalResult] = await Promise.all([
        this.query(
          `SELECT point_id, doc_id, collection_id, chunk_index, title, content FROM chunks WHERE doc_id = ? ORDER BY chunk_index LIMIT ? OFFSET ?`,
          [docId, limit, offset],
        ),
        this.query('SELECT COUNT(*) as count FROM chunks WHERE doc_id = ?', [docId]),
      ]);
      const chunksArr = chunks as Array<Record<string, unknown>>;
      const totalResultArr = totalResult as Array<Record<string, unknown>>;
      const total = Number(totalResultArr[0]?.['count'] ?? 0);
      const totalPages = Math.ceil(total / limit);
      return {
        data: chunksArr.map((chunk) => ({
          pointId: String(chunk['point_id']) as PointId,
          docId: String(chunk['doc_id']) as DocId,
          collectionId: String(chunk['collection_id']) as CollectionId,
          chunkIndex: Number(chunk['chunk_index']),
          title: String(chunk['title'] ?? ''),
          content: String(chunk['content'] ?? ''),
          score: 0,
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
      this.logger.error(`分页获取文档块列表失败`, {
        docId,
        queryObj,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getDoc(docId: DocId): Promise<DomainDoc | undefined> {
    try {
      const result = (await this.query(
        `SELECT id, key, collection_id, name, size_bytes, mime, created_at, updated_at, deleted, content FROM docs WHERE id = ?`,
        [docId],
      )) as Array<Record<string, unknown>>;
      if ((result?.length ?? 0) === 0) return undefined;
      const doc = result[0];
      return {
        id: String(doc['id']) as DocId,
        docId: String(doc['key']) as DocId,
        collectionId: String(doc['collection_id']) as CollectionId,
        key: doc['key'],
        name: doc['name'],
        size_bytes: Number(doc['size_bytes']),
        mime: doc['mime'],
        created_at:
          doc['created_at'] instanceof Date ? doc['created_at'].getTime() : doc['created_at'],
        updated_at:
          doc['updated_at'] instanceof Date ? doc['updated_at'].getTime() : doc['updated_at'],
        deleted: Boolean(doc['deleted']),
        content: doc['content'],
      } as DomainDoc;
    } catch (error) {
      this.logger.error(`获取文档失败`, {
        docId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getChunkMetasByDocId(docId: DocId): Promise<ChunkMetaType[]> {
    try {
      const chunkMetas = (await this.query(
        `SELECT id, doc_id, chunk_index, token_count, embedding_status, synced_at, error, created_at, updated_at, point_id, collection_id FROM chunk_metas WHERE doc_id = ? ORDER BY chunk_index`,
        [docId],
      )) as Array<Record<string, unknown>>;
      return chunkMetas.map((meta) => ({
        id: String(meta['id']) as DocId,
        docId: String(meta['doc_id']) as DocId,
        chunkIndex: Number(meta['chunk_index']),
        tokenCount: Number(meta['token_count']),
        embeddingStatus: meta['embedding_status'] as unknown,
        syncedAt: meta['synced_at'],
        error: meta['error'],
        created_at: meta['created_at'],
        updated_at: meta['updated_at'],
        pointId: String(meta['point_id']) as PointId,
        collectionId: String(meta['collection_id']) as CollectionId,
      }) as ChunkMetaType);
    } catch (error) {
      this.logger.error(`获取文档块元数据失败`, {
        docId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getChunkMetasByCollectionId(
    collectionId: CollectionId,
  ): Promise<ChunkMetaType[]> {
    try {
      const chunkMetas = (await this.query(
        `SELECT id, doc_id, chunk_index, token_count, embedding_status, synced_at, error, created_at, updated_at, point_id, collection_id FROM chunk_metas WHERE collection_id = ? ORDER BY doc_id, chunk_index`,
        [collectionId],
      )) as Array<Record<string, unknown>>;
      return chunkMetas.map((meta) => ({
        id: String(meta['id']) as DocId,
        docId: String(meta['doc_id']) as DocId,
        chunkIndex: Number(meta['chunk_index']),
        tokenCount: Number(meta['token_count']),
        embeddingStatus: meta['embedding_status'] as unknown,
        syncedAt: meta['synced_at'],
        error: meta['error'],
        created_at: meta['created_at'],
        updated_at: meta['updated_at'],
        pointId: String(meta['point_id']) as PointId,
        collectionId: String(meta['collection_id']) as CollectionId,
      }) as ChunkMetaType);
    } catch (error) {
      this.logger.error(`获取集合块元数据失败`, {
        collectionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getChunkTexts(
    pointIds: PointId[],
  ): Promise<Record<string, { content: string }>> {
    try {
      const placeholders = pointIds.map(() => '?').join(',');
      const chunks = (await this.query(
        `SELECT point_id, content FROM chunks WHERE point_id IN (${placeholders})`,
        pointIds,
      )) as Array<Record<string, unknown>>;
      const result: Record<string, { content: string }> = {};
      for (const chunk of chunks) {
        const pid = String(chunk['point_id']);
        result[pid] = { content: String(chunk['content'] ?? '') };
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

  async addChunks(
    docId: DocId,
    documentChunks: DocumentChunk[],
  ): Promise<void> {
    await this.transaction(async () => {
      const chunks = documentChunks.map((chunk, index) => ({
        pointId: `${docId}_${index}` as PointId,
        docId,
        collectionId: '' as CollectionId,
        chunkIndex: index,
        title: chunk.titleChain?.join(' > ') || '',
        content: chunk.content,
      }));
      const values = chunks.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
      const parameters = chunks.flatMap((c) => [
        c.pointId,
        c.docId,
        c.collectionId,
        c.chunkIndex,
        c.title,
        c.content,
      ] as unknown[]);
      await this.query(
        `INSERT OR REPLACE INTO chunks (point_id, doc_id, collection_id, chunk_index, title, content) VALUES ${values}`,
        parameters,
      );
      if (this.initialization && typeof this.initialization.updateFTSTable === 'function') {
        await this.initialization.updateFTSTable(chunks as unknown[]);
      }
      this.logger.debug(`添加文档块成功`, { docId, count: chunks.length });
    });
  }

  async markDocAsSynced(docId: DocId): Promise<void> {
    try {
      await this.query(
        'UPDATE docs SET synced_at = CURRENT_TIMESTAMP WHERE id = ?',
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

  async getAllCollectionIds(): Promise<CollectionId[]> {
    try {
      const result = (await this.query('SELECT id FROM collections ORDER BY id')) as Array<Record<string, unknown>>;
      return result.map((row) => String(row['id']) as CollectionId);
    } catch (error) {
      this.logger.error(`获取所有集合ID失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async listDeletedDocs(): Promise<DomainDoc[]> {
    try {
      const result = (await this.query(
        `SELECT id, key, collection_id, name, size_bytes, mime, created_at, updated_at, deleted, content FROM docs WHERE deleted = 1 ORDER BY updated_at DESC`,
      )) as Array<Record<string, unknown>>;
      return result.map((doc) => ({
        id: String(doc['id']) as DocId,
        docId: String(doc['key']) as DocId,
        collectionId: String(doc['collection_id']) as CollectionId,
        key: doc['key'],
        name: doc['name'],
        size_bytes: Number(doc['size_bytes']),
        mime: doc['mime'],
        created_at: doc['created_at'] instanceof Date ? doc['created_at'].getTime() : doc['created_at'],
        updated_at: doc['updated_at'] instanceof Date ? doc['updated_at'].getTime() : doc['updated_at'],
        deleted: Boolean(doc['deleted']),
        content: doc['content'],
      }) as DomainDoc);
    } catch (error) {
      this.logger.error(`列出已删除文档失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async hardDelete(docId: DocId): Promise<void> {
    try {
      await this.transaction(async () => {
        await this.query('DELETE FROM chunks WHERE doc_id = ?', [docId]);
        await this.query('DELETE FROM docs WHERE id = ?', [docId]);
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

  async deleteBatch(pointIds: PointId[]): Promise<void> {
    try {
      const placeholders = pointIds.map(() => '?').join(',');
      await this.query(
        `DELETE FROM chunks WHERE point_id IN (${placeholders})`,
        pointIds,
      );
      this.logger.debug(`批量删除块成功`, { count: pointIds.length });
    } catch (error) {
      this.logger.error(`批量删除块失败`, {
        pointIds,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
