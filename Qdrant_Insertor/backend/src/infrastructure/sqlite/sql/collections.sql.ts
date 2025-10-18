/**
 * COLLECTIONS 表相关的 SQL 语句
 */

/**
 * 创建 COLLECTIONS 表的 SQL 语句
 */
export const CREATE_TABLE_COLLECTIONS = `
CREATE TABLE IF NOT EXISTS collections (
  collectionId TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL
);
`;

/**
 * 插入新集合的 SQL 语句
 */
export const INSERT_COLLECTION = `
INSERT INTO collections (collectionId, name, description, created_at)
VALUES (?, ?, ?, ?)
`;

/**
 * 根据 ID 查询集合的 SQL 语句
 */
export const SELECT_COLLECTION_BY_ID = `
SELECT * FROM collections WHERE collectionId = ?
`;

/**
 * 根据名称查询集合的 SQL 语句
 */
export const SELECT_COLLECTION_BY_NAME = `
SELECT * FROM collections WHERE name = ?
`;

/**
 * 查询所有集合的 SQL 语句，按创建时间降序排序
 */
export const SELECT_ALL_COLLECTIONS = `
SELECT * FROM collections ORDER BY created_at DESC
`;

/**
 * 更新集合信息的 SQL 语句
 */
export const UPDATE_COLLECTION = `
UPDATE collections
SET name = COALESCE(?, name), description = COALESCE(?, description)
WHERE collectionId = ?
`;

/**
 * 删除集合的 SQL 语句
 */
export const DELETE_COLLECTION_BY_ID = `
DELETE FROM collections WHERE collectionId = ?
`;

/**
 * 统计集合数量的 SQL 语句
 */
export const COUNT_COLLECTIONS = `
SELECT COUNT(*) FROM collections
`;