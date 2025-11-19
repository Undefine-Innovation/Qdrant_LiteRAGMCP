import {
  EventHandlerBase,
  AsyncEventHandler,
  BatchEventHandler,
} from './EventHandlerBase.js';
import {
  IDomainEvent,
  CollectionCreatedEvent,
  CollectionUpdatedEvent,
  CollectionDeletedEvent,
  DocumentCreatedEvent,
  DocumentUpdatedEvent,
  DocumentDeletedEvent,
  DocumentContentUpdatedEvent,
  DocumentStatusChangedEvent,
  DocumentAddedToCollectionEvent,
  DocumentRemovedFromCollectionEvent,
  ChunkCreatedEvent,
  ChunkUpdatedEvent,
  ChunkDeletedEvent,
  ChunkEmbeddingGeneratedEvent,
  ChunkStatusChangedEvent,
  EventType,
} from './DomainEvents.js';
import { Logger } from '../../infrastructure/logging/logger.js';
import { CollectionId, DocId, PointId } from '../entities/types.js';

// ============================================================================
// 集合事件处理器
// ============================================================================

/**
 * 集合创建事件处理器
 * 处理集合创建后的业务逻辑
 */
export class CollectionCreatedEventHandler extends AsyncEventHandler<CollectionCreatedEvent> {
  /**
   * 构造函数
   * @param logger 日志记录器
   */
  constructor(logger: Logger) {
    super(logger);
  }

  /**
   * 获取处理器名称
   * @returns 处理器名称
   */
  getName(): string {
    return 'CollectionCreatedEventHandler';
  }

  /**
   * 获取事件类型
   * @returns 事件类型
   */
  getEventType(): string {
    return EventType.COLLECTION_CREATED;
  }

  /**
   * 处理事件
   * @param event 集合创建事件
   */
  protected async handleInternal(event: CollectionCreatedEvent): Promise<void> {
    this.logger.info('Processing collection created event', {
      eventId: event.eventId,
      collectionId: event.aggregateId,
      collectionName: event.name,
    });

    // 这里可以添加集合创建后的业务逻辑，例如：
    // - 初始化集合的默认配置
    // - 发送通知
    // - 更新缓存
    // - 记录审计日志

    // 示例：记录审计日志
    await this.logAuditEvent('COLLECTION_CREATED', {
      collectionId: event.aggregateId,
      collectionName: event.name,
      description: event.description,
      timestamp: event.occurredOn,
    });
  }

  /**
   * 记录审计事件
   * @param action 操作类型
   * @param data 事件数据
   */
  private async logAuditEvent(
    action: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    // 实际实现应该写入审计日志表
    this.logger.info('Audit log entry', { action, data });
  }
}

/**
 * 集合更新事件处理器
 * 处理集合更新后的业务逻辑
 */
export class CollectionUpdatedEventHandler extends AsyncEventHandler<CollectionUpdatedEvent> {
  /**
   * 构造函数
   * @param logger 日志记录器
   */
  constructor(logger: Logger) {
    super(logger);
  }

  /**
   * 获取处理器名称
   * @returns 处理器名称
   */
  getName(): string {
    return 'CollectionUpdatedEventHandler';
  }

  /**
   * 获取事件类型
   * @returns 事件类型
   */
  getEventType(): string {
    return EventType.COLLECTION_UPDATED;
  }

  /**
   * 处理事件
   * @param event 集合更新事件
   */
  protected async handleInternal(event: CollectionUpdatedEvent): Promise<void> {
    this.logger.info('Processing collection updated event', {
      eventId: event.eventId,
      collectionId: event.aggregateId,
      name: event.name,
      description: event.description,
    });

    // 这里可以添加集合更新后的业务逻辑，例如：
    // - 更新缓存
    // - 发送通知
    // - 记录审计日志

    await this.logAuditEvent('COLLECTION_UPDATED', {
      collectionId: event.aggregateId,
      name: event.name,
      description: event.description,
      timestamp: event.occurredOn,
    });
  }

  /**
   * 记录审计事件
   * @param action 操作类型
   * @param data 事件数据
   */
  private async logAuditEvent(
    action: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    this.logger.info('Audit log entry', { action, data });
  }
}

/**
 * 集合删除事件处理器
 * 处理集合删除后的业务逻辑
 */
export class CollectionDeletedEventHandler extends AsyncEventHandler<CollectionDeletedEvent> {
  /**
   * 构造函数
   * @param logger 日志记录器
   */
  constructor(logger: Logger) {
    super(logger);
  }

  /**
   * 获取处理器名称
   * @returns 处理器名称
   */
  getName(): string {
    return 'CollectionDeletedEventHandler';
  }

  /**
   * 获取事件类型
   * @returns 事件类型
   */
  getEventType(): string {
    return EventType.COLLECTION_DELETED;
  }

  /**
   * 处理事件
   * @param event 集合删除事件
   */
  protected async handleInternal(event: CollectionDeletedEvent): Promise<void> {
    this.logger.info('Processing collection deleted event', {
      eventId: event.eventId,
      collectionId: event.aggregateId,
      collectionName: event.name,
      reason: event.reason,
    });

    // 这里可以添加集合删除后的业务逻辑，例如：
    // - 清理相关缓存
    // - 发送通知
    // - 记录审计日志
    // - 清理相关资源

    await this.logAuditEvent('COLLECTION_DELETED', {
      collectionId: event.aggregateId,
      collectionName: event.name,
      reason: event.reason,
      timestamp: event.occurredOn,
    });
  }

  /**
   * 记录审计事件
   * @param action 操作类型
   * @param data 事件数据
   */
  private async logAuditEvent(
    action: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    this.logger.info('Audit log entry', { action, data });
  }
}

// ============================================================================
// 文档事件处理器
// ============================================================================

/**
 * 文档创建事件处理器
 * 处理文档创建后的业务逻辑
 */
export class DocumentCreatedEventHandler extends AsyncEventHandler<DocumentCreatedEvent> {
  /**
   * 构造函数
   * @param logger 日志记录器
   */
  constructor(logger: Logger) {
    super(logger);
  }

  /**
   * 获取处理器名称
   * @returns 处理器名称
   */
  getName(): string {
    return 'DocumentCreatedEventHandler';
  }

  /**
   * 获取事件类型
   * @returns 事件类型
   */
  getEventType(): string {
    return EventType.DOCUMENT_CREATED;
  }

  /**
   * 处理事件
   * @param event 文档创建事件
   */
  protected async handleInternal(event: DocumentCreatedEvent): Promise<void> {
    this.logger.info('Processing document created event', {
      eventId: event.eventId,
      docId: event.aggregateId,
      collectionId: event.collectionId,
      docKey: event.docKey,
      contentLength: event.contentLength,
    });

    // 这里可以添加文档创建后的业务逻辑，例如：
    // - 启动文档处理流程
    // - 更新集合统计信息
    // - 发送通知
    // - 记录审计日志

    await this.logAuditEvent('DOCUMENT_CREATED', {
      docId: event.aggregateId,
      collectionId: event.collectionId,
      docKey: event.docKey,
      contentLength: event.contentLength,
      timestamp: event.occurredOn,
    });
  }

  /**
   * 记录审计事件
   * @param action 操作类型
   * @param data 事件数据
   */
  private async logAuditEvent(
    action: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    this.logger.info('Audit log entry', { action, data });
  }
}

/**
 * 文档状态变更事件处理器
 * 处理文档状态变更后的业务逻辑
 */
export class DocumentStatusChangedEventHandler extends AsyncEventHandler<DocumentStatusChangedEvent> {
  /**
   * 构造函数
   * @param logger 日志记录器
   */
  constructor(logger: Logger) {
    super(logger);
  }

  /**
   * 获取处理器名称
   * @returns 处理器名称
   */
  getName(): string {
    return 'DocumentStatusChangedEventHandler';
  }

  /**
   * 获取事件类型
   * @returns 事件类型
   */
  getEventType(): string {
    return EventType.DOCUMENT_STATUS_CHANGED;
  }

  /**
   * 处理事件
   * @param event 文档状态变更事件
   */
  protected async handleInternal(
    event: DocumentStatusChangedEvent,
  ): Promise<void> {
    this.logger.info('Processing document status changed event', {
      eventId: event.eventId,
      docId: event.aggregateId,
      collectionId: event.collectionId,
      oldStatus: event.oldStatus,
      newStatus: event.newStatus,
      reason: event.reason,
    });

    // 这里可以添加文档状态变更后的业务逻辑，例如：
    // - 更新集合统计信息
    // - 发送通知
    // - 记录审计日志
    // - 触发后续处理流程

    // 如果文档处理完成，可以触发相关操作
    if (event.newStatus === 'completed') {
      await this.handleDocumentCompleted(event);
    } else if (event.newStatus === 'failed') {
      await this.handleDocumentFailed(event);
    }

    await this.logAuditEvent('DOCUMENT_STATUS_CHANGED', {
      docId: event.aggregateId,
      collectionId: event.collectionId,
      oldStatus: event.oldStatus,
      newStatus: event.newStatus,
      reason: event.reason,
      timestamp: event.occurredOn,
    });
  }

  /**
   * 处理文档完成事件
   * @param event 文档状态变更事件
   */
  private async handleDocumentCompleted(
    event: DocumentStatusChangedEvent,
  ): Promise<void> {
    this.logger.info('Document processing completed', {
      docId: event.aggregateId,
      collectionId: event.collectionId,
    });

    // 这里可以添加文档完成后的特殊处理逻辑
  }

  /**
   * 处理文档失败事件
   * @param event 文档状态变更事件
   */
  private async handleDocumentFailed(
    event: DocumentStatusChangedEvent,
  ): Promise<void> {
    this.logger.warn('Document processing failed', {
      docId: event.aggregateId,
      collectionId: event.collectionId,
      reason: event.reason,
    });

    // 这里可以添加文档失败后的特殊处理逻辑，例如重试机制
  }

  /**
   * 记录审计事件
   * @param action 操作类型
   * @param data 事件数据
   */
  private async logAuditEvent(
    action: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    this.logger.info('Audit log entry', { action, data });
  }
}

// ============================================================================
// 块事件处理器
// ============================================================================

/**
 * 块嵌入生成事件处理器
 * 处理块嵌入生成后的业务逻辑
 */
export class ChunkEmbeddingGeneratedEventHandler extends BatchEventHandler<ChunkEmbeddingGeneratedEvent> {
  /**
   * 构造函数
   * @param logger 日志记录器
   * @param batchSize 批处理大小
   * @param batchTimeout 批处理超时时间
   */
  constructor(
    logger: Logger,
    batchSize: number = 50,
    batchTimeout: number = 5000,
  ) {
    super(logger, batchSize, batchTimeout);
  }

  /**
   * 获取处理器名称
   * @returns 处理器名称
   */
  getName(): string {
    return 'ChunkEmbeddingGeneratedEventHandler';
  }

  /**
   * 获取事件类型
   * @returns 事件类型
   */
  getEventType(): string {
    return EventType.CHUNK_EMBEDDING_GENERATED;
  }

  /**
   * 处理事件
   * @param event 块嵌入生成事件
   */
  protected async handleInternal(
    event: ChunkEmbeddingGeneratedEvent,
  ): Promise<void> {
    // For batch handlers, handleInternal is not used
    // Instead, handleBatch is called
    this.logger.warn(
      'handleInternal called on BatchEventHandler, should use handleBatch instead',
      {
        eventId: event.eventId,
      },
    );
  }

  /**
   * 批量处理事件
   * @param events 事件数组
   */
  protected async handleBatch(
    events: ChunkEmbeddingGeneratedEvent[],
  ): Promise<void> {
    this.logger.info('Processing batch of chunk embedding generated events', {
      eventCount: events.length,
      docIds: [...new Set(events.map((e) => e.docId))],
      collectionIds: [...new Set(events.map((e) => e.collectionId))],
    });

    // 按文档分组处理
    const eventsByDoc = new Map<DocId, ChunkEmbeddingGeneratedEvent[]>();
    for (const event of events) {
      if (!eventsByDoc.has(event.docId)) {
        eventsByDoc.set(event.docId, []);
      }
      eventsByDoc.get(event.docId)!.push(event);
    }

    // 处理每个文档的块嵌入完成事件
    for (const [docId, docEvents] of eventsByDoc) {
      await this.processDocumentChunksCompleted(docId, docEvents);
    }
  }

  /**
   * 处理文档块嵌入完成事件
   * @param docId 文档ID
   * @param events 事件数组
   */
  private async processDocumentChunksCompleted(
    docId: DocId,
    events: ChunkEmbeddingGeneratedEvent[],
  ): Promise<void> {
    this.logger.info('Processing document chunks embedding completed', {
      docId,
      chunkCount: events.length,
      collectionId: events[0]?.collectionId,
    });

    // 这里可以添加块嵌入完成后的业务逻辑，例如：
    // - 检查文档是否所有块都已完成嵌入
    // - 更新文档状态
    // - 同步到向量数据库
    // - 发送通知

    // 示例：检查是否需要更新文档状态
    // 这需要查询文档的所有块来确认是否全部完成
    // 实际实现中应该注入相应的服务来查询

    await this.logAuditEvent('CHUNKS_EMBEDDING_COMPLETED', {
      docId,
      chunkCount: events.length,
      timestamp: Date.now(),
    });
  }

  /**
   * 记录审计事件
   * @param action 操作类型
   * @param data 事件数据
   */
  private async logAuditEvent(
    action: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    this.logger.info('Audit log entry', { action, data });
  }
}

// ============================================================================
// 通用事件处理器
// ============================================================================

/**
 * 审计日志事件处理器
 * 记录所有领域事件的审计日志
 */
export class AuditLogEventHandler extends AsyncEventHandler<IDomainEvent> {
  /**
   * 构造函数
   * @param logger 日志记录器
   */
  constructor(logger: Logger) {
    super(logger);
  }

  /**
   * 获取处理器名称
   * @returns 处理器名称
   */
  getName(): string {
    return 'AuditLogEventHandler';
  }

  /**
   * 获取事件类型
   * @returns 事件类型
   */
  getEventType(): string {
    return '*'; // 处理所有事件类型
  }

  /**
   * 检查是否可以处理指定事件
   * @param event 领域事件
   * @returns 是否可以处理
   */
  canHandle(event: IDomainEvent): boolean {
    return true; // 处理所有事件
  }

  /**
   * 处理事件
   * @param event 领域事件
   */
  protected async handleInternal(event: IDomainEvent): Promise<void> {
    // 只记录重要事件的审计日志，避免日志过多
    const importantEvents = [
      EventType.COLLECTION_CREATED,
      EventType.COLLECTION_DELETED,
      EventType.DOCUMENT_CREATED,
      EventType.DOCUMENT_DELETED,
      EventType.DOCUMENT_STATUS_CHANGED,
    ];

    if (!importantEvents.includes(event.eventType as EventType)) {
      return;
    }

    await this.logAuditEvent(event);
  }

  /**
   * 记录审计事件
   * @param event 领域事件
   */
  private async logAuditEvent(event: IDomainEvent): Promise<void> {
    this.logger.info('Domain event audit log', {
      eventId: event.eventId,
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      occurredOn: event.occurredOn,
      data: event.getData(),
      metadata: event.metadata,
    });
  }
}

/**
 * 事件统计处理器
 * 收集和分析事件统计信息
 */
export class EventStatisticsEventHandler extends BatchEventHandler<IDomainEvent> {
  private eventCounts: Map<string, number> = new Map();
  private eventTypeCounts: Map<string, number> = new Map();

  /**
   * 构造函数
   * @param logger 日志记录器
   * @param batchSize 批处理大小
   * @param batchTimeout 批处理超时时间
   */
  constructor(
    logger: Logger,
    batchSize: number = 100,
    batchTimeout: number = 10000,
  ) {
    super(logger, batchSize, batchTimeout);
  }

  /**
   * 获取处理器名称
   * @returns 处理器名称
   */
  getName(): string {
    return 'EventStatisticsEventHandler';
  }

  /**
   * 获取事件类型
   * @returns 事件类型
   */
  getEventType(): string {
    return '*'; // 处理所有事件类型
  }

  /**
   * 检查是否可以处理指定事件
   * @param event 领域事件
   * @returns 是否可以处理
   */
  canHandle(event: IDomainEvent): boolean {
    return true; // 处理所有事件
  }

  /**
   * 处理事件
   * @param event 领域事件
   */
  protected async handleInternal(event: IDomainEvent): Promise<void> {
    // For batch handlers, handleInternal is not used
    // Instead, handleBatch is called
    this.logger.warn(
      'handleInternal called on BatchEventHandler, should use handleBatch instead',
      {
        eventId: event.eventId,
      },
    );
  }

  /**
   * 批量处理事件
   * @param events 事件数组
   */
  protected async handleBatch(events: IDomainEvent[]): Promise<void> {
    this.logger.info('Processing event statistics', {
      eventCount: events.length,
      eventTypes: [...new Set(events.map((e) => e.eventType))],
    });

    // 更新统计信息
    for (const event of events) {
      // 按聚合ID统计
      const currentCount = this.eventCounts.get(event.aggregateId) || 0;
      this.eventCounts.set(event.aggregateId, currentCount + 1);

      // 按事件类型统计
      const currentTypeCount = this.eventTypeCounts.get(event.eventType) || 0;
      this.eventTypeCounts.set(event.eventType, currentTypeCount + 1);
    }

    // 输出统计摘要
    this.logStatisticsSummary();
  }

  /**
   * 记录统计摘要
   */
  private logStatisticsSummary(): void {
    const totalEvents = Array.from(this.eventCounts.values()).reduce(
      (sum, count) => sum + count,
      0,
    );
    const uniqueAggregates = this.eventCounts.size;
    const uniqueEventTypes = this.eventTypeCounts.size;

    this.logger.info('Event statistics summary', {
      totalEvents,
      uniqueAggregates,
      uniqueEventTypes,
      topAggregates: this.getTopItems(this.eventCounts, 5),
      topEventTypes: this.getTopItems(this.eventTypeCounts, 5),
    });
  }

  /**
   * 获取热门项目
   * @param map 统计映射
   * @param limit 限制数量
   * @returns 热门项目列表
   */
  private getTopItems(
    map: Map<string, number>,
    limit: number,
  ): Array<{ key: string; count: number }> {
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([key, count]) => ({ key, count }));
  }

  /**
   * 获取当前统计信息
   * @returns 统计信息对象
   */
  getStatistics(): {
    eventCounts: Map<string, number>;
    eventTypeCounts: Map<string, number>;
  } {
    return {
      eventCounts: new Map(this.eventCounts),
      eventTypeCounts: new Map(this.eventTypeCounts),
    };
  }

  /**
   * 重置统计信息
   */
  resetStatistics(): void {
    this.eventCounts.clear();
    this.eventTypeCounts.clear();
    this.logger.info('Event statistics reset');
  }
}
