import { AppError, ErrorCode } from '@api/contracts/error.js';
import {
  TransactionError,
  TransactionErrorType,
} from '@infrastructure/transactions/TransactionErrorHandler.js';
import { ErrorCategory } from '@domain/sync/retry.js';
import { ErrorFactory, ErrorContext } from '@domain/errors/ErrorFactory.js';

/**
 * 错误映射策略接口
 */
export interface ErrorMappingStrategy {
  /** 策略名称 */
  name: string;
  /** 优先级（数字越小优先级越高） */
  priority: number;
  /** 是否可以处理指定的错误 */
  canHandle(error: Error): boolean;
  /** 将错误映射为AppError */
  map(error: Error, context?: ErrorContext): AppError;
}

/**
 * 数据库错误映射策略
 */
export class DatabaseErrorMappingStrategy implements ErrorMappingStrategy {
  name = 'DatabaseErrorMapping';
  priority = 1;

  canHandle(error: Error): boolean {
    const message = error.message.toLowerCase();
    const errorName = error.constructor.name.toLowerCase();
    const dbKeywords = [
      'database',
      'sqlite',
      'sql',
      'db',
      'constraint',
      'unique',
      'foreign key',
      'timeout',
      'locked',
      'busy',
      'connection',
      'typeorm',
      'queryrunner',
    ];
    return (
      dbKeywords.some(
        (keyword) => message.includes(keyword) || errorName.includes(keyword),
      ) ||
      errorName.includes('connectionisnot') ||
      errorName.includes('connectionerror')
    );
  }

  map(error: Error, context?: ErrorContext): AppError {
    const message = error.message.toLowerCase();

    // 约束违反
    if (
      message.includes('constraint') ||
      message.includes('unique') ||
      message.includes('foreign key')
    ) {
      return ErrorFactory.createValidationError(
        'Database constraint violation.',
        {
          originalError: error.message,
          constraintType: this.extractConstraintType(message),
        },
        context,
      );
    }

    // 连接错误
    if (message.includes('connection') || message.includes('connect')) {
      return ErrorFactory.createServiceUnavailableError('Database', context);
    }

    // 超时错误
    if (
      message.includes('timeout') ||
      message.includes('locked') ||
      message.includes('busy')
    ) {
      return ErrorFactory.createServiceUnavailableError('Database', context);
    }

    // 默认数据库错误
    return ErrorFactory.createInternalServerError(
      'Database operation failed.',
      { originalError: error.message },
      context,
      error,
    );
  }

  /**
   * 解析数据库错误消息对应的约束类型。
   * @param message 数据库报错信息
   * @returns 归一化的约束类型
   */
  private extractConstraintType(message: string): string {
    if (message.includes('unique')) return 'UNIQUE';
    if (message.includes('foreign key')) return 'FOREIGN_KEY';
    if (message.includes('not null')) return 'NOT_NULL';
    if (message.includes('check')) return 'CHECK';
    return 'UNKNOWN';
  }
}

/**
 * 网络错误映射策略
 */
export class NetworkErrorMappingStrategy implements ErrorMappingStrategy {
  name = 'NetworkErrorMapping';
  priority = 2;

  canHandle(error: Error): boolean {
    const message = error.message.toLowerCase();
    const name = error.constructor.name.toLowerCase();
    const networkKeywords = [
      'network',
      'connection',
      'connect',
      'timeout',
      'etimedout',
      'enotfound',
      'econnrefused',
      'econnreset',
      'socket',
      'dns',
    ];
    return networkKeywords.some(
      (keyword) => message.includes(keyword) || name.includes(keyword),
    );
  }

  /**
   * 将任意错误转换为默认的 AppError。
   * @param error 捕获的错误
   * @param context 可选上下文
   * @returns 标准化的 AppError
   */
  map(error: Error, context?: ErrorContext): AppError {
    const message = error.message.toLowerCase();

    // DNS错误
    if (message.includes('enotfound') || message.includes('dns')) {
      return ErrorFactory.createServiceUnavailableError(
        'DNS Resolution',
        context,
      );
    }

    // 连接被拒绝
    if (
      message.includes('econnrefused') ||
      message.includes('connection refused')
    ) {
      return ErrorFactory.createServiceUnavailableError(
        'Remote Service',
        context,
      );
    }

    // 超时错误
    if (message.includes('timeout') || message.includes('etimedout')) {
      return ErrorFactory.createServiceUnavailableError(
        'Network Service',
        context,
      );
    }

    // 连接重置
    if (
      message.includes('econnreset') ||
      message.includes('connection reset')
    ) {
      return ErrorFactory.createServiceUnavailableError(
        'Network Connection',
        context,
      );
    }

    // 默认网络错误
    return ErrorFactory.createServiceUnavailableError(
      'Network Service',
      context,
    );
  }
}

/**
 * 文件处理错误映射策略
 */
export class FileProcessingErrorMappingStrategy
  implements ErrorMappingStrategy
{
  name = 'FileProcessingErrorMapping';
  priority = 3;

  canHandle(error: Error): boolean {
    const message = error.message.toLowerCase();
    const fileKeywords = [
      'file',
      'upload',
      'size',
      'format',
      'type',
      'extension',
      'mime',
      'corrupted',
      'invalid',
    ];
    return fileKeywords.some((keyword) => message.includes(keyword));
  }

  map(error: Error, context?: ErrorContext): AppError {
    const message = error.message.toLowerCase();

    // 文件过大
    if (
      message.includes('too large') ||
      message.includes('size') ||
      message.includes('limit')
    ) {
      return ErrorFactory.createFileTooLargeError(
        context?.resourceId,
        undefined,
        undefined,
        context,
      );
    }

    // 不支持的文件类型
    if (
      message.includes('type') ||
      message.includes('format') ||
      message.includes('extension')
    ) {
      return ErrorFactory.createUnsupportedFileTypeError(
        context?.resourceId,
        undefined,
        undefined,
        context,
      );
    }

    // 文件损坏
    if (message.includes('corrupted') || message.includes('invalid')) {
      return ErrorFactory.createFileUploadFailedError(
        'File is corrupted or invalid',
        context?.resourceId,
        context,
      );
    }

    // 默认文件处理错误
    return ErrorFactory.createFileUploadFailedError(
      error.message,
      context?.resourceId,
      context,
    );
  }
}

/**
 * Payload过大错误映射策略
 */
export class PayloadTooLargeErrorMappingStrategy
  implements ErrorMappingStrategy
{
  name = 'PayloadTooLargeErrorMapping';
  priority = 3;

  canHandle(error: Error): boolean {
    const errorWithCode = error as Error & {
      code?: string;
      statusCode?: number;
    };
    return (
      errorWithCode.code === 'PAYLOAD_TOO_LARGE' ||
      errorWithCode.statusCode === 413 ||
      error.message.toLowerCase().includes('exceeds maximum limit')
    );
  }

  map(error: Error, context?: ErrorContext): AppError {
    const errorWithCode = error as Error & { statusCode?: number };
    return ErrorFactory.createPayloadTooLargeError(
      'Request payload',
      undefined,
      undefined,
      context,
    );
  }
}

/**
 * 验证错误映射策略
 */
export class ValidationErrorMappingStrategy implements ErrorMappingStrategy {
  name = 'ValidationErrorMapping';
  priority = 4;

  canHandle(error: Error): boolean {
    const message = error.message.toLowerCase();
    const name = error.constructor.name.toLowerCase();
    const validationKeywords = [
      'validation',
      'invalid',
      'required',
      'missing',
      'format',
      'schema',
      'zod',
      'joi',
      'yup',
    ];
    return validationKeywords.some(
      (keyword) => message.includes(keyword) || name.includes(keyword),
    );
  }

  map(error: Error, context?: ErrorContext): AppError {
    return ErrorFactory.createValidationError(
      error.message,
      { originalError: error.message },
      context,
    );
  }
}

/**
 * 权限错误映射策略
 */
export class PermissionErrorMappingStrategy implements ErrorMappingStrategy {
  name = 'PermissionErrorMapping';
  priority = 5;

  canHandle(error: Error): boolean {
    const message = error.message.toLowerCase();
    const permissionKeywords = [
      'unauthorized',
      'forbidden',
      'permission',
      'access denied',
      'not allowed',
      'authentication',
      'auth',
    ];
    return permissionKeywords.some((keyword) => message.includes(keyword));
  }

  map(error: Error, context?: ErrorContext): AppError {
    const message = error.message.toLowerCase();

    // 未授权
    if (
      message.includes('unauthorized') ||
      message.includes('authentication')
    ) {
      return ErrorFactory.createUnauthorizedError(error.message, context);
    }

    // 禁止访问
    if (
      message.includes('forbidden') ||
      message.includes('permission') ||
      message.includes('access denied')
    ) {
      return ErrorFactory.createForbiddenError(error.message, context);
    }

    // 默认权限错误
    return ErrorFactory.createUnauthorizedError(error.message, context);
  }
}

/**
 * 资源未找到错误映射策略
 */
export class NotFoundErrorMappingStrategy implements ErrorMappingStrategy {
  name = 'NotFoundErrorMapping';
  priority = 6;

  canHandle(error: Error): boolean {
    const message = error.message.toLowerCase();
    const notFoundKeywords = [
      'not found',
      'does not exist',
      'missing',
      'no such',
      'undefined',
      'null',
    ];
    return notFoundKeywords.some((keyword) => message.includes(keyword));
  }

  map(error: Error, context?: ErrorContext): AppError {
    return ErrorFactory.createNotFoundError(
      'Resource',
      context?.resourceId,
      context,
    );
  }
}

/**
 * 默认错误映射策略
 */
export class DefaultErrorMappingStrategy implements ErrorMappingStrategy {
  name = 'DefaultErrorMapping';
  priority = 999;

  canHandle(error: Error): boolean {
    return true; // 默认策略总是可以处理
  }

  map(error: Error, context?: ErrorContext): AppError {
    return ErrorFactory.fromError(error, context);
  }
}

/**
 * 错误映射器类
 * 提供错误映射策略的管理和执行
 */
export class ErrorMapper {
  private strategies: ErrorMappingStrategy[] = [];

  constructor() {
    // 注册默认映射策略（按优先级排序）
    this.registerStrategy(new DatabaseErrorMappingStrategy());
    this.registerStrategy(new NetworkErrorMappingStrategy());
    this.registerStrategy(new FileProcessingErrorMappingStrategy());
    this.registerStrategy(new PayloadTooLargeErrorMappingStrategy());
    this.registerStrategy(new ValidationErrorMappingStrategy());
    this.registerStrategy(new PermissionErrorMappingStrategy());
    this.registerStrategy(new NotFoundErrorMappingStrategy());
    this.registerStrategy(new DefaultErrorMappingStrategy());
  }

  /**
   * 注册错误映射策略
   * @param strategy 映射策略
   */
  registerStrategy(strategy: ErrorMappingStrategy): void {
    this.strategies.push(strategy);
    // 按优先级排序
    this.strategies.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 移除错误映射策略
   * @param strategyName 策略名称
   */
  removeStrategy(strategyName: string): void {
    this.strategies = this.strategies.filter((s) => s.name !== strategyName);
  }

  /**
   * 获取所有已注册的策略
   * @returns 策略列表
   */
  getStrategies(): ErrorMappingStrategy[] {
    return [...this.strategies];
  }

  /**
   * 将错误映射为AppError
   * @param error 原始错误
   * @param context 错误上下文
   * @returns 映射后的AppError
   */
  map(error: Error, context?: ErrorContext): AppError {
    // 如果已经是AppError，直接返回
    if (error instanceof AppError) {
      return error;
    }

    // 如果是TransactionError，使用专门的转换方法
    if (error instanceof TransactionError) {
      return ErrorFactory.fromTransactionError(error, context);
    }

    // 遍历策略，找到第一个可以处理的策略
    for (const strategy of this.strategies) {
      if (strategy.canHandle(error)) {
        try {
          return strategy.map(error, context);
        } catch (mappingError) {
          // 如果映射失败，记录错误并继续尝试下一个策略
          console.error(
            `Error mapping strategy '${strategy.name}' failed:`,
            mappingError,
          );
          continue;
        }
      }
    }

    // 如果所有策略都失败，使用默认策略
    return new DefaultErrorMappingStrategy().map(error, context);
  }

  /**
   * 批量映射错误
   * @param errors 错误数组
   * @param context 错误上下文
   * @returns 映射后的AppError数组
   */
  mapBatch(errors: Error[], context?: ErrorContext): AppError[] {
    return errors.map((error) => this.map(error, context));
  }

  /**
   * 创建带有上下文的错误映射器
   * @param baseContext 基础上下文
   * @returns 带有上下文的错误映射器
   */
  withContext(baseContext: ErrorContext): {
    map: (error: Error, additionalContext?: ErrorContext) => AppError;
    mapBatch: (errors: Error[], additionalContext?: ErrorContext) => AppError[];
  } {
    return {
      map: (error: Error, additionalContext?: ErrorContext) => {
        const mergedContext = { ...baseContext, ...additionalContext };
        return this.map(error, mergedContext);
      },
      mapBatch: (errors: Error[], additionalContext?: ErrorContext) => {
        const mergedContext = { ...baseContext, ...additionalContext };
        return this.mapBatch(errors, mergedContext);
      },
    };
  }

  /**
   * 根据错误分类映射错误
   * @param category 错误分类
   * @param error 原始错误
   * @param context 错误上下文
   * @returns 映射后的AppError
   */
  mapByCategory(
    category: ErrorCategory,
    error: Error,
    context?: ErrorContext,
  ): AppError {
    return ErrorFactory.fromErrorCategory(
      category,
      error.message,
      context,
      error,
    );
  }
}

/**
 * 创建默认错误映射器实例
 * @returns 错误映射器实例
 */
export function createErrorMapper(): ErrorMapper {
  return new ErrorMapper();
}

/**
 * 全局错误映射器实例
 */
export const globalErrorMapper = createErrorMapper();
