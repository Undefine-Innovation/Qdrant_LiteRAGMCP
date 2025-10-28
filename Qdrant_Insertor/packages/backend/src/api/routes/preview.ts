import express from 'express';
import { z } from 'zod';
import { DocId } from '../../domain/types.js';
import { IFileProcessingService } from '../../domain/IFileProcessingService.js';
import { validate, ValidatedRequest } from '../../middlewares/validate.js';
import { DocIdParamsSchema } from '../../api/contracts/document.js';
import {
  DocumentPreviewQuerySchema,
  DocumentDownloadQuerySchema,
  DocumentThumbnailQuerySchema,
  DocumentPreviewResponseSchema,
  FileFormatInfoResponseSchema,
} from '../../api/contracts/preview.js';
import { AppError } from '../../api/contracts/error.js';

/**
 * @function createPreviewRoutes
 * @description 创建文档预览与下载相关的API路由
 * @param {IFileProcessingService} fileProcessingService - 文件处理服务实例
 * @returns {express.Router} 配置好的 Express 路由实例。
 */
export function createPreviewRoutes(
  fileProcessingService: IFileProcessingService,
): express.Router {
  const router = express.Router();

  /**
   * @api {get} /docs/:docId/preview 获取文档预览
   * @apiGroup Documents
   * @apiDescription 获取文档的预览内容，支持多种格式。
   * @apiParam {string} docId - 文档的唯一标识符。
   * @apiParam {string} [format=text] - 预览格式，可选值：html, text, json。
   * @apiSuccess {string} content - 预览内容。
   * @apiSuccess {string} mimeType - 内容MIME类型。
   * @apiSuccess {string} format - 响应格式。
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "content": "<html>...</html>",
   *       "mimeType": "text/html",
   *       "format": "html"
   *     }
   * @apiError (404 Not Found) DocumentNotFound - 如果找不到具有给定 ID 的文档。
   */
  router.get(
    '/docs/:docId/preview',
    validate({
      params: DocIdParamsSchema,
      query: DocumentPreviewQuerySchema,
    }),
    async (
      req: ValidatedRequest<
        unknown,
        z.infer<typeof DocumentPreviewQuerySchema>,
        z.infer<typeof DocIdParamsSchema>
      >,
      res,
    ) => {
      if (!req.validated?.params || !req.validated?.query) {
        return res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
          },
        });
      }

      const { docId } = req.validated.params;
      const { format } = req.validated.query;

      try {
        const previewContent = await fileProcessingService.getPreviewContent(
          docId as DocId,
          format,
        );

        // 验证响应格式
        const validatedResponse =
          DocumentPreviewResponseSchema.parse(previewContent);

        // 设置适当的Content-Type头
        res.setHeader('Content-Type', validatedResponse.mimeType);
        res.status(200).json(validatedResponse);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw AppError.createInternalServerError(
          `Failed to generate preview for document ${docId}`,
          { originalError: error },
        );
      }
    },
  );

  /**
   * @api {get} /docs/:docId/download 下载文档
   * @apiGroup Documents
   * @apiDescription 下载文档，支持原始格式或转换后的格式。
   * @apiParam {string} docId - 文档的唯一标识符。
   * @apiParam {string} [format=original] - 下载格式，可选值：original, html, txt。
   * @apiSuccess {file} file - 文档文件。
   * @apiError (404 Not Found) DocumentNotFound - 如果找不到具有给定 ID 的文档。
   */
  router.get(
    '/docs/:docId/download',
    validate({
      params: DocIdParamsSchema,
      query: DocumentDownloadQuerySchema,
    }),
    async (
      req: ValidatedRequest<
        unknown,
        z.infer<typeof DocumentDownloadQuerySchema>,
        z.infer<typeof DocIdParamsSchema>
      >,
      res,
    ) => {
      if (!req.validated?.params || !req.validated?.query) {
        return res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
          },
        });
      }

      const { docId } = req.validated.params;
      const { format } = req.validated.query;

      try {
        const downloadContent = await fileProcessingService.getDownloadContent(
          docId as DocId,
          format,
        );

        // 设置适当的响应头
        res.setHeader('Content-Type', downloadContent.mimeType);
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${encodeURIComponent(downloadContent.filename)}"`,
        );

        // 如果内容是Buffer，直接发送；否则转换为Buffer
        const content = Buffer.isBuffer(downloadContent.content)
          ? downloadContent.content
          : Buffer.from(downloadContent.content);

        res.status(200).send(content);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw AppError.createInternalServerError(
          `Failed to prepare download for document ${docId}`,
          { originalError: error },
        );
      }
    },
  );

  /**
   * @api {get} /docs/:docId/thumbnail 获取文档缩略图
   * @apiGroup Documents
   * @apiDescription 获取文档的缩略图。
   * @apiParam {string} docId - 文档的唯一标识符。
   * @apiParam {number} [width=200] - 缩略图宽度。
   * @apiParam {number} [height=200] - 缩略图高度。
   * @apiSuccess {image} image - 缩略图图像。
   * @apiError (404 Not Found) DocumentNotFound - 如果找不到具有给定 ID 的文档。
   */
  router.get(
    '/docs/:docId/thumbnail',
    validate({
      params: DocIdParamsSchema,
      query: DocumentThumbnailQuerySchema,
    }),
    async (
      req: ValidatedRequest<
        unknown,
        z.infer<typeof DocumentThumbnailQuerySchema>,
        z.infer<typeof DocIdParamsSchema>
      >,
      res,
    ) => {
      if (!req.validated?.params || !req.validated?.query) {
        return res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
          },
        });
      }

      const { docId } = req.validated.params;
      const { width, height } = req.validated.query;

      try {
        const thumbnailPath = await fileProcessingService.generateThumbnail(
          docId as DocId,
          { width, height },
        );

        // 发送缩略图文件
        res.sendFile(thumbnailPath, (err) => {
          if (err) {
            throw AppError.createInternalServerError(
              `Failed to send thumbnail for document ${docId}`,
              { originalError: err },
            );
          }
        });
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw AppError.createInternalServerError(
          `Failed to generate thumbnail for document ${docId}`,
          { originalError: error },
        );
      }
    },
  );

  /**
   * @api {get} /docs/:docId/format 获取文档格式信息
   * @apiGroup Documents
   * @apiDescription 获取文档的格式信息。
   * @apiParam {string} docId - 文档的唯一标识符。
   * @apiSuccess {object} format - 文件格式信息。
   * @apiSuccess {string} format.mimeType - 文件MIME类型。
   * @apiSuccess {string} format.extension - 文件扩展名。
   * @apiSuccess {string} format.category - 文件类别。
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "format": {
   *         "mimeType": "text/markdown",
   *         "extension": ".md",
   *         "category": "markdown"
   *       }
   *     }
   * @apiError (404 Not Found) DocumentNotFound - 如果找不到具有给定 ID 的文档。
   */
  router.get(
    '/docs/:docId/format',
    validate({ params: DocIdParamsSchema }),
    async (
      req: ValidatedRequest<
        unknown,
        unknown,
        z.infer<typeof DocIdParamsSchema>
      >,
      res,
    ) => {
      if (!req.validated?.params) {
        return res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
          },
        });
      }

      const { docId } = req.validated.params;

      try {
        const formatInfo = await fileProcessingService.detectFileFormat(
          docId as DocId,
        );

        // 验证响应格式
        const validatedResponse = FileFormatInfoResponseSchema.parse({
          format: formatInfo,
        });
        res.status(200).json(validatedResponse);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw AppError.createInternalServerError(
          `Failed to detect format for document ${docId}`,
          { originalError: error },
        );
      }
    },
  );

  return router;
}
