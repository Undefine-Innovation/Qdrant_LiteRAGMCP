import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import {
  PaginationParams,
  Collection,
  Document,
  SearchResult,
  PaginatedResponse,
  Chunk,
  UploadDocumentResponse,
  HealthCheckResponse,
  DetailedHealthCheckResponse,
  BatchUploadRequest,
  BatchUploadResponse,
  BatchDeleteDocumentsRequest,
  BatchDeleteCollectionsRequest,
  BatchDeleteResponse,
  BatchOperationProgress,
} from '../types/index.js';

/**
 * API 响应接口
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

/**
 * API 错误接口
 */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * 分页查询参数接口
 */
export interface PaginationQueryParams extends PaginationParams {
  [key: string]: unknown; // 允许其他查询参数
}

/**
 * API 客户端类
 * 封装 Axios 实例，提供统一的请求处理
 */
class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 请求拦截器
    this.client.interceptors.request.use(
      config => {
        // 可以在这里添加认证 token
        // const token = getAuthToken();
        // if (token) {
        //   config.headers.Authorization = `Bearer ${token}`;
        // }
        return config;
      },
      error => {
        return Promise.reject(error);
      },
    );

    // 响应拦截器
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      error => {
        // 统一错误处理
        const apiError: ApiError = {
          code: error.response?.status || 'NETWORK_ERROR',
          message: error.response?.data?.message || error.message || '请求失败',
          details: error.response?.data?.details,
        };

        console.error('API Error:', apiError);
        return Promise.reject(apiError);
      },
    );
  }

  /**
   * GET 请求
   */
  async get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  /**
   * POST 请求
   */
  async post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  /**
   * PUT 请求
   */
  async put<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  /**
   * DELETE 请求
   */
  async delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }

  /**
   * PATCH 请求
   */
  async patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  /**
   * 上传文件
   */
  async upload<T = unknown>(
    url: string,
    formData: FormData,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response = await this.client.post<T>(url, formData, {
      ...config,
      headers: {
        'Content-Type': 'multipart/form-data',
        ...config?.headers,
      },
    });
    return response.data;
  }
}

// 创建单例实例
export const apiClient = new ApiClient();

// 导出默认实例
export default apiClient;

// ==================== API 服务方法 ====================

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

/**
 * 监控相关API
 */
export const monitoringApi = {
  /**
   * 获取告警规则列表
   */
  getAlertRules: async () => {
    return apiClient.get('/alert-rules');
  },

  /**
   * 获取告警规则列表（支持分页）
   */
  getAlertRulesPaginated: async (params?: PaginationQueryParams) => {
    return apiClient.get('/alert-rules', { params });
  },

  /**
   * 获取告警历史
   */
  getAlertHistory: async (params?: {
    limit?: number;
    offset?: number;
    ruleId?: string;
    timeRange?: string;
  }) => {
    return apiClient.get('/alerts/history', { params });
  },

  /**
   * 创建告警规则
   */
  createAlertRule: async (data: Record<string, unknown>) => {
    return apiClient.post('/alert-rules', data);
  },

  /**
   * 更新告警规则
   */
  updateAlertRule: async (id: string, data: Record<string, unknown>) => {
    return apiClient.put(`/alert-rules/${id}`, data);
  },

  /**
   * 删除告警规则
   */
  deleteAlertRule: async (id: string) => {
    return apiClient.delete(`/alert-rules/${id}`);
  },

  /**
   * 获取通知渠道列表
   */
  getNotificationChannels: async () => {
    return apiClient.get('/notification-channels');
  },

  /**
   * 创建通知渠道
   */
  createNotificationChannel: async (data: Record<string, unknown>) => {
    return apiClient.post('/notification-channels', data);
  },

  /**
   * 更新通知渠道
   */
  updateNotificationChannel: async (id: string, data: Record<string, unknown>) => {
    return apiClient.put(`/notification-channels/${id}`, data);
  },

  /**
   * 删除通知渠道
   */
  deleteNotificationChannel: async (id: string) => {
    return apiClient.delete(`/notification-channels/${id}`);
  },

  /**
   * 测试通知
   */
  testNotification: async (id: string, data: Record<string, unknown>) => {
    return apiClient.post(`/notification-channels/${id}/test`, data);
  },
};

/**
 * 图谱相关API
 */
export const graphApi = {
  /**
   * 提取文档图谱
   */
  extractGraph: async (docId: string): Promise<{ message: string }> => {
    return apiClient.post(`/docs/${docId}/extract-graph`);
  },
};

/**
 * 通用API
 */
export const commonApi = {
  /**
   * 简单健康检查
   */
  healthCheck: async (): Promise<HealthCheckResponse> => {
    return apiClient.get('/health');
  },

  /**
   * 详细健康检查
   */
  detailedHealthCheck: async (): Promise<DetailedHealthCheckResponse> => {
    return apiClient.get('/healthz');
  },
};

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
