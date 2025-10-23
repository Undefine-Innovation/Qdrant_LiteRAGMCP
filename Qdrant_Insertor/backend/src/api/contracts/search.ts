import { z } from 'zod';
import { ChunkResponseSchema } from './document.js';
import { RetrievalResultType } from '@domain/types.js';

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
 * 单个搜索结果项的 Schema - 符合RetrievalResultDTO规范。
 */
const RetrievalResultDTOSchema = z.object({
  type: z.enum(['chunkResult', 'graphResult']).describe('结果类型。'),
  score: z.number().describe('此结果的相关性得分。'),
  content: z.string().describe('结果内容。'),
  metadata: z.record(z.unknown()).describe('结果的元数据。'),
});

/**
 * `GET /search` API 的响应体 Schema - 直接返回RetrievalResultDTO数组。
 */
export const SearchResponseSchema = z
  .array(RetrievalResultDTOSchema)
  .describe('搜索结果列表。');
