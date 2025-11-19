import { ISplitter } from '@application/services/file-processing/index.js';
import { DocumentChunk, SplitOptions } from '@domain/entities/types.js';
import { SplitterOptions } from '@domain/interfaces/splitter.js';
import { IFileProcessorRegistry } from '@infrastructure/external/index.js';
import { Logger } from '@logging/logger.js';

/**
 * 标题事件类型
 */
type HeadingEvt = { index: number; level: number; text: string };

/**
 * 统一分割选项
 */
interface UnifiedSplitOptions extends SplitterOptions {
  /**
   * 分割策略
   */
  strategy?: 'by_headings' | 'by_size' | 'hybrid' | 'auto';
  
  /**
   * 最大块大小
   */
  maxChunkSize?: number;
  
  /**
   * 块重叠大小
   */
  overlap?: number;
  
  /**
   * 最大标题深度
   */
  maxHeadingDepth?: number;
  
  /**
   * 是否优先使用标题分割
   */
  preferHeadings?: boolean;
  
  /**
   * 文档路径
   */
  docPath?: string;
  
  /**
   * 文档名称
   */
  name?: string;
}

/**
 * 分割策略接口
 */
interface SplittingStrategy {
  /**
   * 执行分割
   * @param content - 文本内容
   * @param options - 分割选项
   * @returns 文档块数组
   */
  split(content: string, options?: UnifiedSplitOptions): DocumentChunk[];
  
  /**
   * 获取策略名称
   */
  getName(): string;
  
  /**
   * 获取策略描述
   */
  getDescription(): string;
}

/**
 * 标题分割策略
 * 基于Markdown标题结构进行分割
 */
class HeadingSplitStrategy implements SplittingStrategy {
  getName(): string {
    return 'by_headings';
  }

  getDescription(): string {
    return '基于Markdown标题结构进行分割';
  }

  split(content: string, options?: UnifiedSplitOptions): DocumentChunk[] {
    const maxHeadingDepth = options?.maxHeadingDepth || 3;
    const docPath = options?.docPath;
    const chunks: DocumentChunk[] = [];
    const at = this.buildTitleTracker(content);
    const lines = content.split('\n');
    let currentChunkContent = '';
    let currentChunkStartIndex = 0;

    const addChunk = (content: string, startIndex: number) => {
      const trimmed = content.trim();
      if (!trimmed) return;
      const base = this.baseName(docPath);
      const chain = at(startIndex);
      const titleChain = base ? [base, ...chain] : chain;
      chunks.push({ content: trimmed, titleChain });
    };

    let offset = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headerMatch = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (headerMatch) {
        addChunk(currentChunkContent, currentChunkStartIndex);
        currentChunkContent = '';
        currentChunkStartIndex = offset;
      }
      currentChunkContent += line + '\n';
      offset += line.length + 1;
    }

    addChunk(currentChunkContent, currentChunkStartIndex);

    if (chunks.length === 0 && content.trim()) {
      const base = this.baseName(docPath);
      const chain: string[] = [];
      const titleChain = base ? [base, ...chain] : chain;
      chunks.push({ content: content.trim(), titleChain });
    }

    return chunks;
  }

  /**
   * 标准化行结束符
   * @param s 输入字符串
   * @returns 标准化后的字符串
   */
  private normalizeEol(s: string): string {
    return s.replace(/\r\n?/g, '\n');
  }

  /**
   * 获取基础文件名
   * @param p 路径字符串
   * @returns 基础文件名或null
   */
  private baseName(p?: string): string | null {
    if (!p) return null;
    const parts = p.split(/[/\\]/);
    const last = parts[parts.length - 1] || '';
    return last || null;
  }

  /**
   * 收集Markdown标题
   * @param md Markdown内容
   * @returns 标题事件数组
   */
  private collectHeadings(md: string): HeadingEvt[] {
    const text = this.normalizeEol(md);
    const lines = text.split('\n');
    const events: HeadingEvt[] = [];

    let offset = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
      if (m) {
        const level = m[1].length;
        const text = m[2].trim();
        events.push({ index: offset, level, text });
      }
      offset += line.length + 1;
    }

    offset = 0;
    for (let i = 0; i < lines.length - 1; i++) {
      const cur = lines[i],
        nxt = lines[i + 1];
      const u = /^(=){3,}\s*$/.test(nxt);
      const l = /^(-){3,}\s*$/.test(nxt);
      if ((u || l) && cur.trim() && !/^\s*#/.test(cur)) {
        const level = u ? 1 : 2;
        const text = cur.trim();
        events.push({ index: offset, level, text });
      }
      offset += lines[i].length + 1;
    }

    events.sort((a, b) => a.index - b.index);
    return events;
  }

  /**
   * 构建标题跟踪器
   * @param md Markdown内容
   * @returns 标题跟踪函数
   */
  private buildTitleTracker(md: string) {
    const events = this.collectHeadings(md);
    let stack: string[] = [];
    let ptr = 0;

    return function at(pos: number): string[] {
      while (ptr < events.length && events[ptr].index < pos) {
        const { level, text } = events[ptr];
        if (stack.length >= level) stack = stack.slice(0, level - 1);
        stack.push(text);
        ptr++;
      }
      return stack.slice();
    };
  }
}

/**
 * 大小分割策略
 * 基于固定大小和重叠进行分割
 */
class SizeSplitStrategy implements SplittingStrategy {
  getName(): string {
    return 'by_size';
  }

  getDescription(): string {
    return '基于固定大小和重叠进行分割';
  }

  split(content: string, options?: UnifiedSplitOptions): DocumentChunk[] {
    const maxChunkSize = options?.maxChunkSize || 1000;
    const overlap = options?.overlap || 100;

    // 如果内容较短，直接返回单个块
    if (content.length <= maxChunkSize) {
      return [{ content: content.trim() }];
    }

    const chunks: DocumentChunk[] = [];
    let start = 0;

    while (start < content.length) {
      let end = start + maxChunkSize;

      // 尝试在标题处分割
      if (end < content.length) {
        const headingMatch = content
          .substring(start, end)
          .match(/\n#{1,6}\s+.*$/m);
        if (headingMatch && typeof headingMatch.index === 'number') {
          end = start + headingMatch.index + headingMatch[0].length;
        } else {
          // 尝试在段落处分割
          const paragraphMatch = content
            .substring(start, end)
            .match(/\n\s*\n/m);
          if (paragraphMatch && typeof paragraphMatch.index === 'number') {
            end = start + paragraphMatch.index + paragraphMatch[0].length;
          }
        }
      }

      const chunkContent = content.slice(start, end).trim();
      if (chunkContent) {
        chunks.push({ content: chunkContent });
      }

      start = Math.max(start + 1, end - overlap);
    }

    return chunks;
  }
}

/**
 * 混合分割策略
 * 优先使用标题分割，大小限制作为后备
 */
class HybridSplitStrategy implements SplittingStrategy {
  private headingStrategy = new HeadingSplitStrategy();
  private sizeStrategy = new SizeSplitStrategy();

  getName(): string {
    return 'hybrid';
  }

  getDescription(): string {
    return '优先使用标题分割，大小限制作为后备';
  }

  split(content: string, options?: UnifiedSplitOptions): DocumentChunk[] {
    const maxChunkSize = options?.maxChunkSize || 2000;
    const preferHeadings = options?.preferHeadings !== false;

    // 首先尝试标题分割
    if (preferHeadings) {
      const headingChunks = this.headingStrategy.split(content, options);
      
      // 检查是否有块超过最大大小
      const oversizedChunks = headingChunks.filter(chunk => chunk.content.length > maxChunkSize);
      
      if (oversizedChunks.length === 0) {
        return headingChunks;
      }

      // 对过大的块进行二次分割
      const result: DocumentChunk[] = [];
      for (const chunk of headingChunks) {
        if (chunk.content.length > maxChunkSize) {
          const subChunks = this.sizeStrategy.split(chunk.content, options);
          result.push(...subChunks);
        } else {
          result.push(chunk);
        }
      }
      
      return result;
    } else {
      // 优先使用大小分割
      return this.sizeStrategy.split(content, options);
    }
  }
}

/**
 * 自动分割策略
 * 根据内容特征自动选择最佳策略
 */
class AutoSplitStrategy implements SplittingStrategy {
  private headingStrategy = new HeadingSplitStrategy();
  private sizeStrategy = new SizeSplitStrategy();
  private hybridStrategy = new HybridSplitStrategy();

  getName(): string {
    return 'auto';
  }

  getDescription(): string {
    return '根据内容特征自动选择最佳策略';
  }

  split(content: string, options?: UnifiedSplitOptions): DocumentChunk[] {
    // 检测是否为Markdown内容
    const isMarkdown = this.detectMarkdown(content);
    const hasHeadings = this.hasSignificantHeadings(content);
    const isLongContent = content.length > 2000;

    if (isMarkdown && hasHeadings) {
      // 有标题的Markdown，使用标题分割策略
      return this.headingStrategy.split(content, options);
    } else if (isLongContent) {
      // 长内容，使用大小分割
      return this.sizeStrategy.split(content, options);
    } else {
      // 短内容，直接返回单个块
      return [{ content: content.trim() }];
    }
  }

  /**
   * 检测是否为Markdown内容
   * @param content - 文本内容
   * @returns {boolean} 是否为Markdown内容
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
      pattern.test(content),
    ).length;
    return matchCount >= 2; // 至少匹配2个模式才认为是Markdown
  }

  /**
   * 检测是否有重要标题
   * @param content - 文本内容
   * @returns {boolean} 是否有重要标题
   */
  private hasSignificantHeadings(content: string): boolean {
    const headingMatches = content.match(/^#{1,6}\s+.+$/gm);
    return !!headingMatches && headingMatches.length >= 2;
  }
}

/**
 * 统一的Markdown分割器
 * 合并了MarkdownSplitter和MarkdownSplitterAdapter的功能
 */
export class UnifiedMarkdownSplitter implements ISplitter {
  private strategies: Map<string, SplittingStrategy> = new Map();
  private defaultStrategy: string = 'auto';

  /**
   * 构造函数
   * @param processorRegistry - 文件处理器注册表（可选）
   * @param logger - 日志记录器（可选）
   */
  constructor(
    private readonly processorRegistry?: IFileProcessorRegistry,
    private readonly logger?: Logger,
  ) {
    // 初始化所有策略
    this.strategies.set('by_headings', new HeadingSplitStrategy());
    this.strategies.set('by_size', new SizeSplitStrategy());
    this.strategies.set('hybrid', new HybridSplitStrategy());
    this.strategies.set('auto', new AutoSplitStrategy());

    this.logger?.info('UnifiedMarkdownSplitter已初始化', {
      strategies: Array.from(this.strategies.keys()),
      defaultStrategy: this.defaultStrategy,
    });
  }

  /**
   * 设置默认策略
   * @param strategy - 策略名称
   */
  public setDefaultStrategy(strategy: string): void {
    if (!this.strategies.has(strategy)) {
      throw new Error(`未知的分割策略: ${strategy}`);
    }
    this.defaultStrategy = strategy;
    this.logger?.info('默认分割策略已更新', { strategy });
  }

  /**
   * 获取默认选项
   * @returns {Record<string, unknown>} 默认选项
   */
  public getDefaultOptions(): Record<string, unknown> {
    return {
      strategy: this.defaultStrategy,
      maxChunkSize: 1000,
      overlap: 100,
      maxHeadingDepth: 3,
      preferHeadings: true,
    };
  }

  /**
   * 分割内容
   * @param content - 要分割的内容
   * @param options - 分割选项
   * @returns 文档块数组
   */
  public async split(
    content: string,
    options?: Record<string, unknown>,
  ): Promise<unknown[]> {
    try {
      const unifiedOptions = options as UnifiedSplitOptions || {};
      const strategyName = unifiedOptions.strategy || this.defaultStrategy;
      
      const strategy = this.strategies.get(strategyName);
      if (!strategy) {
        throw new Error(`未知的分割策略: ${strategyName}`);
      }

      this.logger?.debug('开始分割文档', {
        strategy: strategyName,
        contentLength: content.length,
        options: unifiedOptions,
      });

      const chunks = strategy.split(content, unifiedOptions);

      this.logger?.debug('文档分割完成', {
        strategy: strategyName,
        chunkCount: chunks.length,
      });

      return chunks;
    } catch (error) {
      this.logger?.error('文档分割失败', { error });
      
      // 降级到简单分割
      return this.fallbackSplit(content, options);
    }
  }

  /**
   * 分割文本为字符串数组
   * @param text 要分割的文本
   * @param options 分割选项
   * @returns 字符串数组
   */
  public async splitText(
    text: string,
    options?: SplitterOptions,
  ): Promise<string[]> {
    const chunks = (await this.split(text, options as Record<string, unknown>)) as DocumentChunk[];
    return chunks.map((c) => c.content);
  }

  /**
   * 获取可用的分割策略
   * @returns {Array<{name: string, description: string}>} 策略信息数组
   */
  public getAvailableStrategies(): Array<{
    name: string;
    description: string;
  }> {
    return Array.from(this.strategies.values()).map(strategy => ({
      name: strategy.getName(),
      description: strategy.getDescription(),
    }));
  }

  /**
   * 降级分割策略
   * @param content 文本内容
   * @param options 分割选项
   * @returns 文档块数组
   */
  private fallbackSplit(
    content: string,
    options?: Record<string, unknown>,
  ): DocumentChunk[] {
    this.logger?.warn('使用降级分割策略');
    
    const maxChunkSize = (options?.maxChunkSize as number) || 1000;
    
    // 如果内容较短，直接返回单个块
    if (content.length <= maxChunkSize) {
      return [{ content: content.trim() }];
    }

    // 简单按大小分割
    const chunks: DocumentChunk[] = [];
    for (let i = 0; i < content.length; i += maxChunkSize) {
      const chunk = content.slice(i, i + maxChunkSize).trim();
      if (chunk) {
        chunks.push({ content: chunk });
      }
    }

    return chunks;
  }
}
