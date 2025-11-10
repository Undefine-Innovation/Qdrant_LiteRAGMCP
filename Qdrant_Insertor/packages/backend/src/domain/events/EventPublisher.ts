import {
  IDomainEvent,
  IEventPublisher,
  IEventBus,
  IEventHandler,
  IEventStore,
  IEventHandlingResult,
  IEventStatistics,
} from './IEventPublisher.js';
import { Logger } from '../../infrastructure/logging/logger.js';
import { ITransactionManager } from '../repositories/ITransactionManager.js';
import { TransactionContext } from '../../infrastructure/transactions/TransactionContext.js';

/**
 * 事件发布器实现
 * 负责发布领域事件到事件总线
 */
export class EventPublisher implements IEventPublisher {
  /**
   * 构造函数
   * @param eventBus 事件总线
   * @param eventStore 事件存储
   * @param transactionManager 事务管理器
   * @param logger 日志记录器
   */
  constructor(
    private readonly eventBus: IEventBus,
    private readonly eventStore: IEventStore,
    private readonly transactionManager?: ITransactionManager,
    private readonly logger?: Logger,
  ) {}

  /**
   * 发布单个事件
   * @param event
   */
  async publish(event: IDomainEvent): Promise<void> {
    try {
      // 保存事件到事件存储
      await this.eventStore.saveEvent(event);

      // 分发事件到处理器
      await this.eventBus.dispatch(event);

      this.logger?.debug('Event published successfully', {
        eventId: event.eventId,
        eventType: event.eventType,
        aggregateId: event.aggregateId,
      });
    } catch (error) {
      this.logger?.error('Failed to publish event', {
        eventId: event.eventId,
        eventType: event.eventType,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 批量发布事件
   * @param events
   */
  async publishBatch(events: IDomainEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    try {
      // 批量保存事件到事件存储
      await this.eventStore.saveEvents(events);

      // 批量分发事件到处理器
      await this.eventBus.dispatchBatch(events);

      this.logger?.debug('Events published successfully', {
        count: events.length,
        eventIds: events.map((e) => e.eventId),
      });
    } catch (error) {
      this.logger?.error('Failed to publish events', {
        count: events.length,
        eventIds: events.map((e) => e.eventId),
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 发布事件并等待处理完成
   * @param event
   */
  async publishAndWait(event: IDomainEvent): Promise<void> {
    try {
      // 保存事件到事件存储
      await this.eventStore.saveEvent(event);

      // 分发事件并等待处理完成
      await this.eventBus.dispatch(event);

      this.logger?.debug('Event published and processed', {
        eventId: event.eventId,
        eventType: event.eventType,
        aggregateId: event.aggregateId,
      });
    } catch (error) {
      this.logger?.error('Failed to publish and wait for event', {
        eventId: event.eventId,
        eventType: event.eventType,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 批量发布事件并等待处理完成
   * @param events
   */
  async publishBatchAndWait(events: IDomainEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    try {
      // 批量保存事件到事件存储
      await this.eventStore.saveEvents(events);

      // 批量分发事件并等待处理完成
      await this.eventBus.dispatchBatch(events);

      this.logger?.debug('Events published and processed', {
        count: events.length,
        eventIds: events.map((e) => e.eventId),
      });
    } catch (error) {
      this.logger?.error('Failed to publish and wait for events', {
        count: events.length,
        eventIds: events.map((e) => e.eventId),
        error: (error as Error).message,
      });
      throw error;
    }
  }
}

/**
 * 事务感知事件发布器
 * 在事务提交后才发布事件
 */
export class TransactionalEventPublisher implements IEventPublisher {
  private pendingEvents: Map<string, IDomainEvent[]> = new Map();

  /**
   * 构造函数
   * @param eventPublisher 事件发布器
   * @param transactionManager 事务管理器
   * @param logger 日志记录器
   */
  constructor(
    private readonly eventPublisher: EventPublisher,
    private readonly transactionManager: ITransactionManager,
    private readonly logger?: Logger,
  ) {}

  /**
   * 发布单个事件（事务感知）
   * @param event
   */
  async publish(event: IDomainEvent): Promise<void> {
    const currentTransaction = this.getCurrentTransaction();

    if (currentTransaction) {
      // 在事务中，将事件添加到待发布列表
      this.addPendingEvent(currentTransaction.transactionId, event);

      this.logger?.debug('Event added to transaction pending list', {
        eventId: event.eventId,
        transactionId: currentTransaction.transactionId,
      });
    } else {
      // 不在事务中，直接发布
      await this.eventPublisher.publish(event);
    }
  }

  /**
   * 批量发布事件（事务感知）
   * @param events
   */
  async publishBatch(events: IDomainEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    const currentTransaction = this.getCurrentTransaction();

    if (currentTransaction) {
      // 在事务中，将事件添加到待发布列表
      this.addPendingEvents(currentTransaction.transactionId, events);

      this.logger?.debug('Events added to transaction pending list', {
        count: events.length,
        transactionId: currentTransaction.transactionId,
      });
    } else {
      // 不在事务中，直接发布
      await this.eventPublisher.publishBatch(events);
    }
  }

  /**
   * 发布事件并等待处理完成（事务感知）
   * @param event
   */
  async publishAndWait(event: IDomainEvent): Promise<void> {
    const currentTransaction = this.getCurrentTransaction();

    if (currentTransaction) {
      // 在事务中，不能使用等待模式，因为事件会在事务提交后发布
      this.logger?.warn(
        'publishAndWait called within transaction, using regular publish',
        {
          eventId: event.eventId,
          transactionId: currentTransaction.transactionId,
        },
      );

      await this.publish(event);
    } else {
      // 不在事务中，直接发布并等待
      await this.eventPublisher.publishAndWait(event);
    }
  }

  /**
   * 批量发布事件并等待处理完成（事务感知）
   * @param events
   */
  async publishBatchAndWait(events: IDomainEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    const currentTransaction = this.getCurrentTransaction();

    if (currentTransaction) {
      // 在事务中，不能使用等待模式，因为事件会在事务提交后发布
      this.logger?.warn(
        'publishBatchAndWait called within transaction, using regular publishBatch',
        {
          count: events.length,
          transactionId: currentTransaction.transactionId,
        },
      );

      await this.publishBatch(events);
    } else {
      // 不在事务中，直接发布并等待
      await this.eventPublisher.publishBatchAndWait(events);
    }
  }

  /**
   * 发布待处理的事件
   * @param transactionId
   */
  async publishPendingEvents(transactionId: string): Promise<void> {
    const events = this.pendingEvents.get(transactionId);
    if (!events || events.length === 0) {
      return;
    }

    try {
      await this.eventPublisher.publishBatch(events);

      // 清除已发布的事件
      this.pendingEvents.delete(transactionId);

      this.logger?.info('Pending events published after transaction commit', {
        transactionId,
        eventCount: events.length,
      });
    } catch (error) {
      this.logger?.error(
        'Failed to publish pending events after transaction commit',
        {
          transactionId,
          eventCount: events.length,
          error: (error as Error).message,
        },
      );

      // 不清除事件，以便重试
      throw error;
    }
  }

  /**
   * 清除待处理的事件（事务回滚时调用）
   * @param transactionId
   */
  clearPendingEvents(transactionId: string): void {
    const events = this.pendingEvents.get(transactionId);
    if (events && events.length > 0) {
      this.pendingEvents.delete(transactionId);

      this.logger?.info('Pending events cleared after transaction rollback', {
        transactionId,
        eventCount: events.length,
      });
    }
  }

  /**
   * 获取当前事务
   * @returns 当前事务上下文或undefined
   */
  private getCurrentTransaction(): TransactionContext | undefined {
    // 这里需要根据实际的事务管理器实现来获取当前事务
    // 简化实现，实际应该从事务上下文中获取
    return undefined;
  }

  /**
   * 添加待处理事件
   * @param transactionId
   * @param event
   */
  private addPendingEvent(transactionId: string, event: IDomainEvent): void {
    const events = this.pendingEvents.get(transactionId) || [];
    events.push(event);
    this.pendingEvents.set(transactionId, events);
  }

  /**
   * 添加待处理事件批量
   * @param transactionId
   * @param events
   */
  private addPendingEvents(
    transactionId: string,
    events: IDomainEvent[],
  ): void {
    const existingEvents = this.pendingEvents.get(transactionId) || [];
    existingEvents.push(...events);
    this.pendingEvents.set(transactionId, existingEvents);
  }
}

/**
 * 事件总线实现
 * 负责事件的分发和处理
 */
export class EventBus implements IEventBus {
  private handlers: Map<string, IEventHandler[]> = new Map();
  private processingStatistics: Map<string, IEventHandlingResult[]> = new Map();

  /**
   * 构造函数
   * @param logger 日志记录器
   */
  constructor(private readonly logger?: Logger) {}

  /**
   * 注册事件处理器
   * @param eventType
   * @param handler
   */
  register(eventType: string, handler: IEventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }

    const handlers = this.handlers.get(eventType)!;

    // 检查是否已经注册过相同的处理器
    if (handlers.some((h) => h.getName() === handler.getName())) {
      throw new Error(
        `Handler ${handler.getName()} already registered for event type ${eventType}`,
      );
    }

    handlers.push(handler);

    // 按优先级排序
    handlers.sort((a, b) => b.getPriority() - a.getPriority());

    this.logger?.info('Event handler registered', {
      eventType,
      handlerName: handler.getName(),
      priority: handler.getPriority(),
      totalHandlers: handlers.length,
    });
  }

  /**
   * 注销事件处理器
   * @param eventType
   * @param handler
   */
  unregister(eventType: string, handler: IEventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (!handlers) {
      return;
    }

    const index = handlers.findIndex((h) => h.getName() === handler.getName());
    if (index !== -1) {
      handlers.splice(index, 1);

      this.logger?.info('Event handler unregistered', {
        eventType,
        handlerName: handler.getName(),
        remainingHandlers: handlers.length,
      });
    }

    // 如果没有处理器了，删除事件类型
    if (handlers.length === 0) {
      this.handlers.delete(eventType);
    }
  }

  /**
   * 分发事件
   * @param event
   */
  async dispatch(event: IDomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventType);
    if (!handlers || handlers.length === 0) {
      this.logger?.debug('No handlers registered for event type', {
        eventType: event.eventType,
        eventId: event.eventId,
      });
      return;
    }

    this.logger?.debug('Dispatching event to handlers', {
      eventType: event.eventType,
      eventId: event.eventId,
      handlerCount: handlers.length,
    });

    // 并行处理所有处理器
    const promises = handlers.map((handler) =>
      this.handleEvent(handler, event),
    );
    await Promise.allSettled(promises);
  }

  /**
   * 批量分发事件
   * @param events
   */
  async dispatchBatch(events: IDomainEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    this.logger?.debug('Dispatching batch of events', {
      eventCount: events.length,
      eventTypes: [...new Set(events.map((e) => e.eventType))],
    });

    // 并行处理所有事件
    const promises = events.map((event) => this.dispatch(event));
    await Promise.allSettled(promises);
  }

  /**
   * 获取已注册的处理器数量
   * @param eventType 事件类型
   * @returns 处理器数量
   */
  getHandlerCount(eventType: string): number {
    const handlers = this.handlers.get(eventType);
    return handlers ? handlers.length : 0;
  }

  /**
   * 获取所有已注册的事件类型
   * @returns 事件类型数组
   */
  getRegisteredEventTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * 获取事件统计信息
   * @returns 事件统计信息
   */
  getStatistics(): IEventStatistics {
    const allResults: IEventHandlingResult[] = [];

    for (const results of this.processingStatistics.values()) {
      allResults.push(...results);
    }

    const successfulEvents = allResults.filter((r) => r.success).length;
    const failedEvents = allResults.filter((r) => !r.success).length;
    const pendingEvents = 0; // 实时处理，没有待处理事件

    const averageProcessingTime =
      allResults.length > 0
        ? allResults.reduce((sum, r) => sum + r.processingTime, 0) /
          allResults.length
        : 0;

    return {
      totalEvents: allResults.length,
      successfulEvents,
      failedEvents,
      pendingEvents,
      averageProcessingTime,
      lastUpdated: Date.now(),
    };
  }

  /**
   * 清除统计信息
   */
  clearStatistics(): void {
    this.processingStatistics.clear();
    this.logger?.debug('Event processing statistics cleared');
  }

  /**
   * 处理单个事件
   * @param handler
   * @param event
   */
  private async handleEvent(
    handler: IEventHandler,
    event: IDomainEvent,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      await handler.handle(event);

      const result: IEventHandlingResult = {
        eventId: event.eventId,
        handlerName: handler.getName(),
        success: true,
        processingTime: Date.now() - startTime,
        retryCount: 0,
        processedAt: Date.now(),
      };

      this.recordHandlingResult(result);

      this.logger?.debug('Event handled successfully', {
        eventId: event.eventId,
        handlerName: handler.getName(),
        processingTime: result.processingTime,
      });
    } catch (error) {
      const result: IEventHandlingResult = {
        eventId: event.eventId,
        handlerName: handler.getName(),
        success: false,
        error: (error as Error).message,
        processingTime: Date.now() - startTime,
        retryCount: 0,
        processedAt: Date.now(),
      };

      this.recordHandlingResult(result);

      this.logger?.error('Event handling failed', {
        eventId: event.eventId,
        handlerName: handler.getName(),
        error: (error as Error).message,
        processingTime: result.processingTime,
      });
    }
  }

  /**
   * 记录处理结果
   * @param result
   */
  private recordHandlingResult(result: IEventHandlingResult): void {
    if (!this.processingStatistics.has(result.eventId)) {
      this.processingStatistics.set(result.eventId, []);
    }

    const results = this.processingStatistics.get(result.eventId)!;
    results.push(result);

    // 限制每个事件的记录数量，避免内存泄漏
    if (results.length > 100) {
      results.splice(0, results.length - 100);
    }
  }
}
