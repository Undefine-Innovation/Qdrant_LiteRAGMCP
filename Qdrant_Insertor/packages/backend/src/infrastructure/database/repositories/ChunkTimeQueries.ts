import type { FindManyOptions, DataSource } from 'typeorm';
import { BaseRepository } from './BaseRepository.js';
import { Chunk } from '../entities/Chunk.js';
import { Logger } from '@logging/logger.js';
import { DocId, CollectionId } from '@domain/entities/types.js';
import { DbSyncJobStatus } from '@domain/sync/SyncJobStatusMapper.js';

type ChunkTimeRangeQueryOptions = {
  collectionId?: CollectionId;
  docId?: DocId;
  status?: DbSyncJobStatus | string;
  syncStatus?: DbSyncJobStatus | string;
  limit?: number;
  orderBy?: Record<string, 'ASC' | 'DESC'>;
};

/**
 * 块时间范围查询功能
 * 提供基于时间范围的查询方法
 */
export class ChunkTimeQueries extends BaseRepository<Chunk> {
  constructor(dataSource: DataSource, logger: Logger) {
    super(dataSource, Chunk, logger);
  }

  /**
   * 根据时间范围查找块
   * @param fieldNameOrStartTime - 字段名或开始时间
   * @param startTimeOrEndTime - 开始时间或结束时间
   * @param endTimeOrOptions - 结束时间或查询选项
   * @param options - 查询选项
   * @returns 块数组
   */
  async findByTimeRange(
    fieldNameOrStartTime: string | number,
    startTimeOrEndTime: number,
    endTimeOrOptions?: number | ChunkTimeRangeQueryOptions,
    options?: FindManyOptions<Chunk>,
  ): Promise<Chunk[]> {
    if (
      typeof fieldNameOrStartTime === 'string' &&
      typeof endTimeOrOptions === 'number'
    ) {
      return super.findByTimeRange(
        fieldNameOrStartTime,
        startTimeOrEndTime,
        endTimeOrOptions,
        options,
      );
    }

    const startTime = fieldNameOrStartTime as number;
    const endTime = startTimeOrEndTime;
    const adaptedOptions: ChunkTimeRangeQueryOptions =
      (endTimeOrOptions as ChunkTimeRangeQueryOptions) || {};

    try {
      const queryBuilder = this.createQueryBuilder('chunk').where(
        'chunk.created_at BETWEEN :startTime AND :endTime',
        { startTime, endTime },
      );

      if (adaptedOptions.collectionId) {
        queryBuilder.andWhere('chunk.collectionId = :collectionId', {
          collectionId: adaptedOptions.collectionId,
        });
      }

      if (adaptedOptions.docId) {
        queryBuilder.andWhere('chunk.docId = :docId', {
          docId: adaptedOptions.docId,
        });
      }

      if (adaptedOptions.status) {
        queryBuilder.andWhere('chunk.embeddingStatus = :status', {
          status: adaptedOptions.status,
        });
      }

      if (adaptedOptions.syncStatus) {
        queryBuilder.andWhere('chunk.syncStatus = :syncStatus', {
          syncStatus: adaptedOptions.syncStatus,
        });
      }

      if (adaptedOptions.orderBy) {
        Object.entries(adaptedOptions.orderBy).forEach(([field, direction]) => {
          queryBuilder.addOrderBy(`chunk.${field}`, direction);
        });
      } else {
        queryBuilder.addOrderBy('chunk.created_at', 'DESC');
      }

      if (adaptedOptions.limit) {
        queryBuilder.limit(adaptedOptions.limit);
      }

      return await queryBuilder.getMany();
    } catch (error) {
      this.logger.error('Failed to fetch chunks by time range', {
        startTime,
        endTime,
        options: adaptedOptions,
        error: (error as Error).message,
      });
      throw error;
    }
  }
}
