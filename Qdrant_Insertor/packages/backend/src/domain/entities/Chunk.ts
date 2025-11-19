import { ChunkContent } from '../value-objects/ChunkContent.js';
import { EmbeddingVector } from '../value-objects/EmbeddingVector.js';
import { CollectionId, DocId, PointId } from './types.js';
import { createHash } from 'node:crypto';

/**
 * 块状态枚举
 */
export enum ChunkStatus {
  NEW = 'new',
  EMBEDDING_GENERATED = 'embedding_generated',
  SYNCED = 'synced',
  FAILED = 'failed',
}

/**
 * 块领域实体
 * 包含业务规则和行为，符合DDD规范
 */
export class Chunk {
  /**
   * 点ID（唯一标识符）
   */
  private readonly _pointId: PointId;

  /**
   * 文档ID
   */
  private readonly _docId: DocId;

  /**
   * 集合ID
   */
  private readonly _collectionId: CollectionId;

  /**
   * 块索引
   */
  private readonly _chunkIndex: number;

  /**
   * 标题
   */
  private _title?: string;

  /**
   * 块内容值对象
   */
  private readonly _content: ChunkContent;

  /**
   * 嵌入向量值对象
   */
  private _embedding?: EmbeddingVector;

  /**
   * 标题链
   */
  private _titleChain?: string;

  /**
   * 内容哈希
   */
  private _contentHash?: string;

  /**
   * 块状态
   */
  private _status: ChunkStatus;

  /**
   * 创建时间戳
   */
  private readonly _createdAt: number;

  /**
   * 更新时间戳
   */
  private _updatedAt: number;

  /**
   * 私有构造函数，使用工厂方法创建实例
   * @param pointId 点ID
   * @param docId 文档ID
   * @param collectionId 集合ID
   * @param chunkIndex 块索引
   * @param content 块内容
   * @param title 标题
   * @param embedding 嵌入向量
   * @param titleChain 标题链
   * @param contentHash 内容哈希
   * @param status 块状态
   * @param createdAt 创建时间戳
   * @param updatedAt 更新时间戳
   */
  private constructor(
    pointId: PointId,
    docId: DocId,
    collectionId: CollectionId,
    chunkIndex: number,
    content: ChunkContent,
    title?: string,
    embedding?: EmbeddingVector,
    titleChain?: string,
    contentHash?: string,
    status: ChunkStatus = ChunkStatus.NEW,
    createdAt?: number,
    updatedAt?: number,
  ) {
    this._pointId = pointId;
    this._docId = docId;
    this._collectionId = collectionId;
    this._chunkIndex = chunkIndex;
    this._content = content;
    this._title = title;
    this._embedding = embedding;
    this._titleChain = titleChain;
    this._contentHash = contentHash || this.generateContentHash(content);
    this._status = status;
    this._createdAt = createdAt || Date.now();
    this._updatedAt = updatedAt || this._createdAt;
  }

  /**
   * 创建新的块实体
   * @param pointId 点ID
   * @param docId 文档ID
   * @param collectionId 集合ID
   * @param chunkIndex 块索引
   * @param content 块内容
   * @param title 标题
   * @returns Chunk实例
   * @throws {Error} 当参数无效时抛出错误
   */
  public static create(
    pointId: PointId,
    docId: DocId,
    collectionId: CollectionId,
    chunkIndex: number,
    content: string,
    title?: string,
  ): Chunk {
    // 验证索引
    if (chunkIndex < 0) {
      throw new Error('Chunk index cannot be negative');
    }

    const chunkContent = ChunkContent.create(content);

    return new Chunk(
      pointId,
      docId,
      collectionId,
      chunkIndex,
      chunkContent,
      title,
    );
  }

  /**
   * 从现有数据重建块实体（用于从数据库加载）
   * @param pointId 点ID
   * @param docId 文档ID
   * @param collectionId 集合ID
   * @param chunkIndex 块索引
   * @param content 块内容
   * @param title 标题
   * @param embedding 嵌入向量
   * @param titleChain 标题链
   * @param contentHash 内容哈希
   * @param status 块状态
   * @param createdAt 创建时间戳
   * @param updatedAt 更新时间戳
   * @returns Chunk实例
   */
  public static reconstitute(
    pointId: PointId,
    docId: DocId,
    collectionId: CollectionId,
    chunkIndex: number,
    content: string,
    title?: string,
    embedding?: number[],
    titleChain?: string,
    contentHash?: string,
    status: ChunkStatus = ChunkStatus.NEW,
    createdAt?: number,
    updatedAt?: number,
  ): Chunk {
    const chunkContent = ChunkContent.create(content);
    const embeddingVector = embedding
      ? EmbeddingVector.create(embedding)
      : undefined;

    return new Chunk(
      pointId,
      docId,
      collectionId,
      chunkIndex,
      chunkContent,
      title,
      embeddingVector,
      titleChain,
      contentHash,
      status,
      createdAt,
      updatedAt,
    );
  }

  /**
   * 设置嵌入向量
   * @param embedding 嵌入向量
   */
  public setEmbedding(embedding: number[]): void {
    this._embedding = EmbeddingVector.create(embedding);
    this._status = ChunkStatus.EMBEDDING_GENERATED;
    this._updatedAt = Date.now();
  }

  /**
   * 设置标题链
   * @param titleChain 标题链
   */
  public setTitleChain(titleChain: string): void {
    this._titleChain = titleChain;
    this._updatedAt = Date.now();
  }

  /**
   * 标记块为已同步
   */
  public markAsSynced(): void {
    if (!this._embedding) {
      throw new Error('Cannot mark chunk as synced without embedding');
    }
    this._status = ChunkStatus.SYNCED;
    this._updatedAt = Date.now();
  }

  /**
   * 标记块为失败
   */
  public markAsFailed(): void {
    this._status = ChunkStatus.FAILED;
    this._updatedAt = Date.now();
  }

  /**
   * 重置块状态为新建
   */
  public resetToNew(): void {
    this._status = ChunkStatus.NEW;
    this._embedding = undefined;
    this._updatedAt = Date.now();
  }

  /**
   * 检查块是否需要生成嵌入向量
   * @returns 是否需要生成嵌入向量
   */
  public needsEmbedding(): boolean {
    return (
      this._status === ChunkStatus.NEW ||
      (this._status === ChunkStatus.FAILED && !this._embedding)
    );
  }

  /**
   * 检查块是否需要同步
   * @returns 是否需要同步
   */
  public needsSync(): boolean {
    return this._status === ChunkStatus.EMBEDDING_GENERATED;
  }

  /**
   * 检查块是否已完成处理
   * @returns 是否已完成
   */
  public isCompleted(): boolean {
    return this._status === ChunkStatus.SYNCED;
  }

  /**
   * 检查块是否处理失败
   * @returns 是否失败
   */
  public isFailed(): boolean {
    return this._status === ChunkStatus.FAILED;
  }

  /**
   * 检查块是否包含嵌入向量
   * @returns 是否包含嵌入向量
   */
  public hasEmbedding(): boolean {
    return this._embedding !== undefined;
  }

  /**
   * 检查块内容是否适合搜索
   * @returns 是否适合搜索
   */
  public isSuitableForSearch(): boolean {
    return this._content.isSuitableForSearch();
  }

  /**
   * 检查块内容是否包含代码块
   * @returns 是否包含代码块
   */
  public hasCodeBlocks(): boolean {
    return this._content.hasCodeBlocks();
  }

  /**
   * 检查块内容是否包含链接
   * @returns 是否包含链接
   */
  public hasLinks(): boolean {
    return this._content.hasLinks();
  }

  /**
   * 提取块内容中的链接
   * @returns 链接数组
   */
  public extractLinks(): string[] {
    return this._content.extractLinks();
  }

  /**
   * 获取块内容的复杂度
   * @returns 复杂度分数
   */
  public getContentComplexity(): number {
    return this._content.calculateComplexity();
  }

  /**
   * 获取块内容的关键词
   * @param maxKeywords 最大关键词数量
   * @returns 关键词数组
   */
  public extractKeywords(maxKeywords: number = 5): string[] {
    return this._content.extractKeywords(maxKeywords);
  }

  /**
   * 计算与另一个块的余弦相似度
   * @param other 另一个块
   * @returns 余弦相似度
   */
  public cosineSimilarity(other: Chunk): number {
    if (!this._embedding || !other._embedding) {
      throw new Error(
        'Both chunks must have embeddings to calculate similarity',
      );
    }
    return this._embedding.cosineSimilarity(other._embedding);
  }

  /**
   * 计算与另一个块的欧几里得距离
   * @param other 另一个块
   * @returns 欧几里得距离
   */
  public euclideanDistance(other: Chunk): number {
    if (!this._embedding || !other._embedding) {
      throw new Error('Both chunks must have embeddings to calculate distance');
    }
    return this._embedding.euclideanDistance(other._embedding);
  }

  /**
   * 检查内容是否包含指定文本
   * @param searchText 要搜索的文本
   * @param caseSensitive 是否区分大小写
   * @returns 是否包含
   */
  public contentContains(
    searchText: string,
    caseSensitive: boolean = false,
  ): boolean {
    return this._content.contains(searchText, caseSensitive);
  }

  /**
   * 生成内容哈希
   * @param content 块内容
   * @returns 内容哈希
   */
  private generateContentHash(content: ChunkContent): string {
    return createHash('sha256').update(content.getValue()).digest('hex');
  }

  /**
   * 验证内容哈希是否匹配
   * @returns 是否匹配
   */
  public isContentHashValid(): boolean {
    const currentHash = this.generateContentHash(this._content);
    return currentHash === this._contentHash;
  }

  /**
   * 更新内容哈希
   */
  public updateContentHash(): void {
    this._contentHash = this.generateContentHash(this._content);
    this._updatedAt = Date.now();
  }

  /**
   * 验证块状态
   * @returns 验证结果
   */
  public validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 验证索引
    if (this._chunkIndex < 0) {
      errors.push('Chunk index cannot be negative');
    }

    // 验证内容
    try {
      ChunkContent.create(this._content.getValue());
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : 'Invalid chunk content',
      );
    }

    // 验证嵌入向量（如果存在）
    if (this._embedding) {
      try {
        EmbeddingVector.create(this._embedding.getValue());
      } catch (error) {
        errors.push(
          error instanceof Error ? error.message : 'Invalid embedding vector',
        );
      }
    }

    // 验证内容哈希
    if (!this.isContentHashValid()) {
      errors.push('Content hash does not match content');
    }

    // 验证时间戳
    if (this._createdAt <= 0) {
      errors.push('Created at timestamp must be positive');
    }

    if (this._updatedAt < this._createdAt) {
      errors.push('Updated at timestamp cannot be earlier than created at');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Getters
  /**
   * 获取点ID
   * @returns 点ID
   */
  get pointId(): PointId {
    return this._pointId;
  }

  /**
   * 获取文档ID
   * @returns 文档ID
   */
  get docId(): DocId {
    return this._docId;
  }

  /**
   * 获取集合ID
   * @returns 集合ID
   */
  get collectionId(): CollectionId {
    return this._collectionId;
  }

  /**
   * 获取块索引
   * @returns 块索引
   */
  get chunkIndex(): number {
    return this._chunkIndex;
  }

  /**
   * 获取标题
   * @returns 标题
   */
  get title(): string | undefined {
    return this._title;
  }

  /**
   * 获取块内容值对象
   * @returns 块内容值对象
   */
  get content(): ChunkContent {
    return this._content;
  }

  /**
   * 获取内容值
   * @returns 内容值
   */
  get contentValue(): string {
    return this._content.getValue();
  }

  /**
   * 获取嵌入向量值对象
   * @returns 嵌入向量值对象
   */
  get embedding(): EmbeddingVector | undefined {
    return this._embedding;
  }

  /**
   * 获取嵌入向量值
   * @returns 嵌入向量值
   */
  get embeddingValue(): number[] | undefined {
    return this._embedding?.getValue();
  }

  /**
   * 获取标题链
   * @returns 标题链
   */
  get titleChain(): string | undefined {
    return this._titleChain;
  }

  /**
   * 获取内容哈希
   * @returns 内容哈希
   */
  get contentHash(): string | undefined {
    return this._contentHash;
  }

  /**
   * 获取块状态
   * @returns 块状态
   */
  get status(): ChunkStatus {
    return this._status;
  }

  /**
   * 获取创建时间戳
   * @returns 创建时间戳
   */
  get createdAt(): number {
    return this._createdAt;
  }

  /**
   * 获取更新时间戳
   * @returns 更新时间戳
   */
  get updatedAt(): number {
    return this._updatedAt;
  }

  /**
   * 获取内容长度
   * @returns 内容字符数
   */
  public getContentLength(): number {
    return this._content.getLength();
  }

  /**
   * 获取内容单词数
   * @returns 单词数
   */
  public getContentWordCount(): number {
    return this._content.getWordCount();
  }

  /**
   * 获取内容行数
   * @returns 行数
   */
  public getContentLineCount(): number {
    return this._content.getLineCount();
  }

  /**
   * 获取内容预览
   * @param maxLength 预览最大长度
   * @returns 内容预览
   */
  public getContentPreview(maxLength: number = 100): string {
    return this._content.getPreview(maxLength);
  }

  /**
   * 转换为纯对象（用于序列化）
   * @returns 纯对象表示
   */
  public toObject(): {
    pointId: PointId;
    docId: DocId;
    collectionId: CollectionId;
    chunkIndex: number;
    title?: string;
    content: string;
    embedding?: number[];
    titleChain?: string;
    contentHash?: string;
    status: ChunkStatus;
    created_at: number;
    updated_at: number;
  } {
    return {
      pointId: this._pointId,
      docId: this._docId,
      collectionId: this._collectionId,
      chunkIndex: this._chunkIndex,
      title: this._title,
      content: this._content.getValue(),
      embedding: this._embedding?.getValue(),
      titleChain: this._titleChain,
      contentHash: this._contentHash,
      status: this._status,
      created_at: this._createdAt,
      updated_at: this._updatedAt,
    };
  }

  /**
   * 检查两个块实体是否相等
   * @param other 另一个块实体
   * @returns 是否相等
   */
  public equals(other: Chunk): boolean {
    if (this === other) {
      return true;
    }

    if (!(other instanceof Chunk)) {
      return false;
    }

    return this._pointId === other._pointId;
  }
}
