import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { IBatchService } from '@application/services/index.js';
import { validate, ValidatedRequest } from '@middleware/validate.js';
import {
  BatchUploadRequestSchema,
  BatchUploadResponseSchema,
  BatchDeleteDocsRequestSchema,
  BatchDeleteDocsResponseSchema,
  BatchDeleteCollectionsRequestSchema,
  BatchDeleteCollectionsResponseSchema,
  BatchOperationQuerySchema,
  BatchOperationProgressSchema,
  BatchOperationListQuerySchema,
} from '@api/contracts/batch.js';
import { AppError } from '@api/contracts/error.js';
import { DocId, CollectionId } from '@domain/entities/types.js';
import {
  FILE_CONSTANTS,
  FILE_SIZE_LIMITS,
} from '@domain/constants/FileConstants.js';

/**
 * Maximum number of files allowed in batch upload
 */
const MAX_FILES = FILE_CONSTANTS.MAX_FILES;

/**
 * Maximum number of document IDs allowed in batch delete
 */
const MAX_DOC_DELETE_IDS = FILE_CONSTANTS.MAX_DOC_DELETE_IDS;

/**
 * 创建批量操作相关的API路由
 *
 * @param batchService - 批量操作服务实例
 * @returns 配置好的 Express 路由实例
 */
export function createBatchRoutes(batchService: IBatchService): express.Router {
  const router = express.Router();

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: FILE_SIZE_LIMITS.MAX_UPLOAD_SIZE,
      files: MAX_FILES,
    },
  });

  const uploadFiles = (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    upload.array('files', MAX_FILES)(req, res, (error) => {
      if (error) {
        if (error instanceof multer.MulterError) {
          if (
            error.code === 'LIMIT_FILE_SIZE' ||
            error.code === 'LIMIT_FILE_COUNT'
          ) {
            return res.status(413).json({
              error: {
                code: 'PAYLOAD_TOO_LARGE',
                message: 'Batch upload exceeded the maximum allowed payload',
              },
            });
          }
          return next(
            AppError.createInternalServerError('File upload failed.', {
              reason: error.code,
            }),
          );
        }
        return next(error);
      }
      next();
    });
  };

  const sendValidationError = (res: Response, message: string) =>
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message,
      },
    });

  const sendPayloadTooLarge = (res: Response, message: string) =>
    res.status(413).json({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message,
      },
    });

  /**
   * @api {post} /upload/batch 批量上传文档
   * @apiGroup Batch Operations
   * @apiDescription 批量上传多个文档到指定集合或默认集合，使用multipart/form-data格式
   * @apiParam (FormData) {File[]} files - 要上传的文档文件数组
   * @apiParam (FormData) {string} [collectionId] - 目标集合的ID（可选）
   * @apiSuccess {boolean} success - 批量上传是否成功
   * @apiSuccess {number} total - 总文件数量
   * @apiSuccess {number} successful - 成功上传的文件数量
   * @apiSuccess {number} failed - 上传失败的文件数量
   * @apiSuccess {Object[]} results - 每个文件的上传结果
   * @apiSuccess {string} results.fileName - 文件名
   * @apiSuccess {string} [results.docId] - 上传成功后返回的文档 ID
   * @apiSuccess {string} [results.collectionId] - 所属集合的 ID
   * @apiSuccess {string} [results.error] - 上传失败时的错误信息
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "success": true,
   *       "total": 3,
   *       "successful": 2,
   *       "failed": 1,
   *       "results": [
   *         {
   *           "fileName": "document1.pdf",
   *           "docId": "doc-xxxx",
   *           "collectionId": "coll-xxxx"
   *         },
   *         {
   *           "fileName": "document2.txt",
   *           "docId": "doc-yyyy",
   *           "collectionId": "coll-xxxx"
   *         },
   *         {
   *           "fileName": "document3.exe",
   *           "error": "File type application/octet-stream is not supported"
   *         }
   *       ]
   *     }
   */
  router.post(
    '/batch/upload',
    uploadFiles,
    validate({ body: BatchUploadRequestSchema }),
    async (
      req: ValidatedRequest<unknown, z.infer<typeof BatchUploadRequestSchema>>,
      res,
    ) => {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return sendValidationError(res, 'No files uploaded');
      }

      if (req.files.length > MAX_FILES) {
        return sendPayloadTooLarge(
          res,
          `Too many files uploaded (max ${MAX_FILES})`,
        );
      }

      const validatedBody = (req.validated?.body as {
        collectionId?: string;
      }) || { collectionId: undefined };

      let resolvedCollectionId = validatedBody.collectionId;
      const rawBody = req.body as Record<string, unknown>;
      if (
        (!resolvedCollectionId || resolvedCollectionId.trim().length === 0) &&
        typeof rawBody?.collectionId === 'string'
      ) {
        resolvedCollectionId = rawBody.collectionId;
      }

      const normalizedCollectionId =
        resolvedCollectionId && resolvedCollectionId.trim().length > 0
          ? (resolvedCollectionId.trim() as CollectionId)
          : undefined;

      try {
        const result = await batchService.batchUploadDocuments(
          req.files,
          normalizedCollectionId,
        );

        // 验证响应格式
        const validatedResponse = BatchUploadResponseSchema.parse(result);
        res.status(200).json(validatedResponse);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        if (error instanceof Error) {
          throw AppError.createInternalServerError(
            `Batch upload failed: ${error.message}`,
          );
        }
        throw error;
      }
    },
  );

  /**
   * @api {delete} /docs/batch 批量删除文档
   * @apiGroup Batch Operations
   * @apiDescription 批量删除多个文档
   * @apiBody {string[]} docIds - 要删除的文档ID列表
   * @apiSuccess {boolean} success - 批量删除是否成功
   * @apiSuccess {number} total - 总文档数量
   * @apiSuccess {number} successful - 成功删除的文档数量
   * @apiSuccess {number} failed - 删除失败的文档数量
   * @apiSuccess {Object[]} results - 每个文档的删除结果
   * @apiSuccess {string} results.docId - 文档ID
   * @apiSuccess {boolean} results.success - 删除是否成功
   * @apiSuccess {string} [results.error] - 删除失败时的错误信息
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "success": true,
   *       "total": 2,
   *       "successful": 2,
   *       "failed": 0,
   *       "results": [
   *         {
   *           "docId": "doc-xxxx",
   *           "success": true
   *         },
   *         {
   *           "docId": "doc-yyyy",
   *           "success": true
   *         }
   *       ]
   *     }
   */
  router.delete(
    '/docs/batch',
    validate({ body: BatchDeleteDocsRequestSchema }),
    async (
      req: ValidatedRequest<
        z.infer<typeof BatchDeleteDocsRequestSchema>,
        unknown
      >,
      res,
    ) => {
      const { docIds } = req.validated?.body || { docIds: [] };

      if ((docIds?.length ?? 0) > MAX_DOC_DELETE_IDS) {
        return sendPayloadTooLarge(
          res,
          `Cannot delete more than ${MAX_DOC_DELETE_IDS} documents in a single request`,
        );
      }

      // 验证docId格式
      if (docIds && docIds.length > 0) {
        for (const docId of docIds) {
          if (!docId || typeof docId !== 'string' || docId.trim() === '') {
            return sendValidationError(res, 'Invalid document ID format');
          }
        }
      }

      try {
        const result = await batchService.batchDeleteDocuments(
          (docIds || []) as DocId[],
        );

        // 验证响应格式
        const validatedResponse = BatchDeleteDocsResponseSchema.parse(result);
        res.status(200).json(validatedResponse);
      } catch (error) {
        if (error instanceof AppError) {
          return res.status(error.httpStatus || 500).json({
            error: {
              code: error.code || 'INTERNAL_ERROR',
              message: error.message,
            },
          });
        }
        if (error instanceof Error) {
          return res.status(500).json({
            error: {
              code: 'INTERNAL_ERROR',
              message: `Batch delete documents failed: ${error.message}`,
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
   * @api {delete} /collections/batch 批量删除集合
   * @apiGroup Batch Operations
   * @apiDescription 批量删除多个集合及其所有相关文档和块
   * @apiBody {string[]} collectionIds - 要删除的集合ID列表
   * @apiSuccess {boolean} success - 批量删除是否成功
   * @apiSuccess {number} total - 总集合数量
   * @apiSuccess {number} successful - 成功删除的集合数量
   * @apiSuccess {number} failed - 删除失败的集合数量
   * @apiSuccess {Object[]} results - 每个集合的删除结果
   * @apiSuccess {string} results.collectionId - 集合ID
   * @apiSuccess {boolean} results.success - 删除是否成功
   * @apiSuccess {string} [results.error] - 删除失败时的错误信息
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "success": true,
   *       "total": 2,
   *       "successful": 2,
   *       "failed": 0,
   *       "results": [
   *         {
   *           "collectionId": "coll-xxxx",
   *           "success": true
   *         },
   *         {
   *           "collectionId": "coll-yyyy",
   *           "success": true
   *         }
   *       ]
   *     }
   */
  router.delete(
    '/collections/batch',
    validate({ body: BatchDeleteCollectionsRequestSchema }),
    async (
      req: ValidatedRequest<
        z.infer<typeof BatchDeleteCollectionsRequestSchema>,
        unknown
      >,
      res,
    ) => {
      const { collectionIds } = req.validated?.body || { collectionIds: [] };

      try {
        const result = await batchService.batchDeleteCollections(
          (collectionIds || []) as CollectionId[],
        );

        // 验证响应格式
        const validatedResponse =
          BatchDeleteCollectionsResponseSchema.parse(result);
        res.status(200).json(validatedResponse);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        if (error instanceof Error) {
          throw AppError.createInternalServerError(
            `Batch delete collections failed: ${error.message}`,
          );
        }
        throw error;
      }
    },
  );

  /**

   * @api {get} /batch/progress 获取批处理进度

   * @apiGroup Batch Operations

   * @apiDescription 获取指定批处理操作的进度信息

   * @apiParam {string} operationId - 操作ID

   */

  router.get(
    '/batch/progress/:operationId',

    validate({ params: BatchOperationQuerySchema }),

    async (
      req: ValidatedRequest<
        unknown,
        unknown,
        z.infer<typeof BatchOperationQuerySchema>
      >,

      res,
    ) => {
      const { operationId } = req.validated?.params || { operationId: '' };

      try {
        const progress =
          await batchService.getBatchOperationProgress(operationId);

        if (!progress) {
          return res.status(404).json({
            error: {
              code: 'NOT_FOUND',
              message: 'Operation not found or expired',
            },
          });
        }

        const validatedResponse = BatchOperationProgressSchema.parse(progress);

        res.status(200).json(validatedResponse);
      } catch (error) {
        if (error instanceof AppError) {
          return res.status(error.httpStatus || 500).json({
            error: {
              code: error.code || 'INTERNAL_ERROR',
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

   * @api {get} /batch/list 获取批处理任务列表

   * @apiGroup Batch Operations

   * @apiDescription 支持按状态过滤批处理任务

   */

  router.get(
    '/batch/list',

    validate({ query: BatchOperationListQuerySchema }),

    async (
      req: ValidatedRequest<
        unknown,
        z.infer<typeof BatchOperationListQuerySchema>
      >,

      res,
    ) => {
      try {
        const status = req.validated?.query?.status;

        const tasks = await batchService.getBatchOperationList(status);

        res.status(200).json(tasks);
      } catch (error) {
        if (error instanceof AppError) {
          return res.status(error.httpStatus || 500).json({
            error: {
              code: error.code || 'INTERNAL_ERROR',
              message: error.message,
            },
          });
        }

        if (error instanceof Error) {
          return res.status(500).json({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Failed to get batch operation list: ' + error.message,
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

  return router;
}
