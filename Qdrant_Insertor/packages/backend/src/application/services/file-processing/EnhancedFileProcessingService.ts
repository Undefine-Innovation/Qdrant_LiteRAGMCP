// DocId and Doc imported below together
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
import { IFileProcessorRegistry } from '@domain/services/fileProcessor.js';
import { DocId, Doc } from '@domain/entities/types.js';
import { FileMetadata } from '@domain/services/fileProcessor.js';
import {
  FileFormatDetector,
  FormatDetectionResult,
} from '@infrastructure/external/FileFormatDetector.js';
import path from 'path';
import { LoadedFile } from '@domain/services/loader.js';
import { IFileLoader } from '@domain/services/loader.js';

/**
 * 增强的文件处理服务
 * 整合插件化文件处理器架构，提供更强大的文件处理能力
 */
export class EnhancedFileProcessingService implements IFileProcessingService {
  private readonly fileFormatDetector: FileFormatDetector;

  /**
   * 构造函数
   * @param sqliteRepo - 数据库仓库
   * @param processorRegistry - 文件处理器注册表
   * @param fileLoader - 文件加载器
   * @param logger - 日志记录器
   */
  constructor(
    private readonly sqliteRepo: ISQLiteRepo,
    private readonly processorRegistry: IFileProcessorRegistry,
    private readonly fileLoader: IFileLoader,
    private readonly logger: Logger,
  ) {
    this.fileFormatDetector = new FileFormatDetector(processorRegistry, logger);
    this.logger.info('增强文件处理服务已初始化');
  }

  /**
   * 检测文件格式
   * @param docId - 文档ID
   * @returns 文件格式信息
   */
  public async detectFileFormat(docId: DocId): Promise<FileFormatInfo> {
    const doc = await this.sqliteRepo.docs.getById(docId);
    if (!doc) {
      throw AppError.createNotFoundError(`Document with ID ${docId} not found`);
    }

    // 获取文件内容
    const loadedFile = await this.getLoadedFile(doc);

    // 使用新的格式检测器
    const detectionResult =
      await this.fileFormatDetector.detectFormat(loadedFile);

    return {
      mimeType: detectionResult.mimeType || loadedFile.mimeType,
      extension:
        detectionResult.extension || this.extractExtension(doc.name || ''),
      category: this.convertCategoryToFileFormatInfo(detectionResult.category),
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
    format: 'html' | 'text' | 'json' = 'text',
  ): Promise<PreviewContent> {
    const doc = await this.sqliteRepo.docs.getById(docId);
    if (!doc) {
      throw AppError.createNotFoundError(`Document with ID ${docId} not found`);
    }

    // 获取文件内容
    const loadedFile = await this.getLoadedFile(doc);

    // 获取适合的处理器
    const processor = this.processorRegistry.getProcessor(loadedFile);
    if (!processor) {
      // 如果没有处理器，使用默认预览
      return this.generateDefaultPreview(loadedFile, format);
    }

    try {
      // 使用处理器生成预览
      const previewContent = await processor.generatePreview(
        loadedFile,
        format,
      );

      return {
        content: previewContent,
        mimeType: this.getMimeTypeForFormat(format),
        format,
      };
    } catch (error) {
      this.logger.error(`生成预览失败: ${doc.name}`, { error });
      return this.generateDefaultPreview(loadedFile, format);
    }
  }

  /**
   * 获取文档用于下载
   * @param docId - 文档ID
   * @param format - 下载格式（可选）
   * @returns 下载内容
   */
  public async getDownloadContent(
    docId: DocId,
    format: 'original' | 'html' | 'txt' = 'original',
  ): Promise<DownloadContent> {
    const doc = await this.sqliteRepo.docs.getById(docId);
    if (!doc) {
      throw AppError.createNotFoundError(`Document with ID ${docId} not found`);
    }

    // 获取文件内容
    const loadedFile = await this.getLoadedFile(doc);

    if (format === 'original') {
      // 返回原始内容
      return {
        content: Buffer.from(loadedFile.content, 'utf-8'),
        mimeType: loadedFile.mimeType,
        filename: doc.name || 'document',
      };
    }

    // 获取适合的处理器
    const processor = this.processorRegistry.getProcessor(loadedFile);
    if (!processor) {
      // 如果没有处理器，返回文本格式
      return {
        content: loadedFile.content,
        mimeType: 'text/plain',
        filename: this.changeFileExtension(doc.name || 'document', format),
      };
    }

    try {
      // 使用处理器生成内容
      const content = await processor.generatePreview(
        loadedFile,
        format === 'html' ? 'html' : 'text',
      );

      return {
        content,
        mimeType: this.getMimeTypeForFormat(
          format === 'txt' ? 'text' : (format as 'html' | 'text' | 'json'),
        ),
        filename: this.changeFileExtension(doc.name || 'document', format),
      };
    } catch (error) {
      this.logger.error(`生成下载内容失败: ${doc.name}`, { error });

      // 降级到文本格式
      return {
        content: loadedFile.content,
        mimeType: 'text/plain',
        filename: this.changeFileExtension(doc.name || 'document', 'txt'),
      };
    }
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
    const doc = await this.sqliteRepo.docs.getById(docId);
    if (!doc) {
      throw AppError.createNotFoundError(`Document with ID ${docId} not found`);
    }

    // 获取文件内容
    const loadedFile = await this.getLoadedFile(doc);

    // 获取适合的处理器
    const processor = this.processorRegistry.getProcessor(loadedFile);
    if (!processor) {
      // 如果没有处理器，生成默认缩略图
      return this.generateDefaultThumbnail(loadedFile, size);
    }

    try {
      // 使用处理器生成缩略图
      const thumbnailData = await processor.generateThumbnail(loadedFile, size);

      // 如果返回的是Base64数据，保存为文件
      if (
        typeof thumbnailData === 'string' &&
        thumbnailData.startsWith('data:')
      ) {
        return this.saveBase64Thumbnail(thumbnailData, docId, size);
      }

      // 如果返回的是Buffer，保存为文件
      if (Buffer.isBuffer(thumbnailData)) {
        return this.saveBufferThumbnail(thumbnailData, docId, size);
      }

      // 如果返回的是文件路径，直接返回
      if (typeof thumbnailData === 'string') {
        return thumbnailData;
      }

      // 降级到默认缩略图
      return this.generateDefaultThumbnail(loadedFile, size);
    } catch (error) {
      this.logger.error(`生成缩略图失败: ${doc.name}`, { error });
      return this.generateDefaultThumbnail(loadedFile, size);
    }
  }

  /**
   * 处理文件（新功能，用于文档导入）
   * @param docId - 文档ID
   * @param options - 处理选项
   * @param options.chunkingStrategy - 分块策略
   * @param options.maxChunkSize - 最大分块大小
   * @param options.chunkOverlap - 分块重叠大小
   * @param options.preserveFormatting - 是否保留格式
   * @returns 处理结果
   */
  public async processFile(
    docId: DocId,
    options?: {
      chunkingStrategy?: 'auto' | 'by_headings' | 'by_size' | 'by_sentences';
      maxChunkSize?: number;
      chunkOverlap?: number;
      preserveFormatting?: boolean;
    },
  ): Promise<{
    text: string;
    chunks: Array<{ content: string; titleChain?: string[] }>;
    metadata: FileMetadata;
  }> {
    const doc = await this.sqliteRepo.docs.getById(docId);
    if (!doc) {
      throw AppError.createNotFoundError(`Document with ID ${docId} not found`);
    }

    // 获取文件内容
    const loadedFile = await this.getLoadedFile(doc);

    // 获取适合的处理器
    const processor = this.processorRegistry.getProcessor(loadedFile);
    if (!processor) {
      throw new Error(`无法找到适合处理文件 ${doc.name} 的处理器`);
    }

    try {
      // 使用处理器处理文件
      const result = await processor.process(loadedFile, options);

      return {
        text: result.text,
        chunks: result.chunks,
        metadata: result.metadata,
      };
    } catch (error) {
      this.logger.error(`文件处理失败: ${doc.name}`, { error });
      throw new Error(
        `文件处理失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
    }
  }

  /**
   * 获取支持的文件格式
   * @returns 支持的格式信息
   */
  public getSupportedFormats(): {
    mimeTypes: string[];
    extensions: string[];
    categories: string[];
  } {
    const processors = this.processorRegistry.getAllProcessors();
    const mimeTypes = new Set<string>();
    const extensions = new Set<string>();

    processors.forEach((processor) => {
      const formats = processor.getSupportedFormats();
      formats.mimeTypes.forEach((mimeType) => mimeTypes.add(mimeType));
      formats.extensions.forEach((extension) => extensions.add(extension));
    });

    return {
      mimeTypes: Array.from(mimeTypes),
      extensions: Array.from(extensions),
      categories: [
        'text',
        'markdown',
        'pdf',
        'word',
        'excel',
        'powerpoint',
        'image',
        'audio',
        'video',
        'archive',
        'code',
      ],
    };
  }

  /**
   * 获取处理器统计信息
   * @returns 统计信息
   */
  public getProcessorStats(): {
    totalProcessors: number;
    supportedMimeTypes: string[];
    supportedExtensions: string[];
  } {
    /**
     * Optional provider interface for processor registry statistics.
     * Some registry implementations expose getStats() for debugging/inspection.
     */
    type StatsProvider = {
      getStats?: () => {
        totalProcessors: number;
        supportedMimeTypes: string[];
        supportedExtensions: string[];
      };
    };

    const stats = (
      this.processorRegistry as unknown as StatsProvider
    ).getStats?.() || {
      totalProcessors: 0,
      supportedMimeTypes: [],
      supportedExtensions: [],
    };

    return stats;
  }

  /**
   * 获取已加载的文件对象
   * @param doc - 文档对象
   * @returns 已加载的文件对象
   */
  private async getLoadedFile(doc: Doc): Promise<LoadedFile> {
    // 如果文档有 key 字段且看起来像文件路径（非上传标识），尝试从文件系统读取
    const looksLikePath = (k: string | undefined): boolean => {
      if (!k) return false;
      if (k.startsWith('file://')) return true;
      if (k.startsWith('./') || k.startsWith('../')) return true;
      if (path.isAbsolute(k)) return true;
      // 包含路径分隔符也很可能是路径（兼容 Windows 和 POSIX）
      if (k.includes('/') || k.includes('\\')) return true;
      return false;
    };

    if (doc.key && !doc.key.startsWith('uploaded_') && looksLikePath(doc.key)) {
      try {
        const content = await this.fileLoader.load(doc.key);
        return {
          content: content.content,
          fileName: doc.name || 'unknown',
          mimeType: doc.mime || content.mimeType || 'application/octet-stream',
        };
      } catch (error) {
        this.logger.error(`从文件系统读取文件失败: ${doc.key}`, { error });
      }
    }

    // 如果文档有content字段，直接使用（支持 string | Uint8Array | Buffer）
    if (doc.content) {
      const rawContent = doc.content as unknown;
      let contentStr = '';
      if (typeof rawContent === 'string') {
        contentStr = rawContent;
      } else if (rawContent instanceof Uint8Array) {
        contentStr = Buffer.from(rawContent).toString('utf-8');
      } else if (Buffer.isBuffer(rawContent as Buffer)) {
        contentStr = (rawContent as Buffer).toString('utf-8');
      }

      return {
        content: contentStr,
        fileName: doc.name || 'unknown',
        mimeType: doc.mime || 'text/plain',
      };
    }

    // 如果都没有，返回空内容
    return {
      content: '',
      fileName: doc.name || 'unknown',
      mimeType: doc.mime || 'application/octet-stream',
    };
  }

  /**
   * 生成默认预览
   * @param loadedFile - 已加载的文件对象
   * @param format - 预览格式
   * @returns 预览内容
   */
  private generateDefaultPreview(
    loadedFile: LoadedFile,
    format: 'html' | 'text' | 'json',
  ): PreviewContent {
    const maxLength = 1000;
    let content = loadedFile.content.substring(0, maxLength);

    if (loadedFile.content.length > maxLength) {
      content += '\n\n... (内容已截断)';
    }

    if (format === 'html') {
      const escapedContent = content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/\n/g, '<br>');

      content = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${loadedFile.fileName}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
    .notice { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 4px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="notice">此文件格式暂不支持高级预览，显示为纯文本内容。</div>
  <pre>${escapedContent}</pre>
</body>
</html>`;
    } else if (format === 'json') {
      content = JSON.stringify(
        {
          file: {
            name: loadedFile.fileName,
            mimeType: loadedFile.mimeType,
          },
          preview:
            loadedFile.content.substring(0, 200) +
            (loadedFile.content.length > 200 ? '...' : ''),
          message: '此文件格式暂不支持高级预览',
        },
        null,
        2,
      );
    }

    return {
      content,
      mimeType: this.getMimeTypeForFormat(format),
      format,
    };
  }

  /**
   * 生成默认缩略图
   * @param loadedFile - 已加载的文件对象
   * @param size - 缩略图大小
   * @returns 缩略图路径
   */
  private generateDefaultThumbnail(
    loadedFile: LoadedFile,
    size: ThumbnailSize,
  ): string {
    const extension = this.extractExtension(loadedFile.fileName);
    const icon = this.getFileIcon(extension);
    const color = this.getFileColor(extension);

    const svg = `<svg width="${size.width}" height="${size.height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${color}"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${Math.min(size.width, size.height) / 4}" 
        text-anchor="middle" dy=".3em" fill="white" font-weight="bold">
    ${icon}
  </text>
</svg>`;

    return this.saveBase64Thumbnail(
      `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
      'default' as unknown as DocId,
      size,
    );
  }

  /**
   * 保存Base64缩略图
   * @param base64Data - Base64数据
   * @param docId - 文档ID
   * @param size - 缩略图大小
   * @returns 文件路径
   */
  private saveBase64Thumbnail(
    base64Data: string,
    docId: DocId,
    size: ThumbnailSize,
  ): string {
    const fs = require('fs/promises');
    const path = require('path');

    const thumbnailDir = path.resolve(process.cwd(), 'thumbnails');
    const thumbnailPath = path.join(
      thumbnailDir,
      `${docId}_${size.width}x${size.height}.svg`,
    );

    // 确保目录存在
    fs.mkdir(thumbnailDir, { recursive: true }).catch(() => {});

    // 提取Base64数据
    const matches = base64Data.match(/^data:image\/svg\+xml;base64,(.+)$/);
    if (matches) {
      const buffer = Buffer.from(matches[1], 'base64');
      fs.writeFile(thumbnailPath, buffer).catch((error: unknown) => {
        this.logger.error(`保存缩略图失败: ${thumbnailPath}`, { error });
      });
    }

    return thumbnailPath;
  }

  /**
   * 保存Buffer缩略图
   * @param buffer - Buffer数据
   * @param docId - 文档ID
   * @param size - 缩略图大小
   * @returns 文件路径
   */
  private saveBufferThumbnail(
    buffer: Buffer,
    docId: DocId,
    size: ThumbnailSize,
  ): string {
    const fs = require('fs/promises');
    const path = require('path');

    const thumbnailDir = path.resolve(process.cwd(), 'thumbnails');
    const thumbnailPath = path.join(
      thumbnailDir,
      `${docId}_${size.width}x${size.height}.png`,
    );

    // 确保目录存在
    fs.mkdir(thumbnailDir, { recursive: true }).catch(() => {});

    // 保存文件
    fs.writeFile(thumbnailPath, buffer).catch((error: unknown) => {
      this.logger.error(`保存缩略图失败: ${thumbnailPath}`, { error });
    });

    return thumbnailPath;
  }

  /**
   * 获取格式对应的MIME类型
   * @param format - 格式
   * @returns MIME类型
   */
  private getMimeTypeForFormat(format: 'html' | 'text' | 'json'): string {
    switch (format) {
      case 'html':
        return 'text/html';
      case 'json':
        return 'application/json';
      case 'text':
      default:
        return 'text/plain';
    }
  }

  /**
   * 更改文件扩展名
   * @param fileName - 原文件名
   * @param format - 目标格式
   * @returns 新文件名
   */
  private changeFileExtension(
    fileName: string,
    format: 'html' | 'txt',
  ): string {
    const path = require('path');
    const nameWithoutExt = path.basename(fileName, path.extname(fileName));
    const newExt = format === 'html' ? '.html' : '.txt';
    return nameWithoutExt + newExt;
  }

  /**
   * 提取文件扩展名
   * @param fileName - 文件名
   * @returns 扩展名
   */
  private extractExtension(fileName: string): string {
    const path = require('path');
    return path.extname(fileName).toLowerCase().substring(1);
  }

  /**
   * 获取文件图标
   * @param extension - 文件扩展名
   * @returns 图标文本
   */
  private getFileIcon(extension: string): string {
    const iconMap: Record<string, string> = {
      txt: 'TXT',
      md: 'MD',
      pdf: 'PDF',
      doc: 'DOC',
      docx: 'DOC',
      xls: 'XLS',
      xlsx: 'XLS',
      ppt: 'PPT',
      pptx: 'PPT',
      jpg: 'IMG',
      jpeg: 'IMG',
      png: 'IMG',
      gif: 'IMG',
      svg: 'SVG',
      mp3: 'MP3',
      mp4: 'MP4',
      zip: 'ZIP',
      rar: 'RAR',
      js: 'JS',
      ts: 'TS',
      py: 'PY',
      java: 'JAVA',
      cpp: 'CPP',
      c: 'C',
      html: 'HTML',
      css: 'CSS',
      json: 'JSON',
      xml: 'XML',
      sql: 'SQL',
    };

    return iconMap[extension] || 'FILE';
  }

  /**
   * 获取文件颜色
   * @param extension - 文件扩展名
   * @returns 颜色值
   */
  private getFileColor(extension: string): string {
    const colorMap: Record<string, string> = {
      txt: '#6c757d',
      md: '#007bff',
      pdf: '#dc3545',
      doc: '#28a745',
      docx: '#28a745',
      xls: '#ffc107',
      xlsx: '#ffc107',
      ppt: '#fd7e14',
      pptx: '#fd7e14',
      jpg: '#6f42c1',
      jpeg: '#6f42c1',
      png: '#6f42c1',
      gif: '#6f42c1',
      svg: '#6f42c1',
      mp3: '#20c997',
      mp4: '#20c997',
      zip: '#6c757d',
      rar: '#6c757d',
      js: '#f8f9fa',
      ts: '#f8f9fa',
      py: '#3776ab',
      java: '#f89820',
      html: '#e34c26',
      css: '#1572b6',
      json: '#000000',
      xml: '#0060ac',
      sql: '#336791',
    };

    return colorMap[extension] || '#6c757d';
  }

  /**
   * 转换文件类别
   * @param category - 检测到的类别
   * @returns 文件格式信息中的类别
   */
  private convertCategoryToFileFormatInfo(
    category: string,
  ): 'text' | 'markdown' | 'pdf' | 'word' | 'unknown' {
    switch (category) {
      case 'text':
        return 'text';
      case 'markdown':
        return 'markdown';
      case 'pdf':
        return 'pdf';
      case 'word':
        return 'word';
      default:
        return 'unknown';
    }
  }
}
