// src/application/services/ScrapeService.ts

import { Logger } from '@logging/logger.js';
import { IScrapeService, IScrapeTask, ScrapeConfig, ScrapeStatus, ScrapeType } from '@domain/entities/scrape.js';
import { IStateMachineEngine, StateMachineContext } from '@domain/state-machine/types.js';
import { BaseStateMachineStrategy } from '@domain/state-machine/BaseStateMachineStrategy.js';
import { BaseState, BaseEvent, StateMachineTask, StateMachineConfig, StatePersistence } from '@domain/state-machine/types.js';
import { IWebCrawler } from '@domain/entities/scrape.js';
import { IContentExtractor } from '@domain/entities/scrape.js';

/**
 * 爬取上下文接口
 */
interface ScrapeContext extends StateMachineContext {
  /** 爬取配置 */
  config: {
    url: string;
    selector?: string;
    waitTime?: number;
    maxDepth?: number;
  };
  /** 重试次数 */
  retries: number;
}

/**
 * 爬虫状态机策略
 * 实现爬虫任务的状态管理和转换逻辑
 */
export class ScrapeStateMachineStrategy extends BaseStateMachineStrategy {
  private readonly webCrawler: IWebCrawler;
  private readonly contentExtractor: IContentExtractor;

  /**
   * 构造函数
   * @param stateMachine - 状态机引擎
   * @param logger - 日志记录器
   */
  constructor(
    strategyId: string,
    config: StateMachineConfig,
    persistence: StatePersistence,
    logger: Logger,
    webCrawler?: IWebCrawler,
    contentExtractor?: IContentExtractor
  ) {
    super(strategyId, config, persistence, logger);
    // Provide safe defaults so the strategy can be registered with only the state/persistence/logger in tests or DI setups.
    this.webCrawler = webCrawler ?? ({
      // minimal no-op implementation to avoid runtime crashes if real crawler not injected
      crawl: async (_cfg: ScrapeConfig) => ({
        status: 'FAILED',
        title: '',
        content: '',
        links: [],
        error: 'No webCrawler provided',
      }),
    } as unknown as IWebCrawler);
    // default to an empty stub for content extractor
    this.contentExtractor = contentExtractor ?? ({} as IContentExtractor);
    this.initializeTransitions();
  }

  /**
   * 处理爬取错误
   * @param taskId - 任务ID
   * @param error - 错误对象
   */
  /**
   * 处理爬取错误
   * @param taskId - 任务ID
   * @param error - 错误对象
   */
  async handleError(taskId: string, error: Error): Promise<void> {
    this.logger.error(`爬取任务 ${taskId} 发生错误: ${error.message}`);
    // 这里可以添加错误通知、重试逻辑等
  }

  /**
   * 执行爬虫任务
   */
  /**
   * 执行爬虫任务
   * @param taskId - 任务ID
   */
  async executeTask(taskId: string): Promise<void> {
    const task = await this.persistence.getTask(taskId);
    if (!task) {
      throw new Error(`任务 ${taskId} 不存在`);
    }

    const context = task.context as StateMachineContext;
    
    try {
      // 标记任务开始
      await this.handleTransition(taskId, BaseEvent.START, context);

      // 开始爬取
      const result = await this.webCrawler.crawl(context.config as ScrapeConfig);
      
      // 更新任务状态和进度
      if (result.status === 'COMPLETED') {
        await this.handleTransition(taskId, BaseEvent.COMPLETE, {
          ...context,
          extractCompleted: true,
          title: result.title,
          content: result.content,
          links: result.links,
        });
      } else {
        await this.handleTransition(taskId, BaseEvent.FAIL, {
          ...context,
          error: result.error,
        });
      }

    } catch (error) {
      this.logger.error(`爬虫任务执行失败: ${taskId}, 错误: ${error}`);
      await this.handleTransition(taskId, BaseEvent.FAIL, {
        ...context,
        error: (error as Error).message,
      });
      throw error;
    }
  }
}

/**
 * 爬虫服务实现
 * 集成状态机框架，提供爬虫任务的管理功能
 */
export class ScrapeService implements IScrapeService {
  private readonly stateMachine: IStateMachineEngine;
  private readonly logger: Logger;

  /**
   * 构造函数
   * @param stateMachine - 状态机引擎
   * @param logger - 日志记录器
   */
  constructor(stateMachine: IStateMachineEngine, logger: Logger) {
    this.stateMachine = stateMachine;
    this.logger = logger;
    
    // 注册爬虫状态机策略
    const scrapeStrategy = new ScrapeStateMachineStrategy(
      'web_crawl',
      {
        taskType: 'web_crawl',
        initialState: BaseState.NEW,
        finalStates: [BaseState.COMPLETED, BaseState.FAILED, BaseState.CANCELLED],
        transitions: [
          {
            from: BaseState.NEW,
            to: BaseState.PROCESSING,
            event: BaseEvent.START,
            /**
             * 开始爬取动作
             * @param context - 任务上下文
             */
            /**
             * 爬取完成动作
             * @param context - 任务上下文
             */
            action: async (context: StateMachineContext) => {
              const { config } = context;
              this.logger.info(`开始爬取: ${(config as ScrapeConfig).url}`);
              // 这里可以添加爬取前的准备工作
            },
          },
          {
            from: BaseState.PROCESSING,
            to: BaseState.COMPLETED,
            event: BaseEvent.COMPLETE,
            condition: (context: StateMachineContext) => {
              // 检查是否已完成爬取
              return context.extractCompleted === true;
            },
            /**
             * 爬取失败动作
             * @param context - 任务上下文
             */
            action: async (context: Record<string, unknown>) => {
              this.logger.info(`爬取完成: ${context.taskId}`);
              // 这里可以添加完成后的处理逻辑
            },
          },
          {
            from: BaseState.PROCESSING,
            to: BaseState.FAILED,
            event: BaseEvent.FAIL,
            /**
             * 重试爬取动作
             * @param context - 任务上下文
             */
            action: async (context: StateMachineContext) => {
              this.logger.error(`爬取失败: ${context.taskId}, 错误: ${context.error}`);
              // 这里可以添加失败后的处理逻辑
            },
          },
          {
            from: BaseState.FAILED,
            to: BaseState.PROCESSING,
            event: BaseEvent.RETRY,
            condition: (context: StateMachineContext) => {
              return (context as ScrapeContext).retries < 3; // 最多重试3次
            },
            /**
             * 取消爬取动作
             * @param context - 任务上下文
             */
            action: async (context: Record<string, unknown>) => {
              this.logger.info(`重试爬取: ${context.taskId}, 第${((context as ScrapeContext).retries || 0) + 1}次`);
              // 这里可以添加重试逻辑
            },
          },
          {
            from: BaseState.NEW,
            to: BaseState.CANCELLED,
            event: BaseEvent.CANCEL,
            action: async (context: StateMachineContext) => {
              this.logger.info(`取消爬取: ${context.taskId}`);
              // 这里可以添加取消逻辑
            },
          },
        ],
        maxRetries: 3,
      },
      stateMachine as unknown as StatePersistence, // 类型适配以满足接口要求
      this.logger
    );
    this.stateMachine.registerStrategy(scrapeStrategy);
    
    this.logger.info('ScrapeService initialized with state machine integration');
  }

  /**
   * 创建爬虫任务
   * @param config - 爬虫配置
   * @returns 任务ID
   */
  /**
   * 创建爬虫任务
   * @param config - 爬虫配置
   * @returns 任务ID
   */
  async createScrapeTask(config: ScrapeConfig): Promise<string> {
    this.logger.info(`创建爬虫任务: ${config.url}`);

    const taskId = `scrape_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 创建任务上下文
    const context = {
      taskId,
      taskType: ScrapeType.WEB_CRAWL,
      config,
      createdAt: Date.now(),
    };

    // 使用状态机创建任务
    await this.stateMachine.createTask(ScrapeType.WEB_CRAWL, taskId, context);
    
    this.logger.info(`爬虫任务已创建: ${taskId}`);
    return taskId;
  }

  /**
   * 获取爬虫任务状态
   * @param taskId - 任务ID
   * @returns 任务状态
   */
  /**
   * 获取爬虫任务状态
   * @param taskId - 任务ID
   * @returns 任务状态
   */
  async getScrapeTask(taskId: string): Promise<IScrapeTask | null> {
    const task = await this.stateMachine.getTask(taskId);
    
    if (!task) {
      this.logger.warn(`爬虫任务不存在: ${taskId}`);
      return null;
    }

    // 转换为IScrapeTask格式
    return {
      id: task.id,
      taskType: task.taskType as ScrapeType,
      status: task.status,
      retries: task.retries,
      lastAttemptAt: task.lastAttemptAt,
      error: task.error,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      progress: task.progress,
      context: task.context,
    };
  }

  /**
   * 获取所有爬虫任务
   * @returns 任务列表
   */
  /**
   * 获取所有爬虫任务
   * @returns 任务列表
   */
  async getAllScrapeTasks(): Promise<IScrapeTask[]> {
    const tasks = await this.stateMachine.getTasksByType(ScrapeType.WEB_CRAWL);
    
    return tasks.map((task: StateMachineTask) => ({
      id: task.id,
      taskType: task.taskType as ScrapeType,
      status: task.status,
      retries: task.retries,
      lastAttemptAt: task.lastAttemptAt,
      error: task.error,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      progress: task.progress,
      context: task.context,
    }));
  }

  /**
   * 获取指定状态的爬虫任务
   * @param status - 状态
   * @returns 任务列表
   */
  /**
   * 获取指定状态的爬虫任务
   * @param status - 状态
   * @returns 任务列表
   */
  async getScrapeTasksByStatus(status: string): Promise<IScrapeTask[]> {
    const tasks = await this.stateMachine.getTasksByStatus(status);
    
    return tasks.map((task: StateMachineTask) => ({
      id: task.id,
      taskType: task.taskType as ScrapeType,
      status: task.status,
      retries: task.retries,
      lastAttemptAt: task.lastAttemptAt,
      error: task.error,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      progress: task.progress,
      context: task.context,
    }));
  }

  /**
   * 取消爬虫任务
   * @param taskId - 任务ID
   * @returns 是否成功
   */
  /**
   * 取消爬虫任务
   * @param taskId - 任务ID
   * @returns 是否成功
   */
  async cancelScrapeTask(taskId: string): Promise<boolean> {
    this.logger.info(`取消爬虫任务: ${taskId}`);
    
    try {
      return await this.stateMachine.transitionState(taskId, BaseEvent.CANCEL);
    } catch (error) {
      this.logger.error(`取消爬虫任务失败: ${taskId}, 错误: ${error}`);
      return false;
    }
  }

  /**
   * 重试爬虫任务
   * @param taskId - 任务ID
   * @returns 是否成功
   */
  /**
   * 重试爬虫任务
   * @param taskId - 任务ID
   * @returns 是否成功
   */
  async retryScrapeTask(taskId: string): Promise<boolean> {
    this.logger.info(`重试爬虫任务: ${taskId}`);
    
    try {
      return await this.stateMachine.transitionState(taskId, BaseEvent.RETRY);
    } catch (error) {
      this.logger.error(`重试爬虫任务失败: ${taskId}, 错误: ${error}`);
      return false;
    }
  }

  /**
   * 获取爬虫任务统计
   * @returns 统计信息
   */
  /**
   * 获取爬虫任务统计
   * @returns 统计信息
   */
  async getScrapeTaskStats(): Promise<Record<string, Record<string, number>>> {
    // 由于 IStateMachineEngine 没有 getTaskStats 方法，
    // 我们通过获取不同状态的任务来计算统计信息
    const allTasks = await this.stateMachine.getTasksByType(ScrapeType.WEB_CRAWL);
    
    const stats: Record<string, Record<string, number>> = {
      [ScrapeType.WEB_CRAWL]: {}
    };
    
    // 按状态分组统计
    allTasks.forEach(task => {
      const status = task.status;
      if (!stats[ScrapeType.WEB_CRAWL][status]) {
        stats[ScrapeType.WEB_CRAWL][status] = 0;
      }
      stats[ScrapeType.WEB_CRAWL][status]++;
    });
    
    return stats;
  }
}