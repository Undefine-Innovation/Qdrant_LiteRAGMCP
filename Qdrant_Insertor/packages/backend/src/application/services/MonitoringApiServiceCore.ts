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
   * 获取系统概览数据
   */
  private async getSystemOverview() {
    try {
      // TODO: 这里应该从实际的数据库表中获取数据
      // 暂时返回模拟数据，以便前端能够显示
      return {
        documentsCount: 15,
        collectionsCount: 3, 
        chunksCount: 240,
        vectorsCount: 240,
      };
    } catch (error) {
      logger.error('Failed to get system overview', { error });
      return {
        documentsCount: 0,
        collectionsCount: 0,
        chunksCount: 0,
        vectorsCount: 0,
      };
    }
  }

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

      // 获取健康检查数据
      const healthData = await this.getHealthCheck({});

      // 获取系统指标（模拟数据，因为真实指标可能还没有）
      const mockMetrics = {
        cpu: {
          usage: 45.2,
          loadAverage: [1.2, 1.1, 0.9],
        },
        memory: {
          used: 8589934592, // 8GB
          total: 17179869184, // 16GB  
          percentage: 50.0,
        },
        disk: {
          used: 107374182400, // 100GB
          total: 536870912000, // 500GB
          percentage: 20.0,
        },
        database: {
          connections: 5,
          size: 52428800, // 50MB
          queryTime: 2.5,
        },
      };

      // 获取同步统计
      const syncStats = this.syncJobsTable.getStats();

      // 获取系统概览数据
      const systemOverview = await this.getSystemOverview();

      // 模拟最近告警（实际应该从告警系统获取）
      const recentAlerts = [
        {
          id: 'alert-1',
          severity: 'medium',
          message: '系统内存使用率较高',
          triggeredAt: new Date(Date.now() - 3600000).toISOString(), // 1小时前
        },
      ];

      return {
        success: true,
        data: {
          health: healthData,
          metrics: mockMetrics,
          syncStats: {
            total: syncStats.total,
            pending: syncStats.byStatus['NEW'] || 0,
            processing: (syncStats.byStatus['SPLIT_OK'] || 0) + (syncStats.byStatus['EMBED_OK'] || 0),
            completed: syncStats.byStatus['SYNCED'] || 0,
            failed: syncStats.byStatus['FAILED'] || 0,
            successRate: syncStats.successRate,
            avgDuration: syncStats.avgDuration,
            byStatus: syncStats.byStatus,
          },
          recentAlerts: [],
          systemOverview,
        },
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
