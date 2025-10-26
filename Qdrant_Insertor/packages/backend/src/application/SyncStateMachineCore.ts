import {
  SyncJobStatus,
  SyncJobEvent,
  SyncJob,
  SyncMachineContext,
} from '../domain/sync/types.js';
import { Logger } from '../logger.js';

/**
 * 同步状态机核心类
 * 负责管理状态转换逻辑和同步作业状态
 */
export class SyncStateMachineCore {
  private syncJobs: Map<string, SyncJob> = new Map();

  /**
   * 状态转换规则定义
   */
  private readonly stateTransitions: Map<
    SyncJobStatus,
    Map<SyncJobEvent, SyncJobStatus>
  > = new Map([
    [
      SyncJobStatus.NEW,
      new Map([
        [SyncJobEvent.CHUNKS_SAVED, SyncJobStatus.SPLIT_OK],
        [SyncJobEvent.ERROR, SyncJobStatus.FAILED],
      ]),
    ],
    [
      SyncJobStatus.SPLIT_OK,
      new Map([
        [SyncJobEvent.VECTORS_INSERTED, SyncJobStatus.EMBED_OK],
        [SyncJobEvent.ERROR, SyncJobStatus.FAILED],
      ]),
    ],
    [
      SyncJobStatus.EMBED_OK,
      new Map([
        [SyncJobEvent.META_UPDATED, SyncJobStatus.SYNCED],
        [SyncJobEvent.ERROR, SyncJobStatus.FAILED],
      ]),
    ],
    [
      SyncJobStatus.FAILED,
      new Map([
        [SyncJobEvent.RETRY, SyncJobStatus.RETRYING],
        [SyncJobEvent.RETRIES_EXCEEDED, SyncJobStatus.DEAD],
      ]),
    ],
    [
      SyncJobStatus.RETRYING,
      new Map([
        [SyncJobEvent.CHUNKS_SAVED, SyncJobStatus.SPLIT_OK],
        [SyncJobEvent.VECTORS_INSERTED, SyncJobStatus.EMBED_OK],
        [SyncJobEvent.META_UPDATED, SyncJobStatus.SYNCED],
        [SyncJobEvent.ERROR, SyncJobStatus.FAILED],
      ]),
    ],
    [SyncJobStatus.SYNCED, new Map()], // 终态
    [SyncJobStatus.DEAD, new Map()], // 终态
  ]);

  constructor(private readonly logger: Logger) {}

  /**
   * 创建或获取同步作业
   */
  public getOrCreateSyncJob(docId: string): SyncJob {
    let job = this.syncJobs.get(docId);
    if (!job) {
      job = {
        id: `sync_${docId}_${Date.now()}`,
        docId,
        status: SyncJobStatus.NEW,
        retries: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.syncJobs.set(docId, job);
    }
    return job;
  }

  /**
   * 更新同步作业状态
   */
  public updateSyncJob(
    docId: string,
    status: SyncJobStatus,
    error?: string,
  ): SyncJob {
    const job = this.getOrCreateSyncJob(docId);
    job.status = status;
    job.updatedAt = Date.now();
    if (error) {
      job.error = error;
    }
    if (status === SyncJobStatus.RETRYING) {
      job.retries += 1;
      job.lastAttemptAt = Date.now();
    }
    this.syncJobs.set(docId, job);
    return job;
  }

  /**
   * 状态转换方法
   */
  public transitionState(
    docId: string,
    event: SyncJobEvent,
    context?: Partial<SyncMachineContext>,
  ): boolean {
    const job = this.getOrCreateSyncJob(docId);
    const transitions = this.stateTransitions.get(job.status);

    if (!transitions) {
      this.logger.error(`[${docId}] 无效的状态: ${job.status}`);
      return false;
    }

    const newStatus = transitions.get(event);
    if (!newStatus) {
      this.logger.error(
        `[${docId}] 不允许的状态转换: ${job.status} + ${event}`,
      );
      return false;
    }

    this.updateSyncJob(docId, newStatus, context?.errorMessage);
    this.logger.info(
      `[${docId}] 状态转换: ${job.status} -> ${newStatus} (事件: ${event})`,
    );
    return true;
  }

  /**
   * 获取同步作业状态
   */
  public getSyncJobStatus(docId: string): SyncJob | undefined {
    return this.syncJobs.get(docId);
  }

  /**
   * 获取所有同步作业状态
   */
  public getAllSyncJobs(): SyncJob[] {
    return Array.from(this.syncJobs.values());
  }

  /**
   * 获取指定状态的同步作业数量
   */
  public getSyncJobCountByStatus(status: SyncJobStatus): number {
    return Array.from(this.syncJobs.values()).filter(
      (job) => job.status === status,
    ).length;
  }

  /**
   * 清理已完成的同步作业
   */
  public cleanupCompletedJobs(): void {
    const now = Date.now();
    const cleanupThreshold = 24 * 60 * 60 * 1000; // 24小时

    for (const [docId, job] of this.syncJobs.entries()) {
      if (
        (job.status === SyncJobStatus.SYNCED ||
          job.status === SyncJobStatus.DEAD) &&
        now - job.updatedAt > cleanupThreshold
      ) {
        this.syncJobs.delete(docId);
        this.logger.info(`清理已完成同步作业: ${docId}`);
      }
    }
  }
}
