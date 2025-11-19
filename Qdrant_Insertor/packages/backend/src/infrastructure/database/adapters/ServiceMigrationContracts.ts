/**
 * 服务迁移契约与通用工具。
 * 将通用的类型、适配器包装器以及验证逻辑集中放在该文件，方便在其它模块中复用。
 */
import { Logger } from '@logging/logger.js';
import { DatabaseType } from '@domain/interfaces/IDatabaseRepository.js';
import { IRepositoryAdapter } from './IRepositoryAdapter.js';

/**
 * 迁移配置，用于描述在运行期如何切换到新的适配器。
 */
export interface MigrationConfig {
  /** 是否启用适配器模式 */
  enableAdapterMode: boolean;
  /** 强制指定数据库类型 */
  forceDatabaseType?: DatabaseType;
  /** 需要迁移的服务名称列表 */
  migrateServices: string[];
  /** 迁移失败时是否回退到原始实现 */
  fallbackToOriginal: boolean;
  /** 是否启用性能监控 */
  enablePerformanceMonitoring: boolean;
}

/**
 * 用于校验集合服务迁移是否成功的最小接口定义。
 */
export interface CollectionServiceLike {
  /** 列举所有集合，需返回 Promise 以便验证流程等待完成 */
  listAllCollections(): Promise<unknown>;
}

/**
 * 用于校验文档服务迁移是否成功的最小接口定义。
 */
export interface DocumentServiceLike {
  /** 列举所有文档，需返回 Promise 以便验证流程等待完成 */
  listAllDocuments(): Promise<unknown>;
}

/**
 * 服务注册表，使用服务名称做键，值是对应的服务实例。
 * 其中的 collectionService/documentService 属性仅用于 TypeScript 智能提示。
 */
export type MigrationServiceRegistry = {
  [serviceName: string]: Record<string, unknown> | undefined;
  collectionService?: Record<string, unknown>;
  documentService?: Record<string, unknown>;
};

/**
 * 适配器包装器，封装了适配器实例与原始仓库，并在需要时比较性能。
 */
export class AdapterWrapper<T> {
  constructor(
    private readonly adapter: IRepositoryAdapter<T>,
    private readonly originalRepository: unknown,
    private readonly logger: Logger,
  ) {}

  /**
   * 获取适配器实例。
   * @returns 适配器实例，类型为 `IRepositoryAdapter<T>`
   */
  getAdapter(): IRepositoryAdapter<T> {
    return this.adapter;
  }

  /**
   * 获取原始仓库实现。
   * @returns 原始仓库实现（可能为任意类型）
   */
  getOriginalRepository(): unknown {
    return this.originalRepository;
  }

  /**
   * 比较调用适配器与原始仓库时的性能差异。
   * @param operation 本次对比的操作名称
   * @param adapterOperation 适配器实现的执行函数
   * @param originalOperation 原始仓库的执行函数
    * @returns 对比结果对象，包含 `adapterTime`, `originalTime`, `improvement`
   */
  async comparePerformance(
    operation: string,
    adapterOperation: () => Promise<unknown>,
    originalOperation: () => Promise<unknown>,
  ): Promise<{
    adapterTime: number;
    originalTime: number;
    improvement: number;
  }> {
    const adapterStart = Date.now();
    await adapterOperation();
    const adapterTime = Date.now() - adapterStart;

    const originalStart = Date.now();
    await originalOperation();
    const originalTime = Date.now() - originalStart;

    const improvement = ((originalTime - adapterTime) / originalTime) * 100;

    this.logger.info('性能对比结果', {
      operation,
      adapterTime,
      originalTime,
      improvement: improvement.toFixed(2) + '%',
    });

    return {
      adapterTime,
      originalTime,
      improvement,
    };
  }
}

/**
 * 判断传入的服务是否符合 CollectionService 的最小能力。
 * @param service - 被检查的服务实例
 * @returns 如果服务实现了 `listAllCollections` 方法则为 true，否则为 false
 */
export function isCollectionServiceLike(
  service: unknown,
): service is CollectionServiceLike {
  if (typeof service !== 'object' || service === null) {
    return false;
  }

  return (
    typeof (service as { listAllCollections?: unknown }).listAllCollections ===
    'function'
  );
}

/**
 * 判断传入的服务是否符合 DocumentService 的最小能力。
 * @param service - 被检查的服务实例
 * @returns 如果服务实现了 `listAllDocuments` 方法则为 true，否则为 false
 */
export function isDocumentServiceLike(
  service: unknown,
): service is DocumentServiceLike {
  if (typeof service !== 'object' || service === null) {
    return false;
  }

  return (
    typeof (service as { listAllDocuments?: unknown }).listAllDocuments ===
    'function'
  );
}

/**
 * 校验迁移是否成功，帮助我们在运行期快速滚动验证。
 * @param originalServices - 原始服务注册表（以服务名为键）
 * @param migratedServices - 迁移后的服务注册表
 * @param logger - 日志记录器，用于记录验证过程与结果
 * @returns 验证结果，包含总体 `success` 标志和每个服务的状态数组
 */
export async function validateMigration(
  originalServices: MigrationServiceRegistry,
  migratedServices: MigrationServiceRegistry,
  logger: Logger,
): Promise<{
  success: boolean;
  results: Array<{
    service: string;
    status: 'success' | 'failed' | 'skipped';
    error?: string;
  }>;
}> {
  const results: Array<{
    service: string;
    status: 'success' | 'failed' | 'skipped';
    error?: string;
  }> = [];

  for (const [serviceName, migratedService] of Object.entries(
    migratedServices,
  )) {
    const originalService = originalServices[serviceName];

    if (!originalService || migratedService === originalService) {
      results.push({
        service: serviceName,
        status: 'skipped',
      });
      continue;
    }

    try {
      if (serviceName === 'CollectionService') {
        if (!isCollectionServiceLike(migratedService)) {
          throw new Error('CollectionService 迁移后缺少 listAllCollections 能力');
        }

        await migratedService.listAllCollections();
      } else if (serviceName === 'DocumentService') {
        if (!isDocumentServiceLike(migratedService)) {
          throw new Error('DocumentService 迁移后缺少 listAllDocuments 能力');
        }

        await migratedService.listAllDocuments();
      }

      results.push({
        service: serviceName,
        status: 'success',
      });
    } catch (error) {
      results.push({
        service: serviceName,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const success = results.every((r) => r.status !== 'failed');

  logger.info('迁移验证结果', {
    success,
    results,
  });

  return {
    success,
    results,
  };
}
