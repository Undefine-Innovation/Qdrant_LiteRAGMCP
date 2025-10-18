/**
 * CHUNKS_FTS5 表相关的 SQL 语句
 */

/**
 * 创建 CHUNKS_FTS5 全文搜索虚拟表的 SQL 语句
 */
export const CREATE_TABLE_CHUNKS_FTS5 = `
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  content, 
  title_chain, 
  tokenize='porter', 
  content='chunks', 
  content_rowid='point_id'
)
`;

/**
 * 创建 CHUNKS_FTS5 触发器的 SQL 语句
 */
export const CREATE_CHUNKS_FTS5_TRIGGERS = `
-- 触发器：在 chunks 表插入时，自动插入到 chunks_fts
CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts(rowid, content, title_chain) VALUES (NEW.point_id, NEW.content, NEW.title_chain);
END;

-- 触发器：在 chunks 表更新时，自动更新 chunks_fts
CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, content, title_chain) VALUES ('delete', OLD.point_id, OLD.content, OLD.title_chain);
  INSERT INTO chunks_fts(rowid, content, title_chain) VALUES (NEW.point_id, NEW.content, NEW.title_chain);
END;

-- 触发器：在 chunks 表删除时，自动从 chunks_fts 删除
CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, content, title_chain) VALUES ('delete', OLD.point_id, OLD.content, OLD.title_chain);
END;
`;

/**
 * 批量插入到 CHUNKS_FTS5 表的 SQL 语句
 */
export const INSERT_CHUNKS_FTS5_BATCH = `
INSERT INTO chunks_fts(rowid, content, title_chain) VALUES (?, ?, ?)
`;

/**
 * 在 CHUNKS_FTS5 表中搜索的 SQL 语句
 */
export const SEARCH_CHUNKS_FTS5 = `
SELECT
  c.point_id,
  c.doc_id,
  c.collection_id,
  c.chunk_index,
  c.title_chain,
  c.content,
  c.content_hash,
  c.created_at,
  d.name as doc_name,
  d.is_deleted as doc_is_deleted
FROM chunks_fts fts
JOIN chunks c ON fts.rowid = c.point_id
JOIN docs d ON c.doc_id = d.id
WHERE chunks_fts MATCH ?
  AND d.is_deleted = 0
ORDER BY rank
LIMIT ?
`;

/**
 * 在指定集合中搜索 CHUNKS_FTS5 的 SQL 语句
 */
export const SEARCH_CHUNKS_FTS5_BY_COLLECTION = `
SELECT
  c.point_id,
  c.doc_id,
  c.collection_id,
  c.chunk_index,
  c.title_chain,
  c.content,
  c.content_hash,
  c.created_at,
  d.name as doc_name,
  d.is_deleted as doc_is_deleted
FROM chunks_fts fts
JOIN chunks c ON fts.rowid = c.point_id
JOIN docs d ON c.doc_id = d.id
WHERE chunks_fts MATCH ?
  AND c.collection_id = ?
  AND d.is_deleted = 0
ORDER BY rank
LIMIT ?
`;

/**
 * 根据文档 ID 搜索 CHUNKS_FTS5 的 SQL 语句
 */
export const SEARCH_CHUNKS_FTS5_BY_DOC = `
SELECT
  c.point_id,
  c.doc_id,
  c.collection_id,
  c.chunk_index,
  c.title_chain,
  c.content,
  c.content_hash,
  c.created_at,
  d.name as doc_name,
  d.is_deleted as doc_is_deleted
FROM chunks_fts fts
JOIN chunks c ON fts.rowid = c.point_id
JOIN docs d ON c.doc_id = d.id
WHERE chunks_fts MATCH ?
  AND c.doc_id = ?
  AND d.is_deleted = 0
ORDER BY rank
LIMIT ?
`;

/**
 * 根据 point IDs 删除 CHUNKS_FTS5 记录的 SQL 语句
 */
export const DELETE_CHUNKS_FTS5_BY_POINT_IDS = `
DELETE FROM chunks_fts WHERE rowid IN (?)
`;

/**
 * 根据 doc ID 删除 CHUNKS_FTS5 记录的 SQL 语句
 */
export const DELETE_CHUNKS_FTS5_BY_DOC_ID = `
DELETE FROM chunks_fts 
WHERE rowid IN (
  SELECT point_id FROM chunks WHERE doc_id = ?
)
`;

/**
 * 根据 collection ID 删除 CHUNKS_FTS5 记录的 SQL 语句
 */
export const DELETE_CHUNKS_FTS5_BY_COLLECTION_ID = `
DELETE FROM chunks_fts 
WHERE rowid IN (
  SELECT point_id FROM chunks WHERE collection_id = ?
)
`;

/**
 * 重建 CHUNKS_FTS5 索引的 SQL 语句
 */
export const REBUILD_CHUNKS_FTS5 = `
INSERT INTO chunks_fts(chunks_fts) VALUES('rebuild')
`;

/**
 * 优化 CHUNKS_FTS5 索引的 SQL 语句
 */
export const OPTIMIZE_CHUNKS_FTS5 = `
INSERT INTO chunks_fts(chunks_fts) VALUES('optimize')
`;