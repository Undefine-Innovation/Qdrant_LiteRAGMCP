import { In, DataSource } from 'typeorm';
import { BaseRepository, BatchOperationResult } from './BaseRepository.js';
import { Chunk } from '../entities/Chunk.js';
import { Logger } from '@logging/logger.js';
import { DocId, CollectionId, PointId } from '@domain/entities/types.js';
import { DbSyncJobStatus } from '@domain/sync/SyncJobStatusMapper.js';
import {
  BatchOperationManager,
  BatchOperationConfig,
  BatchOperationProcessor,
  BatchOperationProgress,
} from './BatchOperationManager.js';

/**
 * 块批量操作功能
 * 提供批量创建、删除和状态更新功能
 * 优化了性能和内存使用
 */
export class ChunkBatchOperations extends BaseRepository<Chunk> {
  private readonly batchManager: BatchOperationManager;

  constructor(dataSource: DataSource, logger: Logger) {
    super(dataSource, Chunk, logger);
    this.batchManager = new BatchOperationManager(logger);
  }

  /**
   * 批量创建块
   * 使用优化的批量操作管理器，支持并发处理和内存管理
   * @param chunks - 要创建的块数据数组
   * @param config - 批量操作配置
   * @returns 创建的块数组
   */
  async createBatchWithConfig(
    chunks: Partial<Chunk>[],
    config?: BatchOperationConfig,
  ): Promise<Chunk[]> {
    try {
      // 预处理块数据，计算内容长度
      const processedChunks = chunks.map((chunk) => ({
        ...chunk,
        contentLength: chunk.content ? chunk.content.length : 0,
      }));

      // 创建批量操作处理器
      const processor: BatchOperationProcessor<Partial<Chunk>, Chunk[]> = {
        processBatch: async (batch, batchNumber) => {
          this.logger.debug(`开始创建块批次`, {
            batchNumber,
            batchSize: batch.length,
          });

          // 使用BaseRepository的优化批量创建方法
          const results = await super.createBatch(batch, batch.length);
          return results;
        },
        getBatchSize: () => config?.batchSize || 50,
      };

      // 执行批量操作
      const { results, operationResult, progress } =
        await this.batchManager.executeBatchOperation(
          processedChunks,
          processor,
          {
            batchSize: config?.batchSize || 50, // 块数据通常较大，使用较小的批次
            maxConcurrentBatches: config?.maxConcurrentBatches || 2,
            enableProgressMonitoring: config?.enableProgressMonitoring ?? true,
            onProgress: (progressInfo) => {
              this.logger.debug(`块创建进度`, {
                operationId: progressInfo.operationId,
                processed: progressInfo.processedItems,
                total: progressInfo.totalItems,
                progress: `${Math.round((progressInfo.processedItems / progressInfo.totalItems) * 100)}%`,
                status: progressInfo.status,
              });

              // 调用用户提供的进度回调
              if (config?.onProgress) {
                config.onProgress(progressInfo);
              }
            },
          },
        );

      // 展平结果数组，因为executeBatchOperation返回的是Chunk[][]
      const flattenedResults: Chunk[] = [];
      for (const result of results) {
        if (Array.isArray(result)) {
          flattenedResults.push(...result);
        } else {
          flattenedResults.push(result);
        }
      }

      this.logger.info(`批量创建块完成`, {
        operationId: progress.operationId,
        totalRequested: chunks.length,
        totalCreated: flattenedResults.length,
        successful: operationResult.success,
        failed: operationResult.failed,
        duration: `${Date.now() - progress.startTime}ms`,
        successRate: `${Math.round((operationResult.success / chunks.length) * 100)}%`,
      });

      return flattenedResults;
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
   * @param docId - 文档ID
   * @returns 删除的块数量
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
   * @param collectionId - 集合ID
   * @returns 删除的块数量
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
   * @param pointIds - 点ID数组
   * @param batchSize - 批次大小
   * @returns 删除的块数量
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
   * @param pointIds - 点ID数组
   * @param status - 新的状态
   * @returns 批量操作结果
   */
  async batchUpdateStatus(
    pointIds: PointId[],
    status: DbSyncJobStatus | string,
  ): Promise<BatchOperationResult> {
    try {
      const result = await this.updateBatch(pointIds, {
        // TypeORM requires explicit casting for enum compatibility with DeepPartial
        embeddingStatus: status as
          | 'pending'
          | 'processing'
          | 'completed'
          | 'failed',
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
   * @param pointIds - 点ID数组
   * @param syncStatus - 新的同步状态
   * @returns 批量操作结果
   */
  async batchUpdateSyncStatus(
    pointIds: PointId[],
    syncStatus: DbSyncJobStatus | string,
  ): Promise<BatchOperationResult> {
    try {
      const result = await this.updateBatch(pointIds, {
        // TypeORM requires explicit casting for enum compatibility with DeepPartial
        syncStatus: syncStatus as
          | 'pending'
          | 'processing'
          | 'completed'
          | 'failed',
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
