import { ISplitter } from '@application/services/file-processing/index.js';
import { DocumentChunk, LoadedFile } from '@infrastructure/external/index.js';
import { IFileProcessorRegistry } from '@infrastructure/external/index.js';
import { Logger } from '@logging/logger.js';

/**
 * @deprecated 请使用 UnifiedMarkdownSplitter 替代
 * 这个实现已被 UnifiedMarkdownSplitter 合并和取代
 */

/**
 * MarkdownSplitter适配器
 * 将新的文件处理器架构适配到现有的ISplitter接口
 */
export class MarkdownSplitterAdapter implements ISplitter {
  private readonly processorRegistry: IFileProcessorRegistry;

  /**
   * 构造函数
   * @param processorRegistry - 文件处理器注册表
   * @param logger - 日志记录器
   */
  constructor(
    processorRegistry: IFileProcessorRegistry,
    private readonly logger: Logger,
  ) {
    this.processorRegistry = processorRegistry;
    this.logger.info('MarkdownSplitter适配器已初始化');
  }

  /**
   * 将给定的内容分割成文档块数组
   * @param content 要分割的字符串内容
   * @param options 用于配置分割行为的可选参数
   * @returns 文档块数组
   */
  public async split(
    content: string,
    options?: Record<string, unknown>,
  ): Promise<DocumentChunk[]> {
    try {
      // For now use a simple fallback split strategy.
      return this.fallbackSplit(content, options);
    } catch (error) {
      this.logger.error('文档分割失败', { error });
      return this.fallbackSplit(content, options);
    }
  }

  /**
   * 返回默认分割选项，兼容 domain 层的期望
   * @returns {Record<string, unknown>} 默认分割选项
   */
  public getDefaultOptions(): Record<string, unknown> {
    return { windowSize: 1000, overlap: 100 };
  }

  /**
   * 异步分割文本为字符串数组，供 domain 层使用
   * @param text 要分割的文本
   * @param options 分割选项
   * @returns 字符串数组
   */
  public async splitText(
    text: string,
    options?: import('@domain/interfaces/splitter.js').SplitterOptions,
  ): Promise<string[]> {
    const chunks = await this.split(text, options as Record<string, unknown>);
    return chunks.map((c: DocumentChunk) => c.content);
  }

  /**
   * 降级分割策略
   * @param content - 文本内容
   * @param options - 分割选项
   * @returns 文档块数组
   */
  private fallbackSplit(
    content: string,
    options?: Record<string, unknown>,
  ): DocumentChunk[] {
    const maxChunkSize = (options?.windowSize as number) || 1000;
    const overlap = (options?.overlap as number) || 100;

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

  // Keep adapter minimal: application ISplitter only requires split(content)
}
