/**
 * 服务迁移助手。
 * 负责在切换底层数据库实现时，将核心服务迁移到统一的适配器栈。
 */

import { Logger } from '@logging/logger.js';
import { DataSource } from 'typeorm';
import { createAdapterFromEnv, AdapterFactory } from './index.js';
import { IRepositoryAdapter } from './IRepositoryAdapter.js';
import { DatabaseType } from '@domain/interfaces/IDatabaseRepository.js';
import { AdapterWrapper } from './ServiceMigrationContracts.js';
import type { MigrationConfig, MigrationServiceRegistry } from './ServiceMigrationContracts.js';
import {
  Collection as CollectionEntity,
  Doc as DocEntity,
  Chunk as ChunkEntity,
} from '@infrastructure/database/entities/index.js';
import { CollectionAggregateRepository } from '../repositories/CollectionAggregateRepository.js';
import { DocumentAggregateRepository } from '../repositories/DocumentAggregateRepository.js';
import { AppConfig } from '@config/config.js';

export { AdapterWrapper, validateMigration } from './ServiceMigrationContracts.js';
export type { MigrationConfig, MigrationServiceRegistry } from './ServiceMigrationContracts.js';

export class ServiceMigrationManager {
  private static instance: ServiceMigrationManager;
  private adapters = new Map<string, IRepositoryAdapter<unknown>>();
  private wrappers = new Map<string, AdapterWrapper<unknown>>();
  private migrationConfig: MigrationConfig;

  private constructor(config: MigrationConfig) {
    this.migrationConfig = config;
  }

  /**
   * 获取单例实例
   * @param config 配置选项
   * @returns 单例实例
   */
  static getInstance(config?: MigrationConfig): ServiceMigrationManager {
    if (!ServiceMigrationManager.instance) {
      if (!config) {
        throw new Error('首次创建ServiceMigrationManager必须提供配置');
      }
      ServiceMigrationManager.instance = new ServiceMigrationManager(config);
    }
    return ServiceMigrationManager.instance;
  }

  /**
   * 创建集合适配器
   * @param dataSource 数据源
   * @param logger 日志记录器
   * @returns 集合适配器实例
   */
  async createCollectionAdapter(
    dataSource: DataSource,
    logger: Logger,
  ): Promise<IRepositoryAdapter<CollectionEntity>> {
    const cacheKey = 'collection';

    if (this.adapters.has(cacheKey)) {
      return this.adapters.get(cacheKey)! as IRepositoryAdapter<CollectionEntity>;
    }

    try {
      const { Collection: CollectionType } = await import(
        '../entities/index.js'
      );
      const adapter = await createAdapterFromEnv<CollectionEntity>(
        CollectionType,
        logger,
      );
      this.adapters.set(cacheKey, adapter);

      logger.info('集合适配器创建成功', {
        databaseType: adapter.databaseType,
        config: adapter.config,
      });

      return adapter;
    } catch (error) {
      logger.error('集合适配器创建失败', { error });
      throw error;
    }
  }

  /**
   * 创建文档适配器
   * @param dataSource 数据源
   * @param logger 日志记录器
   * @returns 文档适配器实例
   */
  async createDocumentAdapter(
    dataSource: DataSource,
    logger: Logger,
  ): Promise<IRepositoryAdapter<DocEntity>> {
    const cacheKey = 'document';

    if (this.adapters.has(cacheKey)) {
      return this.adapters.get(cacheKey)! as IRepositoryAdapter<DocEntity>;
    }

    try {
      const { Doc: DocType } = await import('../entities/index.js');
      const adapter = await createAdapterFromEnv<DocEntity>(DocType, logger);
      this.adapters.set(cacheKey, adapter);

      logger.info('文档适配器创建成功', {
        databaseType: adapter.databaseType,
        config: adapter.config,
      });

      return adapter;
    } catch (error) {
      logger.error('文档适配器创建失败', { error });
      throw error;
    }
  }

  /**
   * 创建块适配器
   * @param dataSource 数据源
   * @param logger 日志记录器
   * @returns 块适配器实例
   */
  async createChunkAdapter(
    dataSource: DataSource,
    logger: Logger,
  ): Promise<IRepositoryAdapter<ChunkEntity>> {
    const cacheKey = 'chunk';

    if (this.adapters.has(cacheKey)) {
      return this.adapters.get(cacheKey)! as IRepositoryAdapter<ChunkEntity>;
    }

    try {
      const { Chunk: ChunkType } = await import('../entities/index.js');
      const adapter = await createAdapterFromEnv<ChunkEntity>(
        ChunkType,
        logger,
      );
      this.adapters.set(cacheKey, adapter);

      logger.info('块适配器创建成功', {
        databaseType: adapter.databaseType,
        config: adapter.config,
      });

      return adapter;
    } catch (error) {
      logger.error('块适配器创建失败', { error });
      throw error;
    }
  }

  /**
   * 创建适配器包装器
   * @param entityType 实体类型
   * @param adapter 适配器实例
   * @param originalRepository 原始仓库实例
   * @param logger 日志记录器
   * @returns 适配器包装器实例
   */
  createWrapper<T>(
    entityType: string,
    adapter: IRepositoryAdapter<T>,
    originalRepository: unknown,
    logger: Logger,
  ): AdapterWrapper<T> {
    const wrapper = new AdapterWrapper(adapter, originalRepository, logger);
    this.wrappers.set(entityType, wrapper);
    return wrapper;
  }

  /**
   * 获取适配器包装器
   * @param entityType 实体类型
   * @returns 适配器包装器实例或undefined
   */
  getWrapper<T>(entityType: string): AdapterWrapper<T> | undefined {
    return this.wrappers.get(entityType) as AdapterWrapper<T> | undefined;
  }

  /**
   * 检查服务是否应该迁移
   * @param serviceName 服务名称
   * @returns 是否应该迁移
   */
  shouldMigrateService(serviceName: string): boolean {
    return (
      this.migrationConfig.enableAdapterMode &&
      this.migrationConfig.migrateServices.includes(serviceName)
    );
  }

  /**
   * 获取迁移配置
   * @returns 迁移配置对象
   */
  getMigrationConfig(): MigrationConfig {
    return { ...this.migrationConfig };
  }

  /**
   * 更新迁移配置
   * @param config 新的配置选项
   */
  updateMigrationConfig(config: Partial<MigrationConfig>): void {
    this.migrationConfig = { ...this.migrationConfig, ...config };
  }

  /**
   * 获取所有适配器的性能指标
   * @returns 性能指标数组
   */
  async getPerformanceMetrics(): Promise<Array<{
    entityType: string;
    metrics: Record<string, unknown>;
  }>> {
    const metrics: Array<{
      entityType: string;
      metrics: Record<string, unknown>;
    }> = [];

    for (const [entityType, adapter] of this.adapters) {
      metrics.push({
        entityType,
        metrics: (await adapter.getPerformanceMetrics()) as unknown as Record<string, unknown>,
      });
    }

    return metrics;
  }

  /**
   * 清理所有适配器
   */
  async cleanup(): Promise<void> {
    for (const [entityType, adapter] of this.adapters) {
      try {
        // 适配器可能没有cleanup方法，使用close代替
        if ('cleanup' in adapter && typeof adapter.cleanup === 'function') {
          await adapter.cleanup();
        } else if ('close' in adapter && typeof adapter.close === 'function') {
          await adapter.close();
        }
        // 如果都没有，跳过清理
      } catch (error) {
        console.error(`清理适配器失败 ${entityType}:`, error);
      }
    }

    this.adapters.clear();
    this.wrappers.clear();
  }
}

/**
 * 创建默认迁移配置
 * @returns 默认迁移配置
 */
export function createDefaultMigrationConfig(): MigrationConfig {
  return {
    enableAdapterMode: process.env.ENABLE_ADAPTER_MODE === 'true',
    forceDatabaseType:
      (process.env.FORCE_DATABASE_TYPE as DatabaseType) || undefined,
    migrateServices: [
      'CollectionService',
      'DocumentService',
      'SearchService',
      'ImportService',
    ],
    fallbackToOriginal: true,
    enablePerformanceMonitoring:
      process.env.ENABLE_PERFORMANCE_MONITORING === 'true',
  };
}

/**
 * 迁移集合服务
 * @param originalService 原始服务实例
 * @param dataSource 数据源
 * @param logger 日志记录器
 * @returns 迁移后的服务实例
 */
export async function migrateCollectionService(
  originalService: Record<string, unknown>,
  dataSource: DataSource,
  logger: Logger,
): Promise<Record<string, unknown>> {
  const migrationManager = ServiceMigrationManager.getInstance();

  if (!migrationManager.shouldMigrateService('CollectionService')) {
    return originalService;
  }

  try {
    const adapter = await migrationManager.createCollectionAdapter(
      dataSource,
      logger,
    );
    const originalRepository = originalService.collectionRepository;

    // 创建适配器包装器
    const wrapper = migrationManager.createWrapper(
      'collection',
      adapter,
      originalRepository,
      logger,
    );

    // 创建新的文档聚合仓储，使用适配器
    const adaptedRepository = new CollectionAggregateRepository(
      adapter.dataSource,
      logger,
    );

    // 创建迁移后的服务实例
    const migratedService = new (originalService.constructor as new (...args: unknown[]) => unknown)(
      adaptedRepository,
      originalService.qdrantRepo,
      originalService.eventPublisher,
      logger,
      originalService.transactionManager,
      originalService.enhancedLogger,
    );

    logger.info('集合服务迁移完成', {
      databaseType: adapter.databaseType,
      performanceMonitoring:
        migrationManager.getMigrationConfig().enablePerformanceMonitoring,
    });

    return migratedService as Record<string, unknown>;
  } catch (error) {
    logger.error('集合服务迁移失败，回退到原始实现', { error });

    if (migrationManager.getMigrationConfig().fallbackToOriginal) {
      return originalService;
    }

    throw error;
  }
}

/**
 * 迁移文档服务
 * @param originalService 原始服务实例
 * @param dataSource 数据源
 * @param logger 日志记录器
 * @returns 迁移后的服务实例
 */
export async function migrateDocumentService(
  originalService: Record<string, unknown>,
  dataSource: DataSource,
  logger: Logger,
): Promise<Record<string, unknown>> {
  const migrationManager = ServiceMigrationManager.getInstance();

  if (!migrationManager.shouldMigrateService('DocumentService')) {
    return originalService;
  }

  try {
    const adapter = await migrationManager.createDocumentAdapter(
      dataSource,
      logger,
    );
    const originalRepository = originalService.documentRepository;

    // 创建适配器包装器
    const wrapper = migrationManager.createWrapper(
      'document',
      adapter,
      originalRepository,
      logger,
    );

    // 创建新的文档聚合仓储，使用适配器
    const adaptedRepository = new DocumentAggregateRepository(
      adapter.dataSource,
      logger,
    );

    // 创建迁移后的服务实例
    const migratedService = new (originalService.constructor as new (...args: unknown[]) => unknown)(
      adaptedRepository,
      originalService.importService,
      originalService.qdrantRepo,
      originalService.eventPublisher,
      logger,
      originalService.enhancedLogger,
    );

    logger.info('文档服务迁移完成', {
      databaseType: adapter.databaseType,
      performanceMonitoring:
        migrationManager.getMigrationConfig().enablePerformanceMonitoring,
    });

    return migratedService as Record<string, unknown>;
  } catch (error) {
    logger.error('文档服务迁移失败，回退到原始实现', { error });

    if (migrationManager.getMigrationConfig().fallbackToOriginal) {
      return originalService;
    }

    throw error;
  }
}

/**
 * 批量迁移服务
 * @param services 服务集合
 * @param dataSource 数据源
 * @param logger 日志记录器
 * @returns 迁移后的服务集合
 */
export async function migrateServices(
  services: MigrationServiceRegistry,
  dataSource: DataSource,
  logger: Logger,
): Promise<MigrationServiceRegistry> {
  const migratedServices: MigrationServiceRegistry = { ...services };

  // 初始化迁移管理器
  const migrationConfig = createDefaultMigrationConfig();
  ServiceMigrationManager.getInstance(migrationConfig);

  // 迁移集合服务
  if (services.collectionService) {
    migratedServices.collectionService = await migrateCollectionService(
      services.collectionService,
      dataSource,
      logger,
    );
  }

  // 迁移文档服务
  if (services.documentService) {
    migratedServices.documentService = await migrateDocumentService(
      services.documentService,
      dataSource,
      logger,
    );
  }

  // 可以继续添加其他服务的迁移逻辑

  if (migrationConfig.enableAdapterMode) {
    logger.info('服务批量迁移完成', {
      migratedServices: Object.keys(migratedServices),
      adapterMode: migrationConfig.enableAdapterMode,
    });
  } else {
    logger.info('适配器模式未启用，跳过服务迁移');
  }

  return migratedServices;
}

/**
 * 判断服务实例是否包含集合服务的验证接口
 * @param service 待检测的对象
 */