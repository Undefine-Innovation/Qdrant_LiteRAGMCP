import { z } from 'zod';
import { CollectionIdParamsSchema } from './collection.js';
import { DocIdParamsSchema } from './document.js';

/**
 * 批量文档上传请求Schema
 * 用于验证 `POST /upload/batch` 的请求体
 */
export const BatchUploadRequestSchema = z.object({
  collectionId: z
    .string()
    .optional()
    .describe('目标集合的ID，如果不提供则使用默认集合'),
});

/**
 * 批量文档上传响应Schema
 */
export const BatchUploadResponseSchema = z.object({
  success: z.boolean().describe('批量上传是否成功'),
  total: z.number().describe('总文件数'),
  successful: z.number().describe('成功上传的文件数'),
  failed: z.number().describe('上传失败的文件数'),
  results: z
    .array(
      z.object({
        fileName: z.string().describe('文件名'),
        docId: z.string().optional().describe('上传成功后返回的文档 ID'),
        collectionId: z.string().optional().describe('所属集合的 ID'),
        error: z.string().optional().describe('上传失败时的错误信息'),
      }),
    )
    .describe('每个文件的上传结果'),
});

/**
 * 批量删除文档请求Schema
 * 用于验证 `DELETE /docs/batch` 的请求体
 */
export const BatchDeleteDocsRequestSchema = z.object({
  docIds: z.array(z.string()).min(1).describe('要删除的文档ID列表'),
});

/**
 * 批量删除文档响应Schema
 */
export const BatchDeleteDocsResponseSchema = z.object({
  success: z.boolean().describe('批量删除是否成功'),
  total: z.number().describe('总文档数'),
  successful: z.number().describe('成功删除的文档数'),
  failed: z.number().describe('删除失败的文档数'),
  results: z
    .array(
      z.object({
        docId: z.string().describe('文档ID'),
        success: z.boolean().describe('删除是否成功'),
        error: z.string().optional().describe('删除失败时的错误信息'),
      }),
    )
    .describe('每个文档的删除结果'),
});

/**
 * 批量删除集合请求Schema
 * 用于验证 `DELETE /collections/batch` 的请求体
 */
export const BatchDeleteCollectionsRequestSchema = z.object({
  collectionIds: z.array(z.string()).min(1).describe('要删除的集合ID列表'),
});

/**
 * 批量删除集合响应Schema
 */
export const BatchDeleteCollectionsResponseSchema = z.object({
  success: z.boolean().describe('批量删除是否成功'),
  total: z.number().describe('总集合数'),
  successful: z.number().describe('成功删除的集合数'),
  failed: z.number().describe('删除失败的集合数'),
  results: z
    .array(
      z.object({
        collectionId: z.string().describe('集合ID'),
        success: z.boolean().describe('删除是否成功'),
        error: z.string().optional().describe('删除失败时的错误信息'),
      }),
    )
    .describe('每个集合的删除结果'),
});

/**
 * 批量操作进度响应Schema
 */
export const BatchOperationProgressSchema = z.object({
  operationId: z.string().describe('操作ID'),
  type: z.enum(['upload', 'delete']).describe('操作类型'),
  status: z
    .enum(['pending', 'processing', 'completed', 'failed'])
    .describe('操作状态'),
  total: z.number().describe('总项目数'),
  processed: z.number().describe('已处理的项目数'),
  successful: z.number().describe('成功的项目数'),
  failed: z.number().describe('失败的项目数'),
  startTime: z.number().describe('开始时间戳'),
  endTime: z.number().optional().describe('结束时间戳'),
  estimatedTimeRemaining: z.number().optional().describe('预估剩余时间（秒）'),
});

/**
 * 批量操作状态查询参数的 Schema
 */
export const BatchOperationQuerySchema = z.object({
  operationId: z.string().describe('操作ID'),
});
