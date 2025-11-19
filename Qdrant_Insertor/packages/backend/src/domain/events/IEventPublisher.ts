import { IDomainEvent } from './IDomainEventInterface.js';

// Re-export IDomainEvent for other modules
/**
 *
 */
export type { IDomainEvent } from './IDomainEventInterface.js';

/**
 * 事件发布器接口
 * 负责发布领域事件
 */
export interface IEventPublisher {
  /**
   * 发布单个事件
   * @param event 要发布的事件
   */
  publish(event: IDomainEvent): Promise<void>;

  /**
   * 批量发布事件
   * @param events 要发布的事件数组
   */
  publishBatch(events: IDomainEvent[]): Promise<void>;

  /**
   * 发布事件并等待处理完成
   * @param event 要发布的事件
   */
  publishAndWait(event: IDomainEvent): Promise<void>;

  /**
   * 批量发布事件并等待处理完成
   * @param events 要发布的事件数组
   */
  publishBatchAndWait(events: IDomainEvent[]): Promise<void>;
}

/**
 * 事件总线接口
 * 负责事件的分发和处理
 */
export interface IEventBus {
  /**
   * 注册事件处理器
   * @param eventType 事件类型
   * @param handler 事件处理器
   */
  register(eventType: string, handler: IEventHandler): void;

  /**
   * 注销事件处理器
   * @param eventType 事件类型
   * @param handler 事件处理器
   */
  unregister(eventType: string, handler: IEventHandler): void;

  /**
   * 分发事件
   * @param event 要分发的事件
   */
  dispatch(event: IDomainEvent): Promise<void>;

  /**
   * 批量分发事件
   * @param events 要分发的事件数组
   */
  dispatchBatch(events: IDomainEvent[]): Promise<void>;

  /**
   * 获取已注册的处理器数量
   * @param eventType 事件类型
   */
  getHandlerCount(eventType: string): number;

  /**
   * 获取所有已注册的事件类型
   */
  getRegisteredEventTypes(): string[];
}

/**
 * 事件处理器接口
 */
export interface IEventHandler<T extends IDomainEvent = IDomainEvent> {
  /**
   * 处理事件
   * @param event 要处理的事件
   */
  handle(event: T): Promise<void>;

  /**
   * 获取处理器名称
   */
  getName(): string;

  /**
   * 获取支持的事件类型
   */
  getEventType(): string;

  /**
   * 检查是否可以处理指定事件
   * @param event 要检查的事件
   */
  canHandle(event: IDomainEvent): boolean;

  /**
   * 获取处理器优先级
   */
  getPriority(): number;
}

/**
 * 事件存储接口
 * 用于事件溯源和事件重放
 */
export interface IEventStore {
  /**
   * 保存事件
   * @param event 要保存的事件
   */
  saveEvent(event: IDomainEvent): Promise<void>;

  /**
   * 批量保存事件
   * @param events 要保存的事件数组
   */
  saveEvents(events: IDomainEvent[]): Promise<void>;

  /**
   * 获取聚合的所有事件
   * @param aggregateId 聚合ID
   * @param fromVersion 起始版本（可选）
   * @param toVersion 结束版本（可选）
   */
  getEventsByAggregate(
    aggregateId: string,
    fromVersion?: number,
    toVersion?: number,
  ): Promise<IDomainEvent[]>;

  /**
   * 获取指定类型的事件
   * @param eventType 事件类型
   * @param fromTime 起始时间（可选）
   * @param toTime 结束时间（可选）
   * @param limit 限制数量（可选）
   */
  getEventsByType(
    eventType: string,
    fromTime?: number,
    toTime?: number,
    limit?: number,
  ): Promise<IDomainEvent[]>;

  /**
   * 获取所有事件
   * @param fromTime 起始时间（可选）
   * @param toTime 结束时间（可选）
   * @param limit 限制数量（可选）
   * @param offset 偏移量（可选）
   */
  getAllEvents(
    fromTime?: number,
    toTime?: number,
    limit?: number,
    offset?: number,
  ): Promise<IDomainEvent[]>;

  /**
   * 获取事件总数
   */
  getEventCount(): Promise<number>;

  /**
   * 清理旧事件
   * @param beforeTime 清理指定时间之前的事件
   */
  cleanupEvents(beforeTime: number): Promise<number>;
}

/**
 * 事件重试配置接口
 */
export interface IEventRetryConfig {
  /**
   * 最大重试次数
   */
  maxRetries: number;

  /**
   * 重试间隔（毫秒）
   */
  retryInterval: number;

  /**
   * 指数退避因子
   */
  backoffFactor: number;

  /**
   * 最大重试间隔（毫秒）
   */
  maxRetryInterval: number;

  /**
   * 是否启用死信队列
   */
  enableDeadLetterQueue: boolean;
}

/**
 * 事件处理结果接口
 */
export interface IEventHandlingResult {
  /**
   * 事件ID
   */
  eventId: string;

  /**
   * 处理器名称
   */
  handlerName: string;

  /**
   * 是否成功
   */
  success: boolean;

  /**
   * 错误信息（如果有）
   */
  error?: string;

  /**
   * 处理时间（毫秒）
   */
  processingTime: number;

  /**
   * 重试次数
   */
  retryCount: number;

  /**
   * 处理时间戳
   */
  processedAt: number;
}

/**
 * 事件统计信息接口
 */
export interface IEventStatistics {
  /**
   * 总事件数
   */
  totalEvents: number;

  /**
   * 成功处理的事件数
   */
  successfulEvents: number;

  /**
   * 失败的事件数
   */
  failedEvents: number;

  /**
   * 待处理的事件数
   */
  pendingEvents: number;

  /**
   * 平均处理时间（毫秒）
   */
  averageProcessingTime: number;

  /**
   * 最后更新时间
   */
  lastUpdated: number;
}
