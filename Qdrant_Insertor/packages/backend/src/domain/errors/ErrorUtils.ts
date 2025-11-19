/**
 * 公共错误工具函数
 * 提供在多个创建器/工厂间共享的 helper，避免重复实现
 */
import { ErrorCategory } from '@domain/sync/retry.js';
import { ErrorCode as ApiErrorCode } from '@api/contracts/Error.js';

/**
 * 根据错误代码获取HTTP状态码
 * @param errorCode 错误代码
 * @returns HTTP状态码
 */
export function getHttpStatusForErrorCode(errorCode: ApiErrorCode): number {
  const statusMap: Record<ApiErrorCode, number> = {
    [ApiErrorCode.VALIDATION_ERROR]: 422,
    [ApiErrorCode.NOT_FOUND]: 404,
    [ApiErrorCode.UNAUTHORIZED]: 401,
    [ApiErrorCode.FORBIDDEN]: 403,
    [ApiErrorCode.INTERNAL_ERROR]: 500,
    [ApiErrorCode.INTERNAL_SERVER_ERROR]: 500,
    [ApiErrorCode.SERVICE_UNAVAILABLE]: 503,
    [ApiErrorCode.FILE_UPLOAD_FAILED]: 400,
    [ApiErrorCode.DOCUMENT_PROCESSING_FAILED]: 500,
    [ApiErrorCode.SYNC_FAILED]: 500,
    [ApiErrorCode.INVALID_INPUT]: 400,
    [ApiErrorCode.FILE_TOO_LARGE]: 413,
    [ApiErrorCode.UNSUPPORTED_FILE_TYPE]: 422,
    [ApiErrorCode.PAYLOAD_TOO_LARGE]: 413,
  };

  return statusMap[errorCode] || 500;
}

/**
 * 根据错误类别获取默认消息
 * @param category 错误类别
 * @returns 默认错误消息
 */
export function getDefaultMessageForCategory(category: ErrorCategory): string {
  const messageMap: Record<ErrorCategory, string> = {
    [ErrorCategory.NETWORK_CONNECTION]: 'Network connection error.',
    [ErrorCategory.NETWORK_TIMEOUT]: 'Network timeout error.',
    [ErrorCategory.NETWORK_DNS]: 'DNS resolution error.',
    [ErrorCategory.DATABASE_CONNECTION]: 'Database connection error.',
    [ErrorCategory.DATABASE_TIMEOUT]: 'Database timeout error.',
    [ErrorCategory.DATABASE_CONSTRAINT]: 'Database constraint violation.',
    [ErrorCategory.QDRANT_CONNECTION]: 'Vector database connection error.',
    [ErrorCategory.QDRANT_CAPACITY]: 'Vector database capacity exceeded.',
    [ErrorCategory.QDRANT_INVALID_VECTOR]: 'Invalid vector data.',
    [ErrorCategory.EMBEDDING_RATE_LIMIT]:
      'Embedding service rate limit exceeded.',
    [ErrorCategory.EMBEDDING_QUOTA_EXCEEDED]:
      'Embedding service quota exceeded.',
    [ErrorCategory.EMBEDDING_INVALID_INPUT]:
      'Invalid input for embedding service.',
    [ErrorCategory.EMBEDDING_SERVICE_UNAVAILABLE]:
      'Embedding service unavailable.',
    [ErrorCategory.DOCUMENT_NOT_FOUND]: 'Document not found.',
    [ErrorCategory.DOCUMENT_CORRUPTED]: 'Document corrupted or invalid.',
    [ErrorCategory.DOCUMENT_TOO_LARGE]: 'Document size exceeds limit.',
    [ErrorCategory.DOCUMENT_EMPTY]: 'Document is empty.',
    [ErrorCategory.MEMORY_INSUFFICIENT]: 'Insufficient memory.',
    [ErrorCategory.DISK_SPACE_INSUFFICIENT]: 'Insufficient disk space.',
    [ErrorCategory.UNKNOWN]: 'An unknown error occurred.',
  };

  return messageMap[category] || 'An unknown error occurred.';
}
