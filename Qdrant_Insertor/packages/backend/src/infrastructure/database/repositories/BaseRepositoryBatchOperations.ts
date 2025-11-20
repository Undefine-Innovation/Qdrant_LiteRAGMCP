import {
  DataSource,
  EntityTarget,
  ObjectLiteral,
  Repository,
  In,
  DeepPartial,
  FindOptionsWhere,
  UpdateResult,
} from 'typeorm';
import { Logger } from '@logging/logger.js';

/**
 * BaseRepository批量操作功能
 * 提供批量操作相关功能
 */
export class BaseRepositoryBatchOperations<T extends ObjectLiteral> {
  /**
   * 创建BaseRepositoryBatchOperations实例
   * @param dataSource TypeORM数据源
   * @param entity 实体类
   * @param logger 日志记录器
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly entity: EntityTarget<T>,
    private readonly logger: Logger,
  ) {}

  /**
   * 获取Repository实例
   * @returns {Repository<T>} Repository实例
   */
  protected getRepository(): Repository<T> {
    return this.dataSource.getRepository(this.entity);
  }

  /**
   * 获取实体名称
   * @returns {string} 实体名称
   */
  private getEntityName(): string {
    if (typeof this.entity === 'string') return this.entity;
    if (typeof this.entity === 'function') return this.entity.name;
    return 'Unknown';
  }

  /**
   * 批量更新
   * @param ids ID数组
   * @param data 更新数据
   * @param batchSize 批次大小
   * @returns 批量操作结果
   */
  async updateBatch(
    ids: (string | number)[],
    data: DeepPartial<T>,
    batchSize = 100,
  ): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    if (!this.dataSource) throw new Error('DataSource not initialized');
    if (ids.length === 0) {
      return { success: 0, failed: 0, errors: [] };
    }

    let success = 0;
    let failed = 0;
    const errors: string[] = [];
    const totalBatches = Math.ceil(ids.length / batchSize);
    const updateFields = Object.keys(data as Record<string, unknown>);

    this.logger.debug(`开始批量更新操作`, {
      entityName: this.getEntityName(),
      totalItems: ids.length,
      batchSize,
      totalBatches,
      updateFields,
    });

    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;

      try {
        const startTime = Date.now();
        const whereCondition = {
          id: In(batch),
        } as unknown as FindOptionsWhere<T>;
        const result = (await this.getRepository()
          .createQueryBuilder()
          .update()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .set(data as unknown as any) // TypeORM 的 _QueryDeepPartialEntity 与我们的泛型类型系统不兼容
          .where(whereCondition)
          .execute()) as UpdateResult;
        const duration = Date.now() - startTime;

        const affectedCount = result.affected || 0;
        success += affectedCount;
        failed += batch.length - affectedCount;

        this.logger.debug(`批量更新批次完成`, {
          entityName: this.getEntityName(),
          batchNumber,
          totalBatches,
          batchSize: batch.length,
          affected: affectedCount,
          duration: `${duration}ms`,
          totalProcessed: success + failed,
          totalItems: ids.length,
          progress: `${Math.round(((success + failed) / ids.length) * 100)}%`,
        });

        if (affectedCount < batch.length) {
          this.logger.warn(`批量更新部分失败`, {
            entityName: this.getEntityName(),
            batchNumber,
            totalBatches,
            batchSize: batch.length,
            affected: affectedCount,
            failed: batch.length - affectedCount,
          });
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        failed += batch.length;
        errors.push(`批次 ${batchNumber}: ${message}`);

        this.logger.error(`批量更新批次失败`, {
          entityName: this.getEntityName(),
          batchNumber,
          totalBatches,
          batchSize: batch.length,
          error: message,
        });
      }
    }

    const result: { success: number; failed: number; errors: string[] } = {
      success,
      failed,
      errors: [],
    };
    if (errors.length > 0) {
      result.errors = errors;
    }

    this.logger.debug(`批量更新操作完成`, {
      entityName: this.getEntityName(),
      totalItems: ids.length,
      success,
      failed,
      successRate: `${Math.round((success / ids.length) * 100)}%`,
      updateFields,
    });

    return result;
  }

  /**
   * 批量软删除
   * @param ids ID数组
   * @param batchSize 批次大小
   * @returns 删除的记录数
   */
  async softDeleteBatch(
    ids: (string | number)[],
    batchSize = 100,
  ): Promise<number> {
    if (!this.dataSource) throw new Error('DataSource not initialized');
    if (ids.length === 0) {
      return 0;
    }

    let deletedCount = 0;
    const updateData = { deleted: true, deleted_at: new Date() };
    const totalBatches = Math.ceil(ids.length / batchSize);

    this.logger.debug(`开始批量软删除操作`, {
      entityName: this.getEntityName(),
      totalItems: ids.length,
      batchSize,
      totalBatches,
    });

    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;

      try {
        const startTime = Date.now();
        const whereCondition = {
          id: In(batch),
        } as unknown as FindOptionsWhere<T>;
        const result = (await this.getRepository()
          .createQueryBuilder()
          .update()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .set(updateData as unknown as any) // TypeORM 的 _QueryDeepPartialEntity 与我们的泛型类型系统不兼容
          .where(whereCondition)
          .execute()) as UpdateResult;
        const duration = Date.now() - startTime;

        const batchDeletedCount = result.affected || 0;
        deletedCount += batchDeletedCount;

        this.logger.debug(`批量软删除批次完成`, {
          entityName: this.getEntityName(),
          batchNumber,
          totalBatches,
          batchSize: batch.length,
          deleted: batchDeletedCount,
          duration: `${duration}ms`,
          totalProcessed: deletedCount,
          totalItems: ids.length,
          progress: `${Math.round((deletedCount / ids.length) * 100)}%`,
        });
      } catch (error) {
        this.logger.error(`批量软删除批次失败`, {
          entityName: this.getEntityName(),
          batchNumber,
          totalBatches,
          batchSize: batch.length,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.logger.debug(`批量软删除操作完成`, {
      entityName: this.getEntityName(),
      totalItems: ids.length,
      totalDeleted: deletedCount,
      successRate: `${Math.round((deletedCount / ids.length) * 100)}%`,
    });

    return deletedCount;
  }
}

