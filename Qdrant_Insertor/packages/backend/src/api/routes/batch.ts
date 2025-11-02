import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import { IBatchService } from '@domain/repositories/IBatchService.js';
import { validate, ValidatedRequest } from '../../middlewares/validate.js';
import {
  BatchUploadRequestSchema,
  BatchUploadResponseSchema,
  BatchDeleteDocsRequestSchema,
  BatchDeleteDocsResponseSchema,
  BatchDeleteCollectionsRequestSchema,
  BatchDeleteCollectionsResponseSchema,
  BatchOperationQuerySchema,
  BatchOperationProgressSchema,
} from '@api/contracts/batch.js';
import { AppError } from '@api/contracts/error.js';
import { DocId, CollectionId } from '@domain/entities/types.js';

/**
 * 创建批量操作相关的API路由
 *
 * @param batchService - 批量操作服务实例
 * @returns 配置好的 Express 路由实例
 */
export function createBatchRoutes(batchService: IBatchService): express.Router {
  const router = express.Router();

  // 配置multer用于批量文件上传
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB限制
      files: 50, // 最多50个文件
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
    upload.array('files', 50), // 最多50个文件
    validate({ body: BatchUploadRequestSchema }),
    async (
      req: ValidatedRequest<unknown, z.infer<typeof BatchUploadRequestSchema>>,
      res,
    ) => {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'No files uploaded',
          },
        });
      }

      const { collectionId } = req.validated?.body as { collectionId?: CollectionId } || { collectionId: undefined };

      try {
        const result = await batchService.batchUploadDocuments(
          req.files,
          collectionId,
        );

        // 验证响应格式
        const validatedResponse = BatchUploadResponseSchema.parse(result);
        res.status(200).json(validatedResponse);
      } catch (error) {
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

      try {
        const result = await batchService.batchDeleteDocuments((docIds || []) as DocId[]);

        // 验证响应格式
        const validatedResponse = BatchDeleteDocsResponseSchema.parse(result);
        res.status(200).json(validatedResponse);
      } catch (error) {
        if (error instanceof Error) {
          throw AppError.createInternalServerError(
            `Batch delete documents failed: ${error.message}`,
          );
        }
        throw error;
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
        const result = await batchService.batchDeleteCollections((collectionIds || []) as CollectionId[]);

        // 验证响应格式
        const validatedResponse =
          BatchDeleteCollectionsResponseSchema.parse(result);
        res.status(200).json(validatedResponse);
      } catch (error) {
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
   * @api {get} /batch/progress 获取批量操作进度
   * @apiGroup Batch Operations
   * @apiDescription 获取指定批量操作的进度信息
   * @apiParam {string} operationId - 操作ID
   * @apiSuccess {string} operationId - 操作ID
   * @apiSuccess {string} type - 操作类型（upload或delete）
   * @apiSuccess {string} status - 操作状态（pending、processing、completed或failed）
   * @apiSuccess {number} total - 总项目数量
   * @apiSuccess {number} processed - 已处理的项目数量
   * @apiSuccess {number} successful - 成功的项目数量
   * @apiSuccess {number} failed - 失败的项目数量
   * @apiSuccess {number} startTime - 开始时间戳
   * @apiSuccess {number} [endTime] - 结束时间戳
   * @apiSuccess {number} [estimatedTimeRemaining] - 预估剩余时间（秒）
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "operationId": "uuid-xxxx",
   *       "type": "upload",
   *       "status": "processing",
   *       "total": 10,
   *       "processed": 6,
   *       "successful": 5,
   *       "failed": 1,
   *       "startTime": 1640995200000,
   *       "estimatedTimeRemaining": 30
   *     }
   */
  router.get('/progress/:operationId', async (req, res) => {
    const { operationId } = req.params;

    if (!operationId) {
      return res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Operation ID is required',
        },
      });
    }

    const progress = await batchService.getBatchOperationProgress(operationId);

    if (!progress) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Operation not found or expired',
        },
      });
    }

    // 验证响应格式
    const validatedResponse = BatchOperationProgressSchema.parse(progress);
    res.status(200).json(validatedResponse);
  });

  /**
   * @api {get} /batch/list 获取批量操作任务列表
   * @apiGroup Batch Operations
   * @apiDescription 获取批量操作任务列表，支持按状态过滤
   * @apiParam {string} [status] - 状态过滤器（pending, processing, completed, failed）
   * @apiSuccess {Object[]} tasks - 任务列表
   * @apiSuccess {string} tasks.id - 任务ID
   * @apiSuccess {string} tasks.taskType - 任务类型
   * @apiSuccess {string} tasks.status - 任务状态
   * @apiSuccess {number} tasks.progress - 进度百分比
   * @apiSuccess {number} tasks.createdAt - 创建时间戳
   * @apiSuccess {number} tasks.updatedAt - 更新时间戳
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     [
   *       {
   *         "id": "batch-upload-uuid-12345",
   *         "taskType": "batch_upload",
   *         "status": "processing",
   *         "progress": 45,
   *         "createdAt": 1640995200000,
   *         "updatedAt": 1640995260000
   *       }
   *     ]
   */
  router.get('/list', async (req, res) => {
    const { status } = req.query;

    try {
      const tasks = await batchService.getBatchOperationList(status as string);
      res.status(200).json(tasks);
    } catch (error) {
      if (error instanceof Error) {
        throw AppError.createInternalServerError(
          `Failed to get batch operation list: ${error.message}`,
        );
      }
      throw error;
    }
  });

  return router;
}