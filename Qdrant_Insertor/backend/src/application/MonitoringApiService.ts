import { MonitoringService } from './MonitoringService.js';
import { AlertService } from './AlertService.js';
import { SyncJobsTable } from '../infrastructure/sqlite/dao/SyncJobsTable.js';
import {
  HealthCheckRequest,
  HealthCheckResponse,
  SyncJobStatsRequest,
  SyncJobStatsResponse,
  SystemMetricsRequest,
  SystemMetricsResponse,
  CreateAlertRuleRequest,
  AlertRuleResponse,
  UpdateAlertRuleRequest,
  AlertHistoryRequest,
  AlertHistoryResponse,
  DashboardDataRequest,
  DashboardDataResponse,
  CreateNotificationChannelRequest,
  NotificationChannelResponse,
  UpdateNotificationChannelRequest,
  TestNotificationRequest,
  TestNotificationResponse
} from '../api/contracts/monitoring.js';
import { logger } from '../logger.js';
import { AlertRule, AlertSeverity } from '../infrastructure/sqlite/dao/index.js';

export class MonitoringApiService {
  constructor(
    private monitoringService: MonitoringService,
    private alertService: AlertService,
    private syncJobsTable: SyncJobsTable
  ) {}

  // 健康检查API
  async getHealthCheck(request: HealthCheckRequest): Promise<HealthCheckResponse> {
    try {
      logger.info('Getting health check', { component: request.component });
      
      const healthData = this.monitoringService.getSystemHealth();
      const components = this.monitoringService.getAllComponentHealth();
      
      // 转换组件格式
      const componentMap: Record<string, {
        status: 'healthy' | 'degraded' | 'unhealthy';
        lastCheck: string;
        message?: string;
        responseTime?: number;
      }> = {};
      components.forEach(comp => {
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
        overallHealth: healthData.status as 'healthy' | 'degraded' | 'unhealthy',
      };
    } catch (error) {
      logger.error('Failed to get health check', { error, request });
      throw error;
    }
  }

  // 同步作业统计API
  async getSyncJobStats(request: SyncJobStatsRequest): Promise<SyncJobStatsResponse> {
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
        recentJobs: recentJobs.map(job => ({
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

  // 系统指标API
  async getSystemMetrics(request: SystemMetricsRequest): Promise<SystemMetricsResponse> {
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
        now
      );
      
      // 计算聚合值
      const aggregations: Record<string, number> = {};
      if (metrics.length > 0) {
        const values = metrics.map(m => m.metricValue);
        aggregations.avg = values.reduce((sum, val) => sum + val, 0) / values.length;
        aggregations.min = Math.min(...values);
        aggregations.max = Math.max(...values);
        aggregations.sum = values.reduce((sum, val) => sum + val, 0);
        aggregations.count = values.length;
      }
      
      return {
        timeRange: request.timeRange,
        metrics: metrics.map(metric => ({
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

  // 创建告警规则API
  async createAlertRule(request: CreateAlertRuleRequest): Promise<AlertRuleResponse> {
    try {
      logger.info('Creating alert rule', { name: request.name });
      
      const ruleId = this.alertService.createAlertRule({
        name: request.name,
        description: request.description,
        metricName: request.metricName,
        conditionOperator: request.condition as '>' | '<' | '>=' | '<=' | '==' | '!=',
        thresholdValue: request.threshold,
        severity: request.severity as AlertSeverity,
        isActive: request.enabled,
        cooldownMinutes: request.cooldownMinutes,
        notificationChannels: request.notificationChannels || [],
      });
      
      const rule = this.alertService.getAlertRule(ruleId);
      if (!rule) {
        throw new Error('Failed to retrieve created alert rule');
      }
      
      return {
        id: rule.id,
        name: rule.name,
        description: rule.description,
        metricName: rule.metricName,
        condition: rule.conditionOperator,
        threshold: rule.thresholdValue,
        severity: rule.severity,
        enabled: rule.isActive,
        cooldownMinutes: rule.cooldownMinutes,
        notificationChannels: rule.notificationChannels,
        createdAt: new Date(rule.createdAt).toISOString(),
        updatedAt: new Date(rule.updatedAt).toISOString(),
        lastTriggered: undefined, // AlertRule中没有这个字段
      };
    } catch (error) {
      logger.error('Failed to create alert rule', { error, request });
      throw error;
    }
  }

  // 获取告警规则列表API
  async getAlertRules(): Promise<AlertRuleResponse[]> {
    try {
      logger.info('Getting alert rules');
      
      const rules = this.alertService.getAllAlertRules();
      
      return rules.map(rule => ({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        metricName: rule.metricName,
        condition: rule.conditionOperator,
        threshold: rule.thresholdValue,
        severity: rule.severity,
        enabled: rule.isActive,
        cooldownMinutes: rule.cooldownMinutes,
        notificationChannels: rule.notificationChannels,
        createdAt: new Date(rule.createdAt).toISOString(),
        updatedAt: new Date(rule.updatedAt).toISOString(),
        lastTriggered: undefined, // AlertRule中没有这个字段
      }));
    } catch (error) {
      logger.error('Failed to get alert rules', { error });
      throw error;
    }
  }

  // 更新告警规则API
  async updateAlertRule(ruleId: string, request: UpdateAlertRuleRequest): Promise<AlertRuleResponse> {
    try {
      logger.info('Updating alert rule', { ruleId, request });
      
      const updates: Partial<AlertRule> = {};
      if (request.name !== undefined) updates.name = request.name;
      if (request.description !== undefined) updates.description = request.description;
      if (request.metricName !== undefined) updates.metricName = request.metricName;
      if (request.condition !== undefined) updates.conditionOperator = request.condition as '>' | '<' | '>=' | '<=' | '==' | '!=';
      if (request.threshold !== undefined) updates.thresholdValue = request.threshold;
      if (request.severity !== undefined) updates.severity = request.severity as AlertSeverity;
      if (request.enabled !== undefined) updates.isActive = request.enabled;
      if (request.cooldownMinutes !== undefined) updates.cooldownMinutes = request.cooldownMinutes;
      if (request.notificationChannels !== undefined) updates.notificationChannels = request.notificationChannels;
      
      const success = this.alertService.updateAlertRule(ruleId, updates);
      if (!success) {
        throw new Error('Failed to update alert rule');
      }
      
      const rule = this.alertService.getAlertRule(ruleId);
      if (!rule) {
        throw new Error('Failed to retrieve updated alert rule');
      }
      
      return {
        id: rule.id,
        name: rule.name,
        description: rule.description,
        metricName: rule.metricName,
        condition: rule.conditionOperator,
        threshold: rule.thresholdValue,
        severity: rule.severity,
        enabled: rule.isActive,
        cooldownMinutes: rule.cooldownMinutes,
        notificationChannels: rule.notificationChannels,
        createdAt: new Date(rule.createdAt).toISOString(),
        updatedAt: new Date(rule.updatedAt).toISOString(),
        lastTriggered: undefined, // AlertRule中没有这个字段
      };
    } catch (error) {
      logger.error('Failed to update alert rule', { error, ruleId, request });
      throw error;
    }
  }

  // 删除告警规则API
  async deleteAlertRule(ruleId: string): Promise<void> {
    try {
      logger.info('Deleting alert rule', { ruleId });
      
      await this.alertService.deleteAlertRule(ruleId);
    } catch (error) {
      logger.error('Failed to delete alert rule', { error, ruleId });
      throw error;
    }
  }

  // 获取告警历史API
  async getAlertHistory(request: AlertHistoryRequest): Promise<AlertHistoryResponse> {
    try {
      logger.info('Getting alert history', { request });
      
      const alerts = this.alertService.getAlertHistory(request.limit, request.offset, request.ruleId);
      
      return {
        alerts: alerts.map(alert => ({
          id: alert.id,
          ruleId: alert.ruleId,
          ruleName: (alert as { ruleName?: string }).ruleName || 'Unknown',
          severity: alert.severity,
          status: alert.status,
          message: alert.message || 'No message',
          triggeredAt: new Date(alert.triggeredAt).toISOString(),
          resolvedAt: alert.resolvedAt ? new Date(alert.resolvedAt).toISOString() : undefined,
          acknowledgedAt: undefined, // AlertHistory中没有这个字段
          acknowledgedBy: undefined, // AlertHistory中没有这个字段
          metricValue: alert.metricValue,
          threshold: alert.thresholdValue,
        })),
        total: alerts.length,
        limit: request.limit,
        offset: request.offset,
      };
    } catch (error) {
      logger.error('Failed to get alert history', { error, request });
      throw error;
    }
  }

  // 获取仪表板数据API
  async getDashboardData(request: DashboardDataRequest): Promise<DashboardDataResponse> {
    try {
      logger.info('Getting dashboard data', { request });
      
      // 获取概览数据
      const syncStats = this.syncJobsTable.getStats();
      const alertStats = this.alertService.getAlertStats();
      
      // 获取系统健康状态
      const healthData = this.monitoringService.getSystemHealth();
      
      // 获取最近的告警
      const recentAlerts = this.alertService.getAlertHistory(5);
      
      // 获取所有指标名称
      const metricNames = this.monitoringService.getAllMetricNames();
      
      // 获取最重要的指标（取前5个的最新值）
      const topMetrics = metricNames.slice(0, 5).map(name => {
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
          activeSyncJobs: syncStats.byStatus['NEW'] + syncStats.byStatus['SPLIT_OK'] + syncStats.byStatus['EMBED_OK'],
          successRate: syncStats.successRate,
          averageProcessingTime: syncStats.avgDuration,
          totalAlerts: alertStats.total || 0,
          activeAlerts: this.alertService.getActiveAlerts().length,
        },
        systemHealth: {
          status: healthData.status,
          components: {}, // 简化处理
        },
        recentAlerts: recentAlerts.map(alert => ({
          id: alert.id,
          severity: alert.severity,
          message: alert.message || 'No message',
          triggeredAt: new Date(alert.triggeredAt).toISOString(),
        })),
        syncJobTrends: [], // 简化处理，暂不实现趋势数据
        topMetrics,
      };
    } catch (error) {
      logger.error('Failed to get dashboard data', { error, request });
      throw error;
    }
  }

  // 创建通知渠道API
  async createNotificationChannel(request: CreateNotificationChannelRequest): Promise<NotificationChannelResponse> {
    try {
      logger.info('Creating notification channel', { name: request.name });
      
      const channel = await this.alertService.createNotificationChannel({
        name: request.name,
        type: request.type,
        config: request.config,
        isActive: request.enabled,
      });
      
      return {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        config: channel.config,
        enabled: channel.isActive,
        createdAt: new Date(channel.createdAt).toISOString(),
        updatedAt: new Date(channel.updatedAt).toISOString(),
        lastUsed: undefined, // NotificationChannel中没有这个字段
      };
    } catch (error) {
      logger.error('Failed to create notification channel', { error, request });
      throw error;
    }
  }

  // 获取通知渠道列表API
  async getNotificationChannels(): Promise<NotificationChannelResponse[]> {
    try {
      logger.info('Getting notification channels');
      
      const channels = await this.alertService.getNotificationChannels();
      
      return channels.map(channel => ({
        id: channel.id,
        name: channel.name,
        type: channel.type,
        config: channel.config,
        enabled: channel.isActive,
        createdAt: new Date(channel.createdAt).toISOString(),
        updatedAt: new Date(channel.updatedAt).toISOString(),
        lastUsed: undefined, // NotificationChannel中没有这个字段
      }));
    } catch (error) {
      logger.error('Failed to get notification channels', { error });
      throw error;
    }
  }

  // 更新通知渠道API
  async updateNotificationChannel(channelId: string, request: UpdateNotificationChannelRequest): Promise<NotificationChannelResponse> {
    try {
      logger.info('Updating notification channel', { channelId, request });
      
      const channel = await this.alertService.updateNotificationChannel(channelId, request);
      
      return {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        config: channel.config,
        enabled: channel.isActive,
        createdAt: new Date(channel.createdAt).toISOString(),
        updatedAt: new Date(channel.updatedAt).toISOString(),
        lastUsed: undefined, // NotificationChannel中没有这个字段
      };
    } catch (error) {
      logger.error('Failed to update notification channel', { error, channelId, request });
      throw error;
    }
  }

  // 删除通知渠道API
  async deleteNotificationChannel(channelId: string): Promise<void> {
    try {
      logger.info('Deleting notification channel', { channelId });
      
      await this.alertService.deleteNotificationChannel(channelId);
    } catch (error) {
      logger.error('Failed to delete notification channel', { error, channelId });
      throw error;
    }
  }

  // 测试通知API
  async testNotification(request: TestNotificationRequest): Promise<TestNotificationResponse> {
    try {
      logger.info('Testing notification', { channelId: request.channelId });
      
      const result = await this.alertService.testNotification(
        request.channelId,
        request.message,
        request.severity
      );
      
      return {
        success: result.success,
        message: result.message,
        timestamp: result.timestamp,
      };
    } catch (error) {
      logger.error('Failed to test notification', { error, request });
      throw error;
    }
  }

  // 辅助方法：将时间范围转换为毫秒
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