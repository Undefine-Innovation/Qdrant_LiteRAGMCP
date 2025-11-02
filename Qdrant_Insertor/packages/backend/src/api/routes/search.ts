import express from 'express';
import { z } from 'zod';
import { CollectionId } from '../../domain/entities/types.js';
import { ISearchService } from '../../domain/repositories/ISearchService.js';
import { validate, ValidatedRequest } from '../../middlewares/validate.js';
import {
  SearchQuerySchema,
  SearchPaginatedQuerySchema,
} from '../../api/contracts/search.js';

/**
 * @function createSearchRoutes
 * @description 创建搜索相关的API路由
 * @param {ISearchService} searchService - 搜索服务实例
 * @returns {express.Router} 配置好的 Express 路由实例�?
 */
export function createSearchRoutes(
  searchService: ISearchService,
): express.Router {
  const router = express.Router();

  /**
   * @api {get} /search 执行向量搜索
   * @apiGroup Search
   * @apiDescription 根据查询和可选的 Collection ID 执行向量相似度搜索。支持分页参数�?
   * @apiParam {string} q - 搜索查询字符串�?
   * @apiParam {string} collectionId - 要在其中执行搜索的集合的 ID�?
   * @apiParam {number} [limit=10] - 返回结果的最大数量（非分页模式）�?
   * @apiParam {number} [page=1] - 页码，从1开始（分页模式）�?
   * @apiParam {number} [limit=20] - 每页数量，最�?00（分页模式）�?
   * @apiParam {string} [sort=score] - 排序字段（分页模式）�?
   * @apiParam {string} [order=desc] - 排序方向，asc或desc（分页模式）�?
   * @apiSuccess {SearchResult[]} results - 搜索结果数组（非分页模式）�?
   * @apiSuccess {Object} response - 分页响应对象（分页模式）�?
   * @apiSuccess {SearchResult[]} response.data - 搜索结果数组（分页模式）�?
   * @apiSuccess {Object} response.pagination - 分页元数据（分页模式）�?
   * @apiSuccess {number} response.pagination.page - 当前页码�?
   * @apiSuccess {number} response.pagination.limit - 每页数量�?
   * @apiSuccess {number} response.pagination.total - 总记录数�?
   * @apiSuccess {number} response.pagination.totalPages - 总页数�?
   * @apiSuccess {boolean} response.pagination.hasNext - 是否有下一页�?
   * @apiSuccess {boolean} response.pagination.hasPrev - 是否有上一页�?
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
    '/search',
    validate({ query: SearchQuerySchema }),
    async (
      req: ValidatedRequest<unknown, z.infer<typeof SearchQuerySchema>>,
      res,
    ) => {
      const validatedQuery = req.validated!.query;
      if (!validatedQuery) {
        // This should not happen with validation middleware, but TypeScript needs it
        return res.status(400).json({ error: 'Invalid query parameters' });
      }
      const { q: query, collectionId, limit } = validatedQuery;
      const results = await searchService.search(
        query,
        collectionId as CollectionId,
        { limit },
      );
      // 根据OpenAPI规范，直接返回RetrievalResultDTO数组
      res.status(200).json(results);
    },
  );

  /**
   * @api {get} /search/paginated 执行分页向量搜索
   * @apiGroup Search
   * @apiDescription 根据查询和可选的 Collection ID 执行向量相似度搜索，支持分页�?
   * @apiParam {string} q - 搜索查询字符串�?
   * @apiParam {string} collectionId - 要在其中执行搜索的集合的 ID�?
   * @apiParam {number} [page=1] - 页码，从1开始�?
   * @apiParam {number} [limit=20] - 每页数量，最�?00�?
   * @apiParam {string} [sort=score] - 排序字段�?
   * @apiParam {string} [order=desc] - 排序方向，asc或desc�?
   * @apiSuccess {Object} response - 分页响应对象�?
   * @apiSuccess {SearchResult[]} response.data - 搜索结果数组�?
   * @apiSuccess {Object} response.pagination - 分页元数据�?
   * @apiSuccess {number} response.pagination.page - 当前页码�?
   * @apiSuccess {number} response.pagination.limit - 每页数量�?
   * @apiSuccess {number} response.pagination.total - 总记录数�?
   * @apiSuccess {number} response.pagination.totalPages - 总页数�?
   * @apiSuccess {boolean} response.pagination.hasNext - 是否有下一页�?
   * @apiSuccess {boolean} response.pagination.hasPrev - 是否有上一页�?
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
    '/search/paginated',
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
        return res.status(400).json({ error: 'Invalid query parameters' });
      }
      const { q: query, collectionId } = validatedQuery;
      const paginatedResults = await searchService.searchPaginated(
        query,
        collectionId as CollectionId | undefined,
        validatedQuery,
      );
      res.status(200).json(paginatedResults);
    },
  );

  return router;
}
