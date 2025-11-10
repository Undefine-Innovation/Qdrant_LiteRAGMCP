import { Logger } from '@infrastructure/logging/logger.js';
import { DataSource } from 'typeorm';
import {
  IEventPublisher,
  IEventBus,
  IEventStore,
  IEventHandler,
} from '../events/IEventPublisher.js';
import {
  AggregateRoot,
  AggregateRootManager,
} from '../aggregates/AggregateRoot.js';
import {
  EventSystemManager,
  IEventSystemConfig,
} from '../events/EventSystemFactory.js';
import { ITransactionManager } from '../repositories/ITransactionManager.js';

/**
 * 事件系统服务
 * 提供事件系统的统一管理和集成
 */
export class EventSystemService {
  private readonly aggregateRootManager: AggregateRootManager;
  private readonly eventSystemManager: EventSystemManager;

  /**
   * 构造函数
   * @param config 事件系统配置
   * @param dependencies 依赖项
   * @param dependencies.logger 日志记录器
   * @param dependencies.dataSource 数据源
   * @param dependencies.transactionManager 事务管理器
   */
  constructor(
    config: Partial<IEventSystemConfig>,
    dependencies: {
      logger: Logger;
      dataSource?: DataSource;
      transactionManager?: ITransactionManager;
    },
  ) {
    this.aggregateRootManager = new AggregateRootManager();
    this.eventSystemManager = new EventSystemManager(config, dependencies);
  }

  /**
   * 初始化事件系统
   */
  async initialize(): Promise<void> {
    await this.eventSystemManager.initialize();
  }

  /**
   * 关闭事件系统
   */
  async shutdown(): Promise<void> {
    await this.eventSystemManager.shutdown();
  }

  /**
   * 注册聚合根
   * @param aggregate
   */
  registerAggregate(aggregate: AggregateRoot): void {
    // 设置事件发布器
    aggregate.setEventPublisher(this.eventSystemManager.getEventPublisher());

    // 注册到聚合根管理器
    this.aggregateRootManager.registerAggregate(aggregate);
  }

  /**
   * 注销聚合根
   * @param aggregateId
   */
  unregisterAggregate(aggregateId: string): void {
    this.aggregateRootManager.unregisterAggregate(aggregateId);
  }

  /**
   * 获取聚合根
   * @param aggregateId 聚合ID
   * @returns 聚合根或undefined
   */
  getAggregate(aggregateId: string): AggregateRoot | undefined {
    return this.aggregateRootManager.getAggregate(aggregateId);
  }

  /**
   * 发布所有聚合根的领域事件
   */
  async publishAllDomainEvents(): Promise<void> {
    await this.aggregateRootManager.publishAllDomainEvents();
  }

  /**
   * 获取事件发布器
   * @returns 事件发布器
   */
  getEventPublisher(): IEventPublisher {
    return this.eventSystemManager.getEventPublisher();
  }

  /**
   * 获取事件总线
   * @returns 事件总线
   */
  getEventBus(): IEventBus {
    return this.eventSystemManager.getEventBus();
  }

  /**
   * 获取事件存储
   * @returns 事件存储
   */
  getEventStore(): IEventStore {
    return this.eventSystemManager.getEventStore();
  }

  /**
   * 获取事件处理器
   * @returns 事件处理器数组
   */
  getEventHandlers(): IEventHandler[] {
    return this.eventSystemManager.getEventHandlers();
  }

  /**
   * 注册事件处理器
   * @param eventType
   * @param handler
   */
  registerEventHandler(eventType: string, handler: IEventHandler): void {
    this.eventSystemManager.getEventBus().register(eventType, handler);
  }

  /**
   * 注销事件处理器
   * @param eventType
   * @param handler
   */
  unregisterEventHandler(eventType: string, handler: IEventHandler): void {
    this.eventSystemManager.getEventBus().unregister(eventType, handler);
  }

  /**
   * 获取聚合根管理器
   * @returns 聚合根管理器
   */
  getAggregateRootManager(): AggregateRootManager {
    return this.aggregateRootManager;
  }

  /**
   * 获取事件系统管理器
   * @returns 事件系统管理器
   */
  getEventSystemManager(): EventSystemManager {
    return this.eventSystemManager;
  }

  /**
   * 获取系统状态
   * @returns 系统状态对象
   */
  getSystemStatus(): {
    isInitialized: boolean;
    aggregateCount: number;
    unpublishedEventCount: number;
    registeredEventTypes: string[];
    handlerCount: number;
  } {
    return {
      isInitialized: true, // 如果能调用此方法，说明已初始化
      aggregateCount: this.aggregateRootManager.getAggregateCount(),
      unpublishedEventCount:
        this.aggregateRootManager.getTotalUnpublishedEventCount(),
      registeredEventTypes: this.eventSystemManager
        .getEventBus()
        .getRegisteredEventTypes(),
      handlerCount: this.eventSystemManager.getEventHandlers().length,
    };
  }

  /**
   * 强制发布所有待处理事件
   */
  async flushAllEvents(): Promise<void> {
    // 发布聚合根事件
    await this.publishAllDomainEvents();

    // 刷新批处理器
    for (const handler of this.eventSystemManager.getEventHandlers()) {
      if ('flush' in handler && typeof handler.flush === 'function') {
        try {
          await (handler as unknown as { flush(): Promise<void> }).flush();
        } catch (error) {
          console.error('Failed to flush event handler:', error);
        }
      }
    }
  }

  /**
   * 获取事件统计信息
   * @returns 事件统计信息
   */
  async getEventStatistics(): Promise<unknown> {
    const eventBus = this.eventSystemManager.getEventBus();
    const eventStore = this.eventSystemManager.getEventStore();

    // 获取事件总线统计
    let busStatistics: Record<string, unknown> = {};
    if (
      'getStatistics' in eventBus &&
      typeof eventBus.getStatistics === 'function'
    ) {
      busStatistics = (
        eventBus as unknown as { getStatistics(): Record<string, unknown> }
      ).getStatistics();
    }

    // 获取事件存储统计
    let storeStatistics: Record<string, unknown> = {};
    if (
      'getStatistics' in eventStore &&
      typeof eventStore.getStatistics === 'function'
    ) {
      storeStatistics = await (
        eventStore as unknown as {
          getStatistics(): Promise<Record<string, unknown>>;
        }
      ).getStatistics();
    }

    // 获取处理器统计
    const handlerStatistics: Array<{
      name: string;
      eventType: string;
      statistics: unknown;
    }> = [];
    for (const handler of this.eventSystemManager.getEventHandlers()) {
      if (
        'getStatistics' in handler &&
        typeof handler.getStatistics === 'function'
      ) {
        handlerStatistics.push({
          name: handler.getName(),
          eventType: handler.getEventType(),
          statistics: (
            handler as unknown as { getStatistics(): unknown }
          ).getStatistics(),
        });
      }
    }

    return {
      bus: busStatistics,
      store: storeStatistics,
      handlers: handlerStatistics,
      aggregates: {
        count: this.aggregateRootManager.getAggregateCount(),
        unpublishedEvents:
          this.aggregateRootManager.getTotalUnpublishedEventCount(),
        aggregatesWithEvents:
          this.aggregateRootManager.getAggregatesWithUnpublishedEvents().length,
      },
    };
  }
}

/**
 * 事件系统服务工厂
 * 提供创建事件系统服务的便捷方法
 */
export class EventSystemServiceFactory {
  /**
   * 创建开发环境的事件系统服务
   * @param logger 日志记录器
   * @returns 事件系统服务
   */
  static createDevelopmentService(logger: Logger): EventSystemService {
    return new EventSystemService(
      {
        enableEventStore: true,
        eventStoreType: 'memory',
        enableTransactionalPublishing: false,
        enableAuditLogging: false,
        enableEventStatistics: false,
      },
      { logger },
    );
  }

  /**
   * 创建生产环境的事件系统服务
   * @param logger 日志记录器
   * @param dataSource 数据源
   * @param transactionManager 事务管理器
   * @returns 事件系统服务
   */
  static createProductionService(
    logger: Logger,
    dataSource: DataSource,
    transactionManager: ITransactionManager,
  ): EventSystemService {
    return new EventSystemService(
      {
        enableEventStore: true,
        eventStoreType: 'database',
        enableTransactionalPublishing: true,
        enableAuditLogging: true,
        enableEventStatistics: true,
      },
      { logger, dataSource, transactionManager },
    );
  }

  /**
   * 创建测试环境的事件系统服务
   * @param logger 日志记录器
   * @returns 事件系统服务
   */
  static createTestService(logger: Logger): EventSystemService {
    return new EventSystemService(
      {
        enableEventStore: false,
        enableTransactionalPublishing: false,
        enableAuditLogging: false,
        enableEventStatistics: false,
      },
      { logger },
    );
  }

  /**
   * 创建自定义配置的事件系统服务
   * @param config 事件系统配置
   * @param dependencies 依赖项
   * @param dependencies.logger 日志记录器
   * @param dependencies.dataSource 数据源
   * @param dependencies.transactionManager 事务管理器
   * @returns 事件系统服务
   */
  static createCustomService(
    config: Partial<IEventSystemConfig>,
    dependencies: {
      logger: Logger;
      dataSource?: DataSource;
      transactionManager?: ITransactionManager;
    },
  ): EventSystemService {
    return new EventSystemService(config, dependencies);
  }
}
