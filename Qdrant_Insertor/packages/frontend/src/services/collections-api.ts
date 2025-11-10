import { apiClient, PaginationQueryParams } from './api-client.js';
import { Collection, PaginatedResponse } from '../types/index.js';
import {
  transformCollection,
  transformCollections,
  toBackendCollection,
} from '../utils/typeTransformers.js';
import { RetryHandler } from '../utils/errorHandler.js';

/**
 * 集合相关API
 */
export const collectionsApi = {
  /**
   * 获取集合列表（支持分页）
   */
  getCollections: async (
    params?: PaginationQueryParams,
  ): Promise<Collection[] | PaginatedResponse<Collection>> => {
    const response = await RetryHandler.withRetry(
      () => apiClient.get('/collections', { params }),
      {
        maxRetries: 2,
        delay: 1000,
        shouldRetry: error => {
          // 只对网络错误和服务器错误重试
          const code = (error as { code?: string })?.code;
          return (
            code === 'NETWORK_ERROR' ||
            code === 'INTERNAL_SERVER_ERROR' ||
            code === 'SERVICE_UNAVAILABLE'
          );
        },
      },
    );

    // 处理分页响应
    if (response && typeof response === 'object' && !Array.isArray(response)) {
      const responseObj = response as Record<string, unknown>;
      if ('data' in responseObj) {
        return {
          data: transformCollections((responseObj.data as unknown[]) || []),
          pagination: ((responseObj.pagination as unknown) || {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          }) as unknown as {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
          },
        };
      }
    }

    // 处理数组响应
    return Array.isArray(response)
      ? transformCollections(response)
      : transformCollections([]);
  },

  /**
   * 获取单个集合
   */
  getCollection: async (id: string): Promise<Collection> => {
    const response = await RetryHandler.withRetry(
      () => apiClient.get(`/collections/${id}`),
      {
        maxRetries: 2,
        delay: 1000,
        shouldRetry: error => {
          const code = (error as { code?: string })?.code;
          return (
            code === 'NETWORK_ERROR' ||
            code === 'INTERNAL_SERVER_ERROR' ||
            code === 'SERVICE_UNAVAILABLE'
          );
        },
      },
    );
    return transformCollection(response as Record<string, unknown>);
  },

  /**
   * 创建集合
   */
  createCollection: async (data: {
    name: string;
    description?: string;
  }): Promise<Collection> => {
    const response = await RetryHandler.withRetry(
      () => apiClient.post('/collections', toBackendCollection(data)),
      {
        maxRetries: 1,
        delay: 1000,
        shouldRetry: error => {
          const code = (error as { code?: string })?.code;
          return (
            code === 'NETWORK_ERROR' ||
            code === 'INTERNAL_SERVER_ERROR' ||
            code === 'SERVICE_UNAVAILABLE'
          );
        },
      },
    );
    return transformCollection(response as Record<string, unknown>);
  },

  /**
   * 更新集合
   */
  updateCollection: async (
    id: string,
    data: { name?: string; description?: string },
  ): Promise<Collection> => {
    const response = await apiClient.put(
      `/collections/${id}`,
      toBackendCollection(data),
    );
    return transformCollection(response as Record<string, unknown>);
  },

  /**
   * 部分更新集合
   */
  patchCollection: async (
    id: string,
    data: { name?: string; description?: string },
  ): Promise<Collection> => {
    const response = await apiClient.patch(
      `/collections/${id}`,
      toBackendCollection(data),
    );
    return transformCollection(response as Record<string, unknown>);
  },

  /**
   * 删除集合
   */
  deleteCollection: async (id: string): Promise<void> => {
    return RetryHandler.withRetry(
      () => apiClient.delete(`/collections/${id}`),
      {
        maxRetries: 2,
        delay: 1000,
        shouldRetry: error => {
          const code = (error as { code?: string })?.code;
          return (
            code === 'NETWORK_ERROR' ||
            code === 'INTERNAL_SERVER_ERROR' ||
            code === 'SERVICE_UNAVAILABLE'
          );
        },
      },
    );
  },
};
