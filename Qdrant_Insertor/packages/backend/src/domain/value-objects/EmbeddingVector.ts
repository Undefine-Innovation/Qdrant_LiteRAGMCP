import { BaseValueObject } from './base.js';

/**
 * 嵌入向量值对象
 * 包含向量验证和业务规则
 */
export class EmbeddingVector extends BaseValueObject<number[]> {
  /**
   * 最小向量维度
   */
  private static readonly MIN_DIMENSIONS = 1;

  /**
   * 最大向量维度
   */
  private static readonly MAX_DIMENSIONS = 10000;

  /**
   * 向量值的有效范围
   */
  private static readonly MIN_VALUE = -1.0;
  private static readonly MAX_VALUE = 1.0;

  /**
   * 创建嵌入向量值对象
   * @param vector 向量数组
   * @returns EmbeddingVector实例
   * @throws {Error} 当向量无效时抛出错误
   */
  public static create(vector: number[]): EmbeddingVector {
    return new EmbeddingVector(vector);
  }

  /**
   * 从浮点数数组创建嵌入向量
   * @param floatArray 浮点数数组
   * @returns EmbeddingVector实例
   */
  public static fromFloat32Array(floatArray: Float32Array): EmbeddingVector {
    return new EmbeddingVector(Array.from(floatArray));
  }

  /**
   * 私有构造函数
   * @param vector 向量数组
   */
  private constructor(vector: number[]) {
    super(vector);
    this.validate(vector);
  }

  /**
   * 验证嵌入向量
   * @param vector 要验证的向量
   * @throws {Error} 当向量无效时抛出错误
   */
  protected validate(vector: number[]): void {
    if (!Array.isArray(vector)) {
      throw new Error('Embedding vector must be an array');
    }

    if (vector.length < EmbeddingVector.MIN_DIMENSIONS) {
      throw new Error(
        `Embedding vector must have at least ${EmbeddingVector.MIN_DIMENSIONS} dimension`,
      );
    }

    if (vector.length > EmbeddingVector.MAX_DIMENSIONS) {
      throw new Error(
        `Embedding vector cannot exceed ${EmbeddingVector.MAX_DIMENSIONS} dimensions`,
      );
    }

    // 检查所有元素是否为有效数字
    for (let i = 0; i < vector.length; i++) {
      const value = vector[i];

      if (typeof value !== 'number' || !isFinite(value)) {
        throw new Error(`Vector element at index ${i} is not a valid number`);
      }

      if (isNaN(value)) {
        throw new Error(`Vector element at index ${i} is NaN`);
      }

      if (
        value < EmbeddingVector.MIN_VALUE ||
        value > EmbeddingVector.MAX_VALUE
      ) {
        throw new Error(
          `Vector element at index ${i} (${value}) is out of valid range [${EmbeddingVector.MIN_VALUE}, ${EmbeddingVector.MAX_VALUE}]`,
        );
      }
    }

    // 检查向量是否全为零向量
    if (this.isZeroVector(vector)) {
      throw new Error('Embedding vector cannot be a zero vector');
    }
  }

  /**
   * 比较两个嵌入向量是否相等
   * @param otherValue 另一个向量值
   * @returns 是否相等
   */
  protected isEqual(otherValue: number[]): boolean {
    if (this.value.length !== otherValue.length) {
      return false;
    }

    // 使用浮点数比较的容差
    const epsilon = 1e-6;
    for (let i = 0; i < this.value.length; i++) {
      if (Math.abs(this.value[i] - otherValue[i]) > epsilon) {
        return false;
      }
    }

    return true;
  }

  /**
   * 获取向量维度
   * @returns 向量维度
   */
  public getDimensions(): number {
    return this.value.length;
  }

  /**
   * 计算向量的L2范数（欧几里得范数）
   * @returns L2范数
   */
  public getL2Norm(): number {
    let sum = 0;
    for (let i = 0; i < this.value.length; i++) {
      sum += this.value[i] * this.value[i];
    }
    return Math.sqrt(sum);
  }

  /**
   * 计算向量的L1范数（曼哈顿范数）
   * @returns L1范数
   */
  public getL1Norm(): number {
    let sum = 0;
    for (let i = 0; i < this.value.length; i++) {
      sum += Math.abs(this.value[i]);
    }
    return sum;
  }

  /**
   * 计算向量的无穷范数（最大绝对值）
   * @returns 无穷范数
   */
  public getInfinityNorm(): number {
    let max = 0;
    for (let i = 0; i < this.value.length; i++) {
      const abs = Math.abs(this.value[i]);
      if (abs > max) {
        max = abs;
      }
    }
    return max;
  }

  /**
   * 计算与另一个向量的余弦相似度
   * @param other 另一个向量
   * @returns 余弦相似度
   */
  public cosineSimilarity(other: EmbeddingVector): number {
    if (this.value.length !== other.value.length) {
      throw new Error(
        'Cannot compute cosine similarity: vectors have different dimensions',
      );
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < this.value.length; i++) {
      dotProduct += this.value[i] * other.value[i];
      norm1 += this.value[i] * this.value[i];
      norm2 += other.value[i] * other.value[i];
    }

    if (norm1 === 0 || norm2 === 0) {
      throw new Error(
        'Cannot compute cosine similarity: one of the vectors is zero',
      );
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * 计算与另一个向量的欧几里得距离
   * @param other 另一个向量
   * @returns 欧几里得距离
   */
  public euclideanDistance(other: EmbeddingVector): number {
    if (this.value.length !== other.value.length) {
      throw new Error(
        'Cannot compute euclidean distance: vectors have different dimensions',
      );
    }

    let sum = 0;
    for (let i = 0; i < this.value.length; i++) {
      const diff = this.value[i] - other.value[i];
      sum += diff * diff;
    }

    return Math.sqrt(sum);
  }

  /**
   * 计算与另一个向量的曼哈顿距离
   * @param other 另一个向量
   * @returns 曼哈顿距离
   */
  public manhattanDistance(other: EmbeddingVector): number {
    if (this.value.length !== other.value.length) {
      throw new Error(
        'Cannot compute manhattan distance: vectors have different dimensions',
      );
    }

    let sum = 0;
    for (let i = 0; i < this.value.length; i++) {
      sum += Math.abs(this.value[i] - other.value[i]);
    }

    return sum;
  }

  /**
   * 计算与另一个向量的点积
   * @param other 另一个向量
   * @returns 点积
   */
  public dotProduct(other: EmbeddingVector): number {
    if (this.value.length !== other.value.length) {
      throw new Error(
        'Cannot compute dot product: vectors have different dimensions',
      );
    }

    let sum = 0;
    for (let i = 0; i < this.value.length; i++) {
      sum += this.value[i] * other.value[i];
    }

    return sum;
  }

  /**
   * 标准化向量（L2标准化）
   * @returns 标准化后的新向量
   */
  public normalize(): EmbeddingVector {
    const norm = this.getL2Norm();
    if (norm === 0) {
      throw new Error('Cannot normalize zero vector');
    }

    const normalized = this.value.map((value) => value / norm);
    return new EmbeddingVector(normalized);
  }

  /**
   * 检查向量是否已标准化
   * @param tolerance 容差
   * @returns 是否已标准化
   */
  public isNormalized(tolerance: number = 1e-6): boolean {
    const norm = this.getL2Norm();
    return Math.abs(norm - 1.0) < tolerance;
  }

  /**
   * 获取向量的最大值
   * @returns 最大值
   */
  public getMax(): number {
    return Math.max(...this.value);
  }

  /**
   * 获取向量的最小值
   * @returns 最小值
   */
  public getMin(): number {
    return Math.min(...this.value);
  }

  /**
   * 获取向量的平均值
   * @returns 平均值
   */
  public getMean(): number {
    const sum = this.value.reduce((acc, val) => acc + val, 0);
    return sum / this.value.length;
  }

  /**
   * 获取向量的标准差
   * @returns 标准差
   */
  public getStandardDeviation(): number {
    const mean = this.getMean();
    const sumSquaredDiff = this.value.reduce(
      (acc, val) => acc + Math.pow(val - mean, 2),
      0,
    );
    return Math.sqrt(sumSquaredDiff / this.value.length);
  }

  /**
   * 转换为Float32Array
   * @returns Float32Array
   */
  public toFloat32Array(): Float32Array {
    return new Float32Array(this.value);
  }

  /**
   * 转换为JSON序列化格式
   * @returns JSON格式
   */
  public toJSON(): number[] {
    return [...this.value];
  }

  /**
   * 检查是否为零向量
   * @param vector 要检查的向量
   * @returns 是否为零向量
   */
  private isZeroVector(vector: number[]): boolean {
    const epsilon = 1e-10;
    return vector.every((value) => Math.abs(value) < epsilon);
  }

  /**
   * 创建指定维度的零向量（仅用于测试）
   * @param dimensions 维度
   * @returns 零向量
   */
  public static createZeroVector(dimensions: number): EmbeddingVector {
    const zeroVector = new Array(dimensions).fill(0);
    return new EmbeddingVector(zeroVector);
  }

  /**
   * 创建随机向量（仅用于测试）
   * @param dimensions 维度
   * @returns 随机向量
   */
  public static createRandomVector(dimensions: number): EmbeddingVector {
    const randomVector = Array.from(
      { length: dimensions },
      () => Math.random() * 2 - 1,
    );
    return new EmbeddingVector(randomVector);
  }
}
