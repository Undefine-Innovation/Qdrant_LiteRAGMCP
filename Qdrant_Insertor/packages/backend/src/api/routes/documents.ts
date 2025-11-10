import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import { CollectionId, DocId } from '@domain/entities/types.js';
import { IImportService } from '@domain/repositories/IImportService.js';
import { ICollectionService } from '@domain/repositories/ICollectionService.js';
import { IDocumentService } from '@domain/repositories/IDocumentService.js';
import type { IImportAndIndexUseCase } from '@domain/use-cases/index.js';
import { validate, ValidatedRequest } from '@middleware/validate.js';
import { LoggedRequest } from '@middleware/logging.js';
import { LogTag } from '@logging/logger.js';
import {
  UploadToCollectionSchema,
  UploadDocumentResponseSchema,
  ListDocsQuerySchema,
} from '@api/contracts/document.js';
import { AppError } from '@api/contracts/error.js';
import { FILE_SIZE_LIMITS, SUPPORTED_MIME_TYPES } from '@domain/constants/FileConstants.js';

/**
 * 创建文档相关的API路由
 *
 * @param importService - 导入服务实例
 * @param collectionService - 集合服务实例
 * @param documentService - 文档服务实例
 * @param importAndIndexUseCase - 导入并索引用例实例
 * @returns 配置好的 Express 路由实例
 */
export function createDocumentRoutes(
  importService: IImportService,
  collectionService: ICollectionService,
  documentService: IDocumentService,
  importAndIndexUseCase: IImportAndIndexUseCase,
): express.Router {
  const router = express.Router();

  // 配置multer用于文件上传
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: FILE_SIZE_LIMITS.MAX_UPLOAD_SIZE,
    },
  });

  /**
   * @api {post} /collections/:collectionId/docs 上传文档到指定集�?
   * @apiGroup Documents
   * @apiDescription 上传一个新文档到指定的集合，使用multipart/form-data格式
   * @apiParam {string} collectionId - 目标集合的ID
   * @apiParam (FormData) {File} file - 要上传的文档文件
   * @apiSuccess {string} docId - 上传成功后返回的文档 ID
   * @apiSuccess {string} name - 上传的文件名
   * @apiSuccess {string} collectionId - 所属集合的 ID
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 201 Created
   *     {
   *       "docId": "doc-xxxx",
   *       "name": "document.pdf",
   *       "collectionId": "coll-xxxx"
   *     }
   */
  router.post(
    '/collections/:collectionId/docs',
    validate({ params: UploadToCollectionSchema }),
    upload.single('file'),
    async (
      req: ValidatedRequest<
        unknown,
        unknown,
        z.infer<typeof UploadToCollectionSchema>
      > &
        LoggedRequest,
      res,
    ) => {
      const startTime = Date.now();
      const apiLogger = req.logger?.withTag(LogTag.API);

      apiLogger?.info('开始上传文档API请求', undefined, {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      if (!req.validated?.params || !req.file) {
        apiLogger?.warn('请求验证失败', undefined, {
          hasValidatedParams: !!req.validated?.params,
          hasFile: !!req.file,
        });
        return res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: !req.file ? 'No file uploaded' : 'Invalid collection ID',
          },
        });
      }

      const { collectionId } = req.validated.params;

      apiLogger?.info('开始上传文档', undefined, {
        collectionId,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      });

      // 检查文件大小限制
      if (req.file.size > FILE_SIZE_LIMITS.MAX_UPLOAD_SIZE) {
        apiLogger?.warn('文件大小超过限制', undefined, {
          fileName: req.file.originalname,
          fileSize: req.file.size,
          maxSize: '10MB',
        });
        throw AppError.createFileTooLargeError(
          'File size exceeds the maximum limit of 10MB',
        );
      }

      // 检查文件类型
  const allowedMimeTypes = SUPPORTED_MIME_TYPES;
  const fileMime = req.file.mimetype as typeof SUPPORTED_MIME_TYPES[number];

  if (!allowedMimeTypes.includes(fileMime)) {
        apiLogger?.warn('不支持的文件类型', undefined, {
          fileName: req.file.originalname,
          mimeType: req.file.mimetype,
          allowedTypes: allowedMimeTypes,
        });
        throw AppError.createUnsupportedFileTypeError(
          `File type ${req.file.mimetype} is not supported. Supported types: ${allowedMimeTypes.join(', ')}`,
        );
      }

      // 使用用例层执行导入和索引流程
      const doc = await importAndIndexUseCase.execute({
        file: req.file,
        collectionId: collectionId as CollectionId,
      });

      const response = {
        docId: doc.id, // 使用id字段，但保持API响应中的docId名称
        name: doc.name,
        collectionId: doc.collectionId,
      };

      // 验证响应格式
      const validatedResponse = UploadDocumentResponseSchema.parse(response);

      apiLogger?.info('文档上传成功', undefined, {
        docId: doc.id,
        fileName: req.file.originalname,
        collectionId,
        duration: Date.now() - startTime,
      });

      res.status(201).json(validatedResponse);
    },
  );

  /**
   * @api {post} /upload 上传文档到默认集�?
   * @apiGroup Documents
   * @apiDescription 上传一个新文档，使用multipart/form-data格式，自动添加到默认集合
   * @apiParam (FormData) {File} file - 要上传的文档文件
   * @apiSuccess {string} docId - 上传成功后返回的文档 ID
   * @apiSuccess {string} name - 上传的文件名
   * @apiSuccess {string} collectionId - 所属集合的 ID
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 201 Created
   *     {
   *       "docId": "doc-xxxx",
   *       "name": "document.pdf",
   *       "collectionId": "coll-xxxx"
   *     }
   */
  router.post(
    '/upload',
    upload.single('file'),
    async (req: LoggedRequest, res) => {
      const startTime = Date.now();
      const apiLogger = req.logger?.withTag(LogTag.API);

      apiLogger?.info('开始上传文档到默认集合API请求', undefined, {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      try {
        if (!req.file) {
          apiLogger?.warn('请求验证失败：没有文件', undefined, {
            hasFile: !!req.file,
          });
          return res.status(422).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'No file uploaded',
            },
          });
        }

        apiLogger?.info('开始上传文档到默认集合', undefined, {
          fileName: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
        });

        // 检查文件大小限制
        if (req.file.size > FILE_SIZE_LIMITS.MAX_UPLOAD_SIZE) {
          apiLogger?.warn('文件大小超过限制', undefined, {
            fileName: req.file.originalname,
            fileSize: req.file.size,
            maxSize: '10MB',
          });
          throw AppError.createFileTooLargeError(
            'File size exceeds the maximum limit of 10MB',
          );
        }

        // 检查文件类型
  const allowedMimeTypes = SUPPORTED_MIME_TYPES;
  const fileMime = req.file.mimetype as typeof SUPPORTED_MIME_TYPES[number];

  if (!allowedMimeTypes.includes(fileMime)) {
          apiLogger?.warn('不支持的文件类型', undefined, {
            fileName: req.file.originalname,
            mimeType: req.file.mimetype,
            allowedTypes: allowedMimeTypes,
          });
          throw AppError.createUnsupportedFileTypeError(
            `File type ${req.file.mimetype} is not supported. Supported types: ${allowedMimeTypes.join(', ')}`,
          );
        }

        // 获取已有的集合列表
        const collections = await collectionService.listAllCollections();

        if (collections.length === 0) {
          apiLogger?.warn('没有可用的集合', undefined, {
            collectionsCount: collections.length,
          });
          return res.status(400).json({
            error: {
              code: 'NO_COLLECTION_AVAILABLE',
              message:
                'No collection available for upload. Please create a collection first.',
            },
          });
        }

        // 使用第一个集合（最常用的做法）
        const targetCollection = collections[0];
        const collectionId = (targetCollection.id ||
          targetCollection.collectionId) as CollectionId;

        apiLogger?.info('使用默认集合', undefined, {
          collectionId,
          collectionName: targetCollection.name,
        });

        // 使用用例层执行导入和索引流程
        const doc = await importAndIndexUseCase.execute({
          file: req.file,
          collectionId,
        });

        const response = {
          docId: doc.id, // 使用id字段，但保持API响应中的docId名称
          name: doc.name,
          collectionId: doc.collectionId,
        };

        // 验证响应格式
        const validatedResponse = UploadDocumentResponseSchema.parse(response);

        apiLogger?.info('文档上传到默认集合成功', undefined, {
          docId: doc.id,
          fileName: req.file.originalname,
          collectionId,
          duration: Date.now() - startTime,
        });

        res.status(201).json(validatedResponse);
      } catch (error) {
        apiLogger?.error('文档上传到默认集合失败', undefined, {
          fileName: req.file?.originalname,
          error: (error as Error).message,
          stack: (error as Error).stack,
          duration: Date.now() - startTime,
        });

        // 重新抛出错误，让错误处理中间件处理
        throw error;
      }
    },
  );

  /**
   * @api {post} /docs 导入新文�?(已弃�?
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
        collectionId as CollectionId,
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
  });

  /**
   * @api {get} /docs 列出所有文�?
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
          return res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid query parameters',
            },
          });
        }

        // 检查是否提供了分页参数，如果没有则返回所有结果（向后兼容）
        const hasPaginationParams = req.query.page || req.query.limit;

        if (hasPaginationParams) {
          const collectionId = validatedQuery.collectionId as
            | CollectionId
            | undefined;

          apiLogger?.info('开始分页查询文档', undefined, {
            collectionId,
            pagination: validatedQuery,
          });

          const paginatedDocs = await documentService.listDocumentsPaginated(
            validatedQuery,
            collectionId,
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
   * @api {get} /docs/:docId 获取指定的文�?
   * @apiGroup Documents
   * @apiDescription 根据文档 ID 获取单个文档�?
   * @apiParam {string} docId - 要获取的文档的唯一标识符�?
   * @apiSuccess {Doc} document - 找到的文档对象�?
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "id": "doc-xxxx",
   *       "name": "My Document",
   *       "collectionId": "coll-xxxx"
   *     }
   * @apiError (404 Not Found) DocumentNotFound - 如果找不到具有给�?ID 的文档�?
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

      apiLogger?.info('开始获取文档', undefined, {
        docId,
      });

      const doc = await documentService.getDocumentById(docId as DocId);

      apiLogger?.info('获取文档成功', undefined, {
        docId,
        fileName: doc?.name,
        duration: Date.now() - startTime,
      });

      // 统一错误处理中间件将处理未找到的情况
      res.status(200).json(doc);
    } catch (error) {
      apiLogger?.error('获取文档失败', undefined, {
        docId: req.params.docId,
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

      const updatedDoc = await documentService.resyncDocument(docId as DocId);

      apiLogger?.info('文档重新同步成功', undefined, {
        docId,
        fileName: updatedDoc.name,
        duration: Date.now() - startTime,
      });

      res.status(200).json(updatedDoc);
    } catch (error) {
      apiLogger?.error('文档重新同步失败', undefined, {
        docId: req.params.docId,
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
   * @api {get} /docs/:docId/chunks 获取文档的块列表
   * @apiGroup Documents
   * @apiDescription 根据文档ID获取该文档的所有块。支持分页参数
   * @apiParam {string} docId - 文档的唯一标识符
   * @apiParam {number} [page=1] - 页码，从1开始
   * @apiParam {number} [limit=20] - 每页数量，最多100
   * @apiParam {string} [sort=chunkIndex] - 排序字段
   * @apiParam {string} [order=asc] - 排序方向，asc或desc
   * @apiSuccess {Object} response - 分页响应对象
   * @apiSuccess {Object[]} response.data - 文档块数组
   * @apiSuccess {string} response.data.pointId - 块的点ID
   * @apiSuccess {string} response.data.docId - 文档ID
   * @apiSuccess {string} response.data.collectionId - 集合ID
   * @apiSuccess {number} response.data.chunkIndex - 块索引
   * @apiSuccess {string} response.data.title - 块标题（可选）
   * @apiSuccess {string} response.data.content - 块内容
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
   *         {
   *           "pointId": "doc-1_0",
   *           "docId": "doc-1",
   *           "collectionId": "coll-1",
   *           "chunkIndex": 0,
   *           "title": "Introduction",
   *           "content": "This is the first chunk..."
   *         }
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
  router.get('/docs/:docId/chunks', async (req: LoggedRequest, res) => {
    const startTime = Date.now();
    const apiLogger = req.logger?.withTag(LogTag.API);

    apiLogger?.info('开始获取文档块API请求', undefined, {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });

    try {
      const { docId } = req.params;

      apiLogger?.info('开始获取文档块', undefined, {
        docId,
      });

      // 检查是否提供了分页参数，如果没有则返回所有结果（向后兼容）
      const hasPaginationParams = req.query.page || req.query.limit;

      if (hasPaginationParams) {
        // 构建分页查询参数
        const paginationQuery = {
          page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
          limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
          sort: (req.query.sort as string) || 'chunkIndex',
          order: ((req.query.order as string) || 'asc') as 'asc' | 'desc',
        };

        apiLogger?.info('开始分页查询文档块', undefined, {
          docId,
          pagination: paginationQuery,
        });

        const paginatedChunks =
          await documentService.getDocumentChunksPaginated(
            docId as DocId,
            paginationQuery,
          );

        apiLogger?.info('分页查询文档块成功', undefined, {
          docId,
          count: paginatedChunks.data.length,
          total: paginatedChunks.pagination.total,
          duration: Date.now() - startTime,
        });

        res.status(200).json(paginatedChunks);
      } else {
        // 向后兼容：如果没有分页参数，返回所有结果
        apiLogger?.info('开始查询所有文档块（向后兼容）', undefined, {
          docId,
        });

        const chunks = await documentService.getDocumentChunks(docId as DocId);

        apiLogger?.info('查询所有文档块成功', undefined, {
          docId,
          count: chunks.length,
          duration: Date.now() - startTime,
        });

        res.status(200).json(chunks);
      }
    } catch (error) {
      apiLogger?.error('获取文档块失败', undefined, {
        docId: req.params.docId,
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
  });

  return router;
}
