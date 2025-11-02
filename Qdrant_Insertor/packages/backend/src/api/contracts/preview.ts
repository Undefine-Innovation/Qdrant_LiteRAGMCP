import { z } from 'zod';

/**
 * 文档预览查询参数的Schema
 * 用于验证 `GET /docs/:docId/preview` 的查询参数
 */
export const DocumentPreviewQuerySchema = z.object({
  format: z
    .enum(['html', 'text', 'json'])
    .optional()
    .default('text')
    .describe('预览格式，默认为text'),
});

/**
 * 文档下载查询参数的Schema
 * 用于验证 `GET /docs/:docId/download` 的查询参数
 */
export const DocumentDownloadQuerySchema = z.object({
  format: z
    .enum(['original', 'html', 'txt'])
    .optional()
    .default('original')
    .describe('下载格式，默认为original'),
});

/**
 * 文档缩略图查询参数的Schema
 * 用于验证 `GET /docs/:docId/thumbnail` 的查询参数
 */
export const DocumentThumbnailQuerySchema = z.object({
  width: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 200))
    .refine((val) => val > 0 && val <= 1000, {
      message: '宽度必须在1-1000之间',
    })
    .describe('缩略图宽度，默认为200'),
  height: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 200))
    .refine((val) => val > 0 && val <= 1000, {
      message: '高度必须在1-1000之间',
    })
    .describe('缩略图高度，默认为200'),
});

/**
 * 文档预览响应的Schema
 */
export const DocumentPreviewResponseSchema = z.object({
  content: z.string().describe('预览内容'),
  mimeType: z.string().describe('内容MIME类型'),
  format: z.string().describe('响应格式'),
});

/**
 * 文件格式信息的Schema
 */
export const FileFormatInfoSchema = z.object({
  mimeType: z.string().describe('文件MIME类型'),
  extension: z.string().describe('文件扩展名'),
  category: z
    .enum(['text', 'markdown', 'pdf', 'word', 'unknown'])
    .describe('文件类别'),
});

/**
 * 文件格式信息响应的Schema
 */
export const FileFormatInfoResponseSchema = z.object({
  format: FileFormatInfoSchema.describe('文件格式信息'),
});
