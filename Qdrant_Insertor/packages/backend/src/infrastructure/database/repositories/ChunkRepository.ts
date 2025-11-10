import type {
  DataSource,
  FindOptionsWhere,
  FindManyOptions,
  Not,
  Between,
  ILike,
  LessThan,
  MoreThan,
  Like,
} from 'typeorm';
import { In } from 'typeorm';
import {
  BaseRepository,
  PaginationOptions,
  PaginatedResult,
  BatchOperationResult,
} from './BaseRepository.js';
import { Chunk } from '../entities/Chunk.js';
import { Logger } from '@logging/logger.js';
import { DocId, CollectionId, PointId } from '@domain/entities/types.js';

interface ChunkPersistenceManager {
  save: (entities: unknown[]) => Promise<unknown>;
}

interface ChunkDeletionManager {
  delete: (
    entity: unknown,
    where: unknown,
  ) => Promise<{ affected?: number }>;
}

/**
 * 块Repository
 * 提供块相关的数据库操作
 * 优化了查询性能和批量操作
 */
export class ChunkRepository extends BaseRepository<Chunk> {
  /**
   * 创建ChunkRepository实例
   * @param dataSource TypeORM数据源
   * @param logger 日志记录器
   */
  constructor(dataSource: DataSource, logger: Logger) {
    super(dataSource, Chunk, logger);
  }

  /**
   * 根据文档ID查找块
   * @param docId 文档ID
   * @param options.status 块状态
   * @param options.syncStatus 同步状态
   * @param options.limit 限制数量
   * @param options.orderBy 排序字段
   * @param options.includeContent 是否包含内容
   * @returns 块数组
   * @param options ��ѯѡ��
   */
  async findByDocId(
    docId: DocId,
    options: {
      status?: 'pending' | 'processing' | 'completed' | 'failed';
      syncStatus?: 'pending' | 'processing' | 'completed' | 'failed';
      limit?: number;
      orderBy?: Record<string, 'ASC' | 'DESC'>;
      includeContent?: boolean;
    } = {},
  ): Promise<Chunk[]> {
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

      if (options.orderBy) {
        Object.entries(options.orderBy).forEach(([field, direction]) => {
          queryBuilder.addOrderBy(`chunk.${field}`, direction);
        });
      } else {
        queryBuilder.addOrderBy('chunk.chunkIndex', 'ASC');
      }

      if (options.limit) {
        queryBuilder.limit(options.limit);
      }

      if (!options.includeContent) {
        queryBuilder.select([
          'chunk.id',
          'chunk.pointId',
          'chunk.docId',
          'chunk.collectionId',
          'chunk.chunkIndex',
          'chunk.title',
          'chunk.contentLength',
          'chunk.tokenCount',
          'chunk.embeddingStatus',
          'chunk.syncStatus',
          'chunk.embeddedAt',
          'chunk.syncedAt',
          'chunk.error',
          'chunk.metadata',
          'chunk.created_at',
          'chunk.updated_at',
        ]);
      }

      const results = await queryBuilder.getMany();
      return results;
    } catch (error) {
      this.logger.error(`根据文档ID查找块失败`, {
        docId,
        options,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据集合ID查找块
   * @param collectionId 集合ID
   * @param options.status 块状态
   * @param options.syncStatus 同步状态
   * @param options.limit 限制数量
   * @param options.orderBy 排序字段
   * @param options.includeContent 是否包含内容
   * @returns 块数组
   * @param options ��ѯѡ��
   */
  async findByCollectionId(
    collectionId: CollectionId,
    options: {
      status?: 'pending' | 'processing' | 'completed' | 'failed';
      syncStatus?: 'pending' | 'processing' | 'completed' | 'failed';
      limit?: number;
      orderBy?: Record<string, 'ASC' | 'DESC'>;
      includeContent?: boolean;
    } = {},
  ): Promise<Chunk[]> {
    try {
      const queryBuilder = this.createQueryBuilder('chunk').where(
        'chunk.collectionId = :collectionId',
        { collectionId },
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

      if (options.orderBy) {
        Object.entries(options.orderBy).forEach(([field, direction]) => {
          queryBuilder.addOrderBy(`chunk.${field}`, direction);
        });
      } else {
        queryBuilder.addOrderBy('chunk.chunkIndex', 'ASC');
      }

      if (options.limit) {
        queryBuilder.limit(options.limit);
      }

      if (!options.includeContent) {
        queryBuilder.select([
          'chunk.id',
          'chunk.pointId',
          'chunk.docId',
          'chunk.collectionId',
          'chunk.chunkIndex',
          'chunk.title',
          'chunk.contentLength',
          'chunk.tokenCount',
          'chunk.embeddingStatus',
          'chunk.syncStatus',
          'chunk.embeddedAt',
          'chunk.syncedAt',
          'chunk.error',
          'chunk.metadata',
          'chunk.created_at',
          'chunk.updated_at',
        ]);
      }

      const results = await queryBuilder.getMany();
      return results;
    } catch (error) {
      this.logger.error(`根据集合ID查找块失败`, {
        collectionId,
        options,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据点ID数组查找块
   * @param pointIds 点ID数组
   * @param options.includeContent 是否包含内容
   * @param options.orderBy 排序字段
   * @returns 块数组
   * @param options ��ѯѡ��
   * @param options.includeContent �Ƿ��������
   */
  async findByPointIds(
    pointIds: PointId[],
    options: {
      includeContent?: boolean;
      orderBy?: Record<string, 'ASC' | 'DESC'>;
    } = {},
  ): Promise<Chunk[]> {
    try {
      if (pointIds.length === 0) {
        return [];
      }

      const queryBuilder = this.createQueryBuilder('chunk').where(
        'chunk.pointId IN (:...pointIds)',
        { pointIds },
      );

      if (options.orderBy) {
        Object.entries(options.orderBy).forEach(([field, direction]) => {
          queryBuilder.addOrderBy(`chunk.${field}`, direction);
        });
      } else {
        queryBuilder.addOrderBy('chunk.chunkIndex', 'ASC');
      }

      if (!options.includeContent) {
        queryBuilder.select([
          'chunk.id',
          'chunk.pointId',
          'chunk.docId',
          'chunk.collectionId',
          'chunk.chunkIndex',
          'chunk.title',
          'chunk.contentLength',
          'chunk.tokenCount',
          'chunk.embeddingStatus',
          'chunk.syncStatus',
          'chunk.embeddedAt',
          'chunk.syncedAt',
          'chunk.error',
          'chunk.metadata',
          'chunk.created_at',
          'chunk.updated_at',
        ]);
      }

      const results = await queryBuilder.getMany();
      return results;
    } catch (error) {
      this.logger.error(`根据点ID数组查找块失败`, {
        pointIds,
        options,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据点ID查找单个块
   * @param pointId 点ID
   * @param options 查询选项
   * @returns 找到的块或null
   */
  async findByPointId(
    pointId: PointId,
    options: {
      includeContent?: boolean;
    } = {},
  ): Promise<Chunk | null> {
    try {
      const queryBuilder = this.createQueryBuilder('chunk').where(
        'chunk.pointId = :pointId',
        { pointId },
      );

      if (!options.includeContent) {
        queryBuilder.select([
          'chunk.id',
          'chunk.pointId',
          'chunk.docId',
          'chunk.collectionId',
          'chunk.chunkIndex',
          'chunk.title',
          'chunk.contentLength',
          'chunk.tokenCount',
          'chunk.embeddingStatus',
          'chunk.syncStatus',
          'chunk.embeddedAt',
          'chunk.syncedAt',
          'chunk.error',
          'chunk.metadata',
          'chunk.created_at',
          'chunk.updated_at',
        ]);
      }

      const result = await queryBuilder.getOne();
      return result || null;
    } catch (error) {
      this.logger.error(`根据点ID查找块失败`, {
        pointId,
        options,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 批量创建块
   * @param chunks 块数组
   * @param batchSize 批次大小，默认100
   * @returns 创建的块数组
   */
  async createBatch(
    chunks: Partial<Chunk>[],
    batchSize: number = 100,
  ): Promise<Chunk[]> {
    try {
      // 预处理块数据，计算内容长度
      const processedChunks = chunks.map((chunk) => ({
        ...chunk,
        contentLength: chunk.content ? chunk.content.length : 0,
      }));

      const results = await super.createBatch(processedChunks, batchSize);
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
   * @param docId 文档ID
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
   * @param collectionId 集合ID
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
   * @param pointIds 点ID数组
   * @param batchSize 批次大小，默认100
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
   * 获取块总数
   * @param docId 可选的文档ID
   * @param collectionId 可选的集合ID
   * @param options 查询选项
   * @returns 块总数
   * @param options ��ѯѡ��
   * @param options.status ��״̬
   * @param options.syncStatus ͬ��״̬
   */
  async getCount(
    docId?: DocId,
    collectionId?: CollectionId,
    options: {
      status?: 'pending' | 'processing' | 'completed' | 'failed';
      syncStatus?: 'pending' | 'processing' | 'completed' | 'failed';
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
   * 分页获取块
   * @param paginationOptions 分页选项
   * @param docId 可选的文档ID
   * @param collectionId 可选的集合ID
   * @param options 查询选项
   * @returns 分页结果
   * @param options ��ѯѡ��
   * @param options.status ��״̬
   * @param options.syncStatus ͬ��״̬
   * @param options.includeContent �Ƿ��������
   */
  async findWithPagination(
    paginationOptions: PaginationOptions = {},
    docId?: DocId,
    collectionId?: CollectionId,
    options: {
      status?: 'pending' | 'processing' | 'completed' | 'failed';
      syncStatus?: 'pending' | 'processing' | 'completed' | 'failed';
      includeContent?: boolean;
    } = {},
  ): Promise<PaginatedResult<Chunk>> {
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

      if (!options.includeContent) {
        queryBuilder.select([
          'chunk.id',
          'chunk.pointId',
          'chunk.docId',
          'chunk.collectionId',
          'chunk.chunkIndex',
          'chunk.title',
          'chunk.contentLength',
          'chunk.tokenCount',
          'chunk.embeddingStatus',
          'chunk.syncStatus',
          'chunk.embeddedAt',
          'chunk.syncedAt',
          'chunk.error',
          'chunk.metadata',
          'chunk.created_at',
          'chunk.updated_at',
        ]);
      }

      return await super.findWithPagination(paginationOptions, queryBuilder);
    } catch (error) {
      this.logger.error(`分页获取块失败`, {
        paginationOptions,
        docId,
        collectionId,
        options,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 搜索块内容
   * @param searchText 搜索文本
   * @param options 搜索选项
   * @returns 匹配的块数组
   * @param options ����ѡ��
   * @param options.collectionId ����ID
   * @param options.docId �ĵ�ID
   * @param options.limit ����
   * @param options.searchFields ��ѯ�ֶ�
   * @param options.includeContent �Ƿ��������
   */
  async searchContent(
    searchText: string,
    options: {
      collectionId?: CollectionId;
      docId?: DocId;
      limit?: number;
      searchFields?: string[];
      includeContent?: boolean;
    } = {},
  ): Promise<Chunk[]> {
    try {
      const queryBuilder = this.createQueryBuilder('chunk');

      if (options.collectionId) {
        queryBuilder.andWhere('chunk.collectionId = :collectionId', {
          collectionId: options.collectionId,
        });
      }

      if (options.docId) {
        queryBuilder.andWhere('chunk.docId = :docId', { docId: options.docId });
      }

      const searchFields = options.searchFields || ['content', 'title'];
      let firstField = true;

      for (const field of searchFields) {
        if (firstField) {
          queryBuilder.andWhere(`chunk.${field} ILIKE :searchText`, {
            searchText: `%${searchText}%`,
          });
          firstField = false;
        } else {
          queryBuilder.orWhere(`chunk.${field} ILIKE :searchText`, {
            searchText: `%${searchText}%`,
          });
        }
      }

      if (options.limit) {
        queryBuilder.limit(options.limit);
      }

      if (!options.includeContent) {
        queryBuilder.select([
          'chunk.id',
          'chunk.pointId',
          'chunk.docId',
          'chunk.collectionId',
          'chunk.chunkIndex',
          'chunk.title',
          'chunk.contentLength',
          'chunk.tokenCount',
          'chunk.embeddingStatus',
          'chunk.syncStatus',
          'chunk.embeddedAt',
          'chunk.syncedAt',
          'chunk.error',
          'chunk.metadata',
          'chunk.created_at',
          'chunk.updated_at',
        ]);
      }

      queryBuilder.addOrderBy('chunk.chunkIndex', 'ASC');

      const results = await queryBuilder.getMany();
      return results;
    } catch (error) {
      this.logger.error(`搜索块内容失败`, {
        searchText,
        options,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据时间范围查找块
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @param options 查询选项
   * @returns 块数组
   * @param fieldNameOrStartTime �������ֶ����߿�ʼʱ��
   * @param startTimeOrEndTime ��ʼʱ���߽���ʱ��
   * @param endTimeOrOptions ����ʱ���ѡ�����
   * @returns ������
   */
  async findByTimeRange(
    fieldNameOrStartTime: string | number,
    startTimeOrEndTime: number,
    endTimeOrOptions?:
      | number
      | {
          collectionId?: CollectionId;
          docId?: DocId;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
          syncStatus?: 'pending' | 'processing' | 'completed' | 'failed';
          limit?: number;
          orderBy?: Record<string, 'ASC' | 'DESC'>;
        },
    options?: FindManyOptions<Chunk>,
  ): Promise<Chunk[]> {
    // 如果调用的是旧的方法签名 (fieldName, startTime, endTime, options)
    if (
      typeof fieldNameOrStartTime === 'string' &&
      typeof startTimeOrEndTime === 'number' &&
      typeof endTimeOrOptions === 'number'
    ) {
      return super.findByTimeRange(
        fieldNameOrStartTime,
        startTimeOrEndTime,
        endTimeOrOptions,
        options,
      );
    }

    // 如果调用的是新的方法签名 (startTime, endTime, options)
    const startTime = fieldNameOrStartTime as number;
    const endTime = startTimeOrEndTime;
    const adaptedOptions = endTimeOrOptions as Record<string, unknown>;

    const queryBuilder = this.createQueryBuilder('chunk').where(
      'chunk.created_at BETWEEN :startTime AND :endTime',
      { startTime, endTime },
    );

    if (adaptedOptions?.collectionId) {
      queryBuilder.andWhere('chunk.collectionId = :collectionId', {
        collectionId: adaptedOptions.collectionId,
      });
    }

    if (adaptedOptions?.docId) {
      queryBuilder.andWhere('chunk.docId = :docId', {
        docId: adaptedOptions.docId,
      });
    }

    if (adaptedOptions?.status) {
      queryBuilder.andWhere('chunk.embeddingStatus = :status', {
        status: adaptedOptions.status,
      });
    }

    if (adaptedOptions?.syncStatus) {
      queryBuilder.andWhere('chunk.syncStatus = :syncStatus', {
        syncStatus: adaptedOptions.syncStatus,
      });
    }

    if (adaptedOptions?.orderBy) {
      Object.entries(adaptedOptions.orderBy).forEach(([field, direction]) => {
        queryBuilder.addOrderBy(`chunk.${field}`, direction as 'ASC' | 'DESC');
      });
    } else {
      queryBuilder.addOrderBy('chunk.created_at', 'DESC');
    }

    if (adaptedOptions?.limit) {
      queryBuilder.limit(adaptedOptions.limit);
    }

    return await queryBuilder.getMany();
    try {
      const queryBuilder = this.createQueryBuilder('chunk').where(
        'chunk.created_at BETWEEN :startTime AND :endTime',
        { startTime, endTime },
      );

      if (options.collectionId) {
        queryBuilder.andWhere('chunk.collectionId = :collectionId', {
          collectionId: options.collectionId,
        });
      }

      if (options.docId) {
        queryBuilder.andWhere('chunk.docId = :docId', { docId: options.docId });
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

      if (options.orderBy) {
        Object.entries(options.orderBy).forEach(([field, direction]) => {
          queryBuilder.addOrderBy(`chunk.${field}`, direction);
        });
      } else {
        queryBuilder.addOrderBy('chunk.created_at', 'DESC');
      }

      if (options.limit) {
        queryBuilder.limit(options.limit);
      }

      const results = await queryBuilder.getMany();
      return results;
    } catch (error) {
      this.logger.error(`根据时间范围查找块失败`, {
        startTime,
        endTime,
        options,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据文档ID统计块数量
   * @param docId 文档ID
   * @param options 查询选项
   * @returns 块数量
   * @param options ��ѯѡ��
   * @param options.status ��״̬
   * @param options.syncStatus ͬ��״̬
   */
  async countByDocId(
    docId: DocId,
    options: {
      status?: 'pending' | 'processing' | 'completed' | 'failed';
      syncStatus?: 'pending' | 'processing' | 'completed' | 'failed';
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
   * @param docId 文档ID
   * @returns 已完成块数量
   */
  async countCompletedByDocId(docId: DocId): Promise<number> {
    try {
      return await this.countByDocId(docId, {
        status: 'completed',
        syncStatus: 'completed',
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
   * @param docId 文档ID
   * @returns 失败块数量
   */
  async countFailedByDocId(docId: DocId): Promise<number> {
    try {
      return await this.countByDocId(docId, {
        status: 'failed',
        syncStatus: 'failed',
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
   * 批量更新块状态
   * @param pointIds 点ID数组
   * @param status 新状态
   * @returns 批量操作结果
   */
  async batchUpdateStatus(
    pointIds: PointId[],
    status: 'pending' | 'processing' | 'completed' | 'failed',
  ): Promise<BatchOperationResult> {
    try {
      const result = await this.updateBatch(pointIds, {
        embeddingStatus: status,
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
   * @param pointIds 点ID数组
   * @param syncStatus 新同步状态
   * @returns 批量操作结果
   */
  async batchUpdateSyncStatus(
    pointIds: PointId[],
    syncStatus: 'pending' | 'processing' | 'completed' | 'failed',
  ): Promise<BatchOperationResult> {
    try {
      const result = await this.updateBatch(pointIds, { syncStatus });
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

  /**
   * 获取块统计信息
   * @param collectionId 可选的集合ID
   * @param docId 可选的文档ID
   * @returns 统计信息
   * @param groupByOrOptions ��ͳ�����ֶ���ѡ�����
   * @param where ���������ѡ�����
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

  /**
   * 批量创建块（带事务管理器）
   * @param chunks 块数组
   * @param manager 事务管理器
   * @returns 创建的块数组
   * @param manager ���������
   */
  async createBatchWithManager(
    chunks: Partial<Chunk>[],
    manager: ChunkPersistenceManager,
  ): Promise<Chunk[]> {
    try {
      // 预处理块数据，计算内容长度
      const processedChunks = chunks.map((chunk) => ({
        ...chunk,
        contentLength: chunk.content ? chunk.content.length : 0,
      }));

      const entities = this.repository.create(processedChunks);
      const results = (await manager.save(entities)) as Chunk[];
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
   * 根据文档ID删除块（带事务管理器）
   * @param docId 文档ID
   * @param manager 事务管理器
   * @returns 删除的块数量
   * @param manager ���������
   */
  async deleteByDocIdWithManager(
    docId: DocId,
    manager: ChunkDeletionManager,
  ): Promise<number> {
    try {
      const result = await manager.delete(Chunk, { docId });
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
}
