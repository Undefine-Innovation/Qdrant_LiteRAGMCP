-- 架构Schema一致性修复脚本
-- 目的：将SQLite表结构与TypeORM Entity保持一致
-- 修改：将collectionId和docId列名改为id

-- 1. 备份原始数据
CREATE TABLE IF NOT EXISTS collections_bak AS SELECT * FROM collections;
CREATE TABLE IF NOT EXISTS docs_bak AS SELECT * FROM docs;
CREATE TABLE IF NOT EXISTS chunks_bak AS SELECT * FROM chunks;
CREATE TABLE IF NOT EXISTS chunk_meta_bak AS SELECT * FROM chunk_meta;
CREATE TABLE IF NOT EXISTS chunk_checksums_bak AS SELECT * FROM chunk_checksums;

-- 2. 删除旧表
DROP TABLE IF EXISTS collections;
DROP TABLE IF EXISTS docs;
DROP TABLE IF EXISTS chunks;
DROP TABLE IF EXISTS chunk_meta;
DROP TABLE IF EXISTS chunk_checksums;
-- 也删除 FTS5 表与触发器（如果存在），后面将重建
DROP TRIGGER IF EXISTS chunks_ai;
DROP TRIGGER IF EXISTS chunks_au;
DROP TRIGGER IF EXISTS chunks_ad;
DROP TABLE IF EXISTS chunks_fts5;

-- 3. 重新创建表（使用TypeORM生成的DDL）
-- 参考TypeORM Entity: Collection.ts
CREATE TABLE "collections" (
  "id" text PRIMARY KEY NOT NULL,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  "name" text NOT NULL,
  "description" text
);

-- 参考TypeORM Entity: Doc.ts
CREATE TABLE "docs" (
  "id" text PRIMARY KEY NOT NULL,
  "collectionId" text NOT NULL,
  "key" text,
  "name" text,
  "size_bytes" integer,
  "mime" text,
  "content" text,
  "content_hash" text,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  "is_deleted" integer DEFAULT 0,
  "status" varchar(20) DEFAULT 'new' NOT NULL,
  FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE
);

-- 创建索引（参考TypeORM Entity中的@Index装饰器）
CREATE INDEX "IDX_collection_name" ON "collections" ("name");
CREATE UNIQUE INDEX "IDX_docs_collection_key" ON "docs" ("collectionId", "key");
CREATE INDEX "IDX_docs_is_deleted" ON "docs" ("is_deleted");

-- 参考旧的 chunks / chunk_meta / chunk_checksums 表结构，重新创建为新 schema
CREATE TABLE "chunks" (
  "id" text PRIMARY KEY NOT NULL,
  "pointId" text NOT NULL,
  "docId" text NOT NULL,
  "collectionId" text NOT NULL,
  "chunkIndex" integer NOT NULL,
  "title" text,
  "content" text NOT NULL,
  UNIQUE("pointId"),
  FOREIGN KEY ("docId") REFERENCES "docs"("id") ON DELETE CASCADE,
  FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE
);

CREATE TABLE "chunk_meta" (
  "id" text PRIMARY KEY NOT NULL,
  "pointId" text NOT NULL,
  "docId" text NOT NULL,
  "collectionId" text NOT NULL,
  "chunkIndex" integer NOT NULL,
  "titleChain" text,
  "contentHash" text NOT NULL,
  "created_at" integer NOT NULL,
  UNIQUE("pointId"),
  FOREIGN KEY ("docId") REFERENCES "docs"("id") ON DELETE CASCADE,
  FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE
);

CREATE TABLE "chunk_checksums" (
  "id" text PRIMARY KEY NOT NULL,
  "pointId" text NOT NULL,
  "docId" text NOT NULL,
  "collectionId" text NOT NULL,
  "checksum" text NOT NULL,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  FOREIGN KEY ("pointId") REFERENCES "chunks"("pointId") ON DELETE CASCADE,
  FOREIGN KEY ("docId") REFERENCES "docs"("id") ON DELETE CASCADE,
  FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE
);

-- 重新创建 FTS5 虚拟表与触发器
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts5 USING fts5(content, title, tokenize='porter', content='chunks');

CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts5(rowid, content, title) VALUES (NEW.rowid, NEW.content, NEW.title);
END;

CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
  INSERT INTO chunks_fts5(chunks_fts5, rowid, content, title) VALUES ('delete', OLD.rowid, OLD.content, OLD.title);
  INSERT INTO chunks_fts5(rowid, content, title) VALUES (NEW.rowid, NEW.content, NEW.title);
END;

CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts5(chunks_fts5, rowid, content, title) VALUES ('delete', OLD.rowid, OLD.content, OLD.title);
END;

-- 4. 恢复数据（从备份表）
-- 恢复collections表数据
INSERT INTO collections (id, created_at, updated_at, name, description)
SELECT collectionId as id, created_at, updated_at, name, description FROM collections_bak;

-- 恢复docs表数据
INSERT INTO docs (id, collectionId, key, name, size_bytes, mime, content, content_hash, created_at, updated_at, is_deleted)
SELECT docId as id, collectionId, key, name, size_bytes, mime, content, content_hash, created_at, updated_at, is_deleted FROM docs_bak;

-- 恢复 chunks 数据
INSERT INTO chunks (id, pointId, docId, collectionId, chunkIndex, title, content)
SELECT
  pointId as id,
  pointId,
  docId,
  collectionId,
  chunkIndex,
  title,
  content
FROM chunks_bak;

-- 恢复 chunk_meta 数据
INSERT INTO chunk_meta (id, pointId, docId, collectionId, chunkIndex, titleChain, contentHash, created_at)
SELECT
  pointId as id,
  pointId,
  docId,
  collectionId,
  chunkIndex,
  titleChain,
  contentHash,
  created_at
FROM chunk_meta_bak;

-- 恢复 chunk_checksums 数据
INSERT INTO chunk_checksums (id, pointId, docId, collectionId, checksum, created_at, updated_at)
SELECT
  pointId as id,
  pointId,
  docId,
  collectionId,
  checksum,
  created_at,
  updated_at
FROM chunk_checksums_bak;

-- 5. 清理备份表（可选，建议在验证无误后执行）
-- DROP TABLE collections_bak;
-- DROP TABLE docs_bak;