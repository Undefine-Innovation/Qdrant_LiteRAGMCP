import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import { CollectionId, DocId } from '../../domain/types.js';
import { IImportService } from '../../domain/IImportService.js';
import { ICollectionService } from '../../domain/ICollectionService.js';
import { IDocumentService } from '../../domain/IDocumentService.js';
import { validate, ValidatedRequest } from '../../middlewares/validate.js';
import {
  UploadToCollectionSchema,
  UploadDocumentResponseSchema,
  ListDocsQuerySchema,
} from '../../api/contracts/document.js';
import { AppError } from '../../api/contracts/error.js';

/**
 * @function createDocumentRoutes
 * @description 创建文档相关的API路由
 * @param {IImportService} importService - 导入服务实例
 * @param {ICollectionService} collectionService - 集合服务实例
 * @param {IDocumentService} documentService - 文档服务实例
 * @returns {express.Router} 配置好的 Express 路由实例。
 */
export function createDocumentRoutes(
  importService: IImportService,
  collectionService: ICollectionService,
  documentService: IDocumentService,
): express.Router {
  const router = express.Router();

  // 配置multer用于文件上传
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB限制
    },
  });

  /**
   * @api {post} /collections/:collectionId/docs 上传文档到指定集合
   * @apiGroup Documents
   * @apiDescription 上传一个新文档到指定的集合，使用multipart/form-data格式。
   * @apiParam {string} collectionId - 目标集合的ID。
   * @apiParam (FormData) {File} file - 要上传的文档文件。
   * @apiSuccess {string} docId - 上传成功后返回的文档 ID。
   * @apiSuccess {string} name - 上传的文件名。
   * @apiSuccess {string} collectionId - 所属集合的 ID。
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
      >,
      res,
    ) => {
      if (!req.validated?.params || !req.file) {
        return res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: !req.file ? 'No file uploaded' : 'Invalid collection ID',
          },
        });
      }

      const { collectionId } = req.validated.params;

      // 检查文件大小限制
      if (req.file.size > 10 * 1024 * 1024) {
        // 10MB
        throw AppError.createFileTooLargeError(
          'File size exceeds the maximum limit of 10MB',
        );
      }

      // 检查文件类型
      const allowedMimeTypes = [
        'text/plain',
        'text/markdown',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];

      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        throw AppError.createUnsupportedFileTypeError(
          `File type ${req.file.mimetype} is not supported. Supported types: ${allowedMimeTypes.join(', ')}`,
        );
      }

      const doc = await importService.importUploadedFile(
        req.file,
        collectionId as CollectionId,
      );

      const response = {
        docId: doc.docId,
        name: doc.name,
        collectionId: doc.collectionId,
      };

      // 验证响应格式
      const validatedResponse = UploadDocumentResponseSchema.parse(response);
      res.status(201).json(validatedResponse);
    },
  );

  /**
   * @api {post} /upload 上传文档到默认集合
   * @apiGroup Documents
   * @apiDescription 上传一个新文档，使用multipart/form-data格式，自动添加到默认集合。
   * @apiParam (FormData) {File} file - 要上传的文档文件。
   * @apiSuccess {string} docId - 上传成功后返回的文档 ID。
   * @apiSuccess {string} name - 上传的文件名。
   * @apiSuccess {string} collectionId - 所属集合的 ID。
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 201 Created
   *     {
   *       "docId": "doc-xxxx",
   *       "name": "document.pdf",
   *       "collectionId": "coll-xxxx"
   *     }
   */
  router.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No file uploaded',
        },
      });
    }

    // 检查文件大小限制
    if (req.file.size > 10 * 1024 * 1024) {
      // 10MB
      throw AppError.createFileTooLargeError(
        'File size exceeds the maximum limit of 10MB',
      );
    }

    // 检查文件类型
    const allowedMimeTypes = [
      'text/plain',
      'text/markdown',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      throw AppError.createUnsupportedFileTypeError(
        `File type ${req.file.mimetype} is not supported. Supported types: ${allowedMimeTypes.join(', ')}`,
      );
    }

    // 根据OpenAPI规范，不需要collectionId，使用默认集合
    // 先尝试获取或创建默认集合
    const collections = await collectionService.listAllCollections();
    let defaultCollection = collections.find((c) => c.name === 'default');

    if (!defaultCollection) {
      defaultCollection = collectionService.createCollection(
        'default',
        'Default collection for uploads',
      );
    }

    const doc = await importService.importUploadedFile(
      req.file,
      defaultCollection.collectionId,
    );

    const response = {
      docId: doc.docId,
      name: doc.name,
      collectionId: doc.collectionId,
    };

    // 验证响应格式
    const validatedResponse = UploadDocumentResponseSchema.parse(response);
    res.status(201).json(validatedResponse);
  });

  /**
   * @api {post} /docs 导入新文档 (已弃用)
   * @apiGroup Documents
   * @apiDescription 从文件路径导入一个新文档到指定的 Collection。此端点已弃用，请使用 /upload。
   * @apiBody {string} filePath - 文档源文件的路径。
   * @apiBody {string} collectionId - 文档所属 Collection 的 ID。
   * @apiSuccess {Doc} document - 导入成功的文档对象。
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 201 Created
   *     {
   *       "id": "doc-xxxx",
   *       "name": "My Document",
   *       "collectionId": "coll-xxxx"
   *     }
   */
  router.post('/docs', async (req, res) => {
    // TODO: 添加验证中间件
    const { filePath, collectionId } = req.body;
    const doc = await importService.importDocument(
      filePath,
      collectionId as CollectionId,
    );
    res.status(201).json(doc);
  });

  /**
   * @api {get} /docs 列出所有文档
   * @apiGroup Documents
   * @apiDescription 获取所有文档的列表。支持分页参数和集合过滤。
   * @apiParam {number} [page=1] - 页码，从1开始。
   * @apiParam {number} [limit=20] - 每页数量，最大100。
   * @apiParam {string} [sort=created_at] - 排序字段。
   * @apiParam {string} [order=desc] - 排序方向，asc或desc。
   * @apiParam {string} [collectionId] - 可选的集合ID，用于过滤特定集合的文档。
   * @apiSuccess {Object} response - 分页响应对象。
   * @apiSuccess {Doc[]} response.data - 文档对象的数组。
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
      req: ValidatedRequest<unknown, z.infer<typeof ListDocsQuerySchema>>,
      res,
    ) => {
      const validatedQuery = req.validated?.query;
      if (!validatedQuery) {
        return res.status(400).json({ error: 'Invalid query parameters' });
      }

      // 检查是否提供了分页参数，如果没有则返回所有结果（向后兼容）
      const hasPaginationParams = req.query.page || req.query.limit;

      if (hasPaginationParams) {
        const collectionId = validatedQuery.collectionId as
          | CollectionId
          | undefined;
        const paginatedDocs = documentService.listDocumentsPaginated(
          validatedQuery,
          collectionId,
        );
        res.status(200).json(paginatedDocs);
      } else {
        // 向后兼容：如果没有分页参数，返回所有结果
        const docs = documentService.listAllDocuments();
        res.status(200).json(docs);
      }
    },
  );

  /**
   * @api {get} /docs/:docId 获取指定的文档
   * @apiGroup Documents
   * @apiDescription 根据文档 ID 获取单个文档。
   * @apiParam {string} docId - 要获取的文档的唯一标识符。
   * @apiSuccess {Doc} document - 找到的文档对象。
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "id": "doc-xxxx",
   *       "name": "My Document",
   *       "collectionId": "coll-xxxx"
   *     }
   * @apiError (404 Not Found) DocumentNotFound - 如果找不到具有给定 ID 的文档。
   */
  router.get('/docs/:docId', async (req, res) => {
    const { docId } = req.params;
    const doc = documentService.getDocumentById(docId as DocId);
    // 统一错误处理中间件将处理未找到的情况
    res.status(200).json(doc);
  });

  /**
   * @api {put} /docs/:docId/resync 重新同步文档
   * @apiGroup Documents
   * @apiDescription 根据文档 ID 重新同步文档内容（从其源文件）。
   * @apiParam {string} docId - 要重新同步的文档的唯一标识符。
   * @apiSuccess {Doc} document - 更新后的文档对象。
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "id": "doc-xxxx",
   *       "name": "My Document (Updated)",
   *       "collectionId": "coll-xxxx"
   *     }
   */
  router.put('/docs/:docId/resync', async (req, res) => {
    const { docId } = req.params;
    const updatedDoc = await documentService.resyncDocument(docId as DocId);
    res.status(200).json(updatedDoc);
  });

  /**
   * @api {delete} /docs/:docId 删除文档
   * @apiGroup Documents
   * @apiDescription 根据文档 ID 删除文档。
   * @apiParam {string} docId - 要删除的文档的唯一标识符。
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 204 No Content
   */
  router.delete('/docs/:docId', async (req, res) => {
    const { docId } = req.params;
    await documentService.deleteDocument(docId as DocId);
    res.status(204).end();
  });

  /**
   * @api {get} /docs/:docId/chunks 获取文档的块列表
   * @apiGroup Documents
   * @apiDescription 根据文档ID获取该文档的所有块。支持分页参数。
   * @apiParam {string} docId - 文档的唯一标识符。
   * @apiParam {number} [page=1] - 页码，从1开始。
   * @apiParam {number} [limit=20] - 每页数量，最大100。
   * @apiParam {string} [sort=chunkIndex] - 排序字段。
   * @apiParam {string} [order=asc] - 排序方向，asc或desc。
   * @apiSuccess {Object} response - 分页响应对象。
   * @apiSuccess {Object[]} response.data - 文档块数组。
   * @apiSuccess {string} response.data.pointId - 块的点ID。
   * @apiSuccess {string} response.data.docId - 文档ID。
   * @apiSuccess {string} response.data.collectionId - 集合ID。
   * @apiSuccess {number} response.data.chunkIndex - 块索引。
   * @apiSuccess {string} response.data.title - 块标题（可选）。
   * @apiSuccess {string} response.data.content - 块内容。
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
  router.get('/docs/:docId/chunks', async (req, res) => {
    const { docId } = req.params;

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

      const paginatedChunks = documentService.getDocumentChunksPaginated(
        docId as DocId,
        paginationQuery,
      );
      res.status(200).json(paginatedChunks);
    } else {
      // 向后兼容：如果没有分页参数，返回所有结果
      const chunks = documentService.getDocumentChunks(docId as DocId);
      res.status(200).json(chunks);
    }
  });

  return router;
}
