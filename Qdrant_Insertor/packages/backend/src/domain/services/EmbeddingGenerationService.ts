import { Chunk, ChunkStatus } from '../entities/Chunk.js';
import { DocumentAggregate } from '../aggregates/DocumentAggregate.js';
import { EmbeddingVector } from '../value-objects/EmbeddingVector.js';
import { CollectionId, DocId, PointId } from '../entities/types.js';
import { IEventPublisher } from '../events/IEventPublisher.js';
import { IEmbeddingProvider } from '../entities/embedding.js';
import {
  ChunkEmbeddingGeneratedEvent,
  ChunkStatusChangedEvent,
} from '../events/DomainEvents.js';
import { Logger } from '../../infrastructure/logging/logger.js';

/**
 * 嵌入生成领域服务接口
 */
export interface IEmbeddingGenerationService {
  /**
   * 为文档聚合中的所有块生成嵌入向量
   * @param documentAggregate 文档聚合
   * @returns 处理后的文档聚合
   */
  generateEmbeddingsForDocument(
    documentAggregate: DocumentAggregate,
  ): Promise<DocumentAggregate>;

  /**
   * 为单个块生成嵌入向量
   * @param chunk 块实体
   * @returns 生成嵌入向量后的块
   */
  generateEmbeddingForChunk(chunk: Chunk): Promise<Chunk>;

  /**
   * 批量为多个块生成嵌入向量
   * @param chunks 块实体数组
   * @returns 生成嵌入向量后的块数组
   */
  generateEmbeddingsForChunks(chunks: Chunk[]): Promise<Chunk[]>;

  /**
   * 检查块是否需要生成嵌入向量
   * @param chunk 块实体
   * @returns 是否需要生成嵌入向量
   */
  needsEmbeddingGeneration(chunk: Chunk): boolean;

  /**
   * 验证嵌入向量
   * @param embedding 嵌入向量
   * @returns 验证结果
   */
  validateEmbedding(embedding: number[]): {
    isValid: boolean;
    errors: string[];
  };

  /**
   * 计算嵌入生成的进度
   * @param documentAggregate 文档聚合
   * @returns 生成进度信息
   */
  getGenerationProgress(documentAggregate: DocumentAggregate): {
    totalChunks: number;
    completedChunks: number;
    failedChunks: number;
    pendingChunks: number;
    progress: number;
  };
}

/**
 * 嵌入生成领域服务实现
 * 负责为文档块生成嵌入向量
 */
export class EmbeddingGenerationService implements IEmbeddingGenerationService {
  /**
   * 批量处理大小
   */
  private static readonly BATCH_SIZE = 10;

  /**
   * 最大重试次数
   */
  private static readonly MAX_RETRIES = 3;

  /**
   * 构造函数
   * @param embeddingProvider 嵌入向量提供者
   * @param eventPublisher 事件发布器
   * @param logger 日志记录器
   */
  constructor(
    private readonly embeddingProvider: IEmbeddingProvider,
    private readonly eventPublisher: IEventPublisher,
    private readonly logger?: Logger,
  ) {}

  /**
   * 为文档聚合中的所有块生成嵌入向量
   * @param documentAggregate 文档聚合
   * @returns 处理后的文档聚合
   */
  public async generateEmbeddingsForDocument(
    documentAggregate: DocumentAggregate,
  ): Promise<DocumentAggregate> {
    // 获取需要生成嵌入向量的块
    const chunksNeedingEmbedding =
      documentAggregate.getChunksNeedingEmbedding();

    if (chunksNeedingEmbedding.length === 0) {
      return documentAggregate;
    }

    // 批量生成嵌入向量
    const processedChunks = await this.generateEmbeddingsForChunks(
      chunksNeedingEmbedding,
    );

    // 更新文档聚合中的块
    for (const chunk of processedChunks) {
      if (chunk.hasEmbedding()) {
        documentAggregate.setChunkEmbedding(
          chunk.pointId,
          chunk.embeddingValue!,
        );
      }
    }

    // 发布领域事件
    await this.publishDomainEvents(documentAggregate);

    return documentAggregate;
  }

  /**
   * 为单个块生成嵌入向量
   * @param chunk 块实体
   * @returns 生成嵌入向量后的块
   */
  public async generateEmbeddingForChunk(chunk: Chunk): Promise<Chunk> {
    if (!this.needsEmbeddingGeneration(chunk)) {
      return chunk;
    }

    try {
      // 生成嵌入向量
      const embeddings = await this.embeddingProvider.generate([
        chunk.contentValue,
      ]);

      if (embeddings.length === 0 || !embeddings[0]) {
        throw new Error('Failed to generate embedding for chunk');
      }

      // 验证嵌入向量
      const validation = this.validateEmbedding(embeddings[0]);
      if (!validation.isValid) {
        throw new Error(
          `Invalid embedding generated: ${validation.errors.join(', ')}`,
        );
      }

      // 设置嵌入向量
      chunk.setEmbedding(embeddings[0]);

      // 发布嵌入生成事件
      const event = new ChunkEmbeddingGeneratedEvent(
        chunk.pointId,
        chunk.docId,
        chunk.collectionId,
        chunk.chunkIndex,
        embeddings[0].length,
      );
      await this.eventPublisher.publish(event);

      return chunk;
    } catch (error) {
      // 标记块为失败
      chunk.markAsFailed();

      // 发布失败事件
      const event = new ChunkStatusChangedEvent(
        chunk.pointId,
        chunk.docId,
        chunk.collectionId,
        chunk.chunkIndex,
        ChunkStatus.NEW,
        ChunkStatus.FAILED,
      );
      await this.eventPublisher.publish(event);

      throw error;
    }
  }

  /**
   * 批量为多个块生成嵌入向量
   * @param chunks 块实体数组
   * @returns 生成嵌入向量后的块数组
   */
  public async generateEmbeddingsForChunks(chunks: Chunk[]): Promise<Chunk[]> {
    const processedChunks: Chunk[] = [];

    // 过滤需要生成嵌入向量的块
    const chunksNeedingEmbedding = chunks.filter((chunk) =>
      this.needsEmbeddingGeneration(chunk),
    );

    if (chunksNeedingEmbedding.length === 0) {
      return chunks;
    }

    // 分批处理
    for (
      let i = 0;
      i < chunksNeedingEmbedding.length;
      i += EmbeddingGenerationService.BATCH_SIZE
    ) {
      const batch = chunksNeedingEmbedding.slice(
        i,
        i + EmbeddingGenerationService.BATCH_SIZE,
      );
      const batchContents = batch.map((chunk) => chunk.contentValue);

      try {
        // 批量生成嵌入向量
        const embeddings = await this.embeddingProvider.generate(batchContents);

        // 处理结果
        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j];
          const embedding = embeddings[j];

          if (embedding) {
            // 验证嵌入向量
            const validation = this.validateEmbedding(embedding);
            if (validation.isValid) {
              chunk.setEmbedding(embedding);

              // 发布嵌入生成事件
              const event = new ChunkEmbeddingGeneratedEvent(
                chunk.pointId,
                chunk.docId,
                chunk.collectionId,
                chunk.chunkIndex,
                embedding.length,
              );
              await this.eventPublisher.publish(event);
            } else {
              // 标记为失败
              chunk.markAsFailed();

              const event = new ChunkStatusChangedEvent(
                chunk.pointId,
                chunk.docId,
                chunk.collectionId,
                chunk.chunkIndex,
                ChunkStatus.NEW,
                ChunkStatus.FAILED,
              );
              await this.eventPublisher.publish(event);
            }
          } else {
            // 标记为失败
            chunk.markAsFailed();

            const event = new ChunkStatusChangedEvent(
              chunk.pointId,
              chunk.docId,
              chunk.collectionId,
              chunk.chunkIndex,
              ChunkStatus.NEW,
              ChunkStatus.FAILED,
            );
            await this.eventPublisher.publish(event);
          }

          processedChunks.push(chunk);
        }
      } catch (error) {
        // 批次失败，标记所有块为失败
        for (const chunk of batch) {
          chunk.markAsFailed();

          const event = new ChunkStatusChangedEvent(
            chunk.pointId,
            chunk.docId,
            chunk.collectionId,
            chunk.chunkIndex,
            ChunkStatus.NEW,
            ChunkStatus.FAILED,
          );
          await this.eventPublisher.publish(event);

          processedChunks.push(chunk);
        }
      }
    }

    // 返回所有块（包括不需要处理的）
    return chunks.map((chunk) => {
      const processed = processedChunks.find(
        (pc) => pc.pointId === chunk.pointId,
      );
      return processed || chunk;
    });
  }

  /**
   * 检查块是否需要生成嵌入向量
   * @param chunk 块实体
   * @returns 是否需要生成嵌入向量
   */
  public needsEmbeddingGeneration(chunk: Chunk): boolean {
    return chunk.needsEmbedding();
  }

  /**
   * 验证嵌入向量
   * @param embedding 嵌入向量
   * @returns 验证结果
   */
  public validateEmbedding(embedding: number[]): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    try {
      EmbeddingVector.create(embedding);
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : 'Invalid embedding vector',
      );
    }

    // 检查向量是否为空
    if (!embedding || embedding.length === 0) {
      errors.push('Embedding vector cannot be empty');
    }

    // 检查向量是否包含无效值
    for (let i = 0; i < embedding.length; i++) {
      const value = embedding[i];
      if (!isFinite(value)) {
        errors.push(
          `Embedding vector contains invalid value at index ${i}: ${value}`,
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 计算嵌入生成的进度
   * @param documentAggregate 文档聚合
   * @returns 生成进度信息
   */
  public getGenerationProgress(documentAggregate: DocumentAggregate): {
    totalChunks: number;
    completedChunks: number;
    failedChunks: number;
    pendingChunks: number;
    progress: number;
  } {
    const allChunks = documentAggregate.getChunks();
    const totalChunks = allChunks.length;
    const completedChunks = allChunks.filter((chunk) =>
      chunk.hasEmbedding(),
    ).length;
    const failedChunks = documentAggregate.getFailedChunkCount();
    const pendingChunks = totalChunks - completedChunks - failedChunks;

    const progress =
      totalChunks > 0 ? (completedChunks / totalChunks) * 100 : 0;

    return {
      totalChunks,
      completedChunks,
      failedChunks,
      pendingChunks,
      progress,
    };
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
