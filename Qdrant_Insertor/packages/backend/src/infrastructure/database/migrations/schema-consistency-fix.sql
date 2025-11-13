-- 架构Schema一致性修复脚本
-- 目的：将SQLite表结构与TypeORM Entity保持一致
-- 修改：将collectionId和docId列名改为id，修复缺失字段

-- 1. 备份原始数据
CREATE TABLE IF NOT EXISTS collections_bak AS SELECT * FROM collections;
CREATE TABLE IF NOT EXISTS docs_bak AS SELECT * FROM docs;
CREATE TABLE IF NOT EXISTS chunks_bak AS SELECT * FROM chunks;
CREATE TABLE IF NOT EXISTS chunk_meta_bak AS SELECT * FROM chunk_meta;
CREATE TABLE IF NOT EXISTS chunk_checksums_bak AS SELECT * FROM chunk_checksums;
CREATE TABLE IF NOT EXISTS system_metrics_bak AS SELECT * FROM system_metrics;
CREATE TABLE IF NOT EXISTS events_bak AS SELECT * FROM events;
CREATE TABLE IF NOT EXISTS alert_rules_bak AS SELECT * FROM alert_rules;
CREATE TABLE IF NOT EXISTS chunks_fulltext_bak AS SELECT * FROM chunks_fulltext;

-- 2. 删除旧表
DROP TABLE IF EXISTS collections;
DROP TABLE IF EXISTS docs;
DROP TABLE IF EXISTS chunks;
DROP TABLE IF EXISTS chunk_meta;
DROP TABLE IF EXISTS chunk_checksums;
DROP TABLE IF EXISTS system_metrics;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS alert_rules;
DROP TABLE IF EXISTS chunks_fulltext;
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
  "collectionId" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "description" text,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "config" text,
  "documentCount" integer DEFAULT 0 NOT NULL,
  "chunkCount" integer DEFAULT 0 NOT NULL,
  "lastSyncAt" integer,
  "deleted" integer DEFAULT 0,
  "deleted_at" integer,
  "version" integer DEFAULT 1
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
  "deleted" integer DEFAULT 0,
  "deleted_at" integer,
  "version" integer DEFAULT 1,
  "status" varchar(20) DEFAULT 'new' NOT NULL,
  FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE
);

-- 创建索引（参考TypeORM Entity中的@Index装饰器）
CREATE INDEX "IDX_collection_name" ON "collections" ("name");
CREATE UNIQUE INDEX "IDX_collection_collectionId" ON "collections" ("collectionId");
CREATE INDEX "IDX_collection_status" ON "collections" ("status");
CREATE INDEX "IDX_collection_created_at" ON "collections" ("created_at");
CREATE INDEX "IDX_collection_updated_at" ON "collections" ("updated_at");
CREATE UNIQUE INDEX "IDX_docs_collection_key" ON "docs" ("collectionId", "key");
CREATE INDEX "IDX_docs_deleted" ON "docs" ("deleted");
CREATE INDEX "IDX_docs_created_at" ON "docs" ("created_at");
CREATE INDEX "IDX_docs_updated_at" ON "docs" ("updated_at");
CREATE INDEX "IDX_docs_content_hash" ON "docs" ("content_hash");
CREATE INDEX "IDX_docs_mime" ON "docs" ("mime");

-- 参考旧的 chunks / chunk_meta / chunk_checksums 表结构，重新创建为新 schema
CREATE TABLE "chunks" (
  "id" text PRIMARY KEY NOT NULL,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  "deleted" integer DEFAULT 0,
  "deleted_at" integer,
  "version" integer DEFAULT 1,
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
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  "deleted" integer DEFAULT 0,
  "deleted_at" integer,
  "version" integer DEFAULT 1,
  "pointId" text NOT NULL,
  "docId" text NOT NULL,
  "collectionId" text NOT NULL,
  "chunkIndex" integer NOT NULL,
  "titleChain" text,
  "contentHash" text NOT NULL,
  UNIQUE("pointId"),
  FOREIGN KEY ("docId") REFERENCES "docs"("id") ON DELETE CASCADE,
  FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE
);

CREATE TABLE "chunk_checksums" (
  "id" text PRIMARY KEY NOT NULL,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  "deleted" integer DEFAULT 0,
  "deleted_at" integer,
  "version" integer DEFAULT 1,
  "pointId" text NOT NULL,
  "docId" text NOT NULL,
  "collectionId" text NOT NULL,
  "checksum" text NOT NULL,
  FOREIGN KEY ("pointId") REFERENCES "chunks"("pointId") ON DELETE CASCADE,
  FOREIGN KEY ("docId") REFERENCES "docs"("id") ON DELETE CASCADE,
  FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE
);

-- 创建 system_metrics 表（参考 SystemMetrics.ts）
CREATE TABLE "system_metrics" (
  "id" text PRIMARY KEY NOT NULL,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  "deleted" integer DEFAULT 0,
  "deleted_at" integer,
  "version" integer DEFAULT 1,
  "metric_name" text NOT NULL,
  "metric_value" real NOT NULL,
  "metric_unit" text,
  "metric_type" varchar(20) DEFAULT 'gauge' NOT NULL,
  "tags" text,
  "timestamp" integer NOT NULL,
  "source" text,
  "description" text,
  "sample_rate" real,
  "quantile" varchar(10)
);

-- 创建 events 表（参考 Event.ts）
CREATE TABLE "events" (
  "id" text PRIMARY KEY NOT NULL,
  "eventId" text NOT NULL UNIQUE,
  "eventType" varchar(100) NOT NULL,
  "aggregateId" varchar(255) NOT NULL,
  "aggregateType" varchar(100) NOT NULL,
  "occurredOn" bigint NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "metadata" text,
  "eventData" text NOT NULL,
  "processedAt" bigint,
  "processingStatus" varchar(20) DEFAULT 'pending' NOT NULL,
  "processingError" text,
  "retryCount" integer DEFAULT 0 NOT NULL,
  "source" varchar(100),
  "priority" integer DEFAULT 5 NOT NULL,
  "tags" text,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  "deleted" integer DEFAULT 0,
  "deleted_at" integer
);

-- 创建 alert_rules 表（参考 AlertRules.ts）
CREATE TABLE "alert_rules" (
  "id" text PRIMARY KEY NOT NULL,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  "deleted" integer DEFAULT 0,
  "deleted_at" integer,
  "version" integer DEFAULT 1,
  "name" varchar(255) NOT NULL UNIQUE,
  "description" text,
  "metric_name" varchar(255) NOT NULL,
  "condition_operator" varchar(10) NOT NULL,
  "threshold_value" real NOT NULL,
  "severity" varchar(20) NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "cooldown_minutes" integer DEFAULT 5 NOT NULL,
  "notification_channels" text,
  "rule_type" varchar(20) DEFAULT 'threshold' NOT NULL,
  "evaluation_interval_seconds" integer DEFAULT 60 NOT NULL,
  "duration_seconds" integer DEFAULT 300 NOT NULL,
  "last_evaluated_at" integer,
  "last_triggered_at" integer,
  "rule_expression" text,
  "rule_parameters" text,
  "tags" text,
  "created_by" varchar(100)
);

-- 创建 chunks_fulltext 表（参考 ChunkFullText.ts）
CREATE TABLE "chunks_fulltext" (
  "id" text PRIMARY KEY NOT NULL,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  "deleted" integer DEFAULT 0,
  "deleted_at" integer,
  "version" integer DEFAULT 1,
  "chunkId" text NOT NULL UNIQUE,
  "docId" text NOT NULL,
  "collectionId" text NOT NULL,
  "chunkIndex" integer NOT NULL,
  "contentLength" integer NOT NULL,
  "title" text,
  "content" text NOT NULL,
  "searchVector" text,
  "language" varchar(10) DEFAULT 'english' NOT NULL
);

-- 创建索引（参考TypeORM Entity中的@Index装饰器）
CREATE INDEX "IDX_system_metrics_metric_name" ON "system_metrics" ("metric_name");
CREATE INDEX "IDX_system_metrics_timestamp" ON "system_metrics" ("timestamp");
CREATE INDEX "IDX_system_metrics_metric_name_timestamp" ON "system_metrics" ("metric_name", "timestamp");
CREATE INDEX "IDX_system_metrics_metric_name_timestamp_tags" ON "system_metrics" ("metric_name", "timestamp", "tags");

CREATE INDEX "IDX_events_aggregateId_version" ON "events" ("aggregateId", "version");
CREATE INDEX "IDX_events_aggregateType" ON "events" ("aggregateType");
CREATE INDEX "IDX_events_eventType" ON "events" ("eventType");
CREATE INDEX "IDX_events_processedAt" ON "events" ("processedAt");
CREATE INDEX "IDX_events_aggregateId_eventType" ON "events" ("aggregateId", "eventType");
CREATE INDEX "IDX_events_occurredOn" ON "events" ("occurredOn");
CREATE INDEX "IDX_events_createdAt" ON "events" ("createdAt");
CREATE INDEX "IDX_events_updatedAt" ON "events" ("updatedAt");

CREATE INDEX "IDX_alert_rules_name" ON "alert_rules" ("name");
CREATE INDEX "IDX_alert_rules_metric_name" ON "alert_rules" ("metric_name");
CREATE INDEX "IDX_alert_rules_is_active" ON "alert_rules" ("is_active");
CREATE INDEX "IDX_alert_rules_severity" ON "alert_rules" ("severity");

CREATE INDEX "IDX_chunks_fulltext_chunkId" ON "chunks_fulltext" ("chunkId");
CREATE INDEX "IDX_chunks_fulltext_docId" ON "chunks_fulltext" ("docId");
CREATE INDEX "IDX_chunks_fulltext_collectionId" ON "chunks_fulltext" ("collectionId");
CREATE INDEX "IDX_chunks_fulltext_searchVector" ON "chunks_fulltext" ("searchVector");

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
INSERT INTO collections (id, created_at, updated_at, collectionId, name, description, status, config, documentCount, chunkCount, lastSyncAt, deleted, deleted_at, version)
SELECT
  collectionId as id,
  created_at,
  updated_at,
  collectionId,
  name,
  description,
  COALESCE(status, 'active') as status,
  config,
  COALESCE(documentCount, 0) as documentCount,
  COALESCE(chunkCount, 0) as chunkCount,
  lastSyncAt,
  COALESCE(deleted, 0) as deleted,
  deleted_at,
  COALESCE(version, 1) as version
FROM collections_bak;

-- 恢复docs表数据
INSERT INTO docs (id, collectionId, key, name, size_bytes, mime, content, content_hash, created_at, updated_at, deleted, deleted_at, version, status)
SELECT
  docId as id,
  collectionId,
  key,
  name,
  size_bytes,
  mime,
  content,
  content_hash,
  created_at,
  updated_at,
  COALESCE(is_deleted, 0) as deleted,
  CASE WHEN is_deleted = 1 THEN updated_at ELSE NULL END as deleted_at,
  1 as version,
  COALESCE(status, 'new') as status
FROM docs_bak;

-- 恢复 chunks 数据
INSERT INTO chunks (id, created_at, updated_at, deleted, deleted_at, version, pointId, docId, collectionId, chunkIndex, title, content)
SELECT
  pointId as id,
  created_at,
  updated_at,
  0 as deleted,
  NULL as deleted_at,
  1 as version,
  pointId,
  docId,
  collectionId,
  chunkIndex,
  title,
  content
FROM chunks_bak;

-- 恢复 chunk_meta 数据
INSERT INTO chunk_meta (id, created_at, updated_at, deleted, deleted_at, version, pointId, docId, collectionId, chunkIndex, titleChain, contentHash)
SELECT
  pointId as id,
  created_at,
  updated_at,
  0 as deleted,
  NULL as deleted_at,
  1 as version,
  pointId,
  docId,
  collectionId,
  chunkIndex,
  titleChain,
  contentHash
FROM chunk_meta_bak;

-- 恢复 chunk_checksums 数据
INSERT INTO chunk_checksums (id, created_at, updated_at, deleted, deleted_at, version, pointId, docId, collectionId, checksum)
SELECT
  pointId as id,
  created_at,
  updated_at,
  0 as deleted,
  NULL as deleted_at,
  1 as version,
  pointId,
  docId,
  collectionId,
  checksum
FROM chunk_checksums_bak;

-- 恢复 system_metrics 数据（如果备份表存在）
INSERT INTO system_metrics (id, created_at, updated_at, deleted, deleted_at, version, metric_name, metric_value, metric_unit, metric_type, tags, timestamp, source, description, sample_rate, quantile)
SELECT
  id,
  COALESCE(created_at, strftime('%s', 'now') * 1000) as created_at,
  COALESCE(updated_at, strftime('%s', 'now') * 1000) as updated_at,
  0 as deleted,
  NULL as deleted_at,
  1 as version,
  metric_name,
  metric_value,
  metric_unit,
  COALESCE(metric_type, 'gauge') as metric_type,
  tags,
  timestamp,
  source,
  description,
  sample_rate,
  quantile
FROM system_metrics_bak
WHERE EXISTS (SELECT 1 FROM system_metrics_bak LIMIT 1);

-- 恢复 events 数据（如果备份表存在）
INSERT INTO events (id, eventId, eventType, aggregateId, aggregateType, occurredOn, version, metadata, eventData, processedAt, processingStatus, processingError, retryCount, source, priority, tags, created_at, updated_at, deleted, deleted_at)
SELECT
  id,
  COALESCE(eventId, id) as eventId,
  eventType,
  aggregateId,
  aggregateType,
  occurredOn,
  COALESCE(version, 1) as version,
  metadata,
  eventData,
  processedAt,
  COALESCE(processingStatus, 'pending') as processingStatus,
  processingError,
  COALESCE(retryCount, 0) as retryCount,
  source,
  COALESCE(priority, 5) as priority,
  tags,
  COALESCE(createdAt, occurredOn, strftime('%s', 'now') * 1000) as created_at,
  COALESCE(updatedAt, occurredOn, strftime('%s', 'now') * 1000) as updated_at,
  COALESCE(deleted, 0) as deleted,
  deleted_at
FROM events_bak
WHERE EXISTS (SELECT 1 FROM events_bak LIMIT 1);

-- 恢复 alert_rules 数据（如果备份表存在）
INSERT INTO alert_rules (id, created_at, updated_at, deleted, deleted_at, version, name, description, metric_name, condition_operator, threshold_value, severity, is_active, cooldown_minutes, notification_channels, rule_type, evaluation_interval_seconds, duration_seconds, last_evaluated_at, last_triggered_at, rule_expression, rule_parameters, tags, created_by)
SELECT
  id,
  COALESCE(created_at, strftime('%s', 'now') * 1000) as created_at,
  COALESCE(updated_at, strftime('%s', 'now') * 1000) as updated_at,
  0 as deleted,
  NULL as deleted_at,
  1 as version,
  name,
  description,
  metric_name,
  condition_operator,
  threshold_value,
  severity,
  COALESCE(is_active, 1) as is_active,
  COALESCE(cooldown_minutes, 5) as cooldown_minutes,
  notification_channels,
  COALESCE(rule_type, 'threshold') as rule_type,
  COALESCE(evaluation_interval_seconds, 60) as evaluation_interval_seconds,
  COALESCE(duration_seconds, 300) as duration_seconds,
  last_evaluated_at,
  last_triggered_at,
  rule_expression,
  rule_parameters,
  tags,
  created_by
FROM alert_rules_bak
WHERE EXISTS (SELECT 1 FROM alert_rules_bak LIMIT 1);

-- 恢复 chunks_fulltext 数据（如果备份表存在）
INSERT INTO chunks_fulltext (id, created_at, updated_at, deleted, deleted_at, version, chunkId, docId, collectionId, chunkIndex, contentLength, title, content, searchVector, language)
SELECT
  id,
  COALESCE(created_at, strftime('%s', 'now') * 1000) as created_at,
  COALESCE(updated_at, strftime('%s', 'now') * 1000) as updated_at,
  0 as deleted,
  NULL as deleted_at,
  1 as version,
  chunkId,
  docId,
  collectionId,
  chunkIndex,
  COALESCE(contentLength, LENGTH(content)) as contentLength,
  title,
  content,
  searchVector,
  COALESCE(language, 'english') as language
FROM chunks_fulltext_bak
WHERE EXISTS (SELECT 1 FROM chunks_fulltext_bak LIMIT 1);

-- 5. 清理备份表（可选，建议在验证无误后执行）
-- DROP TABLE collections_bak;
-- DROP TABLE docs_bak;
-- DROP TABLE chunks_bak;
-- DROP TABLE chunk_meta_bak;
-- DROP TABLE chunk_checksums_bak;
-- DROP TABLE system_metrics_bak;
-- DROP TABLE events_bak;
-- DROP TABLE alert_rules_bak;
-- DROP TABLE chunks_fulltext_bak;