import { Logger } from '@logging/logger.js';
import { BaseFileProcessor } from '@infrastructure/external/BaseFileProcessor.js';
import { LoadedFile } from '@application/services/file-processing/index.js';
import { DocumentChunk } from '@domain/entities/types.js';
import {
  FileMetadata,
  FileProcessorOptions,
  FileProcessorResult,
} from '@infrastructure/external/index.js';

/**
 * Markdown文件处理器
 * 专门处理Markdown格式文件，支持标题分块和格式转换
 */
export class MarkdownFileProcessor extends BaseFileProcessor {
  private static readonly SUPPORTED_MIME_TYPES = [
    'text/markdown',
    'text/x-markdown',
  ];

  private static readonly SUPPORTED_EXTENSIONS = [
    'md',
    'markdown',
    'mdown',
    'mkd',
  ];

  /**
   * 构造函数
   * @param logger - 日志记录器
   */
  constructor(logger: Logger) {
    super(logger);
    this.logger.info('Markdown文件处理器已初始化');
  }

  /**
   * 检查是否可以处理指定的文件
   * @param file - 已加载的文件对象
   * @returns 是否可以处理该文件
   */
  public canHandle(file: LoadedFile): boolean {
    // 检查MIME类型
    if (
      MarkdownFileProcessor.SUPPORTED_MIME_TYPES.includes(
        file.mimeType.toLowerCase(),
      )
    ) {
      return true;
    }

    // 检查文件扩展名
    const extension = this.getFileExtension(file.fileName);
    if (MarkdownFileProcessor.SUPPORTED_EXTENSIONS.includes(extension)) {
      return true;
    }

    // 检查内容是否为Markdown格式
    return this.isMarkdownContent(file.content);
  }

  /**
   * 获取支持的文件格式列表
   * @returns 支持的MIME类型和文件扩展名数组
   */
  public getSupportedFormats(): {
    mimeTypes: string[];
    extensions: string[];
  } {
    return {
      mimeTypes: [...MarkdownFileProcessor.SUPPORTED_MIME_TYPES],
      extensions: [...MarkdownFileProcessor.SUPPORTED_EXTENSIONS],
    };
  }

  /**
   * 获取处理器优先级
   * @returns 优先级数值
   */
  public getPriority(): number {
    return 20; // 高优先级，专门处理Markdown
  }

  /**
   * 提取文件文本内容
   * @param file - 文件对象
   * @returns 提取的文本内容
   */
  protected async extractText(file: LoadedFile): Promise<string> {
    // 对于Markdown文件，直接返回内容
    return file.content;
  }

  /**
   * 提取文件元数据
   * @param file - 文件对象
   * @param text - 提取的文本内容
   * @returns 文件元数据
   */
  protected async extractMetadata(
    file: LoadedFile,
    text: string,
  ): Promise<FileMetadata> {
    const metadata = await super.extractMetadata(file, text);

    // 设置语言为Markdown
    metadata.language = 'markdown';
    metadata.fileType = 'markdown';

    // 提取Markdown特定信息
    metadata.markdownInfo = this.extractMarkdownInfo(text);

    // 统计行数
    metadata.lineCount = text.split('\n').length;

    // 统计字符数
    metadata.characterCount = text.length;

    return metadata;
  }

  /**
   * 文本分块（针对Markdown优化）
   * @param text - 文本内容
   * @param options - 分块选项
   * @returns 文档块数组
   */
  protected async chunkText(
    text: string,
    options?: FileProcessorOptions,
  ): Promise<DocumentChunk[]> {
    const strategy = options?.chunkingStrategy || 'by_headings';

    switch (strategy) {
      case 'by_headings':
        return this.chunkByHeadings(text, options);
      case 'by_size':
        return this.chunkBySize(text, options);
      case 'by_sections':
        return this.chunkBySections(text, options);
      case 'auto':
      default:
        return this.chunkByHeadings(text, options);
    }
  }

  /**
   * 生成HTML预览（针对Markdown优化）
   * @param file - 文件对象
   * @param result - 处理结果
   * @returns HTML预览
   */
  protected generateHtmlPreview(
    file: LoadedFile,
    result: FileProcessorResult,
  ): string {
    const htmlContent = this.convertMarkdownToHtml(result.text);

    const mdInfo = result.metadata.markdownInfo as unknown;
    const headingsCount = Array.isArray(
      (mdInfo as { headings?: unknown }).headings,
    )
      ? ((mdInfo as { headings?: unknown }).headings as unknown[]).length
      : 0;
    const linksCount = Array.isArray((mdInfo as { links?: unknown }).links)
      ? ((mdInfo as { links?: unknown }).links as unknown[]).length
      : 0;
    const codeBlocksCount = Array.isArray(
      (mdInfo as { codeBlocks?: unknown }).codeBlocks,
    )
      ? ((mdInfo as { codeBlocks?: unknown }).codeBlocks as unknown[]).length
      : 0;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${result.metadata.title || file.fileName}</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      line-height: 1.6; 
      max-width: 900px; 
      margin: 0 auto; 
      padding: 20px; 
      background-color: #f8f9fa;
    }
    .preview-container {
      background-color: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .title {
      color: #24292e;
      border-bottom: 2px solid #0366d6;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    .metadata {
      color: #586069;
      font-size: 0.9em;
      margin-bottom: 30px;
      background-color: #f6f8fa;
      padding: 15px;
      border-radius: 6px;
    }
    .metadata-item {
      margin-bottom: 5px;
    }
    .content {
      color: #24292e;
    }
    .content h1 { color: #24292e; border-bottom: 1px solid #e1e4e8; padding-bottom: 0.3em; }
    .content h2 { color: #24292e; border-bottom: 1px solid #e1e4e8; padding-bottom: 0.3em; }
    .content h3 { color: #24292e; }
    .content code { 
      background-color: #f6f8fa; 
      padding: 0.2em 0.4em; 
      border-radius: 3px; 
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    }
    .content pre { 
      background-color: #f6f8fa; 
      padding: 16px; 
      border-radius: 6px; 
      overflow-x: auto;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    }
    .content blockquote { 
      border-left: 4px solid #dfe2e5; 
      margin: 0; 
      padding-left: 16px; 
      color: #6a737d; 
    }
    .content table {
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 16px;
    }
    .content th, .content td {
      border: 1px solid #dfe2e5;
      padding: 6px 13px;
    }
    .content th {
      background-color: #f6f8fa;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="preview-container">
    <h1 class="title">${result.metadata.title || file.fileName}</h1>
    <div class="metadata">
      <div class="metadata-item"><strong>文件名:</strong> ${file.fileName}</div>
      <div class="metadata-item"><strong>MIME类型:</strong> ${file.mimeType}</div>
      <div class="metadata-item"><strong>字数:</strong> ${result.metadata.wordCount || 0}</div>
      <div class="metadata-item"><strong>块数:</strong> ${result.chunks.length}</div>
  <div class="metadata-item"><strong>标题数:</strong> ${headingsCount}</div>
  <div class="metadata-item"><strong>链接数:</strong> ${linksCount}</div>
  <div class="metadata-item"><strong>代码块数:</strong> ${codeBlocksCount}</div>
      ${result.metadata.createdAt ? `<div class="metadata-item"><strong>创建时间:</strong> ${result.metadata.createdAt.toLocaleDateString()}</div>` : ''}
    </div>
    <div class="content">${htmlContent}</div>
  </div>
</body>
</html>`;
  }

  /**
   * 提取Markdown特定信息
   * @param text - Markdown文本
   * @returns Markdown信息
   */
  private extractMarkdownInfo(text: string): {
    headings: Array<{ level: number; text: string; line: number }>;
    links: Array<{ text: string; url: string; line: number }>;
    images: Array<{ alt: string; src: string; line: number }>;
    codeBlocks: Array<{ language?: string; code: string; line: number }>;
    tables: Array<{ headers: string[]; rows: string[][]; line: number }>;
    frontMatter: Record<string, string> | null;
  } {
    const info = {
      headings: this.extractHeadings(text),
      links: this.extractLinks(text),
      images: this.extractImages(text),
      codeBlocks: this.extractCodeBlocks(text),
      tables: this.extractTables(text),
      frontMatter: this.extractFrontMatter(text),
    };

    return info;
  }

  /**
   * 提取标题
   * @param text - Markdown文本
   * @returns 标题数组
   */
  private extractHeadings(
    text: string,
  ): Array<{ level: number; text: string; line: number }> {
    const headings: Array<{ level: number; text: string; line: number }> = [];
    const lines = text.split('\n');

    lines.forEach((line, index) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        headings.push({
          level: match[1].length,
          text: match[2].trim(),
          line: index + 1,
        });
      }
    });

    return headings;
  }

  /**
   * 提取链接
   * @param text - Markdown文本
   * @returns 链接数组
   */
  private extractLinks(
    text: string,
  ): Array<{ text: string; url: string; line: number }> {
    const links: Array<{ text: string; url: string; line: number }> = [];
    const lines = text.split('\n');

    lines.forEach((line, index) => {
      // 内联链接 [text](url)
      const inlineMatches = line.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
      for (const match of inlineMatches) {
        links.push({
          text: match[1],
          url: match[2],
          line: index + 1,
        });
      }

      // 引用链接 [text][ref]
      const refMatches = line.matchAll(/\[([^\]]+)\]\[([^\]]+)\]/g);
      for (const match of refMatches) {
        links.push({
          text: match[1],
          url: `[${match[2]}]`, // 引用标记
          line: index + 1,
        });
      }
    });

    return links;
  }

  /**
   * 提取图片
   * @param text - Markdown文本
   * @returns 图片数组
   */
  private extractImages(
    text: string,
  ): Array<{ alt: string; src: string; line: number }> {
    const images: Array<{ alt: string; src: string; line: number }> = [];
    const lines = text.split('\n');

    lines.forEach((line, index) => {
      const matches = line.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g);
      for (const match of matches) {
        images.push({
          alt: match[1],
          src: match[2],
          line: index + 1,
        });
      }
    });

    return images;
  }

  /**
   * 提取代码块
   * @param text - Markdown文本
   * @returns 代码块数组
   */
  private extractCodeBlocks(
    text: string,
  ): Array<{ language?: string; code: string; line: number }> {
    const codeBlocks: Array<{ language?: string; code: string; line: number }> =
      [];
    const lines = text.split('\n');

    let inCodeBlock = false;
    let currentBlock: { language?: string; code: string; line: number } | null =
      null;
    let startLine = 0;

    lines.forEach((line, index) => {
      const codeBlockStart = line.match(/^```(\w+)?/);
      const codeBlockEnd = line.match(/^```$/);

      if (codeBlockStart && !inCodeBlock) {
        inCodeBlock = true;
        currentBlock = {
          language: codeBlockStart[1] || undefined,
          code: '',
          line: index + 1,
        };
        startLine = index + 1;
      } else if (codeBlockEnd && inCodeBlock && currentBlock) {
        inCodeBlock = false;
        codeBlocks.push(currentBlock);
        currentBlock = null;
      } else if (inCodeBlock && currentBlock) {
        currentBlock.code += line + '\n';
      }
    });

    return codeBlocks;
  }

  /**
   * 提取表格
   * @param text - Markdown文本
   * @returns 表格数组
   */
  private extractTables(
    text: string,
  ): Array<{ headers: string[]; rows: string[][]; line: number }> {
    const tables: Array<{ headers: string[]; rows: string[][]; line: number }> =
      [];
    const lines = text.split('\n');

    let inTable = false;
    let currentTable: {
      headers: string[];
      rows: string[][];
      line: number;
    } | null = null;

    lines.forEach((line, index) => {
      const isTableRow = line.includes('|');
      const isSeparator = line.match(/^\|[\s\-|:]+\|$/);

      if (isTableRow && !inTable) {
        inTable = true;
        const headers = this.parseTableRow(line);
        currentTable = {
          headers,
          rows: [],
          line: index + 1,
        };
      } else if (isTableRow && inTable && currentTable && !isSeparator) {
        const row = this.parseTableRow(line);
        if (row.length > 0) {
          currentTable.rows.push(row);
        }
      } else if (!isTableRow && inTable && currentTable) {
        inTable = false;
        if (currentTable.rows.length > 0) {
          tables.push(currentTable);
        }
        currentTable = null;
      }
    });

    return tables;
  }

  /**
   * 解析表格行
   * @param line - 表格行文本
   * @returns 解析后的单元格数组
   */
  private parseTableRow(line: string): string[] {
    return line
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0);
  }

  /**
   * 提取Front Matter
   * @param text - Markdown文本
   * @returns Front Matter对象
   */
  private extractFrontMatter(text: string): Record<string, string> | null {
    const frontMatterMatch = text.match(/^---\n([\s\S]*?)\n---/);
    if (!frontMatterMatch) {
      return null;
    }

    try {
      // 简单的YAML解析（实际项目中应使用专门的YAML解析库）
      const frontMatterText = frontMatterMatch[1];
      const frontMatter: Record<string, string> = {};

      frontMatterText.split('\n').forEach((line) => {
        const match = line.match(/^(\w+):\s*(.+)$/);
        if (match) {
          const key = match[1];
          let value = match[2].trim();

          // 移除引号
          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.slice(1, -1);
          }

          frontMatter[key] = value;
        }
      });

      return frontMatter;
    } catch {
      return null;
    }
  }

  /**
   * 按标题分块
   * @param text - 文本内容
   * @param options - 分块选项
   * @returns 文档块数组
   */
  private chunkByHeadings(
    text: string,
    options?: FileProcessorOptions,
  ): DocumentChunk[] {
    const maxHeadingDepth = options?.maxHeadingDepth || 3;
    const lines = text.split('\n');
    const chunks: DocumentChunk[] = [];
    let currentChunk = '';
    let currentTitleChain: string[] = [];
    let currentChunkStartLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch) {
        const level = headingMatch[1].length;
        const title = headingMatch[2].trim();

        // 如果当前块有内容，保存它
        if (currentChunk.trim()) {
          chunks.push({
            content: currentChunk.trim(),
            titleChain:
              currentTitleChain.length > 0 ? [...currentTitleChain] : undefined,
          });
        }

        // 更新标题链
        if (level <= maxHeadingDepth) {
          currentTitleChain = currentTitleChain.slice(0, level - 1);
          currentTitleChain.push(title);
        }

        currentChunk = line;
        currentChunkStartLine = i;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }

    // 添加最后一个块
    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        titleChain:
          currentTitleChain.length > 0 ? [...currentTitleChain] : undefined,
      });
    }

    return chunks;
  }

  /**
   * 按章节分块（基于空行分隔）
   * @param text - 文本内容
   * @param options - 分块选项
   * @returns 文档块数组
   */
  private chunkBySections(
    text: string,
    options?: FileProcessorOptions,
  ): DocumentChunk[] {
    const maxChunkSize = options?.maxChunkSize || 2000;
    const sections = text.split(/\n\s*\n/);
    const chunks: DocumentChunk[] = [];
    let currentChunk = '';

    for (const section of sections) {
      if (
        currentChunk.length + section.length > maxChunkSize &&
        currentChunk.length > 0
      ) {
        chunks.push({ content: currentChunk.trim() });
        currentChunk = section;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + section;
      }
    }

    if (currentChunk.trim()) {
      chunks.push({ content: currentChunk.trim() });
    }

    return chunks;
  }

  /**
   * 按大小分块
   * @param text - 文本内容
   * @param options - 分块选项
   * @returns 文档块数组
   */
  private async chunkBySize(
    text: string,
    options?: FileProcessorOptions,
  ): Promise<DocumentChunk[]> {
    return super.chunkText(text, options);
  }

  /**
   * 检测是否为Markdown内容
   * @param content - 文件内容
   * @returns 是否为Markdown
   */
  private isMarkdownContent(content: string): boolean {
    const markdownPatterns = [
      /^#{1,6}\s+/m, // 标题
      /\*\*.*?\*\*/, // 粗体
      /\*.*?\*/, // 斜体
      /\[.*?\]\(.*?\)/, // 链接
      /```[\s\S]*?```/, // 代码块
      /^[-*+]\s+/m, // 列表项
      /^\d+\.\s+/m, // 有序列表
      /^>\s+/m, // 引用
    ];

    const matchCount = markdownPatterns.filter((pattern) =>
      pattern.test(content),
    ).length;
    return matchCount >= 2; // 至少匹配2个模式才认为是Markdown
  }

  /**
   * 将Markdown转换为HTML（简化实现）
   * @param markdown - Markdown文本
   * @returns HTML文本
   */
  private convertMarkdownToHtml(markdown: string): string {
    return (
      markdown
        // 标题
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        // 粗体和斜体
        .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/gim, '<em>$1</em>')
        // 图片
        .replace(/!\[([^\]]*)\]\(([^)]*)\)/gim, '<img alt="$1" src="$2" />')
        // 链接
        .replace(/\[([^\]]*)\]\(([^)]*)\)/gim, '<a href="$2">$1</a>')
        // 代码块
        .replace(/```(\w+)?\n([\s\S]*?)```/gim, '<pre><code>$2</code></pre>')
        // 行内代码
        .replace(/`([^`]*)`/gim, '<code>$1</code>')
        // 引用
        .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
        // 换行
        .replace(/\n$/gim, '<br />')
        // 列表
        .replace(/^\* (.*$)/gim, '<li>$1</li>')
        .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
    );
  }
}
