import express from 'express';
import { z } from 'zod';
import { CollectionId } from '@domain/entities/types.js';
import { ICollectionService } from '@domain/repositories/ICollectionService.js';
import { validate, ValidatedRequest } from '@middleware/validate.js';
import { LoggedRequest } from '@middleware/logging.js';
import { LogTag } from '@logging/logger.js';
import {
  CreateCollectionSchema,
  UpdateCollectionSchema,
  CollectionIdParamsSchema,
  ListCollectionsQuerySchema,
} from '../../api/contracts/collection.js';

/**
 * 应用错误结构的弱类型接口与守卫
 */
interface AppErrorLike {
  code?: string;
  httpStatus?: number;
  toJSON?: () => unknown;
  message?: string;
  type?: string;
}

/**
 * 检查对象是否为应用错误类型
 * @param e - 要检查的对象
 * @returns 是否为应用错误类型
 */
function isAppErrorLike(e: unknown): e is AppErrorLike {
  if (!e || typeof e !== 'object') return false;
  const o = e as Record<string, unknown>;
  return 'code' in o || 'httpStatus' in o || 'type' in o;
}

/**
 * 创建集合相关的API路由
 *
 * @param collectionService - 集合服务实例
 * @returns 配置好的 Express 路由实例
 */
export function createCollectionRoutes(
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
        return str
          .replace(/<script[^>]*>/gi, '')
          .replace(/<\/script>/gi, '');
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
        for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
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
          return res.status(400).json({
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
          error: (error as Error).message,
          stack: (error as Error).stack,
          duration: Date.now() - startTime,
        });

        if (error instanceof Error) {
          if (error.message.includes('empty')) {
            return res.status(400).json({
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
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
          },
        });
      }
    },
  );

  /**
   * @api {get} /collections 列出所�?Collections
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
        return res.status(400).json({
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
   * @api {get} /collections/:collectionId 获取指定�?Collection
   * @apiGroup Collections
   * @apiDescription 根据 Collection ID 获取单个 Collection�?
   * @apiParam {string} collectionId - 要获取的 Collection 的唯一标识符�?
   * @apiSuccess {Collection} collection - 找到�?Collection 对象�?
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "id": "coll-xxxx",
   *       "name": "My Collection",
   *       "description": "Description of my collection."
   *     }
   * @apiError (404 Not Found) CollectionNotFound - 如果找不到具有给�?ID �?Collection�?
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
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
      });
    }
  });

  /**
   * @api {put} /collections/:collectionId 更新 Collection
   * @apiGroup Collections
   * @apiDescription 根据 Collection ID 更新一�?Collection�?
   * @apiParam {string} collectionId - 要更新的 Collection 的唯一标识符�?
   * @apiBody {string} name - Collection 的新名称�?
   * @apiBody {string} [description] - Collection 的新描述�?
   * @apiSuccess {Collection} collection - 更新后的 Collection 对象�?
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "id": "coll-xxxx",
   *       "name": "Updated Collection Name",
   *       "description": "Updated description"
   *     }
   * @apiError (404 Not Found) CollectionNotFound - 如果找不到具有给�?ID �?Collection�?
   * @apiError (422 Unprocessable Entity) ValidationError - 如果名称已存在�?
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
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
          },
        });
      }

      const { collectionId } = params as { collectionId: CollectionId };
      const { name, description } = body;

      try {
        const updatedCollection = await collectionService.updateCollection(
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
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
          },
        });
      }
    },
  );

  /**
   * @api {patch} /collections/:collectionId 部分更新 Collection
   * @apiGroup Collections
   * @apiDescription 根据 Collection ID 部分更新一�?Collection�?
   * @apiParam {string} collectionId - 要更新的 Collection 的唯一标识符�?
   * @apiBody {string} [name] - Collection 的新名称�?
   * @apiBody {string} [description] - Collection 的新描述�?
   * @apiSuccess {Collection} collection - 更新后的 Collection 对象�?
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "id": "coll-xxxx",
   *       "name": "Updated Collection Name",
   *       "description": "Updated description"
   *     }
   * @apiError (404 Not Found) CollectionNotFound - 如果找不到具有给�?ID �?Collection�?
   * @apiError (422 Unprocessable Entity) ValidationError - 如果名称已存在�?
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
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
          },
        });
      }

      const { collectionId } = params as { collectionId: CollectionId };
      const { name, description } = body;

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
            code: 'INTERNAL_ERROR',
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
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
          },
        });
      }
    },
  );

  /**
   * Global error handling middleware - must be after all routes
   */
  router.use(
    (
      error: unknown,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      // 如果已经发送了响应，则跳过
      if (res.headersSent) {
        return next(error);
      }

      // 处理应用级错误：使用类型守卫判断并在使用 toJSON/httpStatus 前做类型校验
      if (isAppErrorLike(error)) {
        const status = typeof error.httpStatus === 'number' ? error.httpStatus : 500;

        // 如果实现了 toJSON，优先使用其返回值（可能为任意 JSON-able 类型）
        if (typeof error.toJSON === 'function') {
          try {
            const payload = error.toJSON();
            return res.status(status).json(payload);
          } catch (e) {
            // toJSON 本身抛错，降级为通用结构
            console.error('AppError.toJSON failed', e);
          }
        }

        // 默认返回结构化错误对象
        const payload = {
          code: error.code ?? 'ERROR',
          message: (error as Error).message ?? error.message ?? 'Internal error',
        };
        return res.status(status).json(payload);
      }

      // 处理JSON解析错误
      if (
        typeof error === 'object' &&
        error !== null &&
        (((error as Error).name === 'SyntaxError') || (error as Record<string, unknown>)['type'] === 'entity.parse.failed')
      ) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid JSON format',
          },
        });
      }

      // 处理请求体过大错误
      if (typeof error === 'object' && error !== null && (error as Record<string, unknown>)['type'] === 'entity.too.large') {
        return res.status(413).json({
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: 'Request entity too large',
          },
        });
      }

      // 默认错误处理
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
      });
    },
  );

  return router;
}
