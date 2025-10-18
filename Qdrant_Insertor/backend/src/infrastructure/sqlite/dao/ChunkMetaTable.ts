import type { Database } from 'better-sqlite3';
import type { ChunkMeta, PointId, DocId, CollectionId } from '../../../../../share/type.js';
import {
  SELECT_CHUNK_BY_POINT_ID,
  SELECT_CHUNKS_BY_DOC_ID,
  DELETE_CHUNKS_BY_DOC_ID,
  DELETE_CHUNKS_BY_COLLECTION_ID,
} from '../sql/chunk_meta.sql.js';

/**
 * SQL for inserting a single chunk meta record.
 * The batch insert constant has an ON CONFLICT clause which is not needed for a simple insert.
 */
const INSERT_CHUNK_META = `
INSERT INTO chunk_meta (
   pointId, docId, collectionId, chunkIndex, titleChain, contentHash, created_at
) VALUES (?, ?, ?, ?, ?, ?, ?)
`;

/**
 * Data Access Object for the `chunk_meta` table.
 * Encapsulates all SQL interactions for chunk metadata.
 */
export class ChunkMetaTable {
  private db: Database;

  /**
   * @param db The database instance.
   */
  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Creates a new chunk meta record.
   * @param data - The data for the new chunk metadata, excluding 'createdAt'.
   */
  create(data: Omit<ChunkMeta, 'created_at'>): void {
    const now = Date.now();
    const stmt = this.db.prepare(INSERT_CHUNK_META);
    stmt.run(
      data.pointId,
      data.docId,
      data.collectionId,
      data.chunkIndex,
      data.titleChain,
      data.contentHash,
      now
    );
  }

  /**
   * Creates multiple chunk meta records in a single transaction.
   * This is crucial for performance as a document is often split into many chunks.
   * @param data - An array of chunk metadata objects to insert.
   */
  createBatch(data: Omit<ChunkMeta, 'created_at'>[]): void {
    const insert = this.db.prepare(INSERT_CHUNK_META);

    const insertMany = this.db.transaction((items: Omit<ChunkMeta, 'created_at'>[]) => {
      const now = Date.now();
      for (const item of items) {
        insert.run(
          item.pointId,
          item.docId,
          item.collectionId,
          item.chunkIndex,
          item.titleChain,
          item.contentHash,
          now
        );
      }
    });

    insertMany(data);
  }

  /**
   * Retrieves a chunk's metadata by its pointId.
   * @param pointId - The unique ID of the point (and chunk).
   * @returns The chunk metadata object, or undefined if not found.
   */
  getByPointId(pointId: PointId): ChunkMeta | undefined {
    const stmt = this.db.prepare(SELECT_CHUNK_BY_POINT_ID);
    return stmt.get(pointId) as ChunkMeta | undefined;
  }

  /**
   * Lists all chunk metadata for a specific document.
   * @param docId - The ID of the document.
   * @returns An array of chunk metadata objects.
   */
  listByDocId(docId: DocId): ChunkMeta[] {
    const stmt = this.db.prepare(SELECT_CHUNKS_BY_DOC_ID);
    return stmt.all(docId) as ChunkMeta[];
  }

  /**
   * Deletes all chunk metadata associated with a specific document.
   * @param docId - The ID of the document whose chunks are to be deleted.
   */
  deleteByDocId(docId: DocId): void {
    const stmt = this.db.prepare(DELETE_CHUNKS_BY_DOC_ID);
    stmt.run(docId);
  }

  /**
   * Deletes all chunk metadata associated with a specific collection.
   * @param collectionId - The ID of the collection whose chunks are to be deleted.
   */
  deleteByCollectionId(collectionId: CollectionId): void {
    const stmt = this.db.prepare(DELETE_CHUNKS_BY_COLLECTION_ID);
    stmt.run(collectionId);
  }
}