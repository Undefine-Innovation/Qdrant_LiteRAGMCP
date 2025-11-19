// src/domain/state-machine/EnhancedScrapeStateMachineStrategy.ts

import { Logger } from '@logging/logger.js';
import { EnhancedBaseStateMachineStrategy } from './EnhancedBaseStateMachineStrategy.js';
import {
  EnhancedStateMachineConfig,
  DefaultStateTransitionValidator,
  DefaultStateTransitionLogger,
} from './EnhancedTypes.js';
import { StateMachineTask, StatePersistence } from './types.js';
import {
  IScrapeService,
  IScrapeTask,
  ScrapeConfig,
  ScrapeStatus,
  ScrapeType,
  ScrapeResult,
} from '@domain/entities/scrape.js';
import { IWebCrawler, IContentExtractor } from '@domain/entities/scrape.js';

/**
 * 增强的爬取上下文接口
 */
interface EnhancedScrapeContext {
  /** 任务ID */
  taskId: string;
  /** 任务类型 */
  taskType: string;
  /** 爬取配置 */
  config: ScrapeConfig;
  /** 重试次数 */
  retries: number;
  /** 爬取结果 */
  result?: ScrapeResult;
  /** 错误信息（可选） */
  error?: string;
  /** 日志条目 */
  logs?: Array<{
    ts: number;
    level: 'info' | 'error' | 'debug';
    message: string;
  }>;
  /** 是否已完成爬取 */
  extractCompleted?: boolean;
  /** 爬取标题 */
  title?: string;
  /** 爬取内容 */
  content?: string;
  /** 爬取链接 */
  links?: Array<{ url: string; text?: string; title?: string }>;
  /** 爬取页面 */
  pages?: Array<{
    url: string;
    title?: string;
    content?: string;
  }>;
  /** 允许按键访问以兼容通用记录类型 */
  [key: string]: unknown;
}

/**
 * 增强的爬虫状态机策略
 * 实现爬虫任务的状态管理和转换逻辑，包含完整的验证和日志记录
 */
export class EnhancedScrapeStateMachineStrategy extends EnhancedBaseStateMachineStrategy<EnhancedScrapeContext> {
  private readonly webCrawler: IWebCrawler;
  private readonly contentExtractor: IContentExtractor;
  private readonly sqliteRepo: import('@domain/repositories/ISQLiteRepo.js').ISQLiteRepo;

  /**
   * 构造函数
   * @param webCrawler - 网页爬虫实例
   * @param contentExtractor - 内容提取器实例
   * @param sqliteRepo - SQLite 仓库实例
   * @param persistence - 状态持久化实现
   * @param logger - 日志记录器
   */
  constructor(
    webCrawler: IWebCrawler,
    contentExtractor: IContentExtractor,
    sqliteRepo: import('@domain/repositories/ISQLiteRepo.js').ISQLiteRepo,
    persistence: StatePersistence,
    logger: Logger,
  ) {
    const config: EnhancedStateMachineConfig<EnhancedScrapeContext> = {
      taskType: 'web_crawl',
      initialState: 'NEW',
      finalStates: ['COMPLETED', 'FAILED', 'CANCELLED'],
      maxRetries: 3,
      enablePersistence: true,
      enableValidation: true,
      enableLogging: true,
      validator: new DefaultStateTransitionValidator(logger),
      logger: new DefaultStateTransitionLogger(),
      transitions: [
        // NEW -> PROCESSING
        {
          from: 'NEW',
          to: 'PROCESSING',
          event: 'start',
          beforeTransition: async (context: EnhancedScrapeContext) => {
            await this.appendLog(
              context.taskId,
              `开始爬取: ${context.config.url}`,
            );
          },
          action: async (context: EnhancedScrapeContext) => {
            // 爬取逻辑在executeTask中处理
          },
          afterTransition: async (context: EnhancedScrapeContext) => {
            await this.appendLog(context.taskId, '爬取已启动');
          },
        },
        // PROCESSING -> COMPLETED
        {
          from: 'PROCESSING',
          to: 'COMPLETED',
          event: 'complete',
          condition: (context: EnhancedScrapeContext) => {
            return context.extractCompleted === true;
          },
          beforeTransition: async (context: EnhancedScrapeContext) => {
            await this.appendLog(context.taskId, '准备完成爬取任务');
          },
          action: async (context: EnhancedScrapeContext) => {
            await this.persistScrapeResult(context);
          },
          afterTransition: async (context: EnhancedScrapeContext) => {
            await this.appendLog(context.taskId, '爬取任务完成 ✅');
          },
        },
        // PROCESSING -> FAILED
        {
          from: 'PROCESSING',
          to: 'FAILED',
          event: 'fail',
          beforeTransition: async (context: EnhancedScrapeContext) => {
            await this.appendLog(context.taskId, {
              level: 'error',
              message: `爬取失败: ${context.error || '未知错误'}`,
            });
          },
          action: async (context: EnhancedScrapeContext) => {
            logger.error(`爬取失败: ${context.taskId}, 错误: ${context.error}`);
          },
        },
        // FAILED -> PROCESSING (重试)
        {
          from: 'FAILED',
          to: 'PROCESSING',
          event: 'retry',
          condition: (context: EnhancedScrapeContext) => {
            return context.retries < 3;
          },
          beforeTransition: async (context: EnhancedScrapeContext) => {
            await this.appendLog(
              context.taskId,
              `准备重试爬取: 第${context.retries + 1}次`,
            );
          },
          action: async (context: EnhancedScrapeContext) => {
            logger.info(
              `重试爬取: ${context.taskId}, 第${context.retries + 1}次`,
            );
          },
        },
        // NEW -> CANCELLED
        {
          from: 'NEW',
          to: 'CANCELLED',
          event: 'cancel',
          beforeTransition: async (context: EnhancedScrapeContext) => {
            await this.appendLog(context.taskId, '准备取消爬取');
          },
          action: async (context: EnhancedScrapeContext) => {
            logger.info(`取消爬取: ${context.taskId}`);
          },
        },
        // PROCESSING -> CANCELLED
        {
          from: 'PROCESSING',
          to: 'CANCELLED',
          event: 'cancel',
          beforeTransition: async (context: EnhancedScrapeContext) => {
            await this.appendLog(context.taskId, '准备取消进行中的爬取');
          },
          action: async (context: EnhancedScrapeContext) => {
            logger.info(`取消进行中的爬取: ${context.taskId}`);
          },
        },
      ],
    };

    super('web_crawl', config, persistence, logger);

    this.webCrawler = webCrawler;
    this.contentExtractor = contentExtractor;
    this.sqliteRepo = sqliteRepo;
  }

  /**
   * 执行爬虫任务
   * @param taskId - 任务ID
   * @returns 无返回值
   */
  async executeTask(taskId: string): Promise<void> {
    const task = await this.persistence.getTask(taskId);
    if (!task) {
      throw new Error(`任务 ${taskId} 不存在`);
    }

    const context = task.context as unknown as EnhancedScrapeContext;

    try {
      // 标记任务开始
      await this.markTaskStarted(taskId);

      // 开始爬取
      await this.handleTransition(taskId, 'start', context);

      // 初始进度
      await this.persistence.updateTask(taskId, { progress: 10 });

      // 启动心跳进度，缓慢推进到70%
      let stopped = false;
      let tick = 0;
      const heartbeat = setInterval(async () => {
        if (stopped) return;
        try {
          const cur = await this.persistence.getTask(taskId);
          if (!cur) return;
          const p = typeof cur.progress === 'number' ? cur.progress : 0;
          const next = Math.min(70, p + 5);
          if (next > p) {
            await this.persistence.updateTask(taskId, { progress: next });
          }
          // 每5次心跳追加一次日志，避免写入过于频繁
          tick++;
          if (tick % 5 === 0) {
            await this.appendLog(taskId, '爬取进行中...');
          }
          if (next >= 70) {
            clearInterval(heartbeat);
          }
        } catch (e: unknown) {
          // 心跳失败不应中断主流程，仅记录一次调试日志
          this.logger.debug?.(`心跳进度更新失败: ${String(e)}`);
        }
      }, 1000);

      // 开始爬取
      const result: ScrapeResult = await this.webCrawler.crawl(context.config);

      // 停止心跳
      stopped = true;
      try {
        clearInterval(heartbeat);
      } catch (e: unknown) {
        // 清理心跳失败仅记录调试日志，不中断主流程
        this.logger.debug?.(`清理心跳失败: ${String(e)}`);
      }

      // 更新任务状态和进度
      if (result.status === 'COMPLETED') {
        // 爬取完成但尚未持久完成标记，先提升到90%
        await this.persistence.updateTask(taskId, { progress: 90 });
        const linksCount = Array.isArray(result.links)
          ? result.links.length
          : 0;
        await this.appendLog(taskId, `爬取完成，解析到 ${linksCount} 个链接`);

        // 更新上下文
        context.extractCompleted = true;
        context.title = result.title;
        context.content = result.content;
        context.links = result.links;

        // 尝试从 metadata 中读取 pages 字段
        const metadataRec =
          result.metadata && typeof result.metadata === 'object'
            ? (result.metadata as Record<string, unknown>)
            : undefined;
        const pagesVal = metadataRec?.pages;
        context.pages = Array.isArray(pagesVal)
          ? (pagesVal as Array<{
              url: string;
              title?: string;
              content?: string;
            }>)
          : undefined;

        // 完成任务
        await this.handleTransition(taskId, 'complete', context);

        // 结束时标记为100%
        await this.persistence.updateTask(taskId, { progress: 100 });
      } else {
        await this.appendLog(taskId, {
          level: 'error',
          message: `爬取失败: ${result.error ?? '未知错误'}`,
        });

        context.error = result.error;
        await this.handleTransition(taskId, 'fail', context);

        // 失败也视为流程结束，标记为100%以停止前端加载条
        await this.persistence.updateTask(taskId, { progress: 100 });
      }
    } catch (error) {
      this.logger.error(`爬虫任务执行失败: ${taskId}, 错误: ${String(error)}`);

      await this.appendLog(taskId, {
        level: 'error',
        message: `执行异常: ${(error as Error)?.message ?? String(error)}`,
      });

      const context = task.context as unknown as EnhancedScrapeContext;
      context.error = (error as Error)?.message ?? String(error);

      await this.handleTransition(taskId, 'fail', context);

      // 异常结束
      await this.persistence.updateTask(taskId, { progress: 100 });
      throw error;
    }
  }

  /**
   * 追加一条任务日志到上下文
   * @param taskId - 任务ID
   * @param entry - 日志条目
   * @returns 无返回值
   */
  private async appendLog(
    taskId: string,
    entry:
      | { level?: 'info' | 'error' | 'debug'; message: string; ts?: number }
      | string,
  ): Promise<void> {
    const task = await this.persistence.getTask(taskId);
    if (!task) return;

    const context = (task.context ?? {}) as unknown as EnhancedScrapeContext;
    const logs = Array.isArray(context.logs) ? [...context.logs] : [];

    const record =
      typeof entry === 'string'
        ? { ts: Date.now(), level: 'info' as const, message: entry }
        : {
            ts: entry.ts ?? Date.now(),
            level: entry.level ?? 'info',
            message: entry.message,
          };

    logs.push(record);

    await this.persistence.updateTask(taskId, {
      context: { ...context, logs },
    });
  }

  /**
   * 持久化爬取结果
   * @param context - 爬取上下文
   * @returns 无返回值
   */
  private async persistScrapeResult(
    context: EnhancedScrapeContext,
  ): Promise<void> {
    try {
      const taskId = context.taskId;
      const cfg = context.config;

      if (!this.sqliteRepo) {
        this.logger.warn(
          'EnhancedScrapeStateMachineStrategy 未注入 sqliteRepo，跳过结果持久化',
        );
        return;
      }

      if (!taskId || !cfg?.url) {
        this.logger.warn('缺少 taskId 或 url，无法持久化爬取结果');
        return;
      }

      // 如果有多页面，则为每个页面生成一条记录：taskId_{idx}
      if (Array.isArray(context.pages) && context.pages.length > 0) {
        context.pages.forEach((p, idx) => {
          const recId = idx === 0 ? taskId : `${taskId}_${idx}`;
          this.sqliteRepo.scrapeResults.create({
            id: recId,
            taskId,
            url: p.url,
            title: p.title,
            content: p.content,
            links: context.links,
            status: 'PENDING',
            imported_doc_id: null,
          });
        });
      } else {
        // 单页回退
        this.sqliteRepo.scrapeResults.create({
          id: taskId,
          taskId,
          url: cfg.url,
          title: context.title,
          content: context.content,
          links: context.links,
          status: 'PENDING',
          imported_doc_id: null,
        });
      }

      this.logger.info(`已持久化爬取结果: ${taskId} (${cfg.url})`);
    } catch (e: unknown) {
      this.logger.error(`持久化爬取结果失败: ${String(e)}`);
    }
  }

  /**
   * 创建爬虫任务
   * @param config - 爬虫配置
   * @returns 任务ID
   */
  async createScrapeTask(config: ScrapeConfig): Promise<string> {
    const taskId = `scrape_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 创建任务上下文
    const context: EnhancedScrapeContext = {
      taskId,
      taskType: ScrapeType.WEB_CRAWL,
      config,
      retries: 0,
      logs: [],
    };

    // 使用状态机创建任务
    await this.createTask(taskId, context);

    this.logger.info(`爬虫任务已创建: ${taskId}`);
    return taskId;
  }

  /**
   * 获取爬虫任务状态
   * @param taskId - 任务ID
   * @returns 任务状态
   */
  async getScrapeTask(taskId: string): Promise<IScrapeTask | null> {
    const task = await this.persistence.getTask(taskId);

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
  async getAllScrapeTasks(): Promise<IScrapeTask[]> {
    const tasks = await this.persistence.getTasksByType('web_crawl');

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
  async getScrapeTasksByStatus(status: string): Promise<IScrapeTask[]> {
    const tasks = await this.persistence.getTasksByStatus(status);

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
}
