import type { Database } from 'better-sqlite3';
import type { PointId, DocId, CollectionId, SearchResult } from '@domain/types.js';
import {
  SEARCH_CHUNKS_FTS5_BY_COLLECTION,
  DELETE_CHUNKS_FTS5_BY_DOC_ID,
  DELETE_CHUNKS_FTS5_BY_COLLECTION_ID,
  DELETE_CHUNKS_FTS5_BATCH,
} from '../sql/chunks_fts5.sql.js';

/**
 * FTS 搜索结果的类型定义。
 * 注意：在 `share/type.ts` 中，`SearchResult` 是一个更通用的类型，
 * FTS 的原始结果可能包含额外的字段，如 `rank`。
 * 为保持一致性，我们将其映射到 `SearchResult`。
 */
export type FtsResult = SearchResult;

/**
 * `chunks_fts5` 虚拟表的数据访问对象 (DAO)。
 * 封装了所有块全文搜索的 SQL 交互。
 */
export class ChunksFts5Table {
  private db: Database;

  /**
   * @param db - 数据库实例。
   */
  constructor(db: Database) {
    this.db = db;
  }

  /**
   * 在特定集合中执行全文搜索。
   *
   * @param query - FTS 查询字符串。
   * @param collectionId - 要搜索的集合 ID。
   * @param limit - 返回结果的最大数量。
   * @returns 搜索结果数组。
   */
  search(query: string, collectionId: CollectionId, limit: number): FtsResult[] {
    const stmt = this.db.prepare(SEARCH_CHUNKS_FTS5_BY_COLLECTION);
    // FTS 查询处理其自身在 MATCH 字符串中的参数化，
    // 因此我们无需担心查询文本本身的 SQL 注入。
    const results = stmt.all(query, collectionId, limit) as {
      point_id: PointId;
      doc_id: DocId;
      collection_id: CollectionId;
      chunk_index: number;
      title_chain: string;
      content: string;
      doc_name: string;
    }[];

    return results.map(row => ({
      pointId: row.point_id,
      docId: row.doc_id,
      collectionId: row.collection_id,
      chunkIndex: row.chunk_index,
      titleChain: row.title_chain,
      content: row.content,
      title: row.doc_name, // 将 doc_name 映射到 title 以兼容 SearchResult
      // 注意：score (rank) 在 SQL 中隐式用于排序，但此处不返回。
      // 如果需要，可以通过选择“rank”列来添加。
    }));
  }

  /**
   * 删除与特定文档关联的所有 FTS 索引条目。
   *
   * @param docId - 要删除其 FTS 记录的文档 ID。
   */
  deleteByDocId(docId: DocId): void {
    const stmt = this.db.prepare(DELETE_CHUNKS_FTS5_BY_DOC_ID);
    stmt.run(docId);
  }

  /**
   * 删除与特定集合关联的所有 FTS 索引条目。
   *
   * @param collectionId - 要删除其 FTS 记录的集合 ID。
   */
  deleteByCollectionId(collectionId: CollectionId): void {
    const stmt = this.db.prepare(DELETE_CHUNKS_FTS5_BY_COLLECTION_ID);
    stmt.run(collectionId);
  }
  createBatch(data: Array<{ pointId: PointId; docId: DocId; collectionId: CollectionId; content: string }>): void {
    const insert = this.db.prepare(`
      INSERT INTO chunks_fts5 (point_id, doc_id, collection_id, content)
      VALUES (?, ?, ?, ?)
    `);

    this.db.transaction((items: Array<{ pointId: PointId; docId: DocId; collectionId: CollectionId; content: string }>) => {
      for (const item of items) {
        insert.run(item.pointId, item.docId, item.collectionId, item.content);
      }
    })(data);
  }

  /**
   * 根据 pointId 批量删除 FTS 索引条目。
   * @param pointIds - 要删除的 pointId 数组。
   */
  deleteBatch(pointIds: PointId[]): void {
    if (pointIds.length === 0) {
      return;
    }
    const placeholders = pointIds.map(() => '?').join(',');
    const stmt = this.db.prepare(DELETE_CHUNKS_FTS5_BATCH.replace('(?)', `(${placeholders})`));
    stmt.run(...pointIds);
  }
}