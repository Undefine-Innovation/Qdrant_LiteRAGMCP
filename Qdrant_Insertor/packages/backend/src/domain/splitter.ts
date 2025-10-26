import { DocumentChunk } from '../domain/types.js';

/**
 * 定义文档分割器的接口。
 * 分割器负责将大的文档内容分解成更小、可管理的块。
 * Defines the interface for a document splitter.
 * Splitters are responsible for breaking down a large document content into smaller, manageable chunks.
 */
export interface ISplitter {
  /**
   * 将给定的内容分割成文档块数组。
   * Splits the given content into an array of document chunks.
   * @param content 要分割的字符串内容。/ The string content to split.
   * @param options 用于配置分割行为的可选参数。/ Optional parameters to configure the splitting behavior.
   * @returns 文档块数组。/ An array of document chunks.
   */
  split(content: string, options?: Record<string, unknown>): DocumentChunk[];
}
