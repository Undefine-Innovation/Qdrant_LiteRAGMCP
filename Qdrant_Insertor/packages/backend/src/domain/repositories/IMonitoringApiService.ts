/**
 * 监控API服务接口
 * @description 定义监控API的核心业务接口，遵循依赖倒置原则
 */

import type {
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
} from '../../api/contracts/Monitoring.js';

/**
 * 监控API服务接口
 * @description 应用层应该依赖此接口而不是具体实现
 */
export interface IMonitoringApiService {
  /**
   * 健康检查API
   * @param request 健康检查请求
   * @returns 健康检查响应
   */
  getHealthCheck(request: HealthCheckRequest): Promise<HealthCheckResponse>;

  /**
   * 同步作业统计API
   * @param request 同步作业统计请求
   * @returns 同步作业统计响应
   */
  getSyncJobStats(request: SyncJobStatsRequest): Promise<SyncJobStatsResponse>;

  /**
   * 系统指标API
   * @param request 系统指标请求
   * @returns 系统指标响应
   */
  getSystemMetrics(
    request: SystemMetricsRequest,
  ): Promise<SystemMetricsResponse>;

  /**
   * 获取仪表板数据API
   * @param request 仪表板数据请求
   * @returns 仪表板数据响应
   */
  getDashboardData(
    request: DashboardDataRequest,
  ): Promise<DashboardDataResponse>;

  /**
   * 创建告警规则API
   * @param request 创建告警规则请求
   * @returns 告警规则响应
   */
  createAlertRule(request: CreateAlertRuleRequest): Promise<AlertRuleResponse>;

  /**
   * 获取告警规则列表API
   * @returns 告警规则列表
   */
  getAlertRules(): Promise<AlertRuleResponse[]>;

  /**
   * 分页获取告警规则列表API
   * @param page 页码
   * @param limit 每页数量
   * @param sort 排序字段
   * @param order 排序方向
   * @param activeOnly 仅活跃规则
   * @returns 分页告警规则列表
   */
  getAlertRulesPaginated(
    page: number,
    limit: number,
    sort?: string,
    order?: 'asc' | 'desc',
    activeOnly?: boolean,
  ): Promise<{ rules: AlertRuleResponse[]; total: number }>;

  /**
   * 更新告警规则API
   * @param ruleId 规则ID
   * @param request 更新告警规则请求
   * @returns 告警规则响应
   */
  updateAlertRule(
    ruleId: string,
    request: UpdateAlertRuleRequest,
  ): Promise<AlertRuleResponse>;

  /**
   * 删除告警规则API
   * @param ruleId 规则ID
   */
  deleteAlertRule(ruleId: string): Promise<void>;

  /**
   * 获取告警历史API
   * @param request 告警历史请求
   * @returns 告警历史响应
   */
  getAlertHistory(request: AlertHistoryRequest): Promise<AlertHistoryResponse>;

  /**
   * 创建通知渠道API
   * @param request 创建通知渠道请求
   * @returns 通知渠道响应
   */
  createNotificationChannel(
    request: CreateNotificationChannelRequest,
  ): Promise<NotificationChannelResponse>;

  /**
   * 获取通知渠道列表API
   * @returns 通知渠道列表
   */
  getNotificationChannels(): Promise<NotificationChannelResponse[]>;

  /**
   * 更新通知渠道API
   * @param channelId 渠道ID
   * @param request 更新通知渠道请求
   * @returns 通知渠道响应
   */
  updateNotificationChannel(
    channelId: string,
    request: UpdateNotificationChannelRequest,
  ): Promise<NotificationChannelResponse>;

  /**
   * 删除通知渠道API
   * @param channelId 渠道ID
   */
  deleteNotificationChannel(channelId: string): Promise<void>;

  /**
   * 测试通知API
   * @param request 测试通知请求
   * @returns 测试通知响应
   */
  testNotification(
    request: TestNotificationRequest,
  ): Promise<TestNotificationResponse>;
}
