import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { Logger } from '@logging/logger.js';
import { PersistentSyncStateMachine } from '../sync/index.js';
import { MonitoringServiceCore } from './MonitoringServiceCore.js';
import { HealthCheckService } from './HealthCheckService.js';
import { MetricsService } from './MetricsService.js';
import { MonitoringAlerts } from './MonitoringAlerts.js';
import {
  MonitoringMetrics,
  MetricRecord,
  AggregatedMetricSummary,
} from './MonitoringMetrics.js';
import { MonitoringDashboard } from './MonitoringDashboard.js';
import {
  IMonitoringService,
  AlertRule,
  AlertHistoryItem,
  AlertHistoryOptions,
  PerformanceStats,
  AnomalyDetectionOptions,
  PerformanceAnomaly,
  DashboardData,
  SystemOverview,
} from '@domain/repositories/IMonitoringService.js';
import { DataSource } from 'typeorm';
import { AlertRules } from '@infrastructure/database/entities/AlertRules.js';
import { AlertHistory } from '@infrastructure/database/entities/AlertHistory.js';
import { SystemHealth } from '@infrastructure/database/entities/SystemHealth.js';
import { SystemMetrics } from '@infrastructure/database/entities/SystemMetrics.js';

/**
 * 监控服务
 * 负责收集系统指标、健康检查和告警管理
 */
export class MonitoringService implements IMonitoringService {
  private readonly core: MonitoringServiceCore;
  private readonly healthCheck: HealthCheckService;
  private readonly metrics: MetricsService;
  private readonly alertsManager: MonitoringAlerts;
  private readonly metricsManager: MonitoringMetrics;
  private readonly dashboardManager: MonitoringDashboard;

  /**
   * 创建监控服务实例
   * @param sqliteRepo SQLite 仓库实例
   * @param syncStateMachine 持久化同步状态机实例
   * @param logger 日志记录器
   */
  constructor(
    private readonly sqliteRepo: ISQLiteRepo,
    private readonly syncStateMachine: PersistentSyncStateMachine,
    private readonly logger: Logger,
  ) {
    this.core = new MonitoringServiceCore(sqliteRepo, syncStateMachine, logger);
    this.healthCheck = new HealthCheckService(
      sqliteRepo,
      syncStateMachine,
      logger,
    );
    // 注意：MetricsService 需要具体的 SQLiteRepo 实例，这里需要类型适配
    this.metrics = new MetricsService(sqliteRepo, logger);
    this.alertsManager = new MonitoringAlerts(
      () => (this as unknown as { dataSource?: DataSource }).dataSource,
      logger,
    );
    this.metricsManager = new MonitoringMetrics(
      () => (this as unknown as { dataSource?: DataSource }).dataSource,
      logger,
    );
    this.dashboardManager = new MonitoringDashboard(
      () => (this as unknown as { dataSource?: DataSource }).dataSource,
      logger,
    );
  }

  /**
   * 创建 MonitoringService 实例（用于测试）
   * @param dataSource 数据源
   * @param syncStateMachine 同步状态机
   * @param logger 日志记录器
   * @returns {MonitoringService} 返回创建的MonitoringService实例
   */
  static createForTesting(
    dataSource: DataSource,
    syncStateMachine: PersistentSyncStateMachine,
    logger: Logger,
  ): MonitoringService {
    const service = new MonitoringService(
      {} as ISQLiteRepo,
      syncStateMachine,
      logger,
    );
    // 为测试环境添加直接数据库访问
    (service as unknown as { dataSource?: DataSource }).dataSource = dataSource;
    (service as unknown as { metrics?: MetricsService }).metrics =
      MetricsService.createForTesting(dataSource, logger);
    (service as unknown as { healthCheck?: HealthCheckService }).healthCheck =
      new HealthCheckService({} as ISQLiteRepo, syncStateMachine, logger);
    (
      (service as unknown as { healthCheck?: HealthCheckService })
        .healthCheck as unknown as { dataSource?: DataSource }
    ).dataSource = dataSource;
    // 初始化新拆分出的管理器，使用测试 dataSource
    (service as unknown as { alertsManager?: MonitoringAlerts }).alertsManager =
      new MonitoringAlerts(() => dataSource, logger);
    (
      service as unknown as { metricsManager?: MonitoringMetrics }
    ).metricsManager = new MonitoringMetrics(() => dataSource, logger);
    (
      service as unknown as { dashboardManager?: MonitoringDashboard }
    ).dashboardManager = new MonitoringDashboard(() => dataSource, logger);
    return service;
  }

  /**
   * 停止监控服务
   */
  public stop(): void {
    this.healthCheck.stop();
    this.metrics.stop();
  }

  /**
   * 执行系统健康检查
   * @returns Promise<void>
   */
  public async performHealthCheck(): Promise<void> {
    return this.healthCheck.performHealthCheck();
  }

  /**
   * 记录系统指标
   * @param metricName 指标名称
   * @param value 指标值
   * @param unit 指标单位
   * @param tags 指标标签
   * @returns {void} 返回记录结果
   */
  public recordMetric(
    metricName: string,
    value: number,
    unit?: string,
    tags?: Record<string, string | number>,
  ): void {
    const metricData = {
      name: metricName,
      value,
      unit,
      tags,
    };
    this.metrics.recordMetric(metricData);
  }

  /**
   * 获取系统整体健康状态
   * @returns {系统健康状态对象} 返回系统整体健康状态
   */
  public async getSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck: number;
    components: Record<
      string,
      {
        status: 'healthy' | 'degraded' | 'unhealthy';
        lastCheck: string;
        message?: string;
        responseTime?: number;
      }
    >;
  }> {
    return await this.core.getSystemHealth();
  }

  /**
   * 获取组件健康状态
   * @param component 组件名称
   * @returns {组件健康状态对象 | null} 返回组件健康状态
   */
  public async getComponentHealth(component: string): Promise<{
    component: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck: number;
    responseTimeMs?: number;
    errorMessage?: string;
    details?: Record<string, string | number | boolean>;
  } | null> {
    return await this.core.getComponentHealth(component);
  }

  /**
   * 获取所有组件健康状态
   * @returns {组件健康状态对象数组} 返回所有组件健康状态
   */
  public async getAllComponentHealth(): Promise<
    Array<{
      component: string;
      status: 'healthy' | 'degraded' | 'unhealthy';
      lastCheck: number;
      responseTimeMs?: number;
      errorMessage?: string;
      details?: Record<string, string | number | boolean>;
    }>
  > {
    return await this.core.getAllComponentHealth();
  }

  /**
   * 获取不健康的组件
   * @returns {组件健康状态对象数组} 返回不健康的组件列表
   */
  public async getUnhealthyComponents(): Promise<
    Array<{
      component: string;
      status: 'healthy' | 'degraded' | 'unhealthy';
      lastCheck: number;
      responseTimeMs?: number;
      errorMessage?: string;
      details?: Record<string, string | number | boolean>;
    }>
  > {
    return this.core.getUnhealthyComponents();
  }

  /**
   * 获取指标数据
   * @param metricName 指标名称
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @param limit 限制数量
   * @returns {指标数据数组} 返回指标数据
   */
  public async getMetrics(
    metricName: string,
    startTime?: number,
    endTime?: number,
    limit?: number,
  ): Promise<MetricRecord[]> {
    return this.metricsManager.getMetrics(
      metricName,
      startTime,
      endTime,
      limit,
    );
  }

  /**
   * 获取最新指标值
   * @param metricName 指标名称
   * @returns {指标对象 | null} 返回最新指标值
   */
  public async getLatestMetric(
    metricName: string,
  ): Promise<MetricRecord | null> {
    return this.metricsManager.getLatestMetric(metricName);
  }

  /**
   * 获取多个指标的最新值
   * @param metricNames 指标名称数组
   * @returns {指标对象记录} 返回多个指标的最新值
   */
  public async getLatestMetrics(
    metricNames: string[],
  ): Promise<Record<string, MetricRecord | null>> {
    return this.metricsManager.getLatestMetrics(metricNames);
  }

  /**
   * 获取指标聚合数据
   * @param metricName 指标名称
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @param aggregationType 聚合类型
   * @returns {聚合数据对象} 返回指标聚合数据
   */
  public async getAggregatedMetrics(
    metricName: string,
    startTime?: number,
    endTime?: number,
    aggregationType: 'avg' | 'min' | 'max' | 'sum' = 'avg',
  ): Promise<AggregatedMetricSummary> {
    return this.metricsManager.getAggregatedMetrics(
      metricName,
      startTime,
      endTime,
      aggregationType,
    );
  }

  /**
   * 获取所有指标名称
   * @returns {string[]} 返回所有指标名称
   */
  public async getAllMetricNames(): Promise<string[]> {
    return this.metricsManager.getAllMetricNames();
  }

  /**
   * 获取指标统计信息
   * @param metricName 指标名称
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @returns {统计信息对象} 返回指标统计信息
   */
  public async getMetricStats(
    metricName: string,
    startTime?: number,
    endTime?: number,
  ): Promise<AggregatedMetricSummary> {
    return this.metricsManager.getMetricStats(metricName, startTime, endTime);
  }

  /**
   * 清理过期的监控数据
   * @param olderThanDays 天数阈值
   * @returns {void} 返回清理结果
   */
  public async cleanup(olderThanDays: number = 30): Promise<void> {
    return this.core.cleanup(olderThanDays);
  }

  /**
   * 创建告警规则
   * @param rule - 告警规则配置（不包含id）
   * @returns Promise<AlertRule>
   */
  public async createAlertRule(
    rule: Omit<AlertRule, 'id'>,
  ): Promise<AlertRule> {
    return this.alertsManager.createAlertRule(rule);
  }

  /**
   * 更新告警规则
   * @param id - 告警规则ID
   * @param updates - 要更新的字段
   * @returns Promise<AlertRule>
   */
  public async updateAlertRule(
    id: string,
    updates: Partial<AlertRule>,
  ): Promise<AlertRule> {
    return this.alertsManager.updateAlertRule(id, updates);
  }

  /**
   * 删除告警规则
   * @param id - 告警规则ID
   * @returns Promise<void>
   */
  public async deleteAlertRule(id: string): Promise<void> {
    return this.alertsManager.deleteAlertRule(id);
  }

  /**
   * 获取所有告警规则
   * @returns Promise<AlertRule[]>
   */
  public async getAllAlertRules(): Promise<AlertRule[]> {
    return this.alertsManager.getAllAlertRules();
  }

  /**
   * 处理告警
   * @returns Promise<AlertHistoryItem[]>
   */
  public async processAlerts(): Promise<AlertHistoryItem[]> {
    return this.alertsManager.processAlerts();
  }

  /**
   * 解决告警
   * @param id - 告警ID
   * @param options - 解决选项
   * @param options.message - 解决消息
   * @returns Promise<AlertHistoryItem>
   */
  public async resolveAlert(
    id: string,
    options?: { message?: string },
  ): Promise<AlertHistoryItem> {
    return this.alertsManager.resolveAlert(id, options);
  }

  /**
   * 获取告警历史
   * @param options - 查询选项
   * @returns Promise<AlertHistoryItem[]>
   */
  public async getAlertHistory(
    options: AlertHistoryOptions,
  ): Promise<AlertHistoryItem[]> {
    return this.alertsManager.getAlertHistory(options);
  }

  /**
   * 获取仪表板数据
   * @returns Promise<DashboardData>
   */
  public async getDashboardData(): Promise<DashboardData> {
    return this.dashboardManager.getDashboardData();
  }

  /**
   * 获取系统概览
   * @returns Promise<SystemOverview>
   */
  public async getSystemOverview(): Promise<SystemOverview> {
    return this.dashboardManager.getSystemOverview();
  }

  /**
   * 获取性能统计
   * @param metricName - 指标名称
   * @param tags - 指标标签
   * @returns Promise<PerformanceStats>
   */
  public async getPerformanceStats(
    metricName: string,
    tags?: Record<string, string | number>,
  ): Promise<PerformanceStats> {
    return this.metricsManager.getPerformanceStats(metricName);
  }

  /**
   * 检测性能异常
   * @param metricName - 指标名称
   * @param options - 异常检测选项
   * @returns Promise<PerformanceAnomaly[]>
   */
  public async detectPerformanceAnomalies(
    metricName: string,
    options: AnomalyDetectionOptions,
  ): Promise<PerformanceAnomaly[]> {
    return this.metricsManager.detectPerformanceAnomalies(metricName, options);
  }

  /**
   * 评估条件
   */
  // helper logic moved to MonitoringAlerts/MonitoringMetrics/MonitoringDashboard
}
