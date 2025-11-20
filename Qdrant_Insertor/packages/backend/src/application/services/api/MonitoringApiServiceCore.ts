import { MonitoringService } from '../monitoring/index.js';
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
   * 创建监控API服务核心实例
   * @param monitoringService 监控服务实例，可为 null（测试或禁用时）
   */
  constructor(private monitoringService: MonitoringService | null) {}

  /**
   * 获取系统概览数据
   * @returns {Promise<{ documentsCount: number; collectionsCount: number; chunksCount: number; vectorsCount: number }>} 返回系统概览数据
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
   * @param request 健康检查请求
   * @returns {Promise<HealthCheckResponse>} 返回健康检查响应
   */
  async getHealthCheck(
    request: HealthCheckRequest,
  ): Promise<HealthCheckResponse> {
    try {
      logger.info('Getting health check', { component: request.component });

      // 如果 monitoringService 为 null，返回默认的健康状态
      if (!this.monitoringService) {
        return {
          status: 'healthy' as const,
          timestamp: new Date().toISOString(),
          components: {
            database: {
              status: 'healthy' as const,
              lastCheck: new Date().toISOString(),
            },
            qdrant: {
              status: 'healthy' as const,
              lastCheck: new Date().toISOString(),
            },
            filesystem: {
              status: 'healthy' as const,
              lastCheck: new Date().toISOString(),
            },
          },
          overallHealth: 'healthy' as const,
        };
      }

      const healthData = await this.monitoringService.getSystemHealth();
      const components = await this.monitoringService.getAllComponentHealth();

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
   * @param request 同步作业统计请求
   * @returns {Promise<SyncJobStatsResponse>} 返回同步作业统计响应
   */
  async getSyncJobStats(
    request: SyncJobStatsRequest,
  ): Promise<SyncJobStatsResponse> {
    try {
      logger.info('Getting sync job stats', { request });

      // 返回默认统计数据
      return {
        timeRange: request.timeRange,
        totalJobs: 0,
        statusBreakdown: {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
        },
        successRate: 0,
        averageProcessingTime: 0,
        recentJobs: [],
      };
    } catch (error) {
      logger.error('Failed to get sync job stats', { error, request });
      throw error;
    }
  }

  /**
   * 系统指标API
   * @param request 系统指标请求
   * @returns {Promise<SystemMetricsResponse>} 返回系统指标响应
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

      // 如果 monitoringService 为 null，返回空指标列表
      if (!this.monitoringService) {
        return {
          timeRange: request.timeRange,
          metrics: [],
          aggregations: {},
        };
      }

      const metrics = await this.monitoringService.getMetrics(
        request.metricName,
        startTime,
        now,
      );

      // 计算聚合值
      const aggregations: Record<string, number> = {};
      if (metrics && metrics.length > 0) {
        const values = metrics.map((m: unknown) => {
          const metric = m as Record<string, unknown>;
          return metric.metricValue as number;
        });
        aggregations.avg =
          values.reduce((sum: number, val: number) => sum + val, 0) /
          values.length;
        aggregations.min = Math.min(...values);
        aggregations.max = Math.max(...values);
        aggregations.sum = values.reduce(
          (sum: number, val: number) => sum + val,
          0,
        );
        aggregations.count = values.length;
      }

      return {
        timeRange: request.timeRange,
        metrics: (metrics || []).map((metric: unknown) => {
          const m = metric as Record<string, unknown>;
          return {
            name: m.metricName as string,
            value: m.metricValue as number,
            unit: (m.metricUnit as string) || '',
            timestamp: new Date(m.timestamp as number).toISOString(),
            component: 'system', // SystemMetric中没有component字段
          };
        }),
        aggregations,
      };
    } catch (error) {
      logger.error('Failed to get system metrics', { error, request });
      throw error;
    }
  }

  /**
   * 获取仪表板数据API
   * @param request 仪表板数据请求
   * @returns {Promise<DashboardDataResponse>} 返回仪表板数据响应
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
            total: 0,
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0,
            successRate: 0,
            avgDuration: 0,
            byStatus: {},
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
   * @param timeRange 时间范围字符串
   * @returns {number} 返回毫秒数
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
