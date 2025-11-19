/**
 * 事务恢复管理器
 * 负责事务恢复、重试、断路器和降级逻辑
 */

import { Logger } from '@logging/logger.js';
import { CoreError } from '@domain/errors/CoreError.js';
// 简化的类型定义，不再需要单独的错误类型文件
export interface RetryOptions {
  maxRetries: number;
  retryDelay: number;
}

export interface BatchOperationOptions {
  continueOnError: boolean;
  maxFailures: number;
}

export interface BatchOperationResult<T> {
  successful: number;
  failed: number;
  total: number;
  results: Array<T | Error>;
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  timeout: number;
}

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * 事务恢复管理器
 */
export class TransactionRecoveryManager {
  /**
   * 创建事务恢复管理器实例
   * @param logger 日志记录器
   */
  constructor(private readonly logger: Logger) {}

  /**
   * 执行带重试的操作
   * @param operation 要执行的操作
   * @param options 重试选项
   * @returns 操作结果
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions,
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

        // 检查是否为可重试错误
        // 简化后不再有单独的事务错误类，所有错误都使用CoreError
        if (lastError instanceof CoreError && !lastError.isTemporary()) {
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
    options: RetryOptions,
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
    options: BatchOperationOptions,
  ): Promise<BatchOperationResult<T>> {
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

    const parentLogger = this.logger;

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
  createCircuitBreaker(options: CircuitBreakerOptions): {
    execute: <T>(operation: () => Promise<T>) => Promise<T>;
    isOpen: () => boolean;
    getState: () => CircuitBreakerState;
    reset: () => void;
  } {
    let failureCount = 0;
    let lastFailureTime = 0;
    let state: CircuitBreakerState = 'CLOSED';

    const parentLogger = this.logger;

    return {
      async execute<T>(operation: () => Promise<T>): Promise<T> {
        if (state === 'OPEN') {
          if (Date.now() - lastFailureTime > options.timeout) {
            state = 'HALF_OPEN';
            parentLogger.info('Circuit breaker transitioning to HALF_OPEN');
          } else {
            throw new Error('Circuit breaker is open');
          }
        }

        try {
          const result = await operation();

          if (state === 'HALF_OPEN') {
            state = 'CLOSED';
            failureCount = 0;
            parentLogger.info('Circuit breaker transitioning to CLOSED');
          }

          return result;
        } catch (error) {
          failureCount++;
          lastFailureTime = Date.now();

          if (failureCount >= options.failureThreshold) {
            state = 'OPEN';
            parentLogger.warn('Circuit breaker transitioning to OPEN', {
              failureCount,
              threshold: options.failureThreshold,
            });
          }

          throw error;
        }
      },

      isOpen: () => state === 'OPEN',

      getState: () => state,

      reset: () => {
        state = 'CLOSED';
        failureCount = 0;
        lastFailureTime = 0;
        parentLogger.info('Circuit breaker reset to CLOSED');
      },
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
   * 执行带指数退避的重试操作
   * @param operation 要执行的操作
   * @param options 重试选项
   * @param baseDelay 基础延迟时间（毫秒）
   * @param maxDelay 最大延迟时间（毫秒）
   * @returns 操作结果
   */
  async executeWithExponentialBackoff<T>(
    operation: () => Promise<T>,
    options: RetryOptions,
    baseDelay: number = 1000,
    maxDelay: number = 30000,
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

        // 检查是否为可重试错误
        // 简化后不再有单独的事务错误类，所有错误都使用CoreError
        if (lastError instanceof CoreError && !lastError.isTemporary()) {
          throw lastError;
        }

        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

        this.logger.warn(
          `Operation failed, retrying with exponential backoff (${attempt + 1}/${options.maxRetries})`,
          {
            error: lastError.message,
            attempt: attempt + 1,
            delay,
          },
        );

        // 等待后重试
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  /**
   * 执行带超时的操作
   * @param operation 要执行的操作
   * @param timeoutMs 超时时间（毫秒）
   * @returns 操作结果
   */
  async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  }

  /**
   * 执行带断路器和重试的操作
   * @param operation 要执行的操作
   * @param retryOptions 重试选项
   * @param circuitBreakerOptions 断路器选项
   * @returns 操作结果
   */
  async executeWithCircuitBreakerAndRetry<T>(
    operation: () => Promise<T>,
    retryOptions: RetryOptions,
    circuitBreakerOptions: CircuitBreakerOptions,
  ): Promise<T> {
    const circuitBreaker = this.createCircuitBreaker(circuitBreakerOptions);

    return circuitBreaker.execute(async () => {
      return this.executeWithRetry(operation, retryOptions);
    });
  }
}
