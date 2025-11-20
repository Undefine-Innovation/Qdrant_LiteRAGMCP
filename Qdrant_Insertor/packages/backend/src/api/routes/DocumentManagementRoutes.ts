import express from 'express';
import { z } from 'zod';
import { DocId, CollectionId } from '@domain/entities/types.js';
import { IImportService } from '@application/services/index.js';
import { IDocumentService } from '@application/services/index.js';
import { validate, ValidatedRequest } from '@middleware/validate.js';
import { LoggedRequest } from '@middleware/logging.js';
import { LogTag } from '@logging/logger.js';
import { ListDocsQuerySchema } from '@api/contracts/document.js';
import { AppError } from '@api/contracts/error.js';

/**
 * 创建文档管理相关的API路由
 *
 * @param importService - 导入服务实例
 * @param documentService - 文档服务实例
 * @returns 配置好的 Express 路由实例
 */
export function createDocumentManagementRoutes(
  importService: IImportService,
  documentService: IDocumentService,
): express.Router {
  const router = express.Router();

  /**
   * @api {post} /docs 导入新文档(已弃用)
   * @apiGroup Documents
   * @apiDescription 从文件路径导入一个新文档到指定的 Collection。此端点已弃用，请使用/upload
   * @apiBody {string} filePath - 文档源文件的路径
   * @apiBody {string} collectionId - 文档所属Collection的ID
   * @apiSuccess {Doc} document - 导入成功的文档对象
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 201 Created
   *     {
   *       "id": "doc-xxxx",
   *       "name": "My Document",
   *       "collectionId": "coll-xxxx"
   *     }
   */
  router.post('/docs', async (req: LoggedRequest, res) => {
    const startTime = Date.now();
    const apiLogger = req.logger?.withTag(LogTag.API);

    apiLogger?.info('开始导入文档API请求（已弃用）', undefined, {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });

    try {
      // TODO: 添加验证中间件
      const { filePath, collectionId } = req.body;

      apiLogger?.info('开始导入文档', undefined, {
        filePath,
        collectionId,
      });

      const doc = await importService.importDocument(
        filePath,
        collectionId as unknown as CollectionId,
      );

      apiLogger?.info('文档导入成功', undefined, {
        docId: doc.id,
        fileName: doc.name,
        collectionId,
        duration: Date.now() - startTime,
      });

      res.status(201).json(doc);
    } catch (error) {
      apiLogger?.error('文档导入失败', undefined, {
        filePath: req.body.filePath,
        collectionId: req.body.collectionId,
        error: (error as unknown as Error).message,
        stack: (error as unknown as Error).stack,
        duration: Date.now() - startTime,
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
      });
    }
  });

  /**
   * @api {get} /docs 列出所有文档
   * @apiGroup Documents
   * @apiDescription 获取所有文档的列表。支持分页参数和集合过滤
   * @apiParam {number} [page=1] - 页码，从1开始
   * @apiParam {number} [limit=20] - 每页数量，最多100
   * @apiParam {string} [sort=created_at] - 排序字段
   * @apiParam {string} [order=desc] - 排序方向，asc或desc
   * @apiParam {string} [collectionId] - 可选的集合ID，用于过滤特定集合的文档
   * @apiSuccess {Object} response - 分页响应对象
   * @apiSuccess {Doc[]} response.data - 文档对象的数组
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
   *         { "id": "doc-xxxx", "name": "Document 1" },
   *         { "id": "doc-yyyy", "name": "Document 2" }
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
    '/docs',
    validate({ query: ListDocsQuerySchema }),
    async (
      req: ValidatedRequest<unknown, z.infer<typeof ListDocsQuerySchema>> &
        LoggedRequest,
      res,
    ) => {
      const startTime = Date.now();
      const apiLogger = req.logger?.withTag(LogTag.API);

      apiLogger?.info('开始列出文档API请求', undefined, {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      try {
        const validatedQuery = req.validated?.query;
        if (!validatedQuery) {
          apiLogger?.warn('查询参数验证失败', undefined, {
            query: req.query,
          });
          return res.status(422).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid query parameters',
            },
          });
        }

        // 检查是否提供了分页参数，如果没有则返回所有结果（向后兼容）
        const hasPaginationParams = req.query.page || req.query.limit;

        if (hasPaginationParams) {
          const collectionId = validatedQuery.collectionId;

          apiLogger?.info('开始分页查询文档', undefined, {
            collectionId,
            pagination: validatedQuery,
          });

          const paginatedDocs = await documentService.listDocumentsPaginated(
            validatedQuery,
            collectionId as unknown as CollectionId,
          );

          apiLogger?.info('分页查询文档成功', undefined, {
            collectionId,
            count: paginatedDocs.data.length,
            total: paginatedDocs.pagination.total,
            duration: Date.now() - startTime,
          });

          res.status(200).json(paginatedDocs);
        } else {
          // 向后兼容：如果没有分页参数，返回所有结果，但包装在统一格式中
          apiLogger?.info('开始查询所有文档（向后兼容）');

          const docs = await documentService.listAllDocuments();
          const unifiedResponse = {
            data: docs,
            pagination: {
              page: 1,
              limit: docs.length,
              total: docs.length,
              totalPages: 1,
              hasNext: false,
              hasPrev: false,
            },
          };

          apiLogger?.info('查询所有文档成功', undefined, {
            count: docs.length,
            duration: Date.now() - startTime,
          });

          res.status(200).json(unifiedResponse);
        }
      } catch (error) {
        apiLogger?.error('列出文档失败', undefined, {
          query: req.query,
          error: (error as Error).message,
          stack: (error as Error).stack,
          duration: Date.now() - startTime,
        });

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
   * @api {get} /docs/:docId 获取指定的文档
   * @apiGroup Documents
   * @apiDescription 根据文档 ID 获取单个文档对象
   * @apiParam {string} docId - 要获取的文档的唯一标识符
   * @apiSuccess {Doc} document - 找到的文档对象
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "id": "doc-xxxx",
   *       "name": "My Document",
   *       "collectionId": "coll-xxxx"
   *     }
   * @apiError (404 Not Found) DocumentNotFound - 如果找不到具有给定ID 的文档
   */
  router.get('/docs/:docId', async (req: LoggedRequest, res) => {
    const startTime = Date.now();
    const apiLogger = req.logger?.withTag(LogTag.API);

    apiLogger?.info('开始获取文档API请求', undefined, {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });

    try {
      const { docId } = req.params;

      // 验证docId格式
      if (!docId || typeof docId !== 'string' || docId.trim() === '') {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid document ID format',
          },
        });
      }

      apiLogger?.info('开始获取文档', undefined, {
        docId,
      });

      const doc = await documentService.getDocumentById(docId as DocId);

      // 如果未找到文档，返回 404（统一格式）
      if (!doc) {
        apiLogger?.warn('文档未找到', undefined, { docId });
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `Document with ID ${docId} not found`,
          },
        });
      }

      apiLogger?.info('获取文档成功', undefined, {
        docId,
        fileName: doc.name,
        duration: Date.now() - startTime,
      });

      res.status(200).json(doc);
    } catch (error) {
      apiLogger?.error('获取文档失败', undefined, {
        docId: req.params.docId,
        error: (error as Error).message,
        stack: (error as Error).stack,
        duration: Date.now() - startTime,
      });

      // 检查是否为AppError类型的NotFoundError
      if (error && typeof error === 'object' && 'code' in error) {
        const appError = error as {
          code?: string;
          httpStatus?: number;
          message?: string;
        };
        if (appError.code === 'NOT_FOUND' || appError.httpStatus === 404) {
          return res.status(404).json({
            error: {
              code: 'NOT_FOUND',
              message:
                appError.message ||
                `Document with ID ${req.params.docId} not found`,
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
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
      });
    }
  });

  /**
   * @api {put} /docs/:docId/resync 重新同步文档
   * @apiGroup Documents
   * @apiDescription 根据文档 ID 重新同步文档内容（从其源文件）
   * @apiParam {string} docId - 要重新同步的文档的唯一标识符
   * @apiSuccess {Doc} document - 更新后的文档对象
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "id": "doc-xxxx",
   *       "name": "My Document (Updated)",
   *       "collectionId": "coll-xxxx"
   *     }
   */
  router.put('/docs/:docId/resync', async (req: LoggedRequest, res) => {
    const startTime = Date.now();
    const apiLogger = req.logger?.withTag(LogTag.API);

    apiLogger?.info('开始重新同步文档API请求', undefined, {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });

    try {
      const { docId } = req.params;

      apiLogger?.info('开始重新同步文档', undefined, {
        docId,
      });

      console.log(
        'DEBUG: About to call documentService.resyncDocument with docId:',
        docId,
      );
      const updatedDoc = await documentService.resyncDocument(docId as DocId);
      console.log(
        'DEBUG: documentService.resyncDocument returned:',
        updatedDoc,
      );

      // 如果resync未找到文档，返回404
      if (!updatedDoc) {
        apiLogger?.warn('重新同步目标文档未找到', undefined, { docId });
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `Document with ID ${docId} not found`,
          },
        });
      }

      apiLogger?.info('文档重新同步成功', undefined, {
        docId,
        fileName: updatedDoc.name,
        duration: Date.now() - startTime,
      });

      res.status(200).json(updatedDoc);
    } catch (error) {
      console.log('DEBUG: Error in resync route:', error);
      apiLogger?.error('文档重新同步失败', undefined, {
        docId: req.params.docId,
        error: (error as Error).message,
        stack: (error as Error).stack,
        duration: Date.now() - startTime,
      });

      // 检查是否为AppError类型的NotFoundError
      if (error && typeof error === 'object' && 'code' in error) {
        const appError = error as {
          code?: string;
          httpStatus?: number;
          message?: string;
        };
        if (appError.code === 'NOT_FOUND' || appError.httpStatus === 404) {
          return res.status(404).json({
            error: {
              code: 'NOT_FOUND',
              message:
                appError.message ||
                `Document with ID ${req.params.docId} not found`,
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
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
      });
    }
  });

  /**
   * @api {delete} /docs/:docId 删除文档
   * @apiGroup Documents
   * @apiDescription 根据文档 ID 删除文档
   * @apiParam {string} docId - 要删除的文档的唯一标识符
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 204 No Content
   */
  router.delete('/docs/:docId', async (req: LoggedRequest, res) => {
    const startTime = Date.now();
    const apiLogger = req.logger?.withTag(LogTag.API);

    apiLogger?.info('开始删除文档API请求', undefined, {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });

    const { docId } = req.params;

    apiLogger?.info('开始删除文档', undefined, {
      docId,
    });

    try {
      await documentService.deleteDocument(docId as DocId);

      apiLogger?.info('文档删除成功', undefined, {
        docId,
        duration: Date.now() - startTime,
      });

      res.status(204).end();
    } catch (error) {
      apiLogger?.error('文档删除失败', undefined, {
        docId,
        error: (error as Error).message,
        stack: (error as Error).stack,
        duration: Date.now() - startTime,
      });

      // 检查是否为AppError类型的NotFoundError
      if (error && typeof error === 'object' && 'code' in error) {
        const appError = error as {
          code?: string;
          httpStatus?: number;
          message?: string;
        };
        if (appError.code === 'NOT_FOUND' || appError.httpStatus === 404) {
          return res.status(404).json({
            error: {
              code: 'NOT_FOUND',
              message:
                appError.message || `Document with ID ${docId} not found`,
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
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
      });
    }
  });

  return router;
}
