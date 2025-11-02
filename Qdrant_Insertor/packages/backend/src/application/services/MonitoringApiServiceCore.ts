import { MonitoringService } from './MonitoringService.js';
import { SyncJobsTable } from '@infrastructure/sqlite/dao/SyncJobsTable.js';
import {
  HealthCheckRequest,
  HealthCheckResponse,
  SyncJobStatsRequest,
  SyncJobStatsResponse,
  SystemMetricsRequest,
  SystemMetricsResponse,
  DashboardDataRequest,
  DashboardDataResponse,
} from '@api/contracts/monitoring.js';
import { logger } from '@logging/logger.js';

/**
 * 监控API服务核心
 * 负责处理系统健康检查、同步作业统计和系统指标
 */
export class MonitoringApiServiceCore {
  /**
   *
   * @param monitoringService
   * @param syncJobsTable
   */
  constructor(
    private monitoringService: MonitoringService,
    private syncJobsTable: SyncJobsTable,
  ) {}

  /**
   * 健康检查API
   * @param request
   */
  async getHealthCheck(
    request: HealthCheckRequest,
  ): Promise<HealthCheckResponse> {
    try {
      logger.info('Getting health check', { component: request.component });

      const healthData = this.monitoringService.getSystemHealth();
      const components = this.monitoringService.getAllComponentHealth();

      // 转换组件格式
      const componentMap: Record<
        string,
        {
          status: 'healthy' | 'degraded' | 'unhealthy';
          lastCheck: string;
          message?: string;
          responseTime?: number;
        }
      > = {};
      components.forEach((comp) => {
        componentMap[comp.component] = {
          status: comp.status as 'healthy' | 'degraded' | 'unhealthy',
          lastCheck: new Date(comp.lastCheck).toISOString(),
          message: comp.errorMessage,
          responseTime: comp.responseTimeMs,
        };
      });

      return {
        status: healthData.status as 'healthy' | 'degraded' | 'unhealthy',
        timestamp: new Date().toISOString(),
        components: componentMap,
        overallHealth: healthData.status as
          | 'healthy'
          | 'degraded'
          | 'unhealthy',
      };
    } catch (error) {
      logger.error('Failed to get health check', { error, request });
      throw error;
    }
  }

  /**
   * 同步作业统计API
   * @param request
   */
  async getSyncJobStats(
    request: SyncJobStatsRequest,
  ): Promise<SyncJobStatsResponse> {
    try {
      logger.info('Getting sync job stats', { request });

      // 获取统计数据
      const stats = this.syncJobsTable.getStats();

      // 获取最近的作业
      const recentJobs = this.syncJobsTable.getAll(10);

      return {
        timeRange: request.timeRange,
        totalJobs: stats.total,
        statusBreakdown: stats.byStatus,
        successRate: stats.successRate,
        averageProcessingTime: stats.avgDuration,
        recentJobs: recentJobs.map((job) => ({
          id: job.id,
          docId: job.docId,
          status: job.status,
          createdAt: new Date(job.createdAt).toISOString(),
          updatedAt: new Date(job.updatedAt).toISOString(),
          processingTime: undefined, // 这个字段在SyncJob中不存在
        })),
      };
    } catch (error) {
      logger.error('Failed to get sync job stats', { error, request });
      throw error;
    }
  }

  /**
   * 系统指标API
   * @param request
   */
  async getSystemMetrics(
    request: SystemMetricsRequest,
  ): Promise<SystemMetricsResponse> {
    try {
      logger.info('Getting system metrics', { request });

      if (!request.metricName) {
        throw new Error('metricName is required');
      }

      const timeRangeMs = this.getTimeRangeMs(request.timeRange);
      const now = Date.now();
      const startTime = now - timeRangeMs;

      const metrics = this.monitoringService.getMetrics(
        request.metricName,
        startTime,
        now,
      );

      // 计算聚合值
      const aggregations: Record<string, number> = {};
      if (metrics.length > 0) {
        const values = metrics.map((m) => m.metricValue);
        aggregations.avg =
          values.reduce((sum, val) => sum + val, 0) / values.length;
        aggregations.min = Math.min(...values);
        aggregations.max = Math.max(...values);
        aggregations.sum = values.reduce((sum, val) => sum + val, 0);
        aggregations.count = values.length;
      }

      return {
        timeRange: request.timeRange,
        metrics: metrics.map((metric) => ({
          name: metric.metricName,
          value: metric.metricValue,
          unit: metric.metricUnit || '',
          timestamp: new Date(metric.timestamp).toISOString(),
          component: 'system', // SystemMetric中没有component字段
        })),
        aggregations,
      };
    } catch (error) {
      logger.error('Failed to get system metrics', { error, request });
      throw error;
    }
  }

  /**
   * 获取仪表板数据API
   * @param request
   */
  async getDashboardData(
    request: DashboardDataRequest,
  ): Promise<DashboardDataResponse> {
    try {
      logger.info('Getting dashboard data', { request });

      // 获取概览数据
      const syncStats = this.syncJobsTable.getStats();

      // 获取系统健康状态
      const healthData = this.monitoringService.getSystemHealth();

      // 获取所有指标名称
      const metricNames = this.monitoringService.getAllMetricNames();

      // 获取最重要的指标（取前5个的最新值）
      const topMetrics = metricNames.slice(0, 5).map((name) => {
        const metric = this.monitoringService.getLatestMetric(name);
        return {
          name,
          value: metric?.metricValue || 0,
          unit: metric?.metricUnit || '',
          trend: 'stable' as const, // 简化处理
        };
      });

      return {
        overview: {
          totalSyncJobs: syncStats.total,
          activeSyncJobs:
            syncStats.byStatus['NEW'] +
            syncStats.byStatus['SPLIT_OK'] +
            syncStats.byStatus['EMBED_OK'],
          successRate: syncStats.successRate,
          averageProcessingTime: syncStats.avgDuration,
          totalAlerts: 0, // 需要从AlertService获取
          activeAlerts: 0, // 需要从AlertService获取
        },
        systemHealth: {
          status: healthData.status,
          components: {}, // 简化处理
        },
        recentAlerts: [], // 需要从AlertService获取
        syncJobTrends: [], // 简化处理，暂不实现趋势数据
        topMetrics,
      };
    } catch (error) {
      logger.error('Failed to get dashboard data', { error, request });
      throw error;
    }
  }

  /**
   * 辅助方法：将时间范围转换为毫秒
   * @param timeRange
   */
  private getTimeRangeMs(timeRange: string): number {
    switch (timeRange) {
      case '1h':
        return 60 * 60 * 1000;
      case '6h':
        return 6 * 60 * 60 * 1000;
      case '24h':
        return 24 * 60 * 60 * 1000;
      case '7d':
        return 7 * 24 * 60 * 60 * 1000;
      case '30d':
        return 30 * 24 * 60 * 60 * 1000;
      default:
        return 24 * 60 * 60 * 1000; // 默认24小时
    }
  }
}
