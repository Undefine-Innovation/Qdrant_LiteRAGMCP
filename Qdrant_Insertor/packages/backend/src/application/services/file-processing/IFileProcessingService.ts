import { DocId } from '@domain/entities/types.js';

/**
 * 文件格式信息
 */
export interface FileFormatInfo {
  mimeType: string;
  extension: string;
  category: 'text' | 'markdown' | 'pdf' | 'word' | 'unknown';
}

/**
 * 预览内容
 */
export interface PreviewContent {
  content: string;
  mimeType: string;
  format: string;
}

/**
 * 下载内容
 */
export interface DownloadContent {
  content: Buffer | string;
  mimeType: string;
  filename: string;
}

/**
 * 缩略图尺�?
 */
export interface ThumbnailSize {
  width: number;
  height: number;
}

/**
 * 文件处理服务接口
 * 定义文件处理的核心操�?
 */
export interface IFileProcessingService {
  /**
   * 检测文件格�?
   * @param docId - 文档ID
   * @returns 文件格式信息
   */
  detectFileFormat(docId: DocId): Promise<FileFormatInfo>;

  /**
   * 获取文档内容用于预览
   * @param docId - 文档ID
   * @param format - 预览格式（可选）
   * @returns 预览内容
   */
  getPreviewContent(
    docId: DocId,
    format?: 'html' | 'text' | 'json',
  ): Promise<PreviewContent>;

  /**
   * 获取文档用于下载
   * @param docId - 文档ID
   * @param format - 下载格式（可选）
   * @returns 下载内容
   */
  getDownloadContent(
    docId: DocId,
    format?: 'original' | 'html' | 'txt',
  ): Promise<DownloadContent>;

  /**
   * 生成文档缩略�?
   * @param docId - 文档ID
   * @param size - 缩略图大小（可选）
   * @returns 缩略图路�?
   */
  generateThumbnail(docId: DocId, size?: ThumbnailSize): Promise<string>;
}
