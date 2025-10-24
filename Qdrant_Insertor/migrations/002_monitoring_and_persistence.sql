-- migrations/002_monitoring_and_persistence.sql

-- 1. 增强同步作业表，添加更多状态信息
ALTER TABLE sync_jobs ADD COLUMN started_at INTEGER;
ALTER TABLE sync_jobs ADD COLUMN completed_at INTEGER;
ALTER TABLE sync_jobs ADD COLUMN duration_ms INTEGER;
ALTER TABLE sync_jobs ADD COLUMN error_category TEXT;
ALTER TABLE sync_jobs ADD COLUMN last_retry_strategy TEXT; -- JSON格式存储重试策略
ALTER TABLE sync_jobs ADD COLUMN progress INTEGER DEFAULT 0; -- 进度百分比 0-100

-- 2. 创建系统性能指标表
CREATE TABLE IF NOT EXISTS system_metrics (
    id TEXT PRIMARY KEY NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    metric_unit TEXT,
    tags TEXT, -- JSON格式存储标签
    timestamp INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

-- 3. 创建告警规则表
CREATE TABLE IF NOT EXISTS alert_rules (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    metric_name TEXT NOT NULL,
    condition_operator TEXT NOT NULL, -- >, <, >=, <=, ==, !=
    threshold_value REAL NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    is_active INTEGER DEFAULT 1,
    cooldown_minutes INTEGER DEFAULT 5, -- 告警冷却时间（分钟）
    notification_channels TEXT, -- JSON格式存储通知渠道
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 4. 创建告警历史表
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

-- 5. 创建系统健康状态表
CREATE TABLE IF NOT EXISTS system_health (
    id TEXT PRIMARY KEY NOT NULL,
    component TEXT NOT NULL, -- 组件名称：database, qdrant, embedding_service, etc.
    status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
    last_check INTEGER NOT NULL,
    response_time_ms INTEGER,
    error_message TEXT,
    details TEXT, -- JSON格式存储详细信息
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 6. 创建同步作业统计表（用于历史统计）
CREATE TABLE IF NOT EXISTS sync_job_stats (
    id TEXT PRIMARY KEY NOT NULL,
    date TEXT NOT NULL, -- YYYY-MM-DD格式
    total_jobs INTEGER DEFAULT 0,
    successful_jobs INTEGER DEFAULT 0,
    failed_jobs INTEGER DEFAULT 0,
    retried_jobs INTEGER DEFAULT 0,
    average_duration_ms INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(date)
);

-- 7. 创建重试任务历史表
CREATE TABLE IF NOT EXISTS retry_history (
    id TEXT PRIMARY KEY NOT NULL,
    doc_id TEXT NOT NULL,
    sync_job_id TEXT,
    error_category TEXT NOT NULL,
    error_message TEXT,
    retry_count INTEGER NOT NULL,
    strategy TEXT, -- JSON格式存储重试策略
    status TEXT NOT NULL CHECK (status IN ('scheduled', 'success', 'failed', 'cancelled')),
    scheduled_at INTEGER NOT NULL,
    executed_at INTEGER,
    completed_at INTEGER,
    duration_ms INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (sync_job_id) REFERENCES sync_jobs(id) ON DELETE SET NULL
);

-- 8. 创建通知渠道表
CREATE TABLE IF NOT EXISTS notification_channels (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('webhook', 'email', 'slack', 'log')),
    config TEXT NOT NULL, -- JSON格式存储配置信息
    is_active INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 9. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_sync_jobs_docId ON sync_jobs(docId);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_updated_at ON sync_jobs(updated_at);
CREATE INDEX IF NOT EXISTS idx_system_metrics_name_timestamp ON system_metrics(metric_name, timestamp);
CREATE INDEX IF NOT EXISTS idx_alert_history_rule_id ON alert_history(rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_triggered_at ON alert_history(triggered_at);
CREATE INDEX IF NOT EXISTS idx_system_health_component ON system_health(component);
CREATE INDEX IF NOT EXISTS idx_retry_history_doc_id ON retry_history(doc_id);
CREATE INDEX IF NOT EXISTS idx_retry_history_status ON retry_history(status);

-- 10. 插入默认的告警规则
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

-- 11. 插入默认的通知渠道
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
);