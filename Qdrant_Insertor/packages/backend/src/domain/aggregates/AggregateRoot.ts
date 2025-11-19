import { IDomainEvent } from '../events/IDomainEventInterface.js';
import { IEventPublisher } from '../events/IEventPublisher.js';

/**
 * 聚合根基类
 * 提供统一的领域事件管理机制
 */
export abstract class AggregateRoot {
  private readonly _domainEvents: IDomainEvent[] = [];
  private _eventPublisher?: IEventPublisher;

  /**
   * 设置事件发布器
   * @param eventPublisher 事件发布器
   */
  setEventPublisher(eventPublisher: IEventPublisher): void {
    this._eventPublisher = eventPublisher;
  }

  /**
   * 添加领域事件
   * @param event 领域事件
   */
  protected addDomainEvent(event: IDomainEvent): void {
    this._domainEvents.push(event);
  }

  /**
   * 获取领域事件
   * @returns 领域事件数组
   */
  public getDomainEvents(): IDomainEvent[] {
    return [...this._domainEvents];
  }

  /**
   * 清除领域事件
   */
  public clearDomainEvents(): void {
    this._domainEvents.length = 0;
  }

  /**
   * 检查是否有未发布的领域事件
   * @returns 是否有未发布的事件
   */
  public hasUnpublishedEvents(): boolean {
    return this._domainEvents.length > 0;
  }

  /**
   * 获取未发布的事件数量
   * @returns 未发布事件数量
   */
  public getUnpublishedEventCount(): number {
    return this._domainEvents.length;
  }

  /**
   * 发布领域事件
   * 如果设置了事件发布器，则发布所有未发布的事件
   */
  async publishDomainEvents(): Promise<void> {
    if (!this._eventPublisher || this._domainEvents.length === 0) {
      return;
    }

    const events = [...this._domainEvents];
    await this._eventPublisher.publishBatch(events);
    this.clearDomainEvents();
  }

  /**
   * 发布单个领域事件
   * @param event 要发布的事件
   */
  async publishDomainEvent(event: IDomainEvent): Promise<void> {
    if (!this._eventPublisher) {
      throw new Error('Event publisher not set');
    }

    await this._eventPublisher.publish(event);
  }

  /**
   * 获取聚合根ID（由子类实现）
   */
  abstract getId(): string;

  /**
   * 获取聚合根类型（由子类实现）
   */
  abstract getAggregateType(): string;
}

/**
 * 聚合根管理器
 * 负责管理多个聚合根的事件发布
 */
export class AggregateRootManager {
  private readonly aggregates: Map<string, AggregateRoot> = new Map();

  /**
   * 注册聚合根
   * @param aggregate 聚合根
   */
  registerAggregate(aggregate: AggregateRoot): void {
    this.aggregates.set(aggregate.getId(), aggregate);
  }

  /**
   * 注销聚合根
   * @param aggregateId 聚合根ID
   */
  unregisterAggregate(aggregateId: string): void {
    this.aggregates.delete(aggregateId);
  }

  /**
   * 获取聚合根
   * @param aggregateId 聚合根ID
   * @returns 聚合根实例
   */
  getAggregate(aggregateId: string): AggregateRoot | undefined {
    return this.aggregates.get(aggregateId);
  }

  /**
   * 获取所有聚合根
   * @returns 聚合根数组
   */
  getAllAggregates(): AggregateRoot[] {
    return Array.from(this.aggregates.values());
  }

  /**
   * 发布所有聚合根的领域事件
   */
  async publishAllDomainEvents(): Promise<void> {
    const publishPromises: Promise<void>[] = [];

    for (const aggregate of this.aggregates.values()) {
      if (aggregate.hasUnpublishedEvents()) {
        publishPromises.push(aggregate.publishDomainEvents());
      }
    }

    if (publishPromises.length > 0) {
      await Promise.all(publishPromises);
    }
  }

  /**
   * 获取指定类型的聚合根
   * @param aggregateType 聚合根类型
   * @returns 指定类型的聚合根数组
   */
  getAggregatesByType(aggregateType: string): AggregateRoot[] {
    return Array.from(this.aggregates.values()).filter(
      (aggregate) => aggregate.getAggregateType() === aggregateType,
    );
  }

  /**
   * 获取有未发布事件的聚合根
   * @returns 有未发布事件的聚合根数组
   */
  getAggregatesWithUnpublishedEvents(): AggregateRoot[] {
    return Array.from(this.aggregates.values()).filter((aggregate) =>
      aggregate.hasUnpublishedEvents(),
    );
  }

  /**
   * 获取未发布事件总数
   * @returns 未发布事件总数
   */
  getTotalUnpublishedEventCount(): number {
    return Array.from(this.aggregates.values()).reduce(
      (total, aggregate) => total + aggregate.getUnpublishedEventCount(),
      0,
    );
  }

  /**
   * 清除所有聚合根的领域事件
   */
  clearAllDomainEvents(): void {
    for (const aggregate of this.aggregates.values()) {
      aggregate.clearDomainEvents();
    }
  }

  /**
   * 清除管理器
   */
  clear(): void {
    this.aggregates.clear();
  }

  /**
   * 获取聚合根数量
   * @returns 聚合根数量
   */
  getAggregateCount(): number {
    return this.aggregates.size;
  }

  /**
   * 检查是否包含指定聚合根
   * @param aggregateId 聚合根ID
   * @returns 是否包含指定聚合根
   */
  hasAggregate(aggregateId: string): boolean {
    return this.aggregates.has(aggregateId);
  }
}

/**
 * 聚合根工厂
 * 提供创建聚合根的通用方法
 */
export abstract class AggregateRootFactory {
  /**
   * 创建聚合根并设置事件发布器
   * @param AggregateClass 聚合根类
   * @param eventPublisher 事件发布器
   * @param args 构造函数参数
   * @returns 聚合根实例
   */
  static createWithEventPublisher<T extends AggregateRoot>(
    AggregateClass: new (...args: unknown[]) => T,
    eventPublisher: IEventPublisher,
    ...args: unknown[]
  ): T {
    const aggregate = new AggregateClass(...args);
    aggregate.setEventPublisher(eventPublisher);
    return aggregate;
  }

  /**
   * 从现有数据重建聚合根
   * @param AggregateClass 聚合根类
   * @param data 重建数据
   * @param eventPublisher 事件发布器（可选）
   * @returns 聚合根实例
   */
  static reconstitute<T extends AggregateRoot>(
    AggregateClass: new (
      ...args: unknown[]
    ) => T & { reconstitute: (data: unknown) => T },
    data: unknown,
    eventPublisher?: IEventPublisher,
  ): T {
    const AggregateClassWithReconstitute = AggregateClass as unknown as {
      reconstitute: (data: unknown) => T;
    };
    const aggregate = AggregateClassWithReconstitute.reconstitute(data);
    if (eventPublisher) {
      aggregate.setEventPublisher(eventPublisher);
    }
    return aggregate;
  }
}
