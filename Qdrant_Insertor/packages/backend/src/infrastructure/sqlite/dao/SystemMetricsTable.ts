import Database from 'better-sqlite3';

/**
 * 系统指标数据接口
 */
export interface SystemMetric {
  id: string;
  metricName: string;
  metricValue: number;
  metricUnit?: string;
  tags?: Record<string, string | number>;
  timestamp: number;
  createdAt: number;
}

/**
 * 数据库行接口
 */
interface SystemMetricRow {
  id: string;
  metric_name: string;
  metric_value: number;
  metric_unit?: string;
  tags?: string;
  timestamp: number;
  created_at: number;
}

/**
 * 系统指标数据库访问对�?
 */
export class SystemMetricsTable {
  /**
   *
   * @param db
   */
  constructor(private db: Database.Database) {}

  /**
   * 创建系统指标记录
   * @param metric
   */
  create(metric: Omit<SystemMetric, 'id' | 'createdAt'>): string {
    const id = `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const stmt = this.db.prepare(`
      INSERT INTO system_metrics (
        id, metric_name, metric_value, metric_unit, tags, timestamp, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      metric.metricName,
      metric.metricValue,
      metric.metricUnit || null,
      metric.tags ? JSON.stringify(metric.tags) : null,
      metric.timestamp,
      Date.now(),
    );

    return id;
  }

  /**
   * 批量创建系统指标记录
   * @param metrics
   */
  createBatch(metrics: Omit<SystemMetric, 'id' | 'createdAt'>[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO system_metrics (
        id, metric_name, metric_value, metric_unit, tags, timestamp, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      for (const metric of metrics) {
        const id = `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        stmt.run(
          id,
          metric.metricName,
          metric.metricValue,
          metric.metricUnit || null,
          metric.tags ? JSON.stringify(metric.tags) : null,
          metric.timestamp,
          Date.now(),
        );
      }
    });

    transaction();
  }

  /**
   * 根据指标名称和时间范围获取指�?
   * @param metricName
   * @param startTime
   * @param endTime
   * @param limit
   */
  getByNameAndTimeRange(
    metricName: string,
    startTime: number,
    endTime: number,
    limit?: number,
  ): SystemMetric[] {
    let query = `
      SELECT * FROM system_metrics
      WHERE metric_name = ? AND timestamp >= ? AND timestamp <= ?
      ORDER BY timestamp DESC
    `;
    const params: (string | number)[] = [metricName, startTime, endTime];

    if (limit !== undefined) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as SystemMetricRow[];

    return rows.map((row) => this.mapRowToMetric(row));
  }

  /**
   * 获取最新的指标�?
   * @param metricName
   */
  getLatestByName(metricName: string): SystemMetric | null {
    const stmt = this.db.prepare(`
      SELECT * FROM system_metrics
      WHERE metric_name = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `);

    const row = stmt.get(metricName) as SystemMetricRow;
    if (!row) return null;

    return this.mapRowToMetric(row);
  }

  /**
   * 获取指标聚合数据
   * @param metricName
   * @param startTime
   * @param endTime
   * @param aggregationType
   */
  getAggregatedMetrics(
    metricName: string,
    startTime: number,
    endTime: number,
    aggregationType: 'avg' | 'min' | 'max' | 'sum' = 'avg',
  ): {
    value: number;
    count: number;
    startTime: number;
    endTime: number;
  } | null {
    const aggFunction =
      aggregationType === 'avg'
        ? 'AVG'
        : aggregationType === 'min'
          ? 'MIN'
          : aggregationType === 'max'
            ? 'MAX'
            : 'SUM';

    const stmt = this.db.prepare(`
      SELECT
        ${aggFunction}(metric_value) as value,
        COUNT(*) as count,
        MIN(timestamp) as start_time,
        MAX(timestamp) as end_time
      FROM system_metrics
      WHERE metric_name = ? AND timestamp >= ? AND timestamp <= ?
    `);

    const result = stmt.get(metricName, startTime, endTime) as {
      value: number;
      count: number;
      start_time: number;
      end_time: number;
    };
    if (!result || result.count === 0) return null;

    return {
      value: result.value,
      count: result.count,
      startTime: result.start_time,
      endTime: result.end_time,
    };
  }

  /**
   * 获取多个指标的最新�?
   * @param metricNames
   */
  getLatestByNames(metricNames: string[]): Record<string, SystemMetric | null> {
    if (metricNames.length === 0) return {};

    const placeholders = metricNames.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      SELECT * FROM system_metrics
      WHERE metric_name IN (${placeholders})
      GROUP BY metric_name
      HAVING timestamp = MAX(timestamp)
    `);

    const rows = stmt.all(...metricNames) as SystemMetricRow[];
    const result: Record<string, SystemMetric | null> = {};

    // 初始化所有指标为null
    metricNames.forEach((name) => {
      result[name] = null;
    });

    // 填充实际�?
    rows.forEach((row) => {
      result[row.metric_name] = this.mapRowToMetric(row);
    });

    return result;
  }

  /**
   * 清理过期的指标数�?
   * @param olderThanDays
   */
  cleanup(olderThanDays: number = 30): number {
    const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

    const stmt = this.db.prepare(`
      DELETE FROM system_metrics WHERE timestamp < ?
    `);

    const result = stmt.run(cutoffTime);
    return result.changes;
  }

  /**
   * 获取所有指标名�?
   */
  getAllMetricNames(): string[] {
    const stmt = this.db.prepare(`
      SELECT DISTINCT metric_name FROM system_metrics ORDER BY metric_name
    `);

    const rows = stmt.all() as { metric_name: string }[];
    return rows.map((row) => row.metric_name);
  }

  /**
   * 获取指标统计信息
   * @param metricName
   * @param startTime
   * @param endTime
   */
  getMetricStats(
    metricName: string,
    startTime?: number,
    endTime?: number,
  ): {
    count: number;
    avg: number;
    min: number;
    max: number;
    latest: SystemMetric | null;
  } | null {
    let query = `
      SELECT
        COUNT(*) as count,
        AVG(metric_value) as avg,
        MIN(metric_value) as min,
        MAX(metric_value) as max
      FROM system_metrics
      WHERE metric_name = ?
    `;

    const params: (string | number)[] = [metricName];

    if (startTime !== undefined) {
      query += ' AND timestamp >= ?';
      params.push(startTime);
    }

    if (endTime !== undefined) {
      query += ' AND timestamp <= ?';
      params.push(endTime);
    }

    const stmt = this.db.prepare(query);
    const result = stmt.get(...params) as {
      count: number;
      avg: number;
      min: number;
      max: number;
    };

    if (!result || result.count === 0) return null;

    const latest = this.getLatestByName(metricName);

    return {
      count: result.count,
      avg: result.avg || 0,
      min: result.min || 0,
      max: result.max || 0,
      latest,
    };
  }

  /**
   * 将数据库行映射为SystemMetric对象
   * @param row
   */
  private mapRowToMetric(row: SystemMetricRow): SystemMetric {
    return {
      id: row.id,
      metricName: row.metric_name,
      metricValue: row.metric_value,
      metricUnit: row.metric_unit,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      timestamp: row.timestamp,
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
