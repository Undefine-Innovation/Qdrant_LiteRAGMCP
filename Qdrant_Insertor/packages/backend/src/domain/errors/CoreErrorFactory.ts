/**
 * 核心错误工厂方法
 * 包含创建各种类型错误的静态方法
 */

import {
  CoreError,
  ErrorType,
  ErrorContext,
  getErrorTypeFromHttpStatus,
  inferErrorTypeFromMessage,
  getDefaultMessageForHttpStatus,
} from './CoreError.js';

/**
 * 核心错误工厂类
 * 提供创建各种类型错误的静态方法
 */
export class CoreErrorFactory {
  /**
   * 创建验证错误
   * @param message - 错误消息
   * @param details - 额外的错误详情
   * @param context - 错误上下文信息
   * @returns CoreError 实例
   */
  static validation(
    message: string,
    details?: Record<string, unknown>,
    context?: ErrorContext,
  ): CoreError {
    return new CoreError(ErrorType.VALIDATION_ERROR, message, {
      details,
      context,
    });
  }

  /**
   * 创建未找到错误
   * @param resource - 未找到的资源名称
   * @param resourceIdOrContext - 资源ID或错误上下文
   * @param context - 错误上下文信息
   * @returns CoreError 实例
   */
  static notFound(
    resource: string,
    resourceIdOrContext?: string | ErrorContext,
    context?: ErrorContext,
  ): CoreError {
    const resourceId =
      typeof resourceIdOrContext === 'string' ? resourceIdOrContext : undefined;
    const actualContext =
      typeof resourceIdOrContext === 'string' ? context : resourceIdOrContext;

    const message = resourceId
      ? `${resource} with ID '${resourceId}' not found`
      : `${resource} not found`;

    return new CoreError(ErrorType.NOT_FOUND, message, {
      details: { resource, resourceId },
      context: actualContext,
    });
  }

  /**
   * 创建未授权错误
   * @param message - 错误消息，默认为 'Unauthorized access'
   * @param context - 错误上下文信息
   * @returns CoreError 实例
   */
  static unauthorized(
    message: string = 'Unauthorized access',
    context?: ErrorContext,
  ): CoreError {
    return new CoreError(ErrorType.UNAUTHORIZED, message, { context });
  }

  /**
   * 创建禁止访问错误
   * @param message - 错误消息，默认为 'Access forbidden'
   * @param context - 错误上下文信息
   * @returns CoreError 实例
   */
  static forbidden(
    message: string = 'Access forbidden',
    context?: ErrorContext,
  ): CoreError {
    return new CoreError(ErrorType.FORBIDDEN, message, { context });
  }

  /**
   * 创建冲突错误
   * @param message - 错误消息，默认为 'Resource conflict'
   * @param details - 额外的错误详情
   * @param context - 错误上下文信息
   * @returns CoreError 实例
   */
  static conflict(
    message: string = 'Resource conflict',
    details?: Record<string, unknown>,
    context?: ErrorContext,
  ): CoreError {
    return new CoreError(ErrorType.CONFLICT, message, {
      details,
      context,
    });
  }

  /**
   * 创建业务规则错误
   * @param message - 错误消息
   * @param details - 额外的错误详情
   * @param context - 错误上下文信息
   * @returns CoreError 实例
   */
  static businessRule(
    message: string,
    details?: Record<string, unknown>,
    context?: ErrorContext,
  ): CoreError {
    return new CoreError(ErrorType.BUSINESS_RULE_VIOLATION, message, {
      details,
      context,
    });
  }

  /**
   * 创建基础设施错误
   * @param message - 错误消息
   * @param details - 额外的错误详情
   * @param context - 错误上下文信息
   * @param cause - 原始错误原因
   * @returns CoreError 实例
   */
  static infrastructure(
    message: string,
    details?: Record<string, unknown>,
    context?: ErrorContext,
    cause?: Error,
  ): CoreError {
    return new CoreError(ErrorType.INFRASTRUCTURE_ERROR, message, {
      details,
      context,
      cause,
    });
  }

  /**
   * 创建配置错误
   * @param message - 错误消息
   * @param details - 额外的错误详情
   * @param context - 错误上下文信息
   * @returns CoreError 实例
   */
  static configuration(
    message: string,
    details?: Record<string, unknown>,
    context?: ErrorContext,
  ): CoreError {
    return new CoreError(ErrorType.CONFIGURATION_ERROR, message, {
      details,
      context,
    });
  }

  /**
   * 创建内部服务器错误
   * @param message - 错误消息，默认为 'Internal server error'
   * @param details - 额外的错误详情
   * @param context - 错误上下文信息
   * @param cause - 原始错误原因
   * @returns CoreError 实例
   */
  static internal(
    message: string = 'Internal server error',
    details?: Record<string, unknown>,
    context?: ErrorContext,
    cause?: Error,
  ): CoreError {
    return new CoreError(ErrorType.INTERNAL_ERROR, message, {
      details,
      context,
      cause,
    });
  }

  /**
   * 创建服务不可用错误
   * @param service - 服务名称，默认为 'Service'
   * @param context - 错误上下文信息
   * @returns CoreError 实例
   */
  static serviceUnavailable(
    service: string = 'Service',
    context?: ErrorContext,
  ): CoreError {
    const message = `${service} is currently unavailable`;
    return new CoreError(ErrorType.SERVICE_UNAVAILABLE, message, {
      details: { service },
      context,
    });
  }

  /**
   * 创建数据库错误
   * @param message - 错误消息
   * @param details - 额外的错误详情
   * @param context - 错误上下文信息
   * @param cause - 原始错误原因
   * @returns CoreError 实例
   */
  static database(
    message: string,
    details?: Record<string, unknown>,
    context?: ErrorContext,
    cause?: Error,
  ): CoreError {
    return new CoreError(ErrorType.DATABASE_ERROR, message, {
      details,
      context,
      cause,
    });
  }

  /**
   * 创建网络错误
   * @param message - 错误消息
   * @param details - 额外的错误详情
   * @param context - 错误上下文信息
   * @param cause - 原始错误原因
   * @returns CoreError 实例
   */
  static network(
    message: string,
    details?: Record<string, unknown>,
    context?: ErrorContext,
    cause?: Error,
  ): CoreError {
    return new CoreError(ErrorType.NETWORK_ERROR, message, {
      details,
      context,
      cause,
    });
  }

  /**
   * 创建外部服务错误
   * @param service - 外部服务名称
   * @param message - 错误消息
   * @param details - 额外的错误详情
   * @param context - 错误上下文信息
   * @param cause - 原始错误原因
   * @returns CoreError 实例
   */
  static externalService(
    service: string,
    message: string,
    details?: Record<string, unknown>,
    context?: ErrorContext,
    cause?: Error,
  ): CoreError {
    return new CoreError(ErrorType.EXTERNAL_SERVICE_ERROR, message, {
      details: { service, ...details },
      context,
      cause,
    });
  }

  /**
   * 创建请求体过大错误
   * @param resource - 资源名称，默认为 'Request payload'
   * @param size - 实际大小
   * @param maxSize - 最大允许大小
   * @param context - 错误上下文信息
   * @returns CoreError 实例
   */
  static payloadTooLarge(
    resource: string = 'Request payload',
    size?: number,
    maxSize?: number,
    context?: ErrorContext,
  ): CoreError {
    const message = maxSize
      ? `${resource} exceeds maximum limit of ${maxSize} bytes`
      : `${resource} exceeds maximum limit`;

    return new CoreError(ErrorType.PAYLOAD_TOO_LARGE, message, {
      details: { resource, size, maxSize },
      context,
    });
  }

  /**
   * 创建文件过大错误
   * @param filename - 文件名
   * @param size - 文件实际大小
   * @param maxSize - 最大允许大小
   * @param context - 错误上下文信息
   * @returns CoreError 实例
   */
  static fileTooLarge(
    filename?: string,
    size?: number,
    maxSize?: number,
    context?: ErrorContext,
  ): CoreError {
    const message = maxSize
      ? `File size exceeds maximum limit of ${maxSize} bytes`
      : 'File size exceeds maximum limit';

    return new CoreError(ErrorType.PAYLOAD_TOO_LARGE, message, {
      details: { filename, size, maxSize },
      context,
    });
  }

  /**
   * 创建不支持的文件类型错误
   * @param filename - 文件名
   * @param fileType - 文件类型
   * @param supportedTypes - 支持的文件类型列表
   * @param context - 错误上下文信息
   * @returns CoreError 实例
   */
  static unsupportedFileType(
    filename?: string,
    fileType?: string,
    supportedTypes?: string[],
    context?: ErrorContext,
  ): CoreError {
    const message = fileType
      ? `File type '${fileType}' is not supported`
      : 'File type is not supported';

    return new CoreError(ErrorType.VALIDATION_ERROR, message, {
      details: { filename, fileType, supportedTypes },
      context,
    });
  }

  /**
   * 从原始错误创建核心错误
   * @param error - 原始错误对象
   * @param context - 错误上下文信息
   * @param defaultMessage - 默认错误消息，默认为 'An unexpected error occurred'
   * @returns CoreError 实例
   */
  static fromError(
    error: Error,
    context?: ErrorContext,
    defaultMessage: string = 'An unexpected error occurred',
  ): CoreError {
    if (error instanceof CoreError) {
      // 如果已经是CoreError，合并上下文并返回
      return new CoreError(error.type, error.message, {
        details: error.details,
        context: { ...error.context, ...context },
        cause: error.cause,
        httpStatus: error.httpStatus,
        severity: error.severity,
        recoveryStrategy: error.recoveryStrategy,
      });
    }

    // 推断错误类型
    const errorType = inferErrorTypeFromMessage(error.message);
    const message = error.message || defaultMessage;

    return new CoreError(errorType, message, {
      details: { originalErrorName: error.name },
      context,
      cause: error,
    });
  }

  /**
   * 从HTTP状态码创建错误
   * @param httpStatus - HTTP状态码
   * @param message - 错误消息，如果不提供则使用默认消息
   * @param details - 额外的错误详情
   * @param context - 错误上下文信息
   * @returns CoreError 实例
   */
  static fromHttpStatus(
    httpStatus: number,
    message?: string,
    details?: Record<string, unknown>,
    context?: ErrorContext,
  ): CoreError {
    const errorType = getErrorTypeFromHttpStatus(httpStatus);
    const errorMessage = message || getDefaultMessageForHttpStatus(httpStatus);

    return new CoreError(errorType, errorMessage, {
      details,
      context,
      httpStatus,
    });
  }
}

/**
 * 向后兼容的静态方法，直接添加到CoreError类上
 */
export function addStaticMethodsToCoreError(): void {
  const staticMethods = {
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
  };

  Object.assign(CoreError, staticMethods);
}
