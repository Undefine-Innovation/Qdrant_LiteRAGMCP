import { DocumentChunk } from '@domain/entities/types.js';
import { LoadedFile } from '@domain/services/loader.js';

/**
 * 文件处理器接口
 * 定义了文件处理器的核心功能，包括格式检测、内容提取和分块处理
 */
export interface IFileProcessor {
  /**
   * 检查是否可以处理指定的文件
   * @param file - 已加载的文件对象
   * @returns 是否可以处理该文件
   */
  canHandle(file: LoadedFile): boolean;

  /**
   * 获取支持的文件格式列表
   * @returns 支持的MIME类型和文件扩展名数组
   */
  getSupportedFormats(): {
    mimeTypes: string[];
    extensions: string[];
  };

  /**
   * 获取处理器优先级（数值越高优先级越高）
   * @returns 优先级数值
   */
  getPriority(): number;

  /**
   * 处理文件内容，提取文本并进行分块
   * @param file - 已加载的文件对象
   * @param options - 处理选项
   * @returns 处理结果，包含文本块和元数据
   */
  process(
    file: LoadedFile,
    options?: FileProcessorOptions,
  ): Promise<FileProcessorResult>;

  /**
   * 生成文件预览内容
   * @param file - 已加载的文件对象
   * @param format - 预览格式
   * @returns 预览内容
   */
  generatePreview(
    file: LoadedFile,
    format?: 'html' | 'text' | 'json',
  ): Promise<string>;

  /**
   * 生成文件缩略图
   * @param file - 已加载的文件对象
   * @param size - 缩略图尺寸
   * @returns 缩略图数据（Base64或Buffer）
   */
  generateThumbnail(
    file: LoadedFile,
    size?: { width: number; height: number },
  ): Promise<string | Buffer>;
}

/**
 * 文件处理器选项
 */
export interface FileProcessorOptions {
  /**
   * 分块策略
   */
  chunkingStrategy?:
    | 'auto'
    | 'by_headings'
    | 'by_size'
    | 'by_sentences'
    | 'by_sections';

  /**
   * 最大块大小（字符数）
   */
  maxChunkSize?: number;

  /**
   * 块之间的重叠字符数
   */
  chunkOverlap?: number;

  /**
   * 是否保留原始格式信息
   */
  preserveFormatting?: boolean;

  /**
   * 语言设置（用于文本处理）
   */
  language?: string;

  /**
   * 自定义处理参数
   */
  customParams?: Record<string, unknown>;

  /**
   * 最大标题深度（用于按标题分块）
   */
  maxHeadingDepth?: number;
}

/**
 * 文件处理器结果
 */
export interface FileProcessorResult {
  /**
   * 提取的文本内容
   */
  text: string;

  /**
   * 文档块数组
   */
  chunks: DocumentChunk[];

  /**
   * 文件元数据
   */
  metadata: FileMetadata;

  /**
   * 处理状态
   */
  status: 'success' | 'partial' | 'error';

  /**
   * 错误信息（如果有）
   */
  error?: string;

  /**
   * 处理耗时（毫秒）
   */
  processingTime?: number;
}

/**
 * 文件元数据
 */
export interface FileMetadata {
  /**
   * 文件标题
   */
  title?: string;

  /**
   * 作者信息
   */
  author?: string;

  /**
   * 创建时间
   */
  createdAt?: Date;

  /**
   * 修改时间
   */
  modifiedAt?: Date;

  /**
   * 文档语言
   */
  language?: string;

  /**
   * 页数或段落数
   */
  pageCount?: number;

  /**
   * 字数统计
   */
  wordCount?: number;

  /**
   * 自定义元数据
   */
  custom?: Record<string, unknown>;
  /**
   * 额外可选字段，供不同处理器使用
   */
  fileType?: string;
  /** Markdown-specific info (parser metadata) */
  markdownInfo?: Record<string, unknown>;
  lineCount?: number;
  characterCount?: number;
  /** Code block metadata (language, snippet, line count) */
  codeInfo?:
    | { language?: string; lines?: number; snippet?: string }
    | Record<string, unknown>;
}

/**
 * 文件处理器注册表接口
 */
export interface IFileProcessorRegistry {
  /**
   * 注册文件处理器
   * @param processor - 文件处理器实例
   */
  register(processor: IFileProcessor): void;

  /**
   * 注销文件处理器
   * @param processorName - 处理器名称
   */
  unregister(processorName: string): void;

  /**
   * 获取能够处理指定文件的处理器
   * @param file - 文件对象
   * @returns 匹配的处理器，如果没有则返回null
   */
  getProcessor(file: LoadedFile): IFileProcessor | null;

  /**
   * 获取所有已注册的处理器
   * @returns 处理器数组
   */
  getAllProcessors(): IFileProcessor[];

  /**
   * 根据MIME类型获取处理器
   * @param mimeType - MIME类型
   * @returns 处理器数组
   */
  getProcessorsByMimeType(mimeType: string): IFileProcessor[];

  /**
   * 根据文件扩展名获取处理器
   * @param extension - 文件扩展名
   * @returns 处理器数组
   */
  getProcessorsByExtension(extension: string): IFileProcessor[];
}
