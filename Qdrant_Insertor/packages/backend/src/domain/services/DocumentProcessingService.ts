import { Doc, DocStatus } from '@domain/entities/Doc.js';
import { Chunk, ChunkStatus } from '@domain/entities/Chunk.js';
import { DocumentAggregate } from '@domain/aggregates/DocumentAggregate.js';
import { DocumentContent } from '@domain/value-objects/DocumentContent.js';
import { ChunkContent } from '@domain/value-objects/ChunkContent.js';
import { CollectionId, DocId, PointId } from '@domain/entities/types.js';
import { IDomainEvent } from '@domain/events/IDomainEventInterface.js';
import { IEventPublisher } from '@domain/events/IEventPublisher.js';
import {
  DocumentCreatedEvent,
  DocumentContentUpdatedEvent,
  DocumentStatusChangedEvent,
  ChunkCreatedEvent,
  ChunkEmbeddingGeneratedEvent,
  ChunkStatusChangedEvent,
} from '@domain/events/DomainEvents.js';
import { Logger } from '@logging/logger.js';

/**
 * 文档处理领域服务接口
 */
export interface IDocumentProcessingService {
  /**
   * 处理文档内容，将其分割为块
   * @param documentAggregate 文档聚合
   * @param content 文档内容
   * @param chunkingStrategy 分块策略
   * @param maxChunkSize 最大块大小
   * @returns 处理后的文档聚合
   */
  processDocumentContent(
    documentAggregate: DocumentAggregate,
    content: string,
    chunkingStrategy?:
      | 'by_size'
      | 'by_sentences'
      | 'by_paragraphs'
      | 'by_headings',
    maxChunkSize?: number,
  ): Promise<DocumentAggregate>;

  /**
   * 验证文档内容
   * @param content 文档内容
   * @returns 验证结果
   */
  validateDocumentContent(content: string): {
    isValid: boolean;
    errors: string[];
  };

  /**
   * 检查文档是否需要重新处理
   * @param documentAggregate 文档聚合
   * @returns 是否需要重新处理
   */
  needsReprocessing(documentAggregate: DocumentAggregate): boolean;

  /**
   * 获取文档处理状态
   * @param documentAggregate 文档聚合
   * @returns 处理状态信息
   */
  getProcessingStatus(documentAggregate: DocumentAggregate): {
    status: DocStatus;
    totalChunks: number;
    completedChunks: number;
    failedChunks: number;
    progress: number;
  };
}

/**
 * 文档处理领域服务实现
 * 负责文档内容的处理、分块和状态管理
 */
export class DocumentProcessingService implements IDocumentProcessingService {
  /**
   * 默认最大块大小（字符数）
   */
  private static readonly DEFAULT_MAX_CHUNK_SIZE = 1000;

  /**
   * 默认块重叠大小（字符数）
   */
  private static readonly DEFAULT_CHUNK_OVERLAP = 100;

  /**
   * 构造函数
   * @param eventPublisher 事件发布器
   * @param logger 日志记录器
   */
  constructor(
    private readonly eventPublisher: IEventPublisher,
    private readonly logger?: Logger,
  ) {}

  /**
   * 处理文档内容，将其分割为块
   * @param documentAggregate 文档聚合
   * @param content 文档内容
   * @param chunkingStrategy 分块策略
   * @param maxChunkSize 最大块大小
   * @returns 处理后的文档聚合
   */
  public async processDocumentContent(
    documentAggregate: DocumentAggregate,
    content: string,
    chunkingStrategy:
      | 'by_size'
      | 'by_sentences'
      | 'by_paragraphs'
      | 'by_headings' = 'by_size',
    maxChunkSize: number = DocumentProcessingService.DEFAULT_MAX_CHUNK_SIZE,
  ): Promise<DocumentAggregate> {
    // 验证内容
    const validation = this.validateDocumentContent(content);
    if (!validation.isValid) {
      throw new Error(
        `Invalid document content: ${validation.errors.join(', ')}`,
      );
    }

    // 更新文档内容
    documentAggregate.updateContent(content);

    // 根据策略分割内容
    const chunks = await this.splitContent(
      content,
      chunkingStrategy,
      maxChunkSize,
    );

    // 清除现有块
    const existingChunks = documentAggregate.getChunks();
    for (const chunk of existingChunks) {
      // 发布块删除事件
      const chunkDeletedEvent = new ChunkStatusChangedEvent(
        chunk.pointId,
        documentAggregate.id,
        documentAggregate.collectionId,
        chunk.chunkIndex,
        chunk.status,
        ChunkStatus.FAILED, // 标记为失败，表示被替换
      );
      await this.eventPublisher.publish(chunkDeletedEvent);
    }

    // 添加新块
    for (let i = 0; i < chunks.length; i++) {
      const chunkData = chunks[i];
      const pointId = this.generatePointId(documentAggregate.id, i);

      documentAggregate.addChunk(
        pointId,
        i,
        chunkData.content,
        chunkData.title,
      );
    }

    // 标记文档为处理中
    documentAggregate.startProcessing();

    // 发布领域事件
    await this.publishDomainEvents(documentAggregate);

    return documentAggregate;
  }

  /**
   * 验证文档内容
   * @param content 文档内容
   * @returns 验证结果
   */
  public validateDocumentContent(content: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    try {
      DocumentContent.create(content);
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : 'Invalid document content',
      );
    }

    // 检查内容是否为空或只包含空白字符
    if (!content || content.trim().length === 0) {
      errors.push('Document content cannot be empty');
    }

    // 检查内容长度是否合理
    if (content.length > 50_000_000) {
      // 50MB
      errors.push('Document content is too large');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 检查文档是否需要重新处理
   * @param documentAggregate 文档聚合
   * @returns 是否需要重新处理
   */
  public needsReprocessing(documentAggregate: DocumentAggregate): boolean {
    // 如果文档处理失败，需要重新处理
    if (documentAggregate.status === DocStatus.FAILED) {
      return true;
    }

    // 如果文档没有块，需要处理
    if (documentAggregate.getChunkCount() === 0) {
      return true;
    }

    // 如果有失败的块，需要重新处理
    if (documentAggregate.hasFailedChunks()) {
      return true;
    }

    // 如果文档状态为新建，需要处理
    if (documentAggregate.status === DocStatus.NEW) {
      return true;
    }

    return false;
  }

  /**
   * 获取文档处理状态
   * @param documentAggregate 文档聚合
   * @returns 处理状态信息
   */
  public getProcessingStatus(documentAggregate: DocumentAggregate): {
    status: DocStatus;
    totalChunks: number;
    completedChunks: number;
    failedChunks: number;
    progress: number;
  } {
    const totalChunks = documentAggregate.getChunkCount();
    const completedChunks = documentAggregate.getCompletedChunkCount();
    const failedChunks = documentAggregate.getFailedChunkCount();

    const progress =
      totalChunks > 0 ? (completedChunks / totalChunks) * 100 : 0;

    return {
      status: documentAggregate.status,
      totalChunks,
      completedChunks,
      failedChunks,
      progress,
    };
  }

  /**
   * 根据策略分割内容
   * @param content 文档内容
   * @param strategy 分割策略
   * @param maxChunkSize 最大块大小
   * @returns 分割后的块数组
   */
  private async splitContent(
    content: string,
    strategy: 'by_size' | 'by_sentences' | 'by_paragraphs' | 'by_headings',
    maxChunkSize: number,
  ): Promise<Array<{ content: string; title?: string }>> {
    switch (strategy) {
      case 'by_size':
        return this.splitBySize(content, maxChunkSize);
      case 'by_sentences':
        return this.splitBySentences(content, maxChunkSize);
      case 'by_paragraphs':
        return this.splitByParagraphs(content, maxChunkSize);
      case 'by_headings':
        return this.splitByHeadings(content, maxChunkSize);
      default:
        return this.splitBySize(content, maxChunkSize);
    }
  }

  /**
   * 按大小分割内容
   * @param content 文档内容
   * @param maxChunkSize 最大块大小
   * @returns 分割后的块数组
   */
  private splitBySize(
    content: string,
    maxChunkSize: number,
  ): Array<{ content: string; title?: string }> {
    const chunks: Array<{ content: string; title?: string }> = [];
    const overlap = DocumentProcessingService.DEFAULT_CHUNK_OVERLAP;

    for (let i = 0; i < content.length; i += maxChunkSize - overlap) {
      const end = Math.min(i + maxChunkSize, content.length);
      const chunkContent = content.substring(i, end);

      if (chunkContent.trim().length > 0) {
        chunks.push({ content: chunkContent });
      }
    }

    return chunks;
  }

  /**
   * 按句子分割内容
   * @param content 文档内容
   * @param maxChunkSize 最大块大小
   * @returns 分割后的块数组
   */
  private splitBySentences(
    content: string,
    maxChunkSize: number,
  ): Array<{ content: string; title?: string }> {
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];
    const chunks: Array<{ content: string; title?: string }> = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if (
        currentChunk.length + sentence.length > maxChunkSize &&
        currentChunk.length > 0
      ) {
        chunks.push({ content: currentChunk.trim() });
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push({ content: currentChunk.trim() });
    }

    return chunks;
  }

  /**
   * 按段落分割内容
   * @param content 文档内容
   * @param maxChunkSize 最大块大小
   * @returns 分割后的块数组
   */
  private splitByParagraphs(
    content: string,
    maxChunkSize: number,
  ): Array<{ content: string; title?: string }> {
    const paragraphs = content.split(/\n\s*\n/);
    const chunks: Array<{ content: string; title?: string }> = [];
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      if (
        currentChunk.length + paragraph.length > maxChunkSize &&
        currentChunk.length > 0
      ) {
        chunks.push({ content: currentChunk.trim() });
        currentChunk = paragraph;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push({ content: currentChunk.trim() });
    }

    return chunks;
  }

  /**
   * 按标题分割内容
   * @param content 文档内容
   * @param maxChunkSize 最大块大小
   * @returns 分割后的块数组
   */
  private splitByHeadings(
    content: string,
    maxChunkSize: number,
  ): Array<{ content: string; title?: string }> {
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const chunks: Array<{ content: string; title?: string }> = [];
    let currentTitle: string | undefined;
    let currentChunk = '';

    const lines = content.split('\n');

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch) {
        // 保存当前块
        if (currentChunk.trim().length > 0) {
          chunks.push({
            content: currentChunk.trim(),
            title: currentTitle,
          });
        }

        // 开始新块
        currentTitle = headingMatch[2];
        currentChunk = line;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }

    // 保存最后一个块
    if (currentChunk.trim().length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        title: currentTitle,
      });
    }

    // 检查块大小，如果过大则按大小分割
    const finalChunks: Array<{ content: string; title?: string }> = [];
    for (const chunk of chunks) {
      if (chunk.content.length > maxChunkSize) {
        const subChunks = this.splitBySize(chunk.content, maxChunkSize);
        finalChunks.push(
          ...subChunks.map((sub) => ({
            content: sub.content,
            title: chunk.title,
          })),
        );
      } else {
        finalChunks.push(chunk);
      }
    }

    return finalChunks;
  }

  /**
   * 生成点ID
   * @param docId 文档ID
   * @param chunkIndex 块索引
   * @returns 点ID
   */
  private generatePointId(docId: DocId, chunkIndex: number): PointId {
    return `${docId}_${chunkIndex}` as PointId;
  }

  /**
   * 发布领域事件
   * @param documentAggregate 文档聚合
   */
  private async publishDomainEvents(
    documentAggregate: DocumentAggregate,
  ): Promise<void> {
    const events = documentAggregate.getDomainEvents();

    for (const event of events) {
      await this.eventPublisher.publish(event);
    }

    documentAggregate.clearDomainEvents();
  }
}
