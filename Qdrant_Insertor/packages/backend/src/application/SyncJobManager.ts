import { SQLiteRepo } from '../infrastructure/SQLiteRepo.js';
import { Logger } from '../logger.js';
import { DocId } from '../domain/types.js';
import { SyncJobStatus, SyncJob } from '../domain/sync/types.js';
import { ErrorCategory } from '../domain/sync/retry.js';

/**
 * 同步作业管理器
 * 负责管理同步作业的创建、更新和查询
 */
export class SyncJobManager {
  private readonly memoryJobs: Map<string, SyncJob> = new Map(); // 内存缓存

  constructor(
    private readonly sqliteRepo: SQLiteRepo,
    private readonly logger: Logger,
  ) {}

  /**
   * 获取或创建同步作业
   *
   * @param docId - 文档ID
   * @returns 同步作业实例
   */
  async getOrCreateSyncJob(docId: string): Promise<SyncJob> {
    // 首先检查内存缓存
    let job = this.memoryJobs.get(docId);

    if (!job) {
      // 从数据库获取
      job = this.sqliteRepo.syncJobs.getByDocId(docId) || undefined;

      if (!job) {
        // 创建新作业
        const newJob: Omit<SyncJob, 'id'> = {
          docId,
          status: SyncJobStatus.NEW,
          retries: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        const jobId = this.sqliteRepo.syncJobs.create(newJob);
        job = { ...newJob, id: jobId };
      }

      // 缓存到内存
      this.memoryJobs.set(docId, job);
    }

    return job;
  }

  /**
   * 更新作业状态
   *
   * @param docId - 文档ID
   * @param status - 新状态
   * @param error - 错误信息
   * @param additionalFields - 额外字段
   */
  async updateJobStatus(
    docId: string,
    status: SyncJobStatus,
    error?: string,
    additionalFields?: {
      started_at?: number;
      completed_at?: number;
      duration_ms?: number;
      error_category?: ErrorCategory;
      last_retry_strategy?: string;
      progress?: number;
      last_attempt_at?: number;
    },
  ): Promise<void> {
    const job = await this.getOrCreateSyncJob(docId);

    // 更新内存中的作业
    job.status = status;
    job.updatedAt = Date.now();
    if (error) {
      job.error = error;
    }
    if (status === SyncJobStatus.RETRYING) {
      job.retries += 1;
      job.lastAttemptAt = Date.now();
    }

    // 更新数据库
    this.sqliteRepo.syncJobs.update(job.id, {
      ...job,
      ...additionalFields,
    });

    // 更新内存缓存
    this.memoryJobs.set(docId, job);
  }

  /**
   * 获取同步作业状态
   *
   * @param docId - 文档ID
   * @returns 同步作业实例
   */
  getSyncJobStatus(docId: string): SyncJob | undefined {
    return this.memoryJobs.get(docId);
  }

  /**
   * 获取所有同步作业状态
   *
   * @returns 所有同步作业
   */
  getAllSyncJobs(): SyncJob[] {
    return Array.from(this.memoryJobs.values());
  }

  /**
   * 获取指定状态的同步作业数量
   *
   * @param status - 状态
   * @returns 作业数量
   */
  getSyncJobCountByStatus(status: SyncJobStatus): number {
    return Array.from(this.memoryJobs.values()).filter(
      (job) => job.status === status,
    ).length;
  }

  /**
   * 获取同步作业统计信息
   *
   * @returns 统计信息
   */
  getSyncJobStats() {
    return this.sqliteRepo.syncJobs.getStats();
  }

  /**
   * 清理已完成的同步作业
   *
   * @param daysToKeep - 保留天数
   */
  cleanupCompletedJobs(daysToKeep: number): number {
    // 清理内存中的已完成作业
    const now = Date.now();
    const cleanupThreshold = daysToKeep * 24 * 60 * 60 * 1000;

    for (const [docId, job] of this.memoryJobs.entries()) {
      if (
        (job.status === SyncJobStatus.SYNCED ||
          job.status === SyncJobStatus.DEAD) &&
        now - job.updatedAt > cleanupThreshold
      ) {
        this.memoryJobs.delete(docId);
        this.logger.info(`清理已完成同步作业: ${docId}`);
      }
    }

    // 清理数据库中的过期记录
    const cleanedCount = this.sqliteRepo.syncJobs.cleanup(daysToKeep);
    if (cleanedCount > 0) {
      this.logger.info(`清理了 ${cleanedCount} 个过期的同步作业记录`);
    }

    return cleanedCount;
  }
}
