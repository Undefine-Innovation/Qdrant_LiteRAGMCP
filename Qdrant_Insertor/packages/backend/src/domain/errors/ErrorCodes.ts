/**
 * 统一错误代码定义
 * @fileoverview 定义系统中所有错误代码和对应的配置
 * @author Error Handling System
 * @version 1.0.0
 */

import { ErrorSeverity, ErrorRecoveryStrategy } from './CoreError.js';

// 定义本地类型
export enum BaseErrorType {
  DOMAIN = 'DOMAIN',
  APPLICATION = 'APPLICATION',
  INFRASTRUCTURE = 'INFRASTRUCTURE',
  SYSTEM = 'SYSTEM',
}

export enum DomainErrorSubType {
  VALIDATION = 'VALIDATION',
  BUSINESS_RULE = 'BUSINESS_RULE',
  AGGREGATE = 'AGGREGATE',
  ENTITY = 'ENTITY',
  VALUE_OBJECT = 'VALUE_OBJECT',
}

export enum ApplicationErrorSubType {
  USE_CASE = 'USE_CASE',
  SERVICE = 'SERVICE',
  PERMISSION = 'PERMISSION',
  WORKFLOW = 'WORKFLOW',
}

export enum InfrastructureErrorSubType {
  DATABASE = 'DATABASE',
  NETWORK = 'NETWORK',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  FILE_SYSTEM = 'FILE_SYSTEM',
  MESSAGE_QUEUE = 'MESSAGE_QUEUE',
  CACHE = 'CACHE',
}

export enum SystemErrorSubType {
  CONFIGURATION = 'CONFIGURATION',
  RESOURCE = 'RESOURCE',
  SECURITY = 'SECURITY',
  MONITORING = 'MONITORING',
}

export interface ErrorTypeConfig {
  code: string;
  defaultMessage: string;
  defaultHttpStatus: number;
  defaultSeverity: ErrorSeverity;
  defaultRecoveryStrategy: ErrorRecoveryStrategy;
  shouldLogStack: boolean;
  shouldMonitor: boolean;
  shouldAlert: boolean;
}

export interface ErrorTypeConfigMap {
  [code: string]: ErrorTypeConfig;
}

/**
 * 领域错误代码
 */
export const DOMAIN_ERROR_CODES = {
  // 验证错误
  VALIDATION_FAILED: 'DOMAIN.VALIDATION.FAILED',
  INVALID_INPUT: 'DOMAIN.VALIDATION.INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'DOMAIN.VALIDATION.MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'DOMAIN.VALIDATION.INVALID_FORMAT',
  CONSTRAINT_VIOLATION: 'DOMAIN.VALIDATION.CONSTRAINT_VIOLATION',

  // 业务规则错误
  BUSINESS_RULE_VIOLATION: 'DOMAIN.BUSINESS_RULE.VIOLATION',
  DUPLICATE_RESOURCE: 'DOMAIN.BUSINESS_RULE.DUPLICATE_RESOURCE',
  RESOURCE_NOT_FOUND: 'DOMAIN.BUSINESS_RULE.NOT_FOUND',
  INVALID_STATE_TRANSITION: 'DOMAIN.BUSINESS_RULE.INVALID_STATE_TRANSITION',
  OPERATION_NOT_ALLOWED: 'DOMAIN.BUSINESS_RULE.OPERATION_NOT_ALLOWED',

  // 聚合错误
  AGGREGATE_NOT_FOUND: 'DOMAIN.AGGREGATE.NOT_FOUND',
  AGGREGATE_INVALID: 'DOMAIN.AGGREGATE.INVALID',
  AGGREGATE_CONFLICT: 'DOMAIN.AGGREGATE.CONFLICT',

  // 实体错误
  ENTITY_NOT_FOUND: 'DOMAIN.ENTITY.NOT_FOUND',
  ENTITY_INVALID: 'DOMAIN.ENTITY.INVALID',
  ENTITY_CONCURRENT_MODIFICATION: 'DOMAIN.ENTITY.CONCURRENT_MODIFICATION',

  // 值对象错误
  VALUE_OBJECT_INVALID: 'DOMAIN.VALUE_OBJECT.INVALID',
  INVALID_ID_FORMAT: 'DOMAIN.VALUE_OBJECT.INVALID_ID_FORMAT',
  INVALID_COLLECTION_NAME: 'DOMAIN.VALUE_OBJECT.INVALID_COLLECTION_NAME',
  INVALID_DOCUMENT_CONTENT: 'DOMAIN.VALUE_OBJECT.INVALID_DOCUMENT_CONTENT',
} as const;

/**
 * 应用错误代码
 */
export const APPLICATION_ERROR_CODES = {
  // 用例错误
  USE_CASE_EXECUTION_FAILED: 'APPLICATION.USE_CASE.EXECUTION_FAILED',
  USE_CASE_INVALID_INPUT: 'APPLICATION.USE_CASE.INVALID_INPUT',
  USE_CASE_TIMEOUT: 'APPLICATION.USE_CASE.TIMEOUT',

  // 服务错误
  SERVICE_UNAVAILABLE: 'APPLICATION.SERVICE.UNAVAILABLE',
  SERVICE_TIMEOUT: 'APPLICATION.SERVICE.TIMEOUT',
  SERVICE_CONFIGURATION_ERROR: 'APPLICATION.SERVICE.CONFIGURATION_ERROR',

  // 权限错误
  UNAUTHORIZED: 'APPLICATION.PERMISSION.UNAUTHORIZED',
  FORBIDDEN: 'APPLICATION.PERMISSION.FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'APPLICATION.PERMISSION.INSUFFICIENT_PERMISSIONS',

  // 工作流错误
  WORKFLOW_FAILED: 'APPLICATION.WORKFLOW.FAILED',
  WORKFLOW_TIMEOUT: 'APPLICATION.WORKFLOW.TIMEOUT',
  WORKFLOW_INVALID_STATE: 'APPLICATION.WORKFLOW.INVALID_STATE',
  SYNC_FAILED: 'APPLICATION.WORKFLOW.SYNC_FAILED',
  RETRY_EXHAUSTED: 'APPLICATION.WORKFLOW.RETRY_EXHAUSTED',
} as const;

/**
 * 基础设施错误代码
 */
export const INFRASTRUCTURE_ERROR_CODES = {
  // 数据库错误
  DATABASE_CONNECTION_FAILED: 'INFRASTRUCTURE.DATABASE.CONNECTION_FAILED',
  DATABASE_TIMEOUT: 'INFRASTRUCTURE.DATABASE.TIMEOUT',
  DATABASE_CONSTRAINT_VIOLATION: 'INFRASTRUCTURE.DATABASE.CONSTRAINT_VIOLATION',
  DATABASE_QUERY_FAILED: 'INFRASTRUCTURE.DATABASE.QUERY_FAILED',
  TRANSACTION_FAILED: 'INFRASTRUCTURE.DATABASE.TRANSACTION_FAILED',
  TRANSACTION_ROLLBACK_FAILED:
    'INFRASTRUCTURE.DATABASE.TRANSACTION_ROLLBACK_FAILED',

  // 网络错误
  NETWORK_CONNECTION_FAILED: 'INFRASTRUCTURE.NETWORK.CONNECTION_FAILED',
  NETWORK_TIMEOUT: 'INFRASTRUCTURE.NETWORK.TIMEOUT',
  NETWORK_DNS_RESOLUTION_FAILED: 'INFRASTRUCTURE.NETWORK.DNS_RESOLUTION_FAILED',
  NETWORK_SERVICE_UNAVAILABLE: 'INFRASTRUCTURE.NETWORK.SERVICE_UNAVAILABLE',

  // 外部服务错误
  EXTERNAL_SERVICE_UNAVAILABLE: 'INFRASTRUCTURE.EXTERNAL_SERVICE.UNAVAILABLE',
  EXTERNAL_SERVICE_TIMEOUT: 'INFRASTRUCTURE.EXTERNAL_SERVICE.TIMEOUT',
  EXTERNAL_SERVICE_RATE_LIMITED: 'INFRASTRUCTURE.EXTERNAL_SERVICE.RATE_LIMITED',
  EXTERNAL_SERVICE_QUOTA_EXCEEDED:
    'INFRASTRUCTURE.EXTERNAL_SERVICE.QUOTA_EXCEEDED',
  EXTERNAL_SERVICE_INVALID_RESPONSE:
    'INFRASTRUCTURE.EXTERNAL_SERVICE.INVALID_RESPONSE',

  // Qdrant相关错误
  QDRANT_CONNECTION_FAILED:
    'INFRASTRUCTURE.EXTERNAL_SERVICE.QDRANT_CONNECTION_FAILED',
  QDRANT_CAPACITY_EXCEEDED:
    'INFRASTRUCTURE.EXTERNAL_SERVICE.QDRANT_CAPACITY_EXCEEDED',
  QDRANT_INVALID_VECTOR:
    'INFRASTRUCTURE.EXTERNAL_SERVICE.QDRANT_INVALID_VECTOR',
  QDRANT_COLLECTION_NOT_FOUND:
    'INFRASTRUCTURE.EXTERNAL_SERVICE.QDRANT_COLLECTION_NOT_FOUND',

  // 嵌入服务错误
  EMBEDDING_SERVICE_UNAVAILABLE:
    'INFRASTRUCTURE.EXTERNAL_SERVICE.EMBEDDING_SERVICE_UNAVAILABLE',
  EMBEDDING_RATE_LIMITED:
    'INFRASTRUCTURE.EXTERNAL_SERVICE.EMBEDDING_RATE_LIMITED',
  EMBEDDING_QUOTA_EXCEEDED:
    'INFRASTRUCTURE.EXTERNAL_SERVICE.EMBEDDING_QUOTA_EXCEEDED',
  EMBEDDING_INVALID_INPUT:
    'INFRASTRUCTURE.EXTERNAL_SERVICE.EMBEDDING_INVALID_INPUT',

  // 文件系统错误
  FILE_NOT_FOUND: 'INFRASTRUCTURE.FILE_SYSTEM.FILE_NOT_FOUND',
  FILE_ACCESS_DENIED: 'INFRASTRUCTURE.FILE_SYSTEM.ACCESS_DENIED',
  FILE_TOO_LARGE: 'INFRASTRUCTURE.FILE_SYSTEM.FILE_TOO_LARGE',
  UNSUPPORTED_FILE_TYPE: 'INFRASTRUCTURE.FILE_SYSTEM.UNSUPPORTED_FILE_TYPE',
  FILE_CORRUPTED: 'INFRASTRUCTURE.FILE_SYSTEM.FILE_CORRUPTED',
  DISK_SPACE_INSUFFICIENT: 'INFRASTRUCTURE.FILE_SYSTEM.DISK_SPACE_INSUFFICIENT',

  // 消息队列错误
  MESSAGE_QUEUE_CONNECTION_FAILED:
    'INFRASTRUCTURE.MESSAGE_QUEUE.CONNECTION_FAILED',
  MESSAGE_QUEUE_PUBLISH_FAILED: 'INFRASTRUCTURE.MESSAGE_QUEUE.PUBLISH_FAILED',
  MESSAGE_QUEUE_CONSUME_FAILED: 'INFRASTRUCTURE.MESSAGE_QUEUE.CONSUME_FAILED',

  // 缓存错误
  CACHE_CONNECTION_FAILED: 'INFRASTRUCTURE.CACHE.CONNECTION_FAILED',
  CACHE_OPERATION_FAILED: 'INFRASTRUCTURE.CACHE.OPERATION_FAILED',
} as const;

/**
 * 系统错误代码
 */
export const SYSTEM_ERROR_CODES = {
  // 配置错误
  CONFIGURATION_INVALID: 'SYSTEM.CONFIGURATION.INVALID',
  CONFIGURATION_MISSING: 'SYSTEM.CONFIGURATION.MISSING',
  ENVIRONMENT_VARIABLE_MISSING:
    'SYSTEM.CONFIGURATION.ENVIRONMENT_VARIABLE_MISSING',

  // 资源错误
  MEMORY_INSUFFICIENT: 'SYSTEM.RESOURCE.MEMORY_INSUFFICIENT',
  CPU_OVERLOAD: 'SYSTEM.RESOURCE.CPU_OVERLOAD',
  RESOURCE_EXHAUSTED: 'SYSTEM.RESOURCE.RESOURCE_EXHAUSTED',

  // 安全错误
  SECURITY_VIOLATION: 'SYSTEM.SECURITY.VIOLATION',
  AUTHENTICATION_FAILED: 'SYSTEM.SECURITY.AUTHENTICATION_FAILED',
  AUTHORIZATION_FAILED: 'SYSTEM.SECURITY.AUTHORIZATION_FAILED',
  TOKEN_EXPIRED: 'SYSTEM.SECURITY.TOKEN_EXPIRED',
  TOKEN_INVALID: 'SYSTEM.SECURITY.TOKEN_INVALID',

  // 监控错误
  MONITORING_SYSTEM_FAILED: 'SYSTEM.MONITORING.SYSTEM_FAILED',
  LOGGING_SYSTEM_FAILED: 'SYSTEM.MONITORING.LOGGING_FAILED',
  METRICS_COLLECTION_FAILED: 'SYSTEM.MONITORING.METRICS_COLLECTION_FAILED',
} as const;

/**
 * 所有错误代码的联合类型
 */
export type ErrorCode =
  | (typeof DOMAIN_ERROR_CODES)[keyof typeof DOMAIN_ERROR_CODES]
  | (typeof APPLICATION_ERROR_CODES)[keyof typeof APPLICATION_ERROR_CODES]
  | (typeof INFRASTRUCTURE_ERROR_CODES)[keyof typeof INFRASTRUCTURE_ERROR_CODES]
  | (typeof SYSTEM_ERROR_CODES)[keyof typeof SYSTEM_ERROR_CODES];

/**
 * 错误类型配置映射
 */
export const ERROR_TYPE_CONFIG_MAP: ErrorTypeConfigMap = {
  // 领域错误配置
  [DOMAIN_ERROR_CODES.VALIDATION_FAILED]: {
    code: DOMAIN_ERROR_CODES.VALIDATION_FAILED,
    defaultMessage: 'Validation failed',
    defaultHttpStatus: 422,
    defaultSeverity: ErrorSeverity.MEDIUM,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.NONE,
    shouldLogStack: false,
    shouldMonitor: false,
    shouldAlert: false,
  },

  [DOMAIN_ERROR_CODES.INVALID_INPUT]: {
    code: DOMAIN_ERROR_CODES.INVALID_INPUT,
    defaultMessage: 'Invalid input provided',
    defaultHttpStatus: 400,
    defaultSeverity: ErrorSeverity.LOW,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.NONE,
    shouldLogStack: false,
    shouldMonitor: true,
    shouldAlert: false,
  },

  [DOMAIN_ERROR_CODES.RESOURCE_NOT_FOUND]: {
    code: DOMAIN_ERROR_CODES.RESOURCE_NOT_FOUND,
    defaultMessage: 'Resource not found',
    defaultHttpStatus: 404,
    defaultSeverity: ErrorSeverity.LOW,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.NONE,
    shouldLogStack: false,
    shouldMonitor: true,
    shouldAlert: false,
  },

  [DOMAIN_ERROR_CODES.BUSINESS_RULE_VIOLATION]: {
    code: DOMAIN_ERROR_CODES.BUSINESS_RULE_VIOLATION,
    defaultMessage: 'Business rule violation',
    defaultHttpStatus: 422,
    defaultSeverity: ErrorSeverity.MEDIUM,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.NONE,
    shouldLogStack: true,
    shouldMonitor: true,
    shouldAlert: false,
  },

  // 应用错误配置
  [APPLICATION_ERROR_CODES.UNAUTHORIZED]: {
    code: APPLICATION_ERROR_CODES.UNAUTHORIZED,
    defaultMessage: 'Unauthorized access',
    defaultHttpStatus: 401,
    defaultSeverity: ErrorSeverity.MEDIUM,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.NONE,
    shouldLogStack: true,
    shouldMonitor: true,
    shouldAlert: true,
  },

  [APPLICATION_ERROR_CODES.FORBIDDEN]: {
    code: APPLICATION_ERROR_CODES.FORBIDDEN,
    defaultMessage: 'Access forbidden',
    defaultHttpStatus: 403,
    defaultSeverity: ErrorSeverity.MEDIUM,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.NONE,
    shouldLogStack: true,
    shouldMonitor: true,
    shouldAlert: true,
  },

  [APPLICATION_ERROR_CODES.SERVICE_UNAVAILABLE]: {
    code: APPLICATION_ERROR_CODES.SERVICE_UNAVAILABLE,
    defaultMessage: 'Service unavailable',
    defaultHttpStatus: 503,
    defaultSeverity: ErrorSeverity.HIGH,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.RETRY,
    shouldLogStack: true,
    shouldMonitor: true,
    shouldAlert: true,
  },

  [APPLICATION_ERROR_CODES.SYNC_FAILED]: {
    code: APPLICATION_ERROR_CODES.SYNC_FAILED,
    defaultMessage: 'Synchronization failed',
    defaultHttpStatus: 503,
    defaultSeverity: ErrorSeverity.HIGH,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.RETRY,
    shouldLogStack: true,
    shouldMonitor: false,
    shouldAlert: true,
  },

  // 基础设施错误配置
  [INFRASTRUCTURE_ERROR_CODES.DATABASE_CONNECTION_FAILED]: {
    code: INFRASTRUCTURE_ERROR_CODES.DATABASE_CONNECTION_FAILED,
    defaultMessage: 'Database connection failed',
    defaultHttpStatus: 503,
    defaultSeverity: ErrorSeverity.HIGH,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.RETRY,
    shouldLogStack: true,
    shouldMonitor: true,
    shouldAlert: true,
  },

  [INFRASTRUCTURE_ERROR_CODES.DATABASE_TIMEOUT]: {
    code: INFRASTRUCTURE_ERROR_CODES.DATABASE_TIMEOUT,
    defaultMessage: 'Database operation timeout',
    defaultHttpStatus: 503,
    defaultSeverity: ErrorSeverity.HIGH,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.RETRY,
    shouldLogStack: true,
    shouldMonitor: true,
    shouldAlert: true,
  },

  [INFRASTRUCTURE_ERROR_CODES.NETWORK_CONNECTION_FAILED]: {
    code: INFRASTRUCTURE_ERROR_CODES.NETWORK_CONNECTION_FAILED,
    defaultMessage: 'Network connection failed',
    defaultHttpStatus: 503,
    defaultSeverity: ErrorSeverity.HIGH,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.RETRY,
    shouldLogStack: true,
    shouldMonitor: true,
    shouldAlert: true,
  },

  [INFRASTRUCTURE_ERROR_CODES.EXTERNAL_SERVICE_UNAVAILABLE]: {
    code: INFRASTRUCTURE_ERROR_CODES.EXTERNAL_SERVICE_UNAVAILABLE,
    defaultMessage: 'External service unavailable',
    defaultHttpStatus: 503,
    defaultSeverity: ErrorSeverity.HIGH,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.FALLBACK,
    shouldLogStack: true,
    shouldMonitor: true,
    shouldAlert: true,
  },

  [INFRASTRUCTURE_ERROR_CODES.EXTERNAL_SERVICE_RATE_LIMITED]: {
    code: INFRASTRUCTURE_ERROR_CODES.EXTERNAL_SERVICE_RATE_LIMITED,
    defaultMessage: 'External service rate limit exceeded',
    defaultHttpStatus: 429,
    defaultSeverity: ErrorSeverity.MEDIUM,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.RETRY,
    shouldLogStack: true,
    shouldMonitor: true,
    shouldAlert: false,
  },

  [INFRASTRUCTURE_ERROR_CODES.FILE_TOO_LARGE]: {
    code: INFRASTRUCTURE_ERROR_CODES.FILE_TOO_LARGE,
    defaultMessage: 'File size exceeds maximum limit',
    defaultHttpStatus: 413,
    defaultSeverity: ErrorSeverity.LOW,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.NONE,
    shouldLogStack: false,
    shouldMonitor: true,
    shouldAlert: false,
  },

  [INFRASTRUCTURE_ERROR_CODES.UNSUPPORTED_FILE_TYPE]: {
    code: INFRASTRUCTURE_ERROR_CODES.UNSUPPORTED_FILE_TYPE,
    defaultMessage: 'Unsupported file type',
    defaultHttpStatus: 422,
    defaultSeverity: ErrorSeverity.LOW,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.NONE,
    shouldLogStack: false,
    shouldMonitor: true,
    shouldAlert: false,
  },

  // 系统错误配置
  [SYSTEM_ERROR_CODES.CONFIGURATION_INVALID]: {
    code: SYSTEM_ERROR_CODES.CONFIGURATION_INVALID,
    defaultMessage: 'Invalid system configuration',
    defaultHttpStatus: 500,
    defaultSeverity: ErrorSeverity.CRITICAL,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.MANUAL,
    shouldLogStack: true,
    shouldMonitor: true,
    shouldAlert: true,
  },

  [SYSTEM_ERROR_CODES.MEMORY_INSUFFICIENT]: {
    code: SYSTEM_ERROR_CODES.MEMORY_INSUFFICIENT,
    defaultMessage: 'Insufficient memory',
    defaultHttpStatus: 503,
    defaultSeverity: ErrorSeverity.CRITICAL,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.MANUAL,
    shouldLogStack: true,
    shouldMonitor: true,
    shouldAlert: true,
  },

  [SYSTEM_ERROR_CODES.SECURITY_VIOLATION]: {
    code: SYSTEM_ERROR_CODES.SECURITY_VIOLATION,
    defaultMessage: 'Security violation detected',
    defaultHttpStatus: 403,
    defaultSeverity: ErrorSeverity.CRITICAL,
    defaultRecoveryStrategy: ErrorRecoveryStrategy.MANUAL,
    shouldLogStack: true,
    shouldMonitor: true,
    shouldAlert: true,
  },
};

/**
 * 获取错误配置
 * @param code 错误代码
 * @returns 错误配置
 */
export function getErrorTypeConfig(code: ErrorCode): ErrorTypeConfig {
  return (
    ERROR_TYPE_CONFIG_MAP[code] || {
      code,
      defaultMessage: 'Unknown error occurred',
      defaultHttpStatus: 500,
      defaultSeverity: ErrorSeverity.MEDIUM,
      defaultRecoveryStrategy: ErrorRecoveryStrategy.NONE,
      shouldLogStack: true,
      shouldMonitor: true,
      shouldAlert: false,
    }
  );
}

/**
 * 判断是否为领域错误
 * @param code 错误代码
 * @returns 是否为领域错误
 */
export function isDomainError(code: ErrorCode): boolean {
  return code.startsWith('DOMAIN.');
}

/**
 * 判断是否为应用错误
 * @param code 错误代码
 * @returns 是否为应用错误
 */
export function isApplicationError(code: ErrorCode): boolean {
  return code.startsWith('APPLICATION.');
}

/**
 * 判断是否为基础设施错误
 * @param code 错误代码
 * @returns 是否为基础设施错误
 */
export function isInfrastructureError(code: ErrorCode): boolean {
  return code.startsWith('INFRASTRUCTURE.');
}

/**
 * 判断是否为系统错误
 * @param code 错误代码
 * @returns 是否为系统错误
 */
export function isSystemError(code: ErrorCode): boolean {
  return code.startsWith('SYSTEM.');
}

/**
 * 获取错误的基础类型
 * @param code 错误代码
 * @returns 基础错误类型
 */
export function getBaseErrorType(code: ErrorCode): BaseErrorType {
  if (isDomainError(code)) return BaseErrorType.DOMAIN;
  if (isApplicationError(code)) return BaseErrorType.APPLICATION;
  if (isInfrastructureError(code)) return BaseErrorType.INFRASTRUCTURE;
  if (isSystemError(code)) return BaseErrorType.SYSTEM;

  return BaseErrorType.SYSTEM; // 默认为系统错误
}
