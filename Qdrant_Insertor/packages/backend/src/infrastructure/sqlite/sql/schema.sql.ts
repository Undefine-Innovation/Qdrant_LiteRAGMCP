/**
 * 数据库架构初始化相关的SQL 语句
 */

/**
 * 创建初始数据库架构的 SQL 语句
 * 包含所有基础表结构
 */
export const CREATE_INITIAL_SCHEMA = `
CREATE TABLE IF NOT EXISTS collections (
    collectionId TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

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

CREATE TABLE IF NOT EXISTS chunks (
    pointId TEXT PRIMARY KEY NOT NULL,
    docId TEXT NOT NULL,
    collectionId TEXT NOT NULL,
    chunkIndex INTEGER NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    FOREIGN KEY (docId) REFERENCES docs(docId) ON DELETE CASCADE,
    FOREIGN KEY (collectionId) REFERENCES collections(collectionId) ON DELETE CASCADE
);

CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts5 USING fts5(content, title, tokenize='porter', content='chunks', content_rowid='pointId');

CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts5(rowid, content, title) VALUES (NEW.pointId, NEW.content, NEW.title);
END;

CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
  INSERT INTO chunks_fts5(chunks_fts5, rowid, content, title) VALUES ('delete', OLD.pointId, OLD.content, OLD.title);
  INSERT INTO chunks_fts5(rowid, content, title) VALUES (NEW.pointId, NEW.content, NEW.title);
END;

CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts5(chunks_fts5, rowid, content, title) VALUES ('delete', OLD.pointId, OLD.content, OLD.title);
END;

CREATE TABLE IF NOT EXISTS sync_jobs (
    id TEXT PRIMARY KEY NOT NULL,
    docId TEXT NOT NULL,
    status TEXT NOT NULL,
    retries INTEGER DEFAULT 0,
    last_attempt_at INTEGER,
    error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (docId) REFERENCES docs(docId) ON DELETE CASCADE
);

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
);`;

/**
 * 创建监控和持久化功能的SQL 语句
 */
export const CREATE_MONITORING_SCHEMA = `
ALTER TABLE sync_jobs ADD COLUMN started_at INTEGER;
ALTER TABLE sync_jobs ADD COLUMN completed_at INTEGER;
ALTER TABLE sync_jobs ADD COLUMN duration_ms INTEGER;
ALTER TABLE sync_jobs ADD COLUMN error_category TEXT;
ALTER TABLE sync_jobs ADD COLUMN last_retry_strategy TEXT;
ALTER TABLE sync_jobs ADD COLUMN progress INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS system_metrics (
    id TEXT PRIMARY KEY NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    metric_unit TEXT,
    tags TEXT,
    timestamp INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS alert_rules (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    metric_name TEXT NOT NULL,
    condition_operator TEXT NOT NULL,
    threshold_value REAL NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    is_active INTEGER DEFAULT 1,
    cooldown_minutes INTEGER DEFAULT 5,
    notification_channels TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS alert_history (
    id TEXT PRIMARY KEY NOT NULL,
    rule_id TEXT NOT NULL,
    metric_value REAL NOT NULL,
    threshold_value REAL NOT NULL,
    severity TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('triggered', 'resolved', 'suppressed')),
    message TEXT,
    triggered_at INTEGER NOT NULL,
    resolved_at INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS system_health (
    id TEXT PRIMARY KEY NOT NULL,
    component TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
    last_check INTEGER NOT NULL,
    response_time_ms INTEGER,
    error_message TEXT,
    details TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_job_stats (
    id TEXT PRIMARY KEY NOT NULL,
    date TEXT NOT NULL,
    total_jobs INTEGER DEFAULT 0,
    successful_jobs INTEGER DEFAULT 0,
    failed_jobs INTEGER DEFAULT 0,
    retried_jobs INTEGER DEFAULT 0,
    average_duration_ms INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(date)
);

CREATE TABLE IF NOT EXISTS retry_history (
    id TEXT PRIMARY KEY NOT NULL,
    doc_id TEXT NOT NULL,
    sync_job_id TEXT,
    error_category TEXT NOT NULL,
    error_message TEXT,
    retry_count INTEGER NOT NULL,
    strategy TEXT,
    status TEXT NOT NULL CHECK (status IN ('scheduled', 'success', 'failed', 'cancelled')),
    scheduled_at INTEGER NOT NULL,
    executed_at INTEGER,
    completed_at INTEGER,
    duration_ms INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (sync_job_id) REFERENCES sync_jobs(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS notification_channels (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('webhook', 'email', 'slack', 'log')),
    config TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_docId ON sync_jobs(docId);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_updated_at ON sync_jobs(updated_at);
CREATE INDEX IF NOT EXISTS idx_system_metrics_name_timestamp ON system_metrics(metric_name, timestamp);
CREATE INDEX IF NOT EXISTS idx_alert_history_rule_id ON alert_history(rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_triggered_at ON alert_history(triggered_at);
CREATE INDEX IF NOT EXISTS idx_system_health_component ON system_health(component);
CREATE INDEX IF NOT EXISTS idx_retry_history_doc_id ON retry_history(doc_id);
CREATE INDEX IF NOT EXISTS idx_retry_history_status ON retry_history(status);

INSERT OR IGNORE INTO alert_rules (
    id, name, description, metric_name, condition_operator, threshold_value,
    severity, is_active, cooldown_minutes, notification_channels, created_at, updated_at
) VALUES
(
    'alert_high_failure_rate',
    '高失败率告警',
    '当同步作业失败率超过20%时触发告警',
    'sync_failure_rate',
    '>',
    0.2,
    'high',
    1,
    10,
    '["log"]',
    strftime('%s', 'now'),
    strftime('%s', 'now')
),
(
    'alert_long_running_jobs',
    '长时间运行作业告警',
    '当同步作业运行时间超过10分钟时触发告警',
    'sync_job_duration',
    '>',
    600000,
    'medium',
    1,
    5,
    '["log"]',
    strftime('%s', 'now'),
    strftime('%s', 'now')
),
(
    'alert_system_unhealthy',
    '系统不健康告警',
    '当任何系统组件状态为不健康时触发告警',
    'system_health_status',
    '==',
    0,
    'critical',
    1,
    2,
    '["log"]',
    strftime('%s', 'now'),
    strftime('%s', 'now')
);

INSERT OR IGNORE INTO notification_channels (
    id, name, type, config, is_active, created_at, updated_at
) VALUES
(
    'channel_log',
    '日志通知',
    'log',
    '{"level": "warn"}',
    1,
    strftime('%s', 'now'),
    strftime('%s', 'now')
);`;

/**
 * 检查表是否存在的SQL 语句
 */
export const CHECK_TABLE_EXISTS = `
SELECT name FROM sqlite_master
WHERE type='table' AND name = ? AND name NOT LIKE 'sqlite_%'`;

/**
 * 获取所有表名的 SQL 语句
 */
export const GET_ALL_TABLES = `
SELECT name FROM sqlite_master
WHERE type='table' AND name NOT LIKE 'sqlite_%'
ORDER BY name`;

/**
 * 检查列是否存在的SQL 语句
 */
export const CHECK_COLUMN_EXISTS = `
PRAGMA table_info(?)`;
