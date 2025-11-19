import { Doc, DocId } from '@domain/entities/types.js';
import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { AppError } from '@api/contracts/Error.js';
import { promises as fs } from 'fs';

type StoredDoc = Pick<Doc, 'name' | 'key' | 'content'>;

/**
 * 内容转换器。
 * 负责提供 Markdown 转 HTML、PDF/Word 文本提取和通用内容读取的能力。
 */
export class ContentConverter {
  private readonly CACHE_DIR = './file_cache';

  /**
   * 创建内容转换器实例。
   * @param sqliteRepo SQLite 仓库实现
   */
  constructor(private readonly sqliteRepo: ISQLiteRepo) {
    this.ensureDirectoryExists(this.CACHE_DIR);
  }

  /**
   * 将 Markdown 转换为 HTML。
   * @param markdown Markdown 原始文本
   * @returns 简单 HTML 片段
   */
  public async convertMarkdownToHtml(markdown: string): Promise<string> {
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

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Document Preview</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1, h2, h3 { color: #333; }
    code { background-color: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
    pre { background-color: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
    blockquote { border-left:4px solid #ddd; margin: 0; padding-left: 20px; color: #666; }
  </style>
</head>
<body>
  ${convertedHtml}
</body>
</html>`;
  }

  /**
   * 简化的 PDF 文本提取。
   * @param docId 文档 ID
   * @returns 预览文本
   */
  public async extractTextFromPdf(docId: DocId): Promise<string> {
    const doc = (await this.sqliteRepo.docs.getById(docId)) as StoredDoc | null;
    const docName = doc?.name ?? '未知文档';
    return `PDF文档预览：${docName}\n\n注意：PDF文本提取功能需要额外的库支持。`;
  }

  /**
   * 简化的 Word 文本提取。
   * @param docId 文档 ID
   * @returns 预览文本
   */
  public async extractTextFromWord(docId: DocId): Promise<string> {
    const doc = (await this.sqliteRepo.docs.getById(docId)) as StoredDoc | null;
    const docName = doc?.name ?? '未知文档';
    return `Word文档预览：${docName}\n\n注意：Word 文本提取功能需要额外的库支持。`;
  }

  /**
   * 读取文档内容。
   * @param docId 文档 ID
   * @returns 文本内容
   */
  public async getDocumentContent(docId: DocId): Promise<string> {
    const doc = (await this.sqliteRepo.docs.getById(docId)) as StoredDoc | null;
    if (!doc) {
      throw AppError.createNotFoundError(`Document with ID ${docId} not found`);
    }

    if (doc.key && !doc.key.startsWith('uploaded_')) {
      try {
        return await fs.readFile(doc.key, 'utf-8');
      } catch (error) {
        console.error(`Failed to read file from path: ${doc.key}`, error);
      }
    }

    const rawContent = doc.content;
    if (typeof rawContent === 'string') {
      return rawContent;
    }
    if (rawContent && typeof rawContent === 'object') {
      if (Buffer.isBuffer(rawContent)) {
        return (rawContent as Buffer).toString('utf-8');
      }
      if (ArrayBuffer.isView(rawContent)) {
        return Buffer.from(rawContent as Uint8Array).toString('utf-8');
      }
    }

    return '';
  }

  /**
   * 确保缓存目录存在。
   * @param dirPath 目录路径
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }
}
