import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCode } from '@api/contracts/error.js';
import { logger } from '@logging/logger.js';
import {
  ErrorFactory,
  ErrorUtils,
  ErrorContext,
} from '@domain/errors/index.js';

/**
 * 统一错误处理中间件
 * 使用简化的错误处理系统
 * @param err - 错误对象
 * @param req - Express请求对象
 * @param res - Express响应对象
 * @param _next - Express下一个中间件函数（未使用）
 * @returns Express响应对象
 */
export const errorHandler = (
  err: Error | unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): Response => {
  // 创建错误上下文
  const errorContext: ErrorContext = {
    operation: `${req.method} ${req.path}`,
    requestId: req.headers['x-request-id'] as string,
    userId: req.headers['x-user-id'] as string,
  };

  // 将未知错误转换为Error对象
  const error = err instanceof Error ? err : new Error(String(err));

  // 使用简化的错误处理系统
  const simplifiedError = ErrorFactory.fromError(error, errorContext);

  // 记录错误日志
  if (simplifiedError.httpStatus >= 500) {
    logger.error(
      `Server error: ${simplifiedError.type} - ${simplifiedError.message}`,
      {
        error: simplifiedError.toJSON(),
        path: req.path,
        method: req.method,
        stack: error.stack,
      },
    );
  } else {
    logger.warn(
      `Client error: ${simplifiedError.type} - ${simplifiedError.message}`,
      {
        error: simplifiedError.toJSON(),
        path: req.path,
        method: req.method,
      },
    );
  }

  // 返回错误响应
  const apiResponse = simplifiedError.toApiResponse();
  return res.status(simplifiedError.httpStatus).json(apiResponse);
};

/**
 * 初始化全局错误日志记录器
 * @param appLogger 日志记录器
 */
export function initializeErrorLogger(appLogger: typeof logger): void {
  // 简化的错误日志记录器初始化
  logger.info('Error logger initialized');
}

/**
 * 错误处理中间件工厂
 * 创建带有自定义配置的错误处理中间件
 * @param config - 配置选项
 * @param config.logLevel - 日志级别
 * @param config.enableStats - 是否启用统计
 * @param config.enableMetrics - 是否启用指标
 * @param config.enableAlerts - 是否启用告警
 * @returns 错误处理中间件函数
 */
export function createErrorHandler(
  config: {
    logLevel?: string;
    enableStats?: boolean;
    enableMetrics?: boolean;
    enableAlerts?: boolean;
  } = {},
) {
  return (
    err: Error | unknown,
    req: Request,
    res: Response,
    _next: NextFunction,
  ): Response => {
    // 创建错误上下文
    const errorContext: ErrorContext = {
      operation: `${req.method} ${req.path}`,
      requestId: req.headers['x-request-id'] as string,
      userId: req.headers['x-user-id'] as string,
    };

    // 将未知错误转换为Error对象
    const error = err instanceof Error ? err : new Error(String(err));

    // 使用简化的错误处理系统
    const simplifiedError = ErrorFactory.fromError(error, errorContext);

    // 记录错误日志
    if (simplifiedError.httpStatus >= 500) {
      logger.error(
        `Server error: ${simplifiedError.type} - ${simplifiedError.message}`,
        {
          error: simplifiedError.toJSON(),
          path: req.path,
          method: req.method,
          stack: error.stack,
        },
      );
    } else {
      logger.warn(
        `Client error: ${simplifiedError.type} - ${simplifiedError.message}`,
        {
          error: simplifiedError.toJSON(),
          path: req.path,
          method: req.method,
        },
      );
    }

    // 返回错误响应
    const apiResponse = simplifiedError.toApiResponse();
    return res.status(simplifiedError.httpStatus).json(apiResponse);
  };
}
