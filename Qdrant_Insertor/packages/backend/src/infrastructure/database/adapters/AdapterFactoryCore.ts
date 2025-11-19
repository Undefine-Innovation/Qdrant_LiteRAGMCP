import { DataSource, EntityTarget, ObjectLiteral } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { LoggerLike } from '@domain/repositories/IDatabaseRepository.js';
import { AppConfig } from '@config/config.js';
import {
  DatabaseType,
  DatabaseConfig,
} from '@domain/interfaces/IDatabaseRepository.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';
import {
  IRepositoryAdapter,
  IRepositoryAdapterFactory,
  AdapterConfig,
} from './IRepositoryAdapter.js';
import { PostgreSQLRepositoryAdapter } from './PostgreSQLRepositoryAdapter.js';
import { SQLiteRepositoryAdapter } from './SQLiteRepositoryAdapter.js';

/**
 * 适配器工厂核心实现
 * 负责创建和管理数据库适配器实例
 */
export class AdapterFactoryCore implements IRepositoryAdapterFactory {
  // 适配器缓存
  protected adapterCache = new Map<string, IRepositoryAdapter<unknown>>();

  // 数据源缓存
  protected dataSourceCache = new Map<string, DataSource>();

  /**
   * 创建仓库适配器
   * @param entityType 实体类型
   * @param dataSource 数据源
   * @param config 数据库配置
   * @param logger 日志记录器
   * @returns 仓库适配器实例
   */
  createAdapter<T extends ObjectLiteral>(
    entityType: EntityTarget<T>,
    dataSource: DataSource,
    config: DatabaseConfig,
    logger: LoggerLike,
  ): IRepositoryAdapter<T> {
    const cacheKey = this.getCacheKey(entityType, config);

    // 检查缓存
    if (this.adapterCache.has(cacheKey)) {
      logger.debug?.(`使用缓存的适配器`, {
        entityType: this.getEntityTargetName(entityType),
        databaseType: config.type,
      });
      return this.adapterCache.get(cacheKey) as IRepositoryAdapter<T>;
    }

    // 创建新的适配器
    let adapter: IRepositoryAdapter<T>;

    switch (config.type) {
      case DatabaseType.POSTGRESQL:
        adapter = new PostgreSQLRepositoryAdapter<T>(
          entityType as EntityTarget<T>,
          dataSource,
          config,
          logger as unknown as Logger,
        ) as unknown as IRepositoryAdapter<T>;
        break;

      case DatabaseType.SQLITE:
        adapter = new SQLiteRepositoryAdapter<T>(
          entityType as EntityTarget<T>,
          dataSource,
          config,
          logger as unknown as Logger,
        ) as unknown as IRepositoryAdapter<T>;
        break;

      default:
        throw new Error(`不支持的数据库类型: ${config.type}`);
    }

    // 缓存适配器
    this.adapterCache.set(cacheKey, adapter);

    logger.info?.(`创建数据库适配器成功`, {
      entityType: this.getEntityTargetName(entityType),
      databaseType: config.type,
    });

    return adapter;
  }

  /**
   * 从应用配置创建适配器
   * @param entityType 实体类型
   * @param appConfig 应用配置
   * @param logger 日志记录器
   * @param qdrantRepo 可选的Qdrant仓库
   * @returns 仓库适配器实例
   */
  async createFromAppConfig<T extends ObjectLiteral>(
    entityType: EntityTarget<T>,
    appConfig: AppConfig,
    logger: LoggerLike,
    qdrantRepo?: IQdrantRepo,
  ): Promise<IRepositoryAdapter<T>> {
    const dbConfig = this.convertAppConfigToDatabaseConfig(appConfig);
    const dataSource = await this.getOrCreateDataSource(dbConfig, logger);

    return this.createAdapter(entityType, dataSource, dbConfig, logger);
  }

  /**
   * 创建带Qdrant集成的适配器
   * @param entityType 实体类型
   * @param dataSource 数据源
   * @param config 数据库配置
   * @param logger 日志记录器
   * @param qdrantRepo Qdrant仓库
   * @returns 仓库适配器实例
   */
  createAdapterWithQdrant<T extends ObjectLiteral>(
    entityType: EntityTarget<T>,
    dataSource: DataSource,
    config: DatabaseConfig,
    logger: LoggerLike,
    qdrantRepo: IQdrantRepo,
  ): IRepositoryAdapter<T> {
    const cacheKey = this.getCacheKey(entityType, config) + '_with_qdrant';

    // 检查缓存
    if (this.adapterCache.has(cacheKey)) {
      logger.debug?.(`使用缓存的适配器（带Qdrant）`, {
        entityType: this.getEntityTargetName(entityType),
        databaseType: config.type,
      });
      return this.adapterCache.get(cacheKey) as IRepositoryAdapter<T>;
    }

    // 创建新的适配器
    let adapter: IRepositoryAdapter<T>;

    switch (config.type) {
      case DatabaseType.POSTGRESQL:
        adapter = new PostgreSQLRepositoryAdapter<T>(
          entityType as EntityTarget<T>,
          dataSource,
          config,
          logger as unknown as Logger,
          qdrantRepo,
        ) as unknown as IRepositoryAdapter<T>;
        break;

      case DatabaseType.SQLITE:
        adapter = new SQLiteRepositoryAdapter<T>(
          entityType as EntityTarget<T>,
          dataSource,
          config,
          logger as unknown as Logger,
          qdrantRepo,
        ) as unknown as IRepositoryAdapter<T>;
        break;

      default:
        throw new Error(`不支持的数据库类型: ${config.type}`);
    }

    // 缓存适配器
    this.adapterCache.set(cacheKey, adapter);

    logger.info?.(`创建数据库适配器成功（带Qdrant）`, {
      entityType: this.getEntityTargetName(entityType),
      databaseType: config.type,
    });

    return adapter;
  }

  /**
   * 获取支持的数据库类型
   * @returns 支持的数据库类型数组
   */
  getSupportedDatabaseTypes(): DatabaseType[] {
    return [DatabaseType.SQLITE, DatabaseType.POSTGRESQL];
  }

  /**
   * 验证适配器配置
   * @param config 数据库配置
   * @returns 验证结果
   */
  validateAdapterConfig(config: DatabaseConfig): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // 验证数据库类型
    if (!config.type) {
      errors.push('数据库类型不能为空');
    } else if (!this.getSupportedDatabaseTypes().includes(config.type)) {
      errors.push(`不支持的数据库类型: ${config.type}`);
    }

    // 根据数据库类型验证特定配置
    if (config.type === DatabaseType.SQLITE) {
      if (!config.path) {
        errors.push('SQLite数据库路径不能为空');
      }
    } else if (config.type === DatabaseType.POSTGRESQL) {
      if (!config.host) {
        errors.push('PostgreSQL主机地址不能为空');
      }
      if (!config.port || config.port <= 0 || config.port > 65535) {
        errors.push('PostgreSQL端口必须是1-65535之间的有效数字');
      }
      if (!config.username) {
        errors.push('PostgreSQL用户名不能为空');
      }
      if (!config.password) {
        errors.push('PostgreSQL密码不能为空');
      }
      if (!config.database) {
        errors.push('PostgreSQL数据库名不能为空');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 自动检测数据库类型
   * @param config 数据库配置
   * @returns 检测到的数据库类型
   */
  detectDatabaseType(config: Partial<DatabaseConfig>): DatabaseType {
    // 如果明确指定了类型，直接返回
    if (config.type) {
      return config.type;
    }

    // 根据配置自动检测
    if (config.host && config.port && config.username && config.database) {
      return DatabaseType.POSTGRESQL;
    }

    if (config.path) {
      return DatabaseType.SQLITE;
    }

    // 默认使用SQLite
    return DatabaseType.SQLITE;
  }

  /**
   * 获取数据库类型的默认配置
   * @param type 数据库类型
   * @returns 默认配置
   */
  getDefaultConfig(type: DatabaseType): DatabaseConfig {
    switch (type) {
      case DatabaseType.POSTGRESQL:
        return {
          type: DatabaseType.POSTGRESQL,
          host: 'localhost',
          port: 5432,
          username: 'postgres',
          password: '',
          database: 'qdrant_rag',
          ssl: false,
          maxConnections: 20,
          minConnections: 5,
          connectionTimeout: 10000,
          idleTimeout: 300000,
        };

      case DatabaseType.SQLITE:
        return {
          type: DatabaseType.SQLITE,
          path: './data/app.db',
          maxConnections: 1,
          minConnections: 1,
          connectionTimeout: 30000,
          idleTimeout: 300000,
        };

      default:
        throw new Error(`不支持的数据库类型: ${type}`);
    }
  }

  /**
   * 清理缓存
   * @param entityType 可选的实体类型，如果提供则只清理该类型的缓存
   */
  clearCache(entityType?: EntityTarget<unknown>): void {
    if (entityType) {
      // 清理特定实体类型的缓存
      const keysToDelete: string[] = [];
      const name = this.getEntityTargetName(entityType);
      for (const key of this.adapterCache.keys()) {
        if (key.startsWith(name)) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach((key) => this.adapterCache.delete(key));
    } else {
      // 清理所有缓存
      this.adapterCache.clear();
      this.dataSourceCache.clear();
    }
  }
  /**
   * 获取实体目标的显示名称（处理 function 或 string 两种情况）
   * @param entityType 实体类型，可以是类构造函数、字符串或其它 EntityTarget
   * @returns 实体的显示名称（如果无法识别则返回 'Unknown'）
   */
  protected getEntityTargetName(entityType: EntityTarget<unknown>): string {
    if (typeof entityType === 'string') return entityType;
    if (typeof entityType === 'function') return (entityType as { name?: string }).name || 'Unknown';
    return 'Unknown';
  }

  /**
   * 获取缓存统计信息
   * @returns 缓存统计信息
   */
  getCacheStats(): {
    adapterCacheSize: number;
    dataSourceCacheSize: number;
    cachedEntityTypes: string[];
  } {
    const cachedEntityTypes = Array.from(this.adapterCache.keys())
      .map((key) => key.split('_')[0])
      .filter((type, index, arr) => arr.indexOf(type) === index);

    return {
      adapterCacheSize: this.adapterCache.size,
      dataSourceCacheSize: this.dataSourceCache.size,
      cachedEntityTypes,
    };
  }

  /**
   * 将应用配置转换为数据库配置
   * @param appConfig 应用配置
   * @returns 数据库配置
   */
  private convertAppConfigToDatabaseConfig(
    appConfig: AppConfig,
  ): DatabaseConfig {
    if (appConfig.db.type === 'postgres' && appConfig.db.postgres) {
      return {
        type: DatabaseType.POSTGRESQL,
        host: appConfig.db.postgres.host,
        port: appConfig.db.postgres.port,
        username: appConfig.db.postgres.username,
        password: appConfig.db.postgres.password,
        database: appConfig.db.postgres.database,
        ssl: appConfig.db.postgres.ssl,
        // 连接池配置
        maxConnections: 20,
        minConnections: 5,
        connectionTimeout: 10000,
        idleTimeout: 300000,
      };
    } else {
      return {
        type: DatabaseType.SQLITE,
        path: appConfig.db.path || './data/app.db',
        // SQLite不需要连接池配置
        maxConnections: 1,
        minConnections: 1,
        connectionTimeout: 30000,
        idleTimeout: 300000,
      };
    }
  }

  /**
   * 获取缓存键
   * @param entityType 实体类型
   * @param config 数据库配置
   * @returns 缓存键
   */
  protected getCacheKey(
    entityType: EntityTarget<unknown>,
    config: DatabaseConfig,
  ): string {
    return `${typeof entityType === 'string' ? entityType : this.getEntityTargetName(entityType)}_${config.type}_${config.host || 'local'}_${config.database || config.path}`;
  }

  /**
   * 获取数据源缓存键
   * @param config 数据库配置
   * @returns 数据源缓存键
   */
  protected getDataSourceCacheKey(config: DatabaseConfig): string {
    return `${config.type}_${config.host || 'local'}_${config.database || config.path}`;
  }

  /**
   * 获取或创建数据源
   * @param config 数据库配置
   * @param logger 日志记录器
   * @returns 数据源实例
   */
  protected async getOrCreateDataSource(
    config: DatabaseConfig,
    logger: LoggerLike,
  ): Promise<DataSource> {
    const cacheKey = this.getDataSourceCacheKey(config);

    if (this.dataSourceCache.has(cacheKey)) {
      const dataSource = this.dataSourceCache.get(cacheKey)!;
      if (!dataSource.isInitialized) {
        await dataSource.initialize();
      }
      return dataSource;
    }

    return await this.createDataSource(config, logger);
  }

  /**
   * 创建数据源
   * @param config 数据库配置
   * @param logger 日志记录器
   * @returns 数据源实例
   */
  async createDataSource(
    config: DatabaseConfig,
    logger: LoggerLike,
  ): Promise<DataSource> {
    const cacheKey = this.getDataSourceCacheKey(config);

    // 检查缓存
    if (this.dataSourceCache.has(cacheKey)) {
      const dataSource = this.dataSourceCache.get(cacheKey)!;
      if (!dataSource.isInitialized) {
        await dataSource.initialize();
      }
      return dataSource;
    }

    // 创建新的数据源
    let dataSource: DataSource;

    switch (config.type) {
      case DatabaseType.POSTGRESQL:
        dataSource = new DataSource({
          type: 'postgres',
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
          database: config.database,
          ssl: config.ssl || false,
          // 连接池配置
          extra: {
            max: config.maxConnections || 20,
            min: config.minConnections || 5,
            idleTimeoutMillis: config.idleTimeout || 300000,
            connectionTimeoutMillis: config.connectionTimeout || 10000,
            // 健康检查
            healthCheckIntervalMillis: 60000,
            // 性能优化
            application_name: 'qdrant-insertor-backend',
            // 连接重试
            retries: 3,
            retryDelayMillis: 1000,
          },
          // 实体配置
          entities: [],
          synchronize: false,
          logging: false,
          migrations: [],
          subscribers: [],
        });
        break;

      case DatabaseType.SQLITE:
        dataSource = new DataSource({
          type: 'sqlite',
          database: config.path || './data/app.db',
          // SQLite特定配置
          extra: {
            // 启用外键检查
            pragma: ['foreign_keys = ON'],
            // 连接池配置
            busyTimeout: config.connectionTimeout || 30000,
          },
          // 实体配置
          entities: [],
          synchronize: false,
          logging: false,
          migrations: [],
          subscribers: [],
        });
        break;

      default:
        throw new Error(`不支持的数据库类型: ${config.type}`);
    }

    // 初始化数据源
    await dataSource.initialize();

    // 缓存数据源
    this.dataSourceCache.set(cacheKey, dataSource);

    logger.info?.(`创建数据源成功`, {
      databaseType: config.type,
      host: config.host,
      database: config.database,
      path: config.path,
    });

    return dataSource;
  }

  /**
   * 测试数据库连接
   * @param config 数据库配置
   * @param logger 日志记录器
   * @returns 测试结果
   */
  async testConnection(
    config: DatabaseConfig,
    logger: LoggerLike,
  ): Promise<{
    success: boolean;
    message: string;
    error?: string;
    responseTime?: number;
  }> {
    const startTime = Date.now();

    try {
      const dataSource = await this.createDataSource(config, logger);
      const isConnected = await dataSource.query('SELECT 1');
      const responseTime = Date.now() - startTime;

      if (isConnected) {
        return {
          success: true,
          message: '数据库连接测试成功',
          responseTime,
        };
      } else {
        return {
          success: false,
          message: '数据库连接测试失败',
          responseTime,
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        success: false,
        message: '数据库连接测试失败',
        error: errorMessage,
        responseTime,
      };
    }
  }
}
