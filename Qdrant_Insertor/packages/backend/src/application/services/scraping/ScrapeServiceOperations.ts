import { Logger } from '@logging/logger.js';
import {
  ScrapeConfig,
  ScrapeResult,
  ScrapeStatus,
} from '@domain/entities/scrape.js';
import {
  BaseEvent,
  IStateMachineEngine,
  StateMachineContext,
  StateMachineTask,
} from '@domain/state-machine/types.js';
import { ScrapeServiceCore } from './ScrapeServiceCore.js';

/**
 * ��ȡ��������ò���
 * �ṩһЩ��������״̬����ں�������ķ���
 */
export class ScrapeServiceOperations {
  private readonly helper: ScrapeServiceCore;

  constructor(
    protected readonly stateMachine: IStateMachineEngine,
    protected readonly logger: Logger,
  ) {
    this.helper = new ScrapeServiceCore(stateMachine, logger, null, null);
  }

  /**
   * 获取准确的状态机上下文信息
   * @param task 状态机任务
   * @returns 状态机上下文
   */
  protected toContext(task: StateMachineTask): StateMachineContext {
    const baseContext = (task.context || {}) as Partial<StateMachineContext>;
    return {
      ...baseContext,
      taskId: (baseContext.taskId as string) || task.id,
      taskType: (baseContext.taskType as string) || task.taskType,
    };
  }

  async createScrapeTask(config: ScrapeConfig): Promise<string> {
    const validation = this.helper.validateConfig(config);
    if (!validation.valid) {
      throw new Error(`������֤ʧ��: ${validation.errors.join(', ')}`);
    }

    const taskId = this.helper.createTaskId();
    const context = this.helper.createTaskContext(config, taskId);

    await this.stateMachine.createTask('web_crawl', taskId, context);
    await this.stateMachine.transitionState(taskId, BaseEvent.START, context);

    this.logger.info(`������ȡ����: ${taskId}, URL: ${config.url}`);
    return taskId;
  }

  async getScrapeTask(taskId: string): Promise<StateMachineTask | null> {
    return this.stateMachine.getTask(taskId);
  }

  async getAllScrapeTasks(): Promise<StateMachineTask[]> {
    return this.stateMachine.getTasksByType('web_crawl');
  }

  async getScrapeTasksByStatus(
    status: ScrapeStatus,
  ): Promise<StateMachineTask[]> {
    return this.stateMachine.getTasksByStatus(status);
  }

  async cancelScrapeTask(taskId: string): Promise<boolean> {
    try {
      await this.stateMachine.transitionState(taskId, BaseEvent.CANCEL);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`ȡ����ȡ����ʧ��: ${taskId}, ����: ${message}`);
      return false;
    }
  }

  async retryScrapeTask(taskId: string): Promise<boolean> {
    try {
      await this.stateMachine.transitionState(taskId, BaseEvent.RETRY);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`������ȡ����ʧ��: ${taskId}, ����: ${message}`);
      return false;
    }
  }

  createScrapeResult(
    taskId: string,
    status: ScrapeStatus,
    title?: string,
    content?: string,
    links?: Array<{ url: string; text?: string; title?: string }>,
    metadata?: Record<string, unknown>,
  ): ScrapeResult {
    return ScrapeServiceCore.createScrapeResult(
      taskId,
      status,
      title,
      content,
      links,
      metadata,
    );
  }

  async getScrapeTaskStats(): Promise<Record<string, Record<string, number>>> {
    const tasks = await this.getAllScrapeTasks();
    const stats: Record<string, Record<string, number>> = {
      byStatus: {},
      byType: {},
      summary: { total: tasks.length },
    };

    for (const task of tasks) {
      stats.byStatus[task.status] = (stats.byStatus[task.status] || 0) + 1;
      stats.byType[task.taskType] = (stats.byType[task.taskType] || 0) + 1;
    }

    return stats;
  }

  async cleanupOldScrapeTasks(
    olderThanDays: number = 30,
  ): Promise<{ deleted: number }> {
    const tasks = await this.getAllScrapeTasks();
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    const expired = tasks.filter((task) => task.createdAt < cutoff);
    return { deleted: expired.length };
  }

  async logTaskEvent(
    taskId: string,
    event: BaseEvent,
    context?: Record<string, unknown>,
  ): Promise<void> {
    const task = await this.getScrapeTask(taskId);
    if (!task) return;

    const baseContext = this.toContext(task);
    const mergedContext: StateMachineContext = {
      ...baseContext,
      ...(context || {}),
    };

    await this.stateMachine.transitionState(taskId, event, mergedContext);
    this.logger.info(`��¼�����¼�: ${taskId}, �¼�: ${event}`);
  }

  async updateTaskProgress(taskId: string, progress: number): Promise<void> {
    const task = await this.getScrapeTask(taskId);
    if (!task) return;

    const context = this.toContext(task);
    context.progress = progress;

    await this.stateMachine.transitionState(
      taskId,
      BaseEvent.PROGRESS,
      context,
    );
    this.logger.info(`�����������: ${taskId}, ����: ${progress}%`);
  }

  async setTaskError(taskId: string, error: string): Promise<void> {
    const task = await this.getScrapeTask(taskId);
    if (!task) return;

    const context = this.toContext(task);
    context.error = error;

    await this.stateMachine.transitionState(taskId, BaseEvent.FAIL, context);
    this.logger.error(`�����������: ${taskId}, ����: ${error}`);
  }

  async getTaskLogs(
    taskId: string,
  ): Promise<Array<{ level: string; message: string; ts: number }>> {
    const task = await this.getScrapeTask(taskId);
    if (!task) return [];

    const logs =
      (task.context?.logs as Array<{
        level: string;
        message: string;
        ts: number;
      }>) || [];

    return logs;
  }

  async getTaskExecutionTime(taskId: string): Promise<{
    started: number;
    completed: number;
    duration: number;
  }> {
    const task = await this.getScrapeTask(taskId);
    if (!task) return { started: 0, completed: 0, duration: 0 };

    const started = task.startedAt || task.createdAt;
    const completed = task.completedAt || started;
    const duration = Math.max(0, completed - started);

    return { started, completed, duration };
  }
}
