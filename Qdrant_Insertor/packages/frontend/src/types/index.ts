/**
 * 前端类型定义
 * 扩展共享类型定义
 */

// 重新导出所有共享类型
export * from '../../../../shared/types/index';

// 导出通用类型
export * from './common';

/**
 * 集合接口
 */
export interface Collection {
  id: string; // 后端使用的id字段
  collectionId: string; // 保持向后兼容
  name: string;
  description?: string;
  is_system?: boolean; // 新增字段
  docCount?: number;
  chunkCount?: number;
  created_at: number; // 后端使用的字段名
  updated_at?: number; // 后端使用的字段名
  // 保持向后兼容的字段
  createdAt: number; // 改为必需字段
  updatedAt?: number;
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
  name?: string;
  collectionId: string;
  key: string;
  size_bytes?: number; // 后端使用的字段名
  mime?: string;
  created_at: number; // 后端使用的字段名
  updated_at?: number; // 后端使用的字段名
  is_deleted?: boolean; // 后端使用的字段名
  status?: 'new' | 'processing' | 'completed' | 'failed' | 'deleted'; // 与后端DocStatus枚举匹配
  content?: string; // 非持久化字段，仅在创建/更新时返回
  // 保持向后兼容的字段
  sizeBytes?: number;
  createdAt: number; // 改为必需字段
  updatedAt?: number;
  isDeleted?: boolean;
  errorMessage?: string;
}

/**
 * 搜索结果接口
 */
export interface SearchResult {
  pointId: string; // 后端使用的字段
  content: string;
  title?: string;
  docId: string;
  chunkIndex: number;
  collectionId?: string;
  titleChain?: string;
  score: number; // 改为必需字段
  // 保持向后兼容的metadata结构
  type?: 'chunkResult' | 'graphResult';
  metadata: {
    // 改为必需字段以避免undefined错误
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
 * API 分页查询参数接口
 */
export interface PaginationQueryParams
  extends Record<string, string | number | boolean | undefined> {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  offset?: number;
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
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  // 新增字段以匹配后端错误响应
  code?: string;
  details?: unknown;
}

/**
 * 文档块接口
 */
export interface Chunk {
  pointId: string;
  docId: string;
  collectionId: string; // 新增字段
  chunkIndex: number;
  content: string;
  title?: string;
  titleChain?: string;
  contentHash?: string;
  embedding?: number[]; // 新增字段
  status?: 'new' | 'embedding_generated' | 'synced' | 'failed'; // 与后端ChunkStatus匹配
  created_at: number; // 后端使用的字段名
  updated_at?: number; // 后端使用的字段名
  // 保持向后兼容的字段
  id?: string;
  createdAt: number; // 改为必需字段
  updatedAt?: number;
  tokenCount?: number;
}

/**
 * 文档块接口（用于文档详情）
 */
export interface DocumentChunk {
  pointId: string;
  docId: string;
  collectionId: string; // 新增字段
  chunkIndex: number;
  content: string;
  title?: string;
  titleChain?: string;
  contentHash?: string;
  embedding?: number[]; // 新增字段
  status?: 'new' | 'embedding_generated' | 'synced' | 'failed'; // 与后端ChunkStatus匹配
  created_at: number; // 后端使用的字段名
  updated_at?: number; // 后端使用的字段名
  // 保持向后兼容的字段
  id?: string;
  createdAt: number; // 改为必需字段
  updatedAt?: number;
  tokenCount?: number;
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
  success: boolean;
  status: 'healthy' | 'degraded' | 'unhealthy'; // 与后端匹配
  timestamp: string; // ISO 8601格式
  version: string;
  services: {
    database: 'healthy' | 'unhealthy';
    qdrant: 'healthy' | 'unhealthy';
    filesystem: 'healthy' | 'unhealthy';
  };
  metrics: {
    uptime: number; // 秒
    memoryUsage: string; // 百分比字符串
    diskUsage: string; // 百分比字符串
  };
  // 保持向后兼容
  qdrant?: 'ok' | 'unhealthy';
  sqlite?: 'ok' | 'unhealthy';
}

/**
 * 批量上传结果接口
 */
export interface BatchUploadResult {
  fileName: string;
  docId?: string;
  collectionId?: string;
  error?: string;
  total?: number;
  successful?: number;
  failed?: number;
  success?: boolean;
  results?: BatchUploadResult[];
}

/**
 * 批量上传响应接口
 */
export interface BatchUploadResponse {
  success: boolean;
  total: number;
  successful: number;
  failed: number;
  results: BatchUploadResult[];
  operationId?: string;
}

/**
 * 批量删除结果接口
 */
export interface BatchDeleteResult {
  id: string;
  success: boolean;
  error?: string;
}

/**
 * 批量删除文档响应接口
 */
export interface BatchDeleteDocsResponse {
  success: boolean;
  total: number;
  successful: number;
  failed: number;
  results: BatchDeleteResult[];
  operationId?: string;
}

/**
 * 批量删除集合响应接口
 */
export interface BatchDeleteCollectionsResponse {
  success: boolean;
  total: number;
  successful: number;
  failed: number;
  results: BatchDeleteResult[];
  operationId?: string;
}

/**
 * 批量操作进度接口
 */
export interface BatchOperationProgress {
  operationId: string;
  type: 'upload' | 'delete';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  total: number;
  processed: number;
  successful: number;
  failed: number;
  startTime: number;
  endTime?: number;
  estimatedTimeRemaining?: number;
  percentage?: number;
  error?: string;
  details?: unknown[];
}

/**
 * 批量上传进度接口（扩展UploadProgress）
 */
export interface BatchUploadProgress extends UploadProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  status: 'processing' | 'completed' | 'completed_with_errors' | 'failed';
  results?: BatchUploadResult[];
}

/**
 * 批量上传请求接口
 */
export interface BatchUploadRequest {
  files: File[];
  collectionId: string;
}

/**
 * 批量删除文档请求接口
 */
export interface BatchDeleteDocumentsRequest {
  docIds: string[];
}

/**
 * 批量删除集合请求接口
 */
export interface BatchDeleteCollectionsRequest {
  collectionIds: string[];
}

/**
 * 批量删除响应接口
 */
export interface BatchDeleteResponse {
  success: boolean;
  total: number;
  successful: number;
  failed: number;
  results: BatchDeleteResult[];
}

/**
 * 批量操作历史接口
 */
export interface BatchOperationHistory {
  id: string;
  type: 'upload' | 'delete';
  timestamp: number;
  status: 'completed' | 'failed' | 'completed_with_errors';
  total: number;
  successful: number;
  failed: number;
  details?: BatchUploadResult[];
}

/**
 * 文档状态信息接口
 */
export interface DocumentStatusInfo {
  text: string;
  className: string;
}

/**
 * 文档缩略图属性接口
 */
export interface DocumentThumbnailProps {
  documentId: string;
  onClick: () => void;
  className?: string;
}

/**
 * 批量删除属性接口
 */
export interface BatchDeleteProps {
  onComplete: () => void;
  mode?: 'documents' | 'collections';
  collectionId?: string;
}

/**
 * 批量文档上传属性接口
 */
export interface BatchDocumentUploadProps {
  onComplete: () => void;
  collectionId?: string;
}
