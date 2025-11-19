/**
 * 核心错误类型定义
 * 包含错误类型枚举、配置和相关工具函数
 */

/**
 * 错误严重级别
 */
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * 错误恢复策略
 */
export enum ErrorRecoveryStrategy {
  NONE = 'NONE',
  RETRY = 'RETRY',
  MANUAL = 'MANUAL',
  FALLBACK = 'FALLBACK',
}

/**
 * 错误类型枚举
 * 简化的错误分类，覆盖所有场景
 */
export enum ErrorType {
  // 验证错误 (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED = 'MISSING_REQUIRED',

  // 权限错误 (401, 403)
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',

  // 资源错误 (404, 409)
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',

  // 限制错误 (413, 429)
  PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
  RATE_LIMITED = 'RATE_LIMITED',

  // 服务器错误 (500, 503)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

  // 特定业务错误
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  INFRASTRUCTURE_ERROR = 'INFRASTRUCTURE_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',

  // 外部服务错误
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

/**
 * 错误上下文
 */
export interface ErrorContext {
  operation?: string;
  userId?: string;
  requestId?: string;
  transactionId?: string;
  resourceId?: string;
  sessionId?: string;
  traceId?: string;
  module?: string;
  function?: string;
  line?: number;
  file?: string;
  [key: string]: unknown;
}

/**
 * 错误选项
 */
export interface ErrorOptions {
  /** 错误代码（向后兼容） */
  code?: string;
  cause?: Error;
  context?: ErrorContext;
  details?: Record<string, unknown>;
  severity?: ErrorSeverity;
  recoveryStrategy?: ErrorRecoveryStrategy;
  httpStatus?: number;
  shouldMonitor?: boolean;
  shouldAlert?: boolean;
  shouldLogStack?: boolean;
  errorId?: string;
}

/**
 * 错误类型配置
 */
export interface ErrorTypeConfig {
  type: ErrorType;
  defaultHttpStatus: number;
  defaultSeverity: ErrorSeverity;
  defaultRecoveryStrategy: ErrorRecoveryStrategy;
  shouldMonitor: boolean;
  shouldAlert: boolean;
  shouldLogStack: boolean;
}

/**
 * 错误类型配置映射
 */
export const ERROR_TYPE_CONFIGS: Record<ErrorType, ErrorTypeConfig> = {
  [ErrorType.VALIDATION_ERROR]: {
    type: ErrorType.VALIDATION_ERROR,
    defaultHttpStatus: 400,
    defaultSeverity: ErrorSeverity.LOW,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.NONE,
    shouldMonitor: false,
    shouldAlert: false,
    shouldLogStack: false,
  },
  [ErrorType.INVALID_INPUT]: {
    type: ErrorType.INVALID_INPUT,
    defaultHttpStatus: 400,
    defaultSeverity: ErrorSeverity.LOW,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.NONE,
    shouldMonitor: false,
    shouldAlert: false,
    shouldLogStack: false,
  },
  [ErrorType.MISSING_REQUIRED]: {
    type: ErrorType.MISSING_REQUIRED,
    defaultHttpStatus: 400,
    defaultSeverity: ErrorSeverity.LOW,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.NONE,
    shouldMonitor: false,
    shouldAlert: false,
    shouldLogStack: false,
  },
  [ErrorType.UNAUTHORIZED]: {
    type: ErrorType.UNAUTHORIZED,
    defaultHttpStatus: 401,
    defaultSeverity: ErrorSeverity.MEDIUM,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.NONE,
    shouldMonitor: true,
    shouldAlert: false,
    shouldLogStack: false,
  },
  [ErrorType.FORBIDDEN]: {
    type: ErrorType.FORBIDDEN,
    defaultHttpStatus: 403,
    defaultSeverity: ErrorSeverity.MEDIUM,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.NONE,
    shouldMonitor: true,
    shouldAlert: false,
    shouldLogStack: false,
  },
  [ErrorType.NOT_FOUND]: {
    type: ErrorType.NOT_FOUND,
    defaultHttpStatus: 404,
    defaultSeverity: ErrorSeverity.LOW,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.NONE,
    shouldMonitor: false,
    shouldAlert: false,
    shouldLogStack: false,
  },
  [ErrorType.CONFLICT]: {
    type: ErrorType.CONFLICT,
    defaultHttpStatus: 409,
    defaultSeverity: ErrorSeverity.MEDIUM,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.NONE,
    shouldMonitor: false,
    shouldAlert: false,
    shouldLogStack: false,
  },
  [ErrorType.PAYLOAD_TOO_LARGE]: {
    type: ErrorType.PAYLOAD_TOO_LARGE,
    defaultHttpStatus: 413,
    defaultSeverity: ErrorSeverity.MEDIUM,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.NONE,
    shouldMonitor: false,
    shouldAlert: false,
    shouldLogStack: false,
  },
  [ErrorType.RATE_LIMITED]: {
    type: ErrorType.RATE_LIMITED,
    defaultHttpStatus: 429,
    defaultSeverity: ErrorSeverity.MEDIUM,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.RETRY,
    shouldMonitor: true,
    shouldAlert: false,
    shouldLogStack: false,
  },
  [ErrorType.INTERNAL_ERROR]: {
    type: ErrorType.INTERNAL_ERROR,
    defaultHttpStatus: 500,
    defaultSeverity: ErrorSeverity.HIGH,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.MANUAL,
    shouldMonitor: true,
    shouldAlert: true,
    shouldLogStack: true,
  },
  [ErrorType.SERVICE_UNAVAILABLE]: {
    type: ErrorType.SERVICE_UNAVAILABLE,
    defaultHttpStatus: 503,
    defaultSeverity: ErrorSeverity.HIGH,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.RETRY,
    shouldMonitor: true,
    shouldAlert: true,
    shouldLogStack: true,
  },
  [ErrorType.BUSINESS_RULE_VIOLATION]: {
    type: ErrorType.BUSINESS_RULE_VIOLATION,
    defaultHttpStatus: 422,
    defaultSeverity: ErrorSeverity.MEDIUM,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.NONE,
    shouldMonitor: false,
    shouldAlert: false,
    shouldLogStack: false,
  },
  [ErrorType.INFRASTRUCTURE_ERROR]: {
    type: ErrorType.INFRASTRUCTURE_ERROR,
    defaultHttpStatus: 503,
    defaultSeverity: ErrorSeverity.HIGH,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.RETRY,
    shouldMonitor: true,
    shouldAlert: true,
    shouldLogStack: true,
  },
  [ErrorType.CONFIGURATION_ERROR]: {
    type: ErrorType.CONFIGURATION_ERROR,
    defaultHttpStatus: 500,
    defaultSeverity: ErrorSeverity.CRITICAL,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.MANUAL,
    shouldMonitor: true,
    shouldAlert: true,
    shouldLogStack: true,
  },
  [ErrorType.EXTERNAL_SERVICE_ERROR]: {
    type: ErrorType.EXTERNAL_SERVICE_ERROR,
    defaultHttpStatus: 503,
    defaultSeverity: ErrorSeverity.HIGH,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.RETRY,
    shouldMonitor: true,
    shouldAlert: true,
    shouldLogStack: true,
  },
  [ErrorType.DATABASE_ERROR]: {
    type: ErrorType.DATABASE_ERROR,
    defaultHttpStatus: 503,
    defaultSeverity: ErrorSeverity.HIGH,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.RETRY,
    shouldMonitor: true,
    shouldAlert: true,
    shouldLogStack: true,
  },
  [ErrorType.NETWORK_ERROR]: {
    type: ErrorType.NETWORK_ERROR,
    defaultHttpStatus: 503,
    defaultSeverity: ErrorSeverity.HIGH,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.RETRY,
    shouldMonitor: true,
    shouldAlert: false,
    shouldLogStack: true,
  },
};

/**
 * 获取错误类型配置
 * @param errorType - 错误类型
 * @returns 错误类型配置
 */
export function getErrorTypeConfig(errorType: ErrorType): ErrorTypeConfig {
  return ERROR_TYPE_CONFIGS[errorType];
}

/**
 * 根据HTTP状态码获取错误类型
 * @param httpStatus - HTTP状态码
 * @returns 对应的错误类型
 */
export function getErrorTypeFromHttpStatus(httpStatus: number): ErrorType {
  switch (httpStatus) {
    case 400:
      return ErrorType.VALIDATION_ERROR;
    case 401:
      return ErrorType.UNAUTHORIZED;
    case 403:
      return ErrorType.FORBIDDEN;
    case 404:
      return ErrorType.NOT_FOUND;
    case 409:
      return ErrorType.CONFLICT;
    case 413:
      return ErrorType.PAYLOAD_TOO_LARGE;
    case 422:
      return ErrorType.BUSINESS_RULE_VIOLATION;
    case 429:
      return ErrorType.RATE_LIMITED;
    case 500:
      return ErrorType.INTERNAL_ERROR;
    case 503:
      return ErrorType.SERVICE_UNAVAILABLE;
    default:
      return ErrorType.INTERNAL_ERROR;
  }
}

/**
 * 根据错误消息关键词推断错误类型
 * @param message - 错误消息
 * @returns 推断出的错误类型
 */
export function inferErrorTypeFromMessage(message: string): ErrorType {
  const lowerMessage = message.toLowerCase();

  // 网络相关错误
  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('connection') ||
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('fetch failed')
  ) {
    return ErrorType.NETWORK_ERROR;
  }

  // 数据库相关错误
  if (
    lowerMessage.includes('database') ||
    lowerMessage.includes('sql') ||
    lowerMessage.includes('constraint') ||
    lowerMessage.includes('query')
  ) {
    return ErrorType.DATABASE_ERROR;
  }

  // 验证相关错误
  if (
    lowerMessage.includes('validation') ||
    lowerMessage.includes('invalid') ||
    lowerMessage.includes('required') ||
    lowerMessage.includes('missing')
  ) {
    return ErrorType.VALIDATION_ERROR;
  }

  // 权限相关错误
  if (
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('forbidden') ||
    lowerMessage.includes('permission') ||
    lowerMessage.includes('access denied')
  ) {
    return lowerMessage.includes('unauthorized')
      ? ErrorType.UNAUTHORIZED
      : ErrorType.FORBIDDEN;
  }

  // 资源相关错误
  if (
    lowerMessage.includes('not found') ||
    lowerMessage.includes('does not exist')
  ) {
    return ErrorType.NOT_FOUND;
  }

  if (
    lowerMessage.includes('conflict') ||
    lowerMessage.includes('already exists')
  ) {
    return ErrorType.CONFLICT;
  }

  // 大小限制错误
  if (
    lowerMessage.includes('too large') ||
    lowerMessage.includes('size') ||
    lowerMessage.includes('limit')
  ) {
    return ErrorType.PAYLOAD_TOO_LARGE;
  }

  // 配置错误
  if (
    lowerMessage.includes('configuration') ||
    lowerMessage.includes('config')
  ) {
    return ErrorType.CONFIGURATION_ERROR;
  }

  // 默认为内部错误
  return ErrorType.INTERNAL_ERROR;
}

/**
 * 获取HTTP状态码的默认消息
 * @param httpStatus - HTTP状态码
 * @returns 默认错误消息
 */
export function getDefaultMessageForHttpStatus(httpStatus: number): string {
  switch (httpStatus) {
    case 400:
      return 'Bad request';
    case 401:
      return 'Unauthorized';
    case 403:
      return 'Forbidden';
    case 404:
      return 'Not found';
    case 409:
      return 'Conflict';
    case 413:
      return 'Payload too large';
    case 422:
      return 'Unprocessable entity';
    case 429:
      return 'Too many requests';
    case 500:
      return 'Internal server error';
    case 503:
      return 'Service unavailable';
    default:
      return 'An error occurred';
  }
}
