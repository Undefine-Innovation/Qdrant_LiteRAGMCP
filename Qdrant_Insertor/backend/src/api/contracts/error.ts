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
   
  public readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    httpStatus: number = 500,
     
    details?: Record<string, unknown>
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

  /**
   * 将原生 Error 转换为 AppError，默认为 INTERNAL_SERVER_ERROR。
   * @param error 原始 Error 对象
   * @returns AppError 实例
   */
  public static fromError(error: Error): AppError {
    if (error instanceof AppError) {
      return error;
    }
    return new AppError(
      ErrorCode.INTERNAL_SERVER_ERROR,
      error.message || 'An unexpected internal server error occurred.',
      500,
      { stack: error.stack }
    );
  }

  /**
   * 创建一个 VALIDATION_ERROR 类型的 AppError。
   * @param details 错误的详细信息，通常是验证失败的字段和原因。
   * @param message 可选的错误信息，默认为 'Validation failed.'。
   * @returns AppError 实例
   */
   
  public static createValidationError(details: Record<string, unknown>, message: string = 'Validation failed.'): AppError {
    return new AppError(ErrorCode.VALIDATION_ERROR, message, 422, details);
  }

  /**
   * 创建一个 INTERNAL_SERVER_ERROR 类型的 AppError。
   * @param message 可选的错误信息，默认为 'Internal server error.'。
   * @param details 可选的错误详细信息。
   * @returns AppError 实例
   */
   
  public static createInternalServerError(message: string = 'Internal server error.', details?: Record<string, unknown>): AppError {
    return new AppError(ErrorCode.INTERNAL_SERVER_ERROR, message, 500, details);
  }

  /**
   * Creates a NOT_FOUND error.
   * @param message - The error message.
   * @returns A new AppError instance.
   */
  public static createNotFoundError(message: string = 'Resource not found.'): AppError {
    return new AppError(ErrorCode.NOT_FOUND, message, 404);
  }
}