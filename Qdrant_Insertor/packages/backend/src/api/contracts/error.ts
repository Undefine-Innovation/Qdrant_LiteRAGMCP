import { z } from 'zod';

// 定义统一错误格式的Zod Schema
/**
 * 定义统一错误格式的Zod Schema
 * @description 定义API响应中错误信息的标准格式
 */
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string().describe('错误码，例如 VALIDATION_ERROR'),
    message: z.string().describe('人类可读的错误信息'),
    details: z.record(z.any()).optional().describe('可选：错误的额外详细信息'),
  }),
});

// 导出 ErrorResponse 的TypeScript 类型
/**
 * ErrorResponse类型定义
 * @description 从ErrorResponseSchema推断出的TypeScript类型
 */
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// 定义常见的错误码枚举
/**
 * 错误码枚举
 * @description 定义系统中所有可能的错误码
 */
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INTERNAL_ERROR = 'INTERNAL_ERROR', // 修改为INTERNAL_ERROR以匹配测试期望
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR', // 保留向后兼容
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  FILE_UPLOAD_FAILED = 'FILE_UPLOAD_FAILED',
  DOCUMENT_PROCESSING_FAILED = 'DOCUMENT_PROCESSING_FAILED',
  SYNC_FAILED = 'SYNC_FAILED',
  INVALID_INPUT = 'INVALID_INPUT',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  UNSUPPORTED_FILE_TYPE = 'UNSUPPORTED_FILE_TYPE',
  PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
}

// 定义一个通用的业务错误类
/**
 * 应用程序错误类
 * @description 统一的错误处理类，包含错误码、HTTP状态码和详细信息
 */
export class AppError extends Error {
  public readonly code: ErrorCode | string;
  public readonly httpStatus: number;

  public readonly details?: Record<string, unknown>;

  /**
   * 创建AppError实例
   * @param {ErrorCode} code - 错误码
   * @param {string} message - 错误信息
   * @param {number} [httpStatus=500] - HTTP状态码
   * @param {Record<string, unknown>} [details] - 错误详细信息
   */
  constructor(
    code: ErrorCode | string,
    message: string,
    httpStatus: number = 500,

    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype); // 修复原型链
  }

  /**
   * 将错误转换为JSON格式
   * @returns {ErrorResponse} 符合API响应格式的错误对象
   */
  public toJSON(): ErrorResponse {
    const response: ErrorResponse = {
      error: {
        code: this.code,
        message: this.message,
      },
    };

    // 只有当details存在且有内容时才添加
    if (this.details && Object.keys(this.details).length > 0) {
      response.error.details = this.details;
    }

    return response;
  }

  /**
   * 将原始Error转换为AppError，默认为 INTERNAL_ERROR
   * @param error 原始 Error 对象
   * @returns AppError 实例
   */
  public static fromError(error: Error): AppError {
    if (error instanceof AppError) {
      return error;
    }

    // 确保error对象不为空
    const errorMessage =
      error?.message || 'An unexpected internal error occurred.';
    const errorStack = error?.stack || '';

    return new AppError(ErrorCode.INTERNAL_ERROR, errorMessage, 500, {
      stack: errorStack,
      originalError: {
        message: errorMessage,
        name: error?.name || 'Error',
      },
    });
  }

  /**
   * 创建一个VALIDATION_ERROR 类型的AppError
   * @param {Record<string, unknown>} details - 错误的详细信息，通常是验证失败的字段和原因
   * @param {string} [message='Validation failed.'] - 可选的错误信息，默认为 'Validation failed.'
   * @returns {AppError} AppError 实例
   */
  public static createValidationError(
    details: Record<string, unknown>,
    message: string = 'Validation failed.',
  ): AppError {
    return new AppError(ErrorCode.VALIDATION_ERROR, message, 400, details);
  }

  /**
   * 创建一个INTERNAL_ERROR 类型的AppError
   * @param {string} [message='Internal error.'] - 可选的错误信息，默认为 'Internal error.'
   * @param {Record<string, unknown>} [details] - 可选的错误详细信息
   * @returns {AppError} AppError 实例
   */
  public static createInternalServerError(
    message: string = 'Internal error.',
    details?: Record<string, unknown>,
  ): AppError {
    return new AppError(ErrorCode.INTERNAL_ERROR, message, 500, details);
  }

  /**
   * Creates a NOT_FOUND error.
   * @param {string} [message='Resource not found.'] - The error message.
   * @returns {AppError} A new AppError instance.
   */
  public static createNotFoundError(
    message: string = 'Resource not found.',
  ): AppError {
    return new AppError(ErrorCode.NOT_FOUND, message, 404);
  }

  /**
   * Creates a FILE_TOO_LARGE error.
   * @param {string} [message='File size exceeds the maximum limit.'] - The error message.
   * @returns {AppError} A new AppError instance.
   */
  public static createFileTooLargeError(
    message: string = 'File size exceeds the maximum limit.',
  ): AppError {
    return new AppError(ErrorCode.FILE_TOO_LARGE, message, 413);
  }

  /**
   * Creates an UNSUPPORTED_FILE_TYPE error.
   * @param {string} [message='File type is not supported.'] - The error message.
   * @returns {AppError} A new AppError instance.
   */
  public static createUnsupportedFileTypeError(
    message: string = 'File type is not supported.',
  ): AppError {
    return new AppError(ErrorCode.UNSUPPORTED_FILE_TYPE, message, 422);
  }
}
