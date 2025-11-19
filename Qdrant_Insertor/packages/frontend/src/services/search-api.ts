import { apiClient, PaginationQueryParams } from './api-client.js';
import { SearchResult, PaginatedResponse } from '../types/index.js';
import {
  transformSearchResults,
  transformSearchResponse,
} from '../utils/typeTransformers.js';

/**
 * 搜索相关API
 */
export const searchApi = {
  /**
   * 执行搜索（非分页）
   */
  search: async (params: {
    q: string;
    collectionId: string;
    limit?: number;
  }): Promise<{ results: SearchResult[]; total: number; query: string }> => {
    const response = await apiClient.get('/search', { params });
    return transformSearchResponse(
      response as Record<string, unknown> | unknown[],
    );
  },

  /**
   * 执行分页搜索
   */
  searchPaginated: async (
    params: PaginationQueryParams & { q: string; collectionId?: string },
  ): Promise<PaginatedResponse<SearchResult>> => {
    const response = await apiClient.get('/search/paginated', { params });

    // 处理分页响应
    if (response && typeof response === 'object' && !Array.isArray(response)) {
      const responseObj = response as Record<string, unknown>;
      if ('data' in responseObj) {
        return {
          data: transformSearchResults((responseObj.data as unknown[]) || []),
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
      ? {
          data: transformSearchResults(response),
          pagination: {
            page: 1,
            limit: 20,
            total: response.length,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        }
      : {
          data: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        };
  },
};
