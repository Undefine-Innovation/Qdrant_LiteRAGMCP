import { SQLiteRepo } from '../infrastructure/SQLiteRepo.js';
import { Logger } from '../logger.js';
import { PersistentSyncStateMachine } from './PersistentSyncStateMachine.js';

/**
 * 监控服务核心
 * 负责监控系统的核心功能
 */
export class MonitoringServiceCore {
  constructor(
    private readonly sqliteRepo: SQLiteRepo,
    private readonly syncStateMachine: PersistentSyncStateMachine,
    private readonly logger: Logger,
  ) {}

  /**
   * 获取系统整体健康状态
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
    const health = this.sqliteRepo.systemHealth.getOverallHealth();
    return {
      status: health.status,
      lastCheck: Date.now(),
      components: (health as any).components || {},
    };
  }

  /**
   * 获取组件健康状态
   */
  public getComponentHealth(component: string): {
    component: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck: number;
    responseTimeMs?: number;
    errorMessage?: string;
    details?: Record<string, string | number | boolean>;
  } | null {
    const health = this.sqliteRepo.systemHealth.getByComponent(component);
    if (!health) return null;
    
    return {
      component: health.component,
      status: health.status,
      lastCheck: health.lastCheck,
      responseTimeMs: health.responseTimeMs,
      errorMessage: health.errorMessage,
      details: health.details as Record<string, string | number | boolean>,
    };
  }

  /**
   * 获取所有组件健康状态
   */
  public getAllComponentHealth(): Array<{
    component: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck: number;
    responseTimeMs?: number;
    errorMessage?: string;
    details?: Record<string, string | number | boolean>;
  }> {
    const healthList = this.sqliteRepo.systemHealth.getAll();
    return healthList.map(health => ({
      component: health.component,
      status: health.status,
      lastCheck: health.lastCheck,
      responseTimeMs: health.responseTimeMs,
      errorMessage: health.errorMessage,
      details: health.details as Record<string, string | number | boolean>,
    }));
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
    const healthList = this.sqliteRepo.systemHealth.getUnhealthyComponents();
    return healthList.map(health => ({
      component: health.component,
      status: health.status,
      lastCheck: health.lastCheck,
      responseTimeMs: health.responseTimeMs,
      errorMessage: health.errorMessage,
      details: health.details as Record<string, string | number | boolean>,
    }));
  }

  /**
   * 获取指标数据
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
    const now = Date.now();
    const defaultStartTime = startTime || now - 24 * 60 * 60 * 1000; // 默认24小时
    const defaultEndTime = endTime || now;

    return this.sqliteRepo.systemMetrics.getByNameAndTimeRange(
      metricName,
      defaultStartTime,
      defaultEndTime,
      limit,
    );
  }

  /**
   * 获取最新指标值
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
    return this.sqliteRepo.systemMetrics.getLatestByName(metricName);
  }

  /**
   * 获取多个指标的最新值
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
    return this.sqliteRepo.systemMetrics.getLatestByNames(metricNames);
  }

  /**
   * 获取指标聚合数据
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
    const now = Date.now();
    const defaultStartTime = startTime || now - 24 * 60 * 60 * 1000; // 默认24小时
    const defaultEndTime = endTime || now;

    const result = this.sqliteRepo.systemMetrics.getAggregatedMetrics(
      metricName,
      defaultStartTime,
      defaultEndTime,
      aggregationType,
    );
    
    if (result && 'min' in result) {
      return result as unknown as { min: number; max: number; avg: number; sum: number; count: number; };
    }
    
    return {
      min: 0,
      max: 0,
      avg: 0,
      sum: 0,
      count: 0,
    };
  }

  /**
   * 获取所有指标名称
   */
  public getAllMetricNames(): string[] {
    return this.sqliteRepo.systemMetrics.getAllMetricNames();
  }

  /**
   * 获取指标统计信息
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
    const result = this.sqliteRepo.systemMetrics.getMetricStats(
      metricName,
      startTime,
      endTime,
    );
    
    if (result && 'min' in result) {
      return result as unknown as { min: number; max: number; avg: number; sum: number; count: number; };
    }
    
    return {
      min: 0,
      max: 0,
      avg: 0,
      sum: 0,
      count: 0,
    };
  }

  /**
   * 清理过期的监控数据
   */
  public cleanup(olderThanDays: number = 30): void {
    const metricsCleaned = this.sqliteRepo.systemMetrics.cleanup(olderThanDays);
    const healthCleaned = this.sqliteRepo.systemHealth.cleanup(olderThanDays);

    this.logger.info(
      `清理监控数据完成: 指标 ${metricsCleaned} 条, 健康状态 ${healthCleaned} 条`,
    );
  }
}
