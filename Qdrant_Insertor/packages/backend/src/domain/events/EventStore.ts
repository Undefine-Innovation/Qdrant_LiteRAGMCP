import {
  IDomainEvent,
  IEventStore,
  IEventStatistics,
} from './IEventPublisher.js';
import { Logger } from '../../infrastructure/logging/logger.js';
import { DataSource, FindOptionsWhere } from 'typeorm';
import { CollectionId, DocId, PointId } from '../entities/types.js';
import { Event } from '../../infrastructure/database/entities/Event.js';

/**
 * 事件存储实体
 */
interface EventStorageEntity {
  id: string;
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  occurredOn: number;
  version: number;
  metadata?: string;
  eventData: string;
  processedAt?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 内存事件存储实现
 * 用于开发和测试环境
 */
export class InMemoryEventStore implements IEventStore {
  private events: Map<string, IDomainEvent[]> = new Map();
  private allEvents: IDomainEvent[] = [];

  /**
   * 构造函数
   * @param logger 日志记录器
   */
  constructor(private readonly logger: Logger) {}

  /**
   * 保存事件
   * @param event 领域事件
   * @returns Promise
   */
  async saveEvent(event: IDomainEvent): Promise<void> {
    const aggregateEvents = this.events.get(event.aggregateId) || [];
    aggregateEvents.push(event);
    this.events.set(event.aggregateId, aggregateEvents);
    this.allEvents.push(event);

    this.logger.debug('Event saved to in-memory store', {
      eventId: event.eventId,
      eventType: event.eventType,
      aggregateId: event.aggregateId,
    });
  }

  /**
   * 批量保存事件
   * @param events 事件数组
   * @returns Promise
   */
  async saveEvents(events: IDomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.saveEvent(event);
    }
  }

  /**
   * 根据聚合ID获取事件
   * @param aggregateId 聚合ID
   * @param fromVersion 起始版本
   * @param toVersion 结束版本
   * @returns 事件数组
   */
  async getEventsByAggregate(
    aggregateId: string,
    fromVersion?: number,
    toVersion?: number,
  ): Promise<IDomainEvent[]> {
    const aggregateEvents = this.events.get(aggregateId) || [];

    return aggregateEvents.filter((event) => {
      if (fromVersion !== undefined && event.version < fromVersion) {
        return false;
      }
      if (toVersion !== undefined && event.version > toVersion) {
        return false;
      }
      return true;
    });
  }

  /**
   * 根据事件类型获取事件
   * @param eventType 事件类型
   * @param fromTime 起始时间
   * @param toTime 结束时间
   * @param limit 限制数量
   * @returns 事件数组
   */
  async getEventsByType(
    eventType: string,
    fromTime?: number,
    toTime?: number,
    limit?: number,
  ): Promise<IDomainEvent[]> {
    let filtered = this.allEvents.filter(
      (event) => event.eventType === eventType,
    );

    if (fromTime !== undefined) {
      filtered = filtered.filter((event) => event.occurredOn >= fromTime);
    }

    if (toTime !== undefined) {
      filtered = filtered.filter((event) => event.occurredOn <= toTime);
    }

    if (limit !== undefined) {
      filtered = filtered.slice(0, limit);
    }

    return filtered;
  }

  /**
   * 获取所有事件
   * @param fromTime 起始时间
   * @param toTime 结束时间
   * @param limit 限制数量
   * @param offset 偏移量
   * @returns 事件数组
   */
  async getAllEvents(
    fromTime?: number,
    toTime?: number,
    limit?: number,
    offset?: number,
  ): Promise<IDomainEvent[]> {
    let filtered = [...this.allEvents];

    if (fromTime !== undefined) {
      filtered = filtered.filter((event) => event.occurredOn >= fromTime);
    }

    if (toTime !== undefined) {
      filtered = filtered.filter((event) => event.occurredOn <= toTime);
    }

    if (offset !== undefined) {
      filtered = filtered.slice(offset);
    }

    if (limit !== undefined) {
      filtered = filtered.slice(0, limit);
    }

    return filtered;
  }

  /**
   * 获取事件总数
   * @returns 事件总数
   */
  async getEventCount(): Promise<number> {
    return this.allEvents.length;
  }

  /**
   * 清理事件
   * @param beforeTime 清理时间点
   * @returns 清理的事件数量
   */
  async cleanupEvents(beforeTime: number): Promise<number> {
    const initialCount = this.allEvents.length;

    this.allEvents = this.allEvents.filter(
      (event) => event.occurredOn >= beforeTime,
    );

    // 清理聚合事件映射
    for (const [aggregateId, events] of this.events.entries()) {
      const filteredEvents = events.filter(
        (event) => event.occurredOn >= beforeTime,
      );
      if (filteredEvents.length === 0) {
        this.events.delete(aggregateId);
      } else {
        this.events.set(aggregateId, filteredEvents);
      }
    }

    const cleanedCount = initialCount - this.allEvents.length;

    this.logger.info('Events cleaned up', {
      cleanedCount,
      remainingCount: this.allEvents.length,
      beforeTime,
    });

    return cleanedCount;
  }
}

/**
 * 数据库事件存储实现
 * 用于生产环境
 */
export class DatabaseEventStore implements IEventStore {
  /**
   * 构造函数
   * @param dataSource 数据源
   * @param logger 日志记录器
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: Logger,
  ) {}

  /**
   * 保存事件
   * @param event 领域事件
   * @returns Promise
   */
  async saveEvent(event: IDomainEvent): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      const entity = this.mapEventToEntity(event);
      await queryRunner.manager.save(Event, entity);

      await queryRunner.commitTransaction();

      this.logger.debug('Event saved to database', {
        eventId: event.eventId,
        eventType: event.eventType,
        aggregateId: event.aggregateId,
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Failed to save event to database', {
        eventId: event.eventId,
        error: (error as Error).message,
      });
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 批量保存事件
   * @param events 事件数组
   * @returns Promise
   */
  async saveEvents(events: IDomainEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      const entities = events.map((event) => this.mapEventToEntity(event));
      await queryRunner.manager.save(Event, entities);

      await queryRunner.commitTransaction();

      this.logger.debug('Events saved to database', {
        count: events.length,
        eventIds: events.map((e) => e.eventId),
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Failed to save events to database', {
        count: events.length,
        error: (error as Error).message,
      });
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 根据聚合ID获取事件
   * @param aggregateId 聚合ID
   * @param fromVersion 起始版本
   * @param toVersion 结束版本
   * @returns 事件数组
   */
  async getEventsByAggregate(
    aggregateId: string,
    fromVersion?: number,
    toVersion?: number,
  ): Promise<IDomainEvent[]> {
    try {
      const whereConditions: Record<string, unknown> = { aggregateId };

      if (fromVersion !== undefined) {
        whereConditions.version = {
          ...(whereConditions.version
            ? { version: whereConditions.version }
            : {}),
          $gte: fromVersion,
        };
      }

      if (toVersion !== undefined) {
        whereConditions.version = {
          ...(whereConditions.version
            ? { version: whereConditions.version }
            : {}),
          $lte: toVersion,
        };
      }

      const entities = await this.dataSource.manager.find(Event, {
        where: whereConditions as unknown as FindOptionsWhere<Event>,
        order: { version: 'ASC' },
      });

      return entities.map((entity) => this.mapEntityToEvent(entity));
    } catch (error) {
      this.logger.error('Failed to get events by aggregate', {
        aggregateId,
        fromVersion,
        toVersion,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据聚合ID获取事件（别名方法，用于向后兼容）
   * @param aggregateId 聚合ID
   * @param fromVersion 起始版本
   * @param toVersion 结束版本
   * @returns 事件数组
   */
  async getEventsByAggregateId(
    aggregateId: string,
    fromVersion?: number,
    toVersion?: number,
  ): Promise<IDomainEvent[]> {
    return this.getEventsByAggregate(aggregateId, fromVersion, toVersion);
  }

  /**
   * 获取未处理的事件
   * @param limit 限制数量
   * @returns 事件数组
   */
  async getUnprocessedEvents(limit?: number): Promise<IDomainEvent[]> {
    try {
      const findOptions: Record<string, unknown> = {
        where: { processedAt: null },
        order: { occurredOn: 'ASC' },
      };

      if (limit !== undefined) {
        findOptions.take = limit;
      }

      const entities = await this.dataSource.manager.find(
        Event,
        findOptions as Record<string, unknown>,
      );

      return entities.map((entity) => this.mapEntityToEvent(entity));
    } catch (error) {
      this.logger.error('Failed to get unprocessed events', {
        limit,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 标记事件为已处理
   * @param eventId 事件ID
   * @returns Promise
   */
  async markEventAsProcessed(eventId: string): Promise<void> {
    try {
      await this.dataSource.manager.update(
        Event,
        { eventId },
        {
          processedAt: Date.now(),
          processingStatus: 'completed',
        },
      );

      this.logger.debug('Event marked as processed', { eventId });
    } catch (error) {
      this.logger.error('Failed to mark event as processed', {
        eventId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据事件类型获取事件
   * @param eventType 事件类型
   * @param fromTime 起始时间
   * @param toTime 结束时间
   * @param limit 限制数量
   * @returns 事件数组
   */
  async getEventsByType(
    eventType: string,
    fromTime?: number,
    toTime?: number,
    limit?: number,
  ): Promise<IDomainEvent[]> {
    try {
      const whereConditions: Record<string, unknown> = { eventType };

      if (fromTime !== undefined) {
        whereConditions.occurredOn = {
          ...(whereConditions.occurredOn
            ? { occurredOn: whereConditions.occurredOn }
            : {}),
          $gte: fromTime,
        };
      }

      if (toTime !== undefined) {
        whereConditions.occurredOn = {
          ...(whereConditions.occurredOn
            ? { occurredOn: whereConditions.occurredOn }
            : {}),
          $lte: toTime,
        };
      }

      const findOptions: Record<string, unknown> = {
        where: whereConditions,
        order: { occurredOn: 'DESC' },
      };

      if (limit !== undefined) {
        findOptions.take = limit;
      }

      const entities = await this.dataSource.manager.find(
        Event,
        findOptions as Record<string, unknown>,
      );

      return entities.map((entity) => this.mapEntityToEvent(entity));
    } catch (error) {
      this.logger.error('Failed to get events by type', {
        eventType,
        fromTime,
        toTime,
        limit,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 获取所有事件
   * @param fromTime 起始时间
   * @param toTime 结束时间
   * @param limit 限制数量
   * @param offset 偏移量
   * @returns 事件数组
   */
  async getAllEvents(
    fromTime?: number,
    toTime?: number,
    limit?: number,
    offset?: number,
  ): Promise<IDomainEvent[]> {
    try {
      const whereConditions: Record<string, unknown> = {};

      if (fromTime !== undefined) {
        whereConditions.occurredOn = {
          ...(whereConditions.occurredOn
            ? { occurredOn: whereConditions.occurredOn }
            : {}),
          $gte: fromTime,
        };
      }

      if (toTime !== undefined) {
        whereConditions.occurredOn = {
          ...(whereConditions.occurredOn
            ? { occurredOn: whereConditions.occurredOn }
            : {}),
          $lte: toTime,
        };
      }

      const findOptions: Record<string, unknown> = {
        where:
          Object.keys(whereConditions).length > 0 ? whereConditions : undefined,
        order: { occurredOn: 'DESC' },
      };

      if (offset !== undefined) {
        findOptions.skip = offset;
      }

      if (limit !== undefined) {
        findOptions.take = limit;
      }

      const entities = (await this.dataSource.manager.find(
        Event,
        findOptions as Record<string, unknown>,
      )) as Event[];

      return entities.map((entity) => this.mapEntityToEvent(entity));
    } catch (error) {
      this.logger.error('Failed to get all events', {
        fromTime,
        toTime,
        limit,
        offset,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 获取事件总数
   * @returns 事件总数
   */
  async getEventCount(): Promise<number> {
    try {
      return await this.dataSource.manager.count(Event);
    } catch (error) {
      this.logger.error('Failed to get event count', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 清理事件
   * @param beforeTime 清理时间点
   * @returns 清理的事件数量
   */
  async cleanupEvents(beforeTime: number): Promise<number> {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      const result = await queryRunner.manager.delete(Event, {
        occurredOn: { $lt: beforeTime },
      });

      await queryRunner.commitTransaction();

      this.logger.info('Events cleaned up from database', {
        deletedCount: result.affected || 0,
        beforeTime,
      });

      return result.affected || 0;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Failed to cleanup events', {
        beforeTime,
        error: (error as Error).message,
      });
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 获取事件统计信息
   * @returns 事件统计信息
   */
  async getStatistics(): Promise<IEventStatistics> {
    try {
      const totalCount = await this.getEventCount();

      // 获取已处理的事件数
      const successfulCount = await this.dataSource.manager
        .createQueryBuilder()
        .from(Event, 'e')
        .where('e.processedAt IS NOT NULL')
        .getCount();

      // 获取失败的事件数（5分钟内未处理的）
      const failedCount = await this.dataSource.manager
        .createQueryBuilder()
        .from(Event, 'e')
        .where('e.processedAt IS NULL')
        .andWhere('e.occurredOn < :threshold', {
          threshold: Date.now() - 300000,
        })
        .getCount();

      return {
        totalEvents: totalCount,
        successfulEvents: successfulCount,
        failedEvents: failedCount,
        pendingEvents: totalCount - successfulCount - failedCount,
        averageProcessingTime: 0, // 需要额外的统计表来计算
        lastUpdated: Date.now(),
      };
    } catch (error) {
      this.logger.error('Failed to get event statistics', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 将领域事件映射为Event实体
   * @param event 领域事件
   * @returns Event实体
   */
  private mapEventToEntity(event: IDomainEvent): Partial<Event> {
    const now = event.occurredOn || Date.now();
    return {
      id: event.eventId,
      eventId: event.eventId,
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      aggregateType: this.getAggregateType(event.aggregateId),
      occurredOn: now,
      version: event.version,
      metadata: event.metadata ? JSON.stringify(event.metadata) : undefined,
      eventData: event.serialize(),
      created_at: now,
      updated_at: now,
    };
  }

  /**
   * 将Event实体或EventStorageEntity映射为领域事件
   * @param entity Event实体或EventStorageEntity
   * @returns 领域事件
   */
  private mapEntityToEvent(entity: Event | EventStorageEntity): IDomainEvent {
    const parsedData = JSON.parse(entity.eventData);

    // 兼容两种数据格式:
    // 1. { data: { ... } } - 新格式，data 字段包含实际数据
    // 2. { ... } - 旧格式，所有字段都在顶层
    const eventData = parsedData.data || parsedData;

    // 这里需要根据事件类型创建相应的事件实例
    // 简化实现，实际应该使用工厂模式
    return {
      eventId: entity.eventId,
      eventType: entity.eventType,
      aggregateId: entity.aggregateId,
      occurredOn: entity.occurredOn,
      version: entity.version,
      metadata: entity.metadata ? JSON.parse(entity.metadata) : undefined,
      getData: () => eventData,
      serialize: () => entity.eventData,
    } as IDomainEvent;
  }

  /**
   * 根据聚合ID判断聚合类型
   * @param aggregateId 聚合ID
   * @returns 聚合类型
   */
  private getAggregateType(aggregateId: string): string {
    if (aggregateId.startsWith('col_')) {
      return 'Collection';
    } else if (aggregateId.startsWith('doc_')) {
      return 'Document';
    } else if (aggregateId.includes('_')) {
      return 'Chunk';
    }
    return 'Unknown';
  }
}
