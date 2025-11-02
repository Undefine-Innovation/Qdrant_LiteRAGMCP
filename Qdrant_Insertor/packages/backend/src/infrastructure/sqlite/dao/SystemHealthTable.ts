import Database from 'better-sqlite3';

/**
 * 系统健康状态枚�?
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

/**
 * 系统健康状态数据接�?
 */
export interface SystemHealth {
  id: string;
  component: string;
  status: HealthStatus;
  lastCheck: number;
  responseTimeMs?: number;
  errorMessage?: string;
  details?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

/**
 * 数据库行接口
 */
interface SystemHealthRow {
  id: string;
  component: string;
  status: string;
  last_check: number;
  response_time_ms?: number;
  error_message?: string;
  details?: string;
  created_at: number;
  updated_at: number;
}

/**
 * 系统健康状态数据库访问对象
 */
export class SystemHealthTable {
  /**
   *
   * @param db
   */
  constructor(private db: Database.Database) {}

  /**
   * 创建或更新系统健康状�?
   * @param health
   */
  upsert(health: Omit<SystemHealth, 'id' | 'createdAt' | 'updatedAt'>): string {
    const now = Date.now();

    // 首先尝试更新现有记录
    const updateStmt = this.db.prepare(`
      UPDATE system_health
      SET status = ?, last_check = ?, response_time_ms = ?,
          error_message = ?, details = ?, updated_at = ?
      WHERE component = ?
    `);

    const updateResult = updateStmt.run(
      health.status,
      health.lastCheck,
      health.responseTimeMs || null,
      health.errorMessage || null,
      health.details ? JSON.stringify(health.details) : null,
      now,
      health.component,
    );

    // 如果没有更新任何记录，则插入新记�?
    if (updateResult.changes === 0) {
      const id = `health_${health.component}_${Date.now()}`;
      const insertStmt = this.db.prepare(`
        INSERT INTO system_health (
          id, component, status, last_check, response_time_ms,
          error_message, details, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertStmt.run(
        id,
        health.component,
        health.status,
        health.lastCheck,
        health.responseTimeMs || null,
        health.errorMessage || null,
        health.details ? JSON.stringify(health.details) : null,
        now,
        now,
      );

      return id;
    }

    // 返回现有记录的ID
    const selectStmt = this.db.prepare(
      'SELECT id FROM system_health WHERE component = ?',
    );
    const result = selectStmt.get(health.component) as
      | { id: string }
      | undefined;
    return result?.id || '';
  }

  /**
   * 根据组件名称获取健康状�?
   * @param component
   */
  getByComponent(component: string): SystemHealth | null {
    const stmt = this.db.prepare(
      'SELECT * FROM system_health WHERE component = ?',
    );
    const row = stmt.get(component) as SystemHealthRow;

    if (!row) return null;
    return this.mapRowToSystemHealth(row);
  }

  /**
   * 获取所有组件的健康状�?
   */
  getAll(): SystemHealth[] {
    const stmt = this.db.prepare(
      'SELECT * FROM system_health ORDER BY component',
    );
    const rows = stmt.all() as SystemHealthRow[];

    return rows.map((row) => this.mapRowToSystemHealth(row));
  }

  /**
   * 根据状态获取组件列�?
   * @param status
   */
  getByStatus(status: HealthStatus): SystemHealth[] {
    const stmt = this.db.prepare(
      'SELECT * FROM system_health WHERE status = ? ORDER BY component',
    );
    const rows = stmt.all(status) as SystemHealthRow[];

    return rows.map((row) => this.mapRowToSystemHealth(row));
  }

  /**
   * 获取不健康的组件
   */
  getUnhealthyComponents(): SystemHealth[] {
    const stmt = this.db.prepare(`
      SELECT * FROM system_health
      WHERE status != ?
      ORDER BY
        CASE status
          WHEN 'unhealthy' THEN 1
          WHEN 'degraded' THEN 2
          ELSE 3
        END,
        component
    `);

    const rows = stmt.all(HealthStatus.HEALTHY) as SystemHealthRow[];
    return rows.map((row) => this.mapRowToSystemHealth(row));
  }

  /**
   * 获取系统整体健康状�?
   */
  getOverallHealth(): {
    status: HealthStatus;
    healthyComponents: number;
    totalComponents: number;
    unhealthyComponents: SystemHealth[];
  } {
    const allComponents = this.getAll();
    const unhealthyComponents = allComponents.filter(
      (c) => c.status !== HealthStatus.HEALTHY,
    );
    const healthyComponents = allComponents.filter(
      (c) => c.status === HealthStatus.HEALTHY,
    );

    let overallStatus = HealthStatus.HEALTHY;

    if (unhealthyComponents.some((c) => c.status === HealthStatus.UNHEALTHY)) {
      overallStatus = HealthStatus.UNHEALTHY;
    } else if (
      unhealthyComponents.some((c) => c.status === HealthStatus.DEGRADED)
    ) {
      overallStatus = HealthStatus.DEGRADED;
    }

    return {
      status: overallStatus,
      healthyComponents: healthyComponents.length,
      totalComponents: allComponents.length,
      unhealthyComponents,
    };
  }

  /**
   * 删除组件的健康状态记�?
   * @param component
   */
  deleteByComponent(component: string): boolean {
    const stmt = this.db.prepare(
      'DELETE FROM system_health WHERE component = ?',
    );
    const result = stmt.run(component);
    return result.changes > 0;
  }

  /**
   * 清理过期的健康状态记�?
   * @param olderThanDays
   */
  cleanup(olderThanDays: number = 30): number {
    const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

    const stmt = this.db.prepare(`
      DELETE FROM system_health WHERE updated_at < ?
    `);

    const result = stmt.run(cutoffTime);
    return result.changes;
  }

  /**
   * 获取组件健康状态历史统�?
   * @param component
   * @param days
   */
  getComponentStats(
    component: string,
    days: number = 7,
  ): {
    component: string;
    totalChecks: number;
    healthyChecks: number;
    degradedChecks: number;
    unhealthyChecks: number;
    averageResponseTime: number;
    uptimePercentage: number;
  } | null {
    // 由于当前表结构只存储最新状态，这里返回基于当前状态的统计
    const current = this.getByComponent(component);
    if (!current) return null;

    // 这里简化实现，实际应用中可能需要历史表来计算准确统�?
    return {
      component,
      totalChecks: 1,
      healthyChecks: current.status === HealthStatus.HEALTHY ? 1 : 0,
      degradedChecks: current.status === HealthStatus.DEGRADED ? 1 : 0,
      unhealthyChecks: current.status === HealthStatus.UNHEALTHY ? 1 : 0,
      averageResponseTime: current.responseTimeMs || 0,
      uptimePercentage: current.status === HealthStatus.HEALTHY ? 100 : 0,
    };
  }

  /**
   * 批量更新多个组件的健康状�?
   * @param healthUpdates
   */
  batchUpdate(
    healthUpdates: Omit<SystemHealth, 'id' | 'createdAt' | 'updatedAt'>[],
  ): void {
    const transaction = this.db.transaction(() => {
      for (const health of healthUpdates) {
        this.upsert(health);
      }
    });

    transaction();
  }

  /**
   * 检查组件是否存�?
   * @param component
   */
  componentExists(component: string): boolean {
    const stmt = this.db.prepare(
      'SELECT 1 FROM system_health WHERE component = ? LIMIT 1',
    );
    return stmt.get(component) !== undefined;
  }

  /**
   * 获取最近检查时�?
   * @param component
   */
  getLastCheckTime(component?: string): number | null {
    let query = 'SELECT MAX(last_check) as last_check FROM system_health';
    const params: (string | number)[] = [];

    if (component) {
      query += ' WHERE component = ?';
      params.push(component);
    }

    const stmt = this.db.prepare(query);
    const result = stmt.get(...params) as { last_check: number } | undefined;

    return result?.last_check || null;
  }

  /**
   * 将数据库行映射为SystemHealth对象
   * @param row
   */
  private mapRowToSystemHealth(row: SystemHealthRow): SystemHealth {
    return {
      id: row.id,
      component: row.component,
      status: row.status as HealthStatus,
      lastCheck: row.last_check,
      responseTimeMs: row.response_time_ms,
      errorMessage: row.error_message,
      details: row.details ? JSON.parse(row.details) : undefined,
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
