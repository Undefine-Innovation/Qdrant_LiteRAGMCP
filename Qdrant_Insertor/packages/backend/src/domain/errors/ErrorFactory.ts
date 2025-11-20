/**
 * 统一错误工厂
 * 提供统一的错误创建接口，替代现有的复杂ErrorFactory
 */

import {
  CoreError,
  ErrorType,
  ErrorContext,
  ErrorSeverity,
  ErrorRecoveryStrategy,
  getErrorTypeConfig,
  getErrorTypeFromHttpStatus,
  inferErrorTypeFromMessage,
} from './CoreError.js';
import { CoreErrorFactory } from './CoreErrorFactory.js';

/**
 * 统一错误工厂类
 * 提供统一的错误创建接口，替代现有的复杂ErrorFactory
 */
export class ErrorFactory {
  /**
   * 创建验证错误
   * @param message - 错误消息
   * @param details - 错误详情
   * @param context - 错误上下文
   * @returns CoreError实例
   */
  static validation(
    message: string,
    details?: Record<string, unknown>,
    context?: ErrorContext,
  ): CoreError {
    return CoreErrorFactory.validation(message, details, context);
  }

  /**
   * 创建未找到错误
   * @param resource - 资源名称
   * @param resourceId - 资源ID
   * @param context - 错误上下文
   * @returns CoreError实例
   */
  static notFound(
    resource: string,
    resourceId?: string,
    context?: ErrorContext,
  ): CoreError {
    return CoreErrorFactory.notFound(resource, resourceId, context);
  }

  /**
   * 创建未授权错误
   * @param message - 错误消息
   * @param context - 错误上下文
   * @returns CoreError实例
   */
  static unauthorized(
    message: string = 'Unauthorized access',
    context?: ErrorContext,
  ): CoreError {
    return CoreErrorFactory.unauthorized(message, context);
  }

  /**
   * 创建禁止访问错误
   * @param message - 错误消息
   * @param context - 错误上下文
   * @returns CoreError实例
   */
  static forbidden(
    message: string = 'Access forbidden',
    context?: ErrorContext,
  ): CoreError {
    return CoreErrorFactory.forbidden(message, context);
  }

  /**
   * 创建冲突错误
   * @param message - 错误消息
   * @param details - 错误详情
   * @param context - 错误上下文
   * @returns CoreError实例
   */
  static conflict(
    message: string = 'Resource conflict',
    details?: Record<string, unknown>,
    context?: ErrorContext,
  ): CoreError {
    return CoreErrorFactory.conflict(message, details, context);
  }

  /**
   * 创建业务规则错误
   * @param message - 错误消息
   * @param details - 错误详情
   * @param context - 错误上下文
   * @returns CoreError实例
   */
  static businessRule(
    message: string,
    details?: Record<string, unknown>,
    context?: ErrorContext,
  ): CoreError {
    return CoreErrorFactory.businessRule(message, details, context);
  }

  /**
   * 创建基础设施错误
   * @param message - 错误消息
   * @param details - 错误详情
   * @param context - 错误上下文
   * @param cause - 原始错误
   * @returns CoreError实例
   */
  static infrastructure(
    message: string,
    details?: Record<string, unknown>,
    context?: ErrorContext,
    cause?: Error,
  ): CoreError {
    return CoreErrorFactory.infrastructure(message, details, context, cause);
  }

  /**
   * 创建配置错误
   * @param message - 错误消息
   * @param details - 错误详情
   * @param context - 错误上下文
   * @returns CoreError实例
   */
  static configuration(
    message: string,
    details?: Record<string, unknown>,
    context?: ErrorContext,
  ): CoreError {
    return CoreErrorFactory.configuration(message, details, context);
  }

  /**
   * 创建内部服务器错误
   * @param message - 错误消息
   * @param details - 错误详情
   * @param context - 错误上下文
   * @param cause - 原始错误
   * @returns CoreError实例
   */
  static internal(
    message: string = 'Internal server error',
    details?: Record<string, unknown>,
    context?: ErrorContext,
    cause?: Error,
  ): CoreError {
    return CoreErrorFactory.internal(message, details, context, cause);
  }

  /**
   * 创建服务不可用错误
   * @param service - 服务名称
   * @param context - 错误上下文
   * @returns CoreError实例
   */
  static serviceUnavailable(
    service: string = 'Service',
    context?: ErrorContext,
  ): CoreError {
    return CoreErrorFactory.serviceUnavailable(service, context);
  }

  /**
   * 创建数据库错误
   * @param message - 错误消息
   * @param details - 错误详情
   * @param context - 错误上下文
   * @param cause - 原始错误
   * @returns CoreError实例
   */
  static database(
    message: string,
    details?: Record<string, unknown>,
    context?: ErrorContext,
    cause?: Error,
  ): CoreError {
    return CoreErrorFactory.database(message, details, context, cause);
  }

  /**
   * 创建网络错误
   * @param message - 错误消息
   * @param details - 错误详情
   * @param context - 错误上下文
   * @param cause - 原始错误
   * @returns CoreError实例
   */
  static network(
    message: string,
    details?: Record<string, unknown>,
    context?: ErrorContext,
    cause?: Error,
  ): CoreError {
    return CoreErrorFactory.network(message, details, context, cause);
  }

  /**
   * 创建外部服务错误
   * @param service - 服务名称
   * @param message - 错误消息
   * @param details - 错误详情
   * @param context - 错误上下文
   * @param cause - 原始错误
   * @returns CoreError实例
   */
  static externalService(
    service: string,
    message: string,
    details?: Record<string, unknown>,
    context?: ErrorContext,
    cause?: Error,
  ): CoreError {
    return CoreErrorFactory.externalService(service, message, details, context, cause);
  }

  /**
   * 创建请求体过大错误
   * @param resource - 资源名称
   * @param size - 实际大小
   * @param maxSize - 最大允许大小
   * @param context - 错误上下文
   * @returns CoreError实例
   */
  static payloadTooLarge(
    resource: string = 'Request payload',
    size?: number,
    maxSize?: number,
    context?: ErrorContext,
  ): CoreError {
    return CoreErrorFactory.payloadTooLarge(resource, size, maxSize, context);
  }

  /**
   * 创建文件过大错误
   * @param filename - 文件名
   * @param size - 实际大小
   * @param maxSize - 最大允许大小
   * @param context - 错误上下文
   * @returns CoreError实例
   */
  static fileTooLarge(
    filename?: string,
    size?: number,
    maxSize?: number,
    context?: ErrorContext,
  ): CoreError {
    return CoreErrorFactory.fileTooLarge(filename, size, maxSize, context);
  }

  /**
   * 创建不支持的文件类型错误
   * @param filename - 文件名
   * @param fileType - 文件类型
   * @param supportedTypes - 支持的文件类型列表
   * @param context - 错误上下文
   * @returns CoreError实例
   */
  static unsupportedFileType(
    filename?: string,
    fileType?: string,
    supportedTypes?: string[],
    context?: ErrorContext,
  ): CoreError {
    return CoreErrorFactory.unsupportedFileType(
      filename,
      fileType,
      supportedTypes,
      context,
    );
  }

  /**
   * 从原始错误创建错误
   * @param error - 原始错误
   * @param context - 错误上下文
   * @param defaultMessage - 默认错误消息
   * @returns CoreError实例
   */
  static fromError(
    error: Error,
    context?: ErrorContext,
    defaultMessage: string = 'An unexpected error occurred',
  ): CoreError {
    return CoreErrorFactory.fromError(error, context, defaultMessage);
  }

  /**
   * 从HTTP状态码创建错误
   * @param httpStatus - HTTP状态码
   * @param message - 错误消息
   * @param details - 错误详情
   * @param context - 错误上下文
   * @returns CoreError实例
   */
  static fromHttpStatus(
    httpStatus: number,
    message?: string,
    details?: Record<string, unknown>,
    context?: ErrorContext,
  ): CoreError {
    return CoreErrorFactory.fromHttpStatus(httpStatus, message, details, context);
  }

  // ==================== 向后兼容的方法 ====================

  /**
   * 创建验证错误（向后兼容）
   * @param message - 错误消息
   * @param details - 错误详情
   * @param context - 错误上下文
   * @returns CoreError实例
   */
  static createValidationError(
    message: string,
    details?: Record<string, unknown>,
    context?: ErrorContext,
  ): CoreError {
    return CoreErrorFactory.validation(message, details, context);
  }

  /**
   * 创建未找到错误（向后兼容）
   * @param resource - 资源名称
   * @param resourceId - 资源ID
   * @param context - 错误上下文
   * @returns CoreError实例
   */
  static createNotFoundError(
    resource: string,
    resourceId?: string,
    context?: ErrorContext,
  ): CoreError {
    return CoreErrorFactory.notFound(resource, resourceId, context);
  }

  /**
   * 创建未授权错误（向后兼容）
   * @param message - 错误消息
   * @param context - 错误上下文
   * @returns CoreError实例
   */
  static createUnauthorizedError(
    message: string = 'Unauthorized access',
    context?: ErrorContext,
  ): CoreError {
    return CoreErrorFactory.unauthorized(message, context);
  }

  /**
   * 创建禁止访问错误（向后兼容）
   * @param message - 错误消息
   * @param context - 错误上下文
   * @returns CoreError实例
   */
  static createForbiddenError(
    message: string = 'Access forbidden',
    context?: ErrorContext,
  ): CoreError {
    return CoreErrorFactory.forbidden(message, context);
  }

  /**
   * 创建冲突错误（向后兼容）
   * @param message - 错误消息
   * @param details - 错误详情
   * @param context - 错误上下文
   * @returns CoreError实例
   */
  static createConflictError(
    message: string = 'Resource conflict',
    details?: Record<string, unknown>,
    context?: ErrorContext,
  ): CoreError {
    return CoreErrorFactory.conflict(message, details, context);
  }

  /**
   * 创建业务规则错误（向后兼容）
   * @param message - 错误消息
   * @param details - 错误详情
   * @param context - 错误上下文
   * @returns CoreError实例
   */
  static createBusinessRuleError(
    message: string,
    details?: Record<string, unknown>,
    context?: ErrorContext,
  ): CoreError {
    return CoreErrorFactory.businessRule(message, details, context);
  }

  /**
   * 创建基础设施错误（向后兼容）
   * @param message - 错误消息
   * @param details - 错误详情
   * @param context - 错误上下文
   * @param cause - 原始错误
   * @returns CoreError实例
   */
  static createInfrastructureError(
    message: string,
    details?: Record<string, unknown>,
    context?: ErrorContext,
    cause?: Error,
  ): CoreError {
    return CoreErrorFactory.infrastructure(message, details, context, cause);
  }

  /**
   * 创建配置错误（向后兼容）
   * @param message - 错误消息
   * @param details - 错误详情
   * @param context - 错误上下文
   * @returns CoreError实例
   */
  static createConfigurationError(
    message: string,
    details?: Record<string, unknown>,
    context?: ErrorContext,
  ): CoreError {
    return CoreErrorFactory.configuration(message, details, context);
  }

  /**
   * 创建内部服务器错误（向后兼容）
   * @param message - 错误消息
   * @param details - 错误详情
   * @param context - 错误上下文
   * @param cause - 原始错误
   * @returns CoreError实例
   */
  static createInternalServerError(
    message: string = 'Internal server error',
    details?: Record<string, unknown>,
    context?: ErrorContext,
    cause?: Error,
  ): CoreError {
    return CoreErrorFactory.internal(message, details, context, cause);
  }

  /**
   * 创建服务不可用错误（向后兼容）
   * @param service - 服务名称
   * @param context - 错误上下文
   * @returns CoreError实例
   */
  static createServiceUnavailableError(
    service: string = 'Service',
    context?: ErrorContext,
  ): CoreError {
    return CoreErrorFactory.serviceUnavailable(service, context);
  }

  /**
   * 创建数据库错误（向后兼容）
   * @param message - 错误消息
   * @param details - 错误详情
   * @param context - 错误上下文
   * @param cause - 原始错误
   * @returns CoreError实例
   */
  static createDatabaseError(
    message: string,
    details?: Record<string, unknown>,
    context?: ErrorContext,
    cause?: Error,
  ): CoreError {
    return CoreErrorFactory.database(message, details, context, cause);
  }

  /**
   * 创建网络错误（向后兼容）
   * @param message - 错误消息
   * @param details - 错误详情
   * @param context - 错误上下文
   * @param cause - 原始错误
   * @returns CoreError实例
   */
  static createNetworkError(
    message: string,
    details?: Record<string, unknown>,
    context?: ErrorContext,
    cause?: Error,
  ): CoreError {
    return CoreErrorFactory.network(message, details, context, cause);
  }

  /**
   * 创建外部服务错误（向后兼容）
   * @param service - 服务名称
   * @param message - 错误消息
   * @param details - 错误详情
   * @param context - 错误上下文
   * @param cause - 原始错误
   * @returns CoreError实例
   */
  static createExternalServiceError(
    service: string,
    message: string,
    details?: Record<string, unknown>,
    context?: ErrorContext,
    cause?: Error,
  ): CoreError {
    return CoreErrorFactory.externalService(service, message, details, context, cause);
  }

  /**
   * 创建请求体过大错误（向后兼容）
   * @param resource - 资源名称
   * @param size - 实际大小
   * @param maxSize - 最大允许大小
   * @param context - 错误上下文
   * @returns CoreError实例
   */
  static createPayloadTooLargeError(
    resource: string = 'Request payload',
    size?: number,
    maxSize?: number,
    context?: ErrorContext,
  ): CoreError {
    return CoreErrorFactory.payloadTooLarge(resource, size, maxSize, context);
  }

  /**
   * 创建文件过大错误（向后兼容）
   * @param filename - 文件名
   * @param size - 实际大小
   * @param maxSize - 最大允许大小
   * @param context - 错误上下文
   * @returns CoreError实例
   */
  static createFileTooLargeError(
    filename?: string,
    size?: number,
    maxSize?: number,
    context?: ErrorContext,
  ): CoreError {
    return CoreErrorFactory.fileTooLarge(filename, size, maxSize, context);
  }

  /**
   * 创建不支持的文件类型错误（向后兼容）
   * @param filename - 文件名
   * @param fileType - 文件类型
   * @param supportedTypes - 支持的文件类型列表
   * @param context - 错误上下文
   * @returns CoreError实例
   */
  static createUnsupportedFileTypeError(
    filename?: string,
    fileType?: string,
    supportedTypes?: string[],
    context?: ErrorContext,
  ): CoreError {
    return CoreErrorFactory.unsupportedFileType(
      filename,
      fileType,
      supportedTypes,
      context,
    );
  }

  /**
   * 创建文件上传失败错误（向后兼容）
   * @param filename - 文件名
   * @param reason - 失败原因
   * @param context - 错误上下文
   * @returns CoreError实例
   */
  static createFileUploadFailedError(
    filename?: string,
    reason?: string,
    context?: ErrorContext,
  ): CoreError {
    const message = reason
      ? `File upload failed: ${reason}`
      : 'File upload failed';
    return CoreErrorFactory.infrastructure(message, { filename, reason }, context);
  }

  /**
   * 从原始错误创建错误（向后兼容）
   * @param error - 原始错误
   * @param context - 错误上下文
   * @param defaultMessage - 默认错误消息
   * @returns CoreError实例
   */
  static createFromError(
    error: Error,
    context?: ErrorContext,
    defaultMessage?: string,
  ): CoreError {
    return CoreErrorFactory.fromError(error, context, defaultMessage);
  }

  // ==================== Unified错误方法（向后兼容） ====================

  /**
   * 创建统一验证错误（向后兼容）
   * @param message - 错误消息
   * @param details - 错误详情
   * @param context - 错误上下文
   * @returns CoreError实例
   */
  static createUnifiedValidationError(
    message: string,
    details?: Record<string, unknown>,
    context?: ErrorContext,
  ): CoreError {
    return CoreErrorFactory.validation(message, details, context);
  }

  /**
   * 创建统一数据库连接错误（向后兼容）
   * @param message - 错误消息
   * @param details - 错误详情
   * @param context - 错误上下文
   * @returns CoreError实例
   */
  static createUnifiedDatabaseConnectionError(
    message: string,
    details?: Record<string, unknown>,
    context?: ErrorContext,
  ): CoreError {
    return CoreErrorFactory.database(message, details, context);
  }

  /**
   * 创建统一网络连接错误（向后兼容）
   * @param message - 错误消息
   * @param details - 错误详情
   * @param context - 错误上下文
   * @returns CoreError实例
   */
  static createUnifiedNetworkConnectionError(
    message: string,
    details?: Record<string, unknown>,
    context?: ErrorContext,
  ): CoreError {
    return CoreErrorFactory.network(message, details, context);
  }

  /**
   * 创建统一文件过大错误（向后兼容）
   * @param filename - 文件名
   * @param size - 实际大小
   * @param maxSize - 最大允许大小
   * @param context - 错误上下文
   * @returns CoreError实例
   */
  static createUnifiedFileTooLargeError(
    filename?: string,
    size?: number,
    maxSize?: number,
    context?: ErrorContext,
  ): CoreError {
    return CoreErrorFactory.fileTooLarge(filename, size, maxSize, context);
  }

  /**
   * 创建统一不支持的文件类型错误（向后兼容）
   * @param filename - 文件名
   * @param fileType - 文件类型
   * @param supportedTypes - 支持的文件类型列表
   * @param context - 错误上下文
   * @returns CoreError实例
   */
  static createUnifiedUnsupportedFileTypeError(
    filename?: string,
    fileType?: string,
    supportedTypes?: string[],
    context?: ErrorContext,
  ): CoreError {
    return CoreErrorFactory.unsupportedFileType(
      filename,
      fileType,
      supportedTypes,
      context,
    );
  }

  /**
   * 创建统一未授权错误（向后兼容）
   * @param message - 错误消息
   * @param context - 错误上下文
   * @returns CoreError实例
   */
  static createUnifiedUnauthorizedError(
    message: string = 'Unauthorized access',
    context?: ErrorContext,
  ): CoreError {
    return CoreErrorFactory.unauthorized(message, context);
  }

  /**
   * 创建统一禁止访问错误（向后兼容）
   * @param message - 错误消息
   * @param context - 错误上下文
   * @returns CoreError实例
   */
  static createUnifiedForbiddenError(
    message: string = 'Access forbidden',
    context?: ErrorContext,
  ): CoreError {
    return CoreErrorFactory.forbidden(message, context);
  }

  /**
   * 创建统一未找到错误（向后兼容）
   * @param resource - 资源名称
   * @param resourceId - 资源ID
   * @param context - 错误上下文
   * @returns CoreError实例
   */
  static createUnifiedNotFoundError(
    resource: string,
    resourceId?: string,
    context?: ErrorContext,
  ): CoreError {
    return CoreErrorFactory.notFound(resource, resourceId, context);
  }

  // ==================== 事务错误方法 ====================

  /**
   * 从事务错误创建错误（向后兼容）
   * @param error - 原始错误
   * @param context - 错误上下文
   * @returns CoreError实例
   */
  static fromTransactionError(error: Error, context?: ErrorContext): CoreError {
    return CoreErrorFactory.fromError(error, context, 'Transaction error occurred');
  }

  /**
   * 从错误分类创建错误（向后兼容）
   * @param category - 错误分类
   * @param message - 错误消息
   * @param context - 错误上下文
   * @returns CoreError实例
   */
  static fromErrorCategory(
    category: string,
    message: string,
    context?: ErrorContext,
  ): CoreError {
    // 将错误分类映射到错误类型
    let errorType: ErrorType;
    switch (category.toLowerCase()) {
      case 'validation':
        errorType = ErrorType.VALIDATION_ERROR;
        break;
      case 'database':
        errorType = ErrorType.DATABASE_ERROR;
        break;
      case 'network':
        errorType = ErrorType.NETWORK_ERROR;
        break;
      case 'infrastructure':
        errorType = ErrorType.INFRASTRUCTURE_ERROR;
        break;
      case 'business':
        errorType = ErrorType.BUSINESS_RULE_VIOLATION;
        break;
      default:
        errorType = ErrorType.INTERNAL_ERROR;
    }

    return new CoreError(errorType, message, { context });
  }

  // ==================== 错误分析工具 ====================

  /**
   * 判断错误是否应该重试
   * @param error - 错误对象
   * @returns 是否应该重试
   */
  static shouldRetry(error: Error): boolean {
    if (error instanceof CoreError) {
      return error.isTemporary();
    }

    // 对于其他类型的错误，根据消息推断
    const errorType = inferErrorTypeFromMessage(error.message);
    return (
      errorType === ErrorType.NETWORK_ERROR ||
      errorType === ErrorType.DATABASE_ERROR ||
      errorType === ErrorType.EXTERNAL_SERVICE_ERROR
    );
  }

  /**
   * 判断错误是否应该发送告警
   * @param error - 错误对象
   * @returns 是否应该发送告警
   */
  static shouldAlert(error: Error): boolean {
    if (error instanceof CoreError) {
      return error.shouldAlert;
    }

    // 对于其他类型的错误，根据消息推断
    const errorType = inferErrorTypeFromMessage(error.message);
    return (
      errorType === ErrorType.CONFIGURATION_ERROR ||
      errorType === ErrorType.INTERNAL_ERROR ||
      errorType === ErrorType.DATABASE_ERROR
    );
  }

  /**
   * 获取错误的严重级别
   * @param error - 错误对象
   * @returns 错误严重级别
   */
  static getErrorSeverity(error: Error): string {
    if (error instanceof CoreError) {
      return error.severity;
    }

    // 对于其他类型的错误，根据消息推断
    const errorType = inferErrorTypeFromMessage(error.message);
    const config = getErrorTypeConfig(errorType);
    return config.defaultSeverity;
  }

  /**
   * 获取错误的恢复策略
   * @param error - 错误对象
   * @returns 错误恢复策略
   */
  static getRecoveryStrategy(error: Error): string {
    if (error instanceof CoreError) {
      return error.recoveryStrategy;
    }

    // 对于其他类型的错误，根据消息推断
    const errorType = inferErrorTypeFromMessage(error.message);
    const config = getErrorTypeConfig(errorType);
    return config.defaultRecoveryStrategy;
  }

  /**
   * 合并错误上下文
   * @param baseContext - 基础上下文
   * @param additionalContext - 附加上下文
   * @returns 合并后的错误上下文
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
}

// 向后兼容的别名
export const SimplifiedErrorFactory = ErrorFactory;
