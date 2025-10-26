/**
 * 前端类型定义
 * 扩展共享类型定义
 */

// 重新导出所有共享类型
export * from '../../../../shared/types/index';

/**
 * 集合接口
 */
export interface Collection {
  id: string;
  collectionId: string;
  name: string;
  description?: string;
  documentCount?: number;
  createdAt: string;
  created_at: string;
  updatedAt: string;
  updated_at: string;
}

/**
 * 创建集合请求接口
 */
export interface CreateCollectionRequest {
  name: string;
  description?: string;
}

/**
 * 更新集合请求接口
 */
export interface UpdateCollectionRequest {
  name?: string;
  description?: string;
}

/**
 * 文档接口
 */
export interface Document {
  id: string;
  name: string;
  collectionId: string;
  status:
    | 'new'
    | 'split_ok'
    | 'embed_ok'
    | 'synced'
    | 'failed'
    | 'retrying'
    | 'dead';
  createdAt: string;
  created_at: string;
  updatedAt: string;
  updated_at: string;
  errorMessage?: string;
}

/**
 * 搜索结果接口
 */
export interface SearchResult {
  id: string;
  documentId: string;
  documentName: string;
  collectionId: string;
  collectionName: string;
  content: string;
  score: number;
}

/**
 * 搜索请求接口
 */
export interface SearchRequest {
  query: string;
  collectionId?: string;
  limit?: number;
  offset?: number;
}

/**
 * 搜索响应接口
 */
export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
}

/**
 * API 分页参数接口
 */
export interface PaginationParams {
  page?: number; // 页码，从1开始，默认为1
  limit?: number; // 每页数量，默认为20，最大值为100
  sort?: string; // 排序字段（可选）
  order?: 'asc' | 'desc'; // 排序方向，asc或desc（可选）
  offset?: number; // 向后兼容的偏移量参数
}

/**
 * API 分页响应接口
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * 系统状态接口
 */
export interface SystemStatus {
  status: 'healthy' | 'degraded' | 'down';
  collections: number;
  documents: number;
  qdrantConnected: boolean;
  lastSyncTime?: string;
}

/**
 * 上传进度接口
 */
export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

/**
 * 通用 API 响应接口
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
