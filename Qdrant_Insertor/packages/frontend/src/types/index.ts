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
  collectionId: string;
  name: string;
  description?: string;
  docCount?: number;
  chunkCount?: number;
  createdAt: number;
  updatedAt: number;
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
  docId: string;
  name: string;
  collectionId: string;
  key: string;
  sizeBytes?: number;
  mime?: string;
  createdAt: number;
  updatedAt?: number;
  isDeleted?: boolean;
}

/**
 * 搜索结果接口
 */
export interface SearchResult {
  type: 'chunkResult' | 'graphResult';
  score: number;
  content: string;
  metadata: {
    docId: string;
    docName?: string;
    collectionId: string;
    collectionName?: string;
    chunkIndex?: number;
    titleChain?: string;
    title?: string;
    pointId?: string;
  };
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
  status: 'ok' | 'degraded' | 'unhealthy';
  qdrant: 'ok' | 'unhealthy';
  sqlite: 'ok' | 'unhealthy';
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

/**
 * 文档块接口
 */
export interface Chunk {
  pointId: string;
  docId: string;
  chunkIndex: number;
  content: string;
  titleChain: string;
  title?: string;
  contentHash?: string;
  createdAt?: number;
}

/**
 * 上传文档响应接口
 */
export interface UploadDocumentResponse {
  docId: string;
  name: string;
  collectionId: string;
}

/**
 * 健康检查响应接口
 */
export interface HealthCheckResponse {
  ok: boolean;
}

/**
 * 详细健康检查响应接口
 */
export interface DetailedHealthCheckResponse {
  status: 'ok' | 'degraded' | 'unhealthy';
  qdrant: 'ok' | 'unhealthy';
  sqlite: 'ok' | 'unhealthy';
}
