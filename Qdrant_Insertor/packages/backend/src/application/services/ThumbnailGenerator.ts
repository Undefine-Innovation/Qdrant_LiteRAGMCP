import { DocId } from '@domain/entities/types.js';
import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { AppError } from '@api/contracts/error.js';
import { ThumbnailSize } from '@domain/repositories/IFileProcessingService.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * 缩略图生成器
 * 负责为不同类型的文档生成缩略图
 */
export class ThumbnailGenerator {
  private readonly THUMBNAIL_DIR = './thumbnails';

  /**
   *
   * @param sqliteRepo
   */
  constructor(private readonly sqliteRepo: ISQLiteRepo) {
    this.ensureDirectoryExists(this.THUMBNAIL_DIR);
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

    const thumbnailPath = path.join(this.THUMBNAIL_DIR, `${docId}.png`);

    // 检查缩略图是否已存在
    try {
      await fs.access(thumbnailPath);
      return thumbnailPath;
    } catch {
      // 缩略图不存在，需要生成
    }

    // 根据文件类型生成缩略图
    const fileFormat = await this.detectFileFormat(docId);
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
        await this.generateWordThumbnail(docId, thumbnailPath, size);
        break;

      default:
        // 对于不支持的格式，生成一个通用图标
        await this.generateGenericThumbnail(docId, thumbnailPath, size);
    }

    return thumbnailPath;
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
    // 在实际项目中，应该使用canvas或类似的库生成图片
    // 这里创建一个简单的占位符文本
    const placeholder = `<svg width="${size.width}" height="${size.height}" xmlns="http://www.w3.org/2000/svg">
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
    // 这里创建一个简单的占位符文本
    const placeholder = `<svg width="${size.width}" height="${size.height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#ff5252"/>
  <text x="50%" y="50%" font-family="Arial" font-size="14" text-anchor="middle" dy=".3em" fill="white">
    PDF
  </text>
</svg>`;
    await fs.writeFile(outputPath, placeholder);
  }

  /**
   * 为Word文档生成缩略图
   * @param docId
   * @param outputPath - 输出路径
   * @param size - 缩略图大小
   */
  private async generateWordThumbnail(
    docId: DocId,
    outputPath: string,
    size: ThumbnailSize,
  ): Promise<void> {
    // 创建一个简单的占位符文本
    const placeholder = `<svg width="${size.width}" height="${size.height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#2196f3"/>
  <text x="50%" y="50%" font-family="Arial" font-size="14" text-anchor="middle" dy=".3em" fill="white">
    DOC
  </text>
</svg>`;
    await fs.writeFile(outputPath, placeholder);
  }

  /**
   * 为不支持的格式生成通用缩略图
   * @param docId
   * @param outputPath - 输出路径
   * @param size - 缩略图大小
   */
  private async generateGenericThumbnail(
    docId: DocId,
    outputPath: string,
    size: ThumbnailSize,
  ): Promise<void> {
    // 创建一个简单的占位符文本
    const placeholder = `<svg width="${size.width}" height="${size.height}" xmlns="http://www.w3.org/2000/svg">
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

  /**
   * 检测文件格式（临时方法，应该注入FileFormatDetector）
   * @param docId - 文档ID
   * @returns 文件格式信息
   */
  private async detectFileFormat(docId: DocId) {
    const doc = this.sqliteRepo.docs.getById(docId);
    if (!doc) {
      throw AppError.createNotFoundError(`Document with ID ${docId} not found`);
    }

    const mimeType = doc.mime || 'application/octet-stream';
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
}