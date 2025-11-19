import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { Logger } from '@logging/logger.js';
import { PersistentSyncStateMachine } from '../sync/index.js';

/**
 * 健康状态组件类型定义
 *
 * 表示系统组件的健康状态信息，包含状态、检查时间和性能指标。
 * 用于监控服务中健康状态数据的类型安全处理。
 */
type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

interface HealthComponent {
  status: HealthStatus;
  lastCheck: string;
  message?: string;
  responseTime?: number;
}

interface SystemHealthRecord {
  component: string;
  status: HealthStatus;
  lastCheck: number;
  responseTimeMs?: number | null;
  errorMessage?: string | null;
  details?: string | Record<string, unknown> | null;
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
   * @returns {系统健康状态对象} 返回系统整体健康状态
   */
  public async getSystemHealth(): Promise<{
    status: HealthStatus;
    lastCheck: number;
    components: Record<
      string,
      {
        status: HealthStatus;
        lastCheck: string;
        message?: string;
        responseTime?: number;
      }
    >;
  }> {
    try {
      const health = await this.sqliteRepo.systemHealth.getOverallHealth();
      return {
        status: health?.status || 'unhealthy',
        lastCheck: Date.now(),
        components:
          (health as { components?: Record<string, HealthComponent> })
            .components || {},
      };
    } catch (error) {
      this.logger.warn('获取系统健康状态失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        status: 'unhealthy',
        lastCheck: Date.now(),
        components: {},
      };
    }
  }

  /**
   * 获取组件健康状态
   * @param component 组件名称
   * @returns {组件健康状态对象 | null} 返回组件健康状态
   */
  public async getComponentHealth(component: string): Promise<{
    component: string;
    status: HealthStatus;
    lastCheck: number;
    responseTimeMs?: number;
    errorMessage?: string;
    details?: Record<string, string | number | boolean>;
  } | null> {
    try {
      const health = (await this.sqliteRepo.systemHealth.getByComponent(
        component,
      )) as SystemHealthRecord | null;
      if (!health) return null;

      return {
        component: health.component,
        status: health.status,
        lastCheck: health.lastCheck,
        responseTimeMs: health.responseTimeMs ?? undefined,
        errorMessage: health.errorMessage ?? undefined,
        details: this.parseDetails(health.details),
      };
    } catch (error) {
      this.logger.warn('获取组件健康状态失败', {
        error: error instanceof Error ? error.message : String(error),
        component,
      });
      return null;
    }
  }

  /**
   * 获取所有组件健康状态
   * @returns {组件健康状态对象数组} 返回所有组件健康状态
   */
  public async getAllComponentHealth(): Promise<
    Array<{
      component: string;
      status: HealthStatus;
      lastCheck: number;
      responseTimeMs?: number;
      errorMessage?: string;
      details?: Record<string, string | number | boolean>;
    }>
  > {
    try {
      const healthList = (await this.sqliteRepo.systemHealth.getAll()) as
        | SystemHealthRecord[]
        | null;
      if (!healthList) {
        return [];
      }
      return healthList.map((health) => {
        return {
          component: health.component,
          status: health.status,
          lastCheck: health.lastCheck,
          responseTimeMs: health.responseTimeMs ?? undefined,
          errorMessage: health.errorMessage ?? undefined,
          details: this.parseDetails(health.details),
        };
      });
    } catch (error) {
      this.logger.warn('获取所有组件健康状态失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * 获取不健康的组件
   * @returns {组件健康状态对象数组} 返回不健康的组件列表
   */
  public async getUnhealthyComponents(): Promise<
    Array<{
      component: string;
      status: HealthStatus;
      lastCheck: number;
      responseTimeMs?: number;
      errorMessage?: string;
      details?: Record<string, string | number | boolean>;
    }>
  > {
    try {
      const healthList =
        ((await this.sqliteRepo.systemHealth.getUnhealthyComponents()) as
          | SystemHealthRecord[]
          | null) ?? [];
      return healthList.map((health) => {
        return {
          component: health.component,
          status: health.status,
          lastCheck: health.lastCheck,
          responseTimeMs: health.responseTimeMs ?? undefined,
          errorMessage: health.errorMessage ?? undefined,
          details: this.parseDetails(health.details),
        };
      });
    } catch (error) {
      this.logger.warn('获取不健康的组件失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private parseDetails(
    details: string | Record<string, unknown> | null | undefined,
  ): Record<string, string | number | boolean> | undefined {
    if (!details) {
      return undefined;
    }

    if (typeof details === 'string') {
      try {
        return JSON.parse(details) as Record<string, string | number | boolean>;
      } catch {
        return undefined;
      }
    }

    return details as Record<string, string | number | boolean>;
  }

  /**
   * 获取指标数据
   * @param metricName 指标名称
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @param limit 限制数量
   * @returns {指标数据数组} 返回指标数据
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
    try {
      const now = Date.now();
      const defaultStartTime = startTime || now - 24 * 60 * 60 * 1000; // 默认24小时
      const defaultEndTime = endTime || now;

      return this.sqliteRepo.systemMetrics.getByNameAndTimeRange(
        metricName,
        defaultStartTime,
        defaultEndTime,
        limit,
      ) as Array<{
        id: string;
        metricName: string;
        metricValue: number;
        metricUnit?: string;
        tags?: Record<string, string | number>;
        timestamp: number;
        createdAt: number;
      }>;
    } catch (error) {
      this.logger.warn('获取指标数据失败', {
        metricName,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * 获取最新指标
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
    try {
      const result =
        await this.sqliteRepo.systemMetrics.getLatestByName(metricName);
      if (!result) return null;
      const r = result as unknown as Record<string, unknown>;
      return {
        id: r.id as string,
        metricName: r.metric_name as string,
        metricValue: r.metric_value as number,
        metricUnit: r.metric_unit as string | undefined,
        tags: r.tags
          ? (JSON.parse(r.tags as string) as Record<string, string | number>)
          : undefined,
        timestamp: r.timestamp as number,
        createdAt: r.created_at as number,
      };
    } catch (error) {
      this.logger.warn('获取最新指标失败', {
        metricName,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
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
    try {
      const resultRecord =
        await this.sqliteRepo.systemMetrics.getLatestByNames(metricNames);
      /** 处理后的指标结果 */
      const result: Record<
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
      > = {};

      for (const [key, value] of Object.entries(resultRecord)) {
        if (!value) {
          result[key] = null;
        } else {
          const r = value as unknown as Record<string, unknown>;
          result[key] = {
            id: r.id as string,
            metricName: r.metric_name as string,
            metricValue: r.metric_value as number,
            metricUnit: r.metric_unit as string | undefined,
            tags: r.tags
              ? (JSON.parse(r.tags as string) as Record<
                  string,
                  string | number
                >)
              : undefined,
            timestamp: r.timestamp as number,
            createdAt: r.created_at as number,
          };
        }
      }

      return result;
    } catch (error) {
      this.logger.warn('获取多个指标失败', {
        metricCount: metricNames.length,
        error: error instanceof Error ? error.message : String(error),
      });
      return {};
    }
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
    const now = Date.now();
    const defaultStartTime = startTime || now - 24 * 60 * 60 * 1000; // 默认24小时
    const defaultEndTime = endTime || now;

    const result = await this.sqliteRepo.systemMetrics.getAggregatedMetrics(
      metricName,
      defaultStartTime,
      defaultEndTime,
    );

    if (result) {
      const r = result as unknown as Record<string, unknown>;
      return {
        min: r.min as number,
        max: r.max as number,
        avg: aggregationType === 'avg' ? (r.avg as number) : 0,
        sum: aggregationType === 'sum' ? (r.sum as number) : 0,
        count: r.count as number,
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
   * @returns {string[]} 返回所有指标名称
   */
  public async getAllMetricNames(): Promise<string[]> {
    return this.sqliteRepo.systemMetrics.getAllMetricNames();
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
    const result = await this.sqliteRepo.systemMetrics.getMetricStats(
      metricName,
      startTime || Date.now() - 24 * 60 * 60 * 1000,
      endTime || Date.now(),
    );

    if (result) {
      const r = result as unknown as Record<string, unknown>;
      return {
        min: r.min as number,
        max: r.max as number,
        avg: r.avg as number,
        sum: r.sum as number,
        count: r.count as number,
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
   * @param olderThanDays 天数阈值
   * @returns {void} 返回清理结果
   */
  public async cleanup(olderThanDays: number = 30): Promise<void> {
    const metricsCleaned =
      await this.sqliteRepo.systemMetrics.cleanup(olderThanDays);
    const healthCleaned =
      await this.sqliteRepo.systemHealth.cleanup(olderThanDays);

    this.logger.info(
      `清理监控数据完成: 指标 ${metricsCleaned} 条，健康状态${healthCleaned} 条`,
    );
  }
}
