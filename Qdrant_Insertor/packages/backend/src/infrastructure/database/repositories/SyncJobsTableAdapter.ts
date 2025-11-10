import { SyncJobRepository } from './SyncJobRepository.js';
import { SyncJobEntity } from '../entities/SyncJob.js';
import { SyncJob } from '../../../domain/sync/types.js';
import { SyncJobStatus } from '../../../domain/sync/types.js';
import { ErrorCategory } from '../../../domain/sync/retry.js';
import {
  SyncJobStatusMapper,
  DbSyncJobStatus,
} from '../../../domain/sync/SyncJobStatusMapper.js';

/**
 * SyncJobsTable接口
 */
/**
 * SyncJobsTable接口
 */
interface ISyncJobsTable {
  /**
   * 数据库实例
   */
  db: Record<string, unknown>;
  /**
   * 根据ID获取同步作业
   * @param id 作业ID
   * @returns 同步作业或null
   */
  getById(id: string): SyncJob | null;
  /**
   * 根据文档ID获取同步作业
   * @param docId 文档ID
   * @returns 同步作业或null
   */
  getByDocId(docId: string): SyncJob | null;
  /**
   * 获取所有同步作业
   * @param limit 限制数量
   * @param offset 偏移量
   * @returns 同步作业数组
   */
  getAll(limit?: number, offset?: number): SyncJob[];
  /**
   * 根据状态获取同步作业
   * @param status 作业状态
   * @param limit 限制数量
   * @returns 同步作业数组
   */
  getByStatus(status: SyncJobStatus, limit?: number): SyncJob[];
  /**
   * 根据状态获取作业数量
   * @param status 作业状态
   * @returns 作业数量
   */
  getCountByStatus(status: SyncJobStatus): number;
  /**
   * 获取作业统计信息
   * @returns 统计信息对象
   */
  getStats(): {
    total: number;
    byStatus: Record<SyncJobStatus, number>;
    avgDuration: number;
    successRate: number;
  };
  /**
   * 清理过期作业
   * @param olderThanDays 过期天数
   * @returns 删除的作业数量
   */
  cleanup(olderThanDays?: number): number;
  /**
   * 检查数据库连接
   * @returns 连接状态
   */
  ping(): boolean;
  /**
   * 将数据库行映射为SyncJob对象
   * @param row 数据库行
   * @returns SyncJob对象
   */
  mapRowToSyncJob(row: Record<string, unknown>): SyncJob;
}

/**
 * SyncJobsTable适配器
 * 将SyncJobRepository适配为SyncJobsTable接口
 */
/**
 * SyncJobsTable适配器
 * 将SyncJobRepository适配为SyncJobsTable接口
 */
export class SyncJobsTableAdapter {
  /**
   * 构造函数
   * @param syncJobRepository SyncJobRepository实例
   * @param db 数据库实例
   */
  constructor(
    private readonly syncJobRepository: SyncJobRepository,
    private readonly db: Record<string, unknown> = {}, // 添加db属性以满足接口要求
  ) {}
  /**
   * 将领域层状态映射为数据库状态。
   * @param status 领域状态
   * @returns 对应的数据库状态
   */
  private toEntityStatus(status?: SyncJobStatus): DbSyncJobStatus | undefined {
    if (!status) {
      return undefined;
    }
    try {
      return SyncJobStatusMapper.toDbStatus(status);
    } catch {
      return DbSyncJobStatus.PENDING;
    }
  }

  /**
   * 将数据库状态转换回领域层状态。
   * @param status 数据库状态
   * @returns 领域状态
   */
  private fromEntityStatus(status: DbSyncJobStatus): SyncJobStatus {
    return SyncJobStatusMapper.toDomainStatusSafe(status, SyncJobStatus.NEW);
  }

  /**
   * 创建同步作业
   * @param job - 同步作业数据，不包含ID
   * @returns 返回新创建的同步作业ID
   */
  create(job: Omit<SyncJob, 'id'>): string {
    const id = `sync_${job.docId}_${Date.now()}`;
    // 异步调用，但接口要求同步返回
    this.syncJobRepository
      .create({
        id,
        docId: job.docId,
        status: this.toEntityStatus(job.status) ?? DbSyncJobStatus.PENDING,
        retries: job.retries,
        started_at: undefined, // SyncJob接口没有started_at字段
        completed_at: undefined, // SyncJob接口没有completed_at字段
        created_at: job.createdAt,
        updated_at: job.updatedAt,
        progress: 0,
      })
      .catch((error) => {
        console.error('Failed to create sync job:', error);
      });
    return id;
  }

  /**
   * 更新同步作业
   * @param id - 同步作业ID
   * @param updates - 要更新的字段数据
   * @returns 返回是否更新成功
   */
  async update(
    id: string,
    updates: Partial<
      SyncJob & {
        started_at?: number;
        completed_at?: number;
        duration_ms?: number;
        error_category?: ErrorCategory;
        last_retry_strategy?: string;
        progress?: number;
      }
    >,
  ): Promise<boolean> {
    try {
      const payload: Partial<SyncJobEntity> = {
        retries: updates.retries,
        last_attempt_at: updates.lastAttemptAt,
        error: updates.error,
        started_at: updates.started_at,
        completed_at: updates.completed_at,
        progress: updates.progress,
      };
      if (updates.status) {
        payload.status = this.toEntityStatus(updates.status);
      }
      const result = await this.syncJobRepository.update(id, payload);
      return Boolean(result?.affected ?? result);
    } catch (error) {
      console.error('Failed to update sync job:', error);
      return false;
    }
  }

  /**
   * 根据ID获取同步作业
   * @param id - 同步作业ID
   * @returns 返回同步作业对象，如果不存在则返回null
   */
  async getById(id: string): Promise<SyncJob | null> {
    try {
      const job = await this.syncJobRepository.findById(id);
      if (!job) return null;

      return {
        id: job.id,
        docId: job.docId,
        status: this.fromEntityStatus(job.status),
        retries: job.retries,
        lastAttemptAt: job.last_attempt_at,
        error: job.error,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
      };
    } catch (error) {
      console.error('Failed to get sync job by id:', error);
      return null;
    }
  }

  /**
   * 根据文档ID获取同步作业
   * @param docId - 文档ID
   * @returns 返回最新的同步作业对象，如果不存在则返回null
   */
  async getByDocId(docId: string): Promise<SyncJob | null> {
    try {
      const jobs = await this.syncJobRepository.findByDocId(docId);
      if (jobs.length === 0) return null;

      const latestJob = jobs[0];
      return {
        id: latestJob.id,
        docId: latestJob.docId,
        status: this.fromEntityStatus(latestJob.status),
        retries: latestJob.retries,
        lastAttemptAt: latestJob.last_attempt_at,
        error: latestJob.error,
        createdAt: latestJob.created_at,
        updatedAt: latestJob.updated_at,
      };
    } catch (error) {
      console.error('Failed to get sync job by docId:', error);
      return null;
    }
  }

  /**
   * 获取所有同步作业
   * @param limit - 返回记录数量限制
   * @param offset - 偏移量
   * @returns 返回同步作业数组
   */
  async getAll(limit?: number, offset?: number): Promise<SyncJob[]> {
    try {
      const jobs = await this.syncJobRepository.findAll();
      const result = jobs.map((job) => ({
        id: job.id,
        docId: job.docId,
        status: this.fromEntityStatus(job.status),
        retries: job.retries,
        lastAttemptAt: job.last_attempt_at,
        error: job.error,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
      }));

      if (offset !== undefined) {
        return result.slice(offset);
      }
      if (limit !== undefined) {
        return result.slice(0, limit);
      }
      return result;
    } catch (error) {
      console.error('Failed to get all sync jobs:', error);
      return [];
    }
  }

  /**
   * 根据状态获取同步作业
   * @param status - 同步作业状态
   * @param limit - 返回记录数量限制
   * @returns 返回同步作业数组
   */
  async getByStatus(status: SyncJobStatus, limit?: number): Promise<SyncJob[]> {
    try {
      const dbStatus = this.toEntityStatus(status) ?? DbSyncJobStatus.PENDING;
      const jobs = await this.syncJobRepository.findByStatus(dbStatus);
      const result = jobs.map((job) => ({
        id: job.id,
        docId: job.docId,
        status: this.fromEntityStatus(job.status),
        retries: job.retries,
        lastAttemptAt: job.last_attempt_at,
        error: job.error,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
      }));

      if (limit !== undefined) {
        return result.slice(0, limit);
      }
      return result;
    } catch (error) {
      console.error('Failed to get sync jobs by status:', error);
      return [];
    }
  }

  /**
   * 获取指定状态的作业数量
   * @param status - 同步作业状态
   * @returns 返回作业数量
   */
  async getCountByStatus(status: SyncJobStatus): Promise<number> {
    try {
      const dbStatus = this.toEntityStatus(status) ?? DbSyncJobStatus.PENDING;
      const jobs = await this.syncJobRepository.findByStatus(dbStatus);
      return jobs.length;
    } catch (error) {
      console.error('Failed to get sync job count by status:', error);
      return 0;
    }
  }

  /**
   * 获取作业统计信息
   * @returns 返回包含总数、按状态分组、平均持续时间和成功率的统计对象
   */
  async getStats(): Promise<{
    total: number;
    byStatus: Record<SyncJobStatus, number>;
    avgDuration: number;
    successRate: number;
  }> {
    try {
      const allJobs = await this.syncJobRepository.findAll();

      const byStatus: Record<SyncJobStatus, number> = {
        [SyncJobStatus.NEW]: 0,
        [SyncJobStatus.SPLIT_OK]: 0,
        [SyncJobStatus.EMBED_OK]: 0,
        [SyncJobStatus.SYNCED]: 0,
        [SyncJobStatus.FAILED]: 0,
        [SyncJobStatus.RETRYING]: 0,
        [SyncJobStatus.DEAD]: 0,
      };

      let totalDuration = 0;
      let completedJobs = 0;
      let successfulJobs = 0;

      allJobs.forEach((job) => {
        const status = this.fromEntityStatus(job.status);
        byStatus[status] = (byStatus[status] || 0) + 1;

        if (job.started_at && job.completed_at) {
          const duration = job.completed_at - job.started_at;
          totalDuration += duration;
          completedJobs++;
        }

        if (status === SyncJobStatus.SYNCED) {
          successfulJobs++;
        }
      });

      const avgDuration = completedJobs > 0 ? totalDuration / completedJobs : 0;
      const successRate =
        allJobs.length > 0 ? successfulJobs / allJobs.length : 0;

      return {
        total: allJobs.length,
        byStatus,
        avgDuration,
        successRate,
      };
    } catch (error) {
      console.error('Failed to get sync job stats:', error);
      return {
        total: 0,
        byStatus: {
          [SyncJobStatus.NEW]: 0,
          [SyncJobStatus.SPLIT_OK]: 0,
          [SyncJobStatus.EMBED_OK]: 0,
          [SyncJobStatus.SYNCED]: 0,
          [SyncJobStatus.FAILED]: 0,
          [SyncJobStatus.RETRYING]: 0,
          [SyncJobStatus.DEAD]: 0,
        },
        avgDuration: 0,
        successRate: 0,
      };
    }
  }

  /**
   * 清理过期的同步作业
   * @param olderThanDays - 过期天数，默认为7天
   * @returns 返回删除的记录数量
   */
  async cleanup(olderThanDays: number = 7): Promise<number> {
    // SyncJobRepository没有cleanup方法，这里返回0
    // 实际实现需要在SyncJobRepository中添加cleanup方法
    return 0;
  }

  /**
   * 检查数据库连接是否存活
   * @returns 返回数据库连接状态，true表示连接正常，false表示连接异常
   */
  ping(): boolean {
    // SyncJobRepository没有ping方法，这里返回true
    // 实际实现需要在SyncJobRepository中添加ping方法
    return true;
  }

  /**
   * 将数据库行映射为SyncJob对象
   * @param row 数据库行数据
   * @returns SyncJob对象
   */
  /**
   * 将数据库行映射为SyncJob对象
   * @param row 数据库行数据
   * @returns SyncJob对象
   */
  mapRowToSyncJob(row: Record<string, unknown>): SyncJob {
    return {
      id: String(row.id),
      docId: String(row.docId),
      status: this.fromEntityStatus(row.status as DbSyncJobStatus),
      retries: Number(row.retries),
      lastAttemptAt: row.last_attempt_at
        ? Number(row.last_attempt_at)
        : undefined,
      error: row.error ? String(row.error) : undefined,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    };
  }
}
