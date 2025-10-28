import { apiClient } from './api-client.js';
import {
  BatchUploadRequest,
  BatchUploadResponse,
  BatchDeleteDocumentsRequest,
  BatchDeleteCollectionsRequest,
  BatchDeleteResponse,
  BatchOperationProgress,
} from '../types/index.js';

/**
 * 批量操作相关API
 */
export const batchApi = {
  /**
   * 批量上传文档
   */
  uploadDocuments: async (
    data: BatchUploadRequest,
  ): Promise<BatchUploadResponse> => {
    const formData = new FormData();

    // 添加文件
    data.files.forEach(file => {
      formData.append('files', file);
    });

    // 添加集合ID（如果提供）
    if (data.collectionId) {
      formData.append('collectionId', data.collectionId);
    }

    return apiClient.upload('/upload/batch', formData);
  },

  /**
   * 批量删除文档
   */
  deleteDocuments: async (
    data: BatchDeleteDocumentsRequest,
  ): Promise<BatchDeleteResponse> => {
    return apiClient.delete('/docs/batch', { data });
  },

  /**
   * 批量删除集合
   */
  deleteCollections: async (
    data: BatchDeleteCollectionsRequest,
  ): Promise<BatchDeleteResponse> => {
    return apiClient.delete('/collections/batch', { data });
  },

  /**
   * 获取批量操作进度
   */
  getOperationProgress: async (
    operationId: string,
  ): Promise<BatchOperationProgress> => {
    return apiClient.get(`/batch/progress/${operationId}`);
  },
};