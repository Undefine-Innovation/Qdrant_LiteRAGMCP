/**
 * CHUNK_META 表相关的 SQL 语句
 */

/**
 * 创建 CHUNK_META 表的 SQL 语句
 */
export const CREATE_TABLE_CHUNK_META = `
CREATE TABLE IF NOT EXISTS chunk_meta (
  pointId TEXT PRIMARY KEY,
  docId TEXT NOT NULL,
  collectionId TEXT NOT NULL,
  chunkIndex INTEGER NOT NULL,
  titleChain TEXT,
  contentHash TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(docId) REFERENCES docs(docId) ON DELETE CASCADE,
  FOREIGN KEY(collectionId) REFERENCES collections(collectionId) ON DELETE CASCADE
);`;

// DEPRECATED: Version concept has been removed from the architecture

/**
 * 插入单个块元数据的 SQL 语句
 */
export const INSERT_CHUNK_META = `
INSERT INTO chunk_meta (
   pointId, docId, collectionId, chunkIndex, titleChain, contentHash, created_at
) VALUES (?, ?, ?, ?, ?, ?, ?)`;

/**
 * 批量插入块元数据的 SQL 语句
 */
export const INSERT_CHUNK_BATCH = `
 INSERT INTO chunk_meta (
    pointId, docId, collectionId, chunkIndex, titleChain, contentHash, created_at
 ) VALUES (?, ?, ?, ?, ?, ?, ?)
 ON CONFLICT(pointId) DO UPDATE SET
   docId=excluded.docId,
   collectionId=excluded.collectionId,
   chunkIndex=excluded.chunkIndex,
   titleChain=excluded.titleChain,
   contentHash=excluded.contentHash,
   created_at=excluded.created_at
`;

/**
 * 根据 pointId 查询块元数据的 SQL 语句
 */
export const SELECT_CHUNK_BY_POINT_ID = `
SELECT * FROM chunk_meta WHERE pointId = ?`;

/**
 * 根据 pointIds 批量查询块元数据的 SQL 语句
 */
export const SELECT_CHUNKS_BY_POINT_IDS = `
SELECT
  cm.pointId,
  cm.collectionId AS collectionId,
  cm.titleChain AS titleChain,
  cm.docId,
  cm.chunkIndex
FROM chunk_meta cm
JOIN docs d ON cm.docId = d.docId
WHERE cm.pointId IN (?)
  AND d.is_deleted = 0
ORDER BY cm.chunkIndex ASC`;

/**
 * 根据 docId 查询块元数据的 SQL 语句
 */
export const SELECT_CHUNKS_BY_DOC_ID = `
SELECT * FROM chunk_meta WHERE docId = ? ORDER BY chunkIndex ASC`;

/**
 * 根据 collectionId 查询块元数据的 SQL 语句
 */
export const SELECT_CHUNKS_BY_COLLECTION_ID = `
SELECT
  cm.pointId,
  cm.collectionId,
  cm.titleChain,
  cm.docId,
  cm.chunkIndex
FROM chunk_meta cm
JOIN docs d ON cm.docId = d.docId
WHERE cm.collectionId = ?
  AND d.is_deleted = 0
ORDER BY cm.chunkIndex ASC`;

/**
 * 根据 pointIds 批量查询块元数据和内容的 SQL 语句
 */
export const SELECT_CHUNKS_AND_CONTENT_BY_POINT_IDS = `
SELECT
 cm.pointId,
 c.content,
 c.title
FROM chunk_meta cm
JOIN chunks c ON cm.pointId = c.pointId
WHERE cm.pointId IN (?)`;

/**
 * 根据 pointIds 批量查询块详细信息的 SQL 语句
 */
export const SELECT_CHUNKS_DETAILS_BY_POINT_IDS = `
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
 AND d.is_deleted = 0`;

/**
 * 根据 docId 删除块元数据的 SQL 语句
 */
export const DELETE_CHUNKS_BY_DOC_ID = `
DELETE FROM chunk_meta WHERE docId = ?`;

/**
 * 根据版本 ID 查询块元数据的 SQL 语句，按块索引升序排序
 */
// DEPRECATED: SELECT_CHUNKS_BY_VERSION_ID has been removed as Version concept is no longer supported

/**
 * 统计块元数据数量的 SQL 语句
 */
export const COUNT_CHUNKS_META = `
SELECT COUNT(*) FROM chunk_meta`;

/**
 * 根据 collectionId 删除块元数据的 SQL 语句
 */
export const DELETE_CHUNKS_BY_COLLECTION_ID = `
DELETE FROM chunk_meta WHERE collectionId = ?`;

/**
 * 根据 pointId 批量删除块元数据的 SQL 语句
 */
export const DELETE_CHUNKS_META_BATCH = `
DELETE FROM chunk_meta WHERE pointId IN (?)`;
