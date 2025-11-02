/**
 * DOCS 表相关的 SQL 语句
 */

/**
 * 创建 DOCS 表的 SQL 语句
 */
export const CREATE_TABLE_DOCS = `
CREATE TABLE IF NOT EXISTS docs (
  docId TEXT PRIMARY KEY,
  versionId TEXT NOT NULL,
  key TEXT,
  name TEXT,
  content TEXT, -- 保存原始全文内容，便于直接读取
  size_bytes INTEGER,
  mime TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  is_deleted INTEGER DEFAULT 0,
  FOREIGN KEY(versionId) REFERENCES versions(versionId) ON DELETE CASCADE
)`;

/**
 * 插入新文档的 SQL 语句
 */
export const INSERT_DOC = `
INSERT INTO docs (
  docId, collectionId, key, name,
  content, size_bytes, mime,
  created_at, updated_at, is_deleted
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

/**
 * 根据 ID 查询文档的SQL 语句
 */
export const SELECT_DOC_BY_ID = `
SELECT * FROM docs WHERE docId = ? AND is_deleted = 0`;

/**
 * 根据键查询文档的 SQL 语句
 */
export const SELECT_DOC_BY_KEY = `
SELECT * FROM docs WHERE collectionId=? AND key=? AND is_deleted=0`;

/**
 * 查询所有文档的 SQL 语句，按创建时间降序排序
 */
export const SELECT_ALL_DOCS = `
SELECT d.*, v.collectionId
FROM docs d
JOIN versions v ON d.versionId = v.versionId
WHERE d.is_deleted = 0
ORDER BY d.created_at DESC`;

/**
 * 根据集合 ID 查询文档的SQL 语句，按创建时间降序排序
 */
// DEPRECATED: SELECT_DOCS_BY_VERSION_ID has been removed as Version concept is no longer supported

/**
 * 更新文档信息的SQL 语句
 */
export const UPDATE_DOC = `
UPDATE docs
SET
  name = COALESCE(?, name),
  mime = COALESCE(?, mime),
  updated_at = ?
WHERE docId = ?`;

/**
 * 软删除文档的 SQL 语句
 */
export const DELETE_DOC_BY_ID = `
 DELETE FROM docs WHERE docId = ?`;

/**
 * 软删除文档的 SQL 语句
 */
export const SOFT_DELETE_DOC_BY_ID = `
UPDATE docs SET is_deleted = 1, updated_at = ? WHERE docId = ?`;

/**
 * 根据集合 ID 查询文档的SQL 语句
 */
export const SELECT_DOCS_BY_COLLECTION_ID = `
SELECT * FROM docs WHERE collectionId = ? AND is_deleted = 0 ORDER BY created_at DESC`;

/**
 * 硬删除文档的 SQL 语句
 */
export const SELECT_DOC_WITH_VERSION = `
SELECT d.*, v.collectionId FROM docs d JOIN versions v ON d.versionId = v.versionId WHERE d.versionId=? AND d.key=? AND d.is_deleted=0`;

/**
 *
 */
export const SELECT_DOCS_BY_VERSION_ID_FOR_LIST = `
SELECT * FROM docs WHERE versionId = ? AND is_deleted = 0`;

/**
 *
 */
export const SELECT_DOC_IDS_BY_VERSION_ID = `
SELECT docId FROM docs WHERE versionId = ? AND is_deleted = 0`;

/**
 *
 */
export const COUNT_DOCS = `
SELECT COUNT(*) FROM docs WHERE is_deleted = 0`;

/**
 * 根据集合 ID 查询所有文档ID 的SQL 语句（通过版本 ID 关联）
 */
export const SELECT_DOC_IDS_BY_COLLECTION_ID = `
SELECT docId FROM docs WHERE versionId IN (SELECT versionId FROM versions WHERE collectionId = ?)`;

/**
 * 查询所有已软删除文档的 SQL 语句
 */
export const SELECT_DELETED_DOCS = `
SELECT * FROM docs WHERE is_deleted = 1 ORDER BY updated_at DESC`;