import { DataSource } from 'typeorm';
import { BaseRepository, BatchOperationResult } from './BaseRepository.js';
import { Doc } from '../entities/Doc.js';
import { Logger } from '@logging/logger.js';
import { DocId } from '@domain/entities/types.js';

/**
 * 简化的文档批量操作功能
 * 提供批量创建、删除和状态更新功能
 */
export class SimplifiedDocBatchOperations extends BaseRepository<Doc> {
  constructor(dataSource: DataSource, logger: Logger) {
    super(dataSource, Doc, logger);
  }

  /**
   * 批量创建文档
   * @param docs - 要创建的文档数组
   * @param batchSize - 每批处理的文档数量，默认50
   * @returns 创建的文档数组
   */
  async createBatch(
    docs: Partial<Doc>[],
    batchSize: number = 50,
  ): Promise<Doc[]> {
    try {
      const results: Doc[] = [];

      // 分批处理以避免内存问题
      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = docs.slice(i, i + batchSize);

        // 添加默认值
        const processedBatch = batch.map((doc) => ({
          ...doc,
          status: doc.status || 'new',
          deleted: doc.deleted ?? false,
          created_at: doc.created_at || Date.now(),
          updated_at: doc.updated_at || Date.now(),
        }));

        const batchResults = await this.repository.save(processedBatch);
        results.push(...batchResults);

        this.logger.debug(`批量创建文档批次完成`, {
          batch: Math.floor(i / batchSize) + 1,
          batchSize: batch.length,
          totalProcessed: results.length,
        });
      }

      this.logger.info(`批量创建文档完成`, {
        totalRequested: docs.length,
        totalCreated: results.length,
      });

      return results;
    } catch (error) {
      this.logger.error(`批量创建文档失败`, {
        count: docs.length,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 批量软删除文档
   * @param ids - 要删除的文档ID数组
   * @returns 删除的文档数量
   */
  async batchSoftDelete(ids: DocId[]): Promise<number> {
    try {
      const result = await this.repository
        .createQueryBuilder()
        .update(Doc)
        .set({
          deleted: true,
          deleted_at: Date.now(),
          updated_at: Date.now(),
        })
        .where('docId IN (:...ids)', { ids })
        .execute();

      const deletedCount = result.affected || 0;

      this.logger.debug(`批量软删除文档完成`, {
        requested: ids.length,
        deleted: deletedCount,
      });

      return deletedCount;
    } catch (error) {
      this.logger.error(`批量软删除文档失败`, {
        ids,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 批量恢复文档
   * @param ids - 要恢复的文档ID数组
   * @returns 恢复的文档数量
   */
  async batchRestore(ids: DocId[]): Promise<number> {
    try {
      const result = await this.repository
        .createQueryBuilder()
        .update(Doc)
        .set({
          deleted: false,
          deleted_at: undefined,
          updated_at: Date.now(),
        })
        .where('docId IN (:...ids)', { ids })
        .execute();

      const restoredCount = result.affected || 0;

      this.logger.debug(`批量恢复文档完成`, {
        requested: ids.length,
        restored: restoredCount,
      });

      return restoredCount;
    } catch (error) {
      this.logger.error(`批量恢复文档失败`, {
        ids,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 批量更新文档状态
   * @param ids - 要更新的文档ID数组
   * @param status - 新的状态值
   * @returns 批量操作结果
   */
  async batchUpdateStatus(
    ids: DocId[],
    status: 'new' | 'processing' | 'completed' | 'failed',
  ): Promise<BatchOperationResult> {
    try {
      const result = await this.repository
        .createQueryBuilder()
        .update(Doc)
        .set({
          status,
          updated_at: Date.now(),
        })
        .where('docId IN (:...ids)', { ids })
        .execute();

      const updatedCount = result.affected || 0;
      const failedCount = ids.length - updatedCount;

      const batchResult: BatchOperationResult = {
        success: updatedCount,
        failed: failedCount,
      };

      this.logger.debug(`批量更新文档状态完成`, {
        requested: ids.length,
        updated: updatedCount,
        failed: failedCount,
        status,
      });

      return batchResult;
    } catch (error) {
      this.logger.error(`批量更新文档状态失败`, {
        ids,
        status,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 批量更新文档信息
   * @param updates - 更新信息数组，包含文档ID和要更新的数据
   * @returns 批量操作结果
   */
  async batchUpdateInfo(
    updates: Array<{
      id: DocId;
      data: Partial<Pick<Doc, 'name' | 'mime' | 'size_bytes'>>;
    }>,
  ): Promise<BatchOperationResult> {
    try {
      let successCount = 0;
      let failedCount = 0;
      const errors: Array<{ id: string; error: string }> = [];

      // 逐个更新以确保错误处理
      for (const update of updates) {
        try {
          const result = await this.repository
            .createQueryBuilder()
            .update(Doc)
            .set({
              ...update.data,
              updated_at: Date.now(),
            })
            .where('docId = :id', { id: update.id })
            .execute();

          if (result.affected && result.affected > 0) {
            successCount++;
          } else {
            failedCount++;
            errors.push({
              id: update.id,
              error: 'Document not found',
            });
          }
        } catch (error) {
          failedCount++;
          errors.push({
            id: update.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const batchResult: BatchOperationResult = {
        success: successCount,
        failed: failedCount,
        errors,
      };

      this.logger.debug(`批量更新文档信息完成`, {
        requested: updates.length,
        updated: successCount,
        failed: failedCount,
      });

      return batchResult;
    } catch (error) {
      this.logger.error(`批量更新文档信息失败`, {
        updates,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 批量删除文档（硬删除）
   * @param ids - 要删除的文档ID数组
   * @returns 删除的文档数量
   */
  async batchHardDelete(ids: DocId[]): Promise<number> {
    try {
      const result = await this.repository
        .createQueryBuilder()
        .delete()
        .from(Doc)
        .where('docId IN (:...ids)', { ids })
        .execute();

      const deletedCount = result.affected || 0;

      this.logger.debug(`批量硬删除文档完成`, {
        requested: ids.length,
        deleted: deletedCount,
      });

      return deletedCount;
    } catch (error) {
      this.logger.error(`批量硬删除文档失败`, {
        ids,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 批量清理过期文档
   * @param olderThanDays - 删除多少天前更新的文档，默认30天
   * @param status - 可选的状态过滤器
   * @returns 删除的文档数量
   */
  async cleanupExpiredDocuments(
    olderThanDays: number = 30,
    status?: 'new' | 'processing' | 'completed' | 'failed',
  ): Promise<number> {
    try {
      const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

      let query = this.repository
        .createQueryBuilder()
        .delete()
        .from(Doc)
        .where('updated_at < :cutoffTime', { cutoffTime })
        .andWhere('deleted = true');

      if (status) {
        query = query.andWhere('status = :status', { status });
      }

      const result = await query.execute();
      const deletedCount = result.affected || 0;

      this.logger.debug(`清理过期文档完成`, {
        olderThanDays,
        status,
        deleted: deletedCount,
      });

      return deletedCount;
    } catch (error) {
      this.logger.error(`清理过期文档失败`, {
        olderThanDays,
        status,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
