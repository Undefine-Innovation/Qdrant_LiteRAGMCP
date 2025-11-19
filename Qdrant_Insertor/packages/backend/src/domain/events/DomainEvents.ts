import {
  CollectionDomainEvent,
  DocumentDomainEvent,
  ChunkDomainEvent,
  EventType,
  IDomainEvent,
} from './IDomainEventInterface.js';

// Re-export for other modules
/**
 * 导出领域事件接口类型
 */
export type { IDomainEvent } from './IDomainEventInterface.js';
/**
 * 导出事件类型枚举
 */
export { EventType } from './IDomainEventInterface.js';
import { CollectionId, DocId, PointId } from '../entities/types.js';

// ============================================================================
// 集合相关事件
// ============================================================================

/**
 * 集合创建事件
 */
export class CollectionCreatedEvent extends CollectionDomainEvent {
  /**
   * 构造函数
   * @param aggregateId 聚合根ID
   * @param name 集合名称
   * @param description 集合描述
   * @param metadata 事件元数据
   */
  constructor(
    aggregateId: CollectionId,
    public readonly name: string,
    public readonly description?: string,
    metadata?: Record<string, unknown>,
  ) {
    super(aggregateId, EventType.COLLECTION_CREATED, 1, metadata);
  }

  /**
   * 获取事件数据
   * @returns 事件数据对象
   */
  getData(): Record<string, unknown> {
    return {
      name: this.name,
      description: this.description,
    };
  }
}

/**
 * 集合更新事件
 */
export class CollectionUpdatedEvent extends CollectionDomainEvent {
  /**
   * 构造函数
   * @param aggregateId 聚合根ID
   * @param name 集合名称
   * @param description 集合描述
   * @param metadata 事件元数据
   */
  constructor(
    aggregateId: CollectionId,
    public readonly name?: string,
    public readonly description?: string,
    metadata?: Record<string, unknown>,
  ) {
    super(aggregateId, EventType.COLLECTION_UPDATED, 1, metadata);
  }

  /**
   * 获取事件数据
   * @returns 事件数据对象
   */
  getData(): Record<string, unknown> {
    return {
      name: this.name,
      description: this.description,
    };
  }
}

/**
 * 集合删除事件
 */
export class CollectionDeletedEvent extends CollectionDomainEvent {
  /**
   * 构造函数
   * @param aggregateId 聚合根ID
   * @param name 集合名称
   * @param reason 删除原因
   * @param metadata 事件元数据
   */
  constructor(
    aggregateId: CollectionId,
    public readonly name: string,
    public readonly reason?: string,
    metadata?: Record<string, unknown>,
  ) {
    super(aggregateId, EventType.COLLECTION_DELETED, 1, metadata);
  }

  /**
   * 获取事件数据
   * @returns 事件数据对象
   */
  getData(): Record<string, unknown> {
    return {
      name: this.name,
      reason: this.reason,
    };
  }
}

/**
 * 文档添加到集合事件
 */
export class DocumentAddedToCollectionEvent extends CollectionDomainEvent {
  /**
   * 构造函数
   * @param aggregateId 聚合根ID
   * @param docId 文档ID
   * @param docKey 文档键值
   * @param docName 文档名称
   * @param metadata 事件元数据
   */
  constructor(
    aggregateId: CollectionId,
    public readonly docId: DocId,
    public readonly docKey: string,
    public readonly docName?: string,
    metadata?: Record<string, unknown>,
  ) {
    super(aggregateId, EventType.DOCUMENT_ADDED_TO_COLLECTION, 1, metadata);
  }

  /**
   * 获取事件数据
   * @returns 事件数据对象
   */
  getData(): Record<string, unknown> {
    return {
      docId: this.docId,
      docKey: this.docKey,
      docName: this.docName,
    };
  }
}

/**
 * 文档从集合移除事件
 */
export class DocumentRemovedFromCollectionEvent extends CollectionDomainEvent {
  /**
   * 构造函数
   * @param aggregateId 聚合根ID
   * @param docId 文档ID
   * @param docKey 文档键值
   * @param reason 移除原因
   * @param metadata 事件元数据
   */
  constructor(
    aggregateId: CollectionId,
    public readonly docId: DocId,
    public readonly docKey: string,
    public readonly reason?: string,
    metadata?: Record<string, unknown>,
  ) {
    super(aggregateId, EventType.DOCUMENT_REMOVED_FROM_COLLECTION, 1, metadata);
  }

  /**
   * 获取事件数据
   * @returns 事件数据对象
   */
  getData(): Record<string, unknown> {
    return {
      docId: this.docId,
      docKey: this.docKey,
      reason: this.reason,
    };
  }
}

// ============================================================================
// 文档相关事件
// ============================================================================

/**
 * 文档创建事件
 */
export class DocumentCreatedEvent extends DocumentDomainEvent {
  /**
   * 构造函数
   * @param aggregateId 聚合根ID
   * @param collectionId 集合ID
   * @param docKey 文档键值
   * @param contentLength 内容长度
   * @param name 文档名称
   * @param mime MIME类型
   * @param metadata 事件元数据
   */
  constructor(
    aggregateId: DocId,
    public readonly collectionId: CollectionId,
    public readonly docKey: string,
    public readonly contentLength: number,
    public readonly name?: string,
    public readonly mime?: string,
    metadata?: Record<string, unknown>,
  ) {
    super(aggregateId, EventType.DOCUMENT_CREATED, 1, metadata);
  }

  /**
   * 获取事件数据
   * @returns 事件数据对象
   */
  getData(): Record<string, unknown> {
    return {
      collectionId: this.collectionId,
      docKey: this.docKey,
      contentLength: this.contentLength,
      name: this.name,
      mime: this.mime,
    };
  }
}

/**
 * 文档更新事件
 */
export class DocumentUpdatedEvent extends DocumentDomainEvent {
  /**
   * 构造函数
   * @param aggregateId 聚合根ID
   * @param collectionId 集合ID
   * @param oldName 旧文档名称
   * @param newName 新文档名称
   * @param oldMime 旧MIME类型
   * @param newMime 新MIME类型
   * @param metadata 事件元数据
   */
  constructor(
    aggregateId: DocId,
    public readonly collectionId: CollectionId,
    public readonly oldName?: string,
    public readonly newName?: string,
    public readonly oldMime?: string,
    public readonly newMime?: string,
    metadata?: Record<string, unknown>,
  ) {
    super(aggregateId, EventType.DOCUMENT_UPDATED, 1, metadata);
  }

  /**
   * 获取事件数据
   * @returns 事件数据对象
   */
  getData(): Record<string, unknown> {
    return {
      collectionId: this.collectionId,
      oldName: this.oldName,
      newName: this.newName,
      oldMime: this.oldMime,
      newMime: this.newMime,
    };
  }
}

/**
 * 文档删除事件
 */
export class DocumentDeletedEvent extends DocumentDomainEvent {
  /**
   * 构造函数
   * @param aggregateId 聚合根ID
   * @param collectionId 集合ID
   * @param docKey 文档键值
   * @param reason 删除原因
   * @param metadata 事件元数据
   */
  constructor(
    aggregateId: DocId,
    public readonly collectionId: CollectionId,
    public readonly docKey: string,
    public readonly reason?: string,
    metadata?: Record<string, unknown>,
  ) {
    super(aggregateId, EventType.DOCUMENT_DELETED, 1, metadata);
  }

  /**
   * 获取事件数据
   * @returns 事件数据对象
   */
  getData(): Record<string, unknown> {
    return {
      collectionId: this.collectionId,
      docKey: this.docKey,
      reason: this.reason,
    };
  }
}

/**
 * 文档内容更新事件
 */
export class DocumentContentUpdatedEvent extends DocumentDomainEvent {
  /**
   * 构造函数
   * @param aggregateId 聚合根ID
   * @param collectionId 集合ID
   * @param oldContentLength 旧内容长度
   * @param newContentLength 新内容长度
   * @param changeReason 变更原因
   * @param metadata 事件元数据
   */
  constructor(
    aggregateId: DocId,
    public readonly collectionId: CollectionId,
    public readonly oldContentLength: number,
    public readonly newContentLength: number,
    public readonly changeReason?: string,
    metadata?: Record<string, unknown>,
  ) {
    super(aggregateId, EventType.DOCUMENT_CONTENT_UPDATED, 1, metadata);
  }

  /**
   * 获取事件数据
   * @returns 事件数据对象
   */
  getData(): Record<string, unknown> {
    return {
      collectionId: this.collectionId,
      oldContentLength: this.oldContentLength,
      newContentLength: this.newContentLength,
      changeReason: this.changeReason,
    };
  }
}

/**
 * 文档状态变更事件
 */
export class DocumentStatusChangedEvent extends DocumentDomainEvent {
  /**
   * 构造函数
   * @param aggregateId 聚合根ID
   * @param collectionId 集合ID
   * @param oldStatus 旧状态
   * @param newStatus 新状态
   * @param reason 变更原因
   * @param metadata 事件元数据
   */
  constructor(
    aggregateId: DocId,
    public readonly collectionId: CollectionId,
    public readonly oldStatus: string,
    public readonly newStatus: string,
    public readonly reason?: string,
    metadata?: Record<string, unknown>,
  ) {
    super(aggregateId, EventType.DOCUMENT_STATUS_CHANGED, 1, metadata);
  }

  /**
   * 获取事件数据
   * @returns 事件数据对象
   */
  getData(): Record<string, unknown> {
    return {
      collectionId: this.collectionId,
      oldStatus: this.oldStatus,
      newStatus: this.newStatus,
      reason: this.reason,
    };
  }
}

// ============================================================================
// 块相关事件
// ============================================================================

/**
 * 块创建事件
 */
export class ChunkCreatedEvent extends ChunkDomainEvent {
  /**
   * 构造函数
   * @param aggregateId 聚合根ID
   * @param docId 文档ID
   * @param collectionId 集合ID
   * @param chunkIndex 块索引
   * @param contentLength 内容长度
   * @param title 块标题
   * @param metadata 事件元数据
   */
  constructor(
    aggregateId: PointId,
    public readonly docId: DocId,
    public readonly collectionId: CollectionId,
    public readonly chunkIndex: number,
    public readonly contentLength: number,
    public readonly title?: string,
    metadata?: Record<string, unknown>,
  ) {
    super(aggregateId, EventType.CHUNK_CREATED, 1, metadata);
  }

  /**
   * 获取事件数据
   * @returns 事件数据对象
   */
  getData(): Record<string, unknown> {
    return {
      docId: this.docId,
      collectionId: this.collectionId,
      chunkIndex: this.chunkIndex,
      contentLength: this.contentLength,
      title: this.title,
    };
  }
}

/**
 * 块更新事件
 */
export class ChunkUpdatedEvent extends ChunkDomainEvent {
  /**
   * 构造函数
   * @param aggregateId 聚合根ID
   * @param docId 文档ID
   * @param collectionId 集合ID
   * @param chunkIndex 块索引
   * @param oldTitle 旧标题
   * @param newTitle 新标题
   * @param oldContentLength 旧内容长度
   * @param newContentLength 新内容长度
   * @param metadata 事件元数据
   */
  constructor(
    aggregateId: PointId,
    public readonly docId: DocId,
    public readonly collectionId: CollectionId,
    public readonly chunkIndex: number,
    public readonly oldTitle?: string,
    public readonly newTitle?: string,
    public readonly oldContentLength?: number,
    public readonly newContentLength?: number,
    metadata?: Record<string, unknown>,
  ) {
    super(aggregateId, EventType.CHUNK_UPDATED, 1, metadata);
  }

  /**
   * 获取事件数据
   * @returns 事件数据对象
   */
  getData(): Record<string, unknown> {
    return {
      docId: this.docId,
      collectionId: this.collectionId,
      chunkIndex: this.chunkIndex,
      oldTitle: this.oldTitle,
      newTitle: this.newTitle,
      oldContentLength: this.oldContentLength,
      newContentLength: this.newContentLength,
    };
  }
}

/**
 * 块删除事件
 */
export class ChunkDeletedEvent extends ChunkDomainEvent {
  /**
   * 构造函数
   * @param aggregateId 聚合根ID
   * @param docId 文档ID
   * @param collectionId 集合ID
   * @param chunkIndex 块索引
   * @param reason 删除原因
   * @param metadata 事件元数据
   */
  constructor(
    aggregateId: PointId,
    public readonly docId: DocId,
    public readonly collectionId: CollectionId,
    public readonly chunkIndex: number,
    public readonly reason?: string,
    metadata?: Record<string, unknown>,
  ) {
    super(aggregateId, EventType.CHUNK_DELETED, 1, metadata);
  }

  /**
   * 获取事件数据
   * @returns 事件数据对象
   */
  getData(): Record<string, unknown> {
    return {
      docId: this.docId,
      collectionId: this.collectionId,
      chunkIndex: this.chunkIndex,
      reason: this.reason,
    };
  }
}

/**
 * 块嵌入生成事件
 */
export class ChunkEmbeddingGeneratedEvent extends ChunkDomainEvent {
  /**
   * 构造函数
   * @param aggregateId 聚合根ID
   * @param docId 文档ID
   * @param collectionId 集合ID
   * @param chunkIndex 块索引
   * @param embeddingDimension 嵌入向量维度
   * @param embeddingModel 嵌入模型
   * @param metadata 事件元数据
   */
  constructor(
    aggregateId: PointId,
    public readonly docId: DocId,
    public readonly collectionId: CollectionId,
    public readonly chunkIndex: number,
    public readonly embeddingDimension: number,
    public readonly embeddingModel?: string,
    metadata?: Record<string, unknown>,
  ) {
    super(aggregateId, EventType.CHUNK_EMBEDDING_GENERATED, 1, metadata);
  }

  /**
   * 获取事件数据
   * @returns 事件数据对象
   */
  getData(): Record<string, unknown> {
    return {
      docId: this.docId,
      collectionId: this.collectionId,
      chunkIndex: this.chunkIndex,
      embeddingDimension: this.embeddingDimension,
      embeddingModel: this.embeddingModel,
    };
  }
}

/**
 * 块状态变更事件
 */
export class ChunkStatusChangedEvent extends ChunkDomainEvent {
  /**
   * 构造函数
   * @param aggregateId 聚合根ID
   * @param docId 文档ID
   * @param collectionId 集合ID
   * @param chunkIndex 块索引
   * @param oldStatus 旧状态
   * @param newStatus 新状态
   * @param reason 变更原因
   * @param metadata 事件元数据
   */
  constructor(
    aggregateId: PointId,
    public readonly docId: DocId,
    public readonly collectionId: CollectionId,
    public readonly chunkIndex: number,
    public readonly oldStatus: string,
    public readonly newStatus: string,
    public readonly reason?: string,
    metadata?: Record<string, unknown>,
  ) {
    super(aggregateId, EventType.CHUNK_STATUS_CHANGED, 1, metadata);
  }

  /**
   * 获取事件数据
   * @returns 事件数据对象
   */
  getData(): Record<string, unknown> {
    return {
      docId: this.docId,
      collectionId: this.collectionId,
      chunkIndex: this.chunkIndex,
      oldStatus: this.oldStatus,
      newStatus: this.newStatus,
      reason: this.reason,
    };
  }
}

// ============================================================================
// 事件工厂
// ============================================================================

/**
 * 领域事件工厂
 * 用于创建和反序列化领域事件
 */
export class DomainEventFactory {
  /**
   * 从序列化数据创建事件实例
   * @param serializedData 序列化的事件数据
   * @returns 领域事件实例
   */
  static fromSerializedData(serializedData: string): IDomainEvent {
    const data = JSON.parse(serializedData);

    switch (data.eventType) {
      // 集合事件
      case EventType.COLLECTION_CREATED:
        return new CollectionCreatedEvent(
          data.aggregateId,
          data.data.name,
          data.data.description,
          data.metadata,
        );

      case EventType.COLLECTION_UPDATED:
        return new CollectionUpdatedEvent(
          data.aggregateId,
          data.data.name,
          data.data.description,
          data.metadata,
        );

      case EventType.COLLECTION_DELETED:
        return new CollectionDeletedEvent(
          data.aggregateId,
          data.data.name,
          data.data.reason,
          data.metadata,
        );

      case EventType.DOCUMENT_ADDED_TO_COLLECTION:
        return new DocumentAddedToCollectionEvent(
          data.aggregateId,
          data.data.docId,
          data.data.docKey,
          data.data.docName,
          data.metadata,
        );

      case EventType.DOCUMENT_REMOVED_FROM_COLLECTION:
        return new DocumentRemovedFromCollectionEvent(
          data.aggregateId,
          data.data.docId,
          data.data.docKey,
          data.data.reason,
          data.metadata,
        );

      // 文档事件
      case EventType.DOCUMENT_CREATED:
        return new DocumentCreatedEvent(
          data.aggregateId,
          data.data.collectionId,
          data.data.docKey,
          data.data.contentLength,
          data.data.name,
          data.data.mime,
          data.metadata,
        );

      case EventType.DOCUMENT_UPDATED:
        return new DocumentUpdatedEvent(
          data.aggregateId,
          data.data.collectionId,
          data.data.oldName,
          data.data.newName,
          data.data.oldMime,
          data.data.newMime,
          data.metadata,
        );

      case EventType.DOCUMENT_DELETED:
        return new DocumentDeletedEvent(
          data.aggregateId,
          data.data.collectionId,
          data.data.docKey,
          data.data.reason,
          data.metadata,
        );

      case EventType.DOCUMENT_CONTENT_UPDATED:
        return new DocumentContentUpdatedEvent(
          data.aggregateId,
          data.data.collectionId,
          data.data.oldContentLength,
          data.data.newContentLength,
          data.data.changeReason,
          data.metadata,
        );

      case EventType.DOCUMENT_STATUS_CHANGED:
        return new DocumentStatusChangedEvent(
          data.aggregateId,
          data.data.collectionId,
          data.data.oldStatus,
          data.data.newStatus,
          data.data.reason,
          data.metadata,
        );

      // 块事件
      case EventType.CHUNK_CREATED:
        return new ChunkCreatedEvent(
          data.aggregateId,
          data.data.docId,
          data.data.collectionId,
          data.data.chunkIndex,
          data.data.contentLength,
          data.data.title,
          data.metadata,
        );

      case EventType.CHUNK_UPDATED:
        return new ChunkUpdatedEvent(
          data.aggregateId,
          data.data.docId,
          data.data.collectionId,
          data.data.chunkIndex,
          data.data.oldTitle,
          data.data.newTitle,
          data.data.oldContentLength,
          data.data.newContentLength,
          data.metadata,
        );

      case EventType.CHUNK_DELETED:
        return new ChunkDeletedEvent(
          data.aggregateId,
          data.data.docId,
          data.data.collectionId,
          data.data.chunkIndex,
          data.data.reason,
          data.metadata,
        );

      case EventType.CHUNK_EMBEDDING_GENERATED:
        return new ChunkEmbeddingGeneratedEvent(
          data.aggregateId,
          data.data.docId,
          data.data.collectionId,
          data.data.chunkIndex,
          data.data.embeddingDimension,
          data.data.embeddingModel,
          data.metadata,
        );

      case EventType.CHUNK_STATUS_CHANGED:
        return new ChunkStatusChangedEvent(
          data.aggregateId,
          data.data.docId,
          data.data.collectionId,
          data.data.chunkIndex,
          data.data.oldStatus,
          data.data.newStatus,
          data.data.reason,
          data.metadata,
        );

      default:
        throw new Error(`Unknown event type: ${data.eventType}`);
    }
  }
}
