import type { Database } from 'better-sqlite3';
import type { PointId, DocId, CollectionId, SearchResult } from '../../../../../share/type.js';
import {
  INSERT_CHUNKS_FTS5_BATCH,
  SEARCH_CHUNKS_FTS5_BY_COLLECTION,
  DELETE_CHUNKS_FTS5_BY_DOC_ID,
  DELETE_CHUNKS_FTS5_BY_COLLECTION_ID,
} from '../sql/chunks_fts5.sql.js';

/**
 * FTS 搜索结果的类型定义。
 * 注意：在 `share/type.ts` 中，`SearchResult` 是一个更通用的类型，
 * FTS 的原始结果可能包含额外的字段，如 `rank`。
 * 为保持一致性，我们将其映射到 `SearchResult`。
 */
export type FtsResult = SearchResult;

/**
 * Data Access Object for the `chunks_fts5` virtual table.
 * Encapsulates all SQL interactions for Full-Text Search on chunks.
 */
export class ChunksFts5Table {
  private db: Database;

  /**
   * @param db The database instance.
   */
  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Inserts a batch of chunk contents into the FTS index within a single transaction.
   * Note: This method is for manual indexing. The default setup uses triggers
   * to automatically keep the FTS table in sync with the `chunks` table.
   * This might be useful for initial data population or re-indexing scenarios.
   *
   * @param data - An array of objects, each containing the pointId, content, and title chain for FTS indexing.
   */
  createBatch(data: { pointId: PointId; content: string; title_chain: string }[]): void {
    const insert = this.db.prepare(INSERT_CHUNKS_FTS5_BATCH);

    const insertMany = this.db.transaction((items: { pointId: PointId; content: string; title_chain: string }[]) => {
      for (const item of items) {
        insert.run(item.pointId, item.content, item.title_chain);
      }
    });

    insertMany(data);
  }

  /**
   * Performs a full-text search within a specific collection.
   *
   * @param query - The FTS query string.
   * @param collectionId - The ID of the collection to search within.
   * @param limit - The maximum number of results to return.
   * @returns An array of search results.
   */
  search(query: string, collectionId: CollectionId, limit: number): FtsResult[] {
    const stmt = this.db.prepare(SEARCH_CHUNKS_FTS5_BY_COLLECTION);
    // FTS queries handle their own parameterization within the MATCH string,
    // so we don't need to worry about SQL injection from the query text itself.
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
      title: row.doc_name, // Map doc_name to title for SearchResult compatibility
      // Note: score (rank) is implicitly used for ordering in SQL but not returned here.
      // It can be added if needed by selecting the 'rank' column.
    }));
  }

  /**
   * Deletes all FTS index entries associated with a specific document.
   *
   * @param docId - The ID of the document whose FTS records are to be deleted.
   */
  deleteByDocId(docId: DocId): void {
    const stmt = this.db.prepare(DELETE_CHUNKS_FTS5_BY_DOC_ID);
    stmt.run(docId);
  }

  /**
   * Deletes all FTS index entries associated with a specific collection.
   *
   * @param collectionId - The ID of the collection whose FTS records are to be deleted.
   */
  deleteByCollectionId(collectionId: CollectionId): void {
    const stmt = this.db.prepare(DELETE_CHUNKS_FTS5_BY_COLLECTION_ID);
    stmt.run(collectionId);
  }
}