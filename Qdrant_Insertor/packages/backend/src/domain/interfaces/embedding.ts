/**
 * 嵌入提供者接口
 */
export interface IEmbeddingProvider {
  /**
   * 生成文本嵌入向量
   * @param text - 要生成嵌入的文本
   * @returns 嵌入向量
   */
  generate(text: string): Promise<number[]>;

  /**
   * 批量生成文本嵌入向量
   * @param texts - 要生成嵌入的文本数组
   * @returns 嵌入向量数组
   */
  generateBatch(texts: string[]): Promise<number[][]>;

  /**
   * 生成文本嵌入向量（别名方法）
   * @param text - 要生成嵌入的文本
   * @returns 嵌入向量
   */
  generateEmbedding(text: string): Promise<number[]>;

  /**
   * 批量生成文本嵌入向量（别名方法）
   * @param texts - 要生成嵌入的文本数组
   * @returns 嵌入向量数组
   */
  generateBatchEmbeddings(texts: string[]): Promise<number[][]>;

  /**
   * 获取嵌入向量维度
   * @returns 向量维度
   */
  getDimensions(): number;
}
