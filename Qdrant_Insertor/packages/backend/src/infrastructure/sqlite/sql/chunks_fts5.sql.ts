/**
 * CHUNKS_FTS5 表相关的 SQL 语句
 */

/**
 * 创建 CHUNKS_FTS5 全文搜索虚拟表的 SQL 语句
 */
export const CREATE_TABLE_CHUNKS_FTS5 = `
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts5
USING fts5(content, title, tokenize='porter', content='chunks', content_rowid='pointId')`;

/**
 * 创建 CHUNKS_FTS5 触发器的 SQL 语句
 */
export const CREATE_CHUNKS_FTS5_TRIGGERS = `
-- 触发器：当chunks 表插入时，自动插入到 chunks_fts5
CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts5(rowid, content, title) VALUES (NEW.pointId, NEW.content, NEW.title);
END;

-- 触发器：当chunks 表更新时，自动更新chunks_fts5
CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
  INSERT INTO chunks_fts5(chunks_fts5, rowid, content, title) VALUES ('delete', OLD.pointId, OLD.content, OLD.title);
  INSERT INTO chunks_fts5(rowid, content, title) VALUES (NEW.pointId, NEW.content, NEW.title);
END;

-- 触发器：当chunks 表删除时，自动从 chunks_fts5 删除
CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts5(chunks_fts5, rowid, content, title) VALUES ('delete', OLD.pointId, OLD.content, OLD.title);
END`;

/**
 * 批量插入到CHUNKS_FTS5 表的 SQL 语句
 */
export const INSERT_CHUNKS_FTS5_BATCH = `
INSERT INTO chunks_fts5(rowid, content, title) VALUES (?, ?, ?)`;

/**
 * 在CHUNKS_FTS5 表中搜索的SQL 语句
 */
export const SEARCH_CHUNKS_FTS5 = `
SELECT
  c.pointId,
  c.docId,
  c.collectionId,
  c.chunkIndex,
  c.title,
  c.content,
  d.name as doc_name,
  d.is_deleted as doc_is_deleted
FROM chunks_fts5 fts
JOIN chunks c ON fts.rowid = c.pointId
JOIN docs d ON c.docId = d.docId
WHERE chunks_fts5 MATCH ?
  AND d.is_deleted = 0
ORDER BY rank
LIMIT ?`;

/**
 * 在指定集合中搜索 CHUNKS_FTS5 的SQL 语句
 */
export const SEARCH_CHUNKS_FTS5_BY_COLLECTION = `
SELECT
  c.pointId,
  c.docId,
  c.collectionId,
  c.chunkIndex,
  c.title,
  c.content,
  d.name as doc_name,
  d.is_deleted as doc_is_deleted
FROM chunks_fts5 fts
JOIN chunks c ON fts.rowid = c.pointId
JOIN docs d ON c.docId = d.docId
WHERE chunks_fts5 MATCH ?
  AND c.collectionId = ?
  AND d.is_deleted = 0
ORDER BY rank
LIMIT ?`;

/**
 * 根据文档 ID 搜索 CHUNKS_FTS5 的SQL 语句
 */
export const SEARCH_CHUNKS_FTS5_BY_DOC = `
SELECT
  c.pointId,
  c.docId,
  c.collectionId,
  c.chunkIndex,
  c.title,
  c.content,
  d.name as doc_name,
  d.is_deleted as doc_is_deleted
FROM chunks_fts5 fts
JOIN chunks c ON fts.rowid = c.pointId
JOIN docs d ON c.docId = d.docId
WHERE chunks_fts5 MATCH ?
  AND c.docId = ?
  AND d.is_deleted = 0
ORDER BY rank
LIMIT ?`;

/**
 * 根据 point IDs 批量删除 CHUNKS_FTS5 记录的SQL 语句
 */
export const DELETE_CHUNKS_FTS5_BATCH = `
DELETE FROM chunks_fts5 WHERE rowid IN (?)`;

/**
 * 根据 doc ID 删除 CHUNKS_FTS5 记录的SQL 语句
 */
export const DELETE_CHUNKS_FTS5_BY_DOC_ID = `
DELETE FROM chunks_fts5
WHERE rowid IN (
  SELECT pointId FROM chunks WHERE docId = ?
)`;

/**
 * 根据 collection ID 删除 CHUNKS_FTS5 记录的SQL 语句
 */
export const DELETE_CHUNKS_FTS5_BY_COLLECTION_ID = `
DELETE FROM chunks_fts5
WHERE rowid IN (
  SELECT pointId FROM chunks WHERE collectionId = ?
)`;

/**
 * 重建 CHUNKS_FTS5 索引的SQL 语句
 */
export const REBUILD_CHUNKS_FTS5 = `
INSERT INTO chunks_fts5(chunks_fts5) VALUES('rebuild')`;

/**
 * 优化 CHUNKS_FTS5 索引的SQL 语句
 */
export const OPTIMIZE_CHUNKS_FTS5 = `
INSERT INTO chunks_fts5(chunks_fts5) VALUES('optimize')`;