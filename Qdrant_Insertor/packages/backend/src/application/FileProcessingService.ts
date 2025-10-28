import { DocId } from '../domain/types.js';
import { Logger } from '../logger.js';
import { SQLiteRepo } from '../infrastructure/SQLiteRepo.js';
import { AppError } from '../api/contracts/error.js';
import {
  IFileProcessingService,
  FileFormatInfo,
  PreviewContent,
  DownloadContent,
  ThumbnailSize,
} from '../domain/IFileProcessingService.js';
import fs from 'fs/promises';
import path from 'path';
import { lookup } from 'mime-types';

/**
 * 文件处理服务
 * 负责文件格式检测、转换和缩略图生成
 */
export class FileProcessingService implements IFileProcessingService {
  private readonly THUMBNAIL_DIR = './thumbnails';
  private readonly CACHE_DIR = './file_cache';

  constructor(
    private readonly sqliteRepo: SQLiteRepo,
    private readonly logger: Logger,
  ) {
    // 确保目录存在
    this.ensureDirectoryExists(this.THUMBNAIL_DIR);
    this.ensureDirectoryExists(this.CACHE_DIR);
  }

  /**
   * 检测文件格式
   * @param docId - 文档ID
   * @returns 文件格式信息
   */
  public async detectFileFormat(docId: DocId): Promise<FileFormatInfo> {
    const doc = this.sqliteRepo.docs.getById(docId);
    if (!doc) {
      throw AppError.createNotFoundError(`Document with ID ${docId} not found`);
    }

    const mimeType =
      doc.mime || lookup(doc.name || '') || 'application/octet-stream';
    const extension = path.extname(doc.name || '').toLowerCase();

    let category: 'text' | 'markdown' | 'pdf' | 'word' | 'unknown';

    if (mimeType.startsWith('text/')) {
      category = extension === '.md' ? 'markdown' : 'text';
    } else if (mimeType === 'application/pdf') {
      category = 'pdf';
    } else if (
      mimeType === 'application/msword' ||
      mimeType ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      category = 'word';
    } else {
      category = 'unknown';
    }

    return {
      mimeType,
      extension,
      category,
    };
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
    const doc = this.sqliteRepo.docs.getById(docId);
    if (!doc) {
      throw AppError.createNotFoundError(`Document with ID ${docId} not found`);
    }

    const fileFormat = await this.detectFileFormat(docId);
    let content = '';
    let mimeType = 'text/plain';
    let responseFormat = format || 'text';

    // 从数据库获取原始内容
    const originalContent = await this.getDocumentContent(docId);

    switch (fileFormat.category) {
      case 'text':
        content = originalContent;
        mimeType = 'text/plain';
        break;

      case 'markdown':
        if (format === 'html') {
          content = await this.convertMarkdownToHtml(originalContent);
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
        content = await this.extractTextFromPdf(docId);
        mimeType = 'text/plain';
        responseFormat = 'text';
        break;

      case 'word':
        // 对于Word文档，我们返回文本提取内容（简化实现）
        content = await this.extractTextFromWord(docId);
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
    const doc = this.sqliteRepo.docs.getById(docId);
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
      content = Buffer.from(await this.getDocumentContent(docId), 'utf-8');
      mimeType = fileFormat.mimeType;
      filename = doc.name || `document${fileFormat.extension}`;
    } else {
      // 返回转换后的内容
      const originalContent = await this.getDocumentContent(docId);

      switch (downloadFormat) {
        case 'html':
          if (fileFormat.category === 'markdown') {
            content = await this.convertMarkdownToHtml(originalContent);
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
    const doc = this.sqliteRepo.docs.getById(docId);
    if (!doc) {
      throw AppError.createNotFoundError(`Document with ID ${docId} not found`);
    }

    const fileFormat = await this.detectFileFormat(docId);
    const thumbnailPath = path.join(this.THUMBNAIL_DIR, `${docId}.png`);

    // 检查缩略图是否已存在
    try {
      await fs.access(thumbnailPath);
      return thumbnailPath;
    } catch {
      // 缩略图不存在，需要生成
    }

    // 根据文件类型生成缩略图
    switch (fileFormat.category) {
      case 'text':
      case 'markdown':
        // 对于文本文件，生成一个简单的文本预览图
        await this.generateTextThumbnail(docId, thumbnailPath, size);
        break;

      case 'pdf':
        // 对于PDF，生成第一页的缩略图
        await this.generatePdfThumbnail(docId, thumbnailPath, size);
        break;

      case 'word':
        // 对于Word文档，生成一个简单的图标
        await this.generateWordThumbnail(thumbnailPath, size);
        break;

      default:
        // 对于不支持的格式，生成一个通用图标
        await this.generateGenericThumbnail(thumbnailPath, size);
    }

    return thumbnailPath;
  }

  /**
   * 获取文档内容
   * @param docId - 文档ID
   * @returns 文档内容
   */
  private async getDocumentContent(docId: DocId): Promise<string> {
    // 这里需要从数据库获取文档内容
    // 由于当前的DocsTable没有直接返回content字段，我们需要特殊处理
    const doc = this.sqliteRepo.docs.getById(docId);
    if (!doc) {
      throw AppError.createNotFoundError(`Document with ID ${docId} not found`);
    }

    // 如果文档有key字段，尝试从文件系统读取
    if (doc.key && !doc.key.startsWith('uploaded_')) {
      try {
        return await fs.readFile(doc.key, 'utf-8');
      } catch (error) {
        this.logger.error(`Failed to read file from path: ${doc.key}`, error);
      }
    }

    // 否则，我们需要从数据库获取内容
    // 这里需要直接查询数据库获取content字段
    const db = this.sqliteRepo.getDb();
    const stmt = db.prepare('SELECT content FROM docs WHERE docId = ?');
    const result = stmt.get(docId) as { content: string } | undefined;

    if (!result) {
      throw AppError.createNotFoundError(
        `Document content for ID ${docId} not found`,
      );
    }

    return result.content;
  }

  /**
   * 将Markdown转换为HTML
   * @param markdown - Markdown内容
   * @returns HTML内容
   */
  private async convertMarkdownToHtml(markdown: string): Promise<string> {
    // 简单的Markdown到HTML转换
    // 在实际项目中，应该使用专门的Markdown解析库如marked或markdown-it
    const convertedHtml = markdown
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/!\[([^\]]*)\]\(([^)]*)\)/gim, '<img alt="$1" src="$2" />')
      .replace(/\[([^\]]*)\]\(([^)]*)\)/gim, '<a href="$2">$1</a>')
      .replace(/\n$/gim, '<br />')
      .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
      .replace(/`([^`]*)`/gim, '<code>$1</code>')
      .replace(/```([^`]*)```/gims, '<pre><code>$1</code></pre>');

    // 包装在基本的HTML结构中
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Document Preview</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1, h2, h3 { color: #333; }
    code { background-color: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
    pre { background-color: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
    blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 20px; color: #666; }
  </style>
</head>
<body>
  ${convertedHtml}
</body>
</html>`;
  }

  /**
   * 从PDF提取文本（简化实现）
   * @param docId - 文档ID
   * @returns 提取的文本
   */
  private async extractTextFromPdf(docId: DocId): Promise<string> {
    // 在实际项目中，应该使用pdf-parse或类似的库
    // 这里返回一个占位符
    const doc = this.sqliteRepo.docs.getById(docId);
    return `PDF文档预览：${doc?.name || '未知文档'}\n\n注意：PDF文本提取功能需要额外的库支持。`;
  }

  /**
   * 从Word文档提取文本（简化实现）
   * @param docId - 文档ID
   * @returns 提取的文本
   */
  private async extractTextFromWord(docId: DocId): Promise<string> {
    // 在实际项目中，应该使用mammoth.js或类似的库
    // 这里返回一个占位符
    const doc = this.sqliteRepo.docs.getById(docId);
    return `Word文档预览：${doc?.name || '未知文档'}\n\n注意：Word文档文本提取功能需要额外的库支持。`;
  }

  /**
   * 为文本文件生成缩略图
   * @param docId - 文档ID
   * @param outputPath - 输出路径
   * @param size - 缩略图大小
   */
  private async generateTextThumbnail(
    docId: DocId,
    outputPath: string,
    size: ThumbnailSize,
  ): Promise<void> {
    // 在实际项目中，应该使用canvas或类似的库生成图像
    // 这里创建一个简单的占位符文件
    const placeholder = `
<svg width="${size.width}" height="${size.height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#f5f5f5"/>
  <text x="50%" y="50%" font-family="Arial" font-size="14" text-anchor="middle" dy=".3em" fill="#666">
    TXT
  </text>
</svg>`;
    await fs.writeFile(outputPath, placeholder);
  }

  /**
   * 为PDF生成缩略图
   * @param docId - 文档ID
   * @param outputPath - 输出路径
   * @param size - 缩略图大小
   */
  private async generatePdfThumbnail(
    docId: DocId,
    outputPath: string,
    size: ThumbnailSize,
  ): Promise<void> {
    // 在实际项目中，应该使用pdf-poppler或类似的库
    // 这里创建一个简单的占位符文件
    const placeholder = `
<svg width="${size.width}" height="${size.height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#ff5252"/>
  <text x="50%" y="50%" font-family="Arial" font-size="14" text-anchor="middle" dy=".3em" fill="white">
    PDF
  </text>
</svg>`;
    await fs.writeFile(outputPath, placeholder);
  }

  /**
   * 为Word文档生成缩略图
   * @param outputPath - 输出路径
   * @param size - 缩略图大小
   */
  private async generateWordThumbnail(
    outputPath: string,
    size: ThumbnailSize,
  ): Promise<void> {
    // 创建一个简单的占位符文件
    const placeholder = `
<svg width="${size.width}" height="${size.height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#2196f3"/>
  <text x="50%" y="50%" font-family="Arial" font-size="14" text-anchor="middle" dy=".3em" fill="white">
    DOC
  </text>
</svg>`;
    await fs.writeFile(outputPath, placeholder);
  }

  /**
   * 为不支持的格式生成通用缩略图
   * @param outputPath - 输出路径
   * @param size - 缩略图大小
   */
  private async generateGenericThumbnail(
    outputPath: string,
    size: ThumbnailSize,
  ): Promise<void> {
    // 创建一个简单的占位符文件
    const placeholder = `
<svg width="${size.width}" height="${size.height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#9e9e9e"/>
  <text x="50%" y="50%" font-family="Arial" font-size="14" text-anchor="middle" dy=".3em" fill="white">
    FILE
  </text>
</svg>`;
    await fs.writeFile(outputPath, placeholder);
  }

  /**
   * 确保目录存在
   * @param dirPath - 目录路径
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }
}
