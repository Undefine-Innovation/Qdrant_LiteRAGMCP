import { DataSource, Repository } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { SystemHealth } from '@infrastructure/database/entities/SystemHealth.js';
import { SystemMetrics } from '@infrastructure/database/entities/SystemMetrics.js';
import { AlertHistory } from '@infrastructure/database/entities/AlertHistory.js';

import type {
  DashboardData,
  SystemOverview,
} from '@domain/repositories/IMonitoringService.js';

export class MonitoringDashboard {
  constructor(
    private readonly getDataSource: () => DataSource | undefined,
    private readonly logger: Logger,
  ) {}

  private calculateOverallHealth(
    healthRecords: SystemHealth[],
  ): 'healthy' | 'degraded' | 'unhealthy' {
    if (healthRecords.length === 0) return 'unhealthy';
    const statuses = healthRecords.map((r) => r.status);
    if (statuses.includes('unhealthy')) return 'unhealthy';
    if (statuses.includes('degraded')) return 'degraded';
    return 'healthy';
  }

  private async getLatestMetricsData(
    systemMetricsRepository: Repository<SystemMetrics>,
  ): Promise<Record<string, number>> {
    const metrics: Record<string, number> = {};
    const metricNames = ['cpu_usage', 'memory_usage', 'request_count'];
    for (const name of metricNames) {
      const metric = await systemMetricsRepository.findOne({
        where: { metric_name: name },
        order: { timestamp: 'DESC' },
      });
      if (metric) metrics[name] = metric.metric_value;
    }
    return metrics;
  }

  public async getDashboardData(): Promise<DashboardData> {
    try {
      const dataSource = this.getDataSource();
      if (!dataSource) throw new Error('数据源未初始化');

      const systemHealthRepository = dataSource.getRepository(SystemHealth);
      const systemMetricsRepository = dataSource.getRepository(SystemMetrics);
      const alertHistoryRepository = dataSource.getRepository(AlertHistory);

      const healthRecords = await systemHealthRepository
        .createQueryBuilder('health')
        .getMany();
      const overallHealth = this.calculateOverallHealth(healthRecords);
      const latestMetrics = await this.getLatestMetricsData(
        systemMetricsRepository,
      );
      const activeAlerts = await alertHistoryRepository.find({
        where: { status: 'triggered' },
        order: { triggered_at: 'DESC' },
        take: 10,
      });

      return {
        overallHealth,
        components: healthRecords.map((record) => ({
          component: record.component,
          status: record.status,
          message: record.errorMessage,
          lastCheck: new Date(record.lastCheck),
          responseTimeMs: record.responseTimeMs,
        })),
        metrics: latestMetrics,
        activeAlerts: activeAlerts.map((alert) => ({
          id: alert.id,
          ruleId: alert.rule_id,
          ruleName: '',
          status: alert.status,
          severity: alert.severity,
          metricValue: alert.metric_value,
          message: alert.message,
          triggeredAt: new Date(alert.triggered_at),
        })),
      };
    } catch (error) {
      this.logger.error('获取仪表板数据失败', { error });
      return {
        overallHealth: 'unhealthy',
        components: [],
        metrics: {},
        activeAlerts: [],
      };
    }
  }

  public async getSystemOverview(): Promise<SystemOverview> {
    try {
      const dataSource = this.getDataSource();
      if (!dataSource) throw new Error('数据源未初始化');

      const systemHealthRepository = dataSource.getRepository(SystemHealth);
      const systemMetricsRepository = dataSource.getRepository(SystemMetrics);

      const healthRecords = await systemHealthRepository.find();
      const healthStatus = this.calculateOverallHealth(healthRecords);

      const uptimeMetric = await systemMetricsRepository.findOne({
        where: { metric_name: 'uptime' },
        order: { timestamp: 'DESC' },
      });
      const requestRateMetric = await systemMetricsRepository.findOne({
        where: { metric_name: 'request_rate' },
        order: { timestamp: 'DESC' },
      });
      const errorRateMetric = await systemMetricsRepository.findOne({
        where: { metric_name: 'error_rate' },
        order: { timestamp: 'DESC' },
      });

      return {
        healthStatus,
        uptime: uptimeMetric?.metric_value || 0,
        requestRate: requestRateMetric?.metric_value || 0,
        errorRate: errorRateMetric?.metric_value || 0,
        componentCount: healthRecords.length,
        healthyComponents: healthRecords.filter((r) => r.status === 'healthy')
          .length,
        unhealthyComponents: healthRecords.filter(
          (r) => r.status === 'unhealthy',
        ).length,
      };
    } catch (error) {
      this.logger.error('获取系统概览失败', { error });
      return {
        healthStatus: 'unhealthy',
        uptime: 0,
        requestRate: 0,
        errorRate: 0,
        componentCount: 0,
        healthyComponents: 0,
        unhealthyComponents: 0,
      };
    }
  }
}
