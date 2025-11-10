/**
 * @file 定义嵌入提供者的接口
 */

/**
 * 表示可以为文本列表生成嵌入的提供者
 */
export interface IEmbeddingProvider {
  /**
   * 为给定文本生成嵌入向量
   * @param texts - 要生成嵌入的字符串数组
   * @returns 返回一个 Promise，解析为数字数组的数组，其中每个内部数组是对应文本的嵌入向量
   */
  generate(texts: string[]): Promise<number[][]>;
}
