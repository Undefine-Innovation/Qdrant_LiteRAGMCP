import { DataSource, DataSourceOptions } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { AppConfig } from '@config/config.js';
import { BaseEntity } from './entities/BaseEntity.js';
import { Collection } from './entities/Collection.js';
import { Doc } from './entities/Doc.js';
import { ChunkMeta } from './entities/ChunkMeta.js';
import { Chunk } from './entities/Chunk.js';
import { ChunkFullText } from './entities/ChunkFullText.js';
// SyncJobEntity removed - DB-backed sync jobs are disabled
import { SystemMetrics } from './entities/SystemMetrics.js';
import { AlertRules } from './entities/AlertRules.js';
import { AlertHistory } from './entities/AlertHistory.js';
import { SystemHealth } from './entities/SystemHealth.js';
import { ScrapeResults } from './entities/ScrapeResults.js';
import { Event } from './entities/Event.js';
import {
  createOptimizedConnectionPoolConfig,
  ConnectionPoolConfig,
  ConnectionPoolMonitor,
  ConnectionPoolMetrics,
} from './ConnectionPoolConfig.js';

/**
 * 数据库配置接口
 */
export interface DatabaseConfig {
  type: 'sqlite' | 'postgres';
  database: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  synchronize: boolean;
  logging: boolean;
  entities: string[];
  migrations: string[];
  subscribers: string[];
}

/**
 * 创建TypeORM数据源配置
 * @param config 应用配置
 * @param logger 日志记录器
 * @param poolConfig 连接池配置
 * @returns TypeORM数据源配置
 */
export function createTypeORMConfig(
  config: AppConfig,
  logger: Logger,
  poolConfig?: ConnectionPoolConfig,
): DataSourceOptions {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isTest = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID;

  // 使用优化的连接池配置
  const poolOptimizedConfig = createOptimizedConnectionPoolConfig(
    config,
    logger,
    poolConfig,
  );

  // 基础配置
  const baseConfig: Partial<DataSourceOptions> = {
    ...poolOptimizedConfig,
    synchronize: Boolean(isDevelopment && !isTest), // 开发环境和测试环境都自动同步
    logging: isDevelopment && !isTest, // 开发环境启用日志
    // 直接导入实体类而不是使用字符串路径，避免循环依赖问题
    entities: [
  BaseEntity,
  Collection,
  Doc,
  ChunkMeta,
  Chunk,
  ChunkFullText,
  // SyncJobEntity removed (DB-backed sync jobs disabled)
  SystemMetrics,
  AlertRules,
  AlertHistory,
  SystemHealth,
  ScrapeResults,
  Event,
    ],
    migrations: [
      // 迁移已禁用，使用 synchronize: true 自动创建/更新表结构
    ],
    subscribers: [
      'src/infrastructure/database/subscribers/**/*.ts',
      'src/infrastructure/database/subscribers/**/*.js',
    ],
    // 启用验证选项
    // validate: true, // 注释掉，因为DataSourceOptions中没有validate属性
  };

  // 根据配置决定使用SQLite还是PostgreSQL
  if (config.db.type === 'postgres' && config.db.postgres) {
    logger.info('配置PostgreSQL数据库连接');
    return {
      ...baseConfig,
      type: 'postgres',
      host: config.db.postgres.host,
      port: config.db.postgres.port,
      username: config.db.postgres.username,
      password: config.db.postgres.password,
      database: config.db.postgres.database,
      ssl: config.db.postgres.ssl || false,
    } as DataSourceOptions;
  } else {
    // 默认使用SQLite
    logger.info(`配置SQLite数据库连接: ${config.db.path}`);
    return {
      ...baseConfig,
      type: 'sqlite',
      database: config.db.path,
      // 在测试环境中启用外键检查以确保约束正常工作
      extra: isTest
        ? {
            pragma: ['foreign_keys = ON'],
          }
        : undefined,
    } as DataSourceOptions;
  }
}

/**
 * 创建TypeORM数据源
 * @param config 应用配置
 * @param logger 日志记录器
 * @param entities 可选的实体数组
 * @param poolConfig 连接池配置
 * @returns TypeORM数据源实例
 */
export function createTypeORMDataSource(
  config: AppConfig,
  logger: Logger,
  entities?: (() => unknown)[],
  poolConfig?: ConnectionPoolConfig,
): DataSource {
  // 测试环境：如果全局已有测试数据源，则直接复用，避免重复初始化与索引冲突
  // 检查多种条件：JEST_WORKER_ID、NODE_ENV为'test'、或全局__TEST_DATASOURCE存在
  const isTestEnv =
    Boolean(process.env.JEST_WORKER_ID) || process.env.NODE_ENV === 'test';
  const globalScope = globalThis as { __TEST_DATASOURCE?: DataSource };

  if (isTestEnv && globalScope.__TEST_DATASOURCE) {
    const testDs = globalScope.__TEST_DATASOURCE;
    logger.debug('Using global test datasource', {
      isInitialized: testDs.isInitialized,
      type: testDs.options.type,
    });
    return testDs;
  }

  // ����ǲ��Ի�����û��ȫ�ֲ�������Դ���򴴽�һ���µ�
  if (isTestEnv) {
    logger.debug('Creating new test datasource for test environment');
  }

  const dataSourceConfig = createTypeORMConfig(config, logger, poolConfig);

  // 创建新的配置对象以避免修改只读属性
  const finalConfig: DataSourceOptions = {
    ...dataSourceConfig,
    entities: entities || dataSourceConfig.entities,
  };

  return new DataSource(finalConfig);
}

/**
 * 数据库连接状态枚举
 */
export enum DatabaseConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

/**
 * 数据库连接管理器
 */
export class DatabaseConnectionManager {
  private dataSource: DataSource | null = null;
  private status: DatabaseConnectionStatus =
    DatabaseConnectionStatus.DISCONNECTED;
  private connectionPromise: Promise<void> | null = null;
  private poolMonitor: ConnectionPoolMonitor | null = null;

  /**
   * 创建数据库连接管理器实例
   * @param config 应用配置
   * @param logger 日志记录器
   * @param poolConfig 连接池配置
   */
  constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger,
    private readonly poolConfig?: ConnectionPoolConfig,
  ) {}

  /**
   * 获取当前连接状态
   * @returns 当前数据库连接状态
   */
  getStatus(): DatabaseConnectionStatus {
    return this.status;
  }

  /**
   * 获取数据源实例
   * @returns TypeORM数据源实例，如果未初始化则返回null
   */
  getDataSource(): DataSource | null {
    return this.dataSource;
  }

  /**
   * 初始化数据库连接
   * @returns Promise表示初始化完成
   */
  async initialize(): Promise<void> {
    // 如果已经在连接中，返回现有的Promise
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.status = DatabaseConnectionStatus.CONNECTING;

    this.connectionPromise = this.doInitialize();

    try {
      await this.connectionPromise;
      this.status = DatabaseConnectionStatus.CONNECTED;
      this.logger.info('数据库连接初始化成功');
    } catch (error) {
      this.status = DatabaseConnectionStatus.ERROR;
      this.logger.error('数据库连接初始化失败', { error });
      throw error;
    } finally {
      this.connectionPromise = null;
    }
  }

  /**
   * 执行实际的初始化逻辑
   */
  private async doInitialize(): Promise<void> {
    try {
      this.dataSource = createTypeORMDataSource(
        this.config,
        this.logger,
        undefined,
        this.poolConfig,
      );

      // 初始化数据源
      await this.dataSource.initialize();

      // 初始化连接池监控
      if (this.poolConfig?.enableMetrics) {
        this.poolMonitor = new ConnectionPoolMonitor(
          this.poolConfig,
          this.logger,
        );
        this.poolMonitor.start();
      }

      // 运行迁移（如果需要）
      if (!this.dataSource.options.synchronize) {
        await this.dataSource.runMigrations();
        this.logger.info('数据库迁移执行完成');
      }

      // 测试连接
      if (this.dataSource.isInitialized) {
        await this.dataSource.query('SELECT 1');
        this.logger.info('数据库连接测试成功');
      }
    } catch (error) {
      this.logger.error('数据库初始化过程中发生错误', { error });
      throw error;
    }
  }

  /**
   * 关闭数据库连接
   * @returns Promise表示关闭操作完成
   */
  async close(): Promise<void> {
    // 停止连接池监控
    if (this.poolMonitor) {
      this.poolMonitor.stop();
      this.poolMonitor = null;
    }

    if (this.dataSource && this.dataSource.isInitialized) {
      try {
        await this.dataSource.destroy();
        this.logger.info('数据库连接已关闭');
      } catch (error) {
        this.logger.error('关闭数据库连接时发生错误', { error });
        throw error;
      } finally {
        this.dataSource = null;
        this.status = DatabaseConnectionStatus.DISCONNECTED;
      }
    }
  }

  /**
   * 检查数据库连接是否健康
   * @returns 如果连接健康返回true，否则返回false
   */
  async ping(): Promise<boolean> {
    try {
      if (!this.dataSource || !this.dataSource.isInitialized) {
        return false;
      }

      await this.dataSource.query('SELECT 1');
      return true;
    } catch (error) {
      this.logger.warn('数据库ping检查失败', { error });
      return false;
    }
  }

  /**
   * 获取连接池指标
   * @returns 连接池指标
   */
  getPoolMetrics(): ConnectionPoolMetrics | null {
    return this.poolMonitor ? this.poolMonitor.getMetrics() : null;
  }

  /**
   * 记录查询时间
   * @param queryTime 查询时间（毫秒）
   */
  recordQueryTime(queryTime: number): void {
    if (this.poolMonitor) {
      this.poolMonitor.recordQueryTime(queryTime);
    }
  }

  /**
   * 记录连接失败
   */
  recordConnectionFailure(): void {
    if (this.poolMonitor) {
      this.poolMonitor.recordConnectionFailure();
    }
  }
}
