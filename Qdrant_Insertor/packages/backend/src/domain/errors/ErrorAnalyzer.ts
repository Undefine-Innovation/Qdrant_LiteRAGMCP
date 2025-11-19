import { CoreError } from './CoreError.js';
import {
  ErrorSeverity,
  ErrorRecoveryStrategy,
  ErrorContext,
} from './CoreErrorTypes.js';

// Compatibility type that was referenced by legacy code paths.
export type ErrorAnalysis = {
  isUnifiedError: boolean;
  isAppError: boolean;
  isTransactionError: boolean;
  baseType?: string;
  severity?: ErrorSeverity;
  recoveryStrategy?: ErrorRecoveryStrategy;
  shouldRetry: boolean;
  shouldAlert: boolean;
};

/**
 * 错误分析器
 * 负责分析错误并返回分析结果
 */
export class ErrorAnalyzer {
  /**
   * 分析错误并返回错误信息
   * @param error 错误对象
   * @returns 错误分析结果
   */
  static analyzeError(error: Error): ErrorAnalysis {
    const isUnifiedError = error instanceof CoreError;
    const isAppError = error instanceof CoreError; // 现在都是同一个类
    const isTransactionError = false; // 简化后不再有单独的事务错误类

    let baseType: string | undefined;
    let severity: ErrorSeverity | undefined;
    let recoveryStrategy: ErrorRecoveryStrategy | undefined;
    let shouldRetry = false;
    let shouldAlert = false;

    if (isUnifiedError) {
      baseType = error.type;
      severity = error.severity;
      recoveryStrategy = error.recoveryStrategy;
      shouldRetry = error.isTemporary();
      shouldAlert = error.isCritical();
    } else {
      // 基于HTTP状态码判断（安全访问，不使用 any）
      const httpStatus = this.getHttpStatus(error);
      shouldRetry = typeof httpStatus === 'number' && [500, 502, 503, 504].includes(httpStatus);
      shouldAlert = typeof httpStatus === 'number' && httpStatus >= 500;
    }

    return {
      isUnifiedError,
      isAppError,
      isTransactionError,
      baseType,
      severity,
      recoveryStrategy,
      shouldRetry,
      shouldAlert,
    };
  }

  /**
   * 判断错误是否应该重试
   * @param error 错误对象
   * @returns 是否应该重试
   */
  static shouldRetry(error: Error): boolean {
    const analysis = this.analyzeError(error);
    return analysis.shouldRetry;
  }

  /**
   * 判断错误是否应该发送告警
   * @param error 错误对象
   * @returns 是否应该发送告警
   */
  static shouldAlert(error: Error): boolean {
    const analysis = this.analyzeError(error);
    return analysis.shouldAlert;
  }

  /**
   * 获取错误的严重级别
   * @param error 错误对象
   * @returns 错误严重级别
   */
  static getErrorSeverity(error: Error): ErrorSeverity {
    if (error instanceof CoreError) {
      return error.severity;
    }

    // 基于HTTP状态码判断严重级别（安全访问）
    const httpStatus = this.getHttpStatus(error);
    if (typeof httpStatus === 'number') {
      if (httpStatus >= 500) {
        return ErrorSeverity.HIGH;
      } else if (httpStatus >= 400) {
        return ErrorSeverity.MEDIUM;
      }
    }

    return ErrorSeverity.LOW;
  }

  /**
   * 获取错误的恢复策略
   * @param error 错误对象
   * @returns 错误恢复策略
   */
  static getRecoveryStrategy(error: Error): ErrorRecoveryStrategy {
    if (error instanceof CoreError) {
      return error.recoveryStrategy;
    }

    // 基于HTTP状态码判断恢复策略（安全访问）
    const httpStatus = this.getHttpStatus(error);
    if (typeof httpStatus === 'number') {
      if ([500, 502, 503, 504].includes(httpStatus)) {
        return ErrorRecoveryStrategy.RETRY;
      } else if (httpStatus >= 400 && httpStatus < 500) {
        return ErrorRecoveryStrategy.NONE;
      }
    }

    return ErrorRecoveryStrategy.MANUAL;
  }

  /**
   * 获取错误分类
   * @param error 错误对象
   * @returns 错误分类
   */
  static getErrorCategory(error: Error): string {
    if (error instanceof CoreError) {
      return this.extractCategoryFromErrorCode(error.type);
    }

    return 'UNKNOWN';
  }

  /**
   * 从统一错误代码中提取分类
   * @param errorCode 错误代码
   * @returns 错误分类
   */
  private static extractCategoryFromErrorCode(errorCode: string): string {
    if (errorCode.includes('VALIDATION')) {
      return 'VALIDATION_ERROR';
    } else if (errorCode.includes('BUSINESS_RULE')) {
      return 'BUSINESS_RULE_ERROR';
    } else if (errorCode.includes('DATABASE')) {
      return 'DATABASE_ERROR';
    } else if (errorCode.includes('NETWORK')) {
      return 'NETWORK_ERROR';
    } else if (errorCode.includes('EXTERNAL_SERVICE')) {
      return 'EXTERNAL_SERVICE_ERROR';
    } else if (errorCode.includes('FILE_SYSTEM')) {
      return 'FILE_SYSTEM_ERROR';
    } else if (errorCode.includes('RESOURCE')) {
      return 'RESOURCE_ERROR';
    } else {
      return 'UNKNOWN';
    }
  }

  /**
   * 生成错误报告
   * @param error 错误对象
   * @returns 错误报告
   */
  static generateErrorReport(error: Error): {
    errorType: string;
    category: string;
    severity: ErrorSeverity;
    recoveryStrategy: ErrorRecoveryStrategy;
    shouldRetry: boolean;
    shouldAlert: boolean;
    timestamp: number;
    message: string;
    stack?: string;
    context?: Record<string, unknown>;
  } {
    const analysis = this.analyzeError(error);
    const category = this.getErrorCategory(error);
    const severity = this.getErrorSeverity(error);
    const recoveryStrategy = this.getRecoveryStrategy(error);

    return {
      errorType: error.constructor.name,
      category,
      severity,
      recoveryStrategy,
      shouldRetry: analysis.shouldRetry,
      shouldAlert: analysis.shouldAlert,
      timestamp: Date.now(),
      message: error.message,
      stack: error.stack,
      context: this.extractErrorContext(error),
    };
  }

  /**
   * 提取错误上下文
   * @param error 错误对象
   * @returns 错误上下文
   */
  private static extractErrorContext(error: Error): Record<string, unknown> {
    if (error instanceof CoreError) {
      return {
        type: error.type,
        details: error.details,
      } as Record<string, unknown>;
    }

    return {};
  }

  /**
   * 安全地从任意 Error 对象中读取 httpStatus（若存在且为 number 则返回，否则返回 undefined）
   * @param error 要检查的错误对象
   * @returns 如果存在且为 number，则返回 httpStatus，否则返回 undefined
   */
  private static getHttpStatus(error: Error): number | undefined {
    const candidate = error as unknown as { httpStatus?: unknown };
    return typeof candidate.httpStatus === 'number' ? (candidate.httpStatus as number) : undefined;
  }
}
