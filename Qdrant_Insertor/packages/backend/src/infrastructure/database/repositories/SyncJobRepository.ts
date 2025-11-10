import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { SyncJobEntity } from '../entities/SyncJob.js';
import { DbSyncJobStatus } from '@domain/sync/SyncJobStatusMapper.js';
import { BaseRepository } from './BaseRepository.js';

/**
 * SyncJob Repository实现
 * 继承BaseRepository，提供SyncJob特定的数据库操作
 */
export class SyncJobRepository extends BaseRepository<SyncJobEntity> {
  /**
   * 创建SyncJobRepository实例
   * @param dataSource TypeORM数据源
   * @param logger 日志记录器
   */
  constructor(dataSource: DataSource, logger: Logger) {
    super(dataSource, SyncJobEntity, logger);
  }

  /**
   * 根据状态查找同步任务
   * @param status 任务状态
   * @returns 同步任务数组
   */
  async findByStatus(status: DbSyncJobStatus): Promise<SyncJobEntity[]> {
    try {
      const results = await this.repository.find({
        where: { status },
      });
      return results;
    } catch (error) {
      this.logger.error(`根据状态查找同步任务失败`, {
        status,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据状态查找同步任务 (别名方法，用于兼容旧接口)
   * @param status 任务状态
   * @returns 同步任务数组
   */
  async getByStatus(status: DbSyncJobStatus): Promise<SyncJobEntity[]> {
    return this.findByStatus(status);
  }

  /**
   * 根据文档ID查找同步任务
   * @param docId 文档ID
   * @returns 同步任务数组
   */
  async findByDocId(docId: string): Promise<SyncJobEntity[]> {
    try {
      const results = await this.repository.find({
        where: { docId },
      });
      return results;
    } catch (error) {
      this.logger.error(`根据文档ID查找同步任务失败`, {
        docId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 查找正在运行的任务
   * @returns 正在运行的任务数组
   */
  async findRunningJobs(): Promise<SyncJobEntity[]> {
    try {
      const results = await this.repository.find({
        where: {
          status: DbSyncJobStatus.PROCESSING,
        },
      });
      return results;
    } catch (error) {
      this.logger.error(`查找正在运行的任务失败`, {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 更新任务状态
   * @param id 任务ID
   * @param status 新状态
   * @returns 更新后的任务
   */
  async updateStatus(
    id: string,
    status: DbSyncJobStatus,
  ): Promise<SyncJobEntity | null> {
    try {
      await this.repository.update(id, { status });
      const result = await this.findById(id);
      if (result) {
        this.logger.debug(`更新任务状态成功`, {
          id,
          status,
        });
      }
      return result;
    } catch (error) {
      this.logger.error(`更新任务状态失败`, {
        id,
        status,
        error: (error as Error).message,
      });
      throw error;
    }
  }
}
