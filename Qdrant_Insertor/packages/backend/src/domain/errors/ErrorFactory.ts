import { ErrorCode, AppError } from '@api/contracts/error.js';
import { TransactionError, TransactionErrorType } from '@infrastructure/transactions/TransactionErrorHandler.js';
import { ErrorCategory } from '@domain/sync/retry.js';

/**
 * 错误上下文接口
 */
export interface ErrorContext {
  /** 操作名称 */
  operation?: string;
  /** 用户ID */
  userId?: string;
  /** 请求ID */
  requestId?: string;
  /** 事务ID */
  transactionId?: string;
  /** 资源ID */
  resourceId?: string;
  /** 额外的上下文信息 */
  [key: string]: unknown;
}

/**
 * 错误创建选项
 */
export interface ErrorOptions {
  /** 错误详情 */
  details?: Record<string, unknown>;
  /** 错误上下文 */
  context?: ErrorContext;
  /** 原始错误 */
  cause?: Error;
  /** HTTP状态码 */
  httpStatus?: number;
}

/**
 * 错误工厂类
 * 提供统一的错误创建方法，确保错误格式的一致性和类型安全
 */
export class ErrorFactory {
  /**
   * 创建验证错误
   * @param message 错误消息
   * @param details 错误详情
   * @param context 错误上下文
   * @returns AppError实例
   */
  static createValidationError(
    message: string = 'Validation failed.',
    details?: Record<string, unknown>,
    context?: ErrorContext,
  ): AppError {
    return new AppError(
      ErrorCode.VALIDATION_ERROR,
      message,
      400,
      this.mergeDetails(details, context),
    );
  }

  /**
   * 创建未找到错误
   * @param resource 资源名称
   * @param resourceId 资源ID
   * @param context 错误上下文
   * @returns AppError实例
   */
  static createNotFoundError(
    resource: string = 'Resource',
    resourceId?: string,
    context?: ErrorContext,
  ): AppError {
    const message = resourceId
      ? `${resource} with ID '${resourceId}' not found.`
      : `${resource} not found.`;

    return new AppError(
      ErrorCode.NOT_FOUND,
      message,
      404,
      this.mergeDetails({ resource, resourceId }, context),
    );
  }

  /**
   * 创建未授权错误
   * @param message 错误消息
   * @param context 错误上下文
   * @returns AppError实例
   */
  static createUnauthorizedError(
    message: string = 'Unauthorized access.',
    context?: ErrorContext,
  ): AppError {
    return new AppError(
      ErrorCode.UNAUTHORIZED,
      message,
      401,
      this.mergeDetails(undefined, context),
    );
  }

  /**
   * 创建禁止访问错误
   * @param message 错误消息
   * @param context 错误上下文
   * @returns AppError实例
   */
  static createForbiddenError(
    message: string = 'Access forbidden.',
    context?: ErrorContext,
  ): AppError {
    return new AppError(
      ErrorCode.FORBIDDEN,
      message,
      403,
      this.mergeDetails(undefined, context),
    );
  }

  /**
   * 创建内部服务器错误
   * @param message 错误消息
   * @param details 错误详情
   * @param context 错误上下文
   * @param cause 原始错误
   * @returns AppError实例
   */
  static createInternalServerError(
    message: string = 'Internal server error.',
    details?: Record<string, unknown>,
    context?: ErrorContext,
    cause?: Error,
  ): AppError {
    const mergedDetails = this.mergeDetails(details, context);
    
    // 如果有原始错误，添加到详情中
    if (cause) {
      mergedDetails.originalError = {
        name: cause.name,
        message: cause.message,
        stack: process.env.NODE_ENV === 'development' ? cause.stack : undefined,
      };
    }

    return new AppError(
      ErrorCode.INTERNAL_SERVER_ERROR,
      message,
      500,
      mergedDetails,
    );
  }

  /**
   * 创建服务不可用错误
   * @param service 服务名称
   * @param context 错误上下文
   * @returns AppError实例
   */
  static createServiceUnavailableError(
    service: string = 'Service',
    context?: ErrorContext,
  ): AppError {
    const message = `${service} is currently unavailable.`;
    return new AppError(
      ErrorCode.SERVICE_UNAVAILABLE,
      message,
      503,
      this.mergeDetails({ service }, context),
    );
  }

  /**
   * 创建文件上传失败错误
   * @param reason 失败原因
   * @param filename 文件名
   * @param context 错误上下文
   * @returns AppError实例
   */
  static createFileUploadFailedError(
    reason: string,
    filename?: string,
    context?: ErrorContext,
  ): AppError {
    const message = filename
      ? `File upload failed for '${filename}': ${reason}`
      : `File upload failed: ${reason}`;

    return new AppError(
      ErrorCode.FILE_UPLOAD_FAILED,
      message,
      400,
      this.mergeDetails({ reason, filename }, context),
    );
  }

  /**
   * 创建文档处理失败错误
   * @param documentId 文档ID
   * @param reason 失败原因
   * @param context 错误上下文
   * @returns AppError实例
   */
  static createDocumentProcessingFailedError(
    documentId: string,
    reason: string,
    context?: ErrorContext,
  ): AppError {
    const message = `Document processing failed: ${reason}`;
    return new AppError(
      ErrorCode.DOCUMENT_PROCESSING_FAILED,
      message,
      500,
      this.mergeDetails({ documentId, reason }, context),
    );
  }

  /**
   * 创建同步失败错误
   * @param resourceId 资源ID
   * @param reason 失败原因
   * @param context 错误上下文
   * @returns AppError实例
   */
  static createSyncFailedError(
    resourceId: string,
    reason: string,
    context?: ErrorContext,
  ): AppError {
    const message = `Synchronization failed: ${reason}`;
    return new AppError(
      ErrorCode.SYNC_FAILED,
      message,
      500,
      this.mergeDetails({ resourceId, reason }, context),
    );
  }

  /**
   * 创建无效输入错误
   * @param field 字段名
   * @param value 无效值
   * @param reason 无效原因
   * @param context 错误上下文
   * @returns AppError实例
   */
  static createInvalidInputError(
    field: string,
    value: unknown,
    reason: string,
    context?: ErrorContext,
  ): AppError {
    const message = `Invalid input for field '${field}': ${reason}`;
    return new AppError(
      ErrorCode.INVALID_INPUT,
      message,
      400,
      this.mergeDetails({ field, value, reason }, context),
    );
  }

  /**
   * 创建文件过大错误
   * @param filename 文件名
   * @param size 文件大小
   * @param maxSize 最大允许大小
   * @param context 错误上下文
   * @returns AppError实例
   */
  static createFileTooLargeError(
    filename?: string,
    size?: number,
    maxSize?: number,
    context?: ErrorContext,
  ): AppError {
    const message = maxSize
      ? `File size exceeds maximum limit of ${maxSize} bytes.`
      : 'File size exceeds maximum limit.';

    return new AppError(
      ErrorCode.FILE_TOO_LARGE,
      message,
      413,
      this.mergeDetails({ filename, size, maxSize }, context),
    );
  }

  /**
   * 创建不支持的文件类型错误
   * @param filename 文件名
   * @param fileType 文件类型
   * @param supportedTypes 支持的类型列表
   * @param context 错误上下文
   * @returns AppError实例
   */
  static createUnsupportedFileTypeError(
    filename?: string,
    fileType?: string,
    supportedTypes?: string[],
    context?: ErrorContext,
  ): AppError {
    const message = fileType
      ? `File type '${fileType}' is not supported.`
      : 'File type is not supported.';

    return new AppError(
      ErrorCode.UNSUPPORTED_FILE_TYPE,
      message,
      422,
      this.mergeDetails({ filename, fileType, supportedTypes }, context),
    );
  }

  /**
   * 从原始错误创建AppError
   * @param error 原始错误
   * @param context 错误上下文
   * @param defaultMessage 默认错误消息
   * @returns AppError实例
   */
  static fromError(
    error: Error,
    context?: ErrorContext,
    defaultMessage: string = 'An unexpected error occurred.',
  ): AppError {
    if (error instanceof AppError) {
      // 如果已经是AppError，合并上下文并返回
      return new AppError(
        error.code,
        error.message,
        error.httpStatus,
        this.mergeDetails(error.details, context),
      );
    }

    // 对于其他类型的错误，创建内部服务器错误
    return this.createInternalServerError(
      error.message || defaultMessage,
      { originalErrorName: error.name },
      context,
      error,
    );
  }

  /**
   * 从事务错误创建AppError
   * @param transactionError 事务错误
   * @param context 错误上下文
   * @returns AppError实例
   */
  static fromTransactionError(
    transactionError: TransactionError,
    context?: ErrorContext,
  ): AppError {
    // 根据事务错误类型映射到相应的ErrorCode
    const errorCodeMap: Record<TransactionErrorType, ErrorCode> = {
      [TransactionErrorType.TRANSACTION_NOT_FOUND]: ErrorCode.NOT_FOUND,
      [TransactionErrorType.QUERY_RUNNER_NOT_FOUND]: ErrorCode.INTERNAL_SERVER_ERROR,
      [TransactionErrorType.INVALID_TRANSACTION_STATE]: ErrorCode.VALIDATION_ERROR,
      [TransactionErrorType.OPERATION_EXECUTION_FAILED]: ErrorCode.INTERNAL_SERVER_ERROR,
      [TransactionErrorType.SAVEPOINT_ERROR]: ErrorCode.INTERNAL_SERVER_ERROR,
      [TransactionErrorType.NESTED_TRANSACTION_ERROR]: ErrorCode.INTERNAL_SERVER_ERROR,
      [TransactionErrorType.COMMIT_FAILED]: ErrorCode.INTERNAL_SERVER_ERROR,
      [TransactionErrorType.ROLLBACK_FAILED]: ErrorCode.INTERNAL_SERVER_ERROR,
      [TransactionErrorType.DATABASE_CONNECTION_ERROR]: ErrorCode.SERVICE_UNAVAILABLE,
      [TransactionErrorType.TIMEOUT_ERROR]: ErrorCode.SERVICE_UNAVAILABLE,
      [TransactionErrorType.CONSTRAINT_VIOLATION]: ErrorCode.VALIDATION_ERROR,
    };

    const errorCode = errorCodeMap[transactionError.type] || ErrorCode.INTERNAL_SERVER_ERROR;
    const httpStatus = this.getHttpStatusForErrorCode(errorCode);

    return new AppError(
      errorCode,
      transactionError.message,
      httpStatus,
      this.mergeDetails(
        {
          transactionErrorType: transactionError.type,
          transactionId: transactionError.transactionId,
          operation: transactionError.operation,
          transactionDetails: transactionError.getDetails(),
        },
        context,
      ),
    );
  }

  /**
   * 从错误分类创建AppError
   * @param category 错误分类
   * @param message 错误消息
   * @param context 错误上下文
   * @param cause 原始错误
   * @returns AppError实例
   */
  static fromErrorCategory(
    category: ErrorCategory,
    message?: string,
    context?: ErrorContext,
    cause?: Error,
  ): AppError {
    // 根据错误分类映射到相应的ErrorCode
    const categoryToErrorCodeMap: Record<ErrorCategory, ErrorCode> = {
      [ErrorCategory.NETWORK_CONNECTION]: ErrorCode.SERVICE_UNAVAILABLE,
      [ErrorCategory.NETWORK_TIMEOUT]: ErrorCode.SERVICE_UNAVAILABLE,
      [ErrorCategory.NETWORK_DNS]: ErrorCode.SERVICE_UNAVAILABLE,
      [ErrorCategory.DATABASE_CONNECTION]: ErrorCode.SERVICE_UNAVAILABLE,
      [ErrorCategory.DATABASE_TIMEOUT]: ErrorCode.SERVICE_UNAVAILABLE,
      [ErrorCategory.DATABASE_CONSTRAINT]: ErrorCode.VALIDATION_ERROR,
      [ErrorCategory.QDRANT_CONNECTION]: ErrorCode.SERVICE_UNAVAILABLE,
      [ErrorCategory.QDRANT_CAPACITY]: ErrorCode.SERVICE_UNAVAILABLE,
      [ErrorCategory.QDRANT_INVALID_VECTOR]: ErrorCode.VALIDATION_ERROR,
      [ErrorCategory.EMBEDDING_RATE_LIMIT]: ErrorCode.SERVICE_UNAVAILABLE,
      [ErrorCategory.EMBEDDING_QUOTA_EXCEEDED]: ErrorCode.SERVICE_UNAVAILABLE,
      [ErrorCategory.EMBEDDING_INVALID_INPUT]: ErrorCode.VALIDATION_ERROR,
      [ErrorCategory.EMBEDDING_SERVICE_UNAVAILABLE]: ErrorCode.SERVICE_UNAVAILABLE,
      [ErrorCategory.DOCUMENT_NOT_FOUND]: ErrorCode.NOT_FOUND,
      [ErrorCategory.DOCUMENT_CORRUPTED]: ErrorCode.DOCUMENT_PROCESSING_FAILED,
      [ErrorCategory.DOCUMENT_TOO_LARGE]: ErrorCode.FILE_TOO_LARGE,
      [ErrorCategory.DOCUMENT_EMPTY]: ErrorCode.VALIDATION_ERROR,
      [ErrorCategory.MEMORY_INSUFFICIENT]: ErrorCode.SERVICE_UNAVAILABLE,
      [ErrorCategory.DISK_SPACE_INSUFFICIENT]: ErrorCode.SERVICE_UNAVAILABLE,
      [ErrorCategory.UNKNOWN]: ErrorCode.INTERNAL_SERVER_ERROR,
    };

    const errorCode = categoryToErrorCodeMap[category] || ErrorCode.INTERNAL_SERVER_ERROR;
    const httpStatus = this.getHttpStatusForErrorCode(errorCode);
    const errorMessage = message || this.getDefaultMessageForCategory(category);

    return new AppError(
      errorCode,
      errorMessage,
      httpStatus,
      this.mergeDetails({ errorCategory: category }, context),
    );
  }

  /**
   * 合并错误详情和上下文
   * @param details 错误详情
   * @param context 错误上下文
   * @returns 合并后的详情对象
   */
  private static mergeDetails(
    details?: Record<string, unknown>,
    context?: ErrorContext,
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = {};

    if (details) {
      Object.assign(merged, details);
    }

    if (context) {
      Object.assign(merged, { context });
    }

    return merged;
  }

  /**
   * 获取ErrorCode对应的HTTP状态码
   * @param errorCode 错误码
   * @returns HTTP状态码
   */
  private static getHttpStatusForErrorCode(errorCode: ErrorCode): number {
    const statusMap: Record<ErrorCode, number> = {
      [ErrorCode.VALIDATION_ERROR]: 400,
      [ErrorCode.NOT_FOUND]: 404,
      [ErrorCode.UNAUTHORIZED]: 401,
      [ErrorCode.FORBIDDEN]: 403,
      [ErrorCode.INTERNAL_SERVER_ERROR]: 500,
      [ErrorCode.SERVICE_UNAVAILABLE]: 503,
      [ErrorCode.FILE_UPLOAD_FAILED]: 400,
      [ErrorCode.DOCUMENT_PROCESSING_FAILED]: 500,
      [ErrorCode.SYNC_FAILED]: 500,
      [ErrorCode.INVALID_INPUT]: 400,
      [ErrorCode.FILE_TOO_LARGE]: 413,
      [ErrorCode.UNSUPPORTED_FILE_TYPE]: 422,
    };

    return statusMap[errorCode] || 500;
  }

  /**
   * 获取错误分类的默认消息
   * @param category 错误分类
   * @returns 默认错误消息
   */
  private static getDefaultMessageForCategory(category: ErrorCategory): string {
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
      [ErrorCategory.EMBEDDING_RATE_LIMIT]: 'Embedding service rate limit exceeded.',
      [ErrorCategory.EMBEDDING_QUOTA_EXCEEDED]: 'Embedding service quota exceeded.',
      [ErrorCategory.EMBEDDING_INVALID_INPUT]: 'Invalid input for embedding service.',
      [ErrorCategory.EMBEDDING_SERVICE_UNAVAILABLE]: 'Embedding service unavailable.',
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
}