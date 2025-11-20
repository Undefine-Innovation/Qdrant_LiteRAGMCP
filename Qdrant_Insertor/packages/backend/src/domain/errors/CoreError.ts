/**
 * 核心错误类定义
 * 统一处理所有类型的错误，替代现有的复杂错误类体系
 */

import {
  ErrorType,
  ErrorSeverity,
  ErrorRecoveryStrategy,
  ErrorContext,
  ErrorOptions,
  ErrorTypeConfig,
  getErrorTypeConfig,
  getErrorTypeFromHttpStatus,
  inferErrorTypeFromMessage,
  getDefaultMessageForHttpStatus,
} from './CoreErrorTypes.js';
import { CoreErrorFactory } from './CoreErrorFactory.js';

// 重新导出类型和值以保持向后兼容
export {
  ErrorType,
  ErrorSeverity,
  ErrorRecoveryStrategy,
  getErrorTypeConfig,
  getErrorTypeFromHttpStatus,
  inferErrorTypeFromMessage,
  getDefaultMessageForHttpStatus,
};
export type { ErrorContext, ErrorOptions, ErrorTypeConfig };

/**
 * 核心错误类
 * 统一处理所有类型的错误，替代现有的复杂错误类体系
 */
export class CoreError extends Error {
  /** 错误类型 */
  public readonly type: ErrorType;

  /** 错误代码（向后兼容） */
  public readonly code: string;

  /** 错误ID */
  public readonly errorId: string;

  /** HTTP状态码 */
  public readonly httpStatus: number;

  /** 错误严重级别 */
  public readonly severity: ErrorSeverity;

  /** 恢复策略 */
  public readonly recoveryStrategy: ErrorRecoveryStrategy;

  /** 错误详情 */
  public readonly details?: Record<string, unknown>;

  /** 错误上下文 */
  public readonly context?: ErrorContext;

  /** 原始错误 */
  public readonly cause?: Error;

  /** 时间戳 */
  public readonly timestamp: number;

  /** 是否应该监控 */
  public readonly shouldMonitor: boolean;

  /** 是否应该发送告警 */
  public readonly shouldAlert: boolean;

  /** 是否应该记录堆栈 */
  public readonly shouldLogStack: boolean;

  /**
   * 创建核心错误实例
   * @param type 错误类型
   * @param message 错误消息
   * @param options 错误选项
   */
  constructor(type: ErrorType, message: string, options: ErrorOptions = {}) {
    super(message);

    this.name = 'CoreError';
    this.type = type;
    this.code = options.code || type;
    this.errorId = options.errorId || this.generateErrorId();
    this.timestamp = Date.now();
    this.cause = options.cause;
    this.details = options.details;
    this.context = options.context;

    // 获取错误类型配置
    const config = getErrorTypeConfig(type);

    // 设置错误属性，优先使用传入的选项
    this.httpStatus = options.httpStatus ?? config.defaultHttpStatus;
    this.severity = options.severity ?? config.defaultSeverity;
    this.recoveryStrategy =
      options.recoveryStrategy ?? config.defaultRecoveryStrategy;
    this.shouldMonitor = options.shouldMonitor ?? config.shouldMonitor;
    this.shouldAlert = options.shouldAlert ?? config.shouldAlert;
    this.shouldLogStack = options.shouldLogStack ?? config.shouldLogStack;

    // 保持堆栈跟踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CoreError);
    }
  }

  /**
   * 生成错误ID
   * @returns 错误ID字符串
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 转换为JSON格式
   * @returns JSON格式的错误信息
   */
  toJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {
      errorId: this.errorId,
      type: this.type,
      message: this.message,
      httpStatus: this.httpStatus,
      severity: this.severity,
      recoveryStrategy: this.recoveryStrategy,
      timestamp: this.timestamp,
    };

    if (this.details && Object.keys(this.details).length > 0) {
      result.details = this.details;
    }

    if (this.context && Object.keys(this.context).length > 0) {
      result.context = this.context;
    }

    if (this.cause) {
      result.cause = {
        name: this.cause.name,
        message: this.cause.message,
        stack:
          process.env.NODE_ENV === 'development' ? this.cause.stack : undefined,
      };
    }

    if (process.env.NODE_ENV === 'development') {
      result.stack = this.stack;
    }

    return result;
  }

  /**
   * 转换为API响应格式
   * @returns API响应格式的错误信息
   */
  toApiResponse(): Record<string, unknown> {
    type ApiError = {
      code: string;
      message: string;
      errorId: string;
      details?: Record<string, unknown>;
    };

    const response: { error: ApiError } = {
      error: {
        code: this.type,
        message: this.message,
        errorId: this.errorId,
      },
    };

    if (this.details && Object.keys(this.details).length > 0) {
      response.error.details = this.details;
    }

    return response;
  }

  /**
   * 判断是否为临时错误（可重试）
   * @returns 是否为临时错误
   */
  isTemporary(): boolean {
    return this.recoveryStrategy === ErrorRecoveryStrategy.RETRY;
  }

  /**
   * 判断是否为严重错误
   * @returns 是否为严重错误
   */
  isCritical(): boolean {
    return (
      this.severity === ErrorSeverity.CRITICAL ||
      this.severity === ErrorSeverity.HIGH
    );
  }

  public static validation: typeof CoreErrorFactory.validation =
    CoreErrorFactory.validation;
  public static notFound: typeof CoreErrorFactory.notFound =
    CoreErrorFactory.notFound;
  public static unauthorized: typeof CoreErrorFactory.unauthorized =
    CoreErrorFactory.unauthorized;
  public static forbidden: typeof CoreErrorFactory.forbidden =
    CoreErrorFactory.forbidden;
  public static conflict: typeof CoreErrorFactory.conflict =
    CoreErrorFactory.conflict;
  public static businessRule: typeof CoreErrorFactory.businessRule =
    CoreErrorFactory.businessRule;
  public static infrastructure: typeof CoreErrorFactory.infrastructure =
    CoreErrorFactory.infrastructure;
  public static configuration: typeof CoreErrorFactory.configuration =
    CoreErrorFactory.configuration;
  public static internal: typeof CoreErrorFactory.internal =
    CoreErrorFactory.internal;
  public static serviceUnavailable: typeof CoreErrorFactory.serviceUnavailable =
    CoreErrorFactory.serviceUnavailable;
  public static database: typeof CoreErrorFactory.database =
    CoreErrorFactory.database;
  public static network: typeof CoreErrorFactory.network =
    CoreErrorFactory.network;
  public static externalService: typeof CoreErrorFactory.externalService =
    CoreErrorFactory.externalService;
  public static payloadTooLarge: typeof CoreErrorFactory.payloadTooLarge =
    CoreErrorFactory.payloadTooLarge;
  public static fileTooLarge: typeof CoreErrorFactory.fileTooLarge =
    CoreErrorFactory.fileTooLarge;
  public static unsupportedFileType: typeof CoreErrorFactory.unsupportedFileType =
    CoreErrorFactory.unsupportedFileType;
  public static fromError: typeof CoreErrorFactory.fromError =
    CoreErrorFactory.fromError;
  public static fromHttpStatus: typeof CoreErrorFactory.fromHttpStatus =
    CoreErrorFactory.fromHttpStatus;

}
Object.assign(CoreError, {
  validation: CoreErrorFactory.validation,
  notFound: CoreErrorFactory.notFound,
  unauthorized: CoreErrorFactory.unauthorized,
  forbidden: CoreErrorFactory.forbidden,
  conflict: CoreErrorFactory.conflict,
  businessRule: CoreErrorFactory.businessRule,
  infrastructure: CoreErrorFactory.infrastructure,
  configuration: CoreErrorFactory.configuration,
  internal: CoreErrorFactory.internal,
  serviceUnavailable: CoreErrorFactory.serviceUnavailable,
  database: CoreErrorFactory.database,
  network: CoreErrorFactory.network,
  externalService: CoreErrorFactory.externalService,
  payloadTooLarge: CoreErrorFactory.payloadTooLarge,
  fileTooLarge: CoreErrorFactory.fileTooLarge,
  unsupportedFileType: CoreErrorFactory.unsupportedFileType,
  fromError: CoreErrorFactory.fromError,
  fromHttpStatus: CoreErrorFactory.fromHttpStatus,
});

// 向后兼容的别名
export const SimplifiedError = CoreError;
export const UnifiedError = CoreError;
export const AppError = CoreError;

// 添加静态方法到CoreError类
export { addStaticMethodsToCoreError } from './CoreErrorFactory.js';
