import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { Logger } from '@logging/logger.js';
import { PersistentSyncStateMachine } from '../sync/index.js';
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
   * @returns {Promise<void>} 返回健康检查结果
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
    return this.metrics.recordMetric(metricName, value, unit, tags);
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
  ): Promise<
    Array<{
      id: string;
      metricName: string;
      metricValue: number;
      metricUnit?: string;
      tags?: Record<string, string | number>;
      timestamp: number;
      createdAt: number;
    }>
  > {
    return this.core.getMetrics(metricName, startTime, endTime, limit);
  }

  /**
   * 获取最新指标值
   * @param metricName 指标名称
   * @returns {指标对象 | null} 返回最新指标值
   */
  public async getLatestMetric(metricName: string): Promise<{
    id: string;
    metricName: string;
    metricValue: number;
    metricUnit?: string;
    tags?: Record<string, string | number>;
    timestamp: number;
    createdAt: number;
  } | null> {
    return this.core.getLatestMetric(metricName);
  }

  /**
   * 获取多个指标的最新值
   * @param metricNames 指标名称数组
   * @returns {指标对象记录} 返回多个指标的最新值
   */
  public async getLatestMetrics(metricNames: string[]): Promise<
    Record<
      string,
      {
        id: string;
        metricName: string;
        metricValue: number;
        metricUnit?: string;
        tags?: Record<string, string | number>;
        timestamp: number;
        createdAt: number;
      } | null
    >
  > {
    return this.core.getLatestMetrics(metricNames);
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
  ): Promise<{
    min: number;
    max: number;
    avg: number;
    sum: number;
    count: number;
  }> {
    return this.core.getAggregatedMetrics(
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
    return this.core.getAllMetricNames();
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
  ): Promise<{
    min: number;
    max: number;
    avg: number;
    sum: number;
    count: number;
  }> {
    return this.core.getMetricStats(metricName, startTime, endTime);
  }

  /**
   * 清理过期的监控数据
   * @param olderThanDays 天数阈值
   * @returns {void} 返回清理结果
   */
  public async cleanup(olderThanDays: number = 30): Promise<void> {
    return this.core.cleanup(olderThanDays);
  }
}
