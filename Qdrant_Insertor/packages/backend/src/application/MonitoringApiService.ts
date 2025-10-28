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
  DashboardDataRequest,
  DashboardDataResponse,
  CreateAlertRuleRequest,
  AlertRuleResponse,
  UpdateAlertRuleRequest,
  AlertHistoryRequest,
  AlertHistoryResponse,
  CreateNotificationChannelRequest,
  NotificationChannelResponse,
  UpdateNotificationChannelRequest,
  TestNotificationRequest,
  TestNotificationResponse,
} from '../api/contracts/monitoring.js';
import { MonitoringApiServiceCore } from './MonitoringApiServiceCore.js';
import { AlertApiService } from './AlertApiService.js';
import { NotificationApiService } from './NotificationApiService.js';

/**
 * 监控API服务
 * 负责处理所有监控相关的API请求
 */
export class MonitoringApiService {
  private readonly core: MonitoringApiServiceCore;
  private readonly alertApi: AlertApiService;
  private readonly notificationApi: NotificationApiService;
  public readonly monitoringService: MonitoringService;
  public readonly alertService: AlertService;

  constructor(
    monitoringService: MonitoringService,
    alertService: AlertService,
    syncJobsTable: SyncJobsTable,
  ) {
    this.monitoringService = monitoringService;
    this.alertService = alertService;
    this.core = new MonitoringApiServiceCore(monitoringService, syncJobsTable);
    this.alertApi = new AlertApiService(alertService);
    this.notificationApi = new NotificationApiService(alertService);
  }

  /**
   * 健康检查API
   */
  async getHealthCheck(
    request: HealthCheckRequest,
  ): Promise<HealthCheckResponse> {
    return this.core.getHealthCheck(request);
  }

  /**
   * 同步作业统计API
   */
  async getSyncJobStats(
    request: SyncJobStatsRequest,
  ): Promise<SyncJobStatsResponse> {
    return this.core.getSyncJobStats(request);
  }

  /**
   * 系统指标API
   */
  async getSystemMetrics(
    request: SystemMetricsRequest,
  ): Promise<SystemMetricsResponse> {
    return this.core.getSystemMetrics(request);
  }

  /**
   * 获取仪表板数据API
   */
  async getDashboardData(
    request: DashboardDataRequest,
  ): Promise<DashboardDataResponse> {
    const dashboardData = await this.core.getDashboardData(request);

    // 添加告警相关数据
    const alertStats = await this.alertApi.getAlertRules();
    const activeAlerts = await this.alertApi.getAlertHistory({
      offset: 0,
      limit: 100,
      timeRange: '24h',
    });

    return {
      ...dashboardData,
      overview: {
        ...dashboardData.overview,
        totalAlerts: alertStats.length,
        activeAlerts: activeAlerts.alerts.length,
      },
      recentAlerts: activeAlerts.alerts.slice(0, 5).map((alert) => ({
        id: alert.id,
        severity: alert.severity,
        message: alert.message || 'No message',
        triggeredAt: new Date(alert.triggeredAt).toISOString(),
      })),
    };
  }

  /**
   * 创建告警规则API
   */
  async createAlertRule(request: CreateAlertRuleRequest): Promise<AlertRuleResponse> {
    return this.alertApi.createAlertRule(request);
  }

  /**
   * 获取告警规则列表API
   */
  async getAlertRules(): Promise<AlertRuleResponse[]> {
    return this.alertApi.getAlertRules();
  }

  /**
   * 分页获取告警规则列表API
   */
  async getAlertRulesPaginated(
    page: number,
    limit: number,
    sort: string = 'created_at',
    order: 'asc' | 'desc' = 'desc',
    activeOnly?: boolean,
  ): Promise<{ rules: AlertRuleResponse[]; total: number }> {
    return this.alertApi.getAlertRulesPaginated(
      page,
      limit,
      sort,
      order,
      activeOnly,
    );
  }

  /**
   * 更新告警规则API
   */
  async updateAlertRule(ruleId: string, request: UpdateAlertRuleRequest): Promise<AlertRuleResponse> {
    return this.alertApi.updateAlertRule(ruleId, request);
  }

  /**
   * 删除告警规则API
   */
  async deleteAlertRule(ruleId: string): Promise<void> {
    return this.alertApi.deleteAlertRule(ruleId);
  }

  /**
   * 获取告警历史API
   */
  async getAlertHistory(request: AlertHistoryRequest): Promise<AlertHistoryResponse> {
    return this.alertApi.getAlertHistory(request);
  }

  /**
   * 创建通知渠道API
   */
  async createNotificationChannel(request: CreateNotificationChannelRequest): Promise<NotificationChannelResponse> {
    return this.notificationApi.createNotificationChannel(request);
  }

  /**
   * 获取通知渠道列表API
   */
  async getNotificationChannels(): Promise<NotificationChannelResponse[]> {
    return this.notificationApi.getNotificationChannels();
  }

  /**
   * 更新通知渠道API
   */
  async updateNotificationChannel(
    channelId: string,
    request: UpdateNotificationChannelRequest,
  ): Promise<NotificationChannelResponse> {
    return this.notificationApi.updateNotificationChannel(channelId, request);
  }

  /**
   * 删除通知渠道API
   */
  async deleteNotificationChannel(channelId: string): Promise<void> {
    return this.notificationApi.deleteNotificationChannel(channelId);
  }

  /**
   * 测试通知API
   */
  async testNotification(request: TestNotificationRequest): Promise<TestNotificationResponse> {
    return this.notificationApi.testNotification(request);
  }
}
