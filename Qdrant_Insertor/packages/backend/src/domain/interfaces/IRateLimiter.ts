import { Request } from 'express';

/**
 * 限流结果接口
 */
export interface RateLimitResult {
  /** 是否允许请求通过 */
  allowed: boolean;
  /** 剩余请求次数 */
  remaining: number;
  /** 重置时间戳（毫秒） */
  resetTime: number;
  /** 限流器类型 */
  limiterType: string;
  /** 限流键 */
  key: string;
  /** 当前令牌数 */
  tokens?: number;
  /** 最大令牌数 */
  maxTokens?: number;
  /** 令牌补充速率（每秒） */
  refillRate?: number;
}

/**
 * 限流配置接口
 */
export interface RateLimitConfig {
  /** 限流器类型标识 */
  type: string;
  /** 最大令牌数（突发量） */
  maxTokens: number;
  /** 令牌补充速率（每秒） */
  refillRate: number;
  /** 是否启用 */
  enabled: boolean;
  /** 优先级（数字越小优先级越高） */
  priority: number;
  /** 白名单（不进行限流的键） */
  whitelist?: string[];
  /** 自定义键生成函数 */
  keyGenerator?: (req: Request) => string;
  /** 跳过条件函数 */
  skipCondition?: (req: Request) => boolean;
}

/**
 * 限流器接口
 */
export interface IRateLimiter {
  /**
   * 检查请求是否被允许
   * @param key 限流键
   * @param config 限流配置
   * @returns 限流结果
   */
  checkLimit(key: string, config: RateLimitConfig): RateLimitResult;

  /**
   * 消耗令牌
   * @param key 限流键
   * @param tokens 要消耗的令牌数
   * @param config 限流配置
   * @returns 限流结果
   */
  consumeTokens(
    key: string,
    tokens: number,
    config: RateLimitConfig,
  ): RateLimitResult;

  /**
   * 获取当前状态
   * @param key 限流键
   * @param config 限流配置
   * @returns 限流结果
   */
  getStatus(key: string, config: RateLimitConfig): RateLimitResult;

  /**
   * 重置限流器
   * @param key 限流键
   * @param config 限流配置
   */
  reset(key: string, config: RateLimitConfig): void;

  /**
   * 清理过期的限流器状态
   */
  cleanup(): void;

  /**
   * 获取所有活跃的限流器键
   * @returns 限流键数组
   */
  getActiveKeys(): string[];
}

/**
 * 限流器工厂接口
 */
export interface IRateLimiterFactory {
  /**
   * 创建限流器
   * @param type 限流器类型
   * @returns 限流器实例
   */
  createLimiter(type: string): IRateLimiter;

  /**
   * 获取限流器
   * @param type 限流器类型
   * @returns 限流器实例
   */
  getLimiter(type: string): IRateLimiter;

  /**
   * 注册限流器类型
   * @param type 限流器类型
   * @param factory 限流器工厂函数
   */
  registerLimiterType(type: string, factory: () => IRateLimiter): void;
}

/**
 * 限流策略接口
 */
export interface IRateLimitStrategy {
  /**
   * 获取所有限流配置
   * @returns 限流配置数组
   */
  getConfigs(): RateLimitConfig[];

  /**
   * 添加限流配置
   * @param config 限流配置
   */
  addConfig(config: RateLimitConfig): void;

  /**
   * 移除限流配置
   * @param type 限流器类型
   */
  removeConfig(type: string): void;

  /**
   * 更新限流配置
   * @param type 限流器类型
   * @param config 限流配置
   */
  updateConfig(type: string, config: RateLimitConfig): void;

  /**
   * 获取限流配置
   * @param type 限流器类型
   * @returns 限流配置
   */
  getConfig(type: string): RateLimitConfig | undefined;

  /**
   * 检查请求是否应该被限流
   * @param req Express请求对象
   * @returns 限流结果数组（按优先级排序）
   */
  checkRequest(req: Request): RateLimitResult[];
}

/**
 * 限流指标接口
 */
export interface IRateLimitMetrics {
  /**
   * 记录限流事件
   * @param limiterType 限流器类型
   * @param key 限流键
   * @param allowed 是否允许
   * @param remaining 剩余次数
   */
  recordLimitEvent(
    limiterType: string,
    key: string,
    allowed: boolean,
    remaining: number,
  ): void;

  /**
   * 获取限流统计
   * @param limiterType 限流器类型
   * @param timeRange 时间范围（毫秒）
   * @returns 限流统计数据
   */
  getStatistics(limiterType: string, timeRange: number): RateLimitStatistics;

  /**
   * 获取所有限流器类型的统计
   * @param timeRange 时间范围（毫秒）
   * @returns 限流统计数据映射
   */
  getAllStatistics(timeRange: number): Map<string, RateLimitStatistics>;
}

/**
 * 限流统计数据接口
 */
export interface RateLimitStatistics {
  /** 限流器类型 */
  limiterType: string;
  /** 总请求数 */
  totalRequests: number;
  /** 允许的请求数 */
  allowedRequests: number;
  /** 被拒绝的请求数 */
  rejectedRequests: number;
  /** 允许率 */
  allowRate: number;
  /** 平均剩余令牌数 */
  averageRemaining: number;
  /** 最小剩余令牌数 */
  minRemaining: number;
  /** 最大剩余令牌数 */
  maxRemaining: number;
  /** 统计时间范围 */
  timeRange: number;
  /** 统计开始时间 */
  startTime: number;
  /** 统计结束时间 */
  endTime: number;
}
