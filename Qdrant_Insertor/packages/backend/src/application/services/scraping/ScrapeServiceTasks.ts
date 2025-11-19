import { Logger } from '@logging/logger.js';
import { ScrapeConfig, ScrapeStatus } from '@domain/entities/scrape.js';
import {
  BaseEvent,
  IStateMachineEngine,
  StateMachineTask,
} from '@domain/state-machine/types.js';
import { ScrapeServiceOperations } from './ScrapeServiceOperations.js';

/**
 * ������ȡ����������
 * �����������йصķ���
 */
export class ScrapeServiceTasks extends ScrapeServiceOperations {
  constructor(stateMachine: IStateMachineEngine, logger: Logger) {
    super(stateMachine, logger);
  }

  async batchUpdateTaskStatus(
    taskIds: string[],
    status: ScrapeStatus,
  ): Promise<number> {
    let updated = 0;
    for (const taskId of taskIds) {
      const task = await this.getScrapeTask(taskId);
      if (!task) continue;

      await this.logTaskEvent(taskId, BaseEvent.PROGRESS, { status });
      updated += 1;
    }

    this.logger.info(`������������״̬��ɣ������� ${updated} ������`);
    return updated;
  }

  async batchCancelTasks(taskIds: string[]): Promise<number> {
    let cancelled = 0;
    for (const taskId of taskIds) {
      if (await this.cancelScrapeTask(taskId)) {
        cancelled += 1;
      }
    }
    return cancelled;
  }

  async batchDeleteScrapeResults(taskIds: string[]): Promise<number> {
    const affected = await this.batchCancelTasks(taskIds);
    this.logger.info(`����ɾ��ץȡ����: ${affected} ��`);
    return affected;
  }

  async getTasksExecutionTime(taskIds: string[]): Promise<
    Array<{
      taskId: string;
      started: number;
      completed: number;
      duration: number;
    }>
  > {
    const results = [];
    for (const taskId of taskIds) {
      const stats = await this.getTaskExecutionTime(taskId);
      results.push({ taskId, ...stats });
    }
    return results;
  }

  async getTasksErrorStats(taskIds: string[]): Promise<Record<string, number>> {
    const errorStats: Record<string, number> = {};
    for (const taskId of taskIds) {
      const task = await this.getScrapeTask(taskId);
      const error = task?.context?.error as string | undefined;
      if (!error) continue;
      errorStats[error] = (errorStats[error] || 0) + 1;
    }
    return errorStats;
  }

  async getTasksProgressStats(
    taskIds: string[],
  ): Promise<Record<string, number>> {
    const stats: Record<string, number> = {
      notStarted: 0,
      inProgress: 0,
      completed: 0,
      failed: 0,
    };

    for (const taskId of taskIds) {
      const task = await this.getScrapeTask(taskId);
      if (!task) continue;

      if (task.status === ScrapeStatus.FAILED) {
        stats.failed += 1;
        continue;
      }

      const progress = (task.context?.progress as number | undefined) || 0;
      if (progress === 0) {
        stats.notStarted += 1;
      } else if (progress >= 100) {
        stats.completed += 1;
      } else {
        stats.inProgress += 1;
      }
    }

    return stats;
  }
}
