// src/application/services/state-machine/EnhancedStateMachineService.ts

import { Logger } from '@logging/logger.js';
import {
  IEnhancedStateMachineEngine,
  EnhancedStateMachineStrategy,
  StateTransitionValidationResult,
  StateTransitionLog,
  StateMachineMetrics,
} from '@domain/state-machine/EnhancedTypes.js';
import { EnhancedStateMachineEngine } from '@domain/state-machine/EnhancedStateMachineEngine.js';
import { SyncStateMachineStrategy } from '@domain/state-machine/SyncStateMachineStrategy.js';
import { EnhancedScrapeStateMachineStrategy } from '@domain/state-machine/EnhancedScrapeStateMachineStrategy.js';
import { BatchUploadStrategy } from '@domain/state-machine/BatchUploadStrategy.js';
import { StateMachineTask } from '@domain/state-machine/types.js';
import { InMemoryStatePersistence } from '@infrastructure/state-machine/StatePersistence.js';
import {
  ISQLiteRepo,
  IQdrantRepo,
  IEmbeddingProvider,
  ISplitter,
} from '@domain/interfaces/index.js';
import { IWebCrawler, IContentExtractor } from '@domain/entities/scrape.js';
import { DocId } from '@domain/entities/types.js';
import { ScrapeConfig } from '@domain/entities/scrape.js';

/**
 * 增强的状态机服务
 * 提供统一的状态机管理和使用接口，整合所有策略模式的状态机
 */
export class EnhancedStateMachineService {
  private engine: IEnhancedStateMachineEngine;

  /**
   * 构造函数
   * @param logger - 日志记录器
   * @param sqliteRepo - SQLite 仓库实例
   * @param qdrantRepo - Qdrant 仓库实例
   * @param embeddingProvider - 嵌入提供者实例
   * @param splitter - 文档分割器实例
   * @param webCrawler - 网页爬虫实例
   * @param contentExtractor - 内容提取器实例
   */
  constructor(
    private readonly logger: Logger,
    private readonly sqliteRepo: ISQLiteRepo,
    private readonly qdrantRepo: IQdrantRepo,
    private readonly embeddingProvider: IEmbeddingProvider,
    private readonly splitter: ISplitter,
    private readonly webCrawler?: IWebCrawler,
    private readonly contentExtractor?: IContentExtractor,
  ) {
    // 创建状态持久化实例
    const persistence = new InMemoryStatePersistence(logger);

    // 创建增强状态机引擎
    this.engine = new EnhancedStateMachineEngine(logger, persistence);

    // 注册所有策略
    this.registerStrategies(persistence);
  }

  /**
   * 注册所有状态机策略
   * @param persistence - 状态持久化实例
   * @returns 无返回值
   */
  private registerStrategies(persistence: InMemoryStatePersistence): void {
    // 注册同步状态机策略
    const syncStrategy = new SyncStateMachineStrategy(
      this.sqliteRepo,
      this.qdrantRepo,
      this.embeddingProvider,
      this.splitter,
      persistence,
      this.logger,
    );
    this.engine.registerStrategy(syncStrategy);

    // 注册爬虫状态机策略（如果有相关依赖）
    if (this.webCrawler && this.contentExtractor) {
      const scrapeStrategy = new EnhancedScrapeStateMachineStrategy(
        this.webCrawler,
        this.contentExtractor,
        this.sqliteRepo,
        persistence,
        this.logger,
      );
      this.engine.registerStrategy(
        scrapeStrategy as unknown as EnhancedStateMachineStrategy<
          Record<string, unknown>
        >,
      );
    }

    // 注册批量上传状态机策略
    const batchUploadStrategy = new BatchUploadStrategy(
      {
        saveTask: (task) => persistence.saveTask(task),
        getTask: (taskId) => persistence.getTask(taskId),
        getTasksByStatus: (status) => persistence.getTasksByStatus(status),
        getTasksByType: (taskType) => persistence.getTasksByType(taskType),
        updateTask: (taskId, updates) =>
          persistence.updateTask(taskId, updates),
        deleteTask: (taskId) => persistence.deleteTask(taskId),
        cleanupExpiredTasks: (olderThan) =>
          persistence.cleanupExpiredTasks(olderThan),
      },
      this.logger,
    );
    // BatchUploadStrategy implements the legacy BaseStateMachineStrategy shape.
    // Cast to EnhancedStateMachineStrategy for registration compatibility.
    this.engine.registerStrategy(
      batchUploadStrategy as unknown as EnhancedStateMachineStrategy,
    );

    this.logger.info('所有状态机策略注册完成');
  }

  /**
   * 获取状态机引擎实例
   * @returns 状态机引擎实例
   */
  getEngine(): IEnhancedStateMachineEngine {
    return this.engine;
  }

  /**
   * 触发文档同步
   * @param docId - 文档ID
   * @returns 无返回值
   */
  async triggerSync(docId: DocId): Promise<void> {
    const syncStrategy = this.engine.getStrategy(
      'document_sync',
    ) as SyncStateMachineStrategy;
    if (!syncStrategy) {
      throw new Error('同步状态机策略未注册');
    }

    // 检查是否已存在同步任务
    const existingTask = await syncStrategy.getSyncTaskStatus(docId);
    let taskId: string;

    if (existingTask) {
      taskId = existingTask.id;
      this.logger.info(`使用现有同步任务: ${taskId}`);
    } else {
      taskId = await syncStrategy.createSyncTask(docId);
      this.logger.info(`创建新同步任务: ${taskId}`);
    }

    // 异步执行同步任务
    (async () => {
      try {
        await this.engine.executeTask(taskId);
      } catch (error) {
        this.logger.error(`同步任务执行失败: ${taskId}, 错误: ${error}`);
      }
    })();
  }

  /**
   * 创建爬虫任务
   * @param config - 爬虫配置
   * @returns 任务ID
   */
  async createScrapeTask(config: ScrapeConfig): Promise<string> {
    const scrapeStrategy = this.engine.getStrategy(
      'web_crawl',
    ) as unknown as EnhancedScrapeStateMachineStrategy;
    if (!scrapeStrategy) {
      throw new Error('爬虫状态机策略未注册');
    }

    const taskId = await scrapeStrategy.createScrapeTask(config);

    // 异步执行爬虫任务
    (async () => {
      try {
        await this.engine.executeTask(taskId);
      } catch (error) {
        this.logger.error(`爬虫任务执行失败: ${taskId}, 错误: ${error}`);
      }
    })();

    return taskId;
  }

  /**
   * 获取同步任务状态
   * @param docId - 文档ID
   * @returns 同步任务状态
   */
  async getSyncTaskStatus(docId: DocId) {
    const syncStrategy = this.engine.getStrategy(
      'document_sync',
    ) as unknown as SyncStateMachineStrategy;
    if (!syncStrategy) {
      return null;
    }

    return await syncStrategy.getSyncTaskStatus(docId);
  }

  /**
   * 获取爬虫任务状态
   * @param taskId - 任务ID
   * @returns 爬虫任务状态
   */
  async getScrapeTask(taskId: string) {
    const scrapeStrategy = this.engine.getStrategy(
      'web_crawl',
    ) as unknown as EnhancedScrapeStateMachineStrategy;
    if (!scrapeStrategy) {
      return null;
    }

    return await scrapeStrategy.getScrapeTask(taskId);
  }

  /**
   * 获取所有同步任务
   * @returns 同步任务列表
   */
  async getAllSyncTasks() {
    const syncStrategy = this.engine.getStrategy(
      'document_sync',
    ) as SyncStateMachineStrategy;
    if (!syncStrategy) {
      return [];
    }

    return await syncStrategy.getAllSyncTasks();
  }

  /**
   * 获取所有爬虫任务
   * @returns 爬虫任务列表
   */
  async getAllScrapeTasks() {
    const scrapeStrategy = this.engine.getStrategy(
      'web_crawl',
    ) as unknown as EnhancedScrapeStateMachineStrategy;
    if (!scrapeStrategy) {
      return [];
    }

    return await scrapeStrategy.getAllScrapeTasks();
  }

  /**
   * 获取全局状态机指标
   * @returns 全局指标
   */
  async getGlobalMetrics(): Promise<StateMachineMetrics> {
    return await this.engine.getGlobalMetrics();
  }

  /**
   * 获取策略指标
   * @param taskType - 任务类型
   * @returns 策略指标
   */
  async getStrategyMetrics(taskType: string): Promise<StateMachineMetrics> {
    return await this.engine.getStrategyMetrics(taskType);
  }

  /**
   * 获取状态转换历史
   * @param taskId - 任务ID
   * @param limit - 限制条数
   * @returns 状态转换历史
   */
  async getTransitionHistory(
    taskId: string,
    limit?: number,
  ): Promise<StateTransitionLog[]> {
    return await this.engine.getTransitionHistory(taskId, limit);
  }

  /**
   * 验证状态转换
   * @param taskId - 任务ID
   * @param event - 事件
   * @param context - 上下文
   * @returns 验证结果
   */
  async validateTransition(
    taskId: string,
    event: string,
    context?: Record<string, unknown>,
  ): Promise<StateTransitionValidationResult> {
    return await this.engine.validateTransition(taskId, event, context);
  }

  /**
   * 取消任务
   * @param taskId - 任务ID
   * @returns 是否成功取消
   */
  async cancelTask(taskId: string): Promise<boolean> {
    return await this.engine.cancelTask(taskId);
  }

  /**
   * 重试任务
   * @param taskId - 任务ID
   * @returns 是否成功重试
   */
  async retryTask(taskId: string): Promise<boolean> {
    return await this.engine.retryTask(taskId);
  }

  /**
   * 暂停任务
   * @param taskId - 任务ID
   * @returns 是否成功暂停
   */
  async pauseTask(taskId: string): Promise<boolean> {
    return await this.engine.pauseTask(taskId);
  }

  /**
   * 恢复任务
   * @param taskId - 任务ID
   * @returns 是否成功恢复
   */
  async resumeTask(taskId: string): Promise<boolean> {
    return await this.engine.resumeTask(taskId);
  }

  /**
   * 清理过期任务
   * @param olderThan - 过期时间阈值（毫秒）
   * @returns 清理的任务数量
   */
  async cleanupExpiredTasks(olderThan?: number): Promise<number> {
    return await this.engine.cleanupExpiredTasks(olderThan);
  }

  /**
   * 获取指定状态的任务列表
   * @param status - 状态
   * @returns 任务列表
   */
  async getTasksByStatus(status: string): Promise<StateMachineTask[]> {
    return await this.engine.getTasksByStatus(status);
  }

  /**
   * 获取指定类型的任务列表
   * @param taskType - 任务类型
   * @returns 任务列表
   */
  async getTasksByType(taskType: string): Promise<StateMachineTask[]> {
    return await this.engine.getTasksByType(taskType);
  }

  /**
   * 获取任务详情
   * @param taskId - 任务ID
   * @returns 任务详情
   */
  async getTask(taskId: string): Promise<StateMachineTask | null> {
    return await this.engine.getTask(taskId);
  }

  /**
   * 获取已注册的策略列表
   * @returns 策略ID列表
   */
  getRegisteredStrategies(): string[] {
    return this.engine.getRegisteredStrategies();
  }
}
