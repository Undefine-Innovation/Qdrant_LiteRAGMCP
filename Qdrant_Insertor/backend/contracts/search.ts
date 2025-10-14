import { z } from 'zod';

// 定义 RetrievalResultDTO 的 Zod Schema
export const RetrievalResultDTOSchema = z.object({
  type: z.enum(['chunkResult', 'graphResult']).describe('检索结果类型'),
  score: z.number().describe('检索分数'),
  content: z.string().describe('检索到的内容'),
  metadata: z.record(z.any()).describe('检索结果的元数据'), // 允许任意键值对
});

// 导出 RetrievalResultDTO 的 TypeScript 类型
export type RetrievalResultDTO = z.infer<typeof RetrievalResultDTOSchema>;

// 定义 SearchQuery 的 Zod Schema
export const SearchQuerySchema = z.object({
  q: z.string().min(1).describe('搜索查询字符串'),
  limit: z.number().int().min(1).max(100).default(10).describe('最大返回结果数量，默认 10，最大 100'),
});

// 导出 SearchQuery 的 TypeScript 类型
export type SearchQuery = z.infer<typeof SearchQuerySchema>;