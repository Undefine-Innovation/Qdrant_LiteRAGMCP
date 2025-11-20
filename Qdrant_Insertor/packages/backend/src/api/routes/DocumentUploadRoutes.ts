import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import { CollectionId } from '@domain/entities/types.js';
import { ICollectionService } from '@application/services/index.js';
import type { IImportAndIndexUseCase } from '@application/use-cases/index.js';
import { validate, ValidatedRequest } from '@middleware/validate.js';
import { LoggedRequest } from '@middleware/logging.js';
import { LogTag } from '@logging/logger.js';
import {
  UploadToCollectionSchema,
  UploadDocumentResponseSchema,
} from '@api/contracts/document.js';
import { AppError } from '@api/contracts/error.js';
import {
  FILE_SIZE_LIMITS,
  SUPPORTED_MIME_TYPES,
} from '@domain/constants/FileConstants.js';

/**
 * 创建文档上传相关的API路由
 *
 * @param collectionService - 集合服务实例
 * @param importAndIndexUseCase - 导入并索引用例实例
 * @returns 配置好的 Express 路由实例
 */
export function createDocumentUploadRoutes(
  collectionService: ICollectionService,
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
   * @api {post} /collections/:collectionId/docs 上传文档到指定集合
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

      // 验证集合是否存在
      const collection = await collectionService.getCollectionById(
        collectionId as CollectionId,
      );
      if (!collection) {
        apiLogger?.warn('集合不存在', undefined, {
          collectionId,
        });
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `Collection with ID ${collectionId} not found`,
          },
        });
      }

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
      const fileMime = req.file
        .mimetype as (typeof SUPPORTED_MIME_TYPES)[number];

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

      // 使用用例层执行导入和索引流程（将文件内容解码为文本并传递给用例）
      const fileContent = req.file.buffer.toString('utf-8');

      // 验证文件内容不为空
      if (!fileContent || fileContent.trim() === '') {
        apiLogger?.warn('文件内容为空', undefined, {
          fileName: req.file.originalname,
        });
        return res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'File content cannot be empty',
          },
        });
      }

      const useCaseResult = await importAndIndexUseCase.execute({
        content: fileContent,
        title: req.file.originalname,
        collectionId: collectionId as CollectionId,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
      });

      const doc = useCaseResult.doc;

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
   * @api {post} /upload 上传文档到默认集合
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
        const fileMime = req.file
          .mimetype as (typeof SUPPORTED_MIME_TYPES)[number];

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
          return res.status(422).json({
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

        // 使用用例层执行导入和索引流程（将文件内容解码为文本并传递给用例）
        const fileContent = req.file.buffer.toString('utf-8');

        // 验证文件内容不为空
        if (!fileContent || fileContent.trim() === '') {
          apiLogger?.warn('文件内容为空', undefined, {
            fileName: req.file.originalname,
          });
          return res.status(422).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'File content cannot be empty',
            },
          });
        }

        const useCaseResult = await importAndIndexUseCase.execute({
          content: fileContent,
          title: req.file.originalname,
          collectionId,
          fileName: req.file.originalname,
          mimeType: req.file.mimetype,
        });

        const doc = useCaseResult.doc;

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

  return router;
}
