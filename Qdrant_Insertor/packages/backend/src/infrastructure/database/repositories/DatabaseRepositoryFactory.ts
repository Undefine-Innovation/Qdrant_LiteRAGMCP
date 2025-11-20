import { Logger, createEnhancedLoggerFromConfig } from '@logging/logger.js';
import { DataSource } from 'typeorm';
import { AppConfig } from '@config/config.js';
import {
  IDatabaseRepository,
  IDatabaseRepositoryFactory,
  DatabaseType,
  DatabaseConfig,
} from '@domain/interfaces/IDatabaseRepository.js';
import { PostgreSQLRepository } from '../SimplifiedIndex.js';
import { SQLiteRepositoryAdapter } from './SQLiteRepositoryAdapter.js';

/**
 * 数据库仓库工厂实现
 * 根据配置创建相应的数据库仓库实例
 */
export class DatabaseRepositoryFactory implements IDatabaseRepositoryFactory {
  /**
   * 创建数据库仓库实例
   * @param config 数据库配置
   * @param logger 日志记录器
   * @returns 数据库仓库实例
   */
  async createRepository(
    config: DatabaseConfig,
    logger: Logger,
  ): Promise<IDatabaseRepository> {
    logger.info('创建数据库仓库', { type: config.type });

    switch (config.type) {
      case DatabaseType.POSTGRESQL:
        return await this.createPostgreSQLRepository(config, logger);

      case DatabaseType.SQLITE:
        return await this.createSQLiteRepository(config, logger);

      default:
        throw new Error(`不支持的数据库类型: ${config.type}`);
    }
  }

  /**
   * 从应用配置创建数据库仓库
   * @param appConfig 应用配置
   * @param logger 日志记录器
   * @returns 数据库仓库实例
   */
  async createFromAppConfig(
    appConfig: AppConfig,
    logger: Logger,
  ): Promise<IDatabaseRepository> {
    const dbConfig = this.convertAppConfigToDatabaseConfig(appConfig);
    return await this.createRepository(dbConfig, logger);
  }

  /**
   * 获取支持的数据库类型
   * @returns 支持的数据库类型数组
   */
  getSupportedDatabaseTypes(): DatabaseType[] {
    return [DatabaseType.SQLITE, DatabaseType.POSTGRESQL];
  }

  /**
   * 验证数据库配置
   * @param config 数据库配置
   * @returns 验证结果
   */
  validateConfig(config: DatabaseConfig): {
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

    // 验证连接池配置
    if (config.maxConnections !== undefined) {
      if (config.maxConnections <= 0 || config.maxConnections > 1000) {
        errors.push('最大连接数必须是1-1000之间的数字');
      }
    }

    if (config.minConnections !== undefined) {
      if (config.minConnections < 0 || config.minConnections > 1000) {
        errors.push('最小连接数必须是0-1000之间的数字');
      }
    }

    if (config.connectionTimeout !== undefined) {
      if (config.connectionTimeout <= 0 || config.connectionTimeout > 300000) {
        errors.push('连接超时必须是1-300000毫秒之间的数字');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 创建PostgreSQL仓库
   * @param config 数据库配置
   * @param logger 日志记录器
   * @returns PostgreSQL仓库实例
   */
  private async createPostgreSQLRepository(
    config: DatabaseConfig,
    logger: Logger,
  ): Promise<IDatabaseRepository> {
    // 创建TypeORM数据源
    const dataSource = new DataSource({
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
      synchronize: false, // 由仓库自己管理
      logging: false, // 暂时禁用TypeORM日志，使用我们自己的日志系统
      // 迁移配置
      migrations: [],
      subscribers: [],
    });

    return new PostgreSQLRepository(dataSource, config, logger);
  }

  /**
   * 创建SQLite仓库
   * @param config 数据库配置
   * @param logger 日志记录器
   * @returns SQLite仓库实例
   */
  private async createSQLiteRepository(
    config: DatabaseConfig,
    logger: Logger,
  ): Promise<IDatabaseRepository> {
    // 创建TypeORM数据源
    const dataSource = new DataSource({
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
      synchronize: false, // 由仓库自己管理
      logging: false, // 暂时禁用TypeORM日志，使用我们自己的日志系统
      // 迁移配置
      migrations: [],
      subscribers: [],
    });

    return new SQLiteRepositoryAdapter(dataSource, config, logger);
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
   * 检测数据库类型
   * @param config 数据库配置
   * @returns 检测到的数据库类型
   */
  detectDatabaseType(config: DatabaseConfig): DatabaseType {
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

    throw new Error('无法检测数据库类型，请提供明确的配置');
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
   * 创建数据库连接字符串
   * @param config 数据库配置
   * @returns 连接字符串
   */
  createConnectionString(config: DatabaseConfig): string {
    switch (config.type) {
      case DatabaseType.POSTGRESQL: {
        const ssl = config.ssl ? '?ssl=true' : '';
        return `postgresql://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}${ssl}`;
      }

      case DatabaseType.SQLITE:
        return `sqlite:${config.path}`;

      default:
        throw new Error(`不支持的数据库类型: ${config.type}`);
    }
  }

  /**
   * 测试数据库连接
   * @param config 数据库配置
   * @param logger 日志记录器
   * @returns 测试结果
   */
  async testConnection(
    config: DatabaseConfig,
    logger: Logger,
  ): Promise<{
    success: boolean;
    message: string;
    error?: string;
    responseTime?: number;
  }> {
    const startTime = Date.now();

    try {
      const repository = await this.createRepository(config, logger);
      const isConnected = await repository.ping();
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

  /**
   * 获取数据库配置模板
   * @param type 数据库类型
   * @returns 配置模板
   */
  getConfigTemplate(type: DatabaseType): Record<string, unknown> {
    switch (type) {
      case DatabaseType.POSTGRESQL:
        return {
          type: 'postgres',
          host: 'localhost',
          port: 5432,
          username: 'postgres',
          password: 'your_password',
          database: 'qdrant_rag',
          ssl: false,
          maxConnections: 20,
          minConnections: 5,
          connectionTimeout: 10000,
          idleTimeout: 300000,
        };

      case DatabaseType.SQLITE:
        return {
          type: 'sqlite',
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
}

/**
 * 单例数据库仓库工厂
 */
export class DatabaseRepositoryFactorySingleton {
  private static instance: DatabaseRepositoryFactory;

  /**
   * 获取工厂实例
   * @returns 工厂实例
   */
  static getInstance(): DatabaseRepositoryFactory {
    if (!DatabaseRepositoryFactorySingleton.instance) {
      DatabaseRepositoryFactorySingleton.instance =
        new DatabaseRepositoryFactory();
    }
    return DatabaseRepositoryFactorySingleton.instance;
  }
}
