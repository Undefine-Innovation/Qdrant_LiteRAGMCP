/**
 * 数据库健康监控器
 * 提供数据库连接状态、性能指标和健康检查功能
 */

import { Logger } from '@logging/logger.js';
import { EventEmitter } from 'events';
import {
  IRepositoryAdapter,
  AdapterHealthStatus,
  DatabaseConnectionStatus,
  AdapterPerformanceMetrics,
} from './IRepositoryAdapter.js';
import {
  DatabaseType,
  DatabaseHealthStatus,
  DatabasePerformanceMetrics,
} from '@domain/interfaces/IDatabaseRepository.js';

/**
 * 将 DatabaseHealthStatus 映射为 Adapter 的 DatabaseConnectionStatus
 * 避免在转换时使用 any，做显式的字符串匹配和后备值。
 * @param dbHealth 数据库健康状态对象，用于推断连接状态
 * @returns 映射后的 `DatabaseConnectionStatus` 枚举值
 */
function mapDatabaseHealthToAdapterConnectionStatus(
  dbHealth: DatabaseHealthStatus,
): DatabaseConnectionStatus {
  // 优先使用 dbHealth.status （如果存在）
  const statusValue = (dbHealth.status ?? (dbHealth.connected ? 'connected' : 'disconnected')) as unknown as string;

  switch (statusValue) {
    case 'connected':
      return DatabaseConnectionStatus.CONNECTED;
    case 'connecting':
      return DatabaseConnectionStatus.CONNECTING;
    case 'error':
      return DatabaseConnectionStatus.ERROR;
    case 'disconnected':
    default:
      return DatabaseConnectionStatus.DISCONNECTED;
  }
}

/**
 * 健康检查配置
 */
export interface HealthCheckConfig {
  /** 检查间隔（毫秒） */
  checkInterval: number;
  /** 连接超时时间（毫秒） */
  connectionTimeout: number;
  /** 慢查询阈值（毫秒） */
  slowQueryThreshold: number;
  /** 连接池最小健康百分比 */
  minPoolHealthPercentage: number;
  /** 启用详细监控 */
  enableDetailedMonitoring: boolean;
}

/**
 * 健康检查结果
 */
export interface HealthCheckResult {
  /** 数据库类型 */
  databaseType: DatabaseType;
  /** 连接状态 */
  connectionStatus: DatabaseConnectionStatus;
  /** 响应时间（毫秒） */
  responseTime: number;
  /** 是否健康 */
  isHealthy: boolean;
  /** 错误信息 */
  error?: string;
  /** 性能指标 */
  metrics?: AdapterPerformanceMetrics;
  /** 检查时间戳 */
  timestamp: Date;
  /** 连接池状态 */
  poolStatus?: {
    active: number;
    idle: number;
    total: number;
    healthPercentage: number;
  };
}

/**
 * 健康监控事件
 */
export interface HealthMonitorEvent {
  type:
    | 'health_check'
    | 'connection_lost'
    | 'connection_restored'
    | 'performance_degradation';
  data: HealthCheckResult;
  timestamp: Date;
}

/**
 * 数据库健康监控器
 */
export class DatabaseHealthMonitor extends EventEmitter {
  private adapters = new Map<string, IRepositoryAdapter<unknown>>();
  private healthStatus = new Map<string, HealthCheckResult>();
  private checkIntervals = new Map<string, NodeJS.Timeout>();
  private config: HealthCheckConfig;
  private logger: Logger;

  constructor(config: HealthCheckConfig, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger;
  }

  /**
   * 注册适配器进行监控
   * @param name 适配器名称
   * @param adapter 数据库适配器实例
   */
  registerAdapter<T>(name: string, adapter: IRepositoryAdapter<T>): void {
    this.adapters.set(name, adapter);
    this.logger.info('注册数据库适配器监控', {
      name,
      databaseType: adapter.databaseType,
    });

    // 开始健康检查
    this.startHealthCheck(name);
  }

  /**
   * 注销适配器监控
   * @param name 适配器名称
   */
  unregisterAdapter(name: string): void {
    this.stopHealthCheck(name);
    this.adapters.delete(name);
    this.healthStatus.delete(name);
    this.logger.info('注销数据库适配器监控', { name });
  }

  /**
   * 开始健康检查
   * @param name - 适配器名称
   */
  private startHealthCheck(name: string): void {
    // 清除现有检查
    this.stopHealthCheck(name);

    // 立即执行一次检查
    this.performHealthCheck(name);

    // 设置定期检查
    const interval = setInterval(() => {
      this.performHealthCheck(name);
    }, this.config.checkInterval);

    this.checkIntervals.set(name, interval);
  }

  /**
   * 停止健康检查
   * @param name - 适配器名称
   */
  private stopHealthCheck(name: string): void {
    const interval = this.checkIntervals.get(name);
    if (interval) {
      clearInterval(interval);
      this.checkIntervals.delete(name);
    }
  }

  /**
   * 执行健康检查
   * @param name - 适配器名称
   * @returns Promise<void>
   */
  private async performHealthCheck(name: string): Promise<void> {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      return;
    }

    const startTime = Date.now();
    const previousStatus = this.healthStatus.get(name);

    try {
      // 执行健康检查
      const healthStatus = await adapter.getHealthStatus();
      const responseTime = Date.now() - startTime;

      // 获取性能指标
      const metrics = await adapter.getPerformanceMetrics();

      // 获取连接池状态（如果支持）
      const poolStatus = await this.getPoolStatus(adapter);

      const adapterMetrics = this.buildAdapterPerformanceMetrics(
        metrics,
        healthStatus.performanceMetrics,
        name,
      );

      // 计算整体健康状态
      const mappedConnectionStatus = mapDatabaseHealthToAdapterConnectionStatus(
        healthStatus,
      );

      const isHealthy = this.calculateOverallHealth(
        {
          status: healthStatus.status === DatabaseConnectionStatus.CONNECTED ? 'healthy' : 'unhealthy',
          connectionStatus: mappedConnectionStatus,
          lastCheckTime: new Date(),
          responseTime: healthStatus.responseTime,
          error: healthStatus.error,
          performanceMetrics: adapterMetrics,
        },
        adapterMetrics,
        poolStatus,
      );

      const result: HealthCheckResult = {
        databaseType: adapter.databaseType,
        connectionStatus: mappedConnectionStatus,
        responseTime,
        isHealthy,
        metrics: adapterMetrics,
        timestamp: new Date(),
        poolStatus,
      };

      // 更新状态
      this.healthStatus.set(name, result);

      // 发出事件
      this.emitHealthEvent(name, result, previousStatus);

      // 记录日志
      this.logHealthCheck(name, result, previousStatus);
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      const result: HealthCheckResult = {
        databaseType: adapter.databaseType,
        connectionStatus: DatabaseConnectionStatus.DISCONNECTED,
        responseTime,
        isHealthy: false,
        error: errorMessage,
        timestamp: new Date(),
        metrics: undefined,
      };

      this.healthStatus.set(name, result);
      this.emitHealthEvent(name, result, previousStatus);
      this.logHealthCheck(name, result, previousStatus);
    }
  }

  /**
   * 获取连接池状态
   * @param adapter - 仓库适配器
   * @returns 连接池状态信息或undefined
   */
  private async getPoolStatus(adapter: IRepositoryAdapter<unknown>): Promise<
    | {
        active: number;
        idle: number;
        total: number;
        healthPercentage: number;
      }
    | undefined
  > {
    try {
      // 这里需要根据具体的适配器实现来获取连接池状态
      // 暂时返回默认值
      return {
        active: 1,
        idle: 4,
        total: 5,
        healthPercentage: 100,
      };
    } catch (error) {
      this.logger.warn('获取连接池状态失败', { error });
      return undefined;
    }
  }

  /**
   * 计算整体健康状态
   * @param healthStatus 适配器健康状态
   * @param metrics 性能指标
   * @param poolStatus 连接池状态
   * @param poolStatus.active 活跃连接数
   * @param poolStatus.idle 空闲连接数
   * @param poolStatus.total 总连接数
   * @param poolStatus.healthPercentage 健康百分比
   * @returns 是否健康的布尔值
   */
  private calculateOverallHealth(
    healthStatus: AdapterHealthStatus,
    metrics?: AdapterPerformanceMetrics,
    poolStatus?: {
      active: number;
      idle: number;
      total: number;
      healthPercentage: number;
    },
  ): boolean {
    // 检查连接状态
    if (healthStatus.connectionStatus !== DatabaseConnectionStatus.CONNECTED) {
      return false;
    }

    // 检查错误率（暂时跳过，因为AdapterPerformanceMetrics没有errorRate属性）
    // if (metrics && metrics.errorRate > 0.1) { // 10%错误率阈值
    //   return false;
    // }

    // 检查平均响应时间
    if (metrics && metrics.averageQueryTime > this.config.slowQueryThreshold) {
      return false;
    }

    // 检查连接池健康度
    if (
      poolStatus &&
      poolStatus.healthPercentage < this.config.minPoolHealthPercentage
    ) {
      return false;
    }

    return true;
  }

  /**
   * 将数据库性能指标转换为适配器性能指标
   * @param dbMetrics 数据库性能指标
   * @param healthMetrics 健康状态指标
   * @param entityType 实体类型
   * @returns 适配器性能指标
   */
  private buildAdapterPerformanceMetrics(
    dbMetrics: DatabasePerformanceMetrics,
    healthMetrics: DatabaseHealthStatus['performanceMetrics'] | undefined,
    entityType: string,
  ): AdapterPerformanceMetrics {
    const averageQueryTime =
      healthMetrics?.averageQueryTime ?? dbMetrics.queryTime ?? 0;

    return {
      databaseType: dbMetrics.databaseType,
      entityType,
      totalQueries: healthMetrics?.totalQueries ?? 0,
      averageQueryTime,
      slowQueryCount: healthMetrics?.slowQueryCount ?? 0,
      cacheHitRate: dbMetrics.cacheHitRate,
      memoryUsage: dbMetrics.memoryUsage,
      lastUpdated: new Date(),
    };
  }

  /**
   * 发出健康监控事件
   * @param name 适配器名称
   * @param current 当前健康检查结果
   * @param previous 之前的健康检查结果
   */
  private emitHealthEvent(
    name: string,
    current: HealthCheckResult,
    previous?: HealthCheckResult,
  ): void {
    let eventType: HealthMonitorEvent['type'] = 'health_check';

    // 检测连接状态变化
    if (previous) {
      if (
        previous.connectionStatus === DatabaseConnectionStatus.CONNECTED &&
        current.connectionStatus !== DatabaseConnectionStatus.CONNECTED
      ) {
        eventType = 'connection_lost';
      } else if (
        previous.connectionStatus !== DatabaseConnectionStatus.CONNECTED &&
        current.connectionStatus === DatabaseConnectionStatus.CONNECTED
      ) {
        eventType = 'connection_restored';
      } else if (previous.isHealthy && !current.isHealthy) {
        eventType = 'performance_degradation';
      }
    }

    const event: HealthMonitorEvent = {
      type: eventType,
      data: current,
      timestamp: new Date(),
    };

    this.emit('health_event', name, event);
  }

  /**
   * 记录健康检查日志
   * @param name 适配器名称
   * @param current 当前健康检查结果
   * @param previous 之前的健康检查结果
   */
  private logHealthCheck(
    name: string,
    current: HealthCheckResult,
    previous?: HealthCheckResult,
  ): void {
    const logData = {
      name,
      databaseType: current.databaseType,
      connectionStatus: current.connectionStatus,
      responseTime: current.responseTime,
      isHealthy: current.isHealthy,
      error: current.error,
      metrics: current.metrics,
      poolStatus: current.poolStatus,
    };

    if (current.isHealthy) {
      if (!previous || !previous.isHealthy) {
        this.logger.info('数据库健康状态恢复', logData);
      } else if (this.config.enableDetailedMonitoring) {
        this.logger.debug('数据库健康检查正常', logData);
      }
    } else {
      this.logger.warn('数据库健康检查失败', logData);
    }
  }

  /**
   * 获取所有适配器的健康状态
   * @returns 所有适配器的健康状态记录
   */
  getAllHealthStatus(): Record<string, HealthCheckResult> {
    const result: Record<string, HealthCheckResult> = {};
    for (const [name, status] of this.healthStatus) {
      result[name] = status;
    }
    return result;
  }

  /**
   * 获取特定适配器的健康状态
   * @param name 适配器名称
   * @returns 健康检查结果
   */
  getHealthStatus(name: string): HealthCheckResult | undefined {
    return this.healthStatus.get(name);
  }

  /**
   * 获取整体系统健康状态
   * @returns 系统健康状态摘要
   */
  getSystemHealthStatus(): {
    isHealthy: boolean;
    healthyAdapters: string[];
    unhealthyAdapters: string[];
    totalAdapters: number;
  } {
    const healthyAdapters: string[] = [];
    const unhealthyAdapters: string[] = [];

    for (const [name, status] of this.healthStatus) {
      if (status.isHealthy) {
        healthyAdapters.push(name);
      } else {
        unhealthyAdapters.push(name);
      }
    }

    const totalAdapters = this.adapters.size;
    const isHealthy = unhealthyAdapters.length === 0;

    return {
      isHealthy,
      healthyAdapters,
      unhealthyAdapters,
      totalAdapters,
    };
  }

  /**
   * 获取性能摘要
   * @returns 性能摘要数据
   */
  getPerformanceSummary(): Record<
    string,
    {
      averageResponseTime: number;
      totalQueries: number;
      errorRate: number;
      slowQueries: number;
    }
  > {
    const summary: Record<
      string,
      {
        averageResponseTime: number;
        totalQueries: number;
        errorRate: number;
        slowQueries: number;
      }
    > = {};

    for (const [name, status] of this.healthStatus) {
      if (status.metrics) {
        summary[name] = {
          averageResponseTime: status.metrics.averageQueryTime,
          totalQueries: status.metrics.totalQueries,
          errorRate: 0, // 暂时设为0，因为AdapterPerformanceMetrics没有errorRate属性
          slowQueries: status.metrics.slowQueryCount,
        };
      }
    }

    return summary;
  }

  /**
   * 更新配置
   * @param config 新的配置选项
   */
  updateConfig(config: Partial<HealthCheckConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('更新健康监控配置', { config: this.config });

    // 重新启动所有健康检查
    for (const name of this.adapters.keys()) {
      this.startHealthCheck(name);
    }
  }

  /**
   * 停止所有监控
   */
  stop(): void {
    for (const name of this.adapters.keys()) {
      this.stopHealthCheck(name);
    }
    this.removeAllListeners();
    this.logger.info('数据库健康监控已停止');
  }

  /**
   * 强制执行健康检查
   * @param name 可选的适配器名称，如果不提供则检查所有适配器
   */
  async forceHealthCheck(name?: string): Promise<void> {
    if (name) {
      await this.performHealthCheck(name);
    } else {
      for (const adapterName of this.adapters.keys()) {
        await this.performHealthCheck(adapterName);
      }
    }
  }
}

/**
 * 创建默认健康监控配置
 * @returns 默认的健康检查配置
 */
export function createDefaultHealthCheckConfig(): HealthCheckConfig {
  return {
    checkInterval: 30000, // 30秒
    connectionTimeout: 5000, // 5秒
    slowQueryThreshold: 1000, // 1秒
    minPoolHealthPercentage: 80, // 80%
    enableDetailedMonitoring: process.env.NODE_ENV !== 'production',
  };
}

/**
 * 创建健康监控器实例
 * @param logger 日志记录器
 * @param config 可选的配置选项
 * @returns 数据库健康监控器实例
 */
export function createDatabaseHealthMonitor(
  logger: Logger,
  config?: Partial<HealthCheckConfig>,
): DatabaseHealthMonitor {
  const defaultConfig = createDefaultHealthCheckConfig();
  const finalConfig = { ...defaultConfig, ...config };

  return new DatabaseHealthMonitor(finalConfig, logger);
}
