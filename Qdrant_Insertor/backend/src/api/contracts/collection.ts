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
 * 集合响应体的 Schema。
 */
export const CollectionResponseSchema = z.object({
  collectionId: z.string().describe('集合的唯一标识符。'),
  name: z.string().describe('集合的名称。'),
  description: z.string().optional().describe('集合的描述。'),
  createdAt: z.number().describe('集合创建时的时间戳。'),
});
