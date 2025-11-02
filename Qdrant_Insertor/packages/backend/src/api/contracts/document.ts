import { z } from 'zod';
import { CollectionIdParamsSchema } from './collection.js';

/**
 * 用于文档上传的Schema
 * 用于 `POST /collections/:collectionId/docs`
 * 注意：Zod 不直接处理 multipart/form-data 中的文件
 * 文件验证将在控制器或专用中间件中处理
 * 此Schema 主要用于验证路径参数
 */
export const UploadDocumentSchema = CollectionIdParamsSchema;

/**
 * 用于处理涉及文档 ID 的请求参数的Schema
 * 例如: `GET /docs/:docId`, `DELETE /docs/:docId`
 */
export const DocIdParamsSchema = z.object({
  docId: z.string().describe('文档的唯一标识符'),
});

/**
 * 文档列表查询参数的Schema
 * 用于验证 `GET /docs` 的查询参数
 */
export const ListDocsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => val >= 1, { message: '页码必须大于0' })
    .describe('页码，从1开始，默认为1'),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .refine((val) => val >= 1 && val <= 100, {
      message: '每页数量必须在1-100之间',
    })
    .describe('每页数量，默认为20，最大值为100'),
  sort: z
    .string()
    .optional()
    .default('created_at')
    .describe('排序字段，默认为created_at'),
  order: z
    .enum(['asc', 'desc'])
    .optional()
    .default('desc')
    .describe('排序方向，asc或desc，默认为desc'),
  collectionId: z
    .string()
    .optional()
    .describe('可选的集合ID，用于过滤特定集合的文档'),
});

/**
 * 文档上传成功后的响应Schema
 */
export const UploadDocumentResponseSchema = z.object({
  docId: z.string().describe('成功上传后返回的文档 ID'),
  name: z.string().describe('上传的文件名'),
  collectionId: z.string().describe('所属集合的 ID'),
});

/**
 * 用于上传文档到指定集合的请求参数Schema
 * 用于 `POST /collections/:collectionId/docs`
 */
export const UploadToCollectionSchema = CollectionIdParamsSchema;

/**
 * 文档信息的响应Schema
 */
export const DocumentResponseSchema = z.object({
  docId: z.string().describe('文档的唯一标识符'),
  name: z.string().describe('文档的名称'),
  collectionId: z.string().describe('所属集合的 ID'),
  createdAt: z.number().describe('文档创建时的时间戳'),
  updatedAt: z.number().describe('文档最后更新时的时间戳'),
});

/**
 * 文本块（Chunk）信息的响应Schema
 */
export const ChunkResponseSchema = z.object({
  pointId: z
    .string()
    .describe('Qdrant 中的向量点ID，格式为 `docId#chunkIndex`'),
  docId: z.string().describe('所属文档的 ID'),
  chunkIndex: z.number().int().describe('文本块在文档中的顺序索引'),
  content: z.string().describe('文本块的内容'),
  titleChain: z.string().describe('文本块的标题链，提供上下文信息'),
});

/**
 * 分页文档列表响应的Schema
 */
export const PaginatedDocsResponseSchema = z.object({
  data: z.array(DocumentResponseSchema).describe('文档数据列表'),
  pagination: z
    .object({
      page: z.number().describe('当前页码'),
      limit: z.number().describe('每页数量'),
      total: z.number().describe('总记录数'),
      totalPages: z.number().describe('总页数'),
      hasNext: z.boolean().describe('是否有下一页'),
      hasPrev: z.boolean().describe('是否有上一页'),
    })
    .describe('分页元数据'),
});