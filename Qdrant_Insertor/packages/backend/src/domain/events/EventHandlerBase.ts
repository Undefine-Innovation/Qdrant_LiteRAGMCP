import {
  type IDomainEvent,
  IEventHandler,
  IEventHandlingResult,
  IEventRetryConfig,
} from './IEventPublisher.js';
import { Logger } from '../../infrastructure/logging/logger.js';

/**
 * 事件处理器基类
 * 提供事件处理器的通用实现
 */
export abstract class EventHandlerBase<T extends IDomainEvent = IDomainEvent>
  implements IEventHandler<T>
{
  protected readonly logger: Logger;
  protected readonly retryConfig: IEventRetryConfig;

  /**
   * 构造函数
   * @param logger 日志记录器
   * @param retryConfig 重试配置
   */
  constructor(logger: Logger, retryConfig: Partial<IEventRetryConfig> = {}) {
    this.logger = logger;
    this.retryConfig = {
      maxRetries: 3,
      retryInterval: 1000,
      backoffFactor: 2,
      maxRetryInterval: 30000,
      enableDeadLetterQueue: true,
      ...retryConfig,
    };
  }

  /**
   * 处理事件（带重试机制）
   * @param event 领域事件
   */
  async handle(event: T): Promise<void> {
    const startTime = Date.now();
    let retryCount = 0;
    let lastError: Error | undefined;

    while (retryCount <= this.retryConfig.maxRetries) {
      try {
        await this.handleInternal(event);

        // 记录成功处理结果
        this.logHandlingResult({
          eventId: event.eventId,
          handlerName: this.getName(),
          success: true,
          processingTime: Date.now() - startTime,
          retryCount,
          processedAt: Date.now(),
        });

        return;
      } catch (error) {
        lastError = error as Error;
        retryCount++;

        this.logger.warn('Event handling failed, retrying', {
          eventId: event.eventId,
          handlerName: this.getName(),
          retryCount,
          maxRetries: this.retryConfig.maxRetries,
          error: lastError.message,
        });

        // 如果还有重试机会，等待后重试
        if (retryCount <= this.retryConfig.maxRetries) {
          const delay = this.calculateRetryDelay(retryCount);
          await this.sleep(delay);
        }
      }
    }

    // 所有重试都失败了
    const result: IEventHandlingResult = {
      eventId: event.eventId,
      handlerName: this.getName(),
      success: false,
      error: lastError?.message,
      processingTime: Date.now() - startTime,
      retryCount,
      processedAt: Date.now(),
    };

    this.logHandlingResult(result);

    if (this.retryConfig.enableDeadLetterQueue) {
      await this.sendToDeadLetterQueue(event, lastError);
    }

    throw new Error(
      `Failed to handle event ${event.eventId} after ${retryCount} retries: ${lastError?.message}`,
    );
  }

  /**
   * 实际的事件处理逻辑（由子类实现）
   * @param event 领域事件
   */
  protected abstract handleInternal(event: T): Promise<void>;

  /**
   * 获取处理器名称（由子类实现）
   * @returns 处理器名称
   */
  abstract getName(): string;

  /**
   * 获取支持的事件类型（由子类实现）
   * @returns 事件类型
   */
  abstract getEventType(): string;

  /**
   * 检查是否可以处理指定事件
   * @param event 领域事件
   * @returns 是否可以处理
   */
  canHandle(event: IDomainEvent): boolean {
    return event.eventType === this.getEventType();
  }

  /**
   * 获取处理器优先级
   * @returns 优先级
   */
  getPriority(): number {
    return 1; // 默认优先级
  }

  /**
   * 计算重试延迟
   * @param retryCount 重试次数
   * @returns 延迟时间（毫秒）
   */
  private calculateRetryDelay(retryCount: number): number {
    const delay =
      this.retryConfig.retryInterval *
      Math.pow(this.retryConfig.backoffFactor, retryCount - 1);
    return Math.min(delay, this.retryConfig.maxRetryInterval);
  }

  /**
   * 等待指定时间
   * @param ms 等待时间（毫秒）
   * @returns Promise
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 记录事件处理结果
   * @param result 处理结果
   */
  private logHandlingResult(result: IEventHandlingResult): void {
    if (result.success) {
      this.logger.info('Event handled successfully', {
        eventId: result.eventId,
        handlerName: result.handlerName,
        processingTime: result.processingTime,
        retryCount: result.retryCount,
      });
    } else {
      this.logger.error('Event handling failed', {
        eventId: result.eventId,
        handlerName: result.handlerName,
        error: result.error,
        processingTime: result.processingTime,
        retryCount: result.retryCount,
      });
    }
  }

  /**
   * 发送到死信队列（由子类实现可选）
   * @param event 领域事件
   * @param error 错误信息
   */
  protected async sendToDeadLetterQueue(
    event: T,
    error?: Error,
  ): Promise<void> {
    this.logger.error('Event sent to dead letter queue', {
      eventId: event.eventId,
      eventType: event.eventType,
      handlerName: this.getName(),
      error: error?.message,
      eventData: event.getData(),
    });
  }
}

/**
 * 同步事件处理器基类
 * 用于同步处理事件
 */
export abstract class SyncEventHandler<
  T extends IDomainEvent = IDomainEvent,
> extends EventHandlerBase<T> {
  /**
   * 同步处理事件
   * @param event 领域事件
   * @returns Promise
   */
  async handle(event: T): Promise<void> {
    return super.handle(event);
  }
}

/**
 * 异步事件处理器基类
 * 用于异步处理事件
 */
export abstract class AsyncEventHandler<
  T extends IDomainEvent = IDomainEvent,
> extends EventHandlerBase<T> {
  /**
   * 异步处理事件
   * @param event 领域事件
   */
  async handle(event: T): Promise<void> {
    // 不等待处理完成，立即返回
    this.handleInternal(event).catch((error) => {
      this.logger.error('Async event handling failed', {
        eventId: event.eventId,
        handlerName: this.getName(),
        error: error.message,
      });
    });
  }
}

/**
 * 批量事件处理器基类
 * 用于批量处理事件
 */
export abstract class BatchEventHandler<
  T extends IDomainEvent = IDomainEvent,
> extends EventHandlerBase<T> {
  private readonly batchSize: number;
  private readonly batchTimeout: number;
  private eventQueue: T[] = [];
  private batchTimer?: NodeJS.Timeout;

  /**
   * 构造函数
   * @param logger 日志记录器
   * @param batchSize 批处理大小
   * @param batchTimeout 批处理超时时间
   * @param retryConfig 重试配置
   */
  constructor(
    logger: Logger,
    batchSize: number = 10,
    batchTimeout: number = 5000,
    retryConfig?: Partial<IEventRetryConfig>,
  ) {
    super(logger, retryConfig);
    this.batchSize = batchSize;
    this.batchTimeout = batchTimeout;
  }

  /**
   * 处理单个事件（添加到批处理队列）
   * @param event 领域事件
   */
  async handle(event: T): Promise<void> {
    this.eventQueue.push(event);

    // 如果队列达到批处理大小，立即处理
    if (this.eventQueue.length >= this.batchSize) {
      await this.processBatch();
      return;
    }

    // 设置批处理超时
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.processBatch().catch((error) => {
          this.logger.error('Batch processing failed', {
            handlerName: this.getName(),
            error: error.message,
          });
        });
      }, this.batchTimeout);
    }
  }

  /**
   * 处理批量事件（由子类实现）
   * @param events 事件数组
   */
  protected abstract handleBatch(events: T[]): Promise<void>;

  /**
   * 处理当前批次
   */
  private async processBatch(): Promise<void> {
    if (this.eventQueue.length === 0) {
      return;
    }

    // 清除定时器
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }

    // 获取当前批次并清空队列
    const batch = [...this.eventQueue];
    this.eventQueue = [];

    try {
      await this.handleBatch(batch);
      this.logger.info('Batch processed successfully', {
        handlerName: this.getName(),
        batchSize: batch.length,
      });
    } catch (error) {
      this.logger.error('Batch processing failed', {
        handlerName: this.getName(),
        batchSize: batch.length,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 强制处理所有待处理事件
   */
  async flush(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }
    await this.processBatch();
  }
}
