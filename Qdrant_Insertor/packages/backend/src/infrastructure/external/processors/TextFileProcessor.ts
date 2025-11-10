import { Logger } from '@logging/logger.js';
import { BaseFileProcessor } from '@infrastructure/external/BaseFileProcessor.js';
import {
  FileProcessorOptions,
  FileMetadata,
} from '@domain/services/fileProcessor.js';
import { LoadedFile } from '@domain/services/loader.js';
import { DocumentChunk } from '@domain/entities/types.js';

/**
 * 文本文件处理器
 * 处理纯文本文件和代码文件
 */
export class TextFileProcessor extends BaseFileProcessor {
  private static readonly SUPPORTED_MIME_TYPES = [
    'text/plain',
    'text/html',
    'text/css',
    'text/javascript',
    'text/typescript',
    'text/xml',
    'text/csv',
    'application/json',
    'application/xml',
    'application/javascript',
    'application/x-javascript',
  ];

  private static readonly SUPPORTED_EXTENSIONS = [
    'txt',
    'log',
    'csv',
    'json',
    'xml',
    'yaml',
    'yml',
    'toml',
    'ini',
    'js',
    'jsx',
    'ts',
    'tsx',
    'mjs',
    'cjs',
    'html',
    'htm',
    'css',
    'scss',
    'sass',
    'less',
    'py',
    'java',
    'cpp',
    'c',
    'cs',
    'php',
    'rb',
    'go',
    'rs',
    'swift',
    'kt',
    'scala',
    'sql',
    'sh',
    'bat',
    'ps1',
    'vue',
    'svelte',
  ];

  /**
   * 构造函数
   * @param logger - 日志记录器
   */
  constructor(logger: Logger) {
    super(logger);
    this.logger.info('文本文件处理器已初始化');
  }

  /**
   * 检查是否可以处理指定的文件
   * @param file - 已加载的文件对象
   * @returns 是否可以处理该文件
   */
  public canHandle(file: LoadedFile): boolean {
    // 检查MIME类型
    if (
      TextFileProcessor.SUPPORTED_MIME_TYPES.includes(
        file.mimeType.toLowerCase(),
      )
    ) {
      return true;
    }

    // 检查文件扩展名
    const extension = this.getFileExtension(file.fileName);
    if (TextFileProcessor.SUPPORTED_EXTENSIONS.includes(extension)) {
      return true;
    }

    // 检查内容是否为文本（通过检查是否包含非打印字符）
    try {
      // 尝试检测是否为二进制文件
      const sample = file.content.slice(0, 1000);
      // 检测非打印字符（通过字符码判断，避免在正则字面量中使用控制字符）
      const nonPrintableCount = Array.from(sample).reduce((acc, ch) => {
        const code = ch.charCodeAt(0);
        return acc + (code < 32 || code === 127 ? 1 : 0);
      }, 0);

      // 如果非打印字符超过总字符的1%，认为是二进制/非文本文件
      if (nonPrintableCount / Math.max(1, sample.length) > 0.01) {
        return false;
      }

      // 检查是否包含常见的文本模式
      const textPatterns = [
        /\w{2,}/, // 包含连续的字母数字字符
        /[.!?]/, // 包含句子结束符
        /\s/, // 包含空白字符
      ];

      const patternMatches = textPatterns.filter((pattern) =>
        pattern.test(sample),
      ).length;
      return patternMatches >= 2;
    } catch {
      return false;
    }
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
      mimeTypes: [...TextFileProcessor.SUPPORTED_MIME_TYPES],
      extensions: [...TextFileProcessor.SUPPORTED_EXTENSIONS],
    };
  }

  /**
   * 获取处理器优先级
   * @returns 优先级数值
   */
  public getPriority(): number {
    return 10; // 中等优先级
  }

  /**
   * 提取文件文本内容
   * @param file - 文件对象
   * @returns 提取的文本内容
   */
  protected async extractText(file: LoadedFile): Promise<string> {
    // 对于文本文件，直接返回内容
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

    // 检测文件语言
    metadata.language = this.detectLanguage(file, text);

    // 检测文件类型
    metadata.fileType = this.detectFileType(file, text);

    // 统计行数
    metadata.lineCount = text.split('\n').length;

    // 统计字符数
    metadata.characterCount = text.length;

    // 对于代码文件，提取函数/类信息
    if (this.isCodeFile(file.fileName)) {
      metadata.codeInfo = this.extractCodeInfo(
        text,
        metadata.language as string,
      );
    }

    return metadata;
  }

  /**
   * 文本分块（针对文本文件优化）
   * @param text - 文本内容
   * @param options - 分块选项
   * @returns 文档块数组
   */
  protected async chunkText(
    text: string,
    options?: FileProcessorOptions,
  ): Promise<DocumentChunk[]> {
    const strategy = options?.chunkingStrategy || 'auto';

    switch (strategy) {
      case 'by_sentences':
        return this.chunkBySentences(text, options);
      case 'by_size':
        return this.chunkBySize(text, options);
      case 'by_headings':
        return this.chunkByHeadings(text, options);
      case 'auto':
      default:
        return this.autoChunk(text, options);
    }
  }

  /**
   * 检测文件语言
   * @param file - 文件对象
   * @param text - 文本内容
   * @returns 语言代码
   */
  private detectLanguage(file: LoadedFile, text: string): string {
    const extension = this.getFileExtension(file.fileName);

    // 根据文件扩展名确定语言
    const extensionLanguageMap: Record<string, string> = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      cs: 'csharp',
      php: 'php',
      rb: 'ruby',
      go: 'go',
      rs: 'rust',
      swift: 'swift',
      kt: 'kotlin',
      scala: 'scala',
      html: 'html',
      css: 'css',
      scss: 'scss',
      sass: 'sass',
      less: 'less',
      sql: 'sql',
      json: 'json',
      xml: 'xml',
      yaml: 'yaml',
      yml: 'yaml',
      toml: 'toml',
      ini: 'ini',
      sh: 'bash',
      bat: 'batch',
      ps1: 'powershell',
      vue: 'vue',
      svelte: 'svelte',
    };

    if (extensionLanguageMap[extension]) {
      return extensionLanguageMap[extension];
    }

    // 根据MIME类型确定语言
    const mimeTypeLanguageMap: Record<string, string> = {
      'text/html': 'html',
      'text/css': 'css',
      'text/javascript': 'javascript',
      'text/typescript': 'typescript',
      'application/json': 'json',
      'application/xml': 'xml',
      'application/javascript': 'javascript',
    };

    if (mimeTypeLanguageMap[file.mimeType.toLowerCase()]) {
      return mimeTypeLanguageMap[file.mimeType.toLowerCase()];
    }

    // 尝试通过内容检测语言
    if (this.isJsonContent(text)) {
      return 'json';
    }

    if (this.isXmlContent(text)) {
      return 'xml';
    }

    // 检测是否包含中文字符
    if (/[\u4e00-\u9fff]/.test(text)) {
      return 'chinese';
    }

    // 检测是否包含日文字符
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) {
      return 'japanese';
    }

    // 默认为英语
    return 'english';
  }

  /**
   * 检测文件类型
   * @param file - 文件对象
   * @param text - 文本内容
   * @returns 文件类型
   */
  private detectFileType(file: LoadedFile, text: string): string {
    const extension = this.getFileExtension(file.fileName);

    if (['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'].includes(extension)) {
      return 'code';
    }

    if (
      [
        'py',
        'java',
        'cpp',
        'c',
        'cs',
        'php',
        'rb',
        'go',
        'rs',
        'swift',
        'kt',
        'scala',
      ].includes(extension)
    ) {
      return 'code';
    }

    if (['html', 'htm', 'css', 'scss', 'sass', 'less'].includes(extension)) {
      return 'web';
    }

    if (['json', 'xml', 'yaml', 'yml', 'toml', 'ini'].includes(extension)) {
      return 'config';
    }

    if (['sql'].includes(extension)) {
      return 'database';
    }

    if (['sh', 'bat', 'ps1'].includes(extension)) {
      return 'script';
    }

    if (['log'].includes(extension)) {
      return 'log';
    }

    if (['csv'].includes(extension)) {
      return 'data';
    }

    // 通过内容检测
    if (this.isCodeContent(text)) {
      return 'code';
    }

    return 'text';
  }

  /**
   * 检查是否为代码文件
   * @param fileName - 文件名
   * @returns 是否为代码文件
   */
  private isCodeFile(fileName: string): boolean {
    const extension = this.getFileExtension(fileName);
    const codeExtensions = [
      'js',
      'jsx',
      'ts',
      'tsx',
      'mjs',
      'cjs',
      'py',
      'java',
      'cpp',
      'c',
      'cs',
      'php',
      'rb',
      'go',
      'rs',
      'swift',
      'kt',
      'scala',
      'html',
      'htm',
      'css',
      'scss',
      'sass',
      'less',
      'sql',
      'sh',
      'bat',
      'ps1',
    ];

    return codeExtensions.includes(extension);
  }

  /**
   * 提取代码信息
   * @param text - 代码内容
   * @param language - 编程语言
   * @returns 代码信息
   */
  private extractCodeInfo(
    text: string,
    language: string,
  ): Record<string, unknown> {
    const info: Record<string, unknown> = {
      functions: [],
      classes: [],
      imports: [],
    };

    switch (language) {
      case 'javascript':
      case 'typescript':
        this.extractJavaScriptInfo(text, info);
        break;
      case 'python':
        this.extractPythonInfo(text, info);
        break;
      case 'java':
        this.extractJavaInfo(text, info);
        break;
      // 可以添加更多语言的提取逻辑
    }

    return info;
  }

  /**
   * 提取JavaScript/TypeScript信息
   * @param text - 代码内容
   * @param info - 代码信息对象
   */
  private extractJavaScriptInfo(
    text: string,
    info: Record<string, unknown>,
  ): void {
    // 提取函数
    const functionMatches = text.match(
      /(?:function\s+(\w+)|(\w+)\s*=\s*(?:function|\([^)]*\)\s*=>))/g,
    );
    if (functionMatches) {
      info.functions = functionMatches.map((match) => {
        const nameMatch = match.match(/(\w+)/);
        return nameMatch ? nameMatch[1] : 'anonymous';
      });
    }

    // 提取类
    const classMatches = text.match(/class\s+(\w+)/g);
    if (classMatches) {
      info.classes = classMatches.map((match) => match.replace('class ', ''));
    }

    // 提取导入
    const importMatches = text.match(/import\s+.*?from\s+['"]([^'"]+)['"]/g);
    if (importMatches) {
      info.imports = importMatches
        .map((match) => {
          const moduleMatch = match.match(/from\s+['"]([^'"]+)['"]/);
          return moduleMatch ? moduleMatch[1] : '';
        })
        .filter(Boolean);
    }
  }

  /**
   * 提取Python信息
   * @param text - 代码内容
   * @param info - 代码信息对象
   */
  private extractPythonInfo(text: string, info: Record<string, unknown>): void {
    // 提取函数
    const functionMatches = text.match(/def\s+(\w+)\s*\(/g);
    if (functionMatches) {
      info.functions = functionMatches.map((match) =>
        match.replace('def ', '').replace('(', ''),
      );
    }

    // 提取类
    const classMatches = text.match(/class\s+(\w+)/g);
    if (classMatches) {
      info.classes = classMatches.map((match) => match.replace('class ', ''));
    }

    // 提取导入
    const importMatches = text.match(
      /(?:import\s+(\w+)|from\s+(\w+)\s+import)/g,
    );
    if (importMatches) {
      info.imports = importMatches
        .map((match) => {
          const nameMatch = match.match(/\w+/);
          return nameMatch ? nameMatch[0] : '';
        })
        .filter(Boolean);
    }
  }

  /**
   * 提取Java信息
   * @param text - 代码内容
   * @param info - 代码信息对象
   */
  private extractJavaInfo(text: string, info: Record<string, unknown>): void {
    // 提取方法
    const methodMatches = text.match(
      /(?:public|private|protected)?\s*(?:static\s+)?(?:\w+\s+)?(\w+)\s*\([^)]*\)\s*(?:throws\s+[\w\s,]+)?\s*{/g,
    );
    if (methodMatches) {
      info.functions = methodMatches
        .map((match) => {
          const nameMatch = match.match(/(\w+)\s*\(/);
          return nameMatch ? nameMatch[1] : '';
        })
        .filter(Boolean);
    }

    // 提取类
    const classMatches = text.match(/(?:public\s+)?class\s+(\w+)/g);
    if (classMatches) {
      info.classes = classMatches
        .map((match) => {
          const nameMatch = match.match(/class\s+(\w+)/);
          return nameMatch ? nameMatch[1] : '';
        })
        .filter(Boolean);
    }

    // 提取导入
    const importMatches = text.match(/import\s+([\w.]+);/g);
    if (importMatches) {
      info.imports = importMatches
        .map((match) => {
          const packageMatch = match.match(/import\s+([\w.]+);/);
          return packageMatch ? packageMatch[1] : '';
        })
        .filter(Boolean);
    }
  }

  /**
   * 按句子分块
   * @param text - 文本内容
   * @param options - 分块选项
   * @returns 文档块数组
   */
  private chunkBySentences(
    text: string,
    options?: FileProcessorOptions,
  ): DocumentChunk[] {
    const maxChunkSize = options?.maxChunkSize || 1000;
    const overlap = options?.chunkOverlap || 100;

    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const chunks: DocumentChunk[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if (
        currentChunk.length + sentence.length > maxChunkSize &&
        currentChunk.length > 0
      ) {
        chunks.push({ content: currentChunk.trim() });
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? '. ' : '') + sentence;
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
   * 按标题分块
   * @param text - 文本内容
   * @param options - 分块选项
   * @returns 文档块数组
   */
  private chunkByHeadings(
    text: string,
    options?: FileProcessorOptions,
  ): DocumentChunk[] {
    const lines = text.split('\n');
    const chunks: DocumentChunk[] = [];
    let currentChunk = '';
    let currentTitle = '';

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch) {
        if (currentChunk.trim()) {
          chunks.push({
            content: currentChunk.trim(),
            titleChain: currentTitle ? [currentTitle] : undefined,
          });
        }
        currentTitle = headingMatch[2];
        currentChunk = line;
      } else {
        currentChunk += '\n' + line;
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        titleChain: currentTitle ? [currentTitle] : undefined,
      });
    }

    return chunks;
  }

  /**
   * 自动分块
   * @param text - 文本内容
   * @param options - 分块选项
   * @returns 文档块数组
   */
  private async autoChunk(
    text: string,
    options?: FileProcessorOptions,
  ): Promise<DocumentChunk[]> {
    // 检测是否为Markdown
    if (this.isMarkdownContent(text)) {
      return this.chunkByHeadings(text, options);
    }

    // 检测是否为代码
    if (this.isCodeContent(text)) {
      return this.chunkBySize(text, options);
    }

    // 默认按句子分块
    return this.chunkBySentences(text, options);
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
    return matchCount >= 2;
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
    return matchCount >= 2;
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
}
