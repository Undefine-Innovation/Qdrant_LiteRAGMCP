import { DocId } from '@domain/entities/types.js';
import { Logger } from '@logging/logger.js';
import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { AppError } from '@api/contracts/error.js';
import {
  IFileProcessingService,
  FileFormatInfo,
  PreviewContent,
  DownloadContent,
  ThumbnailSize,
} from '@domain/repositories/IFileProcessingService.js';
import { FileFormatDetector } from './FileFormatDetector.js';
import { ThumbnailGenerator } from './ThumbnailGenerator.js';
import { ContentConverter } from './ContentConverter.js';
import path from 'path';

/**
 * 文件处理服务
 * 负责文件格式检测、转换和缩略图生成
 */
export class FileProcessingService implements IFileProcessingService {
  private readonly fileFormatDetector: FileFormatDetector;
  private readonly thumbnailGenerator: ThumbnailGenerator;
  private readonly contentConverter: ContentConverter;

  /**
   * 创建文件处理服务实例
   * @param sqliteRepo SQLite 仓库实例
   * @param logger 日志记录器
   */
  constructor(
    private readonly sqliteRepo: ISQLiteRepo,
    private readonly logger: Logger,
  ) {
    this.fileFormatDetector = new FileFormatDetector(sqliteRepo);
    this.thumbnailGenerator = new ThumbnailGenerator(sqliteRepo);
    this.contentConverter = new ContentConverter(sqliteRepo);
  }

  /**
   * 检测文件格式
   * @param docId - 文档ID
   * @returns 文件格式信息
   */
  public async detectFileFormat(docId: DocId): Promise<FileFormatInfo> {
    return this.fileFormatDetector.detectFileFormat(docId);
  }

  /**
   * 获取文档内容用于预览
   * @param docId - 文档ID
   * @param format - 预览格式（可选）
   * @returns 预览内容
   */
  public async getPreviewContent(
    docId: DocId,
    format?: 'html' | 'text' | 'json',
  ): Promise<PreviewContent> {
    const doc = await this.sqliteRepo.docs.getById(docId);
    if (!doc) {
      throw AppError.createNotFoundError(`Document with ID ${docId} not found`);
    }

    const fileFormat = await this.detectFileFormat(docId);
    let content = '';
    let mimeType = 'text/plain';
    let responseFormat = format || 'text';

    // 从数据库获取原始内容
    const originalContent =
      await this.contentConverter.getDocumentContent(docId);

    switch (fileFormat.category) {
      case 'text':
        content = originalContent;
        mimeType = 'text/plain';
        break;

      case 'markdown':
        if (format === 'html') {
          content =
            await this.contentConverter.convertMarkdownToHtml(originalContent);
          mimeType = 'text/html';
          responseFormat = 'html';
        } else {
          content = originalContent;
          mimeType = 'text/markdown';
          responseFormat = 'text';
        }
        break;

      case 'pdf':
        // 对于PDF，我们返回文本提取内容（简化实现）
        content = await this.contentConverter.extractTextFromPdf(docId);
        mimeType = 'text/plain';
        responseFormat = 'text';
        break;

      case 'word':
        // 对于Word文档，我们返回文本提取内容（简化实现）
        content = await this.contentConverter.extractTextFromWord(docId);
        mimeType = 'text/plain';
        responseFormat = 'text';
        break;

      default:
        content = '不支持的文件格式预览';
        mimeType = 'text/plain';
        responseFormat = 'text';
    }

    return {
      content,
      mimeType,
      format: responseFormat,
    };
  }

  /**
   * 获取文档用于下载
   * @param docId - 文档ID
   * @param format - 下载格式（可选）
   * @returns 下载内容
   */
  public async getDownloadContent(
    docId: DocId,
    format?: 'original' | 'html' | 'txt',
  ): Promise<DownloadContent> {
    const doc = await this.sqliteRepo.docs.getById(docId);
    if (!doc) {
      throw AppError.createNotFoundError(`Document with ID ${docId} not found`);
    }

    const fileFormat = await this.detectFileFormat(docId);
    const downloadFormat = format || 'original';
    let content: Buffer | string;
    let mimeType: string;
    let filename: string;

    if (downloadFormat === 'original') {
      // 返回原始内容
      content = Buffer.from(
        await this.contentConverter.getDocumentContent(docId),
        'utf-8',
      );
      mimeType = fileFormat.mimeType;
      filename = doc.name || `document${fileFormat.extension}`;
    } else {
      // 返回转换后的内容
      const originalContent =
        await this.contentConverter.getDocumentContent(docId);

      switch (downloadFormat) {
        case 'html':
          if (fileFormat.category === 'markdown') {
            content =
              await this.contentConverter.convertMarkdownToHtml(
                originalContent,
              );
            mimeType = 'text/html';
            filename = `${path.basename(doc.name || 'document', fileFormat.extension)}.html`;
          } else {
            content = originalContent;
            mimeType = 'text/html';
            filename = `${path.basename(doc.name || 'document', fileFormat.extension)}.html`;
          }
          break;

        case 'txt':
          content = originalContent;
          mimeType = 'text/plain';
          filename = `${path.basename(doc.name || 'document', fileFormat.extension)}.txt`;
          break;

        default:
          content = originalContent;
          mimeType = 'text/plain';
          filename = `${path.basename(doc.name || 'document', fileFormat.extension)}.txt`;
      }
    }

    return {
      content,
      mimeType,
      filename,
    };
  }

  /**
   * 生成文档缩略图
   * @param docId - 文档ID
   * @param size - 缩略图大小（可选）
   * @returns 缩略图路径
   */
  public async generateThumbnail(
    docId: DocId,
    size: ThumbnailSize = { width: 200, height: 200 },
  ): Promise<string> {
    return this.thumbnailGenerator.generateThumbnail(docId, size);
  }
}
