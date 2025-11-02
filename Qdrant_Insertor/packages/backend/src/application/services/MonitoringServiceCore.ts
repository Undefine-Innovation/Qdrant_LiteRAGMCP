import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { Logger } from '@logging/logger.js';
import { PersistentSyncStateMachine } from './PersistentSyncStateMachine.js';
import { HealthStatus, SystemHealth } from '../../infrastructure/sqlite/dao/SystemHealthTable.js';

/**
 * 健康状态组件类型定义
 * 
 * 表示系统组件的健康状态信息，包含状态、检查时间和性能指标。
 * 用于监控服务中健康状态数据的类型安全处理。
 */
interface HealthComponent {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: string;
  message?: string;
  responseTime?: number;
}

/**
 * 监控服务核心类
 * 
 * 负责系统监控的核心功能，包括健康状态检查、性能指标收集和告警管理。
 * 提供系统级别的监控数据聚合和分析功能。
 * 
 * @example
 * ```typescript
 * const monitoringCore = new MonitoringServiceCore(sqliteRepo, syncStateMachine, logger);
 * const health = monitoringCore.getSystemHealth();
 * const metrics = monitoringCore.getMetricStats('cpu_usage');
 * ```
 */
export class MonitoringServiceCore {
  /**
   * 构造函数
   * 
   * @param sqliteRepo - SQLite 数据库仓储实例，用于存储监控数据
   * @param syncStateMachine - 持久化同步状态机实例，用于监控同步状态
   * @param logger - 日志记录器实例，用于记录监控日志
   */
  constructor(
    private readonly sqliteRepo: ISQLiteRepo,
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
      components: (health as { components?: Record<string, HealthComponent> }).components || {},
    };
  }

  /**
   * 获取组件健康状态
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
    return healthList.map((health: SystemHealth) => ({
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
    return healthList.map((health: SystemHealth) => ({
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
   * 获取最新指标
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
    return this.sqliteRepo.systemMetrics.getLatestByName(metricName);
  }

  /**
   * 获取多个指标的最新值
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
    return this.sqliteRepo.systemMetrics.getLatestByNames(metricNames);
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
    const now = Date.now();
    const defaultStartTime = startTime || now - 24 * 60 * 60 * 1000; // 默认24小时
    const defaultEndTime = endTime || now;

    const result = this.sqliteRepo.systemMetrics.getAggregatedMetrics(
      metricName,
      defaultStartTime,
      defaultEndTime,
      aggregationType,
    );
    
    if (result) {
      return {
        min: aggregationType === 'min' ? result.value : 0,
        max: aggregationType === 'max' ? result.value : 0,
        avg: aggregationType === 'avg' ? result.value : 0,
        sum: aggregationType === 'sum' ? result.value : 0,
        count: result.count,
      };
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
    const result = this.sqliteRepo.systemMetrics.getMetricStats(
      metricName,
      startTime,
      endTime,
    );
    
    if (result) {
      return {
        min: result.min,
        max: result.max,
        avg: result.avg,
        sum: 0, // sum 不在原始数据中，设为0或计算
        count: result.count,
      };
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
   * @param olderThanDays
   */
  public cleanup(olderThanDays: number = 30): void {
    const metricsCleaned = this.sqliteRepo.systemMetrics.cleanup(olderThanDays);
    const healthCleaned = this.sqliteRepo.systemHealth.cleanup(olderThanDays);

    this.logger.info(
      `清理监控数据完成: 指标 ${metricsCleaned} 条，健康状态${healthCleaned} 条`,
    );
  }
}