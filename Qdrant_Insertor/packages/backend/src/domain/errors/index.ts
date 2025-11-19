/**
 * 简化的错误处理入口文件
 * 重新导出所有错误处理相关的类型和类，保持向后兼容性
 */

// 核心错误类和工厂
import { CoreError } from './CoreError.js';
import { ErrorFactory } from './ErrorFactory.js';
import { CoreErrorFactory } from './CoreErrorFactory.js';
import {
  ErrorLogger,
  initializeGlobalErrorLogger,
  logError,
  logRecovery,
} from './ErrorLogger.js';
import {
  ErrorType,
  ErrorSeverity,
  ErrorRecoveryStrategy,
  getErrorTypeConfig,
  getErrorTypeFromHttpStatus,
  inferErrorTypeFromMessage,
  getDefaultMessageForHttpStatus,
} from './CoreErrorTypes.js';
import type {
  ErrorContext,
  ErrorOptions,
  ErrorTypeConfig,
} from './CoreErrorTypes.js';

// 错误分析器
import { ErrorAnalyzer } from './ErrorAnalyzer.js';

// 错误处理器
import { ErrorHandler } from './ErrorHandler.js';

// 错误工具
import * as ErrorUtils from './ErrorUtils.js';

export { ErrorFactory };
export { ErrorUtils };
export {
  ErrorType,
  ErrorSeverity,
  ErrorRecoveryStrategy,
  getErrorTypeConfig,
  getErrorTypeFromHttpStatus,
  inferErrorTypeFromMessage,
  getDefaultMessageForHttpStatus,
} from './CoreErrorTypes.js';
export type {
  ErrorContext,
  ErrorOptions,
  ErrorTypeConfig,
} from './CoreErrorTypes.js';
// 错误代码
export * from './ErrorCodes.js';

// 错误日志相关
export type {
  ErrorLogLevel,
  ErrorStats,
  ErrorMetrics,
  ErrorAlertConfig,
  ErrorLoggerConfig,
} from './ErrorLogger.js';

// 向后兼容的别名
export const SimplifiedError = CoreError;
export const UnifiedError = CoreError;
export const AppError = CoreError;
export const SimplifiedErrorFactory = CoreErrorFactory;

// 向后兼容的类型别名
export type LegacyErrorContext = ErrorContext;
export type LegacyErrorOptions = ErrorOptions;

/**
 * 创建默认错误上下文的便捷函数
 * @param context 错误上下文
 * @returns 错误上下文
 */
export function createErrorContext(
  context: Partial<ErrorContext> = {},
): ErrorContext {
  return {
    ...context,
  };
}

/**
 * 创建错误详情的便捷函数
 * @param details 错误详情
 * @returns 错误详情
 */
export function createErrorDetails(
  details: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...details,
  };
}

/**
 * 错误处理工具函数
 */
export class ErrorUtilsClass {
  /**
   * 判断错误是否应该重试
   * @param error 错误对象
   * @returns 是否应该重试
   */
  static shouldRetry(error: Error): boolean {
    return ErrorAnalyzer.shouldRetry(error);
  }

  /**
   * 判断错误是否应该发送告警
   * @param error 错误对象
   * @returns 是否应该发送告警
   */
  static shouldAlert(error: Error): boolean {
    return ErrorAnalyzer.shouldAlert(error);
  }

  /**
   * 获取错误的严重级别
   * @param error 错误对象
   * @returns 错误严重级别
   */
  static getErrorSeverity(error: Error): string {
    return ErrorAnalyzer.getErrorSeverity(error);
  }

  /**
   * 获取错误的恢复策略
   * @param error 错误对象
   * @returns 错误恢复策略
   */
  static getRecoveryStrategy(error: Error): string {
    return ErrorAnalyzer.getRecoveryStrategy(error);
  }

  /**
   * 合并错误上下文
   * @param baseContext 基础上下文
   * @param additionalContext 额外上下文
   * @returns 合并后的上下文
   */
  static mergeContext(
    baseContext?: ErrorContext,
    additionalContext?: ErrorContext,
  ): ErrorContext | undefined {
    if (!baseContext && !additionalContext) return undefined;
    if (!baseContext) return additionalContext;
    if (!additionalContext) return baseContext;

    return { ...baseContext, ...additionalContext };
  }

  /**
   * 从原始错误创建错误
   * @param error 原始错误
   * @param context 错误上下文
   * @param defaultMessage 默认消息
   * @returns 创建的错误对象
   */
  static fromError(
    error: Error,
    context?: ErrorContext,
    defaultMessage?: string,
  ): CoreError {
    return CoreErrorFactory.fromError(error, context, defaultMessage);
  }

  /**
   * 从HTTP状态码创建错误
   * @param httpStatus HTTP状态码
   * @param message 错误消息
   * @param details 错误详情
   * @param context 错误上下文
   * @returns 创建的错误对象
   */
  static fromHttpStatus(
    httpStatus: number,
    message?: string,
    details?: Record<string, unknown>,
    context?: ErrorContext,
  ): CoreError {
    return CoreErrorFactory.fromHttpStatus(
      httpStatus,
      message,
      details,
      context,
    );
  }
}

// 重新导出ErrorUtils以保持向后兼容
export const ErrorUtilsCompat = ErrorUtils;

// 默认导出
export default {
  CoreError,
  ErrorFactory,
  CoreErrorFactory,
  ErrorLogger,
  ErrorUtils: ErrorUtilsCompat,
  ErrorAnalyzer,
  ErrorType,
  ErrorSeverity,
  ErrorRecoveryStrategy,
};
