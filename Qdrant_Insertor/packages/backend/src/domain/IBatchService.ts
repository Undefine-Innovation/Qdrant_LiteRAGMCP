import { CollectionId, DocId } from './types.js';
import { Express } from 'express';

/**
 * 批量上传结果接口
 */
export interface BatchUploadResult {
  fileName: string;
  docId?: DocId;
  collectionId?: CollectionId;
  error?: string;
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
}

/**
 * 批量操作进度接口
 */
export interface BatchOperationProgress {
  operationId: string;
  type: 'upload' | 'delete';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total: number;
  processed: number;
  successful: number;
  failed: number;
  startTime: number;
  endTime?: number;
  estimatedTimeRemaining?: number;
}

/**
 * 批量操作服务接口
 * 定义批量操作的核心功能
 */
export interface IBatchService {
  /**
   * 批量上传文档
   * @param files - 上传的文件列表
   * @param collectionId - 目标集合ID（可选）
   * @returns 批量上传响应
   */
  batchUploadDocuments(
    files: Express.Multer.File[],
    collectionId?: CollectionId,
  ): Promise<BatchUploadResponse>;

  /**
   * 批量删除文档
   * @param docIds - 要删除的文档ID列表
   * @returns 批量删除文档响应
   */
  batchDeleteDocuments(docIds: DocId[]): Promise<BatchDeleteDocsResponse>;

  /**
   * 批量删除集合
   * @param collectionIds - 要删除的集合ID列表
   * @returns 批量删除集合响应
   */
  batchDeleteCollections(
    collectionIds: CollectionId[],
  ): Promise<BatchDeleteCollectionsResponse>;

  /**
   * 获取批量操作进度
   * @param operationId - 操作ID
   * @returns 批量操作进度
   */
  getBatchOperationProgress(operationId: string): BatchOperationProgress | null;

  /**
   * 创建批量操作进度跟踪
   * @param type - 操作类型
   * @param total - 总项目数
   * @returns 操作ID
   */
  createBatchOperationProgress(
    type: 'upload' | 'delete',
    total: number,
  ): string;

  /**
   * 更新批量操作进度
   * @param operationId - 操作ID
   * @param processed - 已处理的项目数
   * @param successful - 成功的项目数
   * @param failed - 失败的项目数
   * @param status - 操作状态
   */
  updateBatchOperationProgress(
    operationId: string,
    processed: number,
    successful: number,
    failed: number,
    status?: BatchOperationProgress['status'],
  ): void;

  /**
   * 完成批量操作
   * @param operationId - 操作ID
   * @param success - 操作是否成功
   */
  completeBatchOperation(operationId: string, success: boolean): void;
}
