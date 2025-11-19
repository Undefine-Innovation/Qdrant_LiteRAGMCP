/**
 * 数据库适配器模块
 * 提供统一的数据库操作接口，支持多种数据库类型
 */

// 接口定义
export * from './IRepositoryAdapter.js';

// 适配器实现
export * from './TypeORMRepositoryAdapter.js';
export * from './PostgreSQLRepositoryAdapter.js';
export * from './SQLiteRepositoryAdapter.js';

// 工厂和管理器
export * from './AdapterFactory.js';

// 重新导出常用类型
import {
  IRepositoryAdapter,
  IRepositoryAdapterFactory,
  AdapterConfig,
  AdapterPerformanceMetrics,
  AdapterHealthStatus,
  AdapterEventType,
  AdapterEvent,
  IAdapterEventListener,
  DatabaseConnectionStatus,
} from './IRepositoryAdapter.js';
import { EntityTarget, ObjectLiteral } from 'typeorm';

import {
  AdapterFactory,
  AdapterManager,
  EnvironmentConfigParser,
} from './AdapterFactory.js';

import { TypeORMRepositoryAdapter } from './TypeORMRepositoryAdapter.js';

import { PostgreSQLRepositoryAdapter } from './PostgreSQLRepositoryAdapter.js';

import { SQLiteRepositoryAdapter } from './SQLiteRepositoryAdapter.js';

// 默认导出
export {
  // 接口
  type IRepositoryAdapter,
  type IRepositoryAdapterFactory,
  type AdapterConfig,
  type AdapterPerformanceMetrics,
  type AdapterHealthStatus,
  type AdapterEventType,
  type AdapterEvent,
  type IAdapterEventListener,
  type DatabaseConnectionStatus,

  // 适配器实现
  TypeORMRepositoryAdapter,
  PostgreSQLRepositoryAdapter,
  SQLiteRepositoryAdapter,

  // 工厂和管理器
  AdapterFactory,
  AdapterManager,
  EnvironmentConfigParser,
};

/**
 * 创建适配器的便捷函数
 * @param entityType 实体类型
 * @param config 数据库配置
 * @param logger 日志记录器
 * @returns 适配器实例
 */
export async function createAdapter<T extends ObjectLiteral>(
  entityType: EntityTarget<T>,
  config: import('@domain/interfaces/IDatabaseRepository.js').DatabaseConfig,
  logger: import('@logging/logger.js').Logger,
): Promise<IRepositoryAdapter<T>> {
  const factory = AdapterFactory.getInstance();
  const dataSource = await factory.createDataSource(config, logger);
  return factory.createAdapter(entityType, dataSource, config, logger);
}

/**
 * 从环境变量创建适配器的便捷函数
 * @param entityType 实体类型
 * @param logger 日志记录器
 * @returns 适配器实例
 */
export async function createAdapterFromEnv<T extends ObjectLiteral>(
  entityType: EntityTarget<T>,
  logger: import('@logging/logger.js').Logger,
): Promise<IRepositoryAdapter<T>> {
  const config = EnvironmentConfigParser.parseFromEnv();
  return await createAdapter(entityType, config, logger);
}

/**
 * 验证适配器配置的便捷函数
 * @param config 数据库配置
 * @returns 验证结果
 */
export function validateAdapterConfig(
  config: import('@domain/interfaces/IDatabaseRepository.js').DatabaseConfig,
): {
  valid: boolean;
  errors: string[];
} {
  const factory = AdapterFactory.getInstance();
  return factory.validateAdapterConfig(config);
}

/**
 * 测试数据库连接的便捷函数
 * @param config 数据库配置
 * @param logger 日志记录器
 * @returns 测试结果
 */
export async function testDatabaseConnection(
  config: import('@domain/interfaces/IDatabaseRepository.js').DatabaseConfig,
  logger: import('@logging/logger.js').Logger,
): Promise<{
  success: boolean;
  message: string;
  error?: string;
  responseTime?: number;
}> {
  const factory = AdapterFactory.getInstance();
  return await factory.testConnection(config, logger);
}

// 导出服务迁移相关功能
export * from './ServiceMigrationHelper.js';

// 导出健康监控相关功能
export * from './DatabaseHealthMonitor.js';
