import { z } from 'zod';
import { ChunkResponseSchema } from './document.js';
import { RetrievalResultType } from '@domain/entities/types.js';

/**
 * 用于 `GET /search` API 的查询参数Schema
 */
export const SearchQuerySchema = z.object({
  q: z.string().min(1).describe('要执行的搜索查询文本'),
  collectionId: z.string().min(1).describe('要在其中执行搜索的集合的 ID'),
  limit: z
    .string()
    .optional()
    .default('10')
    .transform(Number)
    .refine((n) => n > 0 && n <= 100, {
      message: 'Limit 必须在1 到100 之间',
    })
    .describe('要返回的最大结果数，默认为 10'),
});

/**
 * 用于 `GET /search` API 的分页查询参数Schema
 */
export const SearchPaginatedQuerySchema = z.object({
  q: z.string().min(1).describe('要执行的搜索查询文本'),
  collectionId: z.string().optional().describe('要在其中执行搜索的集合的 ID'),
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
    .default('score')
    .describe('排序字段，默认为score'),
  order: z
    .enum(['asc', 'desc'])
    .optional()
    .default('desc')
    .describe('排序方向，asc或desc，默认为desc'),
});

/**
 * 单个搜索结果项的 Schema - 符合RetrievalResultDTO规范
 */
const RetrievalResultDTOSchema = z.object({
  type: z.enum(['chunkResult', 'graphResult']).describe('结果类型'),
  score: z.number().describe('此结果的相关性得分'),
  content: z.string().describe('结果内容'),
  metadata: z.record(z.unknown()).describe('结果的元数据'),
});

/**
 * `GET /search` API 的响应体 Schema - 直接返回RetrievalResultDTO数组
 */
export const SearchResponseSchema = z
  .array(RetrievalResultDTOSchema)
  .describe('搜索结果列表');

/**
 * `GET /search` API 的分页响应体 Schema
 */
export const SearchPaginatedResponseSchema = z.object({
  data: z.array(RetrievalResultDTOSchema).describe('搜索结果列表'),
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
