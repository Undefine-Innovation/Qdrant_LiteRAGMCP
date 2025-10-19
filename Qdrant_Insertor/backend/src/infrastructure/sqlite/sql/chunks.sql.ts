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
 * 批量插入到 CHUNKS 表的 SQL 语句
 */
export const INSERT_CHUNKS_BATCH = `
INSERT INTO chunks (
  content, title , pointId
) VALUES (?, ?, ?)
ON CONFLICT(pointId) DO UPDATE SET content=excluded.content, title=excluded.title
`;

/**
 * 根据 pointIds 查询 CHUNKS 表的 SQL 语句
 */
export const SELECT_CHUNKS_BY_POINT_IDS = `
SELECT pointId, content, title FROM chunks WHERE pointId IN (?)
`;

/**
 * 根据 pointIds 删除 CHUNKS 表的 SQL 语句
 */
export const DELETE_CHUNKS_BY_POINT_IDS = `
DELETE FROM chunks WHERE pointId IN (?)
`;

/**
 * 统计块数量的 SQL 语句
 */
export const COUNT_CHUNKS = `
SELECT COUNT(*) FROM chunk_meta
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
JOIN chunks c ON cm.pointId = c.pointId
JOIN docs d ON cm.docId = d.docId
WHERE cm.pointId IN (?)
  AND cm.collectionId = ?
  AND d.is_deleted = 0
`;