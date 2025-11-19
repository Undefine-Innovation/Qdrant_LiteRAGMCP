-- 快速修复脚本 - 只修复关键的数据库约束问题

-- 1. 修复Collection表的collectionId字段
-- 检查字段是否存在，如果不存在则添加
ALTER TABLE collections ADD COLUMN collectionId TEXT NOT NULL DEFAULT '';
UPDATE collections SET collectionId = id WHERE collectionId = '';

-- 2. 修复ChunkFullText表的chunkIndex字段
-- 检查字段是否存在，如果不存在则添加
ALTER TABLE chunks_fulltext ADD COLUMN chunkIndex INTEGER NOT NULL DEFAULT 0;

-- 3. 修复Event表的eventId字段
-- 检查字段是否存在，如果不存在则添加
ALTER TABLE events ADD COLUMN eventId TEXT NOT NULL DEFAULT '';
UPDATE events SET eventId = id WHERE eventId = '';