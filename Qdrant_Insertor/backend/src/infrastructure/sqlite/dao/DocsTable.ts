import type { Database } from 'better-sqlite3';
import type { Doc, DocId, CollectionId } from '../../../../../share/type.js';
import { makeDocId } from '../../../../../share/utils/id.js';
import {
  INSERT_DOC,
  SELECT_DOC_BY_ID,
  UPDATE_DOC,
  DELETE_DOC_BY_ID,
} from '../sql/docs.sql.js';

const SOFT_DELETE_DOC_BY_ID = 'UPDATE docs SET is_deleted = 1, updated_at = ? WHERE docId = ?';
const SELECT_DOCS_BY_COLLECTION_ID = `
  SELECT * FROM docs WHERE collectionId = ? AND is_deleted = 0 ORDER BY created_at DESC
`;


/**
 * Data Access Object for the `docs` table.
 * Encapsulates all SQL interactions for documents.
 */
export class DocsTable {
  private db: Database;

  /**
   * @param db The database instance.
   */
  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Creates a new doc record.
   * @param data - The data for the new document.
   * @returns The ID of the newly created document.
   */
  create(data: Omit<Doc, 'docId' | 'created_at' | 'updated_at' | 'is_deleted' | 'content'> & { content: string }): DocId {
    const docId = makeDocId(data.content);
    const now = Date.now();
    const stmt = this.db.prepare(INSERT_DOC);
    stmt.run(
      docId,
      data.collectionId,
      data.key,
      data.name,
      data.content,
      data.size_bytes,
      data.mime,
      now,
      now,
      0 // is_deleted
    );
    return docId as DocId;
  }

  /**
   * Retrieves a document by its ID.
   * @param docId - The ID of the document to retrieve.
   * @returns The document object, or undefined if not found.
   */
  getById(docId: DocId): Doc | undefined {
    const stmt = this.db.prepare(SELECT_DOC_BY_ID);
    const row = stmt.get(docId) as Doc | undefined;
    if (row) {
      row.is_deleted = Boolean(row.is_deleted);
    }
    return row;
  }

  /**
   * Retrieves all documents for a given collection.
   * @param collectionId - The ID of the collection.
   * @returns An array of documents.
   */
  listByCollection(collectionId: CollectionId): Doc[] {
    const stmt = this.db.prepare(SELECT_DOCS_BY_COLLECTION_ID);
    const rows = stmt.all(collectionId) as Doc[];
    return rows.map(row => ({
      ...row,
      is_deleted: Boolean(row.is_deleted)
    }));
  }

  /**
   * Retrieves all documents from the database.
   * @returns An array of all documents.
   */
  listAll(): Doc[] {
    const stmt = this.db.prepare('SELECT * FROM docs WHERE is_deleted = 0 ORDER BY created_at DESC');
    const rows = stmt.all() as Doc[];
    return rows.map(row => ({
      ...row,
      is_deleted: Boolean(row.is_deleted)
    }));
  }

  /**
   * Updates an existing document.
   * @param docId - The ID of the document to update.
   * @param data - The data to update. Only 'name' and 'mime' will be updated.
   */
  update(docId: DocId, data: Partial<Omit<Doc, 'docId' | 'collectionId' | 'createdAt'>>): void {
    const updatedAt = Date.now();
    const stmt = this.db.prepare(UPDATE_DOC);
    stmt.run(
      data.name,
      data.mime,
      updatedAt,
      docId
    );
  }

  /**
   * Soft deletes a document by its ID.
   * @param docId - The ID of the document to soft delete.
   */
  delete(docId: DocId): void {
    const stmt = this.db.prepare(SOFT_DELETE_DOC_BY_ID);
    stmt.run(Date.now(), docId);
  }

  /**
   * Permanently deletes a document by its ID.
   * @param docId - The ID of the document to delete.
   */
  hardDelete(docId: DocId): void {
    const stmt = this.db.prepare(DELETE_DOC_BY_ID);
    stmt.run(docId);
  }
}