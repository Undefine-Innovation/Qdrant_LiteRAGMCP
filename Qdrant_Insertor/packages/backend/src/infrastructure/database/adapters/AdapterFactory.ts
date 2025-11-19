import { EntityTarget, ObjectLiteral } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { LoggerLike } from '@domain/repositories/IDatabaseRepository.js';
import { AppConfig } from '@config/config.js';
import { DatabaseConfig, DatabaseType } from '@domain/interfaces/IDatabaseRepository.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';
import {
  IRepositoryAdapter,
  IRepositoryAdapterFactory,
} from './IRepositoryAdapter.js';
import { AdapterFactoryCore } from './AdapterFactoryCore.js';
import { AdapterManager } from './AdapterManager.js';
import { EnvironmentConfigParser } from './EnvironmentConfigParser.js';

/**
 * 适配器工厂实现
 * 根据配置自动选择合适的数据库适配器
 * 使用单例模式确保全局唯一实例
 */
export class AdapterFactory
  extends AdapterFactoryCore
  implements IRepositoryAdapterFactory
{
  // 单例实例
  private static instance: AdapterFactory;

  /**
   * 获取工厂实例
   * @returns 工厂实例
   */
  static getInstance(): AdapterFactory {
    if (!AdapterFactory.instance) {
      AdapterFactory.instance = new AdapterFactory();
    }
    return AdapterFactory.instance;
  }

  /**
   * 创建适配器管理器
   * @param logger 日志记录器
   * @returns 适配器管理器实例
   */
  createAdapterManager(logger: LoggerLike): AdapterManager {
    return new AdapterManager(this, logger);
  }

  /**
   * 从环境变量创建适配器
   * @param entityType 实体类型
   * @param logger 日志记录器
   * @param qdrantRepo 可选的Qdrant仓库
   * @returns 仓库适配器实例
   */
  async createFromEnv<T extends ObjectLiteral>(
    entityType: EntityTarget<T>,
    logger: LoggerLike,
    qdrantRepo?: IQdrantRepo,
  ): Promise<IRepositoryAdapter<T>> {
    const config = EnvironmentConfigParser.parseFromEnv();
    const dataSource = await this.getOrCreateDataSource(config, logger);

    if (qdrantRepo) {
      return this.createAdapterWithQdrant(
        entityType,
        dataSource,
        config,
        logger,
        qdrantRepo,
      );
    } else {
      return this.createAdapter(entityType, dataSource, config, logger);
    }
  }

  /**
   * 验证环境变量配置
   * @returns 验证结果
   */
  validateEnvConfig(): {
    valid: boolean;
    errors: string[];
  } {
    const envValidation = EnvironmentConfigParser.validateEnvVars();
    if (!envValidation.valid) {
      return envValidation;
    }

    const config = EnvironmentConfigParser.parseFromEnv();
    return this.validateAdapterConfig(config);
  }

  /**
   * 获取环境变量配置摘要
   * @returns 配置摘要
   */
  getEnvConfigSummary(): {
    dbType: string;
    config: Record<string, unknown>;
    masked: boolean;
  } {
    return EnvironmentConfigParser.getConfigSummary() as {
      dbType: string;
      config: Record<string, unknown>;
      masked: boolean;
    };
  }

  /**
   * 检查环境变量完整性
   * @returns 检查结果
   */
  checkEnvCompleteness(): {
    complete: boolean;
    missing: string[];
    optional: string[];
  } {
    return EnvironmentConfigParser.checkEnvCompleteness();
  }

  /**
   * 验证环境变量格式
   * @returns 验证结果
   */
  validateEnvFormats(): {
    valid: boolean;
    errors: string[];
  } {
    return EnvironmentConfigParser.validateEnvFormats();
  }

  /**
   * 生成环境变量配置示例
   * @param dbType 数据库类型
   * @returns 配置示例
   */
  generateEnvExample(dbType: DatabaseType): string {
    return EnvironmentConfigParser.generateEnvExample(dbType);
  }

  /**
   * 创建带完整配置的适配器
   * @param entityType 实体类型
   * @param appConfig 应用配置
   * @param logger 日志记录器
   * @param qdrantRepo 可选的Qdrant仓库
   * @returns 仓库适配器实例
   */
  async createWithFullConfig<T extends ObjectLiteral>(
    entityType: EntityTarget<T>,
    appConfig: AppConfig,
    logger: LoggerLike,
    qdrantRepo?: IQdrantRepo,
  ): Promise<IRepositoryAdapter<T>> {
    // 验证应用配置
    if (!appConfig || !appConfig.db) {
      throw new Error('应用配置或数据库配置不能为空');
    }

    // 从应用配置创建适配器
    return this.createFromAppConfig(entityType, appConfig, logger, qdrantRepo);
  }

  /**
   * 批量创建适配器
   * @param entityTypes 实体类型数组
   * @param appConfig 应用配置
   * @param logger 日志记录器
   * @param qdrantRepo 可选的Qdrant仓库
   * @returns 仓库适配器实例数组
   */
  async createBatch<T extends ObjectLiteral>(
    entityTypes: EntityTarget<T>[],
    appConfig: AppConfig,
    logger: LoggerLike,
    qdrantRepo?: IQdrantRepo,
  ): Promise<IRepositoryAdapter<T>[]> {
    const adapters: IRepositoryAdapter<T>[] = [];

    for (const entityType of entityTypes) {
      try {
        const adapter = await this.createWithFullConfig(
          entityType,
          appConfig,
          logger,
          qdrantRepo,
        );
        adapters.push(adapter);
      } catch (error) {
        logger.error?.(`创建适配器失败`, {
          entityType:
            typeof entityType === 'string'
              ? entityType
              : AdapterFactory.getEntityName(entityType),
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    return adapters;
  }

  /**
   * 测试多种数据库配置的连接
   * @param configs 数据库配置数组
   * @param logger 日志记录器
   * @returns 测试结果数组
   */
  async testMultipleConnections(
    configs: DatabaseConfig[],
    logger: LoggerLike,
  ): Promise<
    Array<{
      config: DatabaseConfig;
      result: {
        success: boolean;
        message: string;
        error?: string;
        responseTime?: number;
      };
    }>
  > {
    const results = [];

    for (const config of configs) {
      try {
        const result = await this.testConnection(config, logger);
        results.push({ config, result });
      } catch (error) {
        results.push({
          config,
          result: {
            success: false,
            message: '连接测试失败',
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }

    return results;
  }

  /**
   * 获取工厂状态信息
   * @returns 状态信息
   */
  getFactoryStatus(): {
    instanceId: string;
    cacheStats: {
      adapterCacheSize: number;
      dataSourceCacheSize: number;
      cachedEntityTypes: string[];
    };
    supportedTypes: string[];
    uptime: number;
  } {
    const cacheStats = this.getCacheStats();
    const supportedTypes = this.getSupportedDatabaseTypes();

    return {
      instanceId: this.getInstanceId(),
      cacheStats,
      supportedTypes,
      uptime: Date.now() - this.getCreationTime(),
    };
  }

  /**
   * 重置工厂状态
   */
  reset(): void {
    this.clearCache();
    this.resetCreationTime();
  }

  // 私有方法用于跟踪实例信息
  private instanceId: string;
  private creationTime: number;

  private constructor() {
    super();
    this.instanceId = this.generateInstanceId();
    this.creationTime = Date.now();
  }

  private getInstanceId(): string {
    return this.instanceId;
  }

  private getCreationTime(): number {
    return this.creationTime;
  }

  private resetCreationTime(): void {
    this.creationTime = Date.now();
  }

  private generateInstanceId(): string {
    return `factory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static getEntityName(entityType: EntityTarget<unknown>): string {
    if (typeof entityType === 'string') return entityType;
    // functions (classes/constructors)
    if (typeof entityType === 'function') {
      const funcLike = entityType as unknown as { name?: unknown };
      if (typeof funcLike.name === 'string') return funcLike.name;
      return '<anonymous>';
    }
    // EntitySchema-like objects may have a 'name' property
    const maybeName = (entityType as unknown as { name?: unknown })?.name;
    if (typeof maybeName === 'string') return maybeName;
    return '<unknown>';
  }
}

// 重新导出所有相关类和接口
export { AdapterFactoryCore } from './AdapterFactoryCore.js';
export { AdapterManager } from './AdapterManager.js';
export { EnvironmentConfigParser } from './EnvironmentConfigParser.js';
