import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import {
  TransactionContext,
  TransactionOperation,
  TransactionStatus,
} from '@domain/repositories/ITransactionManager.js';
import { ErrorFactory, ErrorContext } from '@domain/errors/ErrorFactory.js';
import { AppError } from '@api/contracts/error.js';
import { SystemMetrics } from '@infrastructure/database/entities/SystemMetrics.js';

/**
 * 事务错误类型枚举
 */
export enum TransactionErrorType {
  TRANSACTION_NOT_FOUND = 'TRANSACTION_NOT_FOUND',
  QUERY_RUNNER_NOT_FOUND = 'QUERY_RUNNER_NOT_FOUND',
  INVALID_TRANSACTION_STATE = 'INVALID_TRANSACTION_STATE',
  OPERATION_EXECUTION_FAILED = 'OPERATION_EXECUTION_FAILED',
  SAVEPOINT_ERROR = 'SAVEPOINT_ERROR',
  NESTED_TRANSACTION_ERROR = 'NESTED_TRANSACTION_ERROR',
  COMMIT_FAILED = 'COMMIT_FAILED',
  ROLLBACK_FAILED = 'ROLLBACK_FAILED',
  DATABASE_CONNECTION_ERROR = 'DATABASE_CONNECTION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
}

/**
 * Structured representation for recorded transaction errors.
 */
type ErrorLogEntry = {
  message: string;
  context: Record<string, unknown>;
  timestamp: Date;
  stack?: string;
  type: string;
};

/**
 * 事务错误类
 */
export class TransactionError extends Error {
  public readonly type: TransactionErrorType;
  public readonly transactionId?: string;
  public readonly operation?: TransactionOperation;
  public readonly cause?: Error;
  public readonly context?: Record<string, unknown>;

  /**
   * 创建事务错误实例
   * @param type 错误类型
   * @param message 错误消息
   * @param options 选项
   * @param options.transactionId 事务ID
   * @param options.operation 事务操作
   * @param options.cause 原始错误
   * @param options.context 错误上下文
   */
  constructor(
    type: TransactionErrorType,
    message: string,
    options?: {
      transactionId?: string;
      operation?: TransactionOperation;
      cause?: Error;
      context?: Record<string, unknown>;
    },
  ) {
    super(message);
    this.name = 'TransactionError';
    this.type = type;
    this.transactionId = options?.transactionId;
    this.operation = options?.operation;
    this.cause = options?.cause;
    this.context = options?.context;

    // 保持堆栈跟踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TransactionError);
    }
  }

  /**
   * 获取详细的错误信息
   * @returns 错误详情对象
   */
  getDetails(): Record<string, unknown> {
    return {
      type: this.type,
      message: this.message,
      transactionId: this.transactionId,
      operation: this.operation
        ? {
            type: this.operation.type,
            target: this.operation.target,
            targetId: this.operation.targetId,
          }
        : undefined,
      context: this.context,
      cause: this.cause
        ? {
            message: this.cause.message,
            stack: this.cause.stack,
          }
        : undefined,
      stack: this.stack,
    };
  }

  /**
   * 创建事务未找到错误
   * @param transactionId 事务ID
   * @returns 事务错误实例
   */
  static transactionNotFound(transactionId: string): TransactionError {
    return new TransactionError(
      TransactionErrorType.TRANSACTION_NOT_FOUND,
      `Transaction ${transactionId} not found`,
      { transactionId },
    );
  }

  /**
   * 创建QueryRunner未找到错误
   * @param transactionId 事务ID
   * @returns 事务错误实例
   */
  static queryRunnerNotFound(transactionId: string): TransactionError {
    return new TransactionError(
      TransactionErrorType.QUERY_RUNNER_NOT_FOUND,
      `QueryRunner for transaction ${transactionId} not found`,
      { transactionId },
    );
  }

  /**
   * 创建无效事务状态错误
   * @param transactionId 事务ID
   * @param currentState 当前状态
   * @param expectedState 期望状态
   * @returns 事务错误实例
   */
  static invalidTransactionState(
    transactionId: string,
    currentState: TransactionStatus,
    expectedState?: TransactionStatus,
  ): TransactionError {
    return new TransactionError(
      TransactionErrorType.INVALID_TRANSACTION_STATE,
      `Transaction ${transactionId} is in invalid state ${currentState}${expectedState ? `, expected ${expectedState}` : ''}`,
      {
        transactionId,
        context: { currentState, expectedState },
      },
    );
  }

  /**
   * 创建操作执行失败错误
   * @param transactionId 事务ID
   * @param operation 事务操作
   * @param cause 原始错误
   * @returns 事务错误实例
   */
  static operationExecutionFailed(
    transactionId: string,
    operation: TransactionOperation,
    cause: Error,
  ): TransactionError {
    return new TransactionError(
      TransactionErrorType.OPERATION_EXECUTION_FAILED,
      `Failed to execute operation ${operation.type} on ${operation.target} ${operation.targetId} in transaction ${transactionId}`,
      { transactionId, operation, cause },
    );
  }

  /**
   * 创建保存点错误
   * @param transactionId 事务ID
   * @param savepointId 保存点ID
   * @param operation 操作类型
   * @param cause 原始错误
   * @returns 事务错误实例
   */
  static savepointError(
    transactionId: string,
    savepointId: string,
    operation: 'create' | 'rollback' | 'release',
    cause: Error,
  ): TransactionError {
    return new TransactionError(
      TransactionErrorType.SAVEPOINT_ERROR,
      `Failed to ${operation} savepoint ${savepointId} in transaction ${transactionId}`,
      {
        transactionId,
        context: { savepointId, operation },
        cause,
      },
    );
  }

  /**
   * 创建嵌套事务错误
   * @param transactionId 事务ID
   * @param parentTransactionId 父事务ID
   * @param cause 原始错误
   * @returns 事务错误实例
   */
  static nestedTransactionError(
    transactionId: string,
    parentTransactionId: string,
    cause: Error,
  ): TransactionError {
    return new TransactionError(
      TransactionErrorType.NESTED_TRANSACTION_ERROR,
      `Nested transaction ${transactionId} failed with parent ${parentTransactionId}`,
      {
        transactionId,
        context: { parentTransactionId },
        cause,
      },
    );
  }

  /**
   * 创建提交失败错误
   * @param transactionId 事务ID
   * @param cause 原始错误
   * @returns 事务错误实例
   */
  static commitFailed(transactionId: string, cause: Error): TransactionError {
    return new TransactionError(
      TransactionErrorType.COMMIT_FAILED,
      `Failed to commit transaction ${transactionId}`,
      { transactionId, cause },
    );
  }

  /**
   * 创建回滚失败错误
   * @param transactionId 事务ID
   * @param cause 原始错误
   * @returns 事务错误实例
   */
  static rollbackFailed(transactionId: string, cause: Error): TransactionError {
    return new TransactionError(
      TransactionErrorType.ROLLBACK_FAILED,
      `Failed to rollback transaction ${transactionId}`,
      { transactionId, cause },
    );
  }

  /**
   * 创建数据库连接错误
   * @param transactionId 事务ID
   * @param cause 原始错误
   * @returns 事务错误实例
   */
  static databaseConnectionError(
    transactionId: string,
    cause: Error,
  ): TransactionError {
    return new TransactionError(
      TransactionErrorType.DATABASE_CONNECTION_ERROR,
      `Database connection error in transaction ${transactionId}`,
      { transactionId, cause },
    );
  }

  /**
   * 创建超时错误
   * @param transactionId 事务ID
   * @param timeoutMs 超时时间（毫秒）
   * @param operation 操作名称
   * @returns 事务错误实例
   */
  static timeoutError(
    transactionId: string,
    timeoutMs: number,
    operation?: string,
  ): TransactionError {
    return new TransactionError(
      TransactionErrorType.TIMEOUT_ERROR,
      `Transaction ${transactionId} timed out after ${timeoutMs}ms${operation ? ` during ${operation}` : ''}`,
      {
        transactionId,
        context: { timeoutMs, operation },
      },
    );
  }

  /**
   * 创建约束违反错误
   * @param transactionId 事务ID
   * @param constraint 约束名称
   * @param operation 事务操作
   * @param cause 原始错误
   * @returns 事务错误实例
   */
  static constraintViolation(
    transactionId: string,
    constraint: string,
    operation: TransactionOperation,
    cause: Error,
  ): TransactionError {
    return new TransactionError(
      TransactionErrorType.CONSTRAINT_VIOLATION,
      `Constraint violation ${constraint} in transaction ${transactionId} during operation ${operation.type} on ${operation.target}`,
      {
        transactionId,
        operation,
        context: { constraint },
        cause,
      },
    );
  }
}

/**
 * 事务错误处理器
 */
export class TransactionErrorHandler {
  private readonly MAX_ERROR_LOGS = 500;
  private readonly errorLogs: ErrorLogEntry[] = [];

  /**
   * 创建事务错误处理器实例
   * @param logger 日志记录器
   * @param dataSource 可选的数据源
   */
  constructor(
    private readonly logger: Logger,
    private readonly dataSource?: DataSource,
  ) {}

  /**
   * 处理事务错误
   * @param error 原始错误
   * @param context 错误上下文
   * @param context.transactionId 事务ID
   * @param context.operation 事务操作
   * @param context.additionalContext 额外上下文
   * @returns 处理后的事务错误
   */
  handleError(
    error: Error,
    context?: {
      transactionId?: string;
      operation?: TransactionOperation;
      additionalContext?: Record<string, unknown>;
    },
  ): TransactionError {
    let transactionError: TransactionError;

    if (error instanceof TransactionError) {
      transactionError = error;
    } else {
      // 根据错误类型创建适当的事务错误
      transactionError = this.classifyError(error, context);
    }

    // 记录错误
    this.logTransactionError(transactionError);

    return transactionError;
  }

  /**
   * 处理错误并返回AppError
   * @param error 原始错误
   * @param context 错误上下文
   * @returns AppError实例
   */
  handleToAppError(
    error: Error,
    context?: {
      transactionId?: string;
      operation?: TransactionOperation;
      additionalContext?: Record<string, unknown>;
    },
  ): AppError {
    const errorContext: ErrorContext = {
      operation: context?.operation?.type,
      transactionId: context?.transactionId,
      resourceId: context?.operation?.targetId,
      ...context?.additionalContext,
    };

    if (error instanceof TransactionError) {
      return ErrorFactory.fromTransactionError(error, errorContext);
    }

    return ErrorFactory.fromError(error, errorContext);
  }

  /**
   * 记录错误信息，便于在测试环境中校验日志和统计
   * @param error 原始错误
   * @param context 附加上下文信息
   */
  async logError(
    error: Error,
    context?: Record<string, unknown>,
  ): Promise<void> {
    const entry = this.createLogEntry(error, context);
    this.recordErrorLog(entry);

    this.logger.error('Error logged', {
      message: error.message,
      type: entry.type,
      context: entry.context,
      stack: error.stack,
    });
  }

  /**
   * 分类错误并创建适当的事务错误
   * @param error 原始错误
   * @param context 错误上下文
   * @param context.transactionId 事务ID
   * @param context.operation 事务操作
   * @param context.additionalContext 额外上下文
   * @returns 分类后的事务错误
   */
  private classifyError(
    error: Error,
    context?: {
      transactionId?: string;
      operation?: TransactionOperation;
      additionalContext?: Record<string, unknown>;
    },
  ): TransactionError {
    const errorMessage = error.message.toLowerCase();
    const transactionId = context?.transactionId || 'unknown';
    const operation = context?.operation;

    // 检查数据库连接错误
    if (
      errorMessage.includes('connection') ||
      errorMessage.includes('connect')
    ) {
      return TransactionError.databaseConnectionError(transactionId, error);
    }

    // 检查超时错误
    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('timed out')
    ) {
      return TransactionError.timeoutError(
        transactionId,
        30000,
        operation?.type,
      );
    }

    // 检查约束违反错误
    if (
      errorMessage.includes('constraint') ||
      errorMessage.includes('unique') ||
      errorMessage.includes('foreign key')
    ) {
      const constraint = this.extractConstraintName(errorMessage);
      if (operation) {
        return TransactionError.constraintViolation(
          transactionId,
          constraint,
          operation,
          error,
        );
      }
    }

    // 检查保存点错误
    if (errorMessage.includes('savepoint')) {
      const savepointOperation = errorMessage.includes('create')
        ? 'create'
        : errorMessage.includes('rollback')
          ? 'rollback'
          : 'release';
      return TransactionError.savepointError(
        transactionId,
        'unknown',
        savepointOperation,
        error,
      );
    }

    // 默认为操作执行失败
    if (operation) {
      return TransactionError.operationExecutionFailed(
        transactionId,
        operation,
        error,
      );
    }

    // 通用事务错误
    return new TransactionError(
      TransactionErrorType.OPERATION_EXECUTION_FAILED,
      `Transaction error: ${error.message}`,
      { transactionId, cause: error, context: context?.additionalContext },
    );
  }

  /**
   * 从错误消息中提取约束名称
   * @param errorMessage 错误消息
   * @returns 约束名称
   */
  private extractConstraintName(errorMessage: string): string {
    const constraintMatch = errorMessage.match(
      /constraint["']?([^"'\s]+)["']?/i,
    );
    return constraintMatch ? constraintMatch[1] : 'unknown';
  }

  /**
   * 记录错误
   * @param error 事务错误
   */
  private logTransactionError(error: TransactionError): void {
    const context: Record<string, unknown> = {
      ...(error.context ?? {}),
    };

    if (error.transactionId) {
      context.transactionId = error.transactionId;
    }

    if (error.operation) {
      context.operation = {
        type: error.operation.type,
        target: error.operation.target,
        targetId: error.operation.targetId,
      };
    }

    if (error.cause) {
      context.cause = error.cause.message;
    }

    this.recordErrorLog({
      message: error.message,
      context,
      timestamp: new Date(),
      stack: error.stack,
      type: error.type,
    });

    // 确保error有getDetails方法
    const errorDetails = error.getDetails
      ? error.getDetails()
      : {
          type: error.type || 'UNKNOWN',
          message: error.message,
          transactionId: error.transactionId,
          operation: error.operation
            ? {
                type: error.operation.type,
                target: error.operation.target,
                targetId: error.operation.targetId,
              }
            : undefined,
          context: error.context,
          cause: error.cause
            ? {
                message: error.cause.message,
                stack: error.cause.stack,
              }
            : undefined,
          stack: error.stack,
        };

    switch (error.type) {
      case TransactionErrorType.TRANSACTION_NOT_FOUND:
      case TransactionErrorType.QUERY_RUNNER_NOT_FOUND:
      case TransactionErrorType.INVALID_TRANSACTION_STATE:
        this.logger.warn('Transaction state error', errorDetails);
        break;

      case TransactionErrorType.OPERATION_EXECUTION_FAILED:
      case TransactionErrorType.SAVEPOINT_ERROR:
      case TransactionErrorType.NESTED_TRANSACTION_ERROR:
        this.logger.error('Transaction operation error', errorDetails);
        break;

      case TransactionErrorType.COMMIT_FAILED:
      case TransactionErrorType.ROLLBACK_FAILED:
        this.logger.error('Transaction lifecycle error', errorDetails);
        break;

      case TransactionErrorType.DATABASE_CONNECTION_ERROR:
      case TransactionErrorType.TIMEOUT_ERROR:
      case TransactionErrorType.CONSTRAINT_VIOLATION:
        this.logger.error('Transaction system error', errorDetails);
        break;

      default:
        this.logger.error('Unknown transaction error', errorDetails);
        break;
    }
  }

  /**
   * 执行带重试的操作
   * @param operation 要执行的操作
   * @param options 重试选项
   * @returns 操作结果
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries: number;
      retryDelay: number;
    },
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === options.maxRetries) {
          throw lastError;
        }

        this.logger.warn(
          `Operation failed, retrying (${attempt + 1}/${options.maxRetries})`,
          {
            error: lastError.message,
            attempt: attempt + 1,
          },
        );

        // 等待后重试
        await new Promise((resolve) => setTimeout(resolve, options.retryDelay));
      }
    }

    throw lastError!;
  }

  /**
   * 执行带事务恢复的操作
   * @param operation 要执行的操作
   * @param options 重试选项
   * @returns 操作结果
   */
  async executeWithTransactionRecovery<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries: number;
      retryDelay: number;
    },
  ): Promise<T> {
    return this.executeWithRetry(operation, options);
  }

  /**
   * 执行批量操作并支持恢复
   * @param operations 操作数组
   * @param options 批量操作选项
   * @returns 批量操作结果
   */
  async executeBatchWithRecovery<T>(
    operations: Array<() => Promise<T>>,
    options: {
      continueOnError: boolean;
      maxFailures: number;
    },
  ): Promise<{
    successful: number;
    failed: number;
    total: number;
    results: Array<T | Error>;
  }> {
    const results: Array<T | Error> = [];
    let successful = 0;
    let failed = 0;

    for (const operation of operations) {
      try {
        const result = await operation();
        results.push(result);
        successful++;
      } catch (error) {
        results.push(error instanceof Error ? error : new Error(String(error)));
        failed++;

        if (!options.continueOnError || failed > options.maxFailures) {
          break;
        }
      }
    }

    return {
      successful,
      failed,
      total: operations.length,
      results,
    };
  }

  /**
   * 创建断路器
   * @param options 断路器选项
   * @returns 断路器实例
   */
  createCircuitBreaker(options: {
    failureThreshold: number;
    timeout: number;
  }): {
    execute: <T>(operation: () => Promise<T>) => Promise<T>;
    isOpen: () => boolean;
  } {
    let failureCount = 0;
    let lastFailureTime = 0;
    let state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

    return {
      async execute<T>(operation: () => Promise<T>): Promise<T> {
        if (state === 'OPEN') {
          if (Date.now() - lastFailureTime > options.timeout) {
            state = 'HALF_OPEN';
          } else {
            throw new Error('Circuit breaker is open');
          }
        }

        try {
          const result = await operation();

          if (state === 'HALF_OPEN') {
            state = 'CLOSED';
            failureCount = 0;
          }

          return result;
        } catch (error) {
          failureCount++;
          lastFailureTime = Date.now();

          if (failureCount >= options.failureThreshold) {
            state = 'OPEN';
          }

          throw error;
        }
      },

      isOpen: () => state === 'OPEN',
    };
  }

  /**
   * 执行带降级的操作
   * @param primaryOperation 主要操作
   * @param fallbackOperation 降级操作
   * @returns 操作结果
   */
  async executeWithFallback<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T>,
  ): Promise<T> {
    try {
      return await primaryOperation();
    } catch (primaryError) {
      this.logger.warn('Primary operation failed, trying fallback', {
        error:
          primaryError instanceof Error
            ? primaryError.message
            : String(primaryError),
      });

      try {
        return await fallbackOperation();
      } catch (fallbackError) {
        this.logger.error('Both primary and fallback operations failed', {
          primaryError:
            primaryError instanceof Error
              ? primaryError.message
              : String(primaryError),
          fallbackError:
            fallbackError instanceof Error
              ? fallbackError.message
              : String(fallbackError),
        });

        throw fallbackError;
      }
    }
  }

  /**
   * 记录错误日志（用于测试）
   * @param error 错误对象
   * @param context 错误上下文
   */
  async logErrorForTest(
    error: Error,
    context?: Record<string, unknown>,
  ): Promise<void> {
    await this.logError(error, context);
  }

  /**
   * 获取错误日志
   * @param options 查询选项
   * @returns 错误日志数组
   */
  async getErrorLogs(options: { startTime: Date; endTime: Date }): Promise<
    Array<{
      message: string;
      context: Record<string, unknown>;
      timestamp: Date;
    }>
  > {
    const entries = this.filterLogsByRange(options.startTime, options.endTime);

    return entries.map((entry) => ({
      message: entry.message,
      context: { ...entry.context },
      timestamp: entry.timestamp,
    }));
  }

  /**
   * 生成错误报告
   * @param options 报告选项
   * @returns 错误报告
   */
  async generateErrorReport(options: {
    startTime: Date;
    endTime: Date;
  }): Promise<{
    totalErrors: number;
    errorTypes: Record<string, number>;
    timeRange: {
      start: Date;
      end: Date;
    };
  }> {
    const entries = this.filterLogsByRange(options.startTime, options.endTime);
    const errorTypes: Record<string, number> = {};

    for (const entry of entries) {
      errorTypes[entry.type] = (errorTypes[entry.type] ?? 0) + 1;
    }

    return {
      totalErrors: entries.length,
      errorTypes,
      timeRange: {
        start: options.startTime,
        end: options.endTime,
      },
    };
  }

  async calculateErrorRate(options: { timeWindow: number }): Promise<number> {
    if (!this.dataSource || options.timeWindow <= 0) {
      return 0;
    }

    try {
      const repository = this.dataSource.getRepository(SystemMetrics);
      const endTime = Date.now();
      const startTime = endTime - options.timeWindow;

      const metrics = await repository
        .createQueryBuilder('metric')
        .where('metric.metric_name = :metricName', {
          metricName: 'operations_total',
        })
        .andWhere('metric.timestamp BETWEEN :start AND :end', {
          start: startTime,
          end: endTime,
        })
        .getMany();

      let total = 0;
      let errorCount = 0;

      for (const metric of metrics) {
        const value = metric.metric_value ?? 0;
        total += value;

        const tags = this.normalizeMetricTags(metric.tags);
        const status = tags.status?.toLowerCase();

        if (status === 'error' || status === 'failed' || status === 'failure') {
          errorCount += value;
        }
      }

      if (!total) {
        return 0;
      }

      return errorCount / total;
    } catch (error) {
      this.logger.error('Failed to calculate error rate', {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * 记录事务性能指标
   * @param transactionId 事务ID
   * @param operation 操作名称
   * @param durationMs 持续时间（毫秒）
   * @param context 上下文信息
   */
  logPerformanceMetrics(
    transactionId: string,
    operation: string,
    durationMs: number,
    context?: Record<string, unknown>,
  ): void {
    const level =
      durationMs > 5000 ? 'warn' : durationMs > 1000 ? 'info' : 'debug';

    this.logger[level]('Transaction performance metric', {
      transactionId,
      operation,
      durationMs,
      ...context,
    });
  }

  /**
   * 记录事务状态变更
   * @param transactionId 事务ID
   * @param fromState 起始状态
   * @param toState 目标状态
   * @param context 上下文信息
   */
  logStateTransition(
    transactionId: string,
    fromState: TransactionStatus,
    toState: TransactionStatus,
    context?: Record<string, unknown>,
  ): void {
    this.logger.debug('Transaction state transition', {
      transactionId,
      fromState,
      toState,
      ...context,
    });
  }

  private createLogEntry(
    error: Error,
    context?: Record<string, unknown>,
  ): ErrorLogEntry {
    return {
      message: error.message,
      context: { ...(context ?? {}) },
      timestamp: new Date(),
      stack: error.stack,
      type:
        error instanceof TransactionError ? error.type : error.name || 'Error',
    };
  }

  private recordErrorLog(entry: ErrorLogEntry): void {
    const clonedEntry: ErrorLogEntry = {
      message: entry.message,
      context: { ...entry.context },
      timestamp: new Date(entry.timestamp),
      stack: entry.stack,
      type: entry.type,
    };

    this.errorLogs.push(clonedEntry);
    if (this.errorLogs.length > this.MAX_ERROR_LOGS) {
      this.errorLogs.shift();
    }
  }

  private filterLogsByRange(startTime: Date, endTime: Date): ErrorLogEntry[] {
    const start = Math.min(startTime.getTime(), endTime.getTime());
    const end = Math.max(startTime.getTime(), endTime.getTime());

    return this.errorLogs.filter((entry) => {
      const timestamp = entry.timestamp.getTime();
      return timestamp >= start && timestamp <= end;
    });
  }

  private normalizeMetricTags(
    tags?: string | Record<string, unknown> | null,
  ): Record<string, string> {
    if (!tags) {
      return {};
    }

    if (typeof tags === 'string') {
      try {
        const parsed = JSON.parse(tags);
        if (parsed && typeof parsed === 'object') {
          return this.normalizeMetricTags(parsed as Record<string, unknown>);
        }
      } catch {
        return {};
      }
      return {};
    }

    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(tags)) {
      if (value === undefined || value === null) {
        continue;
      }
      normalized[key] = String(value);
    }

    return normalized;
  }
}
