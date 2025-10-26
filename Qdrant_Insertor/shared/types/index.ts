/**
 * 共享类型定义导出
 * 提供前后端共用的类型定义
 */

// 重新导出所有域类型，确保前后端类型一致性
export * from "../../packages/backend/src/domain/types.js";

// API相关类型定义
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}

export interface ApiError {
    code: string;
    message: string;
    details?: any;
}

export interface PaginationParams {
    page?: number;
    limit?: number;
    sort?: string;
    order?: "asc" | "desc";
    offset?: number;
}

export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: PaginationMeta;
}

// 系统状态相关类型
export interface SystemStatus {
    status: "healthy" | "degraded" | "down";
    collections: number;
    documents: number;
    qdrantConnected: boolean;
    lastSyncTime?: string;
}

// 上传进度相关类型
export interface UploadProgress {
    loaded: number;
    total: number;
    percentage: number;
}
