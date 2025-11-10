import { Request, Response, NextFunction } from 'express';
import {
  EnhancedLogger,
  LogTag,
  TraceIdGenerator,
} from '@infrastructure/logging/enhanced-logger.js';

/**
 * 扩展Express Request接口，添加日志相关属性
 */
export interface LoggedRequest extends Request {
  traceId?: string;
  logger?: EnhancedLogger;
}

/**
 * 创建日志中间件，为每个请求生成traceID并添加到请求对象中
 * @param logger - 增强的日志器实例
 * @returns Express中间件函数
 */
export function loggingMiddleware(logger: EnhancedLogger) {
  return (req: LoggedRequest, res: Response, next: NextFunction) => {
    // 从请求头中提取或生成新的traceID
    const traceId = TraceIdGenerator.extractOrGenerate(
      req.headers as Record<string, string>,
    );

    // 将traceID添加到请求对象中
    req.traceId = traceId;

    // 创建带有traceID的日志器
    req.logger = logger.withContext({ traceId });

    // 记录请求开始
    req.logger?.info(`请求开始: ${req.method} ${req.url}`, LogTag.API, {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      query: req.query,
      body: req.method !== 'GET' ? req.body : undefined,
    });

    // 记录响应结束
    const originalSend = res.send;
    res.send = function (body) {
      req.logger?.info(`请求结束: ${req.method} ${req.url}`, LogTag.API, {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        responseSize: body ? Buffer.byteLength(body) : 0,
      });
      return originalSend.call(this, body);
    };

    next();
  };
}

/**
 * 创建错误日志中间件，用于记录错误信息
 * @param logger - 增强的日志器实例
 * @returns Express错误处理中间件函数
 */
export function errorLoggingMiddleware(logger: EnhancedLogger) {
  return (
    err: Error,
    req: LoggedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    const traceId = req.traceId || TraceIdGenerator.generate();
    const errorLogger = logger.withContext({ traceId });

    errorLogger.error(`请求错误: ${req.method} ${req.url}`, LogTag.ERROR, {
      method: req.method,
      url: req.url,
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack,
      },
      query: req.query,
      body: req.method !== 'GET' ? req.body : undefined,
    });

    next(err);
  };
}

/**
 * 创建性能监控中间件，用于记录请求处理时间
 * @param logger - 增强的日志器实例
 * @returns Express中间件函数
 */
export function performanceMiddleware(logger: EnhancedLogger) {
  return (req: LoggedRequest, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // 记录响应完成时的处理时间
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const traceId = req.traceId || TraceIdGenerator.generate();
      const perfLogger = logger.withContext({ traceId });

      perfLogger.info(`请求性能: ${req.method} ${req.url}`, LogTag.API, {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        slow: duration > 1000, // 超过1秒的请求标记为慢请求
      });
    });

    next();
  };
}
