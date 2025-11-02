import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { Logger } from '@logging/logger.js';
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

  /**
   *
   * @param sqliteRepo
   * @param syncStateMachine
   * @param logger
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
  }

  /**
   * 停止监控服务
   */
  public stop(): void {
    this.healthCheck.stop();
    this.metrics.stop();
  }

  /**
   * 执行系统健康检�?
   */
  public async performHealthCheck(): Promise<void> {
    return this.healthCheck.performHealthCheck();
  }

  /**
   * 记录系统指标
   * @param metricName
   * @param value
   * @param unit
   * @param tags
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
   * 获取系统整体健康状�?
   */
  public getSystemHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck: number;
    components: Record<string, {
      status: 'healthy' | 'degraded' | 'unhealthy';
      lastCheck: string;
      message?: string;
      responseTime?: number;
    }>;
  } {
    return this.core.getSystemHealth();
  }

  /**
   * 获取组件健康状�?
   * @param component
   */
  public getComponentHealth(component: string): {
    component: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck: number;
    responseTimeMs?: number;
    errorMessage?: string;
    details?: Record<string, string | number | boolean>;
  } | null {
    return this.core.getComponentHealth(component);
  }

  /**
   * 获取所有组件健康状�?
   */
  public getAllComponentHealth(): Array<{
    component: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck: number;
    responseTimeMs?: number;
    errorMessage?: string;
    details?: Record<string, string | number | boolean>;
  }> {
    return this.core.getAllComponentHealth();
  }

  /**
   * 获取不健康的组件
   */
  public getUnhealthyComponents(): Array<{
    component: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck: number;
    responseTimeMs?: number;
    errorMessage?: string;
    details?: Record<string, string | number | boolean>;
  }> {
    return this.core.getUnhealthyComponents();
  }

  /**
   * 获取指标数据
   * @param metricName
   * @param startTime
   * @param endTime
   * @param limit
   */
  public getMetrics(
    metricName: string,
    startTime?: number,
    endTime?: number,
    limit?: number,
  ): Array<{
    id: string;
    metricName: string;
    metricValue: number;
    metricUnit?: string;
    tags?: Record<string, string | number>;
    timestamp: number;
    createdAt: number;
  }> {
    return this.core.getMetrics(metricName, startTime, endTime, limit);
  }

  /**
   * 获取最新指标�?
   * @param metricName
   */
  public getLatestMetric(metricName: string): {
    id: string;
    metricName: string;
    metricValue: number;
    metricUnit?: string;
    tags?: Record<string, string | number>;
    timestamp: number;
    createdAt: number;
  } | null {
    return this.core.getLatestMetric(metricName);
  }

  /**
   * 获取多个指标的最新�?
   * @param metricNames
   */
  public getLatestMetrics(metricNames: string[]): Record<string, {
    id: string;
    metricName: string;
    metricValue: number;
    metricUnit?: string;
    tags?: Record<string, string | number>;
    timestamp: number;
    createdAt: number;
  } | null> {
    return this.core.getLatestMetrics(metricNames);
  }

  /**
   * 获取指标聚合数据
   * @param metricName
   * @param startTime
   * @param endTime
   * @param aggregationType
   */
  public getAggregatedMetrics(
    metricName: string,
    startTime?: number,
    endTime?: number,
    aggregationType: 'avg' | 'min' | 'max' | 'sum' = 'avg',
  ): {
    min: number;
    max: number;
    avg: number;
    sum: number;
    count: number;
  } {
    return this.core.getAggregatedMetrics(
      metricName,
      startTime,
      endTime,
      aggregationType,
    );
  }

  /**
   * 获取所有指标名�?
   */
  public getAllMetricNames(): string[] {
    return this.core.getAllMetricNames();
  }

  /**
   * 获取指标统计信息
   * @param metricName
   * @param startTime
   * @param endTime
   */
  public getMetricStats(
    metricName: string,
    startTime?: number,
    endTime?: number,
  ): {
    min: number;
    max: number;
    avg: number;
    sum: number;
    count: number;
  } {
    return this.core.getMetricStats(metricName, startTime, endTime);
  }

  /**
   * 清理过期的监控数�?
   * @param olderThanDays
   */
  public cleanup(olderThanDays: number = 30): void {
    return this.core.cleanup(olderThanDays);
  }
}
