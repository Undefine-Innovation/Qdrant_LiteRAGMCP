import Database from 'better-sqlite3';

/**
 * 告警严重程度枚举
 */
export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * 告警规则数据接口
 */
export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  metricName: string;
  conditionOperator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  thresholdValue: number;
  severity: AlertSeverity;
  isActive: boolean;
  cooldownMinutes: number;
  notificationChannels: string[];
  createdAt: number;
  updatedAt: number;
}

/**
 * 数据库行接口
 */
interface AlertRuleRow {
  id: string;
  name: string;
  description?: string;
  metric_name: string;
  condition_operator: string;
  threshold_value: number;
  severity: string;
  is_active: number;
  cooldown_minutes: number;
  notification_channels: string;
  created_at: number;
  updated_at: number;
}

/**
 * 告警规则数据库访问对象
 */
export class AlertRulesTable {
  constructor(private db: Database.Database) {}

  /**
   * 创建告警规则
   */
  create(rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>): string {
    const id = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO alert_rules (
        id, name, description, metric_name, condition_operator, threshold_value,
        severity, is_active, cooldown_minutes, notification_channels, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      rule.name,
      rule.description || null,
      rule.metricName,
      rule.conditionOperator,
      rule.thresholdValue,
      rule.severity,
      rule.isActive ? 1 : 0,
      rule.cooldownMinutes,
      JSON.stringify(rule.notificationChannels),
      now,
      now,
    );

    return id;
  }

  /**
   * 更新告警规则
   */
  update(
    id: string,
    updates: Partial<Omit<AlertRule, 'id' | 'createdAt'>>,
  ): boolean {
    const fields = [];
    const values = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.metricName !== undefined) {
      fields.push('metric_name = ?');
      values.push(updates.metricName);
    }
    if (updates.conditionOperator !== undefined) {
      fields.push('condition_operator = ?');
      values.push(updates.conditionOperator);
    }
    if (updates.thresholdValue !== undefined) {
      fields.push('threshold_value = ?');
      values.push(updates.thresholdValue);
    }
    if (updates.severity !== undefined) {
      fields.push('severity = ?');
      values.push(updates.severity);
    }
    if (updates.isActive !== undefined) {
      fields.push('is_active = ?');
      values.push(updates.isActive ? 1 : 0);
    }
    if (updates.cooldownMinutes !== undefined) {
      fields.push('cooldown_minutes = ?');
      values.push(updates.cooldownMinutes);
    }
    if (updates.notificationChannels !== undefined) {
      fields.push('notification_channels = ?');
      values.push(JSON.stringify(updates.notificationChannels));
    }

    fields.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE alert_rules 
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    const result = stmt.run(...values);
    return result.changes > 0;
  }

  /**
   * 根据ID获取告警规则
   */
  getById(id: string): AlertRule | null {
    const stmt = this.db.prepare('SELECT * FROM alert_rules WHERE id = ?');
    const row = stmt.get(id) as AlertRuleRow;

    if (!row) return null;
    return this.mapRowToAlertRule(row);
  }

  /**
   * 根据名称获取告警规则
   */
  getByName(name: string): AlertRule | null {
    const stmt = this.db.prepare('SELECT * FROM alert_rules WHERE name = ?');
    const row = stmt.get(name) as AlertRuleRow;

    if (!row) return null;
    return this.mapRowToAlertRule(row);
  }

  /**
   * 获取所有告警规则
   */
  getAll(activeOnly?: boolean): AlertRule[] {
    let query = 'SELECT * FROM alert_rules ORDER BY created_at DESC';

    if (activeOnly) {
      query =
        'SELECT * FROM alert_rules WHERE is_active = 1 ORDER BY created_at DESC';
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all() as AlertRuleRow[];

    return rows.map((row) => this.mapRowToAlertRule(row));
  }

  /**
   * 根据指标名称获取活跃的告警规则
   */
  getActiveByMetricName(metricName: string): AlertRule[] {
    const stmt = this.db.prepare(`
      SELECT * FROM alert_rules 
      WHERE metric_name = ? AND is_active = 1 
      ORDER BY severity DESC, created_at DESC
    `);

    const rows = stmt.all(metricName) as AlertRuleRow[];
    return rows.map((row) => this.mapRowToAlertRule(row));
  }

  /**
   * 删除告警规则
   */
  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM alert_rules WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * 激活/停用告警规则
   */
  setActive(id: string, isActive: boolean): boolean {
    const stmt = this.db.prepare(`
      UPDATE alert_rules 
      SET is_active = ?, updated_at = ? 
      WHERE id = ?
    `);

    const result = stmt.run(isActive ? 1 : 0, Date.now(), id);
    return result.changes > 0;
  }

  /**
   * 检查告警规则是否存在
   */
  exists(id: string): boolean {
    const stmt = this.db.prepare(
      'SELECT 1 FROM alert_rules WHERE id = ? LIMIT 1',
    );
    return stmt.get(id) !== undefined;
  }

  /**
   * 检查告警规则名称是否存在
   */
  nameExists(name: string, excludeId?: string): boolean {
    let query = 'SELECT 1 FROM alert_rules WHERE name = ? LIMIT 1';
    const params = [name];

    if (excludeId) {
      query = 'SELECT 1 FROM alert_rules WHERE name = ? AND id != ? LIMIT 1';
      params.push(excludeId);
    }

    const stmt = this.db.prepare(query);
    return stmt.get(...params) !== undefined;
  }

  /**
   * 获取告警规则统计信息
   */
  getStats(): {
    total: number;
    active: number;
    bySeverity: Record<AlertSeverity, number>;
  } {
    const totalStmt = this.db.prepare(
      'SELECT COUNT(*) as count FROM alert_rules',
    );
    const totalResult = totalStmt.get() as { count: number };

    const activeStmt = this.db.prepare(
      'SELECT COUNT(*) as count FROM alert_rules WHERE is_active = 1',
    );
    const activeResult = activeStmt.get() as { count: number };

    const severityStmt = this.db.prepare(`
      SELECT severity, COUNT(*) as count FROM alert_rules GROUP BY severity
    `);
    const severityResults = severityStmt.all() as {
      severity: string;
      count: number;
    }[];

    const bySeverity: Record<AlertSeverity, number> = {
      [AlertSeverity.LOW]: 0,
      [AlertSeverity.MEDIUM]: 0,
      [AlertSeverity.HIGH]: 0,
      [AlertSeverity.CRITICAL]: 0,
    };

    severityResults.forEach((result) => {
      if (result.severity in AlertSeverity) {
        bySeverity[result.severity as AlertSeverity] = result.count;
      }
    });

    return {
      total: totalResult.count,
      active: activeResult.count,
      bySeverity,
    };
  }

  /**
   * 将数据库行映射为AlertRule对象
   */
  private mapRowToAlertRule(row: AlertRuleRow): AlertRule {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      metricName: row.metric_name,
      conditionOperator:
        row.condition_operator as AlertRule['conditionOperator'],
      thresholdValue: row.threshold_value,
      severity: row.severity as AlertSeverity,
      isActive: row.is_active === 1,
      cooldownMinutes: row.cooldown_minutes,
      notificationChannels: JSON.parse(row.notification_channels),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
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
