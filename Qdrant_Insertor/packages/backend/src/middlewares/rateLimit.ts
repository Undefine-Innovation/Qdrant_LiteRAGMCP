import { Request, Response, NextFunction } from 'express';
import {
  IRateLimitStrategy,
  RateLimitResult,
} from '@domain/interfaces/IRateLimiter.js';
import { AppError, ErrorCode } from '@api/contracts/error.js';
import { LoggedRequest } from './logging.js';

/**
 * 限流中间件配置接口
 */
export interface RateLimitMiddlewareConfig {
  /** 限流策略 */
  strategy: IRateLimitStrategy;
  /** 是否在响应头中包含限流信息 */
  includeHeaders?: boolean;
  /** 自定义错误消息 */
  errorMessage?: string;
  /** 是否记录限流事件 */
  logEvents?: boolean;
  /** 是否跳过成功的请求（只记录被限流的请求） */
  logOnlyBlocked?: boolean;
  /** 是否跳过健康检查端点的限流 */
  skipHealthCheck?: boolean;
  /** 是否跳过OPTIONS请求的限流 */
  skipOptions?: boolean;
}

/**
 * 扩展Express Request接口，添加限流相关属性
 */
export interface RateLimitedRequest extends LoggedRequest {
  /** 限流检查结果 */
  rateLimitResults?: RateLimitResult[];
  /** 是否被限流 */
  rateLimited?: boolean;
}

/**
 * 创建限流中间件
 *
 * 该中间件会：
 * 1. 执行多级限流检查
 * 2. 记录限流事件
 * 3. 在响应头中添加限流信息
 * 4. 对被限流的请求返回429状态码
 *
 * @param config 中间件配置
 * @returns Express中间件函数
 */
export function createRateLimitMiddleware(config: RateLimitMiddlewareConfig) {
  const {
    strategy,
    includeHeaders = true,
    errorMessage = '请求过于频繁，请稍后再试',
    logEvents = true,
    logOnlyBlocked = false,
    skipHealthCheck = true,
    skipOptions = true,
  } = config;

  return (req: RateLimitedRequest, res: Response, next: NextFunction) => {
    // 检查是否应该跳过限流
    if (shouldSkipRateLimit(req, skipHealthCheck, skipOptions)) {
      return next();
    }
    try {
      // 执行限流检查
      const results = strategy.checkRequest(req);
      req.rateLimitResults = results;

      // 检查是否有任何限流器拒绝请求
      const blockedResults = results.filter((result) => !result.allowed);
      req.rateLimited = blockedResults.length > 0;

      // 记录限流事件
      if (logEvents && (!logOnlyBlocked || req.rateLimited)) {
        logRateLimitEvent(req, results);
      }

      // 如果请求被限流，返回429状态码
      if (req.rateLimited) {
        const primaryBlock = blockedResults[0]; // 使用第一个被限流的结果作为主要信息

        // 设置响应头
        if (includeHeaders) {
          setRateLimitHeaders(res, results);
        }

        // 记录限流日志
        req.logger?.warn('请求被限流', undefined, {
          url: req.url,
          method: req.method,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          blockedBy: primaryBlock.limiterType,
          key: primaryBlock.key,
          remaining: primaryBlock.remaining,
          resetTime: new Date(primaryBlock.resetTime).toISOString(),
          allResults: results.map((r) => ({
            limiterType: r.limiterType,
            allowed: r.allowed,
            remaining: r.remaining,
            key: r.key,
          })),
        });

        return next(
          new AppError('RATE_LIMIT_EXCEEDED', errorMessage, 429, {
            retryAfter: Math.ceil((primaryBlock.resetTime - Date.now()) / 1000),
            limitType: primaryBlock.limiterType,
            resetTime: new Date(primaryBlock.resetTime).toISOString(),
          }),
        );
      }

      // 设置响应头（即使请求未被限流）
      if (includeHeaders) {
        setRateLimitHeaders(res, results);
      }

      next();
    } catch (error) {
      // 如果限流中间件出错，记录错误但允许请求通过
      req.logger?.error('限流中间件错误', undefined, {
        error: (error as Error).message,
        stack: (error as Error).stack,
        url: req.url,
        method: req.method,
      });

      // 在生产环境中，限流失败不应该影响正常请求
      next();
    }
  };
}

/**
 * 设置限流相关的响应头
 * @param res Express响应对象
 * @param results 限流检查结果数组
 */
function setRateLimitHeaders(res: Response, results: RateLimitResult[]): void {
  // 找到最严格的限制（剩余令牌最少）
  const mostRestrictive = results.reduce(
    (min, current) => (current.remaining < min.remaining ? current : min),
    results[0],
  );

  if (mostRestrictive) {
    // 标准限流头
    res.setHeader('X-RateLimit-Limit', mostRestrictive.maxTokens || 0);
    res.setHeader('X-RateLimit-Remaining', mostRestrictive.remaining);
    res.setHeader(
      'X-RateLimit-Reset',
      Math.ceil(mostRestrictive.resetTime / 1000),
    );
    res.setHeader(
      'X-RateLimit-Retry-After',
      Math.max(0, Math.ceil((mostRestrictive.resetTime - Date.now()) / 1000)),
    );

    // 自定义头，包含多级限流信息
    res.setHeader('X-RateLimit-Policy', mostRestrictive.limiterType);
    res.setHeader('X-RateLimit-Key', mostRestrictive.key);

    // 详细的限流信息（JSON格式）
    const detailedInfo = results.map((r) => ({
      type: r.limiterType,
      allowed: r.allowed,
      remaining: r.remaining,
      maxTokens: r.maxTokens,
      resetTime: r.resetTime,
      key: r.key,
    }));
    res.setHeader('X-RateLimit-Details', JSON.stringify(detailedInfo));
  }
}

/**
 * 记录限流事件
 * @param req Express请求对象
 * @param results 限流检查结果数组
 */
function logRateLimitEvent(
  req: RateLimitedRequest,
  results: RateLimitResult[],
): void {
  const summary = {
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
    results: results.map((r) => ({
      limiterType: r.limiterType,
      allowed: r.allowed,
      remaining: r.remaining,
      maxTokens: r.maxTokens,
      key: r.key,
      resetTime: new Date(r.resetTime).toISOString(),
    })),
  };

  if (req.rateLimited) {
    req.logger?.warn('限流事件', undefined, summary);
  } else {
    req.logger?.debug('限流检查通过', undefined, summary);
  }
}

/**
 * 创建简化的限流中间件（使用默认配置）
 * @param strategy 限流策略
 * @returns Express中间件函数
 */
export function createSimpleRateLimitMiddleware(strategy: IRateLimitStrategy) {
  return createRateLimitMiddleware({
    strategy,
    includeHeaders: true,
    logEvents: true,
    logOnlyBlocked: true,
  });
}

/**
 * 创建严格的限流中间件（更严格的配置）
 * @param strategy 限流策略
 * @returns Express中间件函数
 */
export function createStrictRateLimitMiddleware(strategy: IRateLimitStrategy) {
  return createRateLimitMiddleware({
    strategy,
    includeHeaders: true,
    errorMessage: '请求频率超出限制，请稍后再试',
    logEvents: true,
    logOnlyBlocked: false,
  });
}

/**
 * 创建宽松的限流中间件（更宽松的配置）
 * @param strategy 限流策略
 * @returns Express中间件函数
 */
export function createLenientRateLimitMiddleware(strategy: IRateLimitStrategy) {
  return createRateLimitMiddleware({
    strategy,
    includeHeaders: false,
    errorMessage: '请求过于频繁，请稍后再试',
    logEvents: false,
    logOnlyBlocked: true,
  });
}

/**
 * 判断是否应该跳过限流检查
 * @param req Express请求对象
 * @param skipHealthCheck 是否跳过健康检查
 * @param skipOptions 是否跳过OPTIONS请求
 * @returns 是否跳过限流
 */
function shouldSkipRateLimit(
  req: Request,
  skipHealthCheck: boolean,
  skipOptions: boolean,
): boolean {
  // 跳过OPTIONS请求
  if (skipOptions && req.method === 'OPTIONS') {
    return true;
  }

  // 跳过健康检查端点
  if (skipHealthCheck && isHealthCheckEndpoint(req)) {
    return true;
  }

  return false;
}

/**
 * 判断是否为健康检查端点
 * @param req Express请求对象
 * @returns 是否为健康检查端点
 */
function isHealthCheckEndpoint(req: Request): boolean {
  const healthCheckPaths = [
    '/api/health',
    '/api/healthz',
    '/api/status',
    '/api/ping',
    '/health',
    '/healthz',
    '/status',
    '/ping',
  ];

  return healthCheckPaths.some(
    (path) => req.path === path || req.path.startsWith(path + '/'),
  );
}
