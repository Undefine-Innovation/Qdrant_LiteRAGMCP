/**
 * CHUNKS 表相关的 SQL 语句
 */

/**
 * 创建 CHUNKS 表的 SQL 语句
 */
export const CREATE_TABLE_CHUNKS = `
CREATE TABLE IF NOT EXISTS chunks (
  pointId TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  title TEXT,
  FOREIGN KEY(pointId) REFERENCES chunk_meta(pointId) ON DELETE CASCADE
);
`;

/**
 * 创建 CHUNKS_FTS5 虚拟表的 SQL 语句
 */
export const CREATE_VIRTUAL_TABLE_CHUNKS_FTS5 = `
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts5
USING fts5(content, title, pointId UNINDEXED, content='' , tokenize='unicode61');
`;

/**
 * 批量插入到 CHUNKS 表的 SQL 语句
 */
export const INSERT_CHUNKS_BATCH = `
INSERT INTO chunks (
  content, title , pointId
) VALUES (?, ?, ?)
ON CONFLICT(pointId) DO UPDATE SET content=excluded.content, title=excluded.title
`;

/**
 * 插入到 CHUNKS_FTS5 表的 SQL 语句
 */
export const INSERT_CHUNKS_FTS5 = `
INSERT INTO chunks_fts5 (content, title, pointId) VALUES (?, ?, ?)
`;

/**
 * 根据 pointIds 查询 CHUNKS 表的 SQL 语句
 */
export const SELECT_CHUNKS_BY_POINT_IDS = `
SELECT pointId, content, title FROM chunks WHERE pointId IN (?)
`;

/**
 * 根据 docId 查询 CHUNKS_FTS5 表的 SQL 语句
 */
export const SELECT_CHUNKS_FTS5_BY_DOC_ID = `
SELECT content FROM chunks_fts5 WHERE pointId LIKE ? LIMIT 1
`;

/**
 * 根据 docId 查询 CHUNKS_FTS5 表的 SQL 语句（用于删除）
 */
export const SELECT_CHUNKS_FTS5_POINT_IDS_BY_DOC_ID = `
SELECT pointId FROM chunks_fts5 WHERE pointId LIKE ?
`;

/**
 * 根据 pointIds 删除 CHUNKS 表的 SQL 语句
 */
export const DELETE_CHUNKS_BY_POINT_IDS = `
DELETE FROM chunks WHERE pointId IN (?)
`;

/**
 * 根据 pointIds 删除 CHUNKS_FTS5 表的 SQL 语句
 */
export const DELETE_CHUNKS_FTS5_BY_POINT_IDS = `
DELETE FROM chunks_fts5 WHERE pointId IN (?)
`;

/**
 * 关键词搜索的基础 SQL 语句（不包含动态部分）
 */
export const SEARCH_KEYWORDS_BASE = `
SELECT
  chunk_meta.pointId,
  chunks_fts5.content,
  chunks_fts5.title,
  chunk_meta.docId,
  chunk_meta.chunkIndex
FROM chunks_fts5
JOIN chunk_meta ON chunks_fts5.pointId = chunk_meta.pointId
JOIN docs       ON chunk_meta.docId = docs.docId
WHERE chunk_meta.collectionId = ?
  AND docs.is_deleted = 0
  AND chunks_fts5 MATCH ?
`;

/**
 * 根据 pointIds 查询块详细信息的基础 SQL 语句（不包含动态部分）
 */
export const SELECT_CHUNKS_DETAILS_BY_POINT_IDS_BASE = `
SELECT
  cm.pointId,
  cm.collectionId AS collectionId,
  c.content,
  cm.titleChain AS titleChain,
  c.title,
  cm.docId,
  cm.chunkIndex
FROM chunk_meta cm
JOIN chunks_fts5 c ON cm.pointId = c.pointId
JOIN docs d ON cm.docId = d.docId
WHERE cm.pointId IN (?)
  AND cm.collectionId = ?
  AND d.is_deleted = 0
`;

/**
 * 统计块数量的 SQL 语句
 */
export const COUNT_CHUNKS = `
SELECT COUNT(*) FROM chunk_meta
`;