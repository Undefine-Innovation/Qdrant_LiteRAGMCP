import { z } from 'zod';

/**
 * 创建新集合的 Schema。
 * 用于验证 `POST /collections` 的请求体。
 */
export const CreateCollectionSchema = z.object({
  name: z.string().min(1).describe('集合的名称，必须是唯一的。'),
  description: z.string().optional().describe('集合的可选描述。'),
});

/**
 * 更新现有集合的 Schema。
 * 用于验证 `PATCH /collections/:collectionId` 的请求体。
 */
export const UpdateCollectionSchema = z.object({
  name: z.string().min(1).optional().describe('集合的新名称。'),
  description: z.string().optional().describe('集合的新描述。'),
});

/**
 * 用于请求参数中集合 ID 的 Schema。
 * 用于验证像 `GET /collections/:collectionId` 这样的路由的 `req.params`。
 */
export const CollectionIdParamsSchema = z.object({
  collectionId: z.string().describe('集合的唯一标识符。'),
});

/**
 * 集合列表查询参数的 Schema。
 * 用于验证 `GET /collections` 的查询参数。
 */
export const ListCollectionsQuerySchema = z.object({
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
});

/**
 * 集合响应体的 Schema。
 */
export const CollectionResponseSchema = z.object({
  collectionId: z.string().describe('集合的唯一标识符。'),
  name: z.string().describe('集合的名称。'),
  description: z.string().optional().describe('集合的描述。'),
  createdAt: z.number().describe('集合创建时的时间戳。'),
});

/**
 * 分页集合列表响应的 Schema。
 */
export const PaginatedCollectionsResponseSchema = z.object({
  data: z.array(CollectionResponseSchema).describe('集合数据列表。'),
  pagination: z
    .object({
      page: z.number().describe('当前页码。'),
      limit: z.number().describe('每页数量。'),
      total: z.number().describe('总记录数。'),
      totalPages: z.number().describe('总页数。'),
      hasNext: z.boolean().describe('是否有下一页。'),
      hasPrev: z.boolean().describe('是否有上一页。'),
    })
    .describe('分页元数据。'),
});
