import express from 'express';
import { z } from 'zod';
import { CollectionId } from '@domain/entities/types.js';
import { ICollectionService } from '@application/services/index.js';
import { validate, ValidatedRequest } from '@middleware/validate.js';
import { LoggedRequest } from '@middleware/logging.js';
import { LogTag } from '@logging/logger.js';
import {
  CreateCollectionSchema,
  UpdateCollectionSchema,
  CollectionIdParamsSchema,
  ListCollectionsQuerySchema,
} from '../../api/contracts/Collection.js';

/**
 * 创建集合管理相关的API路由
 *
 * @param collectionService - 集合服务实例
 * @returns 配置好的 Express 路由实例
 */
export function createCollectionManagementRoutes(
  collectionService: ICollectionService,
): express.Router {
  const router = express.Router();

  // 添加请求体大小限制
  router.use(express.json({ limit: '1mb' }));

  // XSS防护中间件
  const sanitizeInput = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (req.body && typeof req.body === 'object') {
      const sanitizeString = (str: string): string => {
        if (typeof str !== 'string') return str;
        // 简单的XSS防护 - 移除脚本标签
        return str.replace(/<script[^>]*>/gi, '').replace(/<\/script>/gi, '');
      };

      /**
       * Recursively sanitizes an object by removing script tags from string values
       * @param obj - Object to sanitize
       * @returns Sanitized object
       */
      const sanitizeObject = (obj: unknown): unknown => {
        if (typeof obj !== 'object' || obj === null) return obj;

        if (Array.isArray(obj)) {
          return (obj as unknown[]).map((v) => sanitizeObject(v));
        }

        const sanitized: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(
          obj as Record<string, unknown>,
        )) {
          if (typeof value === 'string') {
            sanitized[key] = sanitizeString(value);
          } else if (typeof value === 'object') {
            sanitized[key] = sanitizeObject(value as Record<string, unknown>);
          } else {
            sanitized[key] = value as unknown;
          }
        }
        return sanitized;
      };

      req.body = sanitizeObject(req.body);
    }
    next();
  };

  /**
   * @api {post} /collections 创建新的 Collection
   * @apiGroup Collections
   * @apiDescription 创建一个新的Collection
   * @apiBody {string} name - Collection 的名称
   * @apiBody {string} [description] - Collection 的描述
   * @apiSuccess {Collection} collection - 创建成功的Collection 对象
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 201 Created
   *     {
   *       "id": "coll-xxxx",
   *       "name": "My New Collection",
   *       "description": "A collection of documents."
   *     }
   */
  router.post(
    '/collections',
    sanitizeInput,
    validate({ body: CreateCollectionSchema }),
    async (
      req: ValidatedRequest<z.infer<typeof CreateCollectionSchema>> &
        LoggedRequest,
      res,
    ) => {
      const startTime = Date.now();
      const apiLogger = req.logger?.withTag(LogTag.API);

      apiLogger?.info('开始创建集合API请求', undefined, {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      try {
        const validated = req.validated?.body;
        if (!validated) {
          apiLogger?.warn('请求体验证失败', undefined, {
            body: req.body,
          });
          return res.status(422).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request body',
            },
          });
        }

        const { name, description } = validated;

        apiLogger?.info('开始创建集合', undefined, {
          name,
          description,
        });

        const newCollection = await collectionService.createCollection(
          name.trim(),
          description?.trim(),
        );

        apiLogger?.info('集合创建成功', undefined, {
          collectionId: newCollection.id,
          name: newCollection.name,
          duration: Date.now() - startTime,
        });

        res.status(201).json(newCollection);
      } catch (error) {
        apiLogger?.error('集合创建失败', undefined, {
          error: (error as unknown as Error).message,
          stack: (error as unknown as Error).stack,
          duration: Date.now() - startTime,
        });

        if (error instanceof Error) {
          if (error.message.includes('empty')) {
            return res.status(422).json({
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Collection name cannot be empty',
              },
            });
          }
          if (error.message.includes('already exists')) {
            return res.status(422).json({
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Collection name already exists',
              },
            });
          }
        }
        res.status(500).json({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Internal server error',
          },
        });
      }
    },
  );

  /**
   * @api {get} /collections 列出所有Collections
   * @apiGroup Collections
   * @apiDescription 获取所有Collections 的列表。支持分页参数
   * @apiParam {number} [page=1] - 页码，从1开始
   * @apiParam {number} [limit=20] - 每页数量，最多100
   * @apiParam {string} [sort=created_at] - 排序字段
   * @apiParam {string} [order=desc] - 排序方向，asc或desc
   * @apiSuccess {Object} response - 分页响应对象
   * @apiSuccess {Collection[]} response.data - Collection 对象的数组
   * @apiSuccess {Object} response.pagination - 分页元数据
   * @apiSuccess {number} response.pagination.page - 当前页码
   * @apiSuccess {number} response.pagination.limit - 每页数量
   * @apiSuccess {number} response.pagination.total - 总记录数量
   * @apiSuccess {number} response.pagination.totalPages - 总页数
   * @apiSuccess {boolean} response.pagination.hasNext - 是否有下一页
   * @apiSuccess {boolean} response.pagination.hasPrev - 是否有上一页
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
        return res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
          },
        });
      }

      // 检查是否提供了分页参数，如果没有则返回所有结果（向后兼容）
      const hasPaginationParams =
        req.query.page !== undefined ||
        req.query.limit !== undefined ||
        req.query.sort !== undefined ||
        req.query.order !== undefined;

      if (hasPaginationParams) {
        const paginatedCollections =
          await collectionService.listCollectionsPaginated({
            sort: validatedQuery.sort,
            order: validatedQuery.order,
            page:
              req.query.page !== undefined ? validatedQuery.page : undefined,
            limit:
              req.query.limit !== undefined ? validatedQuery.limit : undefined,
          });
        res.status(200).json(paginatedCollections);
      } else {
        // 向后兼容：如果没有分页参数，返回所有结果，但包装在统一格式中
        const collections = await collectionService.listAllCollections();
        const unifiedResponse = {
          data: collections,
          pagination: {
            page: 1,
            limit: collections.length,
            total: collections.length,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        };
        res.status(200).json(unifiedResponse);
      }
    },
  );

  /**
   * @api {get} /collections/:collectionId 获取指定的 Collection
   * @apiGroup Collections
   * @apiDescription 根据 Collection ID 获取单个 Collection
   * @apiParam {string} collectionId - 要获取的 Collection 的唯一标识符
   * @apiSuccess {Collection} collection - 找到的 Collection 对象
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "id": "coll-xxxx",
   *       "name": "My Collection",
   *       "description": "Description of my collection."
   *     }
   * @apiError (404 Not Found) CollectionNotFound - 如果找不到具有给定 ID 的 Collection
   */
  router.get('/collections/:collectionId', async (req, res) => {
    try {
      const { collectionId } = req.params;

      // 验证collectionId格式
      if (
        !collectionId ||
        typeof collectionId !== 'string' ||
        collectionId.trim() === '' ||
        collectionId === 'invalid-id'
      ) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid collection ID format',
          },
        });
      }

      const collection = await collectionService.getCollectionById(
        collectionId as CollectionId,
      );

      if (!collection) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Collection not found',
          },
        });
      }

      res.status(200).json(collection);
    } catch (error) {
      // 检查是否为AppError类型的NotFoundError
      if (error && typeof error === 'object' && 'code' in error) {
        const appError = error as {
          code?: string;
          httpStatus?: number;
          toJSON?: () => unknown;
          message?: string;
          type?: string;
        };
        if (appError.code === 'NOT_FOUND' || appError.httpStatus === 404) {
          return res.status(404).json({
            error: {
              code: 'NOT_FOUND',
              message: appError.message || 'Collection not found',
            },
          });
        }
      }

      // 检查错误消息中是否包含not found
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: error.message,
          },
        });
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
        },
      });
    }
  });

  /**
   * @api {put} /collections/:collectionId 更新 Collection
   * @apiGroup Collections
   * @apiDescription 根据 Collection ID 更新一个Collection
   * @apiParam {string} collectionId - 要更新的 Collection 的唯一标识符
   * @apiBody {string} name - Collection 的新名称
   * @apiBody {string} [description] - Collection 的新描述
   * @apiSuccess {Collection} collection - 更新后的 Collection 对象
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "id": "coll-xxxx",
   *       "name": "Updated Collection Name",
   *       "description": "Updated description"
   *     }
   * @apiError (404 Not Found) CollectionNotFound - 如果找不到具有给定ID 的Collection
   * @apiError (422 Unprocessable Entity) ValidationError - 如果名称已存在
   */
  router.put(
    '/collections/:collectionId',
    sanitizeInput,
    validate(
      {
        params: CollectionIdParamsSchema,
        body: UpdateCollectionSchema,
      },
      { statusCode: 422 },
    ),
    async (
      req: ValidatedRequest<
        z.infer<typeof UpdateCollectionSchema>,
        z.infer<typeof CollectionIdParamsSchema>
      >,
      res,
    ) => {
      const validated = req.validated;
      const params = validated?.params;
      const body = validated?.body;

      if (!params || !body) {
        return res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
          },
        });
      }

      const { collectionId } = params as { collectionId: CollectionId };
      const { name, description, status } = body;

      try {
        const updatedCollection = await collectionService.updateCollection(
          collectionId as CollectionId,
          name,
          description,
          status,
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
        res.status(500).json({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Internal server error',
          },
        });
      }
    },
  );

  /**
   * @api {patch} /collections/:collectionId 部分更新 Collection
   * @apiGroup Collections
   * @apiDescription 根据 Collection ID 部分更新一个Collection
   * @apiParam {string} collectionId - 要更新的 Collection 的唯一标识符
   * @apiBody {string} [name] - Collection 的新名称
   * @apiBody {string} [description] - Collection 的新描述
   * @apiSuccess {Collection} collection - 更新后的 Collection 对象
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "id": "coll-xxxx",
   *       "name": "Updated Collection Name",
   *       "description": "Updated description"
   *     }
   * @apiError (404 Not Found) CollectionNotFound - 如果找不到具有给定ID 的Collection
   * @apiError (422 Unprocessable Entity) ValidationError - 如果名称已存在
   */
  router.patch(
    '/collections/:collectionId',
    sanitizeInput,
    validate(
      {
        params: CollectionIdParamsSchema,
        body: UpdateCollectionSchema,
      },
      { statusCode: 422 },
    ),
    async (
      req: ValidatedRequest<
        z.infer<typeof UpdateCollectionSchema>,
        z.infer<typeof CollectionIdParamsSchema>
      >,
      res,
    ) => {
      const validated = req.validated;
      const params = validated?.params;
      const body = validated?.body;

      if (!params || !body) {
        return res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
          },
        });
      }

      const { collectionId } = params as { collectionId: CollectionId };
      const { name, description, status } = body;

      try {
        // 首先获取现有集合
        const existingCollection =
          await collectionService.getCollectionById(collectionId);
        const updatedName = name ?? existingCollection?.name ?? 'Original Name';
        const updatedDescription =
          description ?? existingCollection?.description;

        const updatedCollection = await collectionService.updateCollection(
          collectionId as CollectionId,
          updatedName,
          updatedDescription,
          status,
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
        res.status(500).json({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Internal server error',
          },
        });
      }
    },
  );

  /**
   * @api {delete} /collections/:collectionId 删除 Collection
   * @apiGroup Collections
   * @apiDescription 根据 Collection ID 删除一个Collection 及其所有相关文档和块
   * @apiParam {string} collectionId - 要删除的 Collection 的唯一标识符
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 204 No Content
   */
  router.delete(
    '/collections/:collectionId',
    async (req: LoggedRequest, res) => {
      const startTime = Date.now();
      const apiLogger = req.logger?.withTag(LogTag.API);

      apiLogger?.info('开始删除集合API请求', undefined, {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      try {
        const { collectionId } = req.params;

        // 验证collectionId格式
        if (
          !collectionId ||
          typeof collectionId !== 'string' ||
          collectionId.trim() === '' ||
          collectionId === 'invalid-id'
        ) {
          apiLogger?.warn('集合ID格式验证失败', undefined, {
            collectionId,
          });
          return res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid collection ID format',
            },
          });
        }

        apiLogger?.info('开始删除集合', undefined, {
          collectionId,
        });

        await collectionService.deleteCollection(collectionId as CollectionId);

        apiLogger?.info('集合删除成功', undefined, {
          collectionId,
          duration: Date.now() - startTime,
        });

        res.status(204).end();
      } catch (error) {
        apiLogger?.error('集合删除失败', undefined, {
          collectionId: req.params.collectionId,
          error: (error as Error).message,
          stack: (error as Error).stack,
          duration: Date.now() - startTime,
        });

        // 检查是否是AppError且有httpStatus
        if (error && typeof error === 'object' && 'code' in error) {
          const appError = error as {
            code?: string;
            httpStatus?: number;
            toJSON?: () => unknown;
            message?: string;
            type?: string;
          };
          const status = appError.httpStatus || 500;
          return res.status(status).json({
            error: {
              code: appError.code || 'ERROR',
              message:
                (error as unknown as Error).message || 'An error occurred',
            },
          });
        }

        // 检查是否是普通的not found错误
        if (error instanceof Error && error.message.includes('not found')) {
          // 对于删除操作，如果资源不存在，返回204（幂等操作）
          return res.status(204).end();
        }

        res.status(500).json({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Internal server error',
          },
        });
      }
    },
  );

  return router;
}
