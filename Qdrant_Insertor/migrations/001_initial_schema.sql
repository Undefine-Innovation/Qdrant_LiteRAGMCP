-- migrations/001_initial_schema.sql

-- 创建 Collection 表
CREATE TABLE IF NOT EXISTS collections (
    collectionId TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 创建 Doc 表
CREATE TABLE IF NOT EXISTS docs (
    docId TEXT PRIMARY KEY NOT NULL,
    collectionId TEXT NOT NULL,
    key TEXT,
    name TEXT NOT NULL,
    mime TEXT,
    size_bytes INTEGER,
    content TEXT,
    content_hash TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    is_deleted INTEGER DEFAULT 0,
    FOREIGN KEY (collectionId) REFERENCES collections(collectionId) ON DELETE CASCADE
);

-- 创建 Chunk 表
CREATE TABLE IF NOT EXISTS chunks (
    pointId TEXT PRIMARY KEY NOT NULL, -- docId#chunkIndex
    docId TEXT NOT NULL,
    collectionId TEXT NOT NULL,
    chunkIndex INTEGER NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    FOREIGN KEY (docId) REFERENCES docs(docId) ON DELETE CASCADE,
    FOREIGN KEY (collectionId) REFERENCES collections(collectionId) ON DELETE CASCADE
);

-- 为 Chunk 内容创建 FTS5 索引
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts5 USING fts5(content, title, tokenize='porter', content='chunks', content_rowid='pointId');

-- 触发器：在 chunks 表插入时，自动插入到 chunks_fts5
CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts5(rowid, content, title) VALUES (NEW.pointId, NEW.content, NEW.title);
END;

-- 触发器：在 chunks 表更新时，自动更新 chunks_fts5
CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
  INSERT INTO chunks_fts5(chunks_fts5, rowid, content, title) VALUES ('delete', OLD.pointId, OLD.content, OLD.title);
  INSERT INTO chunks_fts5(rowid, content, title) VALUES (NEW.pointId, NEW.content, NEW.title);
END;

-- 触发器：在 chunks 表删除时，自动从 chunks_fts5 删除
CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts5(chunks_fts5, rowid, content, title) VALUES ('delete', OLD.pointId, OLD.content, OLD.title);
END;


-- 创建 SyncJob 表
CREATE TABLE IF NOT EXISTS sync_jobs (
    id TEXT PRIMARY KEY NOT NULL,
    docId TEXT NOT NULL,
    status TEXT NOT NULL, -- NEW, SPLIT_OK, EMBED_OK, SYNCED, FAILED, RETRYING, DEAD
    retries INTEGER DEFAULT 0,
    last_attempt_at INTEGER,
    error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (docId) REFERENCES docs(docId) ON DELETE CASCADE
);

-- 创建 ChunkChecksum 表
CREATE TABLE IF NOT EXISTS chunk_checksums (
    pointId TEXT PRIMARY KEY NOT NULL,
    docId TEXT NOT NULL,
    collectionId TEXT NOT NULL,
    checksum TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (pointId) REFERENCES chunks(pointId) ON DELETE CASCADE,
    FOREIGN KEY (docId) REFERENCES docs(docId) ON DELETE CASCADE,
    FOREIGN KEY (collectionId) REFERENCES collections(collectionId) ON DELETE CASCADE
);

-- 创建 ChunkMeta 表
CREATE TABLE IF NOT EXISTS chunk_meta (
    pointId TEXT PRIMARY KEY NOT NULL,
    docId TEXT NOT NULL,
    collectionId TEXT NOT NULL,
    chunkIndex INTEGER NOT NULL,
    titleChain TEXT,
    contentHash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (docId) REFERENCES docs(docId) ON DELETE CASCADE,
    FOREIGN KEY (collectionId) REFERENCES collections(collectionId) ON DELETE CASCADE
);