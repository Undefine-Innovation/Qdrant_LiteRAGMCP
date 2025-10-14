import { z } from 'zod';

// 定义 ChunkDTO 的 Zod Schema
export const ChunkDTOSchema = z.object({
  pointId: z.string().describe('Qdrant 中的向量点 ID，格式为 docId#chunkIndex'),
  docId: z.string().describe('文档 ID'),
  versionId: z.string().describe('文档版本 ID'),
  collectionId: z.string().describe('集合 ID'),
  chunkIndex: z.number().int().describe('文本块在文档中的索引'),
  titleChain: z.string().describe('文本块的标题链，表示其上下文'),
  content: z.string().describe('文本块的原始内容'),
  contentHash: z.string().describe('文本块内容的 SHA256 哈希值'),
});

// 导出 ChunkDTO 的 TypeScript 类型
export type ChunkDTO = z.infer<typeof ChunkDTOSchema>;

// 定义 UploadFileRequest 的 Zod Schema
export const UploadFileRequestSchema = z.object({
  file: z.any().describe('要上传的文档文件，multipart/form-data 格式'), // 实际文件处理在 Controller 层
});

// 导出 UploadFileRequest 的 TypeScript 类型
export type UploadFileRequest = z.infer<typeof UploadFileRequestSchema>;

// 定义 UploadFileResponse 的 Zod Schema
export const UploadFileResponseSchema = z.object({
  docId: z.string().describe('上传成功后返回的文档 ID'),
});

// 导出 UploadFileResponse 的 TypeScript 类型
export type UploadFileResponse = z.infer<typeof UploadFileResponseSchema>;

// 定义 GetDocChunksParams 的 Zod Schema
export const GetDocChunksParamsSchema = z.object({
  id: z.string().describe('文档 ID'),
});

// 定义 GetDocChunksQuery 的 Zod Schema
export const GetDocChunksQuerySchema = z.object({
  page: z.number().int().min(1).default(1).describe('页码，从 1 开始'),
  limit: z.number().int().min(1).max(100).default(10).describe('每页数量，最大 100'),
});

// 导出 GetDocChunksQuery 的 TypeScript 类型
export type GetDocChunksQuery = z.infer<typeof GetDocChunksQuerySchema>;

// 定义 DeleteDocParams 的 Zod Schema
export const DeleteDocParamsSchema = z.object({
  id: z.string().describe('要删除的文档 ID'),
});

// 导出 DeleteDocParams 的 TypeScript 类型
export type DeleteDocParams = z.infer<typeof DeleteDocParamsSchema>;