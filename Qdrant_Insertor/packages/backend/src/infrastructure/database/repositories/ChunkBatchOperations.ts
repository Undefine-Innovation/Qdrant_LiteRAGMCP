import { In, DataSource } from 'typeorm';
import { BaseRepository, BatchOperationResult } from './BaseRepository.js';
import { Chunk } from '../entities/Chunk.js';
import { Logger } from '@logging/logger.js';
import { DocId, CollectionId, PointId } from '@domain/entities/types.js';
import { DbSyncJobStatus } from '@domain/sync/SyncJobStatusMapper.js';

/**
 * 块批量操作功能
 * 提供批量创建、删除和状态更新功能
 */
export class ChunkBatchOperations extends BaseRepository<Chunk> {
  constructor(dataSource: DataSource, logger: Logger) {
    super(dataSource, Chunk, logger);
  }

  /**
   * 批量创建块
   */
  async createBatch(chunks: Partial<Chunk>[]): Promise<Chunk[]> {
    try {
      // 预处理块数据，计算内容长度
      const processedChunks = chunks.map((chunk) => ({
        ...chunk,
        contentLength: chunk.content ? chunk.content.length : 0,
      }));

      const results = await super.createBatch(processedChunks, 100);
      this.logger.debug(`批量创建块成功`, {
        count: results.length,
      });
      return results;
    } catch (error) {
      this.logger.error(`批量创建块失败`, {
        count: chunks.length,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据文档ID删除块
   */
  async deleteByDocId(docId: DocId): Promise<number> {
    try {
      const result = await this.repository.delete({ docId });
      const deletedCount = result.affected || 0;
      this.logger.debug(`根据文档ID删除块成功`, {
        docId,
        count: deletedCount,
      });
      return deletedCount;
    } catch (error) {
      this.logger.error(`根据文档ID删除块失败`, {
        docId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据集合ID删除块
   */
  async deleteByCollectionId(collectionId: CollectionId): Promise<number> {
    try {
      const result = await this.repository.delete({ collectionId });
      const deletedCount = result.affected || 0;
      this.logger.debug(`根据集合ID删除块成功`, {
        collectionId,
        count: deletedCount,
      });
      return deletedCount;
    } catch (error) {
      this.logger.error(`根据集合ID删除块失败`, {
        collectionId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据点ID数组删除块
   */
  async deleteByPointIds(
    pointIds: PointId[],
    batchSize: number = 100,
  ): Promise<number> {
    try {
      if (pointIds.length === 0) {
        return 0;
      }

      let totalDeleted = 0;

      for (let i = 0; i < pointIds.length; i += batchSize) {
        const batch = pointIds.slice(i, i + batchSize);
        const result = await this.repository.delete({
          pointId: In(batch),
        });
        const deletedCount = result.affected || 0;
        totalDeleted += deletedCount;

        this.logger.debug(`批量删除块批次完成`, {
          batch: Math.floor(i / batchSize) + 1,
          batchSize: batch.length,
          deleted: deletedCount,
        });
      }

      this.logger.debug(`批量删除块完成`, {
        requested: pointIds.length,
        deleted: totalDeleted,
      });
      return totalDeleted;
    } catch (error) {
      this.logger.error(`批量删除块失败`, {
        pointIds,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 批量更新块状态
   */
  async batchUpdateStatus(
    pointIds: PointId[],
    status: DbSyncJobStatus | string,
  ): Promise<BatchOperationResult> {
    try {
      const result = await this.updateBatch(pointIds, {
         
        // TypeORM requires explicit casting for enum compatibility with DeepPartial
        embeddingStatus: status as any,
      });

      this.logger.debug(`批量更新块状态完成`, {
        requested: pointIds.length,
        updated: result.success,
        failed: result.failed,
        status,
      });
      return result;
    } catch (error) {
      this.logger.error(`批量更新块状态失败`, {
        pointIds,
        status,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 批量更新同步状态
   */
  async batchUpdateSyncStatus(
    pointIds: PointId[],
    syncStatus: DbSyncJobStatus | string,
  ): Promise<BatchOperationResult> {
    try {
      const result = await this.updateBatch(pointIds, {
         
        // TypeORM requires explicit casting for enum compatibility with DeepPartial
        syncStatus: syncStatus as any,
      });

      this.logger.debug(`批量更新块同步状态完成`, {
        requested: pointIds.length,
        updated: result.success,
        failed: result.failed,
        syncStatus,
      });
      return result;
    } catch (error) {
      this.logger.error(`批量更新块同步状态失败`, {
        pointIds,
        syncStatus,
        error: (error as Error).message,
      });
      throw error;
    }
  }
}
