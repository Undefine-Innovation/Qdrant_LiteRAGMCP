import {
  ErrorCategory,
  ErrorType,
  ERROR_CATEGORY_MAP,
  DEFAULT_RETRY_STRATEGY,
  ERROR_SPECIFIC_STRATEGIES,
  ErrorClassifier as IErrorClassifier,
  RetryStrategy,
} from './retry.js';

/**
 * 默认错误分类器实现
 */
export class ErrorClassifier implements IErrorClassifier {
  /**
   * 根据错误消息和错误类型分类错误
   * @param error 错误对象
   * @returns 错误分类
   */
  classify(error: Error): ErrorCategory {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.constructor.name.toLowerCase();

    // 网络相关错误
    if (this.isNetworkError(errorMessage, errorName)) {
      if (
        errorMessage.includes('timeout') ||
        errorMessage.includes('etimedout')
      ) {
        return ErrorCategory.NETWORK_TIMEOUT;
      }
      if (errorMessage.includes('enotfound') || errorMessage.includes('dns')) {
        return ErrorCategory.NETWORK_DNS;
      }
      return ErrorCategory.NETWORK_CONNECTION;
    }

    // 数据库相关错误
    if (this.isDatabaseError(errorMessage, errorName)) {
      if (
        errorMessage.includes('timeout') ||
        errorMessage.includes('database is locked')
      ) {
        return ErrorCategory.DATABASE_TIMEOUT;
      }
      if (
        errorMessage.includes('constraint') ||
        errorMessage.includes('unique') ||
        errorMessage.includes('foreign key')
      ) {
        return ErrorCategory.DATABASE_CONSTRAINT;
      }
      return ErrorCategory.DATABASE_CONNECTION;
    }

    // Qdrant相关错误
    if (this.isQdrantError(errorMessage, errorName)) {
      if (
        errorMessage.includes('connection') ||
        errorMessage.includes('connect') ||
        errorMessage.includes('network')
      ) {
        return ErrorCategory.QDRANT_CONNECTION;
      }
      if (
        errorMessage.includes('capacity') ||
        errorMessage.includes('overloaded') ||
        errorMessage.includes('rate limit')
      ) {
        return ErrorCategory.QDRANT_CAPACITY;
      }
      if (
        errorMessage.includes('invalid vector') ||
        errorMessage.includes('vector size') ||
        errorMessage.includes('dimension')
      ) {
        return ErrorCategory.QDRANT_INVALID_VECTOR;
      }
    }

    // 嵌入生成相关错误
    if (this.isEmbeddingError(errorMessage, errorName)) {
      if (
        errorMessage.includes('rate limit') ||
        errorMessage.includes('too many requests')
      ) {
        return ErrorCategory.EMBEDDING_RATE_LIMIT;
      }
      if (
        errorMessage.includes('quota') ||
        errorMessage.includes('billing') ||
        errorMessage.includes('limit exceeded')
      ) {
        return ErrorCategory.EMBEDDING_QUOTA_EXCEEDED;
      }
      if (
        errorMessage.includes('invalid input') ||
        errorMessage.includes('bad request') ||
        errorMessage.includes('validation')
      ) {
        return ErrorCategory.EMBEDDING_INVALID_INPUT;
      }
      if (
        errorMessage.includes('service unavailable') ||
        errorMessage.includes('maintenance') ||
        errorMessage.includes('503')
      ) {
        return ErrorCategory.EMBEDDING_SERVICE_UNAVAILABLE;
      }
    }

    // 文档处理相关错误
    if (this.isDocumentError(errorMessage, errorName)) {
      if (
        errorMessage.includes('not found') ||
        errorMessage.includes('does not exist')
      ) {
        return ErrorCategory.DOCUMENT_NOT_FOUND;
      }
      if (
        errorMessage.includes('corrupted') ||
        errorMessage.includes('invalid format') ||
        errorMessage.includes('parse error')
      ) {
        return ErrorCategory.DOCUMENT_CORRUPTED;
      }
      if (
        errorMessage.includes('too large') ||
        errorMessage.includes('size limit') ||
        errorMessage.includes('file too large')
      ) {
        return ErrorCategory.DOCUMENT_TOO_LARGE;
      }
      if (
        errorMessage.includes('empty') ||
        errorMessage.includes('no content') ||
        errorMessage.includes('blank')
      ) {
        return ErrorCategory.DOCUMENT_EMPTY;
      }
    }

    // 系统资源错误
    if (this.isSystemResourceError(errorMessage, errorName)) {
      if (
        errorMessage.includes('memory') ||
        errorMessage.includes('out of memory') ||
        errorMessage.includes('heap')
      ) {
        return ErrorCategory.MEMORY_INSUFFICIENT;
      }
      if (
        errorMessage.includes('disk') ||
        errorMessage.includes('space') ||
        errorMessage.includes('storage')
      ) {
        return ErrorCategory.DISK_SPACE_INSUFFICIENT;
      }
    }

    // 默认返回未知错误
    return ErrorCategory.UNKNOWN;
  }

  /**
   * 判断错误是否为临时错误
   * @param error 错误对象
   * @returns 是否为临时错误
   */
  isTemporary(error: Error): boolean {
    const category = this.classify(error);
    const errorType = ERROR_CATEGORY_MAP[category];

    if (errorType === ErrorType.TEMPORARY) {
      return true;
    }

    if (errorType === ErrorType.PERMANENT) {
      return false;
    }

    // 对于未知错误，默认为临时错误，但限制重试次数
    return true;
  }

  /**
   * 获取错误的重试策略
   * @param error 错误对象
   * @returns 重试策略
   */
  getRetryStrategy(error: Error): RetryStrategy {
    const category = this.classify(error);
    const specificStrategy = ERROR_SPECIFIC_STRATEGIES[category];

    if (!specificStrategy) {
      return DEFAULT_RETRY_STRATEGY;
    }

    // 合并默认策略和特定策�?
    return {
      ...DEFAULT_RETRY_STRATEGY,
      ...specificStrategy,
    };
  }

  /**
   * 判断是否为网络错误
   * @param errorMessage 错误消息
   * @param errorName 错误名称
   * @returns 是否为网络错误
   */
  private isNetworkError(errorMessage: string, errorName: string): boolean {
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
      (keyword) =>
        errorMessage.includes(keyword) || errorName.includes(keyword),
    );
  }

  /**
   * 判断是否为数据库错误
   * @param errorMessage 错误消息
   * @param errorName 错误名称
   * @returns 是否为数据库错误
   */
  private isDatabaseError(errorMessage: string, errorName: string): boolean {
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
    ];

    return dbKeywords.some(
      (keyword) =>
        errorMessage.includes(keyword) || errorName.includes(keyword),
    );
  }

  /**
   * 判断是否为Qdrant错误
   * @param errorMessage 错误消息
   * @param errorName 错误名称
   * @returns 是否为Qdrant错误
   */
  private isQdrantError(errorMessage: string, errorName: string): boolean {
    const qdrantKeywords = [
      'qdrant',
      'vector',
      'collection',
      'point',
      'embedding',
      'dimension',
      'capacity',
      'overloaded',
    ];

    return qdrantKeywords.some(
      (keyword) =>
        errorMessage.includes(keyword) || errorName.includes(keyword),
    );
  }

  /**
   * 判断是否为嵌入生成错误
   * @param errorMessage 错误消息
   * @param errorName 错误名称
   * @returns 是否为嵌入生成错误
   */
  private isEmbeddingError(errorMessage: string, errorName: string): boolean {
    const embeddingKeywords = [
      'openai',
      'embedding',
      'api',
      'rate limit',
      'quota',
      'billing',
      'service unavailable',
      'maintenance',
      'invalid input',
      'validation',
    ];

    return embeddingKeywords.some(
      (keyword) =>
        errorMessage.includes(keyword) || errorName.includes(keyword),
    );
  }

  /**
   * 判断是否为文档处理错误
   * @param errorMessage 错误消息
   * @param errorName 错误名称
   * @returns 是否为文档处理错误
   */
  private isDocumentError(errorMessage: string, errorName: string): boolean {
    const documentKeywords = [
      'document',
      'file',
      'content',
      'not found',
      'corrupted',
      'invalid format',
      'parse error',
      'too large',
      'empty',
      'blank',
    ];

    return documentKeywords.some(
      (keyword) =>
        errorMessage.includes(keyword) || errorName.includes(keyword),
    );
  }

  /**
   * 判断是否为系统资源错误
   * @param errorMessage 错误消息
   * @param errorName 错误名称
   * @returns 是否为系统资源错误
   */
  private isSystemResourceError(
    errorMessage: string,
    errorName: string,
  ): boolean {
    const resourceKeywords = [
      'memory',
      'out of memory',
      'heap',
      'disk',
      'space',
      'storage',
    ];

    return resourceKeywords.some(
      (keyword) =>
        errorMessage.includes(keyword) || errorName.includes(keyword),
    );
  }
}

/**
 * 创建默认错误分类器实现
 *
 * @returns 错误分类器实例
 */
export function createErrorClassifier(): IErrorClassifier {
  return new ErrorClassifier();
}
