import Database from 'better-sqlite3';

/**
 * 告警历史数据接口
 */
export interface AlertHistory {
  id: string;
  ruleId: string;
  metricValue: number;
  thresholdValue: number;
  severity: string;
  status: 'triggered' | 'resolved' | 'suppressed';
  message?: string;
  triggeredAt: number;
  resolvedAt?: number;
  createdAt: number;
}

/**
 * 数据库行接口
 */
interface AlertHistoryRow {
  id: string;
  rule_id: string;
  metric_value: number;
  threshold_value: number;
  severity: string;
  status: string;
  message?: string;
  triggered_at: number;
  resolved_at?: number;
  created_at: number;
}

/**
 * 告警历史数据库访问对象
 */
export class AlertHistoryTable {
  constructor(private db: Database.Database) {}

  /**
   * 创建告警历史记录
   */
  create(alert: Omit<AlertHistory, 'id' | 'createdAt'>): string {
    const id = `alert_hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const stmt = this.db.prepare(`
      INSERT INTO alert_history (
        id, rule_id, metric_value, threshold_value, severity, 
        status, message, triggered_at, resolved_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      alert.ruleId,
      alert.metricValue,
      alert.thresholdValue,
      alert.severity,
      alert.status,
      alert.message || null,
      alert.triggeredAt,
      alert.resolvedAt || null,
      Date.now()
    );

    return id;
  }

  /**
   * 更新告警历史记录
   */
  update(id: string, updates: Partial<Omit<AlertHistory, 'id' | 'createdAt' | 'triggeredAt'>>): boolean {
    const fields = [];
    const values = [];

    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.resolvedAt !== undefined) {
      fields.push('resolved_at = ?');
      values.push(updates.resolvedAt);
    }
    if (updates.message !== undefined) {
      fields.push('message = ?');
      values.push(updates.message);
    }

    if (fields.length === 0) return true;

    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE alert_history 
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    const result = stmt.run(...values);
    return result.changes > 0;
  }

  /**
   * 根据ID获取告警历史记录
   */
  getById(id: string): AlertHistory | null {
    const stmt = this.db.prepare('SELECT * FROM alert_history WHERE id = ?');
    const row = stmt.get(id) as AlertHistoryRow;
    
    if (!row) return null;
    return this.mapRowToAlertHistory(row);
  }

  /**
   * 根据规则ID获取告警历史记录
   */
  getByRuleId(ruleId: string, limit?: number): AlertHistory[] {
    let query = 'SELECT * FROM alert_history WHERE rule_id = ? ORDER BY triggered_at DESC';
    const params = [ruleId];

    if (limit !== undefined) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as AlertHistoryRow[];
    
    return rows.map(row => this.mapRowToAlertHistory(row));
  }

  /**
   * 获取所有告警历史记录
   */
  getAll(limit?: number, offset?: number): AlertHistory[] {
    let query = 'SELECT * FROM alert_history ORDER BY triggered_at DESC';
    const params: unknown[] = [];

    if (limit !== undefined) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    if (offset !== undefined) {
      query += ' OFFSET ?';
      params.push(offset);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as AlertHistoryRow[];
    
    return rows.map(row => this.mapRowToAlertHistory(row));
  }

  /**
   * 根据状态获取告警历史记录
   */
  getByStatus(status: string, limit?: number): AlertHistory[] {
    let query = 'SELECT * FROM alert_history WHERE status = ? ORDER BY triggered_at DESC';
    const params = [status];

    if (limit !== undefined) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as AlertHistoryRow[];
    
    return rows.map(row => this.mapRowToAlertHistory(row));
  }

  /**
   * 根据时间范围获取告警历史记录
   */
  getByTimeRange(startTime: number, endTime: number, limit?: number): AlertHistory[] {
    let query = `
      SELECT * FROM alert_history 
      WHERE triggered_at >= ? AND triggered_at <= ? 
      ORDER BY triggered_at DESC
    `;
    const params = [startTime, endTime];

    if (limit !== undefined) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as AlertHistoryRow[];
    
    return rows.map(row => this.mapRowToAlertHistory(row));
  }

  /**
   * 获取告警统计信息
   */
  getStats(days: number = 7): {
    total: number;
    byStatus: Record<string, number>;
    bySeverity: Record<string, number>;
    averageResolutionTime: number;
  } {
    const startTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    const totalStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM alert_history 
      WHERE triggered_at >= ?
    `);
    const totalResult = totalStmt.get(startTime) as { count: number };

    const statusStmt = this.db.prepare(`
      SELECT status, COUNT(*) as count FROM alert_history 
      WHERE triggered_at >= ? 
      GROUP BY status
    `);
    const statusResults = statusStmt.all(startTime) as { status: string; count: number }[];

    const severityStmt = this.db.prepare(`
      SELECT severity, COUNT(*) as count FROM alert_history 
      WHERE triggered_at >= ? 
      GROUP BY severity
    `);
    const severityResults = severityStmt.all(startTime) as { severity: string; count: number }[];

    const resolutionTimeStmt = this.db.prepare(`
      SELECT AVG(resolved_at - triggered_at) as avg_resolution_time 
      FROM alert_history 
      WHERE triggered_at >= ? AND resolved_at IS NOT NULL
    `);
    const resolutionTimeResult = resolutionTimeStmt.get(startTime) as { avg_resolution_time: number };

    const byStatus: Record<string, number> = {};
    statusResults.forEach(result => {
      byStatus[result.status] = result.count;
    });

    const bySeverity: Record<string, number> = {};
    severityResults.forEach(result => {
      bySeverity[result.severity] = result.count;
    });

    return {
      total: totalResult.count,
      byStatus,
      bySeverity,
      averageResolutionTime: resolutionTimeResult.avg_resolution_time || 0,
    };
  }

  /**
   * 删除告警历史记录
   */
  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM alert_history WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * 清理过期的告警历史记录
   */
  cleanup(olderThanDays: number = 30): number {
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    
    const stmt = this.db.prepare(`
      DELETE FROM alert_history WHERE triggered_at < ?
    `);
    
    const result = stmt.run(cutoffTime);
    return result.changes;
  }

  /**
   * 将数据库行映射为AlertHistory对象
   */
  private mapRowToAlertHistory(row: AlertHistoryRow): AlertHistory {
    return {
      id: row.id,
      ruleId: row.rule_id,
      metricValue: row.metric_value,
      thresholdValue: row.threshold_value,
      severity: row.status as AlertHistory['severity'],
      status: row.status as AlertHistory['status'],
      message: row.message,
      triggeredAt: row.triggered_at,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
    };
  }

  /**
   * 检查数据库连接是否存活
   */
  ping(): boolean {
    try {
      this.db.prepare('SELECT 1').get();
      return true;
    } catch {
      return false;
    }
  }
}