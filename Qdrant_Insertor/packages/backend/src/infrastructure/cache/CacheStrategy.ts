import { Logger } from '@logging/logger.js';

/**
 * 缓存项接口
 */
export interface CacheItem<T = unknown> {
  key: string;
  value: T;
  expiresAt: number;
  createdAt: number;
  accessCount: number;
  lastAccessedAt: number;
  metadata?: Record<string, unknown>;
}

/**
 * 缓存配置接口
 */
export interface CacheConfig {
  // 缓存大小限制
  maxSize?: number;

  // 默认过期时间（毫秒）
  defaultTTL?: number;

  // 清理间隔（毫秒）
  cleanupInterval?: number;

  // 是否启用统计
  enableStats?: boolean;

  // 缓存策略
  evictionPolicy?: 'lru' | 'lfu' | 'ttl' | 'random';

  // 序列化选项
  enableCompression?: boolean;
  enableEncryption?: boolean;
  encryptionKey?: string;
}

/**
 * 缓存统计接口
 */
export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  currentSize: number;
  maxSize: number;
  hitRate: number;
  averageAccessTime: number;
  memoryUsage: number;
}

/**
 * 默认缓存配置
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxSize: 1000,
  defaultTTL: 300000, // 5分钟
  cleanupInterval: 60000, // 1分钟
  enableStats: true,
  evictionPolicy: 'lru',
  enableCompression: false,
  enableEncryption: false,
};

/**
 * 内存缓存实现
 */
export class MemoryCache<T = unknown> {
  private cache: Map<string, CacheItem<T>> = new Map();
  private accessOrder: string[] = [];
  private cleanupTimer: NodeJS.Timeout | null = null;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    currentSize: 0,
    maxSize: 0,
    hitRate: 0,
    averageAccessTime: 0,
    memoryUsage: 0,
  };
  private accessTimes: number[] = [];

  /**
   * 创建内存缓存实例
   * @param config - 缓存配置
   * @param logger - 日志记录器
   */
  constructor(
    private readonly config: CacheConfig = {},
    private readonly logger?: Logger,
  ) {
    const finalConfig = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.config = finalConfig;
    this.stats.maxSize = finalConfig.maxSize || 0;

    // 启动清理定时器
    if (finalConfig.cleanupInterval && finalConfig.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(
        () => this.cleanup(),
        finalConfig.cleanupInterval,
      );
    }

    this.logger?.debug('内存缓存已初始化', {
      maxSize: this.config.maxSize,
      defaultTTL: this.config.defaultTTL,
      evictionPolicy: this.config.evictionPolicy,
    });
  }

  /**
   * 获取缓存项
   * @param key 缓存键
   * @returns 缓存值或null
   */
  get(key: string): T | null {
    const startTime = Date.now();

    try {
      const item = this.cache.get(key);

      if (!item) {
        this.stats.misses++;
        this.updateHitRate();
        this.logger?.debug('缓存未命中', { key });
        return null;
      }

      // 检查是否过期
      if (this.isExpired(item)) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        this.stats.misses++;
        this.stats.evictions++;
        this.updateHitRate();
        this.logger?.debug('缓存项已过期', { key });
        return null;
      }

      // 更新访问信息
      item.accessCount++;
      item.lastAccessedAt = Date.now();
      this.updateAccessOrder(key);

      this.stats.hits++;
      this.updateHitRate();
      this.recordAccessTime(Date.now() - startTime);

      this.logger?.debug('缓存命中', { key, accessCount: item.accessCount });
      return item.value;
    } catch (error) {
      this.logger?.error('获取缓存项失败', { key, error });
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }
  }

  /**
   * 设置缓存项
   * @param key 缓存键
   * @param value 缓存值
   * @param ttl 过期时间（毫秒），可选
   * @param metadata 元数据，可选
   */
  set(
    key: string,
    value: T,
    ttl?: number,
    metadata?: Record<string, unknown>,
  ): void {
    try {
      const now = Date.now();
      const expiresAt = ttl ? now + ttl : now + (this.config.defaultTTL || 0);

      // 检查是否需要驱逐项
      if (
        this.cache.size >= (this.config.maxSize || 0) &&
        !this.cache.has(key)
      ) {
        this.evict();
      }

      const item: CacheItem<T> = {
        key,
        value: this.processValue(value, 'serialize'),
        expiresAt,
        createdAt: now,
        accessCount: 0,
        lastAccessedAt: now,
        metadata,
      };

      this.cache.set(key, item);
      this.updateAccessOrder(key);
      this.stats.sets++;
      this.stats.currentSize = this.cache.size;

      this.logger?.debug('缓存项已设置', { key, ttl, expiresAt });
    } catch (error) {
      this.logger?.error('设置缓存项失败', { key, error });
    }
  }

  /**
   * 删除缓存项
   * @param key 缓存键
   * @returns 是否删除成功
   */
  delete(key: string): boolean {
    try {
      const deleted = this.cache.delete(key);
      if (deleted) {
        this.removeFromAccessOrder(key);
        this.stats.deletes++;
        this.stats.currentSize = this.cache.size;
        this.logger?.debug('缓存项已删除', { key });
      }
      return deleted;
    } catch (error) {
      this.logger?.error('删除缓存项失败', { key, error });
      return false;
    }
  }

  /**
   * 检查缓存项是否存在
   * @param key 缓存键
   * @returns 是否存在
   */
  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) {
      return false;
    }

    // 检查是否过期
    if (this.isExpired(item)) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.stats.evictions++;
      this.stats.currentSize = this.cache.size;
      return false;
    }

    return true;
  }

  /**
   * 清空缓存
   */
  clear(): void {
    try {
      this.cache.clear();
      this.accessOrder = [];
      this.stats.currentSize = 0;
      this.logger?.debug('缓存已清空');
    } catch (error) {
      this.logger?.error('清空缓存失败', { error });
    }
  }

  /**
   * 获取缓存大小
   * @returns 缓存项数量
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 获取所有缓存键
   * @returns 缓存键数组
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * 获取缓存统计信息
   * @returns 缓存统计
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 清理过期项
   */
  cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, item] of this.cache.entries()) {
      if (this.isExpired(item)) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        cleanedCount++;
      }
    }

    this.stats.currentSize = this.cache.size;
    this.stats.evictions += cleanedCount;

    if (cleanedCount > 0) {
      this.logger?.debug('清理过期缓存项', { count: cleanedCount });
    }
  }

  /**
   * 销毁缓存
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.clear();
    this.logger?.debug('缓存已销毁');
  }

  /**
   * 检查项是否过期
   * @param item 缓存项
   * @returns 是否过期
   */
  private isExpired(item: CacheItem<T>): boolean {
    return Date.now() > item.expiresAt;
  }

  /**
   * 更新访问顺序
   * @param key 缓存键
   */
  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  /**
   * 从访问顺序中移除键
   * @param key 缓存键
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * 驱逐缓存项
   */
  private evict(): void {
    if (this.accessOrder.length === 0) {
      return;
    }

    let keyToEvict: string;

    switch (this.config.evictionPolicy) {
      case 'lru':
        // 最近最少使用
        keyToEvict = this.accessOrder[0];
        break;
      case 'lfu':
        // 最少使用频率
        keyToEvict = this.findLFUKey();
        break;
      case 'ttl':
        // 最先过期
        keyToEvict = this.findSoonestToExpire();
        break;
      case 'random': {
        // 随机
        const randomIndex = Math.floor(Math.random() * this.accessOrder.length);
        keyToEvict = this.accessOrder[randomIndex];
        break;
      }
      default:
        keyToEvict = this.accessOrder[0];
    }

    if (keyToEvict) {
      this.cache.delete(keyToEvict);
      this.removeFromAccessOrder(keyToEvict);
      this.stats.evictions++;
      this.stats.currentSize = this.cache.size;
      this.logger?.debug('驱逐缓存项', {
        key: keyToEvict,
        policy: this.config.evictionPolicy,
      });
    }
  }

  /**
   * 查找最少使用频率的键
   * @returns LFU键
   */
  private findLFUKey(): string {
    let lfuKey = this.accessOrder[0];
    let minAccessCount = Infinity;

    for (const key of this.accessOrder) {
      const item = this.cache.get(key);
      if (item && item.accessCount < minAccessCount) {
        minAccessCount = item.accessCount;
        lfuKey = key;
      }
    }

    return lfuKey;
  }

  /**
   * 查找最先过期的键
   * @returns 最先过期的键
   */
  private findSoonestToExpire(): string {
    let soonestKey = this.accessOrder[0];
    let soonestExpiry = Infinity;

    for (const key of this.accessOrder) {
      const item = this.cache.get(key);
      if (item && item.expiresAt < soonestExpiry) {
        soonestExpiry = item.expiresAt;
        soonestKey = key;
      }
    }

    return soonestKey;
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * 记录访问时间
   * @param accessTime 访问时间
   */
  private recordAccessTime(accessTime: number): void {
    this.accessTimes.push(accessTime);

    // 保持最近1000次访问时间
    if (this.accessTimes.length > 1000) {
      this.accessTimes.shift();
    }

    // 计算平均访问时间
    this.stats.averageAccessTime =
      this.accessTimes.reduce((sum, time) => sum + time, 0) /
      this.accessTimes.length;
  }

  /**
   * 处理值（序列化/反序列化、压缩、加密）
   * @param value 值
   * @param operation 操作类型
   * @returns 处理后的值
   */
  private processValue(value: T, operation: 'serialize' | 'deserialize'): T {
    // 这里可以实现序列化、压缩、加密等逻辑
    // 目前简单返回原值
    return value;
  }
}

/**
 * 缓存策略接口
 */
export interface ICacheStrategy<T = unknown> {
  get(key: string): Promise<T | null>;
  set(
    key: string,
    value: T,
    ttl?: number,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
  size(): Promise<number>;
  keys(): Promise<string[]>;
  getStats(): Promise<CacheStats>;
  destroy(): Promise<void>;
}

/**
 * 内存缓存策略实现
 */
export class MemoryCacheStrategy<T = unknown> implements ICacheStrategy<T> {
  private cache: MemoryCache<T>;

  /**
   * 创建内存缓存策略实例
   * @param config - 缓存配置
   * @param logger - 日志记录器
   */
  constructor(
    config?: CacheConfig,
    private readonly logger?: Logger,
  ) {
    this.cache = new MemoryCache<T>(config, logger);
  }

  /**
   * 获取缓存项
   * @param key - 缓存键
   * @returns 缓存值或null
   */
  async get(key: string): Promise<T | null> {
    return this.cache.get(key);
  }

  /**
   * 设置缓存项
   * @param key - 缓存键
   * @param value - 缓存值
   * @param ttl - 过期时间
   * @param metadata - 元数据
   */
  async set(
    key: string,
    value: T,
    ttl?: number,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    this.cache.set(key, value, ttl, metadata);
  }

  /**
   * 删除缓存项
   * @param key - 缓存键
   * @returns 是否删除成功
   */
  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  /**
   * 检查缓存项是否存在
   * @param key - 缓存键
   * @returns 是否存在
   */
  async has(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  /**
   * 清空缓存
   */
  async clear(): Promise<void> {
    this.cache.clear();
  }

  /**
   * 获取缓存大小
   * @returns 缓存项数量
   */
  async size(): Promise<number> {
    return this.cache.size();
  }

  /**
   * 获取所有缓存键
   * @returns 缓存键数组
   */
  async keys(): Promise<string[]> {
    return this.cache.keys();
  }

  /**
   * 获取缓存统计信息
   * @returns 缓存统计
   */
  async getStats(): Promise<CacheStats> {
    return this.cache.getStats();
  }

  /**
   * 销毁缓存
   */
  async destroy(): Promise<void> {
    this.cache.destroy();
  }
}

/**
 * Redis缓存策略实现（占位符）
 */
export class RedisCacheStrategy<T = unknown> implements ICacheStrategy<T> {
  /**
   * 创建Redis缓存策略实例
   * @param config - 缓存配置
   * @param logger - 日志记录器
   */
  constructor(
    private readonly config: CacheConfig,
    private readonly logger?: Logger,
  ) {
    this.logger?.warn('Redis缓存策略尚未实现，使用内存缓存作为后备');
  }

  /**
   * 获取缓存项
   * @param key - 缓存键
   * @returns 缓存值或null
   */
  async get(key: string): Promise<T | null> {
    // TODO: 实现Redis获取逻辑
    return null;
  }

  /**
   * 设置缓存项
   * @param key - 缓存键
   * @param value - 缓存值
   * @param ttl - 过期时间
   * @param metadata - 元数据
   */
  async set(
    key: string,
    value: T,
    ttl?: number,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    // TODO: 实现Redis设置逻辑
  }

  /**
   * 删除缓存项
   * @param key - 缓存键
   * @returns 是否删除成功
   */
  async delete(key: string): Promise<boolean> {
    // TODO: 实现Redis删除逻辑
    return false;
  }

  /**
   * 检查缓存项是否存在
   * @param key - 缓存键
   * @returns 是否存在
   */
  async has(key: string): Promise<boolean> {
    // TODO: 实现Redis存在检查逻辑
    return false;
  }

  /**
   * 清空缓存
   */
  async clear(): Promise<void> {
    // TODO: 实现Redis清空逻辑
  }

  /**
   * 获取缓存大小
   * @returns 缓存项数量
   */
  async size(): Promise<number> {
    // TODO: 实现Redis大小获取逻辑
    return 0;
  }

  /**
   * 获取所有缓存键
   * @returns 缓存键数组
   */
  async keys(): Promise<string[]> {
    // TODO: 实现Redis键获取逻辑
    return [];
  }

  /**
   * 获取缓存统计信息
   * @returns 缓存统计
   */
  async getStats(): Promise<CacheStats> {
    // TODO: 实现Redis统计获取逻辑
    return {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      currentSize: 0,
      maxSize: 0,
      hitRate: 0,
      averageAccessTime: 0,
      memoryUsage: 0,
    };
  }

  /**
   * 销毁缓存
   */
  async destroy(): Promise<void> {
    // TODO: 实现Redis销毁逻辑
  }
}

/**
 * 缓存策略工厂
 */
export class CacheStrategyFactory {
  /**
   * 创建缓存策略
   * @param type 缓存类型
   * @param config 缓存配置
   * @param logger 日志记录器
   * @returns 缓存策略实例
   */
  /**
   * 创建缓存策略
   * @param type - 缓存类型
   * @param config - 缓存配置
   * @param logger - 日志记录器
   * @returns 缓存策略实例
   */
  static create<T = unknown>(
    type: 'memory' | 'redis',
    config?: CacheConfig,
    logger?: Logger,
  ): ICacheStrategy<T> {
    switch (type) {
      case 'memory':
        return new MemoryCacheStrategy<T>(config, logger);
      case 'redis':
        return new RedisCacheStrategy<T>(config || {}, logger);
      default:
        logger?.warn(`未知的缓存类型: ${type}，使用内存缓存作为后备`);
        return new MemoryCacheStrategy<T>(config, logger);
    }
  }
}
