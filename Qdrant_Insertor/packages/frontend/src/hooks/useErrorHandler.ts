import { useCallback } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import type { ApiError } from '@/services/api-client';

/**
 * 错误处理 Hook
 * 提供统一的错误处理逻辑
 */
export const useErrorHandler = () => {
  const { setError, addErrorToHistory, clearError } = useAppStore();

  /**
   * 处理错误
   * @param error - 错误对象或字符串
   * @param options - 处理选项
   */
  const handleError = useCallback(
    (
      error: unknown,
      options: {
        showToast?: boolean;
        addToHistory?: boolean;
        customMessage?: string;
      } = {},
    ) => {
      const { showToast = true, addToHistory = true, customMessage } = options;

      let normalizedError: ApiError;

      if (typeof error === 'string') {
        normalizedError = {
          code: 'UNKNOWN_ERROR',
          message: customMessage || error,
        };
      } else if (error instanceof Error) {
        normalizedError = {
          code: 'JAVASCRIPT_ERROR',
          message: customMessage || error.message,
          details: {
            stack: error.stack,
            name: error.name,
          },
        };
      } else if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        'message' in error
      ) {
        normalizedError = error as ApiError;
      } else {
        normalizedError = {
          code: 'UNKNOWN_ERROR',
          message: customMessage || '发生未知错误',
          details: { originalError: error },
        };
      }

      if (showToast) {
        setError(normalizedError);
      }

      if (addToHistory) {
        addErrorToHistory(normalizedError);
      }

      return normalizedError;
    },
    [setError, addErrorToHistory],
  );

  /**
   * 清除当前错误
   */
  const clearCurrentError = useCallback(() => {
    clearError();
  }, [clearError]);

  /**
   * 异步错误处理包装器
   * @param asyncFn - 异步函数
   * @param options - 处理选项
   */
  const withErrorHandling = useCallback(
    async <T>(
      asyncFn: () => Promise<T>,
      options: {
        showToast?: boolean;
        addToHistory?: boolean;
        customMessage?: string;
        onSuccess?: (result: T) => void;
        onError?: (error: ApiError) => void;
      } = {},
    ): Promise<T | null> => {
      const {
        showToast = true,
        addToHistory = true,
        onSuccess,
        onError,
      } = options;

      try {
        const result = await asyncFn();
        onSuccess?.(result);
        return result;
      } catch (error) {
        const normalizedError = handleError(error, {
          showToast,
          addToHistory,
        });
        onError?.(normalizedError);
        return null;
      }
    },
    [handleError],
  );

  return {
    handleError,
    clearCurrentError,
    withErrorHandling,
  };
};

export default useErrorHandler;
