import { Logger } from '@infrastructure/logging/logger.js';
import { DataSource } from 'typeorm';
import { ITransactionManager } from '@domain/repositories/ITransactionManager.js';
import {
  IEventPublisher,
  IEventBus,
  IEventStore,
  IEventHandler,
  EventPublisher,
  EventBus,
  TransactionalEventPublisher,
  InMemoryEventStore,
  DatabaseEventStore,
} from './index.js';
import {
  CollectionCreatedEventHandler,
  CollectionUpdatedEventHandler,
  CollectionDeletedEventHandler,
  DocumentCreatedEventHandler,
  DocumentStatusChangedEventHandler,
  ChunkEmbeddingGeneratedEventHandler,
  AuditLogEventHandler,
  EventStatisticsEventHandler,
} from './EventHandlers.js';

/**
 * 事件系统配置接口
 */
export interface IEventSystemConfig {
  /**
   * 是否启用事件存储
   */
  enableEventStore: boolean;

  /**
   * 是否启用事务感知发布
   */
  enableTransactionalPublishing: boolean;

  /**
   * 是否启用审计日志
   */
  enableAuditLogging: boolean;

  /**
   * 是否启用事件统计
   */
  enableEventStatistics: boolean;

  /**
   * 事件存储类型
   */
  eventStoreType: 'memory' | 'database';

  /**
   * 批处理配置
   */
  batchConfig: {
    enabled: boolean;
    size: number;
    timeout: number;
  };

  /**
   * 重试配置
   */
  retryConfig: {
    maxRetries: number;
    retryInterval: number;
    backoffFactor: number;
    maxRetryInterval: number;
    enableDeadLetterQueue: boolean;
  };
}

/**
 * 默认事件系统配置
 */
export const DEFAULT_EVENT_SYSTEM_CONFIG: IEventSystemConfig = {
  enableEventStore: true,
  enableTransactionalPublishing: true,
  enableAuditLogging: true,
  enableEventStatistics: true,
  eventStoreType: 'database',
  batchConfig: {
    enabled: true,
    size: 50,
    timeout: 5000,
  },
  retryConfig: {
    maxRetries: 3,
    retryInterval: 1000,
    backoffFactor: 2,
    maxRetryInterval: 30000,
    enableDeadLetterQueue: true,
  },
};

/**
 * 事件系统工厂
 * 负责创建和配置事件系统的各个组件
 */
export class EventSystemFactory {
  /**
   * 创建完整的事件系统
   * @param config 事件系统配置
   * @param dependencies 依赖项
   * @param dependencies.logger 日志记录器
   * @param dependencies.dataSource 数据源
   * @param dependencies.transactionManager 事务管理器
   * @returns 事件系统组件
   */
  static createEventSystem(
    config: Partial<IEventSystemConfig> = {},
    dependencies: {
      logger: Logger;
      dataSource?: DataSource;
      transactionManager?: ITransactionManager;
    },
  ): {
    eventPublisher: IEventPublisher;
    eventBus: IEventBus;
    eventStore: IEventStore;
    handlers: IEventHandler[];
  } {
    const finalConfig = { ...DEFAULT_EVENT_SYSTEM_CONFIG, ...config };
    const { logger, dataSource, transactionManager } = dependencies;

    // 创建事件存储
    const eventStore = this.createEventStore(finalConfig, logger, dataSource);

    // 创建事件总线
    const eventBus = new EventBus(logger);

    // 创建事件发布器
    const basePublisher = new EventPublisher(
      eventBus,
      eventStore,
      transactionManager,
      logger,
    );
    const eventPublisher =
      finalConfig.enableTransactionalPublishing && transactionManager
        ? new TransactionalEventPublisher(
            basePublisher,
            transactionManager,
            logger,
          )
        : basePublisher;

    // 创建并注册事件处理器
    const handlers = this.createEventHandlers(finalConfig, logger);
    this.registerEventHandlers(eventBus, handlers, finalConfig);

    return {
      eventPublisher,
      eventBus,
      eventStore,
      handlers,
    };
  }

  /**
   * 创建事件存储
   * @param config 事件系统配置
   * @param logger 日志记录器
   * @param dataSource 数据源
   * @returns 事件存储实例
   */
  private static createEventStore(
    config: IEventSystemConfig,
    logger: Logger,
    dataSource?: DataSource,
  ): IEventStore {
    if (!config.enableEventStore) {
      // 如果禁用事件存储，返回内存存储作为后备
      return new InMemoryEventStore(logger);
    }

    switch (config.eventStoreType) {
      case 'memory':
        return new InMemoryEventStore(logger);

      case 'database':
        if (!dataSource) {
          throw new Error('DataSource is required for database event store');
        }
        return new DatabaseEventStore(dataSource, logger);

      default:
        throw new Error(`Unknown event store type: ${config.eventStoreType}`);
    }
  }

  /**
   * 创建事件处理器
   * @param config 事件系统配置
   * @param logger 日志记录器
   * @returns 事件处理器数组
   */
  private static createEventHandlers(
    config: IEventSystemConfig,
    logger: Logger,
  ): IEventHandler[] {
    const handlers: IEventHandler[] = [];

    // 集合事件处理器
    handlers.push(new CollectionCreatedEventHandler(logger));
    handlers.push(new CollectionUpdatedEventHandler(logger));
    handlers.push(new CollectionDeletedEventHandler(logger));

    // 文档事件处理器
    handlers.push(new DocumentCreatedEventHandler(logger));
    handlers.push(new DocumentStatusChangedEventHandler(logger));

    // 块事件处理器
    if (config.batchConfig.enabled) {
      handlers.push(
        new ChunkEmbeddingGeneratedEventHandler(
          logger,
          config.batchConfig.size,
          config.batchConfig.timeout,
        ),
      );
    }

    // 通用事件处理器
    if (config.enableAuditLogging) {
      handlers.push(new AuditLogEventHandler(logger));
    }

    if (config.enableEventStatistics) {
      handlers.push(
        new EventStatisticsEventHandler(
          logger,
          config.batchConfig.size * 2, // 统计处理器使用更大的批次
          config.batchConfig.timeout * 2,
        ),
      );
    }

    return handlers;
  }

  /**
   * 注册事件处理器到事件总线
   * @param eventBus 事件总线
   * @param handlers 事件处理器数组
   * @param config 事件系统配置
   */
  private static registerEventHandlers(
    eventBus: IEventBus,
    handlers: IEventHandler[],
    config: IEventSystemConfig,
  ): void {
    for (const handler of handlers) {
      const eventType = handler.getEventType();

      if (eventType === '*') {
        // 通用处理器，需要注册到所有已知的事件类型
        const knownEventTypes = [
          'CollectionCreated',
          'CollectionUpdated',
          'CollectionDeleted',
          'DocumentCreated',
          'DocumentUpdated',
          'DocumentDeleted',
          'DocumentContentUpdated',
          'DocumentStatusChanged',
          'DocumentAddedToCollection',
          'DocumentRemovedFromCollection',
          'ChunkCreated',
          'ChunkUpdated',
          'ChunkDeleted',
          'ChunkEmbeddingGenerated',
          'ChunkStatusChanged',
        ];

        for (const type of knownEventTypes) {
          eventBus.register(type, handler);
        }
      } else {
        eventBus.register(eventType, handler);
      }
    }
  }

  /**
   * 创建开发环境的事件系统（简化配置）
   * @param logger 日志记录器
   * @param dataSource 数据源
   * @returns 事件系统组件
   */
  static createDevelopmentEventSystem(
    logger: Logger,
    dataSource?: DataSource,
  ): ReturnType<typeof EventSystemFactory.createEventSystem> {
    return this.createEventSystem(
      {
        enableEventStore: true,
        eventStoreType: 'memory',
        enableTransactionalPublishing: false,
        enableAuditLogging: false,
        enableEventStatistics: false,
        batchConfig: {
          enabled: false,
          size: 10,
          timeout: 1000,
        },
      },
      { logger, dataSource },
    );
  }

  /**
   * 创建生产环境的事件系统（完整配置）
   * @param logger 日志记录器
   * @param dataSource 数据源
   * @param transactionManager 事务管理器
   * @returns 事件系统组件
   */
  static createProductionEventSystem(
    logger: Logger,
    dataSource: DataSource,
    transactionManager: ITransactionManager,
  ): ReturnType<typeof EventSystemFactory.createEventSystem> {
    return this.createEventSystem(
      {
        enableEventStore: true,
        eventStoreType: 'database',
        enableTransactionalPublishing: true,
        enableAuditLogging: true,
        enableEventStatistics: true,
        batchConfig: {
          enabled: true,
          size: 100,
          timeout: 5000,
        },
        retryConfig: {
          maxRetries: 5,
          retryInterval: 2000,
          backoffFactor: 2,
          maxRetryInterval: 60000,
          enableDeadLetterQueue: true,
        },
      },
      { logger, dataSource, transactionManager },
    );
  }

  /**
   * 创建测试环境的事件系统（最小配置）
   * @param logger 日志记录器
   * @returns 事件系统组件
   */
  static createTestEventSystem(
    logger: Logger,
  ): ReturnType<typeof EventSystemFactory.createEventSystem> {
    return this.createEventSystem(
      {
        enableEventStore: false,
        enableTransactionalPublishing: false,
        enableAuditLogging: false,
        enableEventStatistics: false,
        batchConfig: {
          enabled: false,
          size: 1,
          timeout: 100,
        },
      },
      { logger },
    );
  }
}

/**
 * 事件系统管理器
 * 负责管理事件系统的生命周期
 */
export class EventSystemManager {
  private eventSystem?: ReturnType<typeof EventSystemFactory.createEventSystem>;
  private isInitialized = false;

  /**
   * 构造函数
   * @param config 事件系统配置
   * @param dependencies 依赖项
   * @param dependencies.logger 日志记录器
   * @param dependencies.dataSource 数据源
   * @param dependencies.transactionManager 事务管理器
   */
  constructor(
    private readonly config: Partial<IEventSystemConfig>,
    private readonly dependencies: {
      logger: Logger;
      dataSource?: DataSource;
      transactionManager?: ITransactionManager;
    },
  ) {}

  /**
   * 初始化事件系统
   * @returns Promise
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.dependencies.logger.info('Initializing event system', {
      config: this.config,
    });

    this.eventSystem = EventSystemFactory.createEventSystem(
      this.config,
      this.dependencies,
    );

    this.isInitialized = true;
    this.dependencies.logger.info('Event system initialized successfully');
  }

  /**
   * 获取事件发布器
   * @returns 事件发布器
   */
  getEventPublisher(): IEventPublisher {
    this.ensureInitialized();
    return this.eventSystem!.eventPublisher;
  }

  /**
   * 获取事件总线
   * @returns 事件总线
   */
  getEventBus(): IEventBus {
    this.ensureInitialized();
    return this.eventSystem!.eventBus;
  }

  /**
   * 获取事件存储
   * @returns 事件存储
   */
  getEventStore(): IEventStore {
    this.ensureInitialized();
    return this.eventSystem!.eventStore;
  }

  /**
   * 获取事件处理器
   * @returns 事件处理器数组
   */
  getEventHandlers(): IEventHandler[] {
    this.ensureInitialized();
    return this.eventSystem!.handlers;
  }

  /**
   * 关闭事件系统
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    this.dependencies.logger.info('Shutting down event system');

    // 刷新所有批处理器
    for (const handler of this.eventSystem!.handlers) {
      if ('flush' in handler && typeof handler.flush === 'function') {
        try {
          await (handler as unknown as { flush(): Promise<void> }).flush();
        } catch (error) {
          this.dependencies.logger.error('Failed to flush event handler', {
            handlerName: handler.getName(),
            error: (error as Error).message,
          });
        }
      }
    }

    this.isInitialized = false;
    this.dependencies.logger.info('Event system shut down successfully');
  }

  /**
   * 确保事件系统已初始化
   */
  private ensureInitialized(): void {
    if (!this.isInitialized || !this.eventSystem) {
      throw new Error(
        'Event system is not initialized. Call initialize() first.',
      );
    }
  }
}
