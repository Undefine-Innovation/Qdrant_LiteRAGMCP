/**
 * TypeORM仓库性能监控模块
 * 包含性能监控、指标收集和优化功能
 */

import { Logger } from '@logging/logger.js';
import { ObjectLiteral } from 'typeorm';
import { DatabasePerformanceMetrics } from '@domain/interfaces/IDatabaseRepository.js';
import {
  IRepositoryAdapter,
  AdapterEventType,
  AdapterEvent,
} from './IRepositoryAdapter.js';
import { TypeORMRepositoryCore } from './TypeORMRepositoryCore.js';

/**
 * TypeORM仓库性能监控模块
 * 包含性能监控、指标收集和优化功能
 * @template T 实体类型
 */
export abstract class TypeORMRepositoryPerformance<T extends ObjectLiteral> {
  protected queryCount = 0;
  protected totalQueryTime = 0;
  protected slowQueryCount = 0;
  protected connectionStartTime = Date.now();
  protected lastHealthCheck = Date.now();
  protected adapterConfig: Record<string, unknown>;
  protected databaseType: string;
  protected entityClass: { new (...args: unknown[]): unknown; name?: string } | { name?: string };
  protected dataSource: unknown;
  protected logger: Logger;

  constructor(
    entityClass: { new (...args: unknown[]): unknown; name?: string } | { name?: string },
    dataSource: unknown,
    config: { type: string },
    logger: Logger,
    adapterConfig: Record<string, unknown>,
  ) {
    this.entityClass = entityClass;
    this.dataSource = dataSource;
    this.adapterConfig = adapterConfig;
    this.databaseType = config.type;
    this.logger = logger;
  }

  protected async getPerformanceMetrics(): Promise<DatabasePerformanceMetrics> {
    return {
      queryCount: this.queryCount,
      totalQueryTime: this.totalQueryTime,
      slowQueryCount: this.slowQueryCount,
    } as DatabasePerformanceMetrics;
  }

  protected async ping(): Promise<boolean> {
    try {
      // 简单的ping实现
      return true;
    } catch {
      return false;
    }
  }

  protected getEntityName(): string {
    return this.entityClass?.name || 'Unknown';
  }

  protected emitEvent(event: AdapterEvent): void {
    // 简单的事件发射实现
    this.logger.debug('Event emitted', event);
  }
  /**
   * 获取详细的性能指标
   * @returns 详细性能指标
   */
  async getDetailedPerformanceMetrics(): Promise<{
    basic: DatabasePerformanceMetrics;
    queries: {
      total: number;
      averageTime: number;
      slowQueries: number;
      slowQueryThreshold: number;
    };
    connection: {
      uptime: number;
      lastHealthCheck: number;
      status: 'healthy' | 'degraded' | 'unhealthy';
    };
    cache: {
      enabled: boolean;
      expiration: number;
      hitRate?: number;
    };
  }> {
    const basicMetrics = await this.getPerformanceMetrics();

    return {
      basic: basicMetrics,
      queries: {
        total: this.queryCount,
        averageTime:
          this.queryCount > 0 ? this.totalQueryTime / this.queryCount : 0,
        slowQueries: this.slowQueryCount,
        slowQueryThreshold: this.adapterConfig.slowQueryThreshold || 1000,
      },
      connection: {
        uptime:
          this.connectionStartTime > 0
            ? Date.now() - this.connectionStartTime
            : 0,
        lastHealthCheck: this.lastHealthCheck,
        status: await this.getConnectionHealthStatus(),
      },
      cache: {
        enabled: this.adapterConfig.enableQueryCache || false,
        expiration: this.adapterConfig.cacheExpiration || 300000,
        hitRate: await this.getCacheHitRate(),
      },
    };
  }

  /**
   * 获取查询性能统计
   * @returns 查询性能统计
   */
  getQueryPerformanceStats(): {
    totalQueries: number;
    totalQueryTime: number;
    averageQueryTime: number;
    slowQueryCount: number;
    slowQueryRate: number;
    queriesPerSecond: number;
  } {
    const now = Date.now();
    const uptime =
      this.connectionStartTime > 0 ? now - this.connectionStartTime : 1;
    const queriesPerSecond = uptime > 0 ? (this.queryCount / uptime) * 1000 : 0;
    const slowQueryRate =
      this.queryCount > 0 ? (this.slowQueryCount / this.queryCount) * 100 : 0;

    return {
      totalQueries: this.queryCount,
      totalQueryTime: this.totalQueryTime,
      averageQueryTime:
        this.queryCount > 0 ? this.totalQueryTime / this.queryCount : 0,
      slowQueryCount: this.slowQueryCount,
      slowQueryRate,
      queriesPerSecond,
    };
  }

  /**
   * 获取性能报告
   * @param timeRangeMs 时间范围（毫秒）
   * @returns 性能报告
   */
  async getPerformanceReport(timeRangeMs: number = 3600000): Promise<{
    timeRange: {
      start: number;
      end: number;
      duration: number;
    };
    summary: {
      totalQueries: number;
      averageQueryTime: number;
      slowQueries: number;
      errorRate: number;
    };
    recommendations: string[];
  }> {
    const now = Date.now();
    const start = now - timeRangeMs;

    const queryStats = this.getQueryPerformanceStats();
    const healthStatus = await this.getConnectionHealthStatus();

    const recommendations = this.generatePerformanceRecommendations(
      queryStats,
      healthStatus,
    );

    return {
      timeRange: {
        start,
        end: now,
        duration: timeRangeMs,
      },
      summary: {
        totalQueries: queryStats.totalQueries,
        averageQueryTime: queryStats.averageQueryTime,
        slowQueries: queryStats.slowQueryCount,
        errorRate: await this.getErrorRate(timeRangeMs),
      },
      recommendations,
    };
  }

  /**
   * 重置性能统计
   */
  resetPerformanceStats(): void {
    this.queryCount = 0;
    this.totalQueryTime = 0;
    this.slowQueryCount = 0;
    this.connectionStartTime = Date.now();
    this.lastHealthCheck = Date.now();

    this.emitEvent({
      type: 'PERFORMANCE_STATS_RESET',
      timestamp: new Date(),
      entityType: this.getEntityName(),
      databaseType: this.databaseType,
      data: { resetTime: Date.now() },
    });
  }

  /**
   * 启用性能监控
   */
  enablePerformanceMonitoring(): void {
    this.adapterConfig.enablePerformanceMonitoring = true;
    this.logger.info('性能监控已启用', {
      entityType: this.getEntityName(),
    });
  }

  /**
   * 禁用性能监控
   */
  disablePerformanceMonitoring(): void {
    this.adapterConfig.enablePerformanceMonitoring = false;
    this.logger.info('性能监控已禁用', {
      entityType: this.getEntityName(),
    });
  }

  /**
   * 更新性能配置
   * @param config 性能配置
   * @param {number} [config.slowQueryThreshold] 慢查询阈值
   * @param {boolean} [config.enableQueryCache] 是否启用查询缓存
   * @param {number} [config.cacheExpiration] 缓存过期时间
   */
  updatePerformanceConfig(config: {
    slowQueryThreshold?: number;
    enableQueryCache?: boolean;
    cacheExpiration?: number;
  }): void {
    if (config.slowQueryThreshold !== undefined) {
      this.adapterConfig.slowQueryThreshold = config.slowQueryThreshold;
    }
    if (config.enableQueryCache !== undefined) {
      this.adapterConfig.enableQueryCache = config.enableQueryCache;
    }
    if (config.cacheExpiration !== undefined) {
      this.adapterConfig.cacheExpiration = config.cacheExpiration;
    }

    this.logger.info('性能配置已更新', {
      entityType: this.getEntityName(),
      config,
    });
  }

  /**
   * 获取连接健康状态
   * @returns 连接健康状态
   */
  private async getConnectionHealthStatus(): Promise<
    'healthy' | 'degraded' | 'unhealthy'
  > {
    try {
      const isHealthy = await this.ping();
      if (!isHealthy) {
        return 'unhealthy';
      }

      const avgQueryTime =
        this.queryCount > 0 ? this.totalQueryTime / this.queryCount : 0;
      const slowQueryRate =
        this.queryCount > 0 ? (this.slowQueryCount / this.queryCount) * 100 : 0;
      const slowQueryThreshold = this.adapterConfig.slowQueryThreshold || 1000;

      if (avgQueryTime > slowQueryThreshold * 0.8 || slowQueryRate > 10) {
        return 'degraded';
      }

      return 'healthy';
    } catch (error) {
      this.logger.warn('获取连接健康状态失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      return 'unhealthy';
    }
  }

  /**
   * 获取缓存命中率
   * @returns 缓存命中率
   */
  private async getCacheHitRate(): Promise<number> {
    // 这里可以实现具体的缓存命中率计算逻辑
    // 目前返回默认值
    return 0;
  }

  /**
   * 获取错误率
   * @param timeRangeMs 时间范围（毫秒）
   * @returns 错误率
   */
  private async getErrorRate(timeRangeMs: number): Promise<number> {
    // 这里可以实现具体的错误率计算逻辑
    // 目前返回默认值
    return 0;
  }

  /**
   * 生成性能建议
   * @param queryStats 查询统计
   * @param queryStats.averageQueryTime
   * @param queryStats.slowQueryRate
   * @param queryStats.queriesPerSecond
   * @param healthStatus 健康状态
   * @returns 性能建议列表
   */
  private generatePerformanceRecommendations(
    queryStats: {
      averageQueryTime: number;
      slowQueryRate: number;
      queriesPerSecond: number;
    },
    healthStatus: 'healthy' | 'degraded' | 'unhealthy',
  ): string[] {
    const recommendations: string[] = [];

    // 基于查询时间的建议
    if (queryStats.averageQueryTime > 1000) {
      recommendations.push('平均查询时间较长，建议优化查询或添加索引');
    }

    // 基于慢查询的建议
    if (queryStats.slowQueryRate > 5) {
      recommendations.push('慢查询比例较高，建议检查查询性能');
    }

    // 基于查询频率的建议
    if (queryStats.queriesPerSecond > 100) {
      recommendations.push('查询频率较高，建议考虑使用缓存');
    }

    // 基于健康状态的建议
    if (healthStatus === 'unhealthy') {
      recommendations.push('数据库连接状态不健康，建议检查连接配置');
    } else if (healthStatus === 'degraded') {
      recommendations.push('数据库连接状态降级，建议监控性能指标');
    }

    // 基于配置的建议
    if (!(this.adapterConfig?.['enableQueryCache'] as boolean)) {
      recommendations.push('建议启用查询缓存以提高性能');
    }

    return recommendations;
  }

  /**
   * 记录性能事件
   * @param eventType 事件类型
   * @param data 事件数据
   */
  protected recordPerformanceEvent(
    eventType: AdapterEventType,
    data: Record<string, unknown>,
  ): void {
    this.emitEvent({
      type: eventType,
      timestamp: new Date(),
      entityType: this.getEntityName(),
      databaseType: this.databaseType,
      data,
    });
  }
}
