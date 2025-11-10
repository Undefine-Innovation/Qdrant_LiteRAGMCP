import { Logger } from '@logging/logger.js';
import { LoadedFile } from '@domain/services/loader.js';
import {
  IFileProcessorRegistry,
  IFileProcessor,
} from '@domain/services/fileProcessor.js';

/**
 * 文件格式检测结果
 */
export interface FormatDetectionResult {
  /**
   * 检测到的MIME类型
   */
  mimeType: string;

  /**
   * 文件扩展名
   */
  extension: string;

  /**
   * 文件类别
   */
  category: FileCategory;

  /**
   * 置信度（0-1）
   */
  confidence: number;

  /**
   * 检测方法
   */
  detectionMethod: 'mime_type' | 'extension' | 'content' | 'processor';

  /**
   * 是否有处理器支持
   */
  hasProcessor: boolean;

  /**
   * 支持的处理器列表
   */
  supportedProcessors: string[];
}

/**
 * 文件类别枚举
 */
export type FileCategory =
  | 'text'
  | 'markdown'
  | 'pdf'
  | 'word'
  | 'excel'
  | 'powerpoint'
  | 'image'
  | 'audio'
  | 'video'
  | 'archive'
  | 'code'
  | 'unknown';

/**
 * 文件格式检测器
 * 负责动态检测文件格式并确定最佳处理器
 */
export class FileFormatDetector {
  private readonly MIME_TYPE_MAPPINGS: Record<
    string,
    { category: FileCategory; confidence: number }
  > = {
    // 文本文件
    'text/plain': { category: 'text', confidence: 0.9 },
    'text/html': { category: 'text', confidence: 0.9 },
    'text/css': { category: 'code', confidence: 0.9 },
    'text/javascript': { category: 'code', confidence: 0.9 },
    'text/typescript': { category: 'code', confidence: 0.9 },
    'text/xml': { category: 'code', confidence: 0.9 },
    'text/csv': { category: 'text', confidence: 0.8 },

    // Markdown
    'text/markdown': { category: 'markdown', confidence: 0.95 },
    'text/x-markdown': { category: 'markdown', confidence: 0.95 },

    // PDF
    'application/pdf': { category: 'pdf', confidence: 0.95 },

    // Microsoft Office
    'application/msword': { category: 'word', confidence: 0.95 },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
      category: 'word',
      confidence: 0.95,
    },
    'application/vnd.ms-excel': { category: 'excel', confidence: 0.95 },
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
      category: 'excel',
      confidence: 0.95,
    },
    'application/vnd.ms-powerpoint': {
      category: 'powerpoint',
      confidence: 0.95,
    },
    'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      { category: 'powerpoint', confidence: 0.95 },

    // 图片
    'image/jpeg': { category: 'image', confidence: 0.95 },
    'image/png': { category: 'image', confidence: 0.95 },
    'image/gif': { category: 'image', confidence: 0.95 },
    'image/webp': { category: 'image', confidence: 0.95 },
    'image/svg+xml': { category: 'image', confidence: 0.9 },

    // 音频
    'audio/mpeg': { category: 'audio', confidence: 0.95 },
    'audio/wav': { category: 'audio', confidence: 0.95 },
    'audio/ogg': { category: 'audio', confidence: 0.95 },

    // 视频
    'video/mp4': { category: 'video', confidence: 0.95 },
    'video/avi': { category: 'video', confidence: 0.95 },
    'video/mov': { category: 'video', confidence: 0.95 },
    'video/webm': { category: 'video', confidence: 0.95 },

    // 压缩文件
    'application/zip': { category: 'archive', confidence: 0.95 },
    'application/x-rar-compressed': { category: 'archive', confidence: 0.95 },
    'application/x-7z-compressed': { category: 'archive', confidence: 0.95 },
    'application/gzip': { category: 'archive', confidence: 0.95 },
  };

  private readonly EXTENSION_MAPPINGS: Record<
    string,
    { category: FileCategory; confidence: number }
  > = {
    // 文本文件
    '.txt': { category: 'text', confidence: 0.8 },
    '.log': { category: 'text', confidence: 0.8 },
    '.csv': { category: 'text', confidence: 0.7 },

    // Markdown
    '.md': { category: 'markdown', confidence: 0.9 },
    '.markdown': { category: 'markdown', confidence: 0.9 },

    // PDF
    '.pdf': { category: 'pdf', confidence: 0.9 },

    // Microsoft Office
    '.doc': { category: 'word', confidence: 0.9 },
    '.docx': { category: 'word', confidence: 0.9 },
    '.xls': { category: 'excel', confidence: 0.9 },
    '.xlsx': { category: 'excel', confidence: 0.9 },
    '.ppt': { category: 'powerpoint', confidence: 0.9 },
    '.pptx': { category: 'powerpoint', confidence: 0.9 },

    // 代码文件
    '.js': { category: 'code', confidence: 0.8 },
    '.ts': { category: 'code', confidence: 0.8 },
    '.jsx': { category: 'code', confidence: 0.8 },
    '.tsx': { category: 'code', confidence: 0.8 },
    '.py': { category: 'code', confidence: 0.8 },
    '.java': { category: 'code', confidence: 0.8 },
    '.cpp': { category: 'code', confidence: 0.8 },
    '.c': { category: 'code', confidence: 0.8 },
    '.cs': { category: 'code', confidence: 0.8 },
    '.php': { category: 'code', confidence: 0.8 },
    '.rb': { category: 'code', confidence: 0.8 },
    '.go': { category: 'code', confidence: 0.8 },
    '.rs': { category: 'code', confidence: 0.8 },
    '.swift': { category: 'code', confidence: 0.8 },
    '.kt': { category: 'code', confidence: 0.8 },
    '.scala': { category: 'code', confidence: 0.8 },
    '.html': { category: 'code', confidence: 0.8 },
    '.css': { category: 'code', confidence: 0.8 },
    '.scss': { category: 'code', confidence: 0.8 },
    '.sass': { category: 'code', confidence: 0.8 },
    '.less': { category: 'code', confidence: 0.8 },
    '.xml': { category: 'code', confidence: 0.8 },
    '.json': { category: 'code', confidence: 0.8 },
    '.yaml': { category: 'code', confidence: 0.8 },
    '.yml': { category: 'code', confidence: 0.8 },
    '.toml': { category: 'code', confidence: 0.8 },
    '.ini': { category: 'code', confidence: 0.8 },
    '.sql': { category: 'code', confidence: 0.8 },
    '.sh': { category: 'code', confidence: 0.8 },
    '.bat': { category: 'code', confidence: 0.8 },
    '.ps1': { category: 'code', confidence: 0.8 },

    // 图片
    '.jpg': { category: 'image', confidence: 0.9 },
    '.jpeg': { category: 'image', confidence: 0.9 },
    '.png': { category: 'image', confidence: 0.9 },
    '.gif': { category: 'image', confidence: 0.9 },
    '.webp': { category: 'image', confidence: 0.9 },
    '.svg': { category: 'image', confidence: 0.8 },
    '.bmp': { category: 'image', confidence: 0.9 },
    '.tiff': { category: 'image', confidence: 0.9 },

    // 音频
    '.mp3': { category: 'audio', confidence: 0.9 },
    '.wav': { category: 'audio', confidence: 0.9 },
    '.ogg': { category: 'audio', confidence: 0.9 },
    '.flac': { category: 'audio', confidence: 0.9 },
    '.aac': { category: 'audio', confidence: 0.9 },

    // 视频
    '.mp4': { category: 'video', confidence: 0.9 },
    '.avi': { category: 'video', confidence: 0.9 },
    '.mov': { category: 'video', confidence: 0.9 },
    '.wmv': { category: 'video', confidence: 0.9 },
    '.flv': { category: 'video', confidence: 0.9 },
    '.webm': { category: 'video', confidence: 0.9 },
    '.mkv': { category: 'video', confidence: 0.9 },

    // 压缩文件
    '.zip': { category: 'archive', confidence: 0.9 },
    '.rar': { category: 'archive', confidence: 0.9 },
    '.7z': { category: 'archive', confidence: 0.9 },
    '.tar': { category: 'archive', confidence: 0.9 },
    '.gz': { category: 'archive', confidence: 0.9 },
    '.bz2': { category: 'archive', confidence: 0.9 },
  };

  /**
   * 构造函数
   * @param processorRegistry - 文件处理器注册表
   * @param logger - 日志记录器
   */
  constructor(
    private readonly processorRegistry: IFileProcessorRegistry,
    private readonly logger: Logger,
  ) {
    this.logger.info('文件格式检测器已初始化');
  }

  /**
   * 检测文件格式
   * @param file - 已加载的文件对象
   * @returns 格式检测结果
   */
  public async detectFormat(file: LoadedFile): Promise<FormatDetectionResult> {
    const startTime = Date.now();

    // 1. 首先尝试通过MIME类型检测
    const mimeTypeResult = this.detectByMimeType(file.mimeType);

    // 2. 尝试通过文件扩展名检测
    const extension = this.extractExtension(file.fileName);
    const extensionResult = extension
      ? this.detectByExtension(extension)
      : null;

    // 3. 尝试通过内容检测（对于文本文件）
    const contentResult = await this.detectByContent(file);

    // 4. 检查是否有处理器支持
    const processor = this.processorRegistry.getProcessor(file);
    const supportedProcessors = this.getSupportedProcessors(file);

    // 5. 综合所有检测结果，选择最佳匹配
    const finalResult = this.combineResults(
      mimeTypeResult,
      extensionResult,
      contentResult,
      processor,
      supportedProcessors,
    );

    const processingTime = Date.now() - startTime;
    this.logger.debug(
      `文件格式检测完成: ${file.fileName} -> ${finalResult.mimeType} (${finalResult.category}) ` +
        `置信度: ${finalResult.confidence.toFixed(2)} 耗时: ${processingTime}ms`,
    );

    return finalResult;
  }

  /**
   * 通过MIME类型检测
   * @param mimeType - MIME类型
   * @returns 检测结果
   */
  private detectByMimeType(mimeType: string): {
    category: FileCategory;
    confidence: number;
  } | null {
    const mapping = this.MIME_TYPE_MAPPINGS[mimeType.toLowerCase()];
    if (mapping) {
      return {
        category: mapping.category,
        confidence: mapping.confidence,
      };
    }
    return null;
  }

  /**
   * 通过文件扩展名检测
   * @param extension - 文件扩展名
   * @returns 检测结果
   */
  private detectByExtension(extension: string): {
    category: FileCategory;
    confidence: number;
  } | null {
    const normalizedExt = extension.toLowerCase();
    const mapping = this.EXTENSION_MAPPINGS[normalizedExt];
    if (mapping) {
      return {
        category: mapping.category,
        confidence: mapping.confidence,
      };
    }
    return null;
  }

  /**
   * 通过文件内容检测
   * @param file - 文件对象
   * @returns 检测结果
   */
  private async detectByContent(file: LoadedFile): Promise<{
    category: FileCategory;
    confidence: number;
  } | null> {
    const content = file.content.trim();
    if (!content) {
      return null;
    }

    // 检测Markdown内容
    if (this.isMarkdownContent(content)) {
      return { category: 'markdown', confidence: 0.85 };
    }

    // 检测代码内容
    if (this.isCodeContent(content)) {
      return { category: 'code', confidence: 0.7 };
    }

    // 检测JSON内容
    if (this.isJsonContent(content)) {
      return { category: 'code', confidence: 0.9 };
    }

    // 检测XML内容
    if (this.isXmlContent(content)) {
      return { category: 'code', confidence: 0.9 };
    }

    // 默认为文本
    return { category: 'text', confidence: 0.5 };
  }

  /**
   * 综合检测结果
   * @param mimeTypeResult - MIME类型检测结果
   * @param extensionResult - 扩展名检测结果
   * @param contentResult - 内容检测结果
   * @param processor - 匹配的处理器
   * @param supportedProcessors - 支持的处理器列表
   * @returns 最终检测结果
   */
  private combineResults(
    mimeTypeResult: { category: FileCategory; confidence: number } | null,
    extensionResult: { category: FileCategory; confidence: number } | null,
    contentResult: { category: FileCategory; confidence: number } | null,
    processor: IFileProcessor | null,
    supportedProcessors: string[],
  ): FormatDetectionResult {
    // 按置信度排序结果
    const results: Array<{
      category: FileCategory;
      confidence: number;
      method: string;
    }> = [];

    if (mimeTypeResult) {
      results.push({ ...mimeTypeResult, method: 'mime_type' });
    }

    if (extensionResult) {
      results.push({ ...extensionResult, method: 'extension' });
    }

    if (contentResult) {
      results.push({ ...contentResult, method: 'content' });
    }

    // 选择置信度最高的结果
    const bestResult =
      results.length > 0
        ? results.reduce((best, current) =>
            current.confidence > best.confidence ? current : best,
          )
        : {
            category: 'unknown' as FileCategory,
            confidence: 0.1,
            method: 'mime_type',
          };

    // 如果有处理器支持，提高置信度
    if (processor) {
      // 增加置信度但不修改 bestResult 对象引用
      bestResult.confidence = Math.min(bestResult.confidence + 0.2, 1.0);
      bestResult.method = 'processor';
    }

    return {
      mimeType: 'application/octet-stream', // 默认值，将在后续更新
      extension: '', // 将在调用处设置
      category: bestResult.category,
      confidence: bestResult.confidence,
      detectionMethod:
        bestResult.method as FormatDetectionResult['detectionMethod'],
      hasProcessor: !!processor,
      supportedProcessors,
    };
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
   * 检测是否为代码内容
   * @param content - 文件内容
   * @returns 是否为代码
   */
  private isCodeContent(content: string): boolean {
    const codePatterns = [
      /function\s+\w+\s*\(/, // 函数定义
      /class\s+\w+/, // 类定义
      /import\s+.*from/, // 导入语句
      /const\s+\w+\s*=/, // 常量定义
      /let\s+\w+\s*=/, // 变量定义
      /if\s*\(/, // 条件语句
      /for\s*\(/, // 循环语句
      /while\s*\(/, // while循环
      /\/\*[\s\S]*?\*\//, // 多行注释
      /\/\/.*$/, // 单行注释
    ];

    const matchCount = codePatterns.filter((pattern) =>
      pattern.test(content),
    ).length;
    return matchCount >= 2; // 至少匹配2个模式才认为是代码
  }

  /**
   * 检测是否为JSON内容
   * @param content - 文件内容
   * @returns 是否为JSON
   */
  private isJsonContent(content: string): boolean {
    try {
      JSON.parse(content);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 检测是否为XML内容
   * @param content - 文件内容
   * @returns 是否为XML
   */
  private isXmlContent(content: string): boolean {
    const xmlPattern = /^\s*<\?xml|^\s*<[^>]+>/;
    return xmlPattern.test(content.trim());
  }

  /**
   * 获取支持的处理器列表
   * @param file - 文件对象
   * @returns 处理器名称列表
   */
  private getSupportedProcessors(file: LoadedFile): string[] {
    return this.processorRegistry
      .getAllProcessors()
      .filter((processor) => processor.canHandle(file))
      .map((processor) => processor.constructor.name);
  }

  /**
   * 从文件名中提取扩展名
   * @param fileName - 文件名
   * @returns 扩展名（包含点号），如果没有则返回空字符串
   */
  private extractExtension(fileName: string): string {
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1 || lastDotIndex === fileName.length - 1) {
      return '';
    }
    return fileName.substring(lastDotIndex);
  }
}
