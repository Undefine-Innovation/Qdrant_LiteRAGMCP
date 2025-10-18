import Database from 'better-sqlite3';
import { makeDocId } from '../../../share/utils/id.js';
import { Doc, SearchResult, CollectionId, DocId } from '../../../share/type.js';

// Import DAOs
import { CollectionsTable } from './sqlite/dao/CollectionsTable.js';
import { DocsTable } from './sqlite/dao/DocsTable.js';
import { ChunkMetaTable } from './sqlite/dao/ChunkMetaTable.js';
import { ChunksFts5Table } from './sqlite/dao/ChunksFts5Table.js';

// Import SQL for schema creation and complex queries
import { CREATE_TABLE_COLLECTIONS } from './sqlite/sql/collections.sql.js';
import { CREATE_TABLE_DOCS } from './sqlite/sql/docs.sql.js';
import { CREATE_TABLE_CHUNK_META } from './sqlite/sql/chunk_meta.sql.js';
import {
  CREATE_TABLE_CHUNKS,
  CREATE_VIRTUAL_TABLE_CHUNKS_FTS5,
  SELECT_CHUNKS_BY_POINT_IDS as SELECT_CHUNKS_CONTENT_BY_POINT_IDS,
  SELECT_CHUNKS_DETAILS_BY_POINT_IDS_BASE,
} from './sqlite/sql/chunks.sql.js';
import { SELECT_ONE } from './sqlite/sql/common.sql.js';

/**
 * SQLiteRepo acts as a coordinator for Data Access Objects (DAOs).
 * It manages the database connection, provides access to DAOs,
 * and encapsulates complex, transactional operations that span multiple tables.
 */
export class SQLiteRepo {
  public readonly collections: CollectionsTable;
  public readonly docs: DocsTable;
  public readonly chunkMeta: ChunkMetaTable;
  public readonly chunksFts5: ChunksFts5Table;

  /**
   * @param db A `better-sqlite3` database instance.
   */
  constructor(private db: Database.Database) {
    this.collections = new CollectionsTable(db);
    this.docs = new DocsTable(db);
    this.chunkMeta = new ChunkMetaTable(db);
    this.chunksFts5 = new ChunksFts5Table(db);
    this.bootstrap();
  }

  /**
   * Initializes the database, ensuring the schema exists.
   */
  public init() {
    this.bootstrap();
  }

  /**
   * Sets up the database schema and PRAGMA settings.
   */
  private bootstrap() {
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');

    const tx = this.db.transaction(() => {
      this.db.exec(`
        ${CREATE_TABLE_COLLECTIONS}
        ${CREATE_TABLE_DOCS}
        ${CREATE_TABLE_CHUNK_META}
        ${CREATE_TABLE_CHUNKS}
        ${CREATE_VIRTUAL_TABLE_CHUNKS_FTS5}
      `);
    });
    tx();
  }

  /**
   * Executes a function within a database transaction.
   * @param fn The function containing database operations.
   * @returns The return value of the transactional function.
   */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  /**
   * Closes the database connection.
   */
  public close() {
    this.db.close();
  }

  /**
   * Deletes a collection and all its associated documents and chunks.
   * This is a transactional operation.
   * @param collectionId The ID of the collection to delete.
   */
  deleteCollection(collectionId: CollectionId): void {
    const collection = this.collections.getById(collectionId);
    if (!collection) {
      console.warn('deleteCollection: no such collectionId', collectionId);
      return;
    }

    this.transaction(() => {
      // First, delete all chunks and their metadata associated with the collection.
      this.chunkMeta.deleteByCollectionId(collectionId);
      this.chunksFts5.deleteByCollectionId(collectionId);

      // Then, delete all documents in the collection.
      const docsInCollection = this.docs.listByCollection(collectionId);
      for (const doc of docsInCollection) {
        this.docs.hardDelete(doc.docId);
      }

      // Finally, delete the collection itself.
      this.collections.delete(collectionId);
    });

    console.log(
      `Collection ${collectionId} and its associated data have been deleted.`,
    );
  }

  /**
   * Updates a document's content and metadata.
   * If the content changes, the old document and its chunks are deleted,
   * and a new document is created.
   * @returns The updated Doc object, or null if the original doc was not found.
   */
  updateDoc(
    docId: DocId,
    content: string | Uint8Array,
    name?: string,
    mime?: string,
  ): Doc | null {
    const existingDoc = this.docs.getById(docId);
    if (!existingDoc) {
      console.error('updateDoc: Document not found', docId);
      return null;
    }

    const newDocId = makeDocId(content);

    // Case 1: Content has not changed, only update metadata.
    if (newDocId === docId) {
      this.docs.update(docId, { name, mime });
      return this.docs.getById(docId) ?? null;
    }

    // Case 2: Content has changed, replace the document.
    const { collectionId, key } = existingDoc;
    this.transaction(() => {
      this.deleteDoc(docId); // Hard delete the old doc and its chunks
    });

    // Create the new document.
    const newId = this.docs.create({
      collectionId,
      key,
      content: typeof content === 'string' ? content : new TextDecoder().decode(content),
      size_bytes: typeof content === 'string' ? new TextEncoder().encode(content).length : content.byteLength,
      name: name ?? existingDoc.name,
      mime,
    });

    return this.docs.getById(newId) ?? null;
  }

  /**
   * Deletes a document and all its associated chunks.
   * This is a hard delete operation performed within a transaction.
   * @param docId The ID of the document to delete.
   * @returns True if the document was found and deleted, false otherwise.
   */
  deleteDoc(docId: DocId): boolean {
    const doc = this.docs.getById(docId);
    if (!doc) {
      console.warn('deleteDoc: no such docId', docId);
      return false;
    }

    this.transaction(() => {
      this.chunkMeta.deleteByDocId(docId);
      this.chunksFts5.deleteByDocId(docId);
      this.docs.hardDelete(docId);
    });
    return true;
  }

  /**
   * Retrieves the text content for a list of chunk point IDs.
   * @param pointIds An array of chunk IDs.
   * @returns A record mapping each pointId to its content and title.
   */
  getChunkTexts(
    pointIds: string[],
  ): Record<string, { content: string; title?: string }> | null {
    if (pointIds.length === 0) {
      return {};
    }

    const placeholders = pointIds.map(() => '?').join(',');
    const stmt = this.db.prepare(
      SELECT_CHUNKS_CONTENT_BY_POINT_IDS.replace('?', placeholders),
    );
    const rows = stmt.all(...pointIds) as Array<{
      pointId: string;
      content: string;
      title?: string;
    }>;

    if (rows.length === 0) {
      console.warn('getChunkTexts: no chunks found');
      return {};
    }

    return rows.reduce(
      (acc, row) => {
        acc[row.pointId] = {
          content: row.content,
          title: row.title ?? undefined,
        };
        return acc;
      },
      {} as Record<string, { content: string; title?: string }>,
    );
  }

  /**
   * Retrieves detailed information for a list of chunk point IDs.
   * @param pointIds An array of chunk IDs.
   * @param collectionId The ID of the collection.
   * @returns An array of search results.
   */
  getChunksByPointIds(
    pointIds: string[],
    collectionId: string,
  ): SearchResult[] {
    if (pointIds.length === 0) {
      return [];
    }

    const placeholders = pointIds.map(() => '?').join(',');
    const baseSql = SELECT_CHUNKS_DETAILS_BY_POINT_IDS_BASE.replace(
      '?',
      placeholders,
    );
    const sql = `
      ${baseSql}
      ORDER BY cm.chunkIndex ASC
    `;

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...pointIds, collectionId) as SearchResult[];

    return rows.map((row) => ({
      ...row,
      docId: row.docId as DocId,
      pointId: row.pointId,
      collectionId: row.collectionId as CollectionId,
    }));
  }

  /**
   * Checks if the database connection is alive.
   * @returns True if the connection is responsive, false otherwise.
   */
  ping(): boolean {
    try {
      this.db.prepare(SELECT_ONE).get();
      return true;
    } catch (e) {
      console.error('Database ping failed:', e);
      return false;
    }
  }
}