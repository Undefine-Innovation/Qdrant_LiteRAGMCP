import type { Database } from 'better-sqlite3';
import type { Doc, DocId, CollectionId } from '@domain/types.js';
import { makeDocId } from '@domain/utils/id.js';
import {
  INSERT_DOC,
  SELECT_DOC_BY_ID,
  UPDATE_DOC,
  DELETE_DOC_BY_ID,
  SOFT_DELETE_DOC_BY_ID,
  SELECT_DOCS_BY_COLLECTION_ID,
  SELECT_DELETED_DOCS,
} from '../sql/docs.sql.js';


/**
 * `docs` 表的数据访问对象 (DAO)。
 * 封装了所有文档的 SQL 交互。
 */
export class DocsTable {
  private db: Database;

  /**
   * @param db - 数据库实例。
   */
  constructor(db: Database) {
    this.db = db;
  }

  /**
   * 创建一个新的文档记录。
   * @param data - 新文档的数据。
   * @returns 新创建文档的 ID。
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
   * 根据 ID 检索文档。
   * @param docId - 要检索的文档 ID。
   * @returns 文档对象，如果未找到则返回 undefined。
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
   * 检索给定集合的所有文档。
   * @param collectionId - 集合的 ID。
   * @returns 文档数组。
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
   * 从数据库中检索所有文档。
   * @returns 所有文档的数组。
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
   * 更新现有文档。
   * @param docId - 要更新的文档 ID。
   * @param data - 要更新的数据。只有“name”和“mime”会被更新。
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
   * 根据 ID 软删除文档。
   * @param docId - 要软删除的文档 ID。
   */
  delete(docId: DocId): void {
    const stmt = this.db.prepare(SOFT_DELETE_DOC_BY_ID);
    stmt.run(Date.now(), docId);
  }

  /**
   * 根据 ID 永久删除文档。
   * @param docId - 要删除的文档 ID。
   */
  hardDelete(docId: DocId): void {
    const stmt = this.db.prepare(DELETE_DOC_BY_ID);
    stmt.run(docId);
  }

  /**
   * 检索所有已软删除的文档。
   * @returns 已软删除文档的数组。
   */
  listDeletedDocs(): Doc[] {
    const stmt = this.db.prepare(SELECT_DELETED_DOCS);
    const rows = stmt.all() as Doc[];
    return rows.map(row => ({
      ...row,
      is_deleted: Boolean(row.is_deleted)
    }));
  }
}