import { Request, Response, NextFunction } from "express";
import { AppError, ErrorCode } from "@api/contracts/error.js";
import { logger } from "@logging/logger.js";
import { ErrorFactory, ErrorContext } from "@domain/errors/ErrorFactory.js";
import { globalErrorMapper } from "@infrastructure/errors/ErrorMapper.js";

/**
 * 判断是否为 JSON 解析错误
 * @param error - 错误对象
 * @returns 如果是JSON解析错误则返回true，否则返回false
 */
function isJsonParseError(
  error: unknown
): error is SyntaxError & { type?: string; status?: number } {
  if (!error || typeof error !== "object") {
    return false;
  }

  const parseError = error as SyntaxError & { type?: string; status?: number };
  return (
    parseError instanceof SyntaxError &&
    (parseError.type === "entity.parse.failed" ||
      parseError.message.includes("Unexpected token"))
  );
}

/**
 * 判断是否为请求体过大错误
 * @param error - 错误对象
 * @returns 如果是请求体过大错误则返回true，否则返回false
 */
function isPayloadTooLargeError(
  error: unknown
): error is { type?: string; status?: number; message?: string } {
  if (!error || typeof error !== "object") {
    return false;
  }

  const payloadError = error as {
    type?: string;
    status?: number;
    message?: string;
  };
  return (
    payloadError.type === "entity.too.large" ||
    payloadError.status === 413 ||
    (typeof payloadError.message === "string" &&
      payloadError.message.toLowerCase().includes("too large"))
  );
}

/**
 * 全局错误处理中间件
 * 能够识别 AppError 实例并返回结构化的错误响应
 * 对于其他类型的错误，返回通用500错误并记录详细日志
 * @param err - 错误对象
 * @param req - Express请求对象
 * @param res - Express响应对象
 * @param _next - Express下一个中间件函数（未使用）
 * @returns Response 对象
 */
export const errorHandler = (
  err: Error | unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): Response => {
  // 创建错误上下文
  const errorContext: ErrorContext = {
    operation: `${req.method} ${req.path}`,
    requestId: req.headers['x-request-id'] as string,
    userId: req.headers['x-user-id'] as string,
  };

  // 将未知错误转换为Error对象
  const error = err instanceof Error ? err : new Error(String(err));

  // 使用ErrorMapper映射错误
  const mappedError = globalErrorMapper.map(error, errorContext);
  // 检查JSON解析错误
  if (isJsonParseError(error)) {
    logger.warn("Invalid JSON payload received", {
      path: req.path,
      method: req.method,
      message: error.message,
    });
    const validationError = ErrorFactory.createValidationError(
      "Invalid JSON payload",
      { originalError: error.message },
      errorContext,
    );
    return res.status(validationError.httpStatus).json(validationError.toJSON());
  }

  // 检查请求体过大错误
  if (isPayloadTooLargeError(error)) {
    logger.warn("Request payload too large", {
      path: req.path,
      method: req.method,
    });
    const fileTooLargeError = ErrorFactory.createFileTooLargeError(
      undefined,
      undefined,
      undefined,
      errorContext,
    );
    return res.status(fileTooLargeError.httpStatus).json(fileTooLargeError.toJSON());
  }

  // 记录错误日志
  if (mappedError.httpStatus >= 500) {
    logger.error(`Server error: ${mappedError.code} - ${mappedError.message}`, {
      code: mappedError.code,
      statusCode: mappedError.httpStatus,
      details: mappedError.details,
      path: req.path,
      method: req.method,
      stack: err instanceof Error ? err.stack : undefined,
    });
  } else {
    logger.warn(`Client error: ${mappedError.code} - ${mappedError.message}`, {
      code: mappedError.code,
      statusCode: mappedError.httpStatus,
      details: mappedError.details,
      path: req.path,
      method: req.method,
    });
  }

  return res.status(mappedError.httpStatus).json(mappedError.toJSON());
};
