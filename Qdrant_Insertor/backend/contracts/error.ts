import { z } from 'zod';

// 定义统一错误格式的 Zod Schema
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string().describe('错误码，例如 VALIDATION_ERROR'),
    message: z.string().describe('人类可读的错误信息'),
    details: z.record(z.any()).optional().describe('可选：错误的额外详细信息'),
  }),
});

// 导出 ErrorResponse 的 TypeScript 类型
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// 定义常见的错误码枚举
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  FILE_UPLOAD_FAILED = 'FILE_UPLOAD_FAILED',
  DOCUMENT_PROCESSING_FAILED = 'DOCUMENT_PROCESSING_FAILED',
  SYNC_FAILED = 'SYNC_FAILED',
  INVALID_INPUT = 'INVALID_INPUT',
}

// 定义一个通用的业务错误类
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly details?: Record<string, any>;

  constructor(
    code: ErrorCode,
    message: string,
    httpStatus: number = 500,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype); // 修复原型链
  }

  public toJSON(): ErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    };
  }
}

// 示例：创建特定错误类型的工厂函数
export const createValidationError = (message: string, details?: Record<string, any>) =>
  new AppError(ErrorCode.VALIDATION_ERROR, message, 422, details);

export const createNotFoundError = (message: string, details?: Record<string, any>) =>
  new AppError(ErrorCode.NOT_FOUND, message, 404, details);

export const createInternalServerError = (message: string, details?: Record<string, any>) =>
  new AppError(ErrorCode.INTERNAL_SERVER_ERROR, message, 500, details);

export const createServiceUnavailableError = (message: string, details?: Record<string, any>) =>
  new AppError(ErrorCode.SERVICE_UNAVAILABLE, message, 503, details);