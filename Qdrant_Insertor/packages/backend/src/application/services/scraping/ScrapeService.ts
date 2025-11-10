// src/application/services/ScrapeService.ts

import { Logger } from '@logging/logger.js';
import {
  IScrapeService,
  IScrapeTask,
  ScrapeConfig,
  ScrapeStatus,
  ScrapeType,
  ScrapeResult,
} from '@domain/entities/scrape.js';
import {
  IStateMachineEngine,
  StateMachineContext,
} from '@domain/state-machine/types.js';
import { BaseStateMachineStrategy } from '@domain/state-machine/BaseStateMachineStrategy.js';
import {
  BaseState,
  BaseEvent,
  StateMachineTask,
  StateMachineConfig,
  StatePersistence,
} from '@domain/state-machine/types.js';
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
   * @param strategyId - 策略ID
   * @param config - 状态机配置
   * @param persistence - 持久化实例
   * @param logger - 日志记录器
   * @param webCrawler - 网页爬虫实例
   * @param contentExtractor - 内容提取器实例
   */
  constructor(
    strategyId: string,
    config: StateMachineConfig,
    persistence: StatePersistence,
    logger: Logger,
    webCrawler?: IWebCrawler,
    contentExtractor?: IContentExtractor,
  ) {
    super(strategyId, config, persistence, logger);
    // Provide safe defaults so the strategy can be registered with only the state/persistence/logger in tests or DI setups.
    this.webCrawler =
      webCrawler ??
      ({
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
  async handleError(taskId: string, error: Error): Promise<void> {
    this.logger.error(`爬取任务 ${taskId} 发生错误: ${error.message}`);
    // 这里可以添加错误通知、重试逻辑等
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
    const ctx = (task.context ?? {}) as Record<string, unknown>;
    const ctxWithLogs = ctx as { logs?: unknown[] };
    const logs = Array.isArray(ctxWithLogs.logs) ? [...ctxWithLogs.logs] : [];
    const record =
      typeof entry === 'string'
        ? { ts: Date.now(), level: 'info', message: entry }
        : {
            ts: Date.now(),
            level: entry.level ?? 'info',
            message: entry.message,
          };
    logs.push(record);
    await this.persistence.updateTask(taskId, { context: { ...ctx, logs } });
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

    const context = task.context as StateMachineContext;

    try {
      // 标记任务开始
      await this.handleTransition(taskId, BaseEvent.START, context);
      // 初始进度
      await this.persistence.updateTask(taskId, { progress: 10 });
      await this.appendLog(
        taskId,
        `开始爬取: ${(context.config as ScrapeConfig).url}`,
      );

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
      const result: ScrapeResult = await this.webCrawler.crawl(
        context.config as ScrapeConfig,
      );

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
        // 尝试从 metadata 中读取 pages 字段（metadata 的类型是 Record<string, unknown>）
        const metadataRec =
          result.metadata && typeof result.metadata === 'object'
            ? (result.metadata as Record<string, unknown>)
            : undefined;
        const pagesVal = metadataRec?.pages;
        const pages = Array.isArray(pagesVal)
          ? (pagesVal as Array<{
              url: string;
              title?: string;
              content?: string;
            }>)
          : undefined;

        await this.handleTransition(taskId, BaseEvent.COMPLETE, {
          ...context,
          extractCompleted: true,
          title: result.title,
          content: result.content,
          links: result.links,
          pages,
        });
        // 结束时标记为100%
        await this.persistence.updateTask(taskId, { progress: 100 });
        await this.appendLog(taskId, '任务完成 ✅');
      } else {
        await this.appendLog(taskId, {
          level: 'error',
          message: `爬取失败: ${result.error ?? '未知错误'}`,
        });
        await this.handleTransition(taskId, BaseEvent.FAIL, {
          ...context,
          error: result.error,
        });
        // 失败也视为流程结束，标记为100%以停止前端加载条
        await this.persistence.updateTask(taskId, { progress: 100 });
      }
    } catch (error) {
      this.logger.error(`爬虫任务执行失败: ${taskId}, 错误: ${String(error)}`);
      await this.appendLog(taskId, {
        level: 'error',
        message: `执行异常: ${(error as Error)?.message ?? String(error)}`,
      });
      await this.handleTransition(taskId, BaseEvent.FAIL, {
        ...context,
        error: (error as Error)?.message ?? String(error),
      });
      // 异常结束
      await this.persistence.updateTask(taskId, { progress: 100 });
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
  private readonly sqliteRepo: import('@domain/repositories/ISQLiteRepo.js').ISQLiteRepo;
  private readonly importService?: import('@domain/repositories/IImportService.js').IImportService;

  /**
   * 创建爬虫服务实例
   * @param stateMachine 状态机引擎
   * @param logger 日志记录器
   * @param webCrawler 网页爬虫实例
   * @param contentExtractor 内容提取器实例
   * @param sqliteRepo SQLite 仓库实例
   * @param importService 导入服务实例
   */
  constructor(
    stateMachine: IStateMachineEngine,
    logger: Logger,
    sqliteRepo: import('@domain/repositories/ISQLiteRepo.js').ISQLiteRepo,
    webCrawler?: IWebCrawler,
    contentExtractor?: IContentExtractor,
    importService?: import('@domain/repositories/IImportService.js').IImportService,
  ) {
    this.stateMachine = stateMachine;
    this.logger = logger;
    this.sqliteRepo = sqliteRepo;
    this.importService = importService;

    // 获取状态机引擎的持久化实例
    const persistence = (
      stateMachine as unknown as { persistence?: StatePersistence }
    ).persistence as StatePersistence;
    if (!persistence) {
      throw new Error('状态机引擎缺少持久化实例');
    }

    // 注册爬虫状态机策略
    const scrapeStrategy = new ScrapeStateMachineStrategy(
      'web_crawl',
      {
        taskType: 'web_crawl',
        initialState: BaseState.NEW,
        finalStates: [
          BaseState.COMPLETED,
          BaseState.FAILED,
          BaseState.CANCELLED,
        ],
        transitions: [
          {
            from: BaseState.NEW,
            to: BaseState.PROCESSING,
            event: BaseEvent.START,
            /**
             * 开始爬取动作
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
             * 爬取完成动作
             * @param context - 任务上下文
             */
            action: async (context: Record<string, unknown>) => {
              this.logger.info(`爬取完成: ${context.taskId}`);
              // 持久化爬取结果到 scrape_results 表，供前端审核/导入
              try {
                const taskId = String(context.taskId ?? '');
                const cfg = (context.config ?? {}) as ScrapeConfig;
                const ctxRec = context as Record<string, unknown>;
                const titleRaw = ctxRec['title'];
                const contentRaw = ctxRec['content'];
                const linksRaw = ctxRec['links'];
                const pagesRaw = ctxRec['pages'];
                const title =
                  typeof titleRaw === 'string' ? titleRaw : undefined;
                const content =
                  typeof contentRaw === 'string' ? contentRaw : undefined;
                const links = Array.isArray(linksRaw)
                  ? (linksRaw as Array<{
                      url: string;
                      text?: string;
                      title?: string;
                    }>)
                  : undefined;
                const pages = Array.isArray(pagesRaw)
                  ? (pagesRaw as Array<{
                      url: string;
                      title?: string;
                      content?: string;
                    }>)
                  : undefined;
                if (!this.sqliteRepo) {
                  this.logger.warn(
                    'ScrapeService 未注入 sqliteRepo，跳过结果持久化',
                  );
                  return;
                }
                if (!taskId || !cfg?.url) {
                  this.logger.warn('缺少 taskId 或 url，无法持久化爬取结果');
                  return;
                }
                // 如果有多页面，则为每个页面生成一条记录：taskId_{idx}
                if (Array.isArray(pages) && pages.length > 0) {
                  pages.forEach((p, idx) => {
                    const recId = idx === 0 ? taskId : `${taskId}_${idx}`;
                    this.sqliteRepo!.scrapeResults.create({
                      id: recId,
                      taskId,
                      url: p.url,
                      title: p.title,
                      content: p.content,
                      links,
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
                    title,
                    content,
                    links,
                    status: 'PENDING',
                    imported_doc_id: null,
                  });
                }
                this.logger.info(`已持久化爬取结果: ${taskId} (${cfg.url})`);
              } catch (e: unknown) {
                this.logger.error(`持久化爬取结果失败: ${String(e)}`);
              }
            },
          },
          {
            from: BaseState.PROCESSING,
            to: BaseState.FAILED,
            event: BaseEvent.FAIL,
            /**
             * 爬取失败动作
             * @param context - 任务上下文
             */
            action: async (context: StateMachineContext) => {
              this.logger.error(
                `爬取失败: ${context.taskId}, 错误: ${context.error}`,
              );
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
             * 重试爬取动作
             * @param context - 任务上下文
             */
            action: async (context: Record<string, unknown>) => {
              this.logger.info(
                `重试爬取: ${context.taskId}, 第${((context as ScrapeContext).retries || 0) + 1}次`,
              );
              // 这里可以添加重试逻辑
            },
          },
          {
            from: BaseState.NEW,
            to: BaseState.CANCELLED,
            event: BaseEvent.CANCEL,
            /**
             * 取消爬取动作
             * @param context - 任务上下文
             */
            action: async (context: StateMachineContext) => {
              this.logger.info(`取消爬取: ${context.taskId}`);
              // 这里可以添加取消逻辑
            },
          },
        ],
        maxRetries: 3,
      },
      persistence, // 使用正确的持久化实例
      this.logger,
      webCrawler, // 传入网页爬虫实例
      contentExtractor, // 传入内容提取器实例
    );
    this.stateMachine.registerStrategy(scrapeStrategy);

    this.logger.info(
      'ScrapeService initialized with state machine integration',
    );
  }

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
    // 异步触发执行，不阻塞请求返回
    (async () => {
      try {
        await this.stateMachine.executeTask(taskId);
      } catch (e) {
        this.logger.error(`自动执行爬虫任务失败: ${taskId}, 错误: ${e}`);
      }
    })();
    return taskId;
  }

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
  async getScrapeTaskStats(): Promise<Record<string, Record<string, number>>> {
    // 由于 IStateMachineEngine 没有 getTaskStats 方法，
    // 我们通过获取不同状态的任务来计算统计信息
    const allTasks = await this.stateMachine.getTasksByType(
      ScrapeType.WEB_CRAWL,
    );

    const stats: Record<string, Record<string, number>> = {
      [ScrapeType.WEB_CRAWL]: {},
    };

    // 按状态分组统计
    allTasks.forEach((task) => {
      const status = task.status;
      if (!stats[ScrapeType.WEB_CRAWL][status]) {
        stats[ScrapeType.WEB_CRAWL][status] = 0;
      }
      stats[ScrapeType.WEB_CRAWL][status]++;
    });

    return stats;
  }

  /**
   * 列出已持久化的爬取结果
   * @param params - 查询参数
   * @param params.status - 状态筛选
   * @param params.taskId - 任务ID筛选
   * @param params.limit - 限制数量
   * @param params.offset - 偏移量
   * @param params.includeContent - 是否包含内容
   * @returns 爬取结果列表
   */
  async listScrapeResults(params?: {
    status?: 'PENDING' | 'IMPORTED' | 'DELETED';
    taskId?: string;
    limit?: number;
    offset?: number;
    includeContent?: boolean;
  }): Promise<
    Array<{
      id: string;
      taskId: string;
      url: string;
      title?: string;
      content?: string;
      links?: Array<{ url: string; text?: string; title?: string }>;
      status: 'PENDING' | 'IMPORTED' | 'DELETED';
      created_at: number;
      updated_at: number;
      imported_doc_id?: string | null;
      snippet?: string;
    }>
  > {
    if (!this.sqliteRepo) return [];
    const records = await this.sqliteRepo.scrapeResults.list({
      status: params?.status,
      taskId: params?.taskId,
      limit: params?.limit,
      offset: params?.offset,
      includeContent: params?.includeContent ?? false,
    });
    // 为前端列表提供轻量摘要，避免一次性渲染大量Markdown
    return records.map((r: {
      id: string;
      taskId: string;
      url: string;
      title?: string;
      content?: string;
      links?: Array<{ url: string; text?: string; title?: string }>;
      status: 'PENDING' | 'IMPORTED' | 'DELETED';
      created_at: number;
      updated_at: number;
      imported_doc_id?: string | null;
    }) => ({
      ...r,
      snippet: r.content ? r.content.slice(0, 300) : undefined,
      content: params?.includeContent ? r.content : undefined,
    }));
  }

  /**
   * 获取单条抓取结果明细（包含全文）
   * @param id - 结果ID
   * @returns 抓取结果详情
   */
  async getScrapeResult(id: string): Promise<{
    id: string;
    taskId: string;
    url: string;
    title?: string;
    content?: string;
    links?: Array<{ url: string; text?: string; title?: string }>;
    status: 'PENDING' | 'IMPORTED' | 'DELETED';
    created_at: number;
    updated_at: number;
    imported_doc_id?: string | null;
  } | null> {
    if (!this.sqliteRepo) return null;
    const rec = await this.sqliteRepo.scrapeResults.getById(id);
    return rec ?? null;
  }

  /**
   * 按任务分组聚合
   * @param params - 查询参数
   * @param params.limit - 限制数量
   * @param params.offset - 偏移量
   * @returns 任务分组列表
   */
  async listScrapeTaskGroups(params?: {
    limit?: number;
    offset?: number;
  }): Promise<
    Array<{
      taskId: string;
      total: number;
      pending: number;
      imported: number;
      deleted: number;
      first_at: number;
      last_at: number;
    }>
  > {
    if (!this.sqliteRepo) return [];
    return await this.sqliteRepo.scrapeResults.getTaskGroups({
      limit: params?.limit,
      offset: params?.offset,
    });
  }

  /**
   * 将抓取结果导入为文档
   * @param id - 结果ID
   * @param collectionId - 集合ID
   * @param name - 文档名称
   * @returns 导入结果
   */
  async importScrapeResult(
    id: string,
    collectionId: import('@domain/entities/types.js').CollectionId,
    name?: string,
  ): Promise<{
    success: boolean;
    docId?: import('@domain/entities/types.js').DocId;
    error?: string;
  }> {
    if (!this.sqliteRepo || !this.importService) {
      return { success: false, error: 'Service not ready' };
    }
    const rec = await this.sqliteRepo.scrapeResults.getById(id);
    if (!rec) return { success: false, error: 'Result not found' };
    const docName = name || rec.title || new URL(rec.url).hostname;
    const content = rec.content || '';
    if (!content) return { success: false, error: 'Empty content' };
    const doc = await this.importService.importText(
      docName,
      content,
      collectionId,
    );
    if (!doc.id) return { success: false, error: 'Failed to get doc id' };
    await this.sqliteRepo.scrapeResults.markImported(id, doc.id);
    return { success: true, docId: doc.id };
  }

  /**
   * 软删除抓取结果
   * @param id - 结果ID
   * @returns 删除结果
   */
  async deleteScrapeResult(id: string): Promise<{ success: boolean }> {
    if (!this.sqliteRepo) return { success: false };
    const rec = await this.sqliteRepo.scrapeResults.getById(id);
    if (!rec) return { success: false };
    await this.sqliteRepo.scrapeResults.delete(id);
    return { success: true };
  }

  /**
   * 批量导入某任务下所有PENDING结果
   * @param taskId - 任务ID
   * @param collectionId - 集合ID
   * @param namePrefix - 名称前缀
   * @returns 批量导入结果
   */
  async importTaskResults(
    taskId: string,
    collectionId: import('@domain/entities/types.js').CollectionId,
    namePrefix?: string,
  ): Promise<{
    success: boolean;
    imported: number;
    errors?: Array<{ id: string; error: string }>;
  }> {
    if (!this.sqliteRepo || !this.importService) {
      return {
        success: false,
        imported: 0,
        errors: [{ id: '*', error: 'Service not ready' }],
      };
    }
    const items = await this.sqliteRepo.scrapeResults.list({
      taskId,
      status: 'PENDING',
      includeContent: true,
    });
    let imported = 0;
    const errors: Array<{ id: string; error: string }> = [];
    for (const it of items) {
      try {
        const name =
          (namePrefix ? `${namePrefix}-` : '') +
          (it.title || new URL(it.url).pathname.replace(/\/+/, '/'));
        const content = it.content || '';
        if (!content) {
          errors.push({ id: it.id, error: 'Empty content' });
          continue;
        }
        const doc = await this.importService.importText(
          name,
          content,
          collectionId,
        );
        if (!doc.id) {
          errors.push({ id: it.id, error: 'Failed to get doc id' });
          continue;
        }
        await this.sqliteRepo.scrapeResults.markImported(it.id, doc.id);
        imported++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({ id: it.id, error: msg || 'Import failed' });
      }
    }
    return {
      success: true,
      imported,
      errors: errors.length ? errors : undefined,
    };
  }

  /**
   * 批量删除（软删除）某任务的PENDING结果
   * @param taskId - 任务ID
   * @returns 删除结果
   */
  async deleteTaskResults(taskId: string): Promise<{ success: boolean }> {
    if (!this.sqliteRepo) return { success: false };
    await this.sqliteRepo.scrapeResults.deleteByTask(taskId);
    return { success: true };
  }
}
