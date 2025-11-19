import { Request } from 'express';
import {
  IRateLimiter,
  IRateLimiterFactory,
  IRateLimitStrategy,
  RateLimitConfig,
  RateLimitResult,
} from '@domain/interfaces/IRateLimiter.js';
import { TokenBucketRateLimiter } from './TokenBucketRateLimiter.js';
import { Logger } from '@infrastructure/logging/logger.js';

/**
 * 限流器工厂实现
 */
export class RateLimiterFactory implements IRateLimiterFactory {
  /** 限流器类型注册表 */
  private readonly limiterTypes = new Map<string, () => IRateLimiter>();
  /** 限流器实例缓存 */
  private readonly limiterInstances = new Map<string, IRateLimiter>();

  constructor(private readonly logger?: Logger) {
    // 注册默认的令牌桶限流器
    this.registerLimiterType(
      'token-bucket',
      () => new TokenBucketRateLimiter(logger),
    );
  }

  /**
   * 创建限流器
   * @param type 限流器类型
   * @returns 限流器实例
   */
  public createLimiter(type: string): IRateLimiter {
    const factory = this.limiterTypes.get(type);
    if (!factory) {
      throw new Error(`未知的限流器类型: ${type}`);
    }
    return factory();
  }

  /**
   * 获取限流器（单例模式）
   * @param type 限流器类型
   * @returns 限流器实例
   */
  public getLimiter(type: string): IRateLimiter {
    let limiter = this.limiterInstances.get(type);
    if (!limiter) {
      limiter = this.createLimiter(type);
      this.limiterInstances.set(type, limiter);
    }
    return limiter;
  }

  /**
   * 注册限流器类型
   * @param type 限流器类型
   * @param factory 限流器工厂函数
   */
  public registerLimiterType(type: string, factory: () => IRateLimiter): void {
    if (this.limiterTypes.has(type)) {
      this.logger?.warn('限流器类型已存在，将被覆盖', { type });
    }
    this.limiterTypes.set(type, factory);
    this.logger?.debug('注册限流器类型', { type });
  }

  /**
   * 获取已注册的限流器类型
   * @returns 限流器类型数组
   */
  public getRegisteredTypes(): string[] {
    return Array.from(this.limiterTypes.keys());
  }
}

/**
 * 多级限流策略实现
 *
 * 支持多种限流策略的组合：
 * - 全局限流
 * - IP限流
 * - 用户限流
 * - 路径限流
 * - 自定义限流
 */
export class RateLimitStrategy implements IRateLimitStrategy {
  /** 限流配置列表 */
  private configs: RateLimitConfig[] = [];
  /** 限流器工厂 */
  private readonly limiterFactory: IRateLimiterFactory;

  constructor(
    limiterFactory: IRateLimiterFactory,
    private readonly logger?: Logger,
  ) {
    this.limiterFactory = limiterFactory;
    this.initializeDefaultConfigs();
  }

  /**
   * 获取所有限流配置
   * @returns 限流配置数组
   */
  public getConfigs(): RateLimitConfig[] {
    return [...this.configs];
  }

  /**
   * 添加限流配置
   * @param config 限流配置
   */
  public addConfig(config: RateLimitConfig): void {
    // 检查是否已存在相同类型的配置
    const existingIndex = this.configs.findIndex((c) => c.type === config.type);
    if (existingIndex >= 0) {
      this.configs[existingIndex] = config;
      this.logger?.info('更新限流配置', { type: config.type });
    } else {
      this.configs.push(config);
      this.logger?.info('添加限流配置', { type: config.type });
    }

    // 按优先级排序
    this.configs.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 移除限流配置
   * @param type 限流器类型
   */
  public removeConfig(type: string): void {
    const index = this.configs.findIndex((c) => c.type === type);
    if (index >= 0) {
      this.configs.splice(index, 1);
      this.logger?.info('移除限流配置', { type });
    }
  }

  /**
   * 更新限流配置
   * @param type 限流器类型
   * @param config 限流配置
   */
  public updateConfig(type: string, config: RateLimitConfig): void {
    const index = this.configs.findIndex((c) => c.type === type);
    if (index >= 0) {
      this.configs[index] = { ...config, type };
      this.logger?.info('更新限流配置', { type });
    } else {
      this.addConfig({ ...config, type });
    }
  }

  /**
   * 获取限流配置
   * @param type 限流器类型
   * @returns 限流配置
   */
  public getConfig(type: string): RateLimitConfig | undefined {
    return this.configs.find((c) => c.type === type);
  }

  /**
   * 检查请求是否应该被限流
   * @param req Express请求对象
   * @returns 限流结果数组（按优先级排序）
   */
  public checkRequest(req: Request): RateLimitResult[] {
    const results: RateLimitResult[] = [];

    for (const config of this.configs) {
      // 检查跳过条件（skipCondition 可基于请求动态判断）
      if (config.skipCondition && config.skipCondition(req)) {
        this.logger?.debug('跳过限流检查', {
          limiterType: config.type,
          url: req.url,
          method: req.method,
        });
        continue;
      }

      // 生成限流键
      const key = this.generateKey(req, config);

      // 检查白名单
      if (config.whitelist && config.whitelist.includes(key)) {
        this.logger?.debug('请求在白名单中，跳过限流', {
          limiterType: config.type,
          key,
          url: req.url,
        });
        continue;
      }

      // 执行限流检查（限流器内部会处理 disabled/config.enabled 的情况）
      const limiter = this.limiterFactory.getLimiter('token-bucket');
      const result = limiter.checkLimit(key, config);
      results.push(result);

      this.logger?.debug('限流检查完成', {
        limiterType: config.type,
        key,
        allowed: result.allowed,
        remaining: result.remaining,
        url: req.url,
        method: req.method,
      });
    }

    return results;
  }

  /**
   * 初始化默认限流配置
   */
  private initializeDefaultConfigs(): void {
    // 全局限流配置
    this.addConfig({
      type: 'global',
      maxTokens: 1000,
      refillRate: 100,
      enabled: true,
      priority: 1,
      keyGenerator: () => 'global',
    });

    // IP限流配置
    this.addConfig({
      type: 'ip',
      maxTokens: 100,
      refillRate: 10,
      enabled: true,
      priority: 2,
      keyGenerator: (req) => this.getClientIP(req),
    });

    // 用户限流配置（如果有用户认证）
    this.addConfig({
      type: 'user',
      maxTokens: 200,
      refillRate: 20,
      enabled: true,
      priority: 3,
      keyGenerator: (req) => this.getUserId(req) || this.getClientIP(req),
    });

    // 路径限流配置
    this.addConfig({
      type: 'path',
      maxTokens: 50,
      refillRate: 5,
      enabled: true,
      priority: 4,
      keyGenerator: (req) => `${req.method}:${req.path}`,
    });

    // 搜索API特殊限流
    this.addConfig({
      type: 'search',
      maxTokens: 30,
      refillRate: 3,
      enabled: true,
      priority: 5,
      keyGenerator: (req) => `search:${this.getClientIP(req)}`,
      skipCondition: (req) => !req.path?.startsWith('/search'),
    });

    // 上传API特殊限流
    this.addConfig({
      type: 'upload',
      maxTokens: 10,
      refillRate: 1,
      enabled: true,
      priority: 6,
      keyGenerator: (req) => `upload:${this.getClientIP(req)}`,
      skipCondition: (req) => !req.path?.includes('/upload'),
    });

    this.logger?.info('默认限流配置已初始化', {
      configCount: this.configs.length,
      configTypes: this.configs.map((c) => c.type),
    });
  }

  /**
   * 生成限流键
   * @param req Express请求对象
   * @param config 限流配置
   * @returns 限流键
   */
  private generateKey(req: Request, config: RateLimitConfig): string {
    if (config.keyGenerator) {
      return config.keyGenerator(req);
    }

    // 默认键生成策略
    return `${config.type}:${this.getClientIP(req)}`;
  }

  /**
   * 获取客户端IP地址
   * @param req Express请求对象
   * @returns IP地址
   */
  private getClientIP(req: Request): string {
    // 防守性读取 headers，测试中可能传入 undefined
    const headers = (req && (req.headers as Record<string, unknown>)) || {};
    const rawXff = headers['x-forwarded-for'];
    const xff = typeof rawXff === 'string' ? rawXff : undefined;
    const rawXReal = headers['x-real-ip'];
    const xRealIp = typeof rawXReal === 'string' ? rawXReal : undefined;

    const forwarded = xff ? xff.split(',')[0].trim() : undefined;

    return (
      forwarded ||
      xRealIp ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      req.ip ||
      'unknown'
    );
  }

  /**
   * 获取用户ID
   * @param req Express请求对象
   * @returns 用户ID或null
   */
  private getUserId(req: Request): string | null {
    // 尝试从不同位置获取用户ID
    const r = req as unknown as {
      user?: { id?: string };
      userId?: string;
    } & Request;

    const headers = (req && (req.headers as Record<string, unknown>)) || {};
    const rawXUserId = headers['x-user-id'];
    const xUserId = typeof rawXUserId === 'string' ? rawXUserId : undefined;
    const rawUserIdHeader = headers['user-id'];
    const userIdHeader = typeof rawUserIdHeader === 'string' ? rawUserIdHeader : undefined;

    return r.user?.id || r.userId || xUserId || userIdHeader || null;
  }
}
