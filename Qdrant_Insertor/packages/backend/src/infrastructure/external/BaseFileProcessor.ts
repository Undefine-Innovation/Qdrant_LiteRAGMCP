import { Logger } from '@logging/logger.js';
import {
  IFileProcessor,
  FileProcessorOptions,
  FileProcessorResult,
  FileMetadata,
  LoadedFile,
  DocumentChunk,
} from '@infrastructure/external/index.js';

/**
 * 文件处理器抽象基类
 * 提供通用的文件处理功能和默认实现
 */
export abstract class BaseFileProcessor implements IFileProcessor {
  protected readonly logger: Logger;

  /**
   * 构造函数
   * @param logger - 日志记录器
   */
  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * 获取处理器优先级（默认为0）
   * @returns 优先级数值
   */
  public getPriority(): number {
    return 0;
  }

  /**
   * 生成文件预览内容（默认实现）
   * @param file - 已加载的文件对象
   * @param format - 预览格式
   * @returns 预览内容
   */
  public async generatePreview(
    file: LoadedFile,
    format: 'html' | 'text' | 'json' = 'text',
  ): Promise<string> {
    const result = await this.process(file);

    switch (format) {
      case 'html':
        return this.generateHtmlPreview(file, result);
      case 'json':
        return this.generateJsonPreview(file, result);
      case 'text':
      default:
        return this.generateTextPreview(file, result);
    }
  }

  /**
   * 生成文件缩略图（默认实现）
   * @param file - 已加载的文件对象
   * @param size - 缩略图尺寸
   * @param size.width - 缩略图宽度
   * @param size.height - 缩略图高度
   * @returns 缩略图数据（Base64 SVG）
   */
  public async generateThumbnail(
    file: LoadedFile,
    size: { width: number; height: number } = { width: 200, height: 200 },
  ): Promise<string> {
    const extension = this.getFileExtension(file.fileName);
    const icon = this.getFileIcon(extension);

    const svg = `<svg width="${size.width}" height="${size.height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${this.getBackgroundColor(extension)}"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${Math.min(size.width, size.height) / 4}" 
        text-anchor="middle" dy=".3em" fill="${this.getTextColor(extension)}" font-weight="bold">
    ${icon}
  </text>
</svg>`;

    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  }

  /**
   * 处理文件（模板方法）
   * @param file - 已加载的文件对象
   * @param options - 处理选项
   * @returns 处理结果
   */
  public async process(
    file: LoadedFile,
    options?: FileProcessorOptions,
  ): Promise<FileProcessorResult> {
    const startTime = Date.now();

    try {
      this.logger.debug(`开始处理文件: ${file.fileName} (${file.mimeType})`);

      // 1. 提取文本内容
      const text = await this.extractText(file);

      // 2. 提取元数据
      const metadata = await this.extractMetadata(file, text);

      // 3. 分块处理
      const chunks = await this.chunkText(text, options);

      const processingTime = Date.now() - startTime;

      this.logger.info(
        `文件处理完成: ${file.fileName} -> ${chunks.length}个块, 耗时: ${processingTime}ms`,
      );

      return {
        text,
        chunks,
        metadata,
        status: 'success',
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : '未知错误';

      this.logger.error(`文件处理失败: ${file.fileName}`, {
        error: errorMessage,
      });

      return {
        text: '',
        chunks: [],
        metadata: { title: file.fileName },
        status: 'error',
        error: errorMessage,
        processingTime,
      };
    }
  }

  /**
   * 提取文件文本内容（子类必须实现）
   * @param file - 文件对象
   * @returns 提取的文本内容
   */
  protected abstract extractText(file: LoadedFile): Promise<string>;

  /**
   * 提取文件元数据（子类可以重写）
   * @param file - 文件对象
   * @param text - 提取的文本内容
   * @returns 文件元数据
   */
  protected async extractMetadata(
    file: LoadedFile,
    text: string,
  ): Promise<FileMetadata> {
    const metadata: FileMetadata = {
      title: this.extractTitle(file, text),
      wordCount: this.countWords(text),
    };

    // 尝试从文件名中提取创建时间
    const dateMatch = file.fileName.match(/(\d{4}-\d{2}-\d{2}|\d{8})/);
    if (dateMatch) {
      const dateStr = dateMatch[1];
      const date =
        dateStr.length === 8
          ? new Date(
              `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`,
            )
          : new Date(dateStr);

      if (!isNaN(date.getTime())) {
        metadata.createdAt = date;
      }
    }

    return metadata;
  }

  /**
   * 文本分块（子类可以重写）
   * @param text - 文本内容
   * @param options - 分块选项
   * @returns 文档块数组
   */
  protected async chunkText(
    text: string,
    options?: FileProcessorOptions,
  ): Promise<DocumentChunk[]> {
    const maxChunkSize = options?.maxChunkSize || 1000;
    const overlap = options?.chunkOverlap || 100;

    if (text.length <= maxChunkSize) {
      return [{ content: text }];
    }

    const chunks: DocumentChunk[] = [];
    let start = 0;

    while (start < text.length) {
      let end = start + maxChunkSize;

      // 尝试在句子边界分割
      if (end < text.length) {
        const lastSentenceEnd = Math.max(
          text.lastIndexOf('.', end),
          text.lastIndexOf('!', end),
          text.lastIndexOf('?', end),
          text.lastIndexOf('\n\n', end),
        );

        if (lastSentenceEnd > start) {
          end = lastSentenceEnd + 1;
        }
      }

      chunks.push({
        content: text.slice(start, end).trim(),
      });

      start = Math.max(start + 1, end - overlap);
    }

    return chunks;
  }

  /**
   * 提取文件标题
   * @param file - 文件对象
   * @param text - 文本内容
   * @returns 标题
   */
  protected extractTitle(file: LoadedFile, text: string): string {
    // 首先尝试从文件名提取
    const fileNameWithoutExt = file.fileName.replace(/\.[^/.]+$/, '');

    // 如果文件名看起来像标题，直接使用
    if (fileNameWithoutExt.length > 3 && !/^\d+$/.test(fileNameWithoutExt)) {
      return fileNameWithoutExt;
    }

    // 尝试从文本内容中提取标题
    const lines = text.split('\n').filter((line) => line.trim().length > 0);
    if (lines.length > 0) {
      const firstLine = lines[0].trim();

      // 检查是否是标题格式
      if (
        firstLine.length < 100 &&
        !firstLine.includes('{') &&
        !firstLine.includes('}')
      ) {
        return firstLine;
      }
    }

    // 默认使用文件名
    return fileNameWithoutExt || '未命名文档';
  }

  /**
   * 统计字数
   * @param text - 文本内容
   * @returns 字数
   */
  protected countWords(text: string): number {
    // 对于中文，按字符计数；对于英文，按单词计数
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    return chineseChars + englishWords;
  }

  /**
   * 获取文件扩展名
   * @param fileName - 文件名
   * @returns 扩展名
   */
  protected getFileExtension(fileName: string): string {
    const lastDotIndex = fileName.lastIndexOf('.');
    return lastDotIndex === -1
      ? ''
      : fileName.substring(lastDotIndex + 1).toLowerCase();
  }

  /**
   * 获取文件图标
   * @param extension - 文件扩展名
   * @returns 图标文本
   */
  protected getFileIcon(extension: string): string {
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
   * 获取背景颜色
   * @param extension - 文件扩展名
   * @returns 颜色值
   */
  protected getBackgroundColor(extension: string): string {
    const colorMap: Record<string, string> = {
      txt: '#f5f5f5',
      md: '#e3f2fd',
      pdf: '#ffebee',
      doc: '#e8f5e8',
      docx: '#e8f5e8',
      xls: '#fff3e0',
      xlsx: '#fff3e0',
      ppt: '#fce4ec',
      pptx: '#fce4ec',
      jpg: '#f3e5f5',
      jpeg: '#f3e5f5',
      png: '#f3e5f5',
      gif: '#f3e5f5',
      svg: '#f3e5f5',
      mp3: '#e0f2f1',
      mp4: '#e0f2f1',
      zip: '#efebe9',
      rar: '#efebe9',
      js: '#fff8e1',
      ts: '#fff8e1',
      py: '#e8eaf6',
      java: '#e8eaf6',
      html: '#e1f5fe',
      css: '#e1f5fe',
      json: '#f1f8e9',
      xml: '#f1f8e9',
      sql: '#fce4ec',
    };

    return colorMap[extension] || '#9e9e9e';
  }

  /**
   * 获取文本颜色
   * @param extension - 文件扩展名
   * @returns 颜色值
   */
  protected getTextColor(extension: string): string {
    const darkTextExtensions = [
      'txt',
      'md',
      'doc',
      'docx',
      'xls',
      'xlsx',
      'ppt',
      'pptx',
      'js',
      'ts',
      'py',
      'java',
      'html',
      'css',
      'json',
      'xml',
      'sql',
    ];
    return darkTextExtensions.includes(extension) ? '#333333' : '#ffffff';
  }

  /**
   * 生成文本预览
   * @param file - 文件对象
   * @param result - 处理结果
   * @returns 文本预览
   */
  protected generateTextPreview(
    file: LoadedFile,
    result: FileProcessorResult,
  ): string {
    const maxLength = 500;
    let preview = result.text.substring(0, maxLength);

    if (result.text.length > maxLength) {
      preview += '\n\n... (内容已截断)';
    }

    return preview;
  }

  /**
   * 生成HTML预览
   * @param file - 文件对象
   * @param result - 处理结果
   * @returns HTML预览
   */
  protected generateHtmlPreview(
    file: LoadedFile,
    result: FileProcessorResult,
  ): string {
    const escapedText = result.text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\n/g, '<br>');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${result.metadata.title || file.fileName}</title>
  <style>
    body { 
      font-family: Arial, sans-serif; 
      line-height: 1.6; 
      max-width: 800px; 
      margin: 0 auto; 
      padding: 20px; 
      background-color: #f5f5f5;
    }
    .preview-container {
      background-color: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .title {
      color: #333;
      border-bottom: 2px solid #007bff;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    .metadata {
      color: #666;
      font-size: 0.9em;
      margin-bottom: 20px;
    }
    .content {
      white-space: pre-wrap;
      word-wrap: break-word;
    }
  </style>
</head>
<body>
  <div class="preview-container">
    <h1 class="title">${result.metadata.title || file.fileName}</h1>
    <div class="metadata">
      <p>文件名: ${file.fileName}</p>
      <p>MIME类型: ${file.mimeType}</p>
      <p>字数: ${result.metadata.wordCount || 0}</p>
      <p>块数: ${result.chunks.length}</p>
      ${result.metadata.createdAt ? `<p>创建时间: ${result.metadata.createdAt.toLocaleDateString()}</p>` : ''}
    </div>
    <div class="content">${escapedText}</div>
  </div>
</body>
</html>`;
  }

  /**
   * 生成JSON预览
   * @param file - 文件对象
   * @param result - 处理结果
   * @returns JSON预览
   */
  protected generateJsonPreview(
    file: LoadedFile,
    result: FileProcessorResult,
  ): string {
    return JSON.stringify(
      {
        file: {
          name: file.fileName,
          mimeType: file.mimeType,
        },
        metadata: result.metadata,
        processing: {
          status: result.status,
          chunkCount: result.chunks.length,
          wordCount: result.metadata.wordCount,
          processingTime: result.processingTime,
        },
        preview:
          result.text.substring(0, 200) +
          (result.text.length > 200 ? '...' : ''),
      },
      null,
      2,
    );
  }

  // 默认实现：是否能处理（基类返回 false，子类覆盖）
  /**
   * 判断处理器是否可处理给定文件（基类默认 false，子类应重写）
   * @param _file - 已加载文件
   * @returns 是否可处理
   */
  public canHandle(_file: LoadedFile): boolean {
    return false;
  }

  /**
   * 返回处理器支持的格式（基类返回空集合，子类应重写）
   * @returns 支持的 MIME 类型和扩展名
   */
  public getSupportedFormats(): { mimeTypes: string[]; extensions: string[] } {
    return { mimeTypes: [], extensions: [] };
  }
}
