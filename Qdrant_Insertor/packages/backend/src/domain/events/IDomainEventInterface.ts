import { CollectionId, DocId, PointId } from '../entities/types.js';

/**
 * 领域事件接口
 * 所有领域事件必须实现此接口
 */
export interface IDomainEvent {
  /**
   * 事件发生时间戳
   */
  readonly occurredOn: number;

  /**
   * 聚合根ID
   */
  readonly aggregateId: string;

  /**
   * 事件类型
   */
  readonly eventType: string;

  /**
   * 事件版本
   */
  readonly version: number;

  /**
   * 事件ID（唯一标识）
   */
  readonly eventId: string;

  /**
   * 事件元数据
   */
  readonly metadata?: Record<string, unknown>;

  /**
   * 序列化事件数据
   */
  serialize(): string;

  /**
   * 获取事件数据
   */
  getData(): Record<string, unknown>;
}

/**
 * 领域事件基类
 * 提供领域事件的通用实现
 */
export abstract class DomainEventBase implements IDomainEvent {
  public readonly occurredOn: number;
  public readonly aggregateId: string;
  public readonly eventType: string;
  public readonly version: number;
  public readonly eventId: string;
  public readonly metadata?: Record<string, unknown>;

  /**
   * 构造函数
   * @param aggregateId 聚合根ID
   * @param eventType 事件类型
   * @param version 事件版本
   * @param metadata 事件元数据
   */
  constructor(
    aggregateId: string,
    eventType: string,
    version: number = 1,
    metadata?: Record<string, unknown>,
  ) {
    this.aggregateId = aggregateId;
    this.eventType = eventType;
    this.version = version;
    this.eventId = this.generateEventId();
    this.occurredOn = Date.now();
    this.metadata = metadata;
  }

  /**
   * 生成事件ID
   * @returns 事件ID
   */
  private generateEventId(): string {
    return `${this.eventType}_${this.aggregateId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 序列化事件数据
   * @returns 序列化后的JSON字符串
   */
  serialize(): string {
    return JSON.stringify({
      eventId: this.eventId,
      eventType: this.eventType,
      aggregateId: this.aggregateId,
      occurredOn: this.occurredOn,
      version: this.version,
      metadata: this.metadata,
      data: this.getData(),
    });
  }

  /**
   * 获取事件数据（由子类实现）
   * @returns 事件数据对象
   */
  abstract getData(): Record<string, unknown>;
}

/**
 * 集合领域事件基类
 */
export abstract class CollectionDomainEvent extends DomainEventBase {
  /**
   * 构造函数
   * @param aggregateId 聚合根ID
   * @param eventType 事件类型
   * @param version 事件版本
   * @param metadata 事件元数据
   */
  constructor(
    aggregateId: CollectionId,
    eventType: string,
    version: number = 1,
    metadata?: Record<string, unknown>,
  ) {
    super(aggregateId, eventType, version, metadata);
  }
}

/**
 * 文档领域事件基类
 */
export abstract class DocumentDomainEvent extends DomainEventBase {
  /**
   * 构造函数
   * @param aggregateId 聚合根ID
   * @param eventType 事件类型
   * @param version 事件版本
   * @param metadata 事件元数据
   */
  constructor(
    aggregateId: DocId,
    eventType: string,
    version: number = 1,
    metadata?: Record<string, unknown>,
  ) {
    super(aggregateId, eventType, version, metadata);
  }
}

/**
 * 块领域事件基类
 */
export abstract class ChunkDomainEvent extends DomainEventBase {
  /**
   * 构造函数
   * @param aggregateId 聚合根ID
   * @param eventType 事件类型
   * @param version 事件版本
   * @param metadata 事件元数据
   */
  constructor(
    aggregateId: PointId,
    eventType: string,
    version: number = 1,
    metadata?: Record<string, unknown>,
  ) {
    super(aggregateId, eventType, version, metadata);
  }
}

/**
 * 事件类型枚举
 */
export enum EventType {
  // 集合事件
  COLLECTION_CREATED = 'CollectionCreated',
  COLLECTION_UPDATED = 'CollectionUpdated',
  COLLECTION_DELETED = 'CollectionDeleted',

  // 文档事件
  DOCUMENT_CREATED = 'DocumentCreated',
  DOCUMENT_UPDATED = 'DocumentUpdated',
  DOCUMENT_DELETED = 'DocumentDeleted',
  DOCUMENT_CONTENT_UPDATED = 'DocumentContentUpdated',
  DOCUMENT_STATUS_CHANGED = 'DocumentStatusChanged',
  DOCUMENT_ADDED_TO_COLLECTION = 'DocumentAddedToCollection',
  DOCUMENT_REMOVED_FROM_COLLECTION = 'DocumentRemovedFromCollection',

  // 块事件
  CHUNK_CREATED = 'ChunkCreated',
  CHUNK_UPDATED = 'ChunkUpdated',
  CHUNK_DELETED = 'ChunkDeleted',
  CHUNK_EMBEDDING_GENERATED = 'ChunkEmbeddingGenerated',
  CHUNK_STATUS_CHANGED = 'ChunkStatusChanged',
}

/**
 * 事件优先级枚举
 */
export enum EventPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4,
}

/**
 * 事件状态枚举
 */
export enum EventStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  FAILED = 'failed',
  RETRYING = 'retrying',
}
