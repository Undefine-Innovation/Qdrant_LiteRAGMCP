import { z } from 'zod';
import { ChunkResponseSchema } from './document.js';

/**
 * 用于 `GET /search` API 的查询参数 Schema。
 */
export const SearchQuerySchema = z.object({
  q: z.string().min(1).describe('要执行的搜索查询文本。'),
  collectionId: z.string().min(1).describe('要在其中执行搜索的集合的 ID。'),
  limit: z
    .string()
    .optional()
    .default('10')
    .transform(Number)
    .refine((n) => n > 0 && n <= 100, {
      message: 'Limit 必须在 1 到 100 之间。',
    })
    .describe('要返回的最大结果数，默认为 10。'),
});

/**
 * 单个搜索结果项的 Schema。
 */
const SearchResultItemSchema = ChunkResponseSchema.extend({
  score: z.number().describe('此结果的相关性得分。'),
});

/**
 * `GET /search` API 的响应体 Schema。
 */
export const SearchResponseSchema = z.object({
  results: z.array(SearchResultItemSchema).describe('搜索结果列表。'),
});