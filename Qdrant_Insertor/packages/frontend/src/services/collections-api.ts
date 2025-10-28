import { apiClient, PaginationQueryParams } from './api-client.js';
import { Collection, PaginatedResponse } from '../types/index.js';

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
    return apiClient.get('/collections', { params });
  },

  /**
   * 获取单个集合
   */
  getCollection: async (id: string): Promise<Collection> => {
    return apiClient.get(`/collections/${id}`);
  },

  /**
   * 创建集合
   */
  createCollection: async (data: {
    name: string;
    description?: string;
  }): Promise<Collection> => {
    return apiClient.post('/collections', data);
  },

  /**
   * 更新集合
   */
  updateCollection: async (
    id: string,
    data: { name?: string; description?: string },
  ): Promise<Collection> => {
    return apiClient.put(`/collections/${id}`, data);
  },

  /**
   * 部分更新集合
   */
  patchCollection: async (
    id: string,
    data: { name?: string; description?: string },
  ): Promise<Collection> => {
    return apiClient.patch(`/collections/${id}`, data);
  },

  /**
   * 删除集合
   */
  deleteCollection: async (id: string): Promise<void> => {
    return apiClient.delete(`/collections/${id}`);
  },
};