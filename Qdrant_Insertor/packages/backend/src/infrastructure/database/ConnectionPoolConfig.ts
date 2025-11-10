import { DataSourceOptions } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { AppConfig } from '@config/config.js';

/**
 * 数据库连接池配置接口
 */
export interface ConnectionPoolConfig {
  // 连接池大小
  maxConnections?: number;
  minConnections?: number;

  // 连接超时设置
  connectionTimeout?: number;
  acquireTimeout?: number;

  // 连接生命周期
  idleTimeout?: number;
  maxLifetime?: number;

  // 重试配置
  retryAttempts?: number;
  retryDelay?: number;

  // 健康检查
  healthCheckInterval?: number;
  healthCheckTimeout?: number;

  // 性能优化
  enableQueryCache?: boolean;
  queryCacheSize?: number;
  queryCacheDuration?: number;

  // 监控
  enableMetrics?: boolean;
  slowQueryThreshold?: number;
}

/**
 * 默认连接池配置
 */
export const DEFAULT_CONNECTION_POOL_CONFIG: ConnectionPoolConfig = {
  // 连接池大小
  maxConnections: 20,
  minConnections: 5,

  // 连接超时设置（毫秒）
  connectionTimeout: 10000, // 10秒
  acquireTimeout: 30000, // 30秒

  // 连接生命周期（毫秒）
  idleTimeout: 300000, // 5分钟
  maxLifetime: 3600000, // 1小时

  // 重试配置
  retryAttempts: 3,
  retryDelay: 1000, // 1秒

  // 健康检查（毫秒）
  healthCheckInterval: 60000, // 1分钟
  healthCheckTimeout: 5000, // 5秒

  // 性能优化
  enableQueryCache: true,
  queryCacheSize: 1000,
  queryCacheDuration: 300000, // 5分钟

  // 监控
  enableMetrics: true,
  slowQueryThreshold: 1000, // 1秒
};

/**
 * 创建优化的TypeORM连接池配置
 * @param config 应用配置
 * @param logger 日志记录器
 * @param poolConfig 连接池配置
 * @returns 优化的TypeORM数据源配置
 */
export function createOptimizedConnectionPoolConfig(
  config: AppConfig,
  logger: Logger,
  poolConfig: ConnectionPoolConfig = {},
): DataSourceOptions {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isTest = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID;

  // 合并默认配置和自定义配置
  const finalPoolConfig = { ...DEFAULT_CONNECTION_POOL_CONFIG, ...poolConfig };

  // 根据环境调整配置
  if (isTest) {
    // 测试环境使用较小的连接池
    finalPoolConfig.maxConnections = 5;
    finalPoolConfig.minConnections = 1;
    finalPoolConfig.enableQueryCache = false;
    finalPoolConfig.enableMetrics = false;
  } else if (isDevelopment) {
    // 开发环境使用中等大小的连接池
    finalPoolConfig.maxConnections = 10;
    finalPoolConfig.minConnections = 2;
  }

  logger.info('配置数据库连接池', {
    maxConnections: finalPoolConfig.maxConnections,
    minConnections: finalPoolConfig.minConnections,
    enableQueryCache: finalPoolConfig.enableQueryCache,
    enableMetrics: finalPoolConfig.enableMetrics,
  });

  // 基础配置
  const baseConfig: Partial<DataSourceOptions> = {
    synchronize: Boolean(isDevelopment || isTest),
    logging: isDevelopment && !isTest,
    // 连接池配置
    extra: {
      // SQLite配置
      ...(config.db.type !== 'postgres' && {
        // SQLite连接池配置
        busyTimeout: finalPoolConfig.acquireTimeout,
        // 启用WAL模式以提高并发性能
        pragma: [
          'journal_mode = WAL',
          'synchronous = NORMAL',
          'cache_size = 10000',
          'temp_store = MEMORY',
          'mmap_size = 268435456', // 256MB
        ],
      }),
      // PostgreSQL配置
      ...(config.db.type === 'postgres' && {
        // PostgreSQL连接池配置
        max: finalPoolConfig.maxConnections,
        min: finalPoolConfig.minConnections,
        idleTimeoutMillis: finalPoolConfig.idleTimeout,
        connectionTimeoutMillis: finalPoolConfig.connectionTimeout,
        // 启用连接健康检查
        healthCheckIntervalMillis: finalPoolConfig.healthCheckInterval,
        // 查询超时
        query_timeout: finalPoolConfig.acquireTimeout,
        statement_timeout: finalPoolConfig.acquireTimeout,
        // 优化性能
        application_name: 'qdrant-insertor-backend',
        // 连接SSL配置
        ssl: config.db.postgres?.ssl || false,
      }),
    },
    // 查询缓存配置
    cache: finalPoolConfig.enableQueryCache
      ? {
          duration: finalPoolConfig.queryCacheDuration,
          options: {
            maxSize: finalPoolConfig.queryCacheSize,
          },
        }
      : false,
    // 慢查询日志
    maxQueryExecutionTime: finalPoolConfig.slowQueryThreshold,
    // 启用连接池监控
  };

  // 根据数据库类型创建特定配置
  if (config.db.type === 'postgres' && config.db.postgres) {
    logger.info('配置PostgreSQL连接池');
    return {
      ...baseConfig,
      type: 'postgres',
      host: config.db.postgres.host,
      port: config.db.postgres.port,
      username: config.db.postgres.username,
      password: config.db.postgres.password,
      database: config.db.postgres.database,
      ssl: config.db.postgres.ssl || false,
      // PostgreSQL特定配置
      extra: {
        ...baseConfig.extra,
        // 连接池配置
        max: finalPoolConfig.maxConnections,
        min: finalPoolConfig.minConnections,
        idleTimeoutMillis: finalPoolConfig.idleTimeout,
        connectionTimeoutMillis: finalPoolConfig.connectionTimeout,
        // 健康检查
        healthCheckIntervalMillis: finalPoolConfig.healthCheckInterval,
        // 性能优化
        application_name: 'qdrant-insertor-backend',
        // 连接重试
        retries: finalPoolConfig.retryAttempts,
        retryDelayMillis: finalPoolConfig.retryDelay,
      },
    } as DataSourceOptions;
  } else {
    // SQLite配置
    logger.info(`配置SQLite连接池: ${config.db.path}`);
    return {
      ...baseConfig,
      type: 'sqlite',
      database: config.db.path,
      // SQLite特定配置
      extra: {
        ...baseConfig.extra,
        // 测试环境启用外键检查
        ...(isTest && {
          pragma: ['foreign_keys = ON'],
        }),
      },
    } as DataSourceOptions;
  }
}

/**
 * 连接池监控接口
 */
export interface ConnectionPoolMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingClients: number;
  maxConnections: number;
  minConnections: number;
  averageQueryTime: number;
  slowQueryCount: number;
  failedConnectionCount: number;
  lastHealthCheckTime: number;
  healthCheckStatus: 'healthy' | 'degraded' | 'unhealthy';
}

/**
 * 连接池监控器
 */
export class ConnectionPoolMonitor {
  private metrics: ConnectionPoolMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    waitingClients: 0,
    maxConnections: 0,
    minConnections: 0,
    averageQueryTime: 0,
    slowQueryCount: 0,
    failedConnectionCount: 0,
    lastHealthCheckTime: 0,
    healthCheckStatus: 'healthy',
  };

  private queryTimes: number[] = [];
  private healthCheckTimer: NodeJS.Timeout | null = null;

  /**
   * 创建连接池监控器实例
   * @param config 连接池配置
   * @param logger 日志记录器
   */
  constructor(
    private readonly config: ConnectionPoolConfig,
    private readonly logger: Logger,
  ) {}

  /**
   * 启动监控
   */
  start(): void {
    if (this.config.enableMetrics && this.config.healthCheckInterval) {
      this.healthCheckTimer = setInterval(
        () => this.performHealthCheck(),
        this.config.healthCheckInterval,
      );

      this.logger.info('连接池监控已启动', {
        interval: this.config.healthCheckInterval,
      });
    }
  }

  /**
   * 停止监控
   */
  stop(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
      this.logger.info('连接池监控已停止');
    }
  }

  /**
   * 记录查询时间
   * @param queryTime 查询时间（毫秒）
   */
  recordQueryTime(queryTime: number): void {
    this.queryTimes.push(queryTime);

    // 保持最近1000次查询的时间记录
    if (this.queryTimes.length > 1000) {
      this.queryTimes.shift();
    }

    // 更新平均查询时间
    this.metrics.averageQueryTime =
      this.queryTimes.reduce((sum, time) => sum + time, 0) /
      this.queryTimes.length;

    // 检查慢查询
    if (
      this.config.slowQueryThreshold &&
      queryTime > this.config.slowQueryThreshold
    ) {
      this.metrics.slowQueryCount++;
      this.logger.warn('检测到慢查询', {
        queryTime,
        threshold: this.config.slowQueryThreshold,
      });
    }
  }

  /**
   * 记录连接失败
   */
  recordConnectionFailure(): void {
    this.metrics.failedConnectionCount++;
    this.logger.warn('数据库连接失败', {
      totalFailures: this.metrics.failedConnectionCount,
    });
  }

  /**
   * 更新连接池状态
   * @param status 连接池状态
   */
  updatePoolStatus(status: Partial<ConnectionPoolMetrics>): void {
    this.metrics = { ...this.metrics, ...status };
  }

  /**
   * 获取当前指标
   * @returns 连接池指标
   */
  getMetrics(): ConnectionPoolMetrics {
    return { ...this.metrics };
  }

  /**
   * 执行健康检查
   */
  private performHealthCheck(): void {
    const now = Date.now();
    this.metrics.lastHealthCheckTime = now;

    // 根据指标确定健康状态
    if (this.metrics.failedConnectionCount > 10) {
      this.metrics.healthCheckStatus = 'unhealthy';
    } else if (
      this.metrics.failedConnectionCount > 5 ||
      this.metrics.averageQueryTime > (this.config.slowQueryThreshold || 1000)
    ) {
      this.metrics.healthCheckStatus = 'degraded';
    } else {
      this.metrics.healthCheckStatus = 'healthy';
    }

    // 记录健康检查结果
    this.logger.debug('连接池健康检查完成', {
      status: this.metrics.healthCheckStatus,
      activeConnections: this.metrics.activeConnections,
      idleConnections: this.metrics.idleConnections,
      averageQueryTime: Math.round(this.metrics.averageQueryTime),
      slowQueryCount: this.metrics.slowQueryCount,
      failedConnections: this.metrics.failedConnectionCount,
    });
  }
}
