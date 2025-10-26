import { SQLiteRepo } from '../infrastructure/SQLiteRepo.js';
import { Logger } from '../logger.js';
import { PersistentSyncStateMachine } from './PersistentSyncStateMachine.js';
import { MonitoringServiceCore } from './MonitoringServiceCore.js';
import { HealthCheckService } from './HealthCheckService.js';
import { MetricsService } from './MetricsService.js';

/**
 * 监控服务
 * 负责收集系统指标、健康检查和告警管理
 */
export class MonitoringService {
  private readonly core: MonitoringServiceCore;
  private readonly healthCheck: HealthCheckService;
  private readonly metrics: MetricsService;

  constructor(
    private readonly sqliteRepo: SQLiteRepo,
    private readonly syncStateMachine: PersistentSyncStateMachine,
    private readonly logger: Logger,
  ) {
    this.core = new MonitoringServiceCore(sqliteRepo, syncStateMachine, logger);
    this.healthCheck = new HealthCheckService(
      sqliteRepo,
      syncStateMachine,
      logger,
    );
    this.metrics = new MetricsService(sqliteRepo, logger);
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
   */
  public async performHealthCheck(): Promise<void> {
    return this.healthCheck.performHealthCheck();
  }

  /**
   * 记录系统指标
   */
  public recordMetric(
    metricName: string,
    value: number,
    unit?: string,
    tags?: Record<string, string | number>,
  ): void {
    return this.metrics.recordMetric(metricName, value, unit, tags);
  }

  /**
   * 获取系统整体健康状态
   */
  public getSystemHealth() {
    return this.core.getSystemHealth();
  }

  /**
   * 获取组件健康状态
   */
  public getComponentHealth(component: string) {
    return this.core.getComponentHealth(component);
  }

  /**
   * 获取所有组件健康状态
   */
  public getAllComponentHealth() {
    return this.core.getAllComponentHealth();
  }

  /**
   * 获取不健康的组件
   */
  public getUnhealthyComponents() {
    return this.core.getUnhealthyComponents();
  }

  /**
   * 获取指标数据
   */
  public getMetrics(
    metricName: string,
    startTime?: number,
    endTime?: number,
    limit?: number,
  ) {
    return this.core.getMetrics(metricName, startTime, endTime, limit);
  }

  /**
   * 获取最新指标值
   */
  public getLatestMetric(metricName: string) {
    return this.core.getLatestMetric(metricName);
  }

  /**
   * 获取多个指标的最新值
   */
  public getLatestMetrics(metricNames: string[]) {
    return this.core.getLatestMetrics(metricNames);
  }

  /**
   * 获取指标聚合数据
   */
  public getAggregatedMetrics(
    metricName: string,
    startTime?: number,
    endTime?: number,
    aggregationType: 'avg' | 'min' | 'max' | 'sum' = 'avg',
  ) {
    return this.core.getAggregatedMetrics(
      metricName,
      startTime,
      endTime,
      aggregationType,
    );
  }

  /**
   * 获取所有指标名称
   */
  public getAllMetricNames() {
    return this.core.getAllMetricNames();
  }

  /**
   * 获取指标统计信息
   */
  public getMetricStats(
    metricName: string,
    startTime?: number,
    endTime?: number,
  ) {
    return this.core.getMetricStats(metricName, startTime, endTime);
  }

  /**
   * 清理过期的监控数据
   */
  public cleanup(olderThanDays: number = 30): void {
    return this.core.cleanup(olderThanDays);
  }
}
