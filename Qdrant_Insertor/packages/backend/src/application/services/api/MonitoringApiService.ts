import { MonitoringService } from '../monitoring/index.js';
import { AlertService } from '../alerting/index.js';
import { IMonitoringApiService } from '@domain/repositories/IMonitoringApiService.js';
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
   * 创建监控API服务实例
   * @param monitoringService 监控服务实例
   * @param alertService 告警服务实例
   */
  constructor(
    monitoringService: MonitoringService,
    alertService: AlertService,
  ) {
    this.monitoringService = monitoringService;
    this.alertService = alertService;
    this.core = new MonitoringApiServiceCore(monitoringService);
    this.alertApi = new AlertApiService(alertService);
    this.notificationApi = new NotificationApiService(alertService);
  }

  /**
   * 健康检查API
   * @param request 健康检查请求
   * @returns {Promise<HealthCheckResponse>} 返回健康检查响应
   */
  async getHealthCheck(
    request: HealthCheckRequest,
  ): Promise<HealthCheckResponse> {
    return this.core.getHealthCheck(request);
  }

  /**
   * 同步作业统计API
   * @param request 同步作业统计请求
   * @returns {Promise<SyncJobStatsResponse>} 返回同步作业统计响应
   */
  async getSyncJobStats(
    request: SyncJobStatsRequest,
  ): Promise<SyncJobStatsResponse> {
    return this.core.getSyncJobStats(request);
  }

  /**
   * 系统指标API
   * @param request 系统指标请求
   * @returns {Promise<SystemMetricsResponse>} 返回系统指标响应
   */
  async getSystemMetrics(
    request: SystemMetricsRequest,
  ): Promise<SystemMetricsResponse> {
    return this.core.getSystemMetrics(request);
  }

  /**
   * 获取仪表板数据API
   * @param request 仪表板数据请求
   * @returns {Promise<DashboardDataResponse>} 返回仪表板数据响应
   */
  async getDashboardData(
    request: DashboardDataRequest,
  ): Promise<DashboardDataResponse> {
    return await this.core.getDashboardData(request);
  }

  /**
   * 创建告警规则API
   * @param request 创建告警规则请求
   * @returns {Promise<AlertRuleResponse>} 返回告警规则响应
   */
  async createAlertRule(
    request: CreateAlertRuleRequest,
  ): Promise<AlertRuleResponse> {
    return this.alertApi.createAlertRule(request);
  }

  /**
   * 获取告警规则列表API
   * @returns {Promise<AlertRuleResponse[]>} 返回告警规则列表响应
   */
  async getAlertRules(): Promise<AlertRuleResponse[]> {
    return this.alertApi.getAlertRules();
  }

  /**
   * 分页获取告警规则列表API
   * @param page 页码
   * @param limit 每页数量
   * @param sort 排序字段
   * @param order 排序方向
   * @param activeOnly 是否只返回活跃的告警规则
   * @returns {Promise<{ rules: AlertRuleResponse[]; total: number }>} 返回分页的告警规则列表响应
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
   * @param ruleId 告警规则ID
   * @param request 更新告警规则请求
   * @returns {Promise<AlertRuleResponse>} 返回更新后的告警规则响应
   */
  async updateAlertRule(
    ruleId: string,
    request: UpdateAlertRuleRequest,
  ): Promise<AlertRuleResponse> {
    return this.alertApi.updateAlertRule(ruleId, request);
  }

  /**
   * 删除告警规则API
   * @param ruleId 告警规则ID
   * @returns {Promise<void>} 返回删除结果
   */
  async deleteAlertRule(ruleId: string): Promise<void> {
    return this.alertApi.deleteAlertRule(ruleId);
  }

  /**
   * 获取告警历史API
   * @param request 告警历史请求
   * @returns {Promise<AlertHistoryResponse>} 返回告警历史响应
   */
  async getAlertHistory(
    request: AlertHistoryRequest,
  ): Promise<AlertHistoryResponse> {
    return this.alertApi.getAlertHistory(request);
  }

  /**
   * 创建通知渠道API
   * @param request 创建通知渠道请求
   * @returns {Promise<NotificationChannelResponse>} 返回通知渠道响应
   */
  async createNotificationChannel(
    request: CreateNotificationChannelRequest,
  ): Promise<NotificationChannelResponse> {
    return this.notificationApi.createNotificationChannel(request);
  }

  /**
   * 获取通知渠道列表API
   * @returns {Promise<NotificationChannelResponse[]>} 返回通知渠道列表响应
   */
  async getNotificationChannels(): Promise<NotificationChannelResponse[]> {
    return this.notificationApi.getNotificationChannels();
  }

  /**
   * 更新通知渠道API
   * @param channelId 通知渠道ID
   * @param request 更新通知渠道请求
   * @returns {Promise<NotificationChannelResponse>} 返回更新后的通知渠道响应
   */
  async updateNotificationChannel(
    channelId: string,
    request: UpdateNotificationChannelRequest,
  ): Promise<NotificationChannelResponse> {
    return this.notificationApi.updateNotificationChannel(channelId, request);
  }

  /**
   * 删除通知渠道API
   * @param channelId 通知渠道ID
   * @returns {Promise<void>} 返回删除结果
   */
  async deleteNotificationChannel(channelId: string): Promise<void> {
    return this.notificationApi.deleteNotificationChannel(channelId);
  }

  /**
   * 测试通知API
   * @param request 测试通知请求
   * @returns {Promise<TestNotificationResponse>} 返回测试通知响应
   */
  async testNotification(
    request: TestNotificationRequest,
  ): Promise<TestNotificationResponse> {
    return this.notificationApi.testNotification(request);
  }
}
