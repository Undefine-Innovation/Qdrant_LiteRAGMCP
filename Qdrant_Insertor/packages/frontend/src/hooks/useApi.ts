import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiError } from '../services/api';
import { useAppStore } from '../stores/useAppStore';

/**
 * API 请求状态接口
 */
interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  retryCount: number;
  lastUpdated: number | null;
}

/**
 * API 请求配置接口
 */
interface ApiConfig {
  maxRetries?: number;
  retryDelay?: number;
  retryCondition?: (error: ApiError) => boolean;
  onSuccess?: (data: unknown) => void;
  onError?: (error: ApiError) => void;
  onRetry?: (retryCount: number, error: ApiError) => void;
}

/**
 * API 请求 Hook
 * 提供统一的 API 请求状态管理
 * @param apiCall - API 调用函数
 * @returns API 状态和执行函数
 */
export const useApi = <T = unknown>(
  apiCall: () => Promise<T>,
  config: ApiConfig = {},
): {
  state: ApiState<T>;
  execute: () => Promise<void>;
  reset: () => void;
  retry: () => Promise<void>;
} => {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    retryCondition = (error: ApiError) => {
      // 默认重试条件：网络错误或5xx服务器错误
      return (
        error.code === 'NETWORK_ERROR' ||
        (typeof error.code === 'number' && error.code >= 500)
      );
    },
    onSuccess,
    onError,
    onRetry,
  } = config;

  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
    retryCount: 0,
    lastUpdated: null,
  });

  const { setLoading, setError } = useAppStore();
  const abortControllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(async () => {
    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    let currentRetryCount = 0;

    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
      retryCount: 0,
    }));
    setLoading(true);
    setError(null);

    const attemptRequest = async (): Promise<T> => {
      try {
        const result = await apiCall();

        setState({
          data: result,
          loading: false,
          error: null,
          retryCount: currentRetryCount,
          lastUpdated: Date.now(),
        });

        onSuccess?.(result);
        return result;
      } catch (error) {
        const apiError = error as ApiError;

        if (currentRetryCount < maxRetries && retryCondition(apiError)) {
          currentRetryCount++;

          setState(prev => ({
            ...prev,
            retryCount: currentRetryCount,
          }));

          onRetry?.(currentRetryCount, apiError);

          // 等待后重试
          await new Promise(resolve =>
            setTimeout(resolve, retryDelay * currentRetryCount),
          );
          return attemptRequest();
        } else {
          const errorMessage = apiError.message || '请求失败';

          setState({
            data: null,
            loading: false,
            error: errorMessage,
            retryCount: currentRetryCount,
            lastUpdated: null,
          });

          onError?.(apiError);
          setError(errorMessage);
          throw apiError;
        }
      }
    };

    try {
      await attemptRequest();
    } finally {
      setLoading(false);
    }
  }, [
    apiCall,
    maxRetries,
    retryDelay,
    retryCondition,
    onSuccess,
    onError,
    onRetry,
    setLoading,
    setError,
  ]);

  const retry = useCallback(async () => {
    await execute();
  }, [execute]);

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setState({
      data: null,
      loading: false,
      error: null,
      retryCount: 0,
      lastUpdated: null,
    });
  }, []);

  // 清理函数
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return { state, execute, reset, retry };
};

/**
 * 自动执行的 API 请求 Hook
 * 组件挂载时自动执行 API 请求
 * @param apiCall - API 调用函数
 * @param deps - 依赖数组
 * @returns API 状态
 */
export const useAutoApi = <T = unknown>(
  apiCall: () => Promise<T>,
  deps: unknown[] = [],
  config: ApiConfig = {},
): ApiState<T> => {
  const { state, execute } = useApi(apiCall, config);

  useEffect(() => {
    execute();
  }, deps);

  return state;
};

/**
 * 分页 API 请求 Hook
 * 用于处理分页数据的加载
 * @param apiCall - API 调用函数，接受页码参数
 * @returns 分页状态和操作函数
 */
export const usePaginatedApi = <T = unknown>(
  apiCall: (
    page: number,
    limit: number,
  ) => Promise<{
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>,
  config: ApiConfig = {},
): {
  state: ApiState<{
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  loadPage: (page: number, limit?: number) => Promise<void>;
  nextPage: () => Promise<void>;
  prevPage: () => Promise<void>;
  reset: () => void;
  hasNext: boolean;
  hasPrev: boolean;
} => {
  const [currentPage, setCurrentPage] = useState(1);
  const [currentLimit, setCurrentLimit] = useState(10);

  const { state, execute, reset } = useApi(
    () => apiCall(currentPage, currentLimit),
    config,
  );

  const loadPage = useCallback(
    async (page: number, limit: number = currentLimit) => {
      setCurrentPage(page);
      setCurrentLimit(limit);
    },
    [currentLimit],
  );

  const nextPage = useCallback(async () => {
    if (state.data && currentPage < state.data.totalPages) {
      await loadPage(currentPage + 1);
    }
  }, [currentPage, state.data, loadPage]);

  const prevPage = useCallback(async () => {
    if (currentPage > 1) {
      await loadPage(currentPage - 1);
    }
  }, [currentPage, loadPage]);

  useEffect(() => {
    if (currentPage > 0) {
      execute();
    }
  }, [currentPage, currentLimit, execute]);

  const hasNext = state.data ? currentPage < state.data.totalPages : false;
  const hasPrev = currentPage > 1;

  return {
    state,
    loadPage,
    nextPage,
    prevPage,
    reset,
    hasNext,
    hasPrev,
  };
};

/**
 * 防抖API Hook
 * 用于处理需要防抖的API请求
 */
export const useDebouncedApi = <T = unknown>(
  apiCall: (query: string) => Promise<T>,
  delay: number = 300,
  config: ApiConfig = {},
): {
  state: ApiState<T>;
  execute: (query: string) => Promise<void>;
  reset: () => void;
} => {
  const [query, setQuery] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { state, execute, reset } = useApi(() => apiCall(query), config);

  const debouncedExecute = useCallback(
    (newQuery: string) => {
      setQuery(newQuery);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        if (newQuery.trim()) {
          execute();
        }
      }, delay);
    },
    [apiCall, delay, execute],
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    state,
    execute: debouncedExecute as (query: string) => Promise<void>,
    reset,
  };
};

export default useApi;
