import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCode } from './api/contracts/error.js';
import { logger } from './logger.js';

/**
 * 全局错误处理中间件。
 * 能够识别 AppError 实例并返回结构化的错误响应。
 * 对于其他类型的错误，返回通用的 500 错误并记录详细日志。
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction,
) => {
  if (err instanceof AppError) {
    logger.warn(`AppError caught: ${err.code} - ${err.message}`, {
      code: err.code,
      statusCode: err.httpStatus,
      details: err.details,
      path: req.path,
      method: req.method,
    });
    return res.status(err.httpStatus).json(err.toJSON());
  }

  // 对于未知的错误，记录详细日志并返回通用 500 错误
  logger.error(`Unhandled error: ${err.message}`, {
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  return res.status(500).json(
    new AppError(
      ErrorCode.INTERNAL_SERVER_ERROR,
      'An unexpected internal server error occurred.',
      500,
      { stack: process.env.NODE_ENV === 'development' ? err.stack : undefined },
    ).toJSON(),
  );
};