import { apiClient } from './api-client.js';
import {
  BatchUploadRequest,
  BatchUploadResponse,
  BatchDeleteDocumentsRequest,
  BatchDeleteCollectionsRequest,
  BatchDeleteResponse,
  BatchOperationProgress,
} from '../types/index.js';
import {
  transformBatchUploadResponse,
  transformBatchDeleteResponse,
  transformBatchOperationProgress,
} from '../utils/typeTransformers.js';

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
    data.files.forEach((file: File) => {
      formData.append('files', file);
    });

    // 添加集合ID（如果提供）
    if (data.collectionId) {
      formData.append('collectionId', data.collectionId);
    }

    const response = await apiClient.upload('/batch/upload', formData);
    return transformBatchUploadResponse(response as Record<string, unknown>);
  },

  /**
   * 批量删除文档
   */
  deleteDocuments: async (
    data: BatchDeleteDocumentsRequest,
  ): Promise<BatchDeleteResponse> => {
    const response = await apiClient.delete('/docs/batch', { data });
    return transformBatchDeleteResponse(response as Record<string, unknown>);
  },

  /**
   * 批量删除集合
   */
  deleteCollections: async (
    data: BatchDeleteCollectionsRequest,
  ): Promise<BatchDeleteResponse> => {
    const response = await apiClient.delete('/collections/batch', { data });
    return transformBatchDeleteResponse(response as Record<string, unknown>);
  },

  /**
   * 获取批量操作进度
   */
  getOperationProgress: async (
    operationId: string,
  ): Promise<BatchOperationProgress> => {
    const response = await apiClient.get(`/batch/progress/${operationId}`);
    return transformBatchOperationProgress(response as Record<string, unknown>);
  },
};
