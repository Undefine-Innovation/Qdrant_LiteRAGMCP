import { apiClient, PaginationQueryParams } from './api-client.js';
import {
  Document,
  Chunk,
  UploadDocumentResponse,
  PaginatedResponse,
} from '../types/index.js';
import {
  transformDocument,
  transformDocuments,
  transformChunks,
} from '../utils/typeTransformers.js';
import { RetryHandler } from '../utils/errorHandler.js';

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
    const response = await RetryHandler.withRetry(
      () => apiClient.get('/docs', { params }),
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

    // 处理分页响应
    if (response && typeof response === 'object' && !Array.isArray(response)) {
      const responseObj = response as Record<string, unknown>;
      if ('data' in responseObj) {
        return {
          data: transformDocuments((responseObj.data as unknown[]) || []),
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
      ? transformDocuments(response)
      : transformDocuments([]);
  },

  /**
   * 获取单个文档
   */
  getDocument: async (id: string): Promise<Document> => {
    const response = await RetryHandler.withRetry(
      () => apiClient.get(`/docs/${id}`),
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
    return transformDocument(response as Record<string, unknown>);
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
    const response = await RetryHandler.withRetry(
      () => apiClient.upload(`/collections/${collectionId}/docs`, formData),
      {
        maxRetries: 1,
        delay: 2000,
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
    return response as UploadDocumentResponse;
  },

  /**
   * 上传文档到默认集合
   */
  uploadDocument: async (file: File): Promise<UploadDocumentResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await RetryHandler.withRetry(
      () => apiClient.upload('/upload', formData),
      {
        maxRetries: 1,
        delay: 2000,
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
    return response as UploadDocumentResponse;
  },

  /**
   * 重新同步文档
   */
  resyncDocument: async (id: string): Promise<Document> => {
    const response = await apiClient.put(`/docs/${id}/resync`);
    return transformDocument(response as Record<string, unknown>);
  },

  /**
   * 删除文档
   */
  deleteDocument: async (id: string): Promise<void> => {
    return RetryHandler.withRetry(() => apiClient.delete(`/docs/${id}`), {
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
    });
  },

  /**
   * 获取文档的块列表
   */
  getDocumentChunks: async (id: string): Promise<Chunk[]> => {
    const response = await apiClient.get(`/docs/${id}/chunks`);
    return Array.isArray(response)
      ? transformChunks(response)
      : transformChunks([]);
  },

  /**
   * 获取文档的块列表（支持分页）
   */
  getDocumentChunksPaginated: async (
    id: string,
    params?: PaginationQueryParams,
  ): Promise<Chunk[] | PaginatedResponse<Chunk>> => {
    const response = await apiClient.get(`/docs/${id}/chunks`, { params });

    // 处理分页响应
    if (response && typeof response === 'object' && !Array.isArray(response)) {
      const responseObj = response as Record<string, unknown>;
      if ('data' in responseObj) {
        return {
          data: transformChunks((responseObj.data as unknown[]) || []),
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
      ? transformChunks(response)
      : transformChunks([]);
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
    const response = (await apiClient.get(`/docs/${id}/download`, {
      params,
      responseType: 'blob',
    })) as { data: Blob; headers: Record<string, string> };

    // 从响应头获取文件名
    const contentDisposition = response.headers?.['content-disposition'] || '';
    const filenameMatch = contentDisposition.match(
      /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/,
    );
    const filename = filenameMatch
      ? filenameMatch[1].replace(/['"]/g, '')
      : `document.${params?.format || 'original'}`;

    return {
      content: response.data,
      mimeType:
        (response.headers?.['content-type'] as string) ||
        'application/octet-stream',
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
