/**
 * QueryCache Mock TypeScript版本
 * 用于测试环境
 */

export class QueryCacheManager {
  config: unknown;
  logger: unknown;

  constructor(config: unknown, logger: unknown) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * 获取缓存中的值（Mock）
   * @returns 永远返回 null（测试用模拟）
   */
  async get(): Promise<null> {
    return null;
  }

  /**
   * 设置缓存值（Mock）
   * @returns 无
   */
  async set(): Promise<void> {
    // Mock implementation
  }

  /**
   * 删除缓存项（Mock）
   * @returns 是否删除成功（总返回 false）
   */
  async delete(): Promise<boolean> {
    return false;
  }

  /**
   * 清理所有缓存（Mock）
   * @returns 无
   */
  async clear(): Promise<void> {
    // Mock implementation
  }

  /**
   * 检查操作是否可缓存（Mock）
   * @returns 始终返回 false
   */
  isCacheableOperation(): boolean {
    return false;
  }

  /**
   * 生成缓存键（Mock）
   * @param baseKey 基础键
   * @returns 生成的键（测试中直接返回 baseKey）
   */
  generateCacheKey(baseKey: string): string {
    return baseKey;
  }

  /**
   * 获取缓存统计信息（Mock）
   * @returns 统计信息（测试中返回 null）
   */
  async getStats(): Promise<null> {
    return null;
  }

  /**
   * 销毁缓存管理器（Mock）
   * @returns 无
   */
  async destroy(): Promise<void> {
    // Mock implementation
  }
}

export class CachedRepositoryBase {
  logger: unknown;
  cacheConfig: unknown;
  queryCacheManager: QueryCacheManager;

  constructor(logger: unknown, cacheConfig: unknown) {
    this.logger = logger;
    this.cacheConfig = cacheConfig;
    this.queryCacheManager = new QueryCacheManager(cacheConfig, logger);
  }

  async destroy(): Promise<void> {
    await this.queryCacheManager.destroy();
  }

  async getCacheStats(): Promise<null> {
    return this.queryCacheManager.getStats();
  }

  async clearCache(): Promise<void> {
    await this.queryCacheManager.clear();
  }
}

/**
 * 装饰器工厂：标记方法应使用查询缓存（Mock 实现）
 * 在测试环境中该装饰器不执行实际缓存逻辑，仅作为标记存在，便于测试替换。
 *
 * @returns 装饰器函数，接收目标、方法名和描述符并返回不变的描述符
 */
export function QueryCache(): (
  target: unknown,
  propertyName: string,
  descriptor: PropertyDescriptor,
) => PropertyDescriptor {
  /**
   * 装饰器（Mock）：标记方法应使用查询缓存（测试环境无实际缓存行为）
   * @param target 装饰器目标对象
   * @param propertyName 被装饰的方法名
   * @param descriptor 方法描述符
   * @returns 传回方法描述符，不做修改
   */
  return function (
    target: unknown,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    return descriptor;
  };
}

/**
 * 装饰器工厂：标记方法为缓存失效操作（Mock 实现）
 * 在测试环境中该装饰器不执行实际失效逻辑，仅保留签名以匹配真实实现。
 *
 * @returns 装饰器函数，接收目标、方法名和描述符并返回不变的描述符
 */
export function CacheInvalidation(): (
  target: unknown,
  propertyName: string,
  descriptor: PropertyDescriptor,
) => PropertyDescriptor {
  /**
   * 装饰器（Mock）：用于标记缓存失效操作（测试环境不执行实际失效）
   * @param target 装饰器目标对象
   * @param propertyName 被装饰的方法名
   * @param descriptor 方法描述符
   * @returns 传回方法描述符，不做修改
   */
  return function (
    target: unknown,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    return descriptor;
  };
}
