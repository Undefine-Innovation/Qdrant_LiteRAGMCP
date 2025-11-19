/**
 * 语义分块策略
 * 使用LLM服务进行智能语义分块
 */

import { ISplitter } from '@domain/interfaces/splitter.js';
import { SplitterOptions } from '@domain/interfaces/splitter.js';
import { ILLMService } from '@domain/interfaces/llm.js';
import { DocumentChunk } from '@infrastructure/external/index.js';
import { Logger } from '@logging/logger.js';

/**
 * 语义分块选项
 */
export interface SemanticSplitOptions extends SplitterOptions {
  /**
   * LLM服务实例
   */
  llmService: ILLMService;
  /**
   * 固定分块数量
   */
  maxChunks?: number;
  /**
   * 是否启用降级策略
   */
  enableFallback?: boolean;
  
  /**
   * 降级策略类型
   */
  fallbackStrategy?: 'by_size' | 'by_headings' | 'auto';
  
  /**
   * 最大重试次数
   */
  maxRetries?: number;
  
  /**
   * 重试延迟（毫秒）
   */
  retryDelay?: number;
  
  /**
   * 是否缓存结果
   */
  enableCache?: boolean;
  
  /**
   * 缓存TTL（毫秒）
   */
  cacheTTL?: number;
}

type NormalizedSemanticSplitOptions = Required<
  Omit<SemanticSplitOptions, 'separators' | 'name' | 'maxChunks'>
> & {
  separators?: string[];
  name?: string;
  maxChunks?: number;
};

/**
 * 缓存条目
 */
interface CacheEntry {
  chunks: DocumentChunk[];
  timestamp: number;
}

/**
 * 语义分块器
 * 使用LLM服务进行智能语义分块
 */
export class SemanticSplitter implements ISplitter {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly defaultOptions: NormalizedSemanticSplitOptions = {
    llmService: {} as ILLMService, // ���ڹ��캯��������
    enableFallback: true,
    fallbackStrategy: 'by_size',
    maxRetries: 3,
    retryDelay: 1000,
    enableCache: true,
    cacheTTL: 300000, // 5����
    maxChunkSize: 1000,
    chunkOverlap: 100,
    strategy: 'semantic',
  };

  /**
   * 构造函数
   * @param llmService - LLM服务实例
   * @param logger - 日志记录器
   * @param options - 语义分块选项
   */
  constructor(
    private readonly llmService: ILLMService,
    private readonly logger: Logger,
    options?: Partial<SemanticSplitOptions>
  ) {
    // 合并选项
    if (options) {
      Object.assign(this.defaultOptions, options);
    }
    this.defaultOptions.llmService = this.llmService;

    this.logger.info('SemanticSplitter已初始化', {
      provider: llmService.getProvider(),
      enableFallback: this.defaultOptions.enableFallback,
      fallbackStrategy: this.defaultOptions.fallbackStrategy,
      enableCache: this.defaultOptions.enableCache,
    });
  }

  /**
   * 获取默认选项
   * @returns 默认选项
   */
  public getDefaultOptions(): Record<string, unknown> {
    return {
      maxChunkSize: this.defaultOptions.maxChunkSize,
      chunkOverlap: this.defaultOptions.chunkOverlap,
      strategy: this.defaultOptions.strategy,
      enableFallback: this.defaultOptions.enableFallback,
      fallbackStrategy: this.defaultOptions.fallbackStrategy,
      maxRetries: this.defaultOptions.maxRetries,
      retryDelay: this.defaultOptions.retryDelay,
      enableCache: this.defaultOptions.enableCache,
      cacheTTL: this.defaultOptions.cacheTTL,
    };
  }

  /**
   * 分割文本为块
   * @param text - 要分割的文本
   * @param options - 分割选项
   * @returns 文本块数组
   */
  public async split(
    text: string,
    options?: Partial<SemanticSplitOptions>,
  ): Promise<DocumentChunk[]> {
    const startTime = Date.now();
    const semanticOptions = this.mergeOptions(options);

    try {
      this.logger.debug('开始语义分块', {
        textLength: text.length,
        strategy: semanticOptions.strategy,
        maxChunkSize: semanticOptions.maxChunkSize,
        enableCache: semanticOptions.enableCache,
      });

      // 检查缓存
      if (semanticOptions.enableCache) {
        const cached = this.getFromCache(text, semanticOptions);
        if (cached) {
          this.logger.debug('使用缓存结果', { chunkCount: cached.length });
          return cached;
        }
      }

      // 执行语义分块
      const chunks = await this.performSemanticSplit(text, semanticOptions);

      // 缓存结果
      if (semanticOptions.enableCache) {
        this.setCache(text, semanticOptions, chunks);
      }

      const processingTime = Date.now() - startTime;
      this.logger.debug('语义分块完成', {
        chunkCount: chunks.length,
        processingTime,
      });

      return chunks;
    } catch (error) {
      this.logger.error('语义分块失败', { error, options });

      // 使用降级策略
      if (semanticOptions.enableFallback) {
        this.logger.info('使用降级分块策略', {
          fallbackStrategy: semanticOptions.fallbackStrategy,
        });
        return this.performFallbackSplit(text, semanticOptions);
      }

      throw error;
    }
  }

  /**
   * 分割文本为字符串数组
   * @param text - 要分割的文本
   * @param options - 分割选项
   * @returns 字符串数组
   */
  public async splitText(
    text: string,
    options?: SplitterOptions,
  ): Promise<string[]> {
    const chunks = await this.split(text, options as Partial<SemanticSplitOptions>);
    return chunks.map((chunk) => chunk.content);
  }

  /**
   * 执行语义分块
   * @param text - 要分割的文本
   * @param options - 分块选项
   * @returns 文档块数组
   */
  private async performSemanticSplit(
    text: string,
    options: NormalizedSemanticSplitOptions,
  ): Promise<DocumentChunk[]> {
    let lastError: Error | null = null;

    // 重试机制
    for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
      try {
        // 检查LLM服务可用性
        const isAvailable = await this.llmService.isAvailable();
        if (!isAvailable) {
          throw new Error('LLM服务不可用');
        }

        // 调用LLM服务进行语义分块
        const result = await this.llmService.semanticSplit({
          text,
          targetChunkSize: options.maxChunkSize,
          chunkOverlap: options.chunkOverlap,
          strategy: options.strategy as 'coherent' | 'topic-based' | 'semantic' | 'balanced',
          maxChunks: options.maxChunks,
        });

        // 转换为DocumentChunk格式
        const chunks: DocumentChunk[] = result.chunks.map((content, index) => ({
          content,
          index,
          title: result.chunkTitles?.[index],
          titleChain: result.chunkTitles?.[index] ? [result.chunkTitles[index]] : undefined,
        }));

        return chunks;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`语义分块尝试 ${attempt} 失败`, { error });

        if (attempt < options.maxRetries) {
          // 等待后重试
          await new Promise((resolve) => setTimeout(resolve, options.retryDelay * attempt));
        }
      }
    }

    throw lastError || new Error('语义分块失败');
  }

  /**
   * 执行降级分块
   * @param text - 要分割的文本
   * @param options - 分块选项
   * @returns 文档块数组
   */
  private async performFallbackSplit(
    text: string,
    options: NormalizedSemanticSplitOptions,
  ): Promise<DocumentChunk[]> {
    switch (options.fallbackStrategy) {
      case 'by_size':
        return this.splitBySize(text, options);
      case 'by_headings':
        return this.splitByHeadings(text, options);
      case 'auto':
      default:
        return this.splitAuto(text, options);
    }
  }

  /**
   * 按大小分块
   * @param text - 要分割的文本
   * @param options - 分块选项
   * @returns 文档块数组
   */
  private splitBySize(
    text: string,
    options: NormalizedSemanticSplitOptions
  ): DocumentChunk[] {
    const maxChunkSize = options.maxChunkSize;
    const rawOverlap = options.chunkOverlap ?? 0;
    const overlap = Math.min(Math.max(rawOverlap, 0), maxChunkSize - 1);
    const step = Math.max(maxChunkSize - overlap, 1);
    const chunks: DocumentChunk[] = [];

    // 确保步长至少为一，避免 chunkOverlap 过大造成死循环
    for (let i = 0; i < text.length; i += step) {
      const content = text.slice(i, i + maxChunkSize).trim();
      if (content) {
        chunks.push({
          content,
          index: chunks.length,
        });
      }
    }

    return chunks;
  }

  /**
   * 按标题分块
   * @param text - 要分割的文本
   * @param options - 分块选项
   * @returns 文档块数组
   */
  private splitByHeadings(
    text: string,
    options: NormalizedSemanticSplitOptions
  ): DocumentChunk[] {
    const lines = text.split('\n');
    const chunks: DocumentChunk[] = [];
    let currentChunk = '';
    let currentTitle = '';
    let chunkIndex = 0;

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      
      if (headingMatch) {
        // 保存当前块
        if (currentChunk.trim()) {
          chunks.push({
            content: currentChunk.trim(),
            index: chunkIndex++,
            title: currentTitle || undefined,
            titleChain: currentTitle ? [currentTitle] : undefined,
          });
        }
        
        // 开始新块
        currentTitle = headingMatch[2];
        currentChunk = line + '\n';
      } else {
        currentChunk += line + '\n';
      }
    }

    // 添加最后一个块
    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        index: chunkIndex,
        title: currentTitle || undefined,
        titleChain: currentTitle ? [currentTitle] : undefined,
      });
    }

    // 检查块大小，如果过大则进一步分割
    const maxChunkSize = options.maxChunkSize;
    const result: DocumentChunk[] = [];

    for (const chunk of chunks) {
      if (chunk.content.length <= maxChunkSize) {
        result.push(chunk);
      } else {
        // 对大块进行二次分割
        const subChunks = this.splitBySize(chunk.content, options);
        for (let i = 0; i < subChunks.length; i++) {
          result.push({
            ...subChunks[i],
            title: i === 0 ? chunk.title : `${chunk.title} (部分 ${i + 1})`,
            titleChain: chunk.titleChain,
          });
        }
      }
    }

    return result;
  }

  /**
   * 自动分块
   * @param text - 要分割的文本
   * @param options - 分块选项
   * @returns 文档块数组
   */
  private splitAuto(
    text: string,
    options: NormalizedSemanticSplitOptions
  ): DocumentChunk[] {
    // 检测是否为Markdown内容
    const hasHeadings = this.hasSignificantHeadings(text);
    const isMarkdown = this.detectMarkdown(text);

    // 记录自动分块的检测结果，便于追踪是否按照标题分块
    this.logger.debug('splitAuto检测', { isMarkdown, hasHeadings });

    if (hasHeadings) {
      return this.splitByHeadings(text, options);
    }

    return this.splitBySize(text, options);
  }

  /**
   * 检测是否为Markdown内容
   * @param content - 文本内容
   * @returns 是否为Markdown内容
   */
  private detectMarkdown(content: string): boolean {
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
      pattern.test(content)
    ).length;
    return matchCount >= 2; // 至少匹配2个模式才认为是Markdown
  }

  /**
   * 检测是否有重要标题
   * @param content - 文本内容
   * @returns 是否有重要标题
   */
  private hasSignificantHeadings(content: string): boolean {
    const headingMatches = content.match(/^#{1,6}\s+.+$/gm);
    return !!headingMatches && headingMatches.length >= 2;
  }

  /**
   * 合并选项
   * @param options - 用户提供的选项
   * @returns 合并后的选项
   */
  private mergeOptions(
    options?: Partial<SemanticSplitOptions>,
  ): NormalizedSemanticSplitOptions {
    return {
      ...this.defaultOptions,
      ...options,
      llmService: options?.llmService || this.llmService,
      maxChunkSize: options?.maxChunkSize ?? 1000,
      chunkOverlap: options?.chunkOverlap ?? 100,
      strategy: options?.strategy ?? 'semantic',
      separators: options?.separators ?? undefined,
      name: options?.name ?? undefined,
    };
  }

  /**
   * 生成缓存键
   * @param text - 文本内容
   * @param options - 分块选项
   * @returns 缓存键
   */
  private generateCacheKey(text: string, options: NormalizedSemanticSplitOptions): string {
    const keyData = {
      textHash: this.hashString(text),
      maxChunkSize: options.maxChunkSize,
      chunkOverlap: options.chunkOverlap,
      strategy: options.strategy,
    };
    return JSON.stringify(keyData);
  }

  /**
   * 字符串哈希函数
   * @param str - 要哈希的字符串
   * @returns 哈希值
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return hash.toString(36);
  }

  /**
   * 从缓存获取结果
   * @param text - 文本内容
   * @param options - 分块选项
   * @returns 缓存的结果或null
   */
  private getFromCache(
    text: string,
    options: NormalizedSemanticSplitOptions
  ): DocumentChunk[] | null {
    const key = this.generateCacheKey(text, options);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // 检查缓存是否过期
    if (Date.now() - entry.timestamp > options.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.chunks;
  }

  /**
   * 设置缓存
   * @param text - 文本内容
   * @param options - 分块选项
   * @param chunks - 分块结果
   */
  private setCache(
    text: string,
    options: NormalizedSemanticSplitOptions,
    chunks: DocumentChunk[]
  ): void {
    const key = this.generateCacheKey(text, options);
    this.cache.set(key, {
      chunks,
      timestamp: Date.now(),
    });

    // 清理过期缓存
    this.cleanExpiredCache(options.cacheTTL);
  }

  /**
   * 清理过期缓存
   * @param cacheTTL - 缓存TTL
   */
  private cleanExpiredCache(cacheTTL: number): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > cacheTTL) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 清空缓存
   */
  public clearCache(): void {
    this.cache.clear();
    this.logger.debug('语义分块缓存已清空');
  }

  /**
   * 获取缓存统计信息
   * @returns 缓存统计信息
   */
  public getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}
