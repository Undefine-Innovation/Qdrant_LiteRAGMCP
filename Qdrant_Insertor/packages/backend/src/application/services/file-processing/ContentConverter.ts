import { DocId } from '@domain/entities/types.js';
import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { AppError } from '@api/contracts/error.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * 内容转换器
 * 负责将文档内容转换为不同格式
 */
export class ContentConverter {
  private readonly CACHE_DIR = './file_cache';

  /**
   * 创建内容转换器实例
   * @param sqliteRepo SQLite 仓库实例
   */
  constructor(private readonly sqliteRepo: ISQLiteRepo) {
    this.ensureDirectoryExists(this.CACHE_DIR);
  }

  /**
   * 将Markdown转换为HTML
   * @param markdown - Markdown内容
   * @returns HTML内容
   */
  public async convertMarkdownToHtml(markdown: string): Promise<string> {
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
    blockquote { border-left:4px solid #ddd; margin: 0; padding-left: 20px; color: #666; }
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
  public async extractTextFromPdf(docId: DocId): Promise<string> {
    // 在实际项目中，应该使用pdf-parse或类似的库
    // 这里返回一个占位符
    const doc = await this.sqliteRepo.docs.getById(docId);
    return `PDF文档预览：${doc?.name || '未知文档'}\n\n注意：PDF文本提取功能需要额外的库支持。`;
  }

  /**
   * 从Word文档提取文本（简化实现）
   * @param docId - 文档ID
   * @returns 提取的文本
   */
  public async extractTextFromWord(docId: DocId): Promise<string> {
    // 在实际项目中，应该使用mammoth.js或类似的库
    // 这里返回一个占位符
    const doc = await this.sqliteRepo.docs.getById(docId);
    return `Word文档预览：${doc?.name || '未知文档'}\n\n注意：Word文档文本提取功能需要额外的库支持。`;
  }

  /**
   * 获取文档内容
   * @param docId - 文档ID
   * @returns 文档内容
   */
  public async getDocumentContent(docId: DocId): Promise<string> {
    // 这里需要从数据库获取文档内容
    // 由于当前的DocsTable没有直接返回content字段，我们需要特殊处理
    const doc = await this.sqliteRepo.docs.getById(docId);
    if (!doc) {
      throw AppError.createNotFoundError(`Document with ID ${docId} not found`);
    }

    // 如果文档有key字段，尝试从文件系统读取
    if (doc.key && !doc.key.startsWith('uploaded_')) {
      try {
        return await fs.readFile(doc.key, 'utf-8');
      } catch (error) {
        console.error(`Failed to read file from path: ${doc.key}`, error);
      }
    }

    // 返回默认内容或抛出错误
    return doc.content || '';
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
