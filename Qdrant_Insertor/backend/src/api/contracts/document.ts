import { z } from 'zod';
import { CollectionIdParamsSchema } from './collection.js';

/**
 * 用于文档上传的 Schema。
 * 用于 `POST /collections/:collectionId/docs`。
 * 注意：Zod 不直接处理 multipart/form-data 中的文件，
 * 文件验证将在控制器或专用中间件中处理。
 * 此 Schema 主要用于验证路径参数。
 */
export const UploadDocumentSchema = CollectionIdParamsSchema;

/**
 * 用于处理涉及文档 ID 的请求参数的 Schema。
 * 例如: `GET /docs/:docId`, `DELETE /docs/:docId`
 */
export const DocIdParamsSchema = z.object({
  docId: z.string().describe('文档的唯一标识符。'),
});

/**
 * 文档上传成功后的响应 Schema。
 */
export const UploadDocumentResponseSchema = z.object({
  docId: z.string().describe('成功上传后返回的文档 ID。'),
  name: z.string().describe('上传的文件名。'),
  collectionId: z.string().describe('所属集合的 ID。'),
});

/**
 * 文档信息的响应 Schema。
 */
export const DocumentResponseSchema = z.object({
  docId: z.string().describe('文档的唯一标识符。'),
  name: z.string().describe('文档的名称。'),
  collectionId: z.string().describe('所属集合的 ID。'),
  createdAt: z.number().describe('文档创建时的时间戳。'),
  updatedAt: z.number().describe('文档最后更新时的时间戳。'),
});

/**
 * 文本块（Chunk）信息的响应 Schema。
 */
export const ChunkResponseSchema = z.object({
  pointId: z.string().describe('Qdrant 中的向量点 ID，格式为 `docId#chunkIndex`。'),
  docId: z.string().describe('所属文档的 ID。'),
  chunkIndex: z.number().int().describe('文本块在文档中的顺序索引。'),
  content: z.string().describe('文本块的内容。'),
  titleChain: z.string().describe('文本块的标题链，提供上下文信息。'),
});