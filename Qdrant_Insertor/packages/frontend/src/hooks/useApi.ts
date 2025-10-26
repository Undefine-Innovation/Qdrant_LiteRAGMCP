import { useState, useEffect, useCallback } from 'react';
import { ApiError } from '../services/api';
import { useAppStore } from '../stores/useAppStore';

/**
 * API 请求状态接口
 */
interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * API 请求 Hook
 * 提供统一的 API 请求状态管理
 * @param apiCall - API 调用函数
 * @returns API 状态和执行函数
 */
export const useApi = <T = any>(
  apiCall: () => Promise<T>,
): {
  state: ApiState<T>;
  execute: () => Promise<void>;
  reset: () => void;
} => {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const { setLoading, setError } = useAppStore();

  const execute = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    setLoading(true);
    setError(null);

    try {
      const result = await apiCall();
      setState({
        data: result,
        loading: false,
        error: null,
      });
    } catch (error) {
      const errorMessage = (error as ApiError).message || '请求失败';
      setState({
        data: null,
        loading: false,
        error: errorMessage,
      });
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [apiCall, setLoading, setError]);

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
    });
  }, []);

  return { state, execute, reset };
};

/**
 * 自动执行的 API 请求 Hook
 * 组件挂载时自动执行 API 请求
 * @param apiCall - API 调用函数
 * @param deps - 依赖数组
 * @returns API 状态
 */
export const useAutoApi = <T = any>(
  apiCall: () => Promise<T>,
  deps: any[] = [],
): ApiState<T> => {
  const { state, execute } = useApi(apiCall);

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
export const usePaginatedApi = <T = any>(
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
} => {
  const [currentPage, setCurrentPage] = useState(1);
  const [currentLimit, setCurrentLimit] = useState(10);

  const { state, execute, reset } = useApi(() =>
    apiCall(currentPage, currentLimit),
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

  return {
    state,
    loadPage,
    nextPage,
    prevPage,
    reset,
  };
};

export default useApi;
