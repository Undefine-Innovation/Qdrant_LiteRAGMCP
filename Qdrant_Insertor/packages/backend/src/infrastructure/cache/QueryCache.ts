import { Logger } from '@logging/logger.js';
import {
  ICacheStrategy,
  CacheStrategyFactory,
  CacheConfig,
} from './CacheStrategy.js';

/**
 * 查询缓存配置接口
 */
export interface QueryCacheConfig extends CacheConfig {
  // 是否启用查询缓存
  enabled?: boolean;

  // 缓存键前缀
  keyPrefix?: string;

  // 是否根据参数生成不同的缓存键
  parameterizedKeys?: boolean;

  // 缓存键的最大长度
  maxKeyLength?: number;

  // 哪些操作类型应该被缓存
  cacheableOperations?: string[];

  // 哪些操作类型不应该被缓存
  nonCacheableOperations?: string[];
}

/**
 * 默认查询缓存配置
 */
export const DEFAULT_QUERY_CACHE_CONFIG: QueryCacheConfig = {
  enabled: true,
  keyPrefix: 'query:',
  parameterizedKeys: true,
  maxKeyLength: 250,
  cacheableOperations: ['find', 'findOne', 'count', 'query'],
  nonCacheableOperations: ['create', 'update', 'delete', 'save', 'remove'],
  maxSize: 500,
  defaultTTL: 300000, // 5分钟
  cleanupInterval: 60000, // 1分钟
  enableStats: true,
  evictionPolicy: 'lru',
};

/**
 * 查询缓存管理器
 */
export class QueryCacheManager {
  private cache: ICacheStrategy;
  private config: QueryCacheConfig;

  /**
   * 创建查询缓存管理器实例
   * @param config 缓存配置
   * @param logger 日志记录器
   */
  constructor(
    config: QueryCacheConfig = {},
    private readonly logger?: Logger,
  ) {
    this.config = { ...DEFAULT_QUERY_CACHE_CONFIG, ...config };

    if (this.config.enabled) {
      this.cache = CacheStrategyFactory.create('memory', this.config, logger);
      this.logger?.debug('查询缓存已启用', {
        maxSize: this.config.maxSize,
        defaultTTL: this.config.defaultTTL,
      });
    } else {
      this.logger?.debug('查询缓存已禁用');
    }
  }

  /**
   * 从缓存中获取值
   * @param key 缓存键
   * @returns 缓存的值或null
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    if (!this.config.enabled) return null;
    try {
      const cacheKey = this.buildCacheKey(key);
      const result = await this.cache.get(cacheKey);
      if (result !== null)
        this.logger?.debug('查询缓存命中', { key: cacheKey });
      else this.logger?.debug('查询缓存未命中', { key: cacheKey });
      return result as T | null;
    } catch (error) {
      this.logger?.error('获取查询缓存失败', { key, error });
      return null;
    }
  }

  /**
   * 设置缓存值
   * @param key 缓存键
   * @param value 要缓存的值
   * @param ttl 过期时间（可选）
   */
  async set<T = unknown>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.config.enabled) return;
    try {
      const cacheKey = this.buildCacheKey(key);
      await this.cache.set(cacheKey, value, ttl);
      this.logger?.debug('查询缓存已设置', { key: cacheKey, ttl });
    } catch (error) {
      this.logger?.error('设置查询缓存失败', { key, error });
    }
  }

  /**
   * 删除缓存项
   * @param key 缓存键
   * @returns 是否成功删除
   */
  async delete(key: string): Promise<boolean> {
    if (!this.config.enabled) return false;
    try {
      const cacheKey = this.buildCacheKey(key);
      const result = await this.cache.delete(cacheKey);
      this.logger?.debug('查询缓存已删除', { key: cacheKey, result });
      return result;
    } catch (error) {
      this.logger?.error('删除查询缓存失败', { key, error });
      return false;
    }
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    if (!this.config.enabled) return;
    try {
      await this.cache.clear();
      this.logger?.debug('查询缓存已清空');
    } catch (error) {
      this.logger?.error('清空查询缓存失败', { error });
    }
  }

  /**
   * 检查操作是否可缓存
   * @param operation 操作名称
   * @returns 是否可缓存
   */
  isCacheableOperation(operation: string): boolean {
    if (!this.config.enabled) return false;
    if (this.config.nonCacheableOperations?.includes(operation)) return false;
    const cacheOps: string[] = this.config.cacheableOperations ?? [];
    if (cacheOps.length > 0) return cacheOps.includes(operation);
    return true;
  }

  /**
   * 生成缓存键
   * @param baseKey 基础键
   * @param params 参数对象
   * @returns 生成的缓存键
   */
  generateCacheKey(baseKey: string, params?: Record<string, unknown>): string {
    if (!this.config.parameterizedKeys || !params) return baseKey;
    try {
      const paramString = JSON.stringify(params, Object.keys(params).sort());
      const combinedKey = `${baseKey}:${paramString}`;
      if (
        this.config.maxKeyLength &&
        combinedKey.length > this.config.maxKeyLength
      ) {
        return `${baseKey}:${this.hashString(paramString)}`;
      }
      return combinedKey;
    } catch (error) {
      this.logger?.error('生成缓存键失败', { baseKey, params, error });
      return baseKey;
    }
  }

  /**
   * 获取缓存统计信息
   * @returns 缓存统计信息
   */
  async getStats(): Promise<unknown | null> {
    if (!this.config.enabled) return null;
    try {
      return await this.cache.getStats();
    } catch (error) {
      this.logger?.error('获取查询缓存统计失败', { error });
      return null;
    }
  }

  /**
   * 销毁缓存管理器
   */
  async destroy(): Promise<void> {
    if (this.cache) {
      await this.cache.destroy();
      this.logger?.debug('查询缓存管理器已销毁');
    }
  }

  /**
   * 构建缓存键
   * @param key 原始键
   * @returns 带前缀的缓存键
   */
  private buildCacheKey(key: string): string {
    const prefix = this.config.keyPrefix || '';
    return `${prefix}${key}`;
  }

  /**
   * 字符串哈希函数
   * @param str 要哈希的字符串
   * @returns 哈希值
   */
  private hashString(str: string): string {
    let hash = 0;
    if (str.length === 0) return '0';
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}

/**
 * 查询缓存装饰器
 */
/**
 * 查询缓存装饰器
 * @param options - 缓存选项
 * @param options.ttl - 过期时间
 * @param options.key - 缓存键
 * @param options.condition - 条件函数
 * @param options.invalidateOn - 失效键列表
 * @returns 装饰器工厂函数，返回一个属性描述符修改器
 */
export function QueryCache(
  options: {
    ttl?: number;
    key?: string;
    condition?: (
      this: { queryCacheManager?: QueryCacheManager },
      ...args: unknown[]
    ) => boolean;
    invalidateOn?: string[];
  } = {},
) {
  /**
   * 装饰器函数
   * @param target - 目标对象
   * @param propertyName - 属性名
   * @param descriptor - 属性描述符
   * @returns 修改后的属性描述符
   */
  return function (
    target: unknown,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const method = descriptor.value as (
      ...args: unknown[]
    ) => unknown | Promise<unknown>;

    descriptor.value = async function thisWithCache(
      this: { queryCacheManager?: QueryCacheManager },
      ...args: unknown[]
    ) {
      // 条件判断（若未通过则直接调用原方法）
      if (typeof options.condition === 'function') {
        try {
          const cond = options.condition as (
            this: { queryCacheManager?: QueryCacheManager },
            ...a: unknown[]
          ) => boolean;
          if (!cond.apply(this, args)) {
            return await Promise.resolve(method.apply(this, args));
          }
        } catch (e) {
          // 条件函数异常时降级为直接执行方法
          return await Promise.resolve(method.apply(this, args));
        }
      }

      const cacheManager = this.queryCacheManager;
      if (!cacheManager) return await Promise.resolve(method.apply(this, args));

      const operationName = propertyName;
      if (!cacheManager.isCacheableOperation(operationName))
        return await Promise.resolve(method.apply(this, args));

      const targetName =
        (target as { constructor?: { name?: string } })?.constructor?.name ??
        'Unknown';
      const cacheKey =
        options.key ??
        cacheManager.generateCacheKey(`${targetName}.${operationName}`, {
          args,
        });

      const cachedResult = await cacheManager.get(cacheKey);
      if (cachedResult !== null) return cachedResult;

      const result = await Promise.resolve(method.apply(this, args));

      // 忽略 set 错误，保证主逻辑不受缓存异常影响
      try {
        await cacheManager.set(cacheKey, result, options.ttl);
      } catch (e) {
        // 日志由 cacheManager 负责，故此处静默
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * 缓存失效装饰器
 * @param keys - 要失效的缓存键数组或生成键的函数
 * @returns 装饰器工厂函数，返回一个属性描述符修改器
 */
export function CacheInvalidation(
  keys: string[] | ((...args: unknown[]) => string[]),
) {
  /**
   * 缓存失效装饰器函数
   * @param target - 目标对象
   * @param propertyName - 属性名
   * @param descriptor - 属性描述符
   * @returns 修改后的属性描述符
   */
  return function (
    target: unknown,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const method = descriptor.value as (
      ...args: unknown[]
    ) => unknown | Promise<unknown>;

    descriptor.value = async function thisWithInvalidation(
      this: { queryCacheManager?: QueryCacheManager },
      ...args: unknown[]
    ) {
      const result = await Promise.resolve(method.apply(this, args));

      const cacheManager = this.queryCacheManager;
      if (!cacheManager) return result;

      try {
        const keysToInvalidate =
          typeof keys === 'function'
            ? (keys as (...a: unknown[]) => string[]).apply(this, args)
            : keys;
        for (const key of keysToInvalidate) {
          try {
            await cacheManager.delete(key);
          } catch (e) {
            // 单个 key 删除失败不影响其他 key
          }
        }
      } catch (error) {
        console.error('缓存失效失败', error);
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * Repository基类扩展，添加查询缓存支持
 */
export abstract class CachedRepositoryBase {
  protected queryCacheManager: QueryCacheManager;

  /**
   * 创建缓存Repository基类实例
   * @param logger 日志记录器
   * @param cacheConfig 缓存配置
   */
  constructor(
    protected readonly logger?: Logger,
    cacheConfig?: QueryCacheConfig,
  ) {
    this.queryCacheManager = new QueryCacheManager(cacheConfig, logger);
  }

  /**
   * 销毁Repository
   */
  async destroy(): Promise<void> {
    await this.queryCacheManager.destroy();
  }

  /**
   * 获取缓存统计信息
   * @returns 缓存统计信息
   */
  async getCacheStats() {
    return this.queryCacheManager.getStats();
  }

  /**
   * 清空缓存
   */
  async clearCache(): Promise<void> {
    await this.queryCacheManager.clear();
  }
}
