/**
 * 错误类型枚举
 */
export enum ErrorType {
  // 临时错误 - 可以通过重试解决
  TEMPORARY = 'TEMPORARY',
  // 永久错误 - 重试无法解决
  PERMANENT = 'PERMANENT',
  // 未知错误 - 默认为临时错误，但有限制重试次数
  UNKNOWN = 'UNKNOWN',
}

/**
 * 具体错误分类
 */
export enum ErrorCategory {
  // 网络相关错误 - 临时
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_CONNECTION = 'NETWORK_CONNECTION',
  NETWORK_DNS = 'NETWORK_DNS',

  // 数据库相关错误
  DATABASE_CONNECTION = 'DATABASE_CONNECTION', // 临时
  DATABASE_CONSTRAINT = 'DATABASE_CONSTRAINT', // 永久
  DATABASE_TIMEOUT = 'DATABASE_TIMEOUT', // 临时

  // Qdrant相关错误
  QDRANT_CONNECTION = 'QDRANT_CONNECTION', // 临时
  QDRANT_CAPACITY = 'QDRANT_CAPACITY', // 临时
  QDRANT_INVALID_VECTOR = 'QDRANT_INVALID_VECTOR', // 永久

  // 嵌入生成相关错误
  EMBEDDING_RATE_LIMIT = 'EMBEDDING_RATE_LIMIT', // 临时
  EMBEDDING_QUOTA_EXCEEDED = 'EMBEDDING_QUOTA_EXCEEDED', // 永久
  EMBEDDING_INVALID_INPUT = 'EMBEDDING_INVALID_INPUT', // 永久
  EMBEDDING_SERVICE_UNAVAILABLE = 'EMBEDDING_SERVICE_UNAVAILABLE', // 临时

  // 文档处理相关错误
  DOCUMENT_NOT_FOUND = 'DOCUMENT_NOT_FOUND', // 永久
  DOCUMENT_CORRUPTED = 'DOCUMENT_CORRUPTED', // 永久
  DOCUMENT_TOO_LARGE = 'DOCUMENT_TOO_LARGE', // 永久
  DOCUMENT_EMPTY = 'DOCUMENT_EMPTY', // 永久

  // 系统资源错误
  MEMORY_INSUFFICIENT = 'MEMORY_INSUFFICIENT', // 临时
  DISK_SPACE_INSUFFICIENT = 'DISK_SPACE_INSUFFICIENT', // 永久

  // 未知错误
  UNKNOWN = 'UNKNOWN',
}

/**
 * 错误分类映射
 */
export const ERROR_CATEGORY_MAP: Record<ErrorCategory, ErrorType> = {
  // 网络错误 - 临时
  [ErrorCategory.NETWORK_TIMEOUT]: ErrorType.TEMPORARY,
  [ErrorCategory.NETWORK_CONNECTION]: ErrorType.TEMPORARY,
  [ErrorCategory.NETWORK_DNS]: ErrorType.TEMPORARY,

  // 数据库错误
  [ErrorCategory.DATABASE_CONNECTION]: ErrorType.TEMPORARY,
  [ErrorCategory.DATABASE_CONSTRAINT]: ErrorType.PERMANENT,
  [ErrorCategory.DATABASE_TIMEOUT]: ErrorType.TEMPORARY,

  // Qdrant错误
  [ErrorCategory.QDRANT_CONNECTION]: ErrorType.TEMPORARY,
  [ErrorCategory.QDRANT_CAPACITY]: ErrorType.TEMPORARY,
  [ErrorCategory.QDRANT_INVALID_VECTOR]: ErrorType.PERMANENT,

  // 嵌入生成错误
  [ErrorCategory.EMBEDDING_RATE_LIMIT]: ErrorType.TEMPORARY,
  [ErrorCategory.EMBEDDING_QUOTA_EXCEEDED]: ErrorType.PERMANENT,
  [ErrorCategory.EMBEDDING_INVALID_INPUT]: ErrorType.PERMANENT,
  [ErrorCategory.EMBEDDING_SERVICE_UNAVAILABLE]: ErrorType.TEMPORARY,

  // 文档处理错误
  [ErrorCategory.DOCUMENT_NOT_FOUND]: ErrorType.PERMANENT,
  [ErrorCategory.DOCUMENT_CORRUPTED]: ErrorType.PERMANENT,
  [ErrorCategory.DOCUMENT_TOO_LARGE]: ErrorType.PERMANENT,
  [ErrorCategory.DOCUMENT_EMPTY]: ErrorType.PERMANENT,

  // 系统资源错误
  [ErrorCategory.MEMORY_INSUFFICIENT]: ErrorType.TEMPORARY,
  [ErrorCategory.DISK_SPACE_INSUFFICIENT]: ErrorType.PERMANENT,

  // 未知错误
  [ErrorCategory.UNKNOWN]: ErrorType.UNKNOWN,
};

/**
 * 重试策略配置
 */
export interface RetryStrategy {
  // 最大重试次数
  maxRetries: number;
  // 初始延迟时间（毫秒）
  initialDelayMs: number;
  // 最大延迟时间（毫秒）
  maxDelayMs: number;
  // 退避因子
  backoffMultiplier: number;
  // 是否添加随机抖动
  jitter: boolean;
  // 抖动范围（0-1之间，表示延迟时间的百分比）
  jitterRange: number;
}

/**
 * 默认重试策略
 */
export const DEFAULT_RETRY_STRATEGY: RetryStrategy = {
  maxRetries: 5,
  initialDelayMs: 1000, // 1秒
  maxDelayMs: 60000, // 60秒
  backoffMultiplier: 2,
  jitter: true,
  jitterRange: 0.1, // 10%的随机抖动
};

/**
 * 针对不同错误类型的重试策略
 */
export const ERROR_SPECIFIC_STRATEGIES: Partial<
  Record<ErrorCategory, Partial<RetryStrategy>>
> = {
  // 网络错误 - 更激进的重试
  [ErrorCategory.NETWORK_TIMEOUT]: {
    maxRetries: 8,
    initialDelayMs: 500,
    maxDelayMs: 30000,
  },
  [ErrorCategory.NETWORK_CONNECTION]: {
    maxRetries: 6,
    initialDelayMs: 2000,
    maxDelayMs: 60000,
  },

  // 数据库连接错误 - 中等重试
  [ErrorCategory.DATABASE_CONNECTION]: {
    maxRetries: 5,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
  },
  [ErrorCategory.DATABASE_TIMEOUT]: {
    maxRetries: 4,
    initialDelayMs: 2000,
    maxDelayMs: 20000,
  },

  // Qdrant错误 - 根据类型调整
  [ErrorCategory.QDRANT_CONNECTION]: {
    maxRetries: 5,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
  },
  [ErrorCategory.QDRANT_CAPACITY]: {
    maxRetries: 10,
    initialDelayMs: 5000,
    maxDelayMs: 120000, // 2分钟
  },

  // 嵌入生成错误 - 根据类型调整
  [ErrorCategory.EMBEDDING_RATE_LIMIT]: {
    maxRetries: 10,
    initialDelayMs: 10000, // 10秒
    maxDelayMs: 300000, // 5分钟
    backoffMultiplier: 1.5, // 更温和的退避
  },
  [ErrorCategory.EMBEDDING_SERVICE_UNAVAILABLE]: {
    maxRetries: 8,
    initialDelayMs: 5000,
    maxDelayMs: 120000, // 2分钟
  },

  // 系统资源错误
  [ErrorCategory.MEMORY_INSUFFICIENT]: {
    maxRetries: 3,
    initialDelayMs: 10000, // 10秒
    maxDelayMs: 60000, // 1分钟
  },
};

/**
 * 重试统计信息
 */
export interface RetryStats {
  // 总重试次数
  totalRetries: number;
  // 成功重试次数
  successfulRetries: number;
  // 失败重试次数
  failedRetries: number;
  // 平均重试时间（毫秒）
  averageRetryTimeMs: number;
  // 最后重试时间
  lastRetryAt?: number;
  // 各错误类型的重试次数
  retryCountByCategory: Record<ErrorCategory, number>;
  // 各错误类型的成功次数
  successCountByCategory: Record<ErrorCategory, number>;
}

/**
 * 重试任务
 */
export interface RetryTask {
  id: string;
  docId: string;
  errorCategory: ErrorCategory;
  error: Error;
  retryCount: number;
  nextRetryAt: number;
  strategy: RetryStrategy;
  timeoutId?: NodeJS.Timeout;
  createdAt: number;
  updatedAt: number;
}

/**
 * 错误分类器接口
 */
export interface ErrorClassifier {
  /**
   * 分类错误
   * @param error 错误对象
   * @returns 错误分类
   */
  classify(error: Error): ErrorCategory;

  /**
   * 判断错误是否为临时错误
   * @param error 错误对象
   * @returns 是否为临时错误
   */
  isTemporary(error: Error): boolean;

  /**
   * 获取错误的重试策略
   * @param error 错误对象
   * @returns 重试策略
   */
  getRetryStrategy(error: Error): RetryStrategy;
}
