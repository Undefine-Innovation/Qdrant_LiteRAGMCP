import type { ApiError } from '../services/api-client';

/**
 * 全局错误处理器
 * 用于处理未捕获的错误和Promise rejection
 */
class GlobalErrorHandler {
  private errorListeners: Array<(error: ApiError | Error) => void> = [];
  private isInitialized = false;

  /**
   * 初始化全局错误处理
   */
  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // 处理未捕获的Promise rejection
    window.addEventListener(
      'unhandledrejection',
      this.handleUnhandledRejection.bind(this),
    );

    // 处理未捕获的JavaScript错误
    window.addEventListener('error', this.handleGlobalError.bind(this));

    console.log('Global error handler initialized');
  }

  /**
   * 处理未捕获的Promise rejection
   */
  private handleUnhandledRejection(event: PromiseRejectionEvent) {
    console.error('Unhandled promise rejection:', event.reason);

    const error = this.normalizeError(event.reason);
    this.notifyListeners(error);

    // 防止默认的控制台错误输出
    event.preventDefault();
  }

  /**
   * 处理全局JavaScript错误
   */
  private handleGlobalError(event: ErrorEvent) {
    console.error('Global error:', event.error || event.message);

    const error = this.normalizeError(event.error || new Error(event.message));
    this.notifyListeners(error);
  }

  /**
   * 标准化错误对象
   */
  private normalizeError(error: unknown): ApiError {
    if (this.isApiError(error)) {
      return error;
    }

    if (error instanceof Error) {
      return {
        code: 'JAVASCRIPT_ERROR',
        message: error.message,
        details: {
          stack: error.stack,
          name: error.name,
        },
      };
    }

    if (typeof error === 'string') {
      return {
        code: 'UNKNOWN_ERROR',
        message: error,
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: '发生未知错误',
      details: { originalError: error },
    };
  }

  /**
   * 检查是否为ApiError
   */
  private isApiError(error: unknown): error is ApiError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'message' in error
    );
  }

  /**
   * 通知所有错误监听器
   */
  private notifyListeners(error: ApiError) {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (listenerError) {
        console.error('Error in error listener:', listenerError);
      }
    });
  }

  /**
   * 添加错误监听器
   */
  addErrorListener(listener: (error: ApiError | Error) => void) {
    this.errorListeners.push(listener);

    // 返回移除监听器的函数
    return () => {
      const index = this.errorListeners.indexOf(listener);
      if (index > -1) {
        this.errorListeners.splice(index, 1);
      }
    };
  }

  /**
   * 移除错误监听器
   */
  removeErrorListener(listener: (error: ApiError | Error) => void) {
    const index = this.errorListeners.indexOf(listener);
    if (index > -1) {
      this.errorListeners.splice(index, 1);
    }
  }

  /**
   * 手动报告错误
   */
  reportError(error: unknown) {
    const normalizedError = this.normalizeError(error);
    console.error('Manually reported error:', normalizedError);
    this.notifyListeners(normalizedError);
  }

  /**
   * 清理资源
   */
  destroy() {
    if (!this.isInitialized) return;

    window.removeEventListener(
      'unhandledrejection',
      this.handleUnhandledRejection.bind(this),
    );
    window.removeEventListener('error', this.handleGlobalError.bind(this));
    this.errorListeners = [];
    this.isInitialized = false;

    console.log('Global error handler destroyed');
  }
}

// 创建单例实例
const globalErrorHandler = new GlobalErrorHandler();

export default globalErrorHandler;

/**
 * 错误重试工具
 */
export class RetryHandler {
  /**
   * 带重试的异步函数执行
   */
  static async withRetry<T>(
    fn: () => Promise<T>,
    options: {
      maxRetries?: number;
      delay?: number;
      backoff?: boolean;
      shouldRetry?: (error: unknown) => boolean;
    } = {},
  ): Promise<T> {
    const {
      maxRetries = 3,
      delay = 1000,
      backoff = true,
      shouldRetry = () => true,
    } = options;

    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // 如果是最后一次尝试，或者错误不应该重试，直接抛出
        if (attempt === maxRetries || !shouldRetry(error)) {
          throw error;
        }

        // 计算延迟时间
        const currentDelay = backoff ? delay * Math.pow(2, attempt) : delay;

        console.warn(
          `Attempt ${attempt + 1} failed, retrying in ${currentDelay}ms:`,
          error,
        );

        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, currentDelay));
      }
    }

    throw lastError;
  }

  /**
   * 创建可重试的函数包装器
   */
  static createRetryable<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T,
    options: {
      maxRetries?: number;
      delay?: number;
      backoff?: boolean;
      shouldRetry?: (error: unknown) => boolean;
    } = {},
  ): T {
    return (async (...args: Parameters<T>) => {
      return this.withRetry(() => fn(...args), options);
    }) as T;
  }
}
