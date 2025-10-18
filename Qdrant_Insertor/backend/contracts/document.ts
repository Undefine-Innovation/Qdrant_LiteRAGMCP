import { z } from 'zod';

// 定义 ChunkDTO 的 Zod Schema
export const ChunkDTOSchema = z.object({
  pointId: z.string().describe('Qdrant 中的向量点 ID，格式为 docId#chunkIndex'),
  docId: z.string().describe('文档 ID'),
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

/**
 * @typedef {object} CreateDocumentRequestSchema
 * @property {string} content - 文档的原始内容。
 * @property {string} collectionId - 所属 Collection 的 ID。
 * @property {object} [metadata] - 文档的额外元数据。
 * @property {object} [splitOptions] - 文档分割选项。
 */
export const CreateDocumentRequestSchema = z.object({
  content: z.string().describe('文档的原始内容'),
  collectionId: z.string().describe('所属 Collection 的 ID'),
  metadata: z.record(z.any()).optional().describe('文档的额外元数据'),
  splitOptions: z.record(z.any()).optional().describe('文档分割选项'),
});

export type CreateDocumentRequest = z.infer<typeof CreateDocumentRequestSchema>;

/**
 * @typedef {object} UpdateDocumentRequestSchema
 * @property {string} [content] - 文档的新内容。
 * @property {object} [metadata] - 文档的额外元数据。
 * @property {object} [splitOptions] - 文档分割选项。
 */
export const UpdateDocumentRequestSchema = z.object({
  content: z.string().optional().describe('文档的新内容'),
  metadata: z.record(z.any()).optional().describe('文档的额外元数据'),
  splitOptions: z.record(z.any()).optional().describe('文档分割选项'),
});

export type UpdateDocumentRequest = z.infer<typeof UpdateDocumentRequestSchema>;

/**
 * @typedef {object} DocumentResponseSchema
 * @property {string} docId - Document 的唯一标识符。
 * @property {string} key - 文档的键。
 * @property {string} name - 文档的名称。
 * @property {number} sizeBytes - 文档大小（字节）。
 * @property {string} mime - 文档的 MIME 类型。
 * @property {number} createdAt - Document 的创建时间戳。
 * @property {number} updatedAt - Document 的最后更新时间戳。
 * @property {number} isDeleted - 是否已软删除 (0 或 1)。
 */
export const DocumentResponseSchema = z.object({
  docId: z.string().describe('Document 的唯一标识符'),
  key: z.string().describe('文档的键'),
  name: z.string().describe('文档的名称'),
  sizeBytes: z.number().int().describe('文档大小（字节）'),
  mime: z.string().describe('文档的 MIME 类型'),
  createdAt: z.number().int().describe('Document 的创建时间戳'),
  updatedAt: z.number().int().describe('Document 的最后更新时间戳'),
  isDeleted: z.number().int().min(0).max(1).describe('是否已软删除 (0 或 1)'),
});

export type DocumentResponse = z.infer<typeof DocumentResponseSchema>;