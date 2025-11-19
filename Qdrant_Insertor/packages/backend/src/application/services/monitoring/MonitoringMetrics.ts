import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { SystemMetrics } from '@infrastructure/database/entities/SystemMetrics.js';

import type {
  PerformanceStats,
  AnomalyDetectionOptions,
  PerformanceAnomaly,
} from '@domain/repositories/IMonitoringService.js';

export type MetricRecord = {
  id: string;
  metricName: string;
  metricValue: number;
  metricUnit?: string | null;
  tags?: Record<string, string | number>;
  timestamp: number;
  createdAt: number;
};

export type LatestMetricMap = Record<string, MetricRecord | null>;

export type AggregatedMetricSummary = {
  min: number;
  max: number;
  avg: number;
  sum: number;
  count: number;
};

export class MonitoringMetrics {
  private parseTags(
    rawTags?: string,
  ): Record<string, string | number> | undefined {
    if (!rawTags) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(rawTags);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return undefined;
      }

      const normalized: Record<string, string | number> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string' || typeof value === 'number') {
          normalized[key] = value;
        } else if (value !== undefined) {
          normalized[key] = JSON.stringify(value);
        }
      }

      return Object.keys(normalized).length > 0 ? normalized : undefined;
    } catch (error) {
      this.logger.warn('��ǩ���ݽ���ʧ��', { error });
      return undefined;
    }
  }

  constructor(
    private readonly getDataSource: () => DataSource | undefined,
    private readonly logger: Logger,
  ) {}

  public async getMetrics(
    metricName: string,
    startTime?: number,
    endTime?: number,
    limit?: number,
  ): Promise<MetricRecord[]> {
    try {
      const dataSource = this.getDataSource();
      if (!dataSource) throw new Error('数据源未初始化');

      const systemMetricsRepository = dataSource.getRepository(SystemMetrics);

      const metrics = await systemMetricsRepository.find({
        where: { metric_name: metricName },
        order: { timestamp: 'DESC' },
        take: limit || 1000,
      });

      return metrics.map((m) => ({
        id: m.id,
        metricName: m.metric_name,
        metricValue: m.metric_value,
        metricUnit: m.metric_unit,
        tags: this.parseTags(m.tags),
        timestamp: m.timestamp,
        createdAt: m.created_at,
      }));
    } catch (error) {
      this.logger.error('获取指标失败', { error, metricName });
      return [];
    }
  }

  public async getLatestMetric(
    metricName: string,
  ): Promise<MetricRecord | null> {
    try {
      const dataSource = this.getDataSource();
      if (!dataSource) throw new Error('数据源未初始化');

      const systemMetricsRepository = dataSource.getRepository(SystemMetrics);
      const metric = await systemMetricsRepository.findOne({
        where: { metric_name: metricName },
        order: { timestamp: 'DESC' },
      });
      if (!metric) return null;
      return {
        id: metric.id,
        metricName: metric.metric_name,
        metricValue: metric.metric_value,
        metricUnit: metric.metric_unit,
        tags: this.parseTags(metric.tags),
        timestamp: metric.timestamp,
        createdAt: metric.created_at,
      };
    } catch (error) {
      this.logger.error('获取最新指标失败', { error, metricName });
      return null;
    }
  }

  public async getLatestMetrics(
    metricNames: string[],
  ): Promise<LatestMetricMap> {
    const result: LatestMetricMap = {};
    for (const name of metricNames) {
      result[name] = await this.getLatestMetric(name);
    }
    return result;
  }

  public async getAggregatedMetrics(
    metricName: string,
    startTime?: number,
    endTime?: number,
    aggregationType: 'avg' | 'min' | 'max' | 'sum' = 'avg',
  ): Promise<AggregatedMetricSummary> {
    try {
      const dataSource = this.getDataSource();
      if (!dataSource) throw new Error('数据源未初始化');

      const systemMetricsRepository = dataSource.getRepository(SystemMetrics);
      const metrics = await systemMetricsRepository.find({
        where: { metric_name: metricName },
        order: { timestamp: 'DESC' },
        take: 1000,
      });

      if (metrics.length === 0)
        return { min: 0, max: 0, avg: 0, sum: 0, count: 0 };

      const values = metrics.map((m) => m.metric_value).sort((a, b) => a - b);
      const sum = values.reduce((s, v) => s + v, 0);
      const avg = sum / values.length;
      const min = values[0];
      const max = values[values.length - 1];

      return { min, max, avg, sum, count: values.length };
    } catch (error) {
      this.logger.error('聚合指标失败', { error, metricName });
      return { min: 0, max: 0, avg: 0, sum: 0, count: 0 };
    }
  }

  public async getAllMetricNames(): Promise<string[]> {
    try {
      const dataSource = this.getDataSource();
      if (!dataSource) throw new Error('数据源未初始化');

      const systemMetricsRepository = dataSource.getRepository(SystemMetrics);
      const rows = await systemMetricsRepository
        .createQueryBuilder('m')
        .select('DISTINCT m.metric_name', 'metric_name')
        .getRawMany<{ metric_name: string }>();

      return rows.map((r) => r.metric_name);
    } catch (error) {
      this.logger.error('获取所有指标名称失败', { error });
      return [];
    }
  }

  public async getMetricStats(
    metricName: string,
    startTime?: number,
    endTime?: number,
  ): Promise<AggregatedMetricSummary> {
    return this.getAggregatedMetrics(metricName, startTime, endTime);
  }

  public async getPerformanceStats(
    metricName: string,
  ): Promise<PerformanceStats> {
    try {
      const dataSource = this.getDataSource();
      if (!dataSource) throw new Error('数据源未初始化');

      const systemMetricsRepository = dataSource.getRepository(SystemMetrics);
      const metrics = await systemMetricsRepository.find({
        where: { metric_name: metricName },
        order: { timestamp: 'DESC' },
        take: 1000,
      });

      if (metrics.length === 0)
        return { average: 0, min: 0, max: 0, p95: 0, p99: 0 };

      const values = metrics.map((m) => m.metric_value).sort((a, b) => a - b);
      const average = values.reduce((s, v) => s + v, 0) / values.length;
      const min = values[0];
      const max = values[values.length - 1];

      const getPercentile = (percentile: number) => {
        if (values.length === 0) return 0;
        if (values.length === 1) return values[0];
        const index = (percentile / 100) * (values.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index - lower;
        if (lower === upper) return values[lower];
        return values[lower] + (values[upper] - values[lower]) * weight;
      };

      return {
        average,
        min,
        max,
        p95: getPercentile(95),
        p99: getPercentile(99),
      };
    } catch (error) {
      this.logger.error('获取性能统计失败', { error, metricName });
      return { average: 0, min: 0, max: 0, p95: 0, p99: 0 };
    }
  }

  public async detectPerformanceAnomalies(
    metricName: string,
    options: AnomalyDetectionOptions,
  ): Promise<PerformanceAnomaly[]> {
    try {
      const dataSource = this.getDataSource();
      if (!dataSource) throw new Error('数据源未初始化');

      const systemMetricsRepository = dataSource.getRepository(SystemMetrics);

      const timeWindowStart = Date.now() - options.timeWindow;

      const metrics = await systemMetricsRepository
        .createQueryBuilder('metric')
        .where('metric.metric_name = :metricName', { metricName })
        .andWhere('metric.timestamp >= :timeWindowStart', { timeWindowStart })
        .orderBy('metric.timestamp', 'ASC')
        .getMany();

      if (metrics.length < 10) return [];

      const anomalies: PerformanceAnomaly[] = [];

      // segmentation-based detection
      const splitIndex = Math.floor(metrics.length / 2);
      const baseline = metrics.slice(0, splitIndex);
      const baselineValues = baseline.map((m) => m.metric_value);
      const baselineMean =
        baselineValues.reduce((s, v) => s + v, 0) / baselineValues.length;
      const baselineStd = Math.sqrt(
        baselineValues.reduce((s, v) => s + Math.pow(v - baselineMean, 2), 0) /
          baselineValues.length,
      );

      const baselineThreshold = baselineMean + options.threshold * baselineStd;

      for (const metric of metrics) {
        if (metric.metric_value > baselineThreshold) {
          const severity =
            metric.metric_value > baselineThreshold * 1.5
              ? 'high'
              : metric.metric_value > baselineThreshold * 1.2
                ? 'medium'
                : 'low';
          anomalies.push({
            value: metric.metric_value,
            timestamp: new Date(metric.timestamp),
            severity,
          });
        }
      }

      return anomalies;
    } catch (error) {
      this.logger.error('检测性能异常失败', { error, metricName });
      return [];
    }
  }
}
