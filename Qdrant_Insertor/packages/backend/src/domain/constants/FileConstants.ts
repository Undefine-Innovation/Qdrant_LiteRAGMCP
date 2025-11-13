/**
 * 文件相关常量定义
 *
 * @fileoverview 文件处理相关的常量定义，包括文件大小限制、批量操作限制等
 */

/**
 * File size limits in bytes
 */
export const FILE_SIZE_LIMITS = {
  /** Maximum upload size per file (10MB) */
  MAX_UPLOAD_SIZE: 10 * 1024 * 1024, // 10MB
  /** Maximum preview size */
  MAX_PREVIEW_SIZE: 100,
} as const;

/**
 * File processing constants
 */
export const FILE_CONSTANTS = {
  /** Maximum number of files allowed in batch upload */
  MAX_FILES: 50,
  /** Maximum number of document IDs allowed in batch delete */
  MAX_DOC_DELETE_IDS: 5000,
  /** Default batch size for processing */
  BATCH_SIZE: 100,
  /** Default page size for pagination */
  DEFAULT_PAGE_SIZE: 100,
} as const;

/**
 * Supported MIME types for file upload
 */
export const SUPPORTED_MIME_TYPES = [
  'text/plain',
  'text/markdown',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;
