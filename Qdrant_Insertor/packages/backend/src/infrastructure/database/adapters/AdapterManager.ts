import { Logger } from '@infrastructure/logging/logger.js';
import {
  DatabaseHealthStatus,
  DatabasePerformanceMetrics,
  DatabaseType,
} from '@domain/interfaces/IDatabaseRepository.js';
import { IRepositoryAdapter } from './IRepositoryAdapter.js';
import { AdapterFactoryCore } from './AdapterFactoryCore.js';

/**
 * 适配器管理器
 * 提供适配器的生命周期管理和监控
 */
export class AdapterManager {
  private adapters = new Map<string, IRepositoryAdapter<unknown>>();
  private factory: AdapterFactoryCore;
  private logger: Logger;

  /**
   * 创建适配器管理器实例
   * @param factory 适配器工厂核心实例
   * @param logger 日志记录器
   */
  constructor(factory: AdapterFactoryCore, logger: Logger) {
    this.factory = factory;
    this.logger = logger;
  }

  /**
   * 将宽松的 LoggerLike 适配为严格的 Logger 接口，缺失的方法会降级为 no-op。
   * @param like 宽松的 LoggerLike 实例
   * @returns 一个符合 `Logger` 接口的适配器对象
   */
  private createSafeLogger(like: Logger): Logger {
    return {
      debug: (message: string, ...args: unknown[]) =>
        like.debug ? like.debug(message, ...args) : undefined,
      info: (message: string, ...args: unknown[]) =>
        like.info ? like.info(message, ...args) : undefined,
      warn: (message: string, ...args: unknown[]) =>
        like.warn ? like.warn(message, ...args) : undefined,
      error: (message: string, ...args: unknown[]) =>
        like.error ? like.error(message, ...args) : undefined,
    };
  }

  /**
   * 注册适配器
   * @param name 适配器名称
   * @param adapter 适配器实例
   */
  registerAdapter(name: string, adapter: IRepositoryAdapter<unknown>): void {
    this.adapters.set(name, adapter);
    this.logger?.info?.(`注册适配器`, {
      name,
      databaseType: adapter.databaseType,
    });
  }

  /**
   * 获取适配器
   * @param name 适配器名称
   * @returns 适配器实例
   */
  getAdapter(name: string): IRepositoryAdapter<unknown> | undefined {
    return this.adapters.get(name);
  }

  /**
   * 初始化所有适配器
   */
  async initializeAll(): Promise<void> {
    const initPromises = Array.from(this.adapters.entries()).map(
      async ([name, adapter]) => {
          try {
          await adapter.initialize(this.createSafeLogger(this.logger));
          this.logger?.info?.(`适配器初始化成功`, { name });
        } catch (error) {
          this.logger?.error?.(`适配器初始化失败`, {
            name,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );

    await Promise.all(initPromises);
  }

  /**
   * 关闭所有适配器
   */
  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.adapters.entries()).map(
      async ([name, adapter]) => {
        try {
          await adapter.close();
          this.logger?.info?.(`适配器关闭成功`, { name });
        } catch (error) {
          this.logger?.error?.(`适配器关闭失败`, {
            name,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );

    await Promise.all(closePromises);
    this.adapters.clear();
  }

  /**
   * 获取所有适配器的健康状态
   * @returns 健康状态映射
   */
  async getHealthStatuses(): Promise<Map<string, DatabaseHealthStatus | { status: 'error'; error: string }>> {
    const healthStatuses = new Map<string, DatabaseHealthStatus | { status: 'error'; error: string }>();

    for (const [name, adapter] of this.adapters) {
      try {
        const healthStatus = await adapter.getHealthStatus();
        healthStatuses.set(name, healthStatus);
      } catch (error) {
        healthStatuses.set(name, {
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return healthStatuses;
  }

  /**
   * 获取所有适配器的性能指标
   * @returns 性能指标映射
   */
  async getPerformanceMetrics(): Promise<Map<string, DatabasePerformanceMetrics>> {
    const metrics = new Map<string, DatabasePerformanceMetrics>();

    for (const [name, adapter] of this.adapters) {
      try {
        const performanceMetrics = await adapter.getPerformanceMetrics();
        metrics.set(name, performanceMetrics);
      } catch (error) {
        this.logger?.error?.(`获取适配器性能指标失败`, {
          name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return metrics;
  }

  /**
   * 获取适配器统计信息
   * @returns 统计信息
   */
  getStats(): {
    totalAdapters: number;
    adaptersByType: Record<string, number>;
    adapterNames: string[];
  } {
    const adaptersByType: Record<string, number> = {};
    const adapterNames: string[] = [];

    for (const [name, adapter] of this.adapters) {
      adapterNames.push(name);
      const type = adapter.databaseType;
      adaptersByType[type] = (adaptersByType[type] || 0) + 1;
    }

    return {
      totalAdapters: this.adapters.size,
      adaptersByType,
      adapterNames,
    };
  }

  /**
   * 移除适配器
   * @param name 适配器名称
   * @returns 是否成功移除
   */
  removeAdapter(name: string): boolean {
    const removed = this.adapters.delete(name);
    if (removed) {
      this.logger?.info?.(`移除适配器`, { name });
    }
    return removed;
  }

  /**
   * 检查适配器是否存在
   * @param name 适配器名称
   * @returns 是否存在
   */
  hasAdapter(name: string): boolean {
    return this.adapters.has(name);
  }

  /**
   * 获取所有适配器名称
   * @returns 适配器名称数组
   */
  getAdapterNames(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * 获取指定类型的适配器
   * @param databaseType 数据库类型
   * @returns 适配器数组
   */
  getAdaptersByType(databaseType: DatabaseType): IRepositoryAdapter<unknown>[] {
    return Array.from(this.adapters.values()).filter(
      (adapter) => adapter.databaseType === databaseType,
    ) as IRepositoryAdapter<unknown>[];
  }

  /**
   * 重新初始化指定适配器
   * @param name 适配器名称
   * @returns 是否成功重新初始化
   */
  async reinitializeAdapter(name: string): Promise<boolean> {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      this.logger?.warn?.(`适配器不存在，无法重新初始化`, { name });
      return false;
    }

    try {
    await adapter.close();
    await adapter.initialize(this.createSafeLogger(this.logger));
      this.logger?.info?.(`适配器重新初始化成功`, { name });
      return true;
    } catch (error) {
      this.logger?.error?.(`适配器重新初始化失败`, {
        name,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}
