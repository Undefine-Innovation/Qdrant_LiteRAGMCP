-- migrations/001_initial_schema.sql

-- 创建 Collection 表
CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 创建 Doc 表
CREATE TABLE IF NOT EXISTS docs (
    id TEXT PRIMARY KEY NOT NULL,
    collection_id TEXT NOT NULL,
    name TEXT NOT NULL,
    mime_type TEXT,
    size_bytes INTEGER,
    content_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

-- 创建 Chunk 表
CREATE TABLE IF NOT EXISTS chunks (
    point_id TEXT PRIMARY KEY NOT NULL, -- docId#chunkIndex
    doc_id TEXT NOT NULL,
    collection_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    title_chain TEXT,
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (doc_id) REFERENCES docs(id) ON DELETE CASCADE,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

-- 为 Chunk 内容创建 FTS5 索引
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(content, title_chain, tokenize='porter', content='chunks', content_rowid='point_id');

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


-- 创建 SyncJob 表
CREATE TABLE IF NOT EXISTS sync_jobs (
    id TEXT PRIMARY KEY NOT NULL,
    doc_id TEXT NOT NULL,
    status TEXT NOT NULL, -- NEW, SPLIT_OK, EMBED_OK, SYNCED, FAILED, RETRYING, DEAD
    retries INTEGER DEFAULT 0,
    last_attempt_at INTEGER,
    error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (doc_id) REFERENCES docs(id) ON DELETE CASCADE
);

-- 创建 ChunkChecksum 表
CREATE TABLE IF NOT EXISTS chunk_checksums (
    point_id TEXT PRIMARY KEY NOT NULL,
    doc_id TEXT NOT NULL,
    collection_id TEXT NOT NULL,
    checksum TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (point_id) REFERENCES chunks(point_id) ON DELETE CASCADE,
    FOREIGN KEY (doc_id) REFERENCES docs(id) ON DELETE CASCADE,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);