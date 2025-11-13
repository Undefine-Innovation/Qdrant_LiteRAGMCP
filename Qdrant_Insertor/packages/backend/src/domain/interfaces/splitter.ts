/**
 * 文本分割器接口
 */
export interface ISplitter {
  /**
   * 分割文本为块
   * @param text - 要分割的文本
   * @param options - 分割选项
   * @returns 文本块数组
   */
  // Allow returning any array shape (strings or chunk objects) so implementations
  // in the application layer can return DocumentChunk[] without a type conflict.
  split(text: string, options?: SplitterOptions): Promise<unknown[]>;

  /**
   * 获取默认分割选项
   * @returns 默认分割选项
   */
  // Return a plain record so implementations from other layers
  // can provide arbitrary option shapes without tight coupling.
  getDefaultOptions(): Record<string, unknown>;

  /**
   * 分割文本为块（别名方法）
   * @param text - 要分割的文本
   * @param options - 分割选项
   * @returns 文本块数组
   */
  splitText(text: string, options?: SplitterOptions): Promise<string[]>;
}

/**
 * 分割器选项
 */
export interface SplitterOptions {
  /**
   * 最大块大小
   */
  maxChunkSize?: number;

  /**
   * 块重叠大小
   */
  chunkOverlap?: number;

  /**
   * 分割策略
   */
  strategy?: 'by_size' | 'by_sentences' | 'by_headings' | 'auto';

  /**
   * 分隔符
   */
  separators?: string[];

  /**
   * 分割器名称
   */
  name?: string;
}
