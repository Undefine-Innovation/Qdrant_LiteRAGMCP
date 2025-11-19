import { DocId } from '@domain/entities/types.js';
import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { AppError } from '@api/contracts/Error.js';
import { FileFormatInfo } from '@application/services/index.js';
import path from 'path';
import { lookup } from 'mime-types';

type SqliteDocMetadata = {
  name?: string;
  mime?: string;
};

/**
 * 文件格式检测器
 * 负责检测文档的MIME类型和分类
 */
export class FileFormatDetector {
  /**
   * 创建文件格式检测器实例
   * @param sqliteRepo SQLite 仓库实例
   */
  constructor(private readonly sqliteRepo: ISQLiteRepo) {}

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

    const docMetadata = this.extractDocMetadata(doc);
    const derivedMime = lookup(docMetadata.name ?? '') || undefined;
    const mimeType =
      docMetadata.mime || derivedMime || 'application/octet-stream';
    const extension = path.extname(docMetadata.name ?? '').toLowerCase();

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
   * 规范化 SQLite 文档记录中的基本元数据。
   * @param doc SQLite 文档对象
   * @returns 包含 name/mime 的精简对象
   */
  private extractDocMetadata(doc: unknown): SqliteDocMetadata {
    if (doc && typeof doc === 'object') {
      const { name, mime } = doc as SqliteDocMetadata;
      return {
        name,
        mime,
      };
    }
    return {};
  }
}
