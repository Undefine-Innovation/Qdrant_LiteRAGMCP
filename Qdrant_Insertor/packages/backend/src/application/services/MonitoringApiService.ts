import { MonitoringService } from './MonitoringService.js';
import { AlertService } from './AlertService.js';
import { IMonitoringApiService } from '@domain/repositories/IMonitoringApiService.js';
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
} from '@api/contracts/monitoring.js';
import { MonitoringApiServiceCore } from './MonitoringApiServiceCore.js';
import { AlertApiService } from './AlertApiService.js';
import { NotificationApiService } from './NotificationApiService.js';

/**
 * 监控API服务
 * 负责处理所有监控相关的API请求
 */
export class MonitoringApiService implements IMonitoringApiService {
  private readonly core: MonitoringApiServiceCore;
  private readonly alertApi: AlertApiService;
  private readonly notificationApi: NotificationApiService;
  public readonly monitoringService: MonitoringService;
  public readonly alertService: AlertService;

  /**
   *
   * @param monitoringService
   * @param alertService
   * @param syncJobsTable
   */
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
   * @param request
   */
  async getHealthCheck(
    request: HealthCheckRequest,
  ): Promise<HealthCheckResponse> {
    return this.core.getHealthCheck(request);
  }

  /**
   * 同步作业统计API
   * @param request
   */
  async getSyncJobStats(
    request: SyncJobStatsRequest,
  ): Promise<SyncJobStatsResponse> {
    return this.core.getSyncJobStats(request);
  }

  /**
   * 系统指标API
   * @param request
   */
  async getSystemMetrics(
    request: SystemMetricsRequest,
  ): Promise<SystemMetricsResponse> {
    return this.core.getSystemMetrics(request);
  }

  /**
   * 获取仪表板数据API
   * @param request
   */
  async getDashboardData(
    request: DashboardDataRequest,
  ): Promise<DashboardDataResponse> {
    return await this.core.getDashboardData(request);
  }

  /**
   * 创建告警规则API
   * @param request
   */
  async createAlertRule(
    request: CreateAlertRuleRequest,
  ): Promise<AlertRuleResponse> {
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
   * @param page
   * @param limit
   * @param sort
   * @param order
   * @param activeOnly
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
   * @param ruleId
   * @param request
   */
  async updateAlertRule(
    ruleId: string,
    request: UpdateAlertRuleRequest,
  ): Promise<AlertRuleResponse> {
    return this.alertApi.updateAlertRule(ruleId, request);
  }

  /**
   * 删除告警规则API
   * @param ruleId
   */
  async deleteAlertRule(ruleId: string): Promise<void> {
    return this.alertApi.deleteAlertRule(ruleId);
  }

  /**
   * 获取告警历史API
   * @param request
   */
  async getAlertHistory(
    request: AlertHistoryRequest,
  ): Promise<AlertHistoryResponse> {
    return this.alertApi.getAlertHistory(request);
  }

  /**
   * 创建通知渠道API
   * @param request
   */
  async createNotificationChannel(
    request: CreateNotificationChannelRequest,
  ): Promise<NotificationChannelResponse> {
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
   * @param channelId
   * @param request
   */
  async updateNotificationChannel(
    channelId: string,
    request: UpdateNotificationChannelRequest,
  ): Promise<NotificationChannelResponse> {
    return this.notificationApi.updateNotificationChannel(channelId, request);
  }

  /**
   * 删除通知渠道API
   * @param channelId
   */
  async deleteNotificationChannel(channelId: string): Promise<void> {
    return this.notificationApi.deleteNotificationChannel(channelId);
  }

  /**
   * 测试通知API
   * @param request
   */
  async testNotification(
    request: TestNotificationRequest,
  ): Promise<TestNotificationResponse> {
    return this.notificationApi.testNotification(request);
  }
}
