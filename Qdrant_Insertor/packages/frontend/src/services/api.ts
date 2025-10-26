import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { PaginationParams } from '../types/index.js';

/**
 * API 响应接口
 */
export interface ApiResponse<T = any> {
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
  details?: any;
}

/**
 * 分页查询参数接口
 */
export interface PaginationQueryParams extends PaginationParams {
  [key: string]: any; // 允许其他查询参数
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
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  /**
   * POST 请求
   */
  async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  /**
   * PUT 请求
   */
  async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  /**
   * DELETE 请求
   */
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }

  /**
   * PATCH 请求
   */
  async patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  /**
   * 上传文件
   */
  async upload<T = any>(
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
  getCollections: async (params?: PaginationQueryParams) => {
    return apiClient.get('/collections', { params });
  },

  /**
   * 获取单个集合
   */
  getCollection: async (id: string) => {
    return apiClient.get(`/collections/${id}`);
  },

  /**
   * 创建集合
   */
  createCollection: async (data: { name: string; description?: string }) => {
    return apiClient.post('/collections', data);
  },

  /**
   * 更新集合
   */
  updateCollection: async (
    id: string,
    data: { name?: string; description?: string },
  ) => {
    return apiClient.put(`/collections/${id}`, data);
  },

  /**
   * 部分更新集合
   */
  patchCollection: async (
    id: string,
    data: { name?: string; description?: string },
  ) => {
    return apiClient.patch(`/collections/${id}`, data);
  },

  /**
   * 删除集合
   */
  deleteCollection: async (id: string) => {
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
  ) => {
    return apiClient.get('/docs', { params });
  },

  /**
   * 获取单个文档
   */
  getDocument: async (id: string) => {
    return apiClient.get(`/docs/${id}`);
  },

  /**
   * 上传文档到指定集合
   */
  uploadToCollection: async (collectionId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.upload(`/collections/${collectionId}/docs`, formData);
  },

  /**
   * 上传文档到默认集合
   */
  uploadDocument: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.upload('/upload', formData);
  },

  /**
   * 重新同步文档
   */
  resyncDocument: async (id: string) => {
    return apiClient.put(`/docs/${id}/resync`);
  },

  /**
   * 删除文档
   */
  deleteDocument: async (id: string) => {
    return apiClient.delete(`/docs/${id}`);
  },

  /**
   * 获取文档的块列表
   */
  getDocumentChunks: async (id: string) => {
    return apiClient.get(`/docs/${id}/chunks`);
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
    collectionId?: string;
    limit?: number;
  }) => {
    return apiClient.get('/search', { params });
  },

  /**
   * 执行分页搜索
   */
  searchPaginated: async (
    params: PaginationQueryParams & { q: string; collectionId?: string },
  ) => {
    return apiClient.get('/search/paginated', { params });
  },
};

/**
 * 图谱相关API
 */
export const graphApi = {
  /**
   * 提取文档图谱
   */
  extractGraph: async (docId: string) => {
    return apiClient.post(`/docs/${docId}/extract-graph`);
  },
};

/**
 * 通用API
 */
export const commonApi = {
  /**
   * 健康检查
   */
  healthCheck: async () => {
    return apiClient.get('/health');
  },
};
