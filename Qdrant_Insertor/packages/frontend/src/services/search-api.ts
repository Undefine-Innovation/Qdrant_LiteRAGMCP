import { apiClient, PaginationQueryParams } from './api-client.js';
import { SearchResult, PaginatedResponse } from '../types/index.js';

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
  }): Promise<SearchResult[]> => {
    return apiClient.get('/search', { params });
  },

  /**
   * 执行分页搜索
   */
  searchPaginated: async (
    params: PaginationQueryParams & { q: string; collectionId?: string },
  ): Promise<PaginatedResponse<SearchResult>> => {
    return apiClient.get('/search/paginated', { params });
  },
};