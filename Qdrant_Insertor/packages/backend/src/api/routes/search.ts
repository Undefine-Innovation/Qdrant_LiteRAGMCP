import express from 'express';
import { z } from 'zod';
import { CollectionId } from '@domain/entities/types.js';
import { ISearchService } from '@application/services/index.js';
import { validate, ValidatedRequest } from '@middleware/validate.js';
import {
  SearchQuerySchema,
  SearchPaginatedQuerySchema,
} from '../../api/contracts/search.js';
import { Logger } from '@logging/logger.js';

/**
 * 创建搜索相关的API路由
 * @param searchService - 搜索服务实例
 * @param logger - 日志记录器实例
 * @returns 配置好的 Express 路由器实例
 */
export function createSearchRoutes(
  searchService: ISearchService,
  logger?: Logger,
): express.Router {
  const router = express.Router();

  /**
   * 执行向量搜索
   * @api {get} /search
   * @apiGroup Search
   * @apiDescription 根据查询和可选的 Collection ID 执行向量相似度搜索。支持分页参数
   * @apiParam {string} q - 搜索查询字符串
   * @apiParam {string} collectionId - 要在其中执行搜索的集合的 ID
   * @apiParam {number} [limit=10] - 返回结果的最大数量（非分页模式）
   * @apiParam {number} [page=1] - 页码，从1开始（分页模式）
   * @apiParam {number} [limit=20] - 每页数量，最多100（分页模式）
   * @apiParam {string} [sort=score] - 排序字段（分页模式）
   * @apiParam {string} [order=desc] - 排序方向，asc或desc（分页模式）
   * @apiSuccess {SearchResult[]} results - 搜索结果数组（非分页模式）
   * @apiSuccess {Object} response - 分页响应对象（分页模式）
   * @apiSuccess {SearchResult[]} response.data - 搜索结果数组（分页模式）
   * @apiSuccess {Object} response.pagination - 分页元数据（分页模式）
   * @apiSuccess {number} response.pagination.page - 当前页码
   * @apiSuccess {number} response.pagination.limit - 每页数量
   * @apiSuccess {number} response.pagination.total - 总记录数
   * @apiSuccess {number} response.pagination.totalPages - 总页数
   * @apiSuccess {boolean} response.pagination.hasNext - 是否有下一页
   * @apiSuccess {boolean} response.pagination.hasPrev - 是否有上一页
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "data": [
   *         { "pointId": "chunk-xxxx", "content": "...", "score": 0.95 }
   *       ],
   *       "pagination": {
   *         "page": 1,
   *         "limit": 20,
   *         "total": 1,
   *         "totalPages": 1,
   *         "hasNext": false,
   *         "hasPrev": false
   *       }
   *     }
   */
  // GET /search - 支持查询参数
  router.get(
    '/',
    validate({ query: SearchQuerySchema }),
    async (
      req: ValidatedRequest<unknown, z.infer<typeof SearchQuerySchema>>,
      res,
    ) => {
      const validatedQuery = req.validated!.query;
      if (!validatedQuery) {
        // This should not happen with validation middleware, but TypeScript needs it
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
          },
        });
      }
      const { q: query, collectionId, limit } = validatedQuery;
      // Normalize collectionId: frontend may send a literal string 'undefined' or 'null'
      const normalizedCollectionId =
        collectionId === undefined ||
        collectionId === 'undefined' ||
        collectionId === 'null'
          ? undefined
          : (collectionId as string);
      logger?.info(
        `[API] /search request: q="${query}", collectionId="${normalizedCollectionId}", limit=${limit ?? 10}`,
      );
      // collectionId is now optional in the schema, so we don't require it here
      // The validation will handle missing collectionId if needed

      const results = await searchService.search(
        query,
        normalizedCollectionId as CollectionId,
        { limit },
      );
      if (!results || results.length === 0) {
        logger?.warn(
          `[API] /search no results: q="${query}", collectionId="${collectionId}"`,
        );
      } else {
        logger?.info(
          `[API] /search results: count=${results.length}, q="${query}", collectionId="${collectionId}"`,
        );
      }
      // 修改响应格式以匹配前端期望的 {results, total, query} 格式
      const response = {
        results: results || [],
        total: results ? results.length : 0,
        query: query,
      };
      res.status(200).json(response);
    },
  );

  // POST /search - 支持请求体
  router.post(
    '/',
    validate({ body: SearchQuerySchema }),
    async (
      req: ValidatedRequest<z.infer<typeof SearchQuerySchema>, unknown>,
      res,
    ) => {
      const validatedBody = req.validated!.body;
      if (!validatedBody) {
        // This should not happen with validation middleware, but TypeScript needs it
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
          },
        });
      }
      const { q: query, collectionId, limit } = validatedBody;
      // Normalize collectionId: frontend may send a literal string 'undefined' or 'null'
      const normalizedCollectionId =
        collectionId === undefined ||
        collectionId === 'undefined' ||
        collectionId === 'null'
          ? undefined
          : (collectionId as string);
      logger?.info(
        `[API] /search POST request: q="${query}", collectionId="${normalizedCollectionId}", limit=${limit ?? 10}`,
      );
      // collectionId is now optional in the schema, so we don't require it here
      // The validation will handle missing collectionId if needed

      const results = await searchService.search(
        query,
        normalizedCollectionId as CollectionId,
        { limit },
      );
      if (!results || results.length === 0) {
        logger?.warn(
          `[API] /search POST no results: q="${query}", collectionId="${collectionId}"`,
        );
      } else {
        logger?.info(
          `[API] /search POST results: count=${results.length}, q="${query}", collectionId="${collectionId}"`,
        );
      }
      // 修改响应格式以匹配前端期望的 {results, total, query} 格式
      const response = {
        results: results || [],
        total: results ? results.length : 0,
        query: query,
      };
      res.status(200).json(response);
    },
  );

  /**
   * 执行分页向量搜索
   * @api {get} /search/paginated
   * @apiGroup Search
   * @apiDescription 根据查询和可选的 Collection ID 执行向量相似度搜索，支持分页
   * @apiParam {string} q - 搜索查询字符串
   * @apiParam {string} collectionId - 要在其中执行搜索的集合的 ID
   * @apiParam {number} [page=1] - 页码，从1开始
   * @apiParam {number} [limit=20] - 每页数量，最多100
   * @apiParam {string} [sort=score] - 排序字段
   * @apiParam {string} [order=desc] - 排序方向，asc或desc
   * @apiSuccess {Object} response - 分页响应对象
   * @apiSuccess {SearchResult[]} response.data - 搜索结果数组
   * @apiSuccess {Object} response.pagination - 分页元数据
   * @apiSuccess {number} response.pagination.page - 当前页码
   * @apiSuccess {number} response.pagination.limit - 每页数量
   * @apiSuccess {number} response.pagination.total - 总记录数
   * @apiSuccess {number} response.pagination.totalPages - 总页数
   * @apiSuccess {boolean} response.pagination.hasNext - 是否有下一页
   * @apiSuccess {boolean} response.pagination.hasPrev - 是否有上一页
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "data": [
   *         { "pointId": "chunk-xxxx", "content": "...", "score": 0.95 }
   *       ],
   *       "pagination": {
   *         "page": 1,
   *         "limit": 20,
   *         "total": 1,
   *         "totalPages": 1,
   *         "hasNext": false,
   *         "hasPrev": false
   *       }
   *     }
   */
  router.get(
    '/paginated',
    validate({ query: SearchPaginatedQuerySchema }),
    async (
      req: ValidatedRequest<
        unknown,
        z.infer<typeof SearchPaginatedQuerySchema>
      >,
      res,
    ) => {
      const validatedQuery = req.validated?.query;
      if (!validatedQuery) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
          },
        });
      }
      const { q: query, collectionId } = validatedQuery;
      const normalizedCollectionId =
        collectionId === undefined ||
        collectionId === 'undefined' ||
        collectionId === 'null'
          ? undefined
          : (collectionId as string);
      logger?.info(
        `[API] /search/paginated request: q="${query}", collectionId="${normalizedCollectionId}", page=${validatedQuery.page ?? 1}, limit=${validatedQuery.limit ?? 20}`,
      );
      const paginatedResults = await searchService.searchPaginated(
        query,
        normalizedCollectionId as CollectionId | undefined,
        validatedQuery,
      );
      const total = paginatedResults?.pagination?.total ?? 0;
      const returned = paginatedResults?.data?.length ?? 0;
      if (total === 0) {
        logger?.warn(
          `[API] /search/paginated no results: q="${query}", collectionId="${collectionId}"`,
        );
      } else {
        logger?.info(
          `[API] /search/paginated results: returned=${returned}, total=${total}, page=${paginatedResults.pagination.page}, limit=${paginatedResults.pagination.limit}`,
        );
      }
      res.status(200).json(paginatedResults);
    },
  );

  return router;
}
