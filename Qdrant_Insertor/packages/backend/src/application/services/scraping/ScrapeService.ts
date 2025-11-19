/**
 * 爬取服务（重构后）
 * 集成状态机框架，提供爬虫任务的管理功能
 */

import { Logger } from '@logging/logger.js';
import {
  IScrapeService,
  IScrapeTask,
  ScrapeConfig,
  ScrapeStatus,
  ScrapeType,
  ScrapeResult,
} from '@domain/entities/scrape.js';
import { CollectionId, DocId } from '@domain/entities/types.js';
import {
  IStateMachineEngine,
  StateMachineContext,
  BaseState,
  BaseEvent,
  StateMachineTask,
  StateMachineConfig,
  StatePersistence,
} from '@domain/state-machine/types.js';
import { BaseStateMachineStrategy } from '@domain/state-machine/BaseStateMachineStrategy.js';
import { IWebCrawler } from '@domain/entities/scrape.js';
import { IContentExtractor } from '@domain/entities/scrape.js';
import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { IImportService } from '@application/services/index.js';

// 导入拆分后的模块
import { ScrapeServiceCore } from './ScrapeServiceCore.js';
import { ScrapeServiceOperations } from './ScrapeServiceOperations.js';
import { ScrapeServiceTasks } from './ScrapeServiceTasks.js';
import {
  ScrapeServiceResults,
  ScrapeResultRecord,
} from './ScrapeServiceResults.js';

/**
 * 爬取服务（重构后）
 * 集成状态机框架，提供爬虫任务的管理功能
 */
export class ScrapeService implements IScrapeService {
  private readonly stateMachine: IStateMachineEngine;
  private readonly core: ScrapeServiceCore;
  private readonly operations: ScrapeServiceOperations;
  private readonly tasks: ScrapeServiceTasks;
  private readonly results: ScrapeServiceResults;

  /**
   * 创建爬取服务实例
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
    webCrawler?: IWebCrawler,
    contentExtractor?: IContentExtractor,
    sqliteRepo?: ISQLiteRepo,
    importService?: IImportService,
  ) {
    this.stateMachine = stateMachine;
    this.core = new ScrapeServiceCore(
      stateMachine,
      logger,
      webCrawler || null,
      contentExtractor || null,
    );
    this.operations = new ScrapeServiceOperations(stateMachine, logger);
    this.tasks = new ScrapeServiceTasks(stateMachine, logger);
    this.results = new ScrapeServiceResults(
      stateMachine,
      logger,
      sqliteRepo || null,
      importService || null,
    );
  }

  /**
   * 创建爬虫任务
   * @param config 爬虫配置
   * @returns 任务ID
   */
  async createScrapeTask(config: ScrapeConfig): Promise<string> {
    return this.core.createScrapeTask(config);
  }

  /**
   * 获取爬虫任务状态
   * @param taskId 任务ID
   * @returns 任务状态
   */
  async getScrapeTask(taskId: string): Promise<IScrapeTask | null> {
    return this.tasks.getScrapeTask(taskId) as Promise<IScrapeTask | null>;
  }

  /**
   * 获取所有爬虫任务
   * @returns 任务列表
   */
  async getAllScrapeTasks(): Promise<IScrapeTask[]> {
    return this.tasks.getAllScrapeTasks() as Promise<IScrapeTask[]>;
  }

  /**
   * 获取指定状态的爬虫任务
   * @param status 状态
   * @returns 任务列表
   */
  async getScrapeTasksByStatus(status: ScrapeStatus): Promise<IScrapeTask[]> {
    return this.tasks.getScrapeTasksByStatus(status) as Promise<IScrapeTask[]>;
  }

  /**
   * 取消爬虫任务
   * @param taskId 任务ID
   * @returns 是否成功取消
   */
  async cancelScrapeTask(taskId: string): Promise<boolean> {
    return this.tasks.cancelScrapeTask(taskId);
  }

  /**
   * 重试爬虫任务
   * @param taskId 任务ID
   * @returns 是否成功重试
   */
  async retryScrapeTask(taskId: string): Promise<boolean> {
    return this.tasks.retryScrapeTask(taskId);
  }

  /**
   * 获取爬虫任务统计
   * @returns 任务统计
   */
  async getScrapeTaskStats(): Promise<Record<string, Record<string, number>>> {
    return this.tasks.getScrapeTaskStats();
  }

  /**
   * 清理旧爬虫任务
   * @param olderThanDays 天数阈值
   * @returns 清理结果
   */
  async cleanupOldScrapeTasks(
    olderThanDays: number = 30,
  ): Promise<{ deleted: number }> {
    return this.tasks.cleanupOldScrapeTasks(olderThanDays);
  }

  /**
   * 获取爬取结果
   * @param params 查询参数
   * @param params.status 结果状态过滤
   * @param params.taskId 任务ID过滤
   * @param params.limit 结果数量限制
   * @param params.offset 结果偏移量
   * @param params.includeContent 是否包含内容
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
    return this.results.listScrapeResults(params);
  }

  /**
   * 获取单条爬取结果明细
   * @param id 结果ID
   * @returns 爬取结果详情
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
    snippet?: string;
  } | null> {
    return this.results.getScrapeResult(id);
  }

  /**
   * 删除爬取结果
   * @param id 结果ID
   * @returns 删除结果
   */
  async deleteScrapeResult(id: string): Promise<{ success: boolean }> {
    return this.results.deleteScrapeResult(id);
  }

  /**
   * 将爬取结果导入为文档
   * @param id 结果ID
   * @param collectionId 集合ID
   * @param name 文档名称
   * @returns 导入结果
   */
  async importScrapeResult(
    id: string,
    collectionId: CollectionId,
    name?: string,
  ): Promise<{
    success: boolean;
    docId?: DocId;
    error?: string;
  }> {
    const result = await this.results.importScrapeResult(
      id,
      collectionId,
      name,
    );
    return {
      ...result,
      docId: result.docId as DocId | undefined,
    };
  }

  /**
   * 批量导入某任务下所有PENDING结果为文档
   * @param taskId 任务ID
   * @param collectionId 集合ID
   * @param namePrefix 文档名称前缀
   * @returns 批量导入结果
   */
  async batchImportScrapeResults(
    taskId: string,
    collectionId: string,
    namePrefix?: string,
  ): Promise<{
    success: boolean;
    imported: number;
    errors?: Array<{ id: string; error: string }>;
  }> {
    return this.results.batchImportScrapeResults(
      [taskId],
      collectionId,
      namePrefix,
    );
  }

  /**
   * 批量删除某任务的PENDING结果
   * @param taskId 任务ID
   * @returns 删除结果
   */
  async batchDeleteScrapeResults(
    taskId: string,
  ): Promise<{ success: boolean; deleted: number }> {
    return this.results.batchDeleteScrapeResults([taskId]);
  }

  /**
   * 获取爬取结果统计
   * @returns 统计信息
   */
  async getScrapeResultStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
  }> {
    return this.results.getScrapeResultStats();
  }

  /**
   * 清理旧的爬取结果
   * @param olderThanDays 天数阈值
   * @returns 清理结果
   */
  async cleanupOldScrapeResults(
    olderThanDays: number = 30,
  ): Promise<{ deleted: number }> {
    return this.results.cleanupOldScrapeResults(olderThanDays);
  }

  /**
   * 获取爬取结果摘要
   * @param id 结果ID
   * @returns 摘要信息
   */
  async getScrapeResultSummary(id: string): Promise<{
    id: string;
    taskId: string;
    url: string;
    title: string;
    status: string;
    linkCount: number;
    contentLength: number;
    createdAt: string;
    updatedAt: string;
  }> {
    return this.results.getScrapeResultSummary(id);
  }

  /**
   * 搜索爬取结果
   * @param query 搜索查询
   * @param options 搜索选项
   * @param options.status 结果状态过滤
   * @param options.taskId 任务ID过滤
   * @param options.limit 结果数量限制
   * @param options.offset 结果偏移量
   * @returns 搜索结果
   */
  async searchScrapeResults(
    query: string,
    options?: {
      status?: 'PENDING' | 'IMPORTED' | 'DELETED';
      taskId?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{
    results: ScrapeResultRecord[];
    total: number;
    hasMore: boolean;
  }> {
    return this.results.searchScrapeResults(query, options);
  }

  /**
   * 验证爬取结果
   * @param result 爬取结果
   * @returns 验证结果
   */
  validateScrapeResult(result: Partial<ScrapeResultRecord>): {
    valid: boolean;
    errors: string[];
  } {
    return this.results.validateScrapeResult(result);
  }

  /**
   * 格式化爬取结果
   * @param result 爬取结果
   * @param includeContent 是否包含内容
   * @returns 格式化后的结果
   */
  formatScrapeResult(
    result: ScrapeResultRecord,
    includeContent: boolean = false,
  ): ScrapeResultRecord {
    return this.results.formatScrapeResult(result, includeContent);
  }

  /**
   * 创建爬取结果
   * @param taskId 任务ID
   * @param status 状态
   * @param title 标题
   * @param content 内容
   * @param links 链接列表
   * @param metadata 元数据
   * @returns 创建结果
   */
  async createScrapeResult(
    taskId: string,
    status: ScrapeStatus,
    title?: string,
    content?: string,
    links?: Array<{ url: string; text?: string; title?: string }>,
    metadata?: Record<string, unknown>,
  ): Promise<string> {
    return this.results.createScrapeResult(
      taskId,
      status,
      title,
      content,
      links,
      metadata,
    );
  }

  /**
   * 更新爬取结果状态
   * @param id 结果ID
   * @param status 新状态
   * @returns 更新结果
   */
  async updateScrapeResultStatus(
    id: string,
    status: 'PENDING' | 'IMPORTED' | 'DELETED',
  ): Promise<{ success: boolean }> {
    return this.results.updateScrapeResultStatus(id, status);
  }

  /**
   * 验证爬取配置
   * @param config 爬取配置
   * @returns 验证结果
   */
  validateScrapeConfig(config: ScrapeConfig): {
    valid: boolean;
    errors: string[];
  } {
    return this.core.validateConfig(config);
  }

  /**
   * 创建任务ID
   * @returns 任务ID
   */
  createTaskId(): string {
    return this.core.createTaskId();
  }

  /**
   * 创建任务上下文
   * @param config 爬取配置
   * @param taskId 任务ID
   * @returns 任务上下文
   */
  createTaskContext(config: ScrapeConfig, taskId: string): StateMachineContext {
    return this.core.createTaskContext(config, taskId);
  }

  /**
   * 记录任务事件
   * @param taskId 任务ID
   * @param event 事件类型
   * @param context 上下文信息
   * @returns 记录结果
   */
  async logTaskEvent(
    taskId: string,
    event: BaseEvent | string | Record<string, unknown>,
    context?: Record<string, unknown>,
  ): Promise<void> {
    return this.core.logTaskEvent(taskId, event, context);
  }

  /**
   * 更新任务进度
   * @param taskId 任务ID
   * @param progress 进度百分比
   * @returns 更新结果
   */
  async updateTaskProgress(taskId: string, progress: number): Promise<void> {
    return this.core.updateTaskProgress(taskId, progress);
  }

  /**
   * 设置任务错误
   * @param taskId 任务ID
   * @param error 错误信息
   * @returns 设置结果
   */
  async setTaskError(taskId: string, error: string): Promise<void> {
    return this.core.setTaskError(taskId, error);
  }

  /**
   * 获取任务日志
   * @param taskId 任务ID
   * @returns 任务日志
   */
  async getTaskLogs(
    taskId: string,
  ): Promise<Array<{ level: string; message: string; ts: number }>> {
    return this.core.getTaskLogs(taskId);
  }

  /**
   * 获取任务执行时间
   * @param taskId 任务ID
   * @returns 执行时间统计
   */
  async getTaskExecutionTime(
    taskId: string,
  ): Promise<{ started: number; completed: number; duration: number }> {
    return this.core.getTaskExecutionTime(taskId);
  }

  /**
   * 批量更新任务状态
   * @param taskIds 任务ID数组
   * @param status 新状态
   * @returns 更新结果
   */
  async batchUpdateTaskStatus(
    taskIds: string[],
    status: ScrapeStatus,
  ): Promise<number> {
    return this.core.batchUpdateTaskStatus(taskIds, status);
  }

  /**
   * 批量取消任务
   * @param taskIds 任务ID数组
   * @returns 取消结果
   */
  async batchCancelTasks(taskIds: string[]): Promise<number> {
    return this.core.batchCancelTasks(taskIds);
  }

  /**
   * 获取任务执行时间统计
   * @param taskIds 任务ID数组
   * @returns 执行时间统计
   */
  async getTasksExecutionTime(taskIds: string[]): Promise<
    Array<{
      taskId: string;
      started: number;
      completed: number;
      duration: number;
    }>
  > {
    return this.core.getTasksExecutionTime(taskIds);
  }

  /**
   * 获取任务错误统计
   * @param taskIds 任务ID数组
   * @returns 错误统计
   */
  async getTasksErrorStats(taskIds: string[]): Promise<Record<string, number>> {
    return this.core.getTasksErrorStats(taskIds);
  }

  /**
   * 获取任务进度统计
   * @param taskIds 任务ID数组
   * @returns 进度统计
   */
  async getTasksProgressStats(
    taskIds: string[],
  ): Promise<Record<string, number>> {
    return this.core.getTasksProgressStats(taskIds);
  }
}

// 重新导出所有相关类和接口
export { ScrapeServiceCore } from './ScrapeServiceCore.js';
export { ScrapeServiceOperations } from './ScrapeServiceOperations.js';
export { ScrapeServiceTasks } from './ScrapeServiceTasks.js';
export { ScrapeServiceResults } from './ScrapeServiceResults.js';
