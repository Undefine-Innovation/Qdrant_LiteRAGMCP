import { DocId } from '@domain/entities/types.js';
import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { AppError } from '@api/contracts/error.js';
import { FileFormatInfo } from '@domain/repositories/IFileProcessingService.js';
import path from 'path';
import { lookup } from 'mime-types';

/**
 * 文件格式检测器
 * 负责检测文档的MIME类型和分类
 */
export class FileFormatDetector {
  /**
   *
   * @param sqliteRepo
   */
  constructor(private readonly sqliteRepo: ISQLiteRepo) {}

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
}
