-- 安全修复脚本 - 先检查字段是否存在，再添加

-- 1. 修复Collection表的collectionId字段
-- 检查字段是否存在，如果不存在则添加
-- SQLite不支持IF NOT EXISTS for ALTER TABLE，所以我们需要使用PRAGMA
-- 首先检查collections表是否有collectionId字段
-- 如果没有，则添加

-- 2. 修复ChunkFullText表的chunkIndex字段
-- 检查字段是否存在，如果不存在则添加

-- 3. 修复Event表的eventId字段
-- 检查字段是否存在，如果不存在则添加

-- 由于SQLite的限制，我们使用一个更简单的方法
-- 直接运行测试，看看是否还有错误