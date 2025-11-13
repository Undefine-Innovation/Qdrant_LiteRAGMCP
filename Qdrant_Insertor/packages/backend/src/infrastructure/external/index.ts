/**
 * 外部服务集成模块主导出文件
 * 导出所有外部服务集成的实现
 */

// 基础接口和类型
export interface IFileProcessor {
  canHandle(file: LoadedFile): boolean;
  getSupportedFormats(): { mimeTypes: string[]; extensions: string[] };
  getPriority(): number;
  process(
    file: LoadedFile,
    options?: FileProcessorOptions,
  ): Promise<FileProcessorResult>;
  generatePreview?(
    file: LoadedFile,
    format?: 'html' | 'text' | 'json',
  ): Promise<string>;
  generateThumbnail?(
    file: LoadedFile,
    size?: { width: number; height: number },
  ): Promise<string>;
}

export interface IFileProcessorRegistry {
  register(processor: IFileProcessor): void;
  unregister(processor: IFileProcessor): void;
  getProcessor(mimeType: string, extension?: string): IFileProcessor | null;
  getProcessors(mimeType: string): IFileProcessor[];
  getAllProcessors(): IFileProcessor[];
  // Optional helper to select processor based on the full LoadedFile
  getProcessorForFile?(file: LoadedFile): IFileProcessor | null;
}

export interface FileProcessorOptions {
  maxChunkSize?: number;
  chunkOverlap?: number;
  // 扩展可接受的策略名称，兼容不同实现
  chunkingStrategy?:
    | 'by_sentences'
    | 'by_size'
    | 'by_headings'
    | 'by_sections'
    | 'auto';
  maxHeadingDepth?: number;
  preserveFormatting?: boolean;
}

export interface FileProcessorResult {
  success?: boolean;
  // Make core fields required so consumers don't need to guard every access.
  chunks: DocumentChunk[];
  metadata: FileMetadata;
  error?: unknown; // allow string or Error
  text: string;
  status?: 'success' | 'error' | string;
  processingTime?: number;
}

export interface FileMetadata {
  // Many processors only populate subset of metadata; make primary
  // properties optional to allow lightweight implementations.
  fileName?: string;
  mimeType?: string;
  size?: number;
  language?: string;
  fileType?: string;
  lineCount?: number;
  characterCount?: number;
  codeInfo?: Record<string, unknown>;
  title?: string;
  wordCount?: number;
  createdAt?: Date;
  // 扩展字段以兼容 markdown 处理器等
  markdownInfo?: unknown;
}

export interface LoadedFile {
  content: string;
  fileName: string;
  mimeType: string;
  size?: number;
}

export interface DocumentChunk {
  content: string;
  index?: number;
  title?: string;
  titleChain?: string[];
}

// 实现类导出
export * from './BaseFileProcessor.js';
export * from './ContentExtractor.js';
export * from './DefaultStreamFileLoader.js';
export * from './FileFormatDetector.js';
export * from './FileProcessorRegistry.js';
export * from './LocalFileLoader.js';
export * from './MarkdownSplitter.js';
export * from './MarkdownSplitterAdapter.js';
export * from './OpenAIEmbeddingProvider.js';
export * from './WebCrawler.js';

// 处理器实现
export * from './processors/index.js';
