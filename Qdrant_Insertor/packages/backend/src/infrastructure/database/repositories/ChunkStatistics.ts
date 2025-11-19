import type { FindOptionsWhere, FindManyOptions, DataSource } from 'typeorm';
import { BaseRepository } from './BaseRepository.js';
import { Chunk } from '../entities/Chunk.js';
import { Logger } from '@logging/logger.js';
import { DocId, CollectionId } from '@domain/entities/types.js';
import { DbSyncJobStatus } from '@domain/sync/SyncJobStatusMapper.js';

/**
 * 块统计功能
 * 提供各种统计和计数方法
 */
export class ChunkStatistics extends BaseRepository<Chunk> {
  constructor(dataSource: DataSource, logger: Logger) {
    super(dataSource, Chunk, logger);
  }

  /**
   * 获取块总数
   * @param docId - 文档ID过滤
   * @param collectionId - 集合ID过滤
   * @param options - 查询选项
   * @param options.status - 嵌入状态过滤
   * @param options.syncStatus - 同步状态过滤
   * @returns 块总数
   */
  async getCount(
    docId?: DocId,
    collectionId?: CollectionId,
    options: {
      status?: DbSyncJobStatus | string;
      syncStatus?: DbSyncJobStatus | string;
    } = {},
  ): Promise<number> {
    try {
      const queryBuilder = this.createQueryBuilder('chunk');

      if (docId) {
        queryBuilder.andWhere('chunk.docId = :docId', { docId });
      }

      if (collectionId) {
        queryBuilder.andWhere('chunk.collectionId = :collectionId', {
          collectionId,
        });
      }

      if (options.status) {
        queryBuilder.andWhere('chunk.embeddingStatus = :status', {
          status: options.status,
        });
      }

      if (options.syncStatus) {
        queryBuilder.andWhere('chunk.syncStatus = :syncStatus', {
          syncStatus: options.syncStatus,
        });
      }

      return await queryBuilder.getCount();
    } catch (error) {
      this.logger.error(`获取块总数失败`, {
        docId,
        collectionId,
        options,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据文档ID统计块数量
   * @param docId - 文档ID
   * @param options - 查询选项
   * @param options.status - 嵌入状态过滤
   * @param options.syncStatus - 同步状态过滤
   * @returns 块数量
   */
  async countByDocId(
    docId: DocId,
    options: {
      status?: DbSyncJobStatus | string;
      syncStatus?: DbSyncJobStatus | string;
    } = {},
  ): Promise<number> {
    try {
      const queryBuilder = this.createQueryBuilder('chunk').where(
        'chunk.docId = :docId',
        { docId },
      );

      if (options.status) {
        queryBuilder.andWhere('chunk.embeddingStatus = :status', {
          status: options.status,
        });
      }

      if (options.syncStatus) {
        queryBuilder.andWhere('chunk.syncStatus = :syncStatus', {
          syncStatus: options.syncStatus,
        });
      }

      return await queryBuilder.getCount();
    } catch (error) {
      this.logger.error(`统计文档块数量失败`, {
        docId,
        options,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据文档ID统计已完成块数量
   * @param docId - 文档ID
   * @returns 已完成块数量
   */
  async countCompletedByDocId(docId: DocId): Promise<number> {
    try {
      return await this.countByDocId(docId, {
        status: DbSyncJobStatus.COMPLETED,
        syncStatus: DbSyncJobStatus.COMPLETED,
      });
    } catch (error) {
      this.logger.error(`统计文档已完成块数量失败`, {
        docId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据文档ID统计失败块数量
   * @param docId - 文档ID
   * @returns 失败块数量
   */
  async countFailedByDocId(docId: DocId): Promise<number> {
    try {
      return await this.countByDocId(docId, {
        status: DbSyncJobStatus.FAILED,
        syncStatus: DbSyncJobStatus.FAILED,
      });
    } catch (error) {
      this.logger.error(`统计文档失败块数量失败`, {
        docId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 获取块统计信息
   * @param groupByOrOptions - 分组字段或选项对象
   * @param where - 查询条件
   * @returns 统计结果
   */
  async getStatistics(
    groupByOrOptions:
      | string
      | {
          collectionId?: CollectionId;
          docId?: DocId;
        },
    where?: FindOptionsWhere<Chunk>,
  ): Promise<
    | Record<string, number>
    | {
        total: number;
        pending: number;
        processing: number;
        completed: number;
        failed: number;
        totalTokens: number;
        avgContentLength: number;
      }
  > {
    // 如果调用的是旧的方法签名 (collectionId, docId)
    if (typeof groupByOrOptions === 'object' && where === undefined) {
      const collectionId = groupByOrOptions.collectionId;
      const docId = groupByOrOptions.docId;

      try {
        const queryBuilder = this.createQueryBuilder('chunk')
          .select('COUNT(*)', 'total')
          .addSelect(
            'SUM(CASE WHEN embeddingStatus = :pending THEN 1 ELSE 0 END)',
            'pending',
          )
          .addSelect(
            'SUM(CASE WHEN embeddingStatus = :processing THEN 1 ELSE 0 END)',
            'processing',
          )
          .addSelect(
            'SUM(CASE WHEN embeddingStatus = :completed THEN 1 ELSE 0 END)',
            'completed',
          )
          .addSelect(
            'SUM(CASE WHEN embeddingStatus = :failed THEN 1 ELSE 0 END)',
            'failed',
          )
          .addSelect('SUM(tokenCount)', 'totalTokens')
          .addSelect('AVG(contentLength)', 'avgContentLength')
          .setParameters({
            pending: 'pending',
            processing: 'processing',
            completed: 'completed',
            failed: 'failed',
          });

        if (collectionId) {
          queryBuilder.andWhere('chunk.collectionId = :collectionId', {
            collectionId,
          });
        }

        if (docId) {
          queryBuilder.andWhere('chunk.docId = :docId', { docId });
        }

        const result = await queryBuilder.getRawOne();

        // 处理空结果的情况
        if (!result) {
          return {
            total: 0,
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0,
            totalTokens: 0,
            avgContentLength: 0,
          };
        }

        return {
          total: parseInt(result.total, 10) || 0,
          pending: parseInt(result.pending, 10) || 0,
          processing: parseInt(result.processing, 10) || 0,
          completed: parseInt(result.completed, 10) || 0,
          failed: parseInt(result.failed, 10) || 0,
          totalTokens: parseInt(result.totalTokens, 10) || 0,
          avgContentLength: parseFloat(result.avgContentLength) || 0,
        };
      } catch (error) {
        this.logger.error('获取块统计信息失败', {
          collectionId,
          docId,
          error: (error as Error).message,
        });
        throw error;
      }
    }

    // 调用父类方法
    return super.getStatistics(groupByOrOptions as string, where);
  }
}
