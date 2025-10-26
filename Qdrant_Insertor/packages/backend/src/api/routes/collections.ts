import express from 'express';
import { z } from 'zod';
import { CollectionId } from '../../domain/types.js';
import { ICollectionService } from '../../domain/ICollectionService.js';
import { validate, ValidatedRequest } from '../../middlewares/validate.js';
import {
  CreateCollectionSchema,
  UpdateCollectionSchema,
  CollectionIdParamsSchema,
  ListCollectionsQuerySchema,
} from '../../api/contracts/collection.js';

/**
 * @function createCollectionRoutes
 * @description 创建集合相关的API路由
 * @param {ICollectionService} collectionService - 集合服务实例
 * @returns {express.Router} 配置好的 Express 路由实例。
 */
export function createCollectionRoutes(
  collectionService: ICollectionService,
): express.Router {
  const router = express.Router();

  /**
   * @api {post} /collections 创建新的 Collection
   * @apiGroup Collections
   * @apiDescription 创建一个新的 Collection。
   * @apiBody {string} name - Collection 的名称。
   * @apiBody {string} [description] - Collection 的描述。
   * @apiSuccess {Collection} collection - 创建成功的 Collection 对象。
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 201 Created
   *     {
   *       "id": "coll-xxxx",
   *       "name": "My New Collection",
   *       "description": "A collection of documents."
   *     }
   */
  router.post('/collections', async (req, res) => {
    // TODO: 添加验证中间件
    const { name, description } = req.body;
    const newCollection = collectionService.createCollection(name, description);
    res.status(201).json(newCollection);
  });

  /**
   * @api {get} /collections 列出所有 Collections
   * @apiGroup Collections
   * @apiDescription 获取所有 Collections 的列表。支持分页参数。
   * @apiParam {number} [page=1] - 页码，从1开始。
   * @apiParam {number} [limit=20] - 每页数量，最大100。
   * @apiParam {string} [sort=created_at] - 排序字段。
   * @apiParam {string} [order=desc] - 排序方向，asc或desc。
   * @apiSuccess {Object} response - 分页响应对象。
   * @apiSuccess {Collection[]} response.data - Collection 对象的数组。
   * @apiSuccess {Object} response.pagination - 分页元数据。
   * @apiSuccess {number} response.pagination.page - 当前页码。
   * @apiSuccess {number} response.pagination.limit - 每页数量。
   * @apiSuccess {number} response.pagination.total - 总记录数。
   * @apiSuccess {number} response.pagination.totalPages - 总页数。
   * @apiSuccess {boolean} response.pagination.hasNext - 是否有下一页。
   * @apiSuccess {boolean} response.pagination.hasPrev - 是否有上一页。
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "data": [
   *         { "id": "coll-xxxx", "name": "Collection 1" },
   *         { "id": "coll-yyyy", "name": "Collection 2" }
   *       ],
   *       "pagination": {
   *         "page": 1,
   *         "limit": 20,
   *         "total": 2,
   *         "totalPages": 1,
   *         "hasNext": false,
   *         "hasPrev": false
   *       }
   *     }
   */
  router.get(
    '/collections',
    validate({ query: ListCollectionsQuerySchema }),
    async (
      req: ValidatedRequest<
        unknown,
        z.infer<typeof ListCollectionsQuerySchema>
      >,
      res,
    ) => {
      const validatedQuery = req.validated?.query;
      if (!validatedQuery) {
        return res.status(400).json({ error: 'Invalid query parameters' });
      }

      // 检查是否提供了分页参数，如果没有则返回所有结果（向后兼容）
      const hasPaginationParams = req.query.page || req.query.limit;

      if (hasPaginationParams) {
        const paginatedCollections =
          collectionService.listCollectionsPaginated(validatedQuery);
        res.status(200).json(paginatedCollections);
      } else {
        // 向后兼容：如果没有分页参数，返回所有结果
        const collections = collectionService.listAllCollections();
        res.status(200).json(collections);
      }
    },
  );

  /**
   * @api {get} /collections/:collectionId 获取指定的 Collection
   * @apiGroup Collections
   * @apiDescription 根据 Collection ID 获取单个 Collection。
   * @apiParam {string} collectionId - 要获取的 Collection 的唯一标识符。
   * @apiSuccess {Collection} collection - 找到的 Collection 对象。
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "id": "coll-xxxx",
   *       "name": "My Collection",
   *       "description": "Description of my collection."
   *     }
   * @apiError (404 Not Found) CollectionNotFound - 如果找不到具有给定 ID 的 Collection。
   */
  router.get('/collections/:collectionId', async (req, res) => {
    const { collectionId } = req.params;
    const collection = collectionService.getCollectionById(
      collectionId as CollectionId,
    );
    // 统一错误处理中间件将处理未找到的情况
    res.status(200).json(collection);
  });

  /**
   * @api {put} /collections/:collectionId 更新 Collection
   * @apiGroup Collections
   * @apiDescription 根据 Collection ID 更新一个 Collection。
   * @apiParam {string} collectionId - 要更新的 Collection 的唯一标识符。
   * @apiBody {string} name - Collection 的新名称。
   * @apiBody {string} [description] - Collection 的新描述。
   * @apiSuccess {Collection} collection - 更新后的 Collection 对象。
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "id": "coll-xxxx",
   *       "name": "Updated Collection Name",
   *       "description": "Updated description"
   *     }
   * @apiError (404 Not Found) CollectionNotFound - 如果找不到具有给定 ID 的 Collection。
   * @apiError (422 Unprocessable Entity) ValidationError - 如果名称已存在。
   */
  router.put(
    '/collections/:collectionId',
    validate({
      params: CollectionIdParamsSchema,
      body: UpdateCollectionSchema,
    }),
    async (req, res) => {
      const validated = req as any;
      const params = validated.params as z.infer<
        typeof CollectionIdParamsSchema
      >;
      const body = validated.body as z.infer<typeof UpdateCollectionSchema>;

      if (!params || !body) {
        return res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
          },
        });
      }

      const { collectionId } = params;
      const { name, description } = body;

      try {
        const updatedCollection = collectionService.updateCollection(
          collectionId as CollectionId,
          name,
          description,
        );
        res.status(200).json(updatedCollection);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return res.status(404).json({
              error: {
                code: 'NOT_FOUND',
                message: error.message,
              },
            });
          }
          if (error.message.includes('already exists')) {
            return res.status(422).json({
              error: {
                code: 'VALIDATION_ERROR',
                message: error.message,
              },
            });
          }
        }
        throw error;
      }
    },
  );

  /**
   * @api {patch} /collections/:collectionId 部分更新 Collection
   * @apiGroup Collections
   * @apiDescription 根据 Collection ID 部分更新一个 Collection。
   * @apiParam {string} collectionId - 要更新的 Collection 的唯一标识符。
   * @apiBody {string} [name] - Collection 的新名称。
   * @apiBody {string} [description] - Collection 的新描述。
   * @apiSuccess {Collection} collection - 更新后的 Collection 对象。
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "id": "coll-xxxx",
   *       "name": "Updated Collection Name",
   *       "description": "Updated description"
   *     }
   * @apiError (404 Not Found) CollectionNotFound - 如果找不到具有给定 ID 的 Collection。
   * @apiError (422 Unprocessable Entity) ValidationError - 如果名称已存在。
   */
  router.patch(
    '/collections/:collectionId',
    validate({
      params: CollectionIdParamsSchema,
      body: UpdateCollectionSchema,
    }),
    async (req, res) => {
      const validated = req as any;
      const params = validated.params as z.infer<
        typeof CollectionIdParamsSchema
      >;
      const body = validated.body as z.infer<typeof UpdateCollectionSchema>;

      if (!params || !body) {
        return res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
          },
        });
      }

      const { collectionId } = params;
      const { name, description } = body;

      try {
        const updatedCollection = collectionService.updateCollection(
          collectionId as CollectionId,
          name,
          description,
        );
        res.status(200).json(updatedCollection);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return res.status(404).json({
              error: {
                code: 'NOT_FOUND',
                message: error.message,
              },
            });
          }
          if (error.message.includes('already exists')) {
            return res.status(422).json({
              error: {
                code: 'VALIDATION_ERROR',
                message: error.message,
              },
            });
          }
        }
        throw error;
      }
    },
  );

  /**
   * @api {delete} /collections/:collectionId 删除 Collection
   * @apiGroup Collections
   * @apiDescription 根据 Collection ID 删除一个 Collection 及其所有相关文档和块。
   * @apiParam {string} collectionId - 要删除的 Collection 的唯一标识符。
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 204 No Content
   */
  router.delete('/collections/:collectionId', async (req, res) => {
    const { collectionId } = req.params;
    await collectionService.deleteCollection(collectionId as CollectionId);
    res.status(204).end();
  });

  return router;
}
