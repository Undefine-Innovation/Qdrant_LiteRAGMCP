/**
 * 文档聚合核心功能
 * 包含核心聚合功能和映射方法
 */

import { Doc } from '../entities/Doc.js';
import { Chunk } from '../entities/Chunk.js';
import { DocumentAggregate } from '@domain/aggregates/index.js';
import { Doc as DomainDoc, DocStatus } from '@domain/entities/Doc.js';
import { Chunk as DomainChunk, ChunkStatus } from '@domain/entities/Chunk.js';
import { DocId, CollectionId, PointId } from '@domain/entities/types.js';

/**
 * 文档聚合核心功能
 * 包含核心聚合功能和映射方法
 */
export class DocumentAggregateCore {
  /**
   * 将聚合映射为文档实体
   * @param aggregate 文档聚合
   * @returns 文档实体
   */
  static mapAggregateToDocEntity(aggregate: DocumentAggregate): Doc {
    const entity = new Doc();
    entity.id = aggregate.id;
    entity.collectionId = aggregate.collectionId;
    entity.key = aggregate.key;
    entity.name = aggregate.name || '';
    entity.size_bytes = aggregate.document.sizeBytes || 0;
    entity.mime = aggregate.document.mime || '';
    entity.content = aggregate.content?.getValue() || '';
    entity.deleted = aggregate.isDeleted;
    entity.status = aggregate.status as
      | 'new'
      | 'processing'
      | 'completed'
      | 'failed';
    entity.created_at = aggregate.createdAt;
    entity.updated_at = aggregate.updatedAt;
    return entity;
  }

  /**
   * 将聚合映射为块实体数组
   * @param aggregate 文档聚合
   * @returns 块实体数组
   */
  static mapAggregateToChunkEntities(aggregate: DocumentAggregate): Chunk[] {
    return aggregate.getChunks().map(
      (chunk) =>
        ({
          id: chunk.pointId as unknown as string,
          pointId: chunk.pointId as unknown as string,
          docId: chunk.docId as unknown as string,
          collectionId: chunk.collectionId as unknown as string,
          chunkIndex: chunk.chunkIndex,
          title: chunk.title,
          content: chunk.contentValue,
          created_at: chunk.createdAt,
          updated_at: chunk.updatedAt,
          chunkMeta: undefined,
          chunkFullText: undefined,
        }) as unknown as Chunk,
    );
  }

  /**
   * 将实体映射为聚合
   * @param docEntity 文档实体
   * @param chunkEntities 块实体数组
   * @returns 文档聚合
   */
  static mapEntitiesToAggregate(
    docEntity: Doc,
    chunkEntities: Chunk[],
  ): DocumentAggregate {
    // 首先将基础设施实体转换为领域实体
    // 注意: 需要在查询时显式选择content字段(Doc实体中select: false)
    const domainDoc = DomainDoc.reconstitute(
      docEntity.id as DocId,
      docEntity.collectionId as CollectionId,
      docEntity.key,
      docEntity.name,
      docEntity.size_bytes,
      docEntity.mime,
      docEntity.content, // 传入content字段(如果查询时包含)
      this.mapDocStatus(docEntity.status),
      docEntity.deleted,
      typeof docEntity.created_at === 'number'
        ? docEntity.created_at
        : Date.now(),
      typeof docEntity.updated_at === 'number'
        ? docEntity.updated_at
        : Date.now(),
    );

    // 然后使用领域实体创建聚合
    // 将基础设施层的Chunk实体转换为领域层的Chunk实体
    const domainChunks = chunkEntities.map((chunkEntity) => {
      // 确保内容满足最小长度要求（至少10个字符）
      const content =
        chunkEntity.content && chunkEntity.content.length >= 10
          ? chunkEntity.content
          : '[Empty Chunk Content]'; // 提供默认内容以满足验证

      const domainChunk = DomainChunk.reconstitute(
        chunkEntity.pointId as PointId,
        chunkEntity.docId as DocId,
        chunkEntity.collectionId as CollectionId,
        chunkEntity.chunkIndex,
        content,
        chunkEntity.title,
        undefined, // embedding
        undefined, // titleChain
        undefined, // contentHash
        ChunkStatus.NEW, // status - default to NEW since Chunk entity doesn't store status
        typeof chunkEntity.created_at === 'number'
          ? chunkEntity.created_at
          : Date.now(),
        typeof chunkEntity.updated_at === 'number'
          ? chunkEntity.updated_at
          : Date.now(),
      );
      return domainChunk;
    });

    return DocumentAggregate.reconstitute(domainDoc, domainChunks);
  }

  /**
   * 将基础设施层的 Doc 状态转换为领域层的 DocStatus
   * @param status 基础设施层的文档状态
   * @returns 领域层的文档状态
   */
  static mapDocStatus(
    status: 'new' | 'processing' | 'completed' | 'failed',
  ): DocStatus {
    const statusMap: Record<
      'new' | 'processing' | 'completed' | 'failed',
      DocStatus
    > = {
      new: DocStatus.NEW,
      processing: DocStatus.PROCESSING,
      completed: DocStatus.COMPLETED,
      failed: DocStatus.FAILED,
    };
    return statusMap[status] || DocStatus.NEW;
  }

  /**
   * 验证文档聚合数据
   * @param aggregate 文档聚合
   * @returns 验证结果
   */
  static validateAggregate(aggregate: DocumentAggregate): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // 基础验证逻辑
    if (!aggregate.id) {
      errors.push('文档ID不能为空');
    }

    if (!aggregate.collectionId) {
      errors.push('集合ID不能为空');
    }

    if (!aggregate.key) {
      errors.push('文档键不能为空');
    }

    // 验证块数据
    const chunks = aggregate.getChunks();
    if (chunks.length === 0) {
      errors.push('文档必须包含至少一个块');
    }

    // 验证每个块
    for (const chunk of chunks) {
      if (!chunk.contentValue || chunk.contentValue.trim() === '') {
        errors.push(`块 ${chunk.chunkIndex} 内容不能为空`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 创建空的文档聚合
   * @param id 文档ID
   * @param collectionId 集合ID
   * @param key 文档键
   * @returns 空的文档聚合
   */
  static createEmptyAggregate(
    id: DocId,
    collectionId: CollectionId,
    key: string,
  ): DocumentAggregate {
    // 使用DocumentAggregate的reconstitute方法创建一个空的聚合
    const emptyDoc = DomainDoc.reconstitute(
      id,
      collectionId,
      key,
      undefined, // name
      0, // sizeBytes
      undefined, // mime
      '', // content
      DocStatus.NEW, // status
      false, // isDeleted
      Date.now(), // createdAt
      Date.now(), // updatedAt
    );

    return DocumentAggregate.reconstitute(emptyDoc, []);
  }

  /**
   * 计算文档聚合的统计信息
   * @param aggregate 文档聚合
   * @returns 统计信息
   */
  static getAggregateStats(aggregate: DocumentAggregate): {
    totalChunks: number;
    totalSize: number;
    averageChunkSize: number;
    hasContent: boolean;
  } {
    const chunks = aggregate.getChunks();
    const totalChunks = chunks.length;
    const totalSize = aggregate.document.sizeBytes || 0;
    const averageChunkSize = totalChunks > 0 ? totalSize / totalChunks : 0;
    const hasContent = chunks.some(
      (chunk) => chunk.contentValue && chunk.contentValue.trim() !== '',
    );

    return {
      totalChunks,
      totalSize,
      averageChunkSize,
      hasContent,
    };
  }
}
