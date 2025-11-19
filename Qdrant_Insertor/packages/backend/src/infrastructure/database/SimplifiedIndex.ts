/**
 * 简化的数据库模块索引
 * 统一导出所有简化的数据库组件，替代原有的复杂结构
 */

import { DataSource, EntityTarget, ObjectLiteral } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { DatabaseConfig } from '@domain/interfaces/IDatabaseRepository.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';

// === 简化的适配器 ===
export { SimplifiedRepositoryAdapter } from './adapters/SimplifiedRepositoryAdapter.js';

// === 简化的仓库 ===
export { SimplifiedDocRepository } from './repositories/SimplifiedDocRepository.js';
export { SimplifiedPostgreSQLRepository } from './repositories/SimplifiedPostgreSQLRepository.js';

// === 保留的核心组件 ===
export { BaseRepository } from './repositories/BaseRepository.js';
export { BatchOperationManager } from './repositories/BatchOperationManager.js';

// === 实体 ===
export * from './entities/index.js';

// === 配置和工具 ===
export * from './config.js';
export * from './initialize.js';

// === 向后兼容的别名 ===

// 为了保持向后兼容性，提供原有名称的别名
import { SimplifiedRepositoryAdapter } from './adapters/SimplifiedRepositoryAdapter.js';
import { SimplifiedDocRepository } from './repositories/SimplifiedDocRepository.js';
import { SimplifiedPostgreSQLRepository } from './repositories/SimplifiedPostgreSQLRepository.js';

// 适配器别名
export const PostgreSQLRepositoryAdapter = SimplifiedRepositoryAdapter;
export const SQLiteRepositoryAdapter = SimplifiedRepositoryAdapter;
export const TypeORMRepositoryAdapter = SimplifiedRepositoryAdapter;

// 仓库别名
export const DocRepository = SimplifiedDocRepository;
export const PostgreSQLRepository = SimplifiedPostgreSQLRepository;

// === 工厂函数 ===

/**
 * 创建简化的仓库适配器
 * @param entityClass 实体类
 * @param dataSource 数据源
 * @param config 数据库配置
 * @param logger 日志记录器
 * @param qdrantRepo 可选的Qdrant仓库
 * @returns 仓库适配器实例
 */
export function createSimplifiedRepositoryAdapter<T extends ObjectLiteral>(
  entityClass: EntityTarget<T>,
  dataSource: DataSource,
  config: DatabaseConfig,
  logger: Logger,
  qdrantRepo?: IQdrantRepo,
): SimplifiedRepositoryAdapter<T> {
  return new SimplifiedRepositoryAdapter<T>(
    entityClass,
    dataSource,
    config,
    logger,
    qdrantRepo,
  );
}

/**
 * 创建简化的文档仓库
 * @param dataSource 数据源
 * @param logger 日志记录器
 * @returns 文档仓库实例
 */
export function createSimplifiedDocRepository(
  dataSource: DataSource,
  logger: Logger,
): SimplifiedDocRepository {
  return new SimplifiedDocRepository(dataSource, logger);
}

/**
 * 创建简化的PostgreSQL仓库
 * @param dataSource 数据源
 * @param config 数据库配置
 * @param logger 日志记录器
 * @param qdrantRepo 可选的Qdrant仓库
 * @returns PostgreSQL仓库实例
 */
export function createSimplifiedPostgreSQLRepository(
  dataSource: DataSource,
  config: DatabaseConfig,
  logger: Logger,
  qdrantRepo?: IQdrantRepo,
): SimplifiedPostgreSQLRepository {
  return new SimplifiedPostgreSQLRepository(
    dataSource,
    config,
    logger,
    qdrantRepo,
  );
}

// === 迁移助手 ===

/**
 * 从旧仓库迁移到简化仓库的助手类
 */
export class RepositoryMigrationHelper {
  /**
   * 检查是否需要迁移
   * @param oldRepository 旧仓库实例
   * @returns 是否需要迁移
   */
  static needsMigration(oldRepository: unknown): boolean {
    // 检查是否是旧的仓库实现
    return !(
      oldRepository instanceof SimplifiedRepositoryAdapter ||
      oldRepository instanceof SimplifiedDocRepository ||
      oldRepository instanceof SimplifiedPostgreSQLRepository
    );
  }

  /**
   * 迁移文档仓库
   * @param oldDocRepository 旧的文档仓库
   * @param dataSource 数据源
   * @param logger 日志记录器
   * @returns 新的简化文档仓库
   */
  static migrateDocRepository(
    oldDocRepository: unknown,
    dataSource: DataSource,
    logger: Logger,
  ): SimplifiedDocRepository {
    logger.info('迁移文档仓库到简化版本');
    return new SimplifiedDocRepository(dataSource, logger);
  }

  /**
   * 迁移PostgreSQL仓库
   * @param oldPostgresRepository 旧的PostgreSQL仓库
   * @param dataSource 数据源
   * @param config 数据库配置
   * @param logger 日志记录器
   * @param qdrantRepo 可选的Qdrant仓库
   * @returns 新的简化PostgreSQL仓库
   */
  static migratePostgreSQLRepository(
    oldPostgresRepository: unknown,
    dataSource: DataSource,
    config: DatabaseConfig,
    logger: Logger,
    qdrantRepo?: IQdrantRepo,
  ): SimplifiedPostgreSQLRepository {
    logger.info('迁移PostgreSQL仓库到简化版本');
    return new SimplifiedPostgreSQLRepository(
      dataSource,
      config,
      logger,
      qdrantRepo,
    );
  }
}

// === 类型定义 ===

/**
 * 简化的数据库配置
 */
export interface SimplifiedDatabaseConfig {
  type: 'postgresql' | 'sqlite' | 'mysql';
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  // 简化的配置选项
  enableQueryCache?: boolean;
  cacheExpiration?: number;
  enablePerformanceMonitoring?: boolean;
  slowQueryThreshold?: number;
  batchSize?: number;
  transactionTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

/**
 * 简化的仓库选项
 */
export interface SimplifiedRepositoryOptions {
  enableQueryCache?: boolean;
  cacheExpiration?: number;
  enablePerformanceMonitoring?: boolean;
  slowQueryThreshold?: number;
  batchSize?: number;
  transactionTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

// === 常量 ===

/**
 * 默认的简化配置
 */
export const DEFAULT_SIMPLIFIED_CONFIG: SimplifiedRepositoryOptions = {
  enableQueryCache: true,
  cacheExpiration: 300000, // 5分钟
  enablePerformanceMonitoring: true,
  slowQueryThreshold: 1000, // 1秒
  batchSize: 100,
  transactionTimeout: 30000, // 30秒
  retryAttempts: 3,
  retryDelay: 1000, // 1秒
};

/**
 * 数据库类型常量
 */
export const DATABASE_TYPES = {
  POSTGRESQL: 'postgresql',
  SQLITE: 'sqlite',
  MYSQL: 'mysql',
} as const;

/**
 * 仓库类型常量
 */
export const REPOSITORY_TYPES = {
  SIMPLIFIED: 'simplified',
  LEGACY: 'legacy',
} as const;
