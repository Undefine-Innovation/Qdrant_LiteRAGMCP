import { apiClient, PaginationQueryParams } from './api-client.js';
import {
  Document,
  Chunk,
  UploadDocumentResponse,
  PaginatedResponse,
} from '../types/index.js';

/**
 * 文档相关API
 */
export const documentsApi = {
  /**
   * 获取文档列表（支持分页）
   */
  getDocuments: async (
    params?: PaginationQueryParams & { collectionId?: string },
  ): Promise<Document[] | PaginatedResponse<Document>> => {
    return apiClient.get('/docs', { params });
  },

  /**
   * 获取单个文档
   */
  getDocument: async (id: string): Promise<Document> => {
    return apiClient.get(`/docs/${id}`);
  },

  /**
   * 上传文档到指定集合
   */
  uploadToCollection: async (
    collectionId: string,
    file: File,
  ): Promise<UploadDocumentResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.upload(`/collections/${collectionId}/docs`, formData);
  },

  /**
   * 上传文档到默认集合
   */
  uploadDocument: async (file: File): Promise<UploadDocumentResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.upload('/upload', formData);
  },

  /**
   * 重新同步文档
   */
  resyncDocument: async (id: string): Promise<Document> => {
    return apiClient.put(`/docs/${id}/resync`);
  },

  /**
   * 删除文档
   */
  deleteDocument: async (id: string): Promise<void> => {
    return apiClient.delete(`/docs/${id}`);
  },

  /**
   * 获取文档的块列表
   */
  getDocumentChunks: async (id: string): Promise<Chunk[]> => {
    return apiClient.get(`/docs/${id}/chunks`);
  },

  /**
   * 获取文档的块列表（支持分页）
   */
  getDocumentChunksPaginated: async (
    id: string,
    params?: PaginationQueryParams,
  ): Promise<Chunk[] | PaginatedResponse<Chunk>> => {
    return apiClient.get(`/docs/${id}/chunks`, { params });
  },

  /**
   * 获取文档预览内容
   */
  getDocumentPreview: async (
    id: string,
    params?: { format?: 'html' | 'text' | 'json' },
  ): Promise<{
    content: string;
    mimeType: string;
    format: string;
  }> => {
    return apiClient.get(`/docs/${id}/preview`, { params });
  },

  /**
   * 下载文档
   */
  getDocumentDownload: async (
    id: string,
    params?: { format?: 'original' | 'html' | 'txt' },
  ): Promise<{
    content: Blob;
    mimeType: string;
    filename: string;
  }> => {
    const response = await apiClient.get(`/docs/${id}/download`, {
      params,
      responseType: 'blob',
    });

    // 从响应头获取文件名
    const contentDisposition = response.headers?.['content-disposition'] || '';
    const filenameMatch = contentDisposition.match(
      /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/,
    );
    const filename = filenameMatch
      ? filenameMatch[1].replace(/['"]/g, '')
      : `document.${params?.format || 'original'}`;

    return {
      content: response,
      mimeType:
        response.headers?.['content-type'] || 'application/octet-stream',
      filename,
    };
  },

  /**
   * 获取文档缩略图
   */
  getDocumentThumbnail: async (
    id: string,
    params?: { width?: number; height?: number },
  ): Promise<Blob> => {
    return apiClient.get(`/docs/${id}/thumbnail`, {
      params,
      responseType: 'blob',
    });
  },

  /**
   * 获取文档格式信息
   */
  getDocumentFormat: async (
    id: string,
  ): Promise<{
    format: {
      mimeType: string;
      extension: string;
      category: 'text' | 'markdown' | 'pdf' | 'word' | 'unknown';
    };
  }> => {
    return apiClient.get(`/docs/${id}/format`);
  },
};