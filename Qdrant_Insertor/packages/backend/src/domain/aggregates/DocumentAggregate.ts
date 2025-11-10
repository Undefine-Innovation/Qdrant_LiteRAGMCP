import { Doc, DocStatus } from '../entities/Doc.js';
import { Chunk, ChunkStatus } from '../entities/Chunk.js';
import { DocId, CollectionId, PointId } from '../entities/types.js';
import { DocumentContent } from '../value-objects/DocumentContent.js';
import { ChunkContent } from '../value-objects/ChunkContent.js';
import { EmbeddingVector } from '../value-objects/EmbeddingVector.js';
import { IDomainEvent } from '../events/IDomainEventInterface.js';
import { AggregateRoot } from './AggregateRoot.js';

// 导入新的事件实现
import {
  DocumentCreatedEvent,
  DocumentUpdatedEvent,
  DocumentDeletedEvent,
  DocumentContentUpdatedEvent,
  DocumentStatusChangedEvent,
  ChunkCreatedEvent,
  ChunkUpdatedEvent,
  ChunkDeletedEvent,
  ChunkEmbeddingGeneratedEvent,
  ChunkStatusChangedEvent,
} from '../events/DomainEvents.js';

// 为了向后兼容，保留原有的事件类型导出
/**
 *
 */
export type DocumentDomainEvent =
  import('../events/IDomainEventInterface.js').DocumentDomainEvent;
/**
 *
 */
export {
  DocumentCreatedEvent,
  DocumentContentUpdatedEvent,
  DocumentStatusChangedEvent,
};
/**
 *
 */
export { ChunkCreatedEvent as ChunkAddedEvent };
/**
 *
 */
export { ChunkEmbeddingGeneratedEvent };

/**
 * 文档聚合根
 * 封装文档及其关联块的业务逻辑
 */
export class DocumentAggregate extends AggregateRoot {
  private readonly _document: Doc;
  private readonly _chunks: Map<PointId, Chunk>;

  /**
   * 构造函数
   * @param document 文档实体
   * @param chunks 块实体数组
   */
  private constructor(document: Doc, chunks: Chunk[] = []) {
    super();
    this._document = document;
    this._chunks = new Map(chunks.map((chunk) => [chunk.pointId, chunk]));
  }

  /**
   * 创建新的文档聚合
   * @param id 文档ID
   * @param collectionId 集合ID
   * @param key 文档键值
   * @param content 文档内容
   * @param name 文档名称
   * @param mime MIME类型
   * @returns DocumentAggregate实例
   */
  public static create(
    id: DocId,
    collectionId: CollectionId,
    key: string,
    content: string,
    name?: string,
    mime?: string,
  ): DocumentAggregate {
    const document = Doc.create(id, collectionId, key, content, name, mime);
    const aggregate = new DocumentAggregate(document);

    // 添加领域事件
    const contentLength = content.length;
    aggregate.addDomainEvent(
      new DocumentCreatedEvent(
        id,
        collectionId,
        key,
        contentLength,
        name,
        mime,
      ),
    );

    return aggregate;
  }

  /**
   * 从现有数据重建文档聚合（用于从数据库加载）
   * @param document 文档实体
   * @param chunks 块实体数组
   * @returns DocumentAggregate实例
   */
  public static reconstitute(
    document: Doc,
    chunks: Chunk[] = [],
  ): DocumentAggregate {
    return new DocumentAggregate(document, chunks);
  }

  /**
   * 更新文档内容
   * @param content 新的文档内容
   */
  public updateContent(content: string): void {
    const oldContentLength = this._document.content?.getValue()?.length || 0;
    const newContentLength = content.length;

    this._document.updateContent(content);

    // 清除所有块，因为内容已更改
    this._chunks.clear();

    // 添加领域事件
    this.addDomainEvent(
      new DocumentContentUpdatedEvent(
        this._document.id,
        this._document.collectionId,
        oldContentLength,
        newContentLength,
      ),
    );
  }

  /**
   * 更新文档元数据
   * @param name 文档名称
   * @param mime MIME类型
   */
  public updateMetadata(name?: string, mime?: string): void {
    this._document.updateMetadata(name, mime);
  }

  /**
   * 开始处理文档
   */
  public startProcessing(): void {
    if (!this._document.canBeProcessed()) {
      throw new Error(`Document ${this._document.id} cannot be processed`);
    }

    const oldStatus = this._document.status;
    this._document.markAsProcessing();

    // 添加领域事件
    this.addDomainEvent(
      new DocumentStatusChangedEvent(
        this._document.id,
        this._document.collectionId,
        oldStatus,
        this._document.status,
      ),
    );
  }

  /**
   * 完成文档处理
   */
  public completeProcessing(): void {
    if (!this._document.isProcessing()) {
      throw new Error(
        `Document ${this._document.id} is not in processing state`,
      );
    }

    // 检查所有块是否已完成
    const incompleteChunks = this.getChunks().filter(
      (chunk) => !chunk.isCompleted(),
    );
    if (incompleteChunks.length > 0) {
      throw new Error(
        `Cannot complete document with ${incompleteChunks.length} incomplete chunks`,
      );
    }

    const oldStatus = this._document.status;
    this._document.markAsCompleted();

    // 添加领域事件
    this.addDomainEvent(
      new DocumentStatusChangedEvent(
        this._document.id,
        this._document.collectionId,
        oldStatus,
        this._document.status,
      ),
    );
  }

  /**
   * 标记文档处理失败
   */
  public failProcessing(): void {
    const oldStatus = this._document.status;
    this._document.markAsFailed();

    // 添加领域事件
    this.addDomainEvent(
      new DocumentStatusChangedEvent(
        this._document.id,
        this._document.collectionId,
        oldStatus,
        this._document.status,
      ),
    );
  }

  /**
   * 软删除文档
   */
  public softDelete(): void {
    if (!this._document.canBeDeleted()) {
      throw new Error(`Document ${this._document.id} cannot be deleted`);
    }

    this._document.softDelete();
  }

  /**
   * 恢复已删除的文档
   */
  public restore(): void {
    this._document.restore();
  }

  /**
   * 添加块到文档
   * @param pointId 点ID
   * @param chunkIndex 块索引
   * @param content 块内容
   * @param title 块标题
   * @returns 创建的块实体
   */
  public addChunk(
    pointId: PointId,
    chunkIndex: number,
    content: string,
    title?: string,
  ): Chunk {
    // 检查索引是否已存在
    if (this.hasChunkAtIndex(chunkIndex)) {
      throw new Error(`Chunk at index ${chunkIndex} already exists`);
    }

    const chunk = Chunk.create(
      pointId,
      this._document.id,
      this._document.collectionId,
      chunkIndex,
      content,
      title,
    );
    this._chunks.set(chunk.pointId, chunk);

    // 添加领域事件
    this.addDomainEvent(
      new ChunkCreatedEvent(
        chunk.pointId,
        this._document.id,
        this._document.collectionId,
        chunkIndex,
        content.length,
        title,
      ),
    );

    return chunk;
  }

  /**
   * 设置块的嵌入向量
   * @param pointId 点ID
   * @param embedding 嵌入向量
   */
  public setChunkEmbedding(pointId: PointId, embedding: number[]): void {
    const chunk = this._chunks.get(pointId);
    if (!chunk) {
      throw new Error(
        `Chunk ${pointId} not found in document ${this._document.id}`,
      );
    }

    const oldStatus = chunk.status;
    chunk.setEmbedding(embedding);

    // 添加领域事件
    this.addDomainEvent(
      new ChunkEmbeddingGeneratedEvent(
        pointId,
        this._document.id,
        this._document.collectionId,
        chunk.chunkIndex,
        embedding.length,
      ),
    );
  }

  /**
   * 标记块为已同步
   * @param pointId 点ID
   */
  public markChunkAsSynced(pointId: PointId): void {
    const chunk = this._chunks.get(pointId);
    if (!chunk) {
      throw new Error(
        `Chunk ${pointId} not found in document ${this._document.id}`,
      );
    }

    chunk.markAsSynced();
  }

  /**
   * 标记块为失败
   * @param pointId 点ID
   */
  public markChunkAsFailed(pointId: PointId): void {
    const chunk = this._chunks.get(pointId);
    if (!chunk) {
      throw new Error(
        `Chunk ${pointId} not found in document ${this._document.id}`,
      );
    }

    chunk.markAsFailed();
  }

  /**
   * 获取文档中的块
   * @param pointId 点ID
   * @returns 块实体或undefined
   */
  public getChunk(pointId: PointId): Chunk | undefined {
    return this._chunks.get(pointId);
  }

  /**
   * 获取文档中的所有块
   * @returns 块实体数组
   */
  public getChunks(): Chunk[] {
    return Array.from(this._chunks.values());
  }

  /**
   * 获取按索引排序的块
   * @returns 按索引排序的块数组
   */
  public getSortedChunks(): Chunk[] {
    return this.getChunks().sort((a, b) => a.chunkIndex - b.chunkIndex);
  }

  /**
   * 获取需要生成嵌入向量的块
   * @returns 需要嵌入的块数组
   */
  public getChunksNeedingEmbedding(): Chunk[] {
    return this.getChunks().filter((chunk) => chunk.needsEmbedding());
  }

  /**
   * 获取需要同步的块
   * @returns 需要同步的块数组
   */
  public getChunksNeedingSync(): Chunk[] {
    return this.getChunks().filter((chunk) => chunk.needsSync());
  }

  /**
   * 获取已完成的块
   * @returns 已完成的块数组
   */
  public getCompletedChunks(): Chunk[] {
    return this.getChunks().filter((chunk) => chunk.isCompleted());
  }

  /**
   * 获取失败的块
   * @returns 失败的块数组
   */
  public getFailedChunks(): Chunk[] {
    return this.getChunks().filter((chunk) => chunk.isFailed());
  }

  /**
   * 检查文档是否包含指定块
   * @param pointId 点ID
   * @returns 是否包含
   */
  public hasChunk(pointId: PointId): boolean {
    return this._chunks.has(pointId);
  }

  /**
   * 检查文档是否包含指定索引的块
   * @param chunkIndex 块索引
   * @returns 是否包含
   */
  public hasChunkAtIndex(chunkIndex: number): boolean {
    return Array.from(this._chunks.values()).some(
      (chunk) => chunk.chunkIndex === chunkIndex,
    );
  }

  /**
   * 获取文档中的块数量
   * @returns 块数量
   */
  public getChunkCount(): number {
    return this._chunks.size;
  }

  /**
   * 获取文档中的已完成块数量
   * @returns 已完成块数量
   */
  public getCompletedChunkCount(): number {
    return this.getCompletedChunks().length;
  }

  /**
   * 获取文档中的失败块数量
   * @returns 失败块数量
   */
  public getFailedChunkCount(): number {
    return this.getFailedChunks().length;
  }

  /**
   * 检查文档是否已完成处理
   * @returns 是否已完成
   */
  public isProcessingCompleted(): boolean {
    return (
      this._document.isCompleted() &&
      this.getChunkCount() > 0 &&
      this.getChunkCount() === this.getCompletedChunkCount()
    );
  }

  /**
   * 检查文档是否有失败的块
   * @returns 是否有失败的块
   */
  public hasFailedChunks(): boolean {
    return this.getFailedChunkCount() > 0;
  }

  /**
   * 检查文档是否可以被处理
   * @returns 是否可以处理
   */
  public canBeProcessed(): boolean {
    return this._document.canBeProcessed();
  }

  /**
   * 检查文档是否可以被删除
   * @returns 是否可以删除
   */
  public canBeDeleted(): boolean {
    return this._document.canBeDeleted();
  }

  /**
   * 验证聚合状态
   * @returns 验证结果
   */
  public validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 验证文档
    const documentValidation = this._document.validate();
    if (!documentValidation.isValid) {
      errors.push(...documentValidation.errors);
    }

    // 验证块
    for (const chunk of this._chunks.values()) {
      const chunkValidation = chunk.validate();
      if (!chunkValidation.isValid) {
        errors.push(
          `Chunk ${chunk.pointId}: ${chunkValidation.errors.join(', ')}`,
        );
      }

      // 验证块是否属于此文档
      if (chunk.docId !== this._document.id) {
        errors.push(
          `Chunk ${chunk.pointId} does not belong to document ${this._document.id}`,
        );
      }

      // 验证块是否属于正确的集合
      if (chunk.collectionId !== this._document.collectionId) {
        errors.push(
          `Chunk ${chunk.pointId} does not belong to collection ${this._document.collectionId}`,
        );
      }
    }

    // 验证块索引唯一性
    const chunkIndexes = Array.from(this._chunks.values()).map(
      (chunk) => chunk.chunkIndex,
    );
    const uniqueIndexes = new Set(chunkIndexes);
    if (chunkIndexes.length !== uniqueIndexes.size) {
      errors.push('Chunk indexes must be unique within document');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 实现AggregateRoot的抽象方法
   * @returns 聚合根ID
   */
  public getId(): string {
    return this._document.id;
  }

  /**
   * 实现AggregateRoot的抽象方法
   * @returns 聚合根类型
   */
  public getAggregateType(): string {
    return 'DocumentAggregate';
  }

  // Getters
  /**
   * 获取文档实体
   * @returns 文档实体
   */
  get document(): Doc {
    return this._document;
  }

  /**
   * 获取文档ID
   * @returns 文档ID
   */
  get id(): DocId {
    return this._document.id;
  }

  /**
   * 获取集合ID
   * @returns 集合ID
   */
  get collectionId(): CollectionId {
    return this._document.collectionId;
  }

  /**
   * 获取文档键值
   * @returns 文档键值
   */
  get key(): string {
    return this._document.key;
  }

  /**
   * 获取文档名称
   * @returns 文档名称
   */
  get name(): string | undefined {
    return this._document.name;
  }

  /**
   * 获取文档内容
   * @returns 文档内容
   */
  get content(): DocumentContent | undefined {
    return this._document.content;
  }

  /**
   * 获取文档状态
   * @returns 文档状态
   */
  get status(): DocStatus {
    return this._document.status;
  }

  /**
   * 获取是否已删除标志
   * @returns 是否已删除
   */
  get isDeleted(): boolean {
    return this._document.isDeleted;
  }

  /**
   * 获取创建时间戳
   * @returns 创建时间戳
   */
  get createdAt(): number {
    return this._document.createdAt;
  }

  /**
   * 获取更新时间戳
   * @returns 更新时间戳
   */
  get updatedAt(): number {
    return this._document.updatedAt;
  }
}
