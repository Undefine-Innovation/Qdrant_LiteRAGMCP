import {
  DataSource,
  FindOptionsWhere,
  Not,
  In,
  Between,
  EntityManager,
} from 'typeorm';
import {
  BaseRepository,
  PaginationOptions,
  PaginatedResult,
  BatchOperationResult,
} from './BaseRepository.js';
import { Doc } from '../entities/Doc.js';
import { Logger } from '@logging/logger.js';
import { DocId, CollectionId } from '@domain/entities/types.js';

/**
 * 文档Repository
 * 提供文档相关的数据库操作
 * 优化了查询性能和批量操作
 */
export class DocRepository extends BaseRepository<Doc> {
  /**
   * 创建DocRepository实例
   * @param dataSource TypeORM数据源
   * @param logger 日志记录器
   */
  constructor(dataSource: DataSource, logger: Logger) {
    super(dataSource, Doc, logger);
  }

  /**
   * 根据集合ID查找文档
   * @param collectionId 集合ID
   * @param options 查询选项
   * @returns 文档数组
   * @param options.status �ĵ�״̬
   * @param options.limit ��������
   * @param options.orderBy �����ֶ�
   */
  async findByCollectionId(
    collectionId: CollectionId,
    options: {
      status?: 'new' | 'processing' | 'completed' | 'failed';
      limit?: number;
      orderBy?: Record<string, 'ASC' | 'DESC'>;
    } = {},
  ): Promise<Doc[]> {
    try {
      const queryBuilder = this.createQueryBuilder('doc')
        .where('doc.collectionId = :collectionId', { collectionId })
        .andWhere('doc.deleted = :deleted', { deleted: false });

      if (options.status) {
        queryBuilder.andWhere('doc.status = :status', {
          status: options.status,
        });
      }

      if (options.orderBy) {
        Object.entries(options.orderBy).forEach(([field, direction]) => {
          queryBuilder.addOrderBy(`doc.${field}`, direction);
        });
      } else {
        queryBuilder.addOrderBy('doc.created_at', 'DESC');
      }

      if (options.limit) {
        queryBuilder.limit(options.limit);
      }

      const results = await queryBuilder.getMany();
      return results;
    } catch (error) {
      this.logger.error(`根据集合ID查找文档失败`, {
        collectionId,
        options,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据docId查找文档（覆盖BaseRepository的findById）
   * Doc实体使用docId字段作为业务标识符，而非id字段
   * @param docId 文档ID（业务标识符）
   * @returns 找到的文档或null
   */
  async findById(docId: string): Promise<Doc | null> {
    try {
      const result = await this.repository!.findOne({
        where: {
          docId,
          deleted: false,
        } as FindOptionsWhere<Doc>,
        // 显式选择content字段(默认select: false)
        select: {
          id: true,
          docId: true,
          collectionId: true,
          key: true,
          name: true,
          size_bytes: true,
          mime: true,
          content: true, // 显式包含content字段
          content_hash: true,
          status: true,
          processing_error: true,
          processing_started_at: true,
          processing_completed_at: true,
          processing_duration_ms: true,
          chunk_count: true,
          last_sync_at: true,
          deleted: true,
          deleted_at: true,
          created_at: true,
          updated_at: true,
          version: true,
        },
      });
      return result || null;
    } catch (error) {
      this.logger.error(`根据docId查找文档失败`, {
        docId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据键值查找文档
   * @param collectionId 集合ID
   * @param key 文档键值
   * @returns 找到的文档或null
   */
  async findByCollectionAndKey(
    collectionId: CollectionId,
    key: string,
  ): Promise<Doc | null> {
    try {
      const result = await this.repository!.findOne({
        where: {
          collectionId,
          key,
          deleted: false,
        } as FindOptionsWhere<Doc>,
      });
      return result || null;
    } catch (error) {
      this.logger.error(`根据集合和键值查找文档失败`, {
        collectionId,
        key,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 获取所有活跃文档
   * @param options 查询选项
   * @returns 文档数组
   * @param options.status �ĵ�״̬
   * @param options.limit ��������
   * @param options.orderBy �����ֶ�
   */
  async findAllActive(
    options: {
      status?: 'new' | 'processing' | 'completed' | 'failed';
      limit?: number;
      orderBy?: Record<string, 'ASC' | 'DESC'>;
    } = {},
  ): Promise<Doc[]> {
    try {
      const queryBuilder = this.createQueryBuilder('doc').where(
        'doc.deleted = :deleted',
        { deleted: false },
      );

      if (options.status) {
        queryBuilder.andWhere('doc.status = :status', {
          status: options.status,
        });
      }

      if (options.orderBy) {
        Object.entries(options.orderBy).forEach(([field, direction]) => {
          queryBuilder.addOrderBy(`doc.${field}`, direction);
        });
      } else {
        queryBuilder.addOrderBy('doc.created_at', 'DESC');
      }

      if (options.limit) {
        queryBuilder.limit(options.limit);
      }

      const results = await queryBuilder.getMany();
      return results;
    } catch (error) {
      this.logger.error(`获取所有活跃文档失败`, {
        options,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 分页获取文档
   * @param paginationOptions 分页选项
   * @param collectionId 可选的集合ID
   * @param status 可选的状态过滤
   * @returns 分页结果
   */
  async findWithPagination(
    paginationOptions: PaginationOptions = {},
    collectionId?: CollectionId,
    status?: 'new' | 'processing' | 'completed' | 'failed',
  ): Promise<PaginatedResult<Doc>> {
    try {
      const queryBuilder = this.createQueryBuilder('doc').where(
        'doc.deleted = :deleted',
        { deleted: false },
      );

      if (collectionId) {
        queryBuilder.andWhere('doc.collectionId = :collectionId', {
          collectionId,
        });
      }

      if (status) {
        queryBuilder.andWhere('doc.status = :status', { status });
      }

      return await super.findWithPagination(paginationOptions, queryBuilder);
    } catch (error) {
      this.logger.error(`分页获取文档失败`, {
        paginationOptions,
        collectionId,
        status,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 分页获取文档（简化版接口，供 DocumentAggregateRepository 使用）
   * @param page 页码
   * @param limit 每页数量
   * @param orderBy 排序选项
   * @returns 分页结果
   */
  async findPaginated(
    page: number,
    limit: number,
    orderBy?: Record<string, 'ASC' | 'DESC'>,
  ): Promise<PaginatedResult<Doc>> {
    // 手动构建查询以确保排序正确应用
    let queryBuilder = this.createQueryBuilder('doc').where(
      'doc.deleted = :deleted',
      { deleted: false },
    );

    if (orderBy) {
      // 使用 orderBy 而不是 addOrderBy，以确保只使用指定的排序
      const [firstField, firstDirection] = Object.entries(orderBy)[0] || [];
      if (firstField && firstDirection) {
        queryBuilder = queryBuilder.orderBy(firstField, firstDirection);
        // 添加其他排序字段（如果有多字段排序需求）
        const otherFields = Object.entries(orderBy).slice(1);
        for (const [field, direction] of otherFields) {
          queryBuilder = queryBuilder.addOrderBy(field, direction);
        }
      }
    } else {
      // 如果没有指定排序，则使用默认排序（可选）
      queryBuilder = queryBuilder.orderBy('doc.created_at', 'DESC');
    }

    const skip = (page - 1) * limit;
    const [data, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * 获取文档总数
   * @param collectionId 可选的集合ID
   * @param status 可选的状态过滤
   * @returns 文档总数
   */
  async getCount(
    collectionId?: CollectionId,
    status?: 'new' | 'processing' | 'completed' | 'failed',
  ): Promise<number> {
    try {
      const queryBuilder = this.createQueryBuilder('doc').where(
        'doc.deleted = :deleted',
        { deleted: false },
      );

      if (collectionId) {
        queryBuilder.andWhere('doc.collectionId = :collectionId', {
          collectionId,
        });
      }

      if (status) {
        queryBuilder.andWhere('doc.status = :status', { status });
      }

      return await queryBuilder.getCount();
    } catch (error) {
      this.logger.error(`获取文档总数失败`, {
        collectionId,
        status,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 软删除文档
   * @param id 文档ID
   * @returns 是否删除成功
   */
  async softDeleteDoc(id: DocId): Promise<boolean> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await this.repository!.update(id as unknown as any, {
        deleted: true,
        deleted_at: Date.now(),
        updated_at: Date.now(),
      });
      const success = (result.affected || 0) > 0;
      if (success) {
        this.logger.debug(`软删除文档成功`, { id });
      }
      return success;
    } catch (error) {
      this.logger.error(`软删除文档失败`, {
        id,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 批量软删除文档
   * @param ids 文档ID数组
   * @returns 删除的记录数
   */
  async batchSoftDelete(ids: DocId[]): Promise<number> {
    try {
      const deletedCount = await this.softDeleteBatch(ids);
      this.logger.debug(`批量软删除文档完成`, {
        requested: ids.length,
        deleted: deletedCount,
      });
      return deletedCount;
    } catch (error) {
      this.logger.error(`批量软删除文档失败`, {
        ids,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 恢复已删除的文档
   * @param id 文档ID
   * @returns 是否恢复成功
   */
  async restore(id: DocId): Promise<boolean> {
    try {
      const result = await this.repository!.update(id, {
        deleted: false,
        deleted_at: () => 'NULL',
        updated_at: Date.now(),
      });
      const success = (result.affected || 0) > 0;
      if (success) {
        this.logger.debug(`恢复文档成功`, { id });
      }
      return success;
    } catch (error) {
      this.logger.error(`恢复文档失败`, {
        id,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 批量恢复文档
   * @param ids 文档ID数组
   * @returns 恢复的记录数
   */
  async batchRestore(ids: DocId[]): Promise<number> {
    try {
      const result = await this.repository!.createQueryBuilder()
        .update(Doc)
        .set({
          deleted: false,
          deleted_at: () => 'NULL',
          updated_at: Date.now(),
        })
        .where('id IN (:...ids)', { ids })
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
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据内容哈希查找文档
   * @param contentHash 内容哈希
   * @returns 找到的文档或null
   */
  async findByContentHash(contentHash: string): Promise<Doc | null> {
    try {
      const result = await this.repository!.findOne({
        where: {
          content_hash: contentHash,
          deleted: false,
        } as FindOptionsWhere<Doc>,
      });
      return result || null;
    } catch (error) {
      this.logger.error(`根据内容哈希查找文档失败`, {
        contentHash,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 批量查找内容哈希
   * @param contentHashes 内容哈希数组
   * @returns 文档数组
   */
  async findByContentHashes(contentHashes: string[]): Promise<Doc[]> {
    try {
      if (contentHashes.length === 0) {
        return [];
      }

      const results = await this.repository!.find({
        where: {
          content_hash: In(contentHashes),
          deleted: false,
        } as FindOptionsWhere<Doc>,
      });
      return results;
    } catch (error) {
      this.logger.error(`批量查找内容哈希失败`, {
        contentHashes,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 更新文档基本信息
   * @param id 文档ID
   * @param data 更新数据
   * @returns 更新后的文档
   */
  async updateDocInfo(
    id: DocId,
    data: Partial<Pick<Doc, 'name' | 'mime' | 'size_bytes'>>,
  ): Promise<Doc | null> {
    try {
      const result = await this.update({ id } as Record<string, unknown>, data);
      if (result) {
        this.logger.debug(`更新文档基本信息成功`, {
          id,
          updatedFields: Object.keys(data),
        });
      }
      return result as Doc | null;
    } catch (error) {
      this.logger.error(`更新文档基本信息失败`, {
        id,
        data,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据集合ID分页查找文档
   * @param collectionId 集合ID
   * @param query 分页查询参数
   * @returns 分页结果
   * @param query.page ��ҳ��
   * @param query.limit ��������
   * @param query.status �ĵ�״̬
   */
  async findByCollectionIdPaginated(
    collectionId: CollectionId,
    query: {
      page?: number;
      limit?: number;
      status?: 'new' | 'processing' | 'completed' | 'failed';
    },
  ): Promise<PaginatedResult<Doc>> {
    try {
      const { page = 1, limit = 10, status } = query;
      return await this.findWithPagination(
        { page, limit },
        collectionId,
        status,
      );
    } catch (error) {
      this.logger.error(`根据集合ID分页查找文档失败`, {
        collectionId,
        query,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据状态查找文档
   * @param status 文档状态
   * @param options 查询选项
   * @returns 文档数组
   * @param options.collectionId ����ID
   * @param options.limit ��������
   * @param options.orderBy �����ֶ�
   */
  async findByStatus(
    status: 'new' | 'processing' | 'completed' | 'failed',
    options: {
      collectionId?: CollectionId;
      limit?: number;
      orderBy?: Record<string, 'ASC' | 'DESC'>;
    } = {},
  ): Promise<Doc[]> {
    try {
      const queryBuilder = this.createQueryBuilder('doc')
        .where('doc.status = :status', { status })
        .andWhere('doc.deleted = :deleted', { deleted: false });

      if (options.collectionId) {
        queryBuilder.andWhere('doc.collectionId = :collectionId', {
          collectionId: options.collectionId,
        });
      }

      if (options.orderBy) {
        Object.entries(options.orderBy).forEach(([field, direction]) => {
          queryBuilder.addOrderBy(`doc.${field}`, direction);
        });
      } else {
        queryBuilder.addOrderBy('doc.created_at', 'DESC');
      }

      if (options.limit) {
        queryBuilder.limit(options.limit);
      }

      const results = await queryBuilder.getMany();
      return results;
    } catch (error) {
      this.logger.error(`根据状态查找文档失败`, {
        status,
        options,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 查找可处理的文档
   * @param collectionId 集合ID
   * @param limit 限制数量
   * @returns 文档数组
   */
  async findProcessable(
    collectionId: CollectionId,
    limit?: number,
  ): Promise<Doc[]> {
    try {
      const queryBuilder = this.createQueryBuilder('doc')
        .where('doc.collectionId = :collectionId', { collectionId })
        .andWhere('doc.status = :status', { status: 'new' })
        .andWhere('doc.deleted = :deleted', { deleted: false })
        .orderBy('doc.created_at', 'ASC');

      if (limit) {
        queryBuilder.limit(limit);
      }

      const results = await queryBuilder.getMany();
      return results;
    } catch (error) {
      this.logger.error(`查找可处理文档失败`, {
        collectionId,
        limit,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 查找已删除的文档
   * @param collectionId 集合ID
   * @param options 查询选项
   * @returns 文档数组
   * @param options.limit ��������
   * @param options.orderBy �����ֶ�
   */
  async findDeleted(
    collectionId?: CollectionId,
    options: {
      limit?: number;
      orderBy?: Record<string, 'ASC' | 'DESC'>;
    } = {},
  ): Promise<Doc[]> {
    try {
      const queryBuilder = this.createQueryBuilder('doc').where(
        'doc.deleted = :deleted',
        { deleted: true },
      );

      if (collectionId) {
        queryBuilder.andWhere('doc.collectionId = :collectionId', {
          collectionId,
        });
      }

      if (options.orderBy) {
        Object.entries(options.orderBy).forEach(([field, direction]) => {
          queryBuilder.addOrderBy(`doc.${field}`, direction);
        });
      } else {
        queryBuilder.addOrderBy('doc.updated_at', 'DESC');
      }

      if (options.limit) {
        queryBuilder.limit(options.limit);
      }

      const results = await queryBuilder.getMany();
      return results;
    } catch (error) {
      this.logger.error(`查找已删除文档失败`, {
        collectionId,
        options,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 查找失败的文档
   * @param collectionId 集合ID
   * @param options 查询选项
   * @returns 文档数组
   * @param options.limit ��������
   * @param options.orderBy �����ֶ�
   */
  async findFailed(
    collectionId: CollectionId,
    options: {
      limit?: number;
      orderBy?: Record<string, 'ASC' | 'DESC'>;
    } = {},
  ): Promise<Doc[]> {
    try {
      const queryBuilder = this.createQueryBuilder('doc')
        .where('doc.collectionId = :collectionId', { collectionId })
        .andWhere('doc.status = :status', { status: 'failed' })
        .andWhere('doc.deleted = :deleted', { deleted: false });

      if (options.orderBy) {
        Object.entries(options.orderBy).forEach(([field, direction]) => {
          queryBuilder.addOrderBy(`doc.${field}`, direction);
        });
      } else {
        queryBuilder.addOrderBy('doc.updated_at', 'DESC');
      }

      if (options.limit) {
        queryBuilder.limit(options.limit);
      }

      const results = await queryBuilder.getMany();
      return results;
    } catch (error) {
      this.logger.error(`查找失败文档失败`, {
        collectionId,
        options,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 查找已完成的文档
   * @param collectionId 集合ID
   * @param options 查询选项
   * @returns 文档数组
   */
  async findCompleted(
    collectionId: CollectionId,
    options: {
      limit?: number;
      orderBy?: Record<string, 'ASC' | 'DESC'>;
    } = {},
  ): Promise<Doc[]> {
    try {
      const queryBuilder = this.createQueryBuilder('doc')
        .where('doc.collectionId = :collectionId', { collectionId })
        .andWhere('doc.status = :status', { status: 'completed' })
        .andWhere('doc.deleted = :deleted', { deleted: false });

      if (options.orderBy) {
        Object.entries(options.orderBy).forEach(([field, direction]) => {
          queryBuilder.addOrderBy(`doc.${field}`, direction);
        });
      } else {
        queryBuilder.addOrderBy('doc.updated_at', 'DESC');
      }

      if (options.limit) {
        queryBuilder.limit(options.limit);
      }

      const results = await queryBuilder.getMany();
      return results;
    } catch (error) {
      this.logger.error(`查找已完成文档失败`, {
        collectionId,
        options,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据时间范围查找文档
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @param options 查询选项
   * @returns 文档数组
   */
  async findByTimeRange(
    startTime: number,
    endTime: number,
    options: {
      collectionId?: CollectionId;
      status?: 'new' | 'processing' | 'completed' | 'failed';
      limit?: number;
    } = {},
  ): Promise<Doc[]> {
    try {
      const queryBuilder = this.createQueryBuilder('doc')
        .where('doc.created_at BETWEEN :startTime AND :endTime', {
          startTime,
          endTime,
        })
        .andWhere('doc.deleted = :deleted', { deleted: false });

      if (options.collectionId) {
        queryBuilder.andWhere('doc.collectionId = :collectionId', {
          collectionId: options.collectionId,
        });
      }

      if (options.status) {
        queryBuilder.andWhere('doc.status = :status', {
          status: options.status,
        });
      }

      if (options.limit) {
        queryBuilder.limit(options.limit);
      }

      queryBuilder.addOrderBy('doc.created_at', 'DESC');

      const results = await queryBuilder.getMany();
      return results;
    } catch (error) {
      this.logger.error(`根据时间范围查找文档失败`, {
        startTime,
        endTime,
        options,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 搜索文档内容
   * @param searchText 搜索文本
   * @param options 搜索选项
   * @returns 匹配的文档数组
   */
  async searchContent(
    searchText: string,
    options: {
      collectionId?: CollectionId;
      limit?: number;
      searchFields?: string[];
    } = {},
  ): Promise<Doc[]> {
    try {
      const queryBuilder = this.createQueryBuilder('doc').where(
        'doc.deleted = :deleted',
        { deleted: false },
      );

      if (options.collectionId) {
        queryBuilder.andWhere('doc.collectionId = :collectionId', {
          collectionId: options.collectionId,
        });
      }

      const searchFields = options.searchFields || ['name', 'key'];
      let firstField = true;

      for (const field of searchFields) {
        if (firstField) {
          queryBuilder.andWhere(`doc.${field} ILIKE :searchText`, {
            searchText: `%${searchText}%`,
          });
          firstField = false;
        } else {
          queryBuilder.orWhere(`doc.${field} ILIKE :searchText`, {
            searchText: `%${searchText}%`,
          });
        }
      }

      if (options.limit) {
        queryBuilder.limit(options.limit);
      }

      queryBuilder.addOrderBy('doc.created_at', 'DESC');

      const results = await queryBuilder.getMany();
      return results;
    } catch (error) {
      this.logger.error(`搜索文档内容失败`, {
        searchText,
        options,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 批量更新文档状态
   * @param ids 文档ID数组
   * @param status 新状态
   * @returns 批量操作结果
   */
  async batchUpdateStatus(
    ids: DocId[],
    status: 'new' | 'processing' | 'completed' | 'failed',
  ): Promise<BatchOperationResult> {
    try {
      const result = await this.updateBatch(ids, { status });
      const enrichedResult: BatchOperationResult = {
        ...result,
        updated: result.success,
      };
      this.logger.debug(`批量更新文档状态完成`, {
        requested: ids.length,
        updated: enrichedResult.updated,
        failed: enrichedResult.failed,
        status,
      });
      return enrichedResult;
    } catch (error) {
      this.logger.error(`批量更新文档状态失败`, {
        ids,
        status,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据集合ID统计文档数量
   * @param collectionId 集合ID
   * @param status 可选的状态过滤
   * @returns 文档数量
   */
  async countByCollectionId(
    collectionId: CollectionId,
    status?: 'new' | 'processing' | 'completed' | 'failed',
  ): Promise<number> {
    try {
      const queryBuilder = this.createQueryBuilder('doc')
        .where('doc.collectionId = :collectionId', { collectionId })
        .andWhere('doc.deleted = :deleted', { deleted: false });

      if (status) {
        queryBuilder.andWhere('doc.status = :status', { status });
      }

      return await queryBuilder.getCount();
    } catch (error) {
      this.logger.error(`统计集合文档数量失败`, {
        collectionId,
        status,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据集合ID统计已完成文档数量
   * @param collectionId 集合ID
   * @returns 已完成文档数量
   */
  async countCompletedByCollectionId(
    collectionId: CollectionId,
  ): Promise<number> {
    try {
      return await this.countByCollectionId(collectionId, 'completed');
    } catch (error) {
      this.logger.error(`统计集合已完成文档数量失败`, {
        collectionId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 获取文档统计信息
   * @param collectionId 可选的集合ID
   * @returns 统计信息
   */
  async getDocStatistics(collectionId?: CollectionId): Promise<{
    total: number;
    new: number;
    processing: number;
    completed: number;
    failed: number;
    deleted: number;
    totalSize: number;
  }> {
    try {
      const queryBuilder = this.createQueryBuilder('doc')
        .select('COUNT(*)', 'total')
        .addSelect('SUM(CASE WHEN status = :new THEN 1 ELSE 0 END)', 'new')
        .addSelect(
          'SUM(CASE WHEN status = :processing THEN 1 ELSE 0 END)',
          'processing',
        )
        .addSelect(
          'SUM(CASE WHEN status = :completed THEN 1 ELSE 0 END)',
          'completed',
        )
        .addSelect(
          'SUM(CASE WHEN status = :failed THEN 1 ELSE 0 END)',
          'failed',
        )
        .addSelect(
          'SUM(CASE WHEN deleted = :deleted THEN 1 ELSE 0 END)',
          'deleted',
        )
        .addSelect('SUM(size_bytes)', 'totalSize')
        .setParameters({
          new: 'new',
          processing: 'processing',
          completed: 'completed',
          failed: 'failed',
          deleted: true,
        });

      if (collectionId) {
        queryBuilder.andWhere('doc.collectionId = :collectionId', {
          collectionId,
        });
      }

      const result = await queryBuilder.getRawOne();

      // 处理空结果的情况
      if (!result) {
        return {
          total: 0,
          new: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          deleted: 0,
          totalSize: 0,
        };
      }

      return {
        total: parseInt(result.total, 10) || 0,
        new: parseInt(result.new, 10) || 0,
        processing: parseInt(result.processing, 10) || 0,
        completed: parseInt(result.completed, 10) || 0,
        failed: parseInt(result.failed, 10) || 0,
        deleted: parseInt(result.deleted, 10) || 0,
        totalSize: parseInt(result.totalSize, 10) || 0,
      };
    } catch (error) {
      this.logger.error(`获取文档统计信息失败`, {
        collectionId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 使用事务管理器删除文档
   * @param id 文档ID (docId业务标识符)
   * @param manager 事务管理器
   * @returns 删除结果
   */
  async deleteWithManager(
    id: DocId,
    manager: EntityManager,
  ): Promise<{ affected?: number }> {
    try {
      // 使用docId字段而不是id字段
      const result = await manager.delete(Doc, { docId: id });
      return { affected: result.affected || undefined };
    } catch (error) {
      this.logger.error(`使用事务管理器删除文档失败`, {
        docId: id,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 按集合ID和状态查找文档
   * @param collectionId 集合ID
   * @param status 文档状态
   * @returns 匹配的文档数组
   */
  async findByCollectionIdAndStatus(
    collectionId: CollectionId,
    status: string,
  ): Promise<Doc[]> {
    try {
      const docs = await this.findBy({
        collectionId: collectionId as unknown as string,
        status,
      } as unknown as FindOptionsWhere<Doc>);
      this.logger.debug(`按集合ID和状态查找文档成功`, {
        collectionId,
        status,
        count: docs.length,
      });
      return docs;
    } catch (error) {
      this.logger.error(`按集合ID和状态查找文档失败`, {
        collectionId,
        status,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据集合ID和排序选项分页查找文档（供 DocumentAggregateRepository 使用）
   * @param collectionId 集合ID
   * @param query 分页查询参数
   * @param orderBy 排序选项
   * @returns 分页结果
   */
  async findByCollectionIdPaginatedWithSorting(
    collectionId: CollectionId,
    query: {
      page?: number;
      limit?: number;
      status?: 'new' | 'processing' | 'completed' | 'failed';
    },
    orderBy?: Record<string, 'ASC' | 'DESC'>,
  ): Promise<PaginatedResult<Doc>> {
    try {
      const { page = 1, limit = 10, status } = query;

      // 手动构建带过滤条件的查询
      let queryBuilder = this.createQueryBuilder('doc')
        .where('doc.collectionId = :collectionId', { collectionId })
        .andWhere('doc.deleted = :deleted', { deleted: false });

      if (status) {
        queryBuilder = queryBuilder.andWhere('doc.status = :status', {
          status,
        });
      }

      if (orderBy) {
        // 使用 orderBy 而不是 addOrderBy，以确保只使用指定的排序
        const [firstField, firstDirection] = Object.entries(orderBy)[0] || [];
        if (firstField && firstDirection) {
          queryBuilder = queryBuilder.orderBy(firstField, firstDirection);
          // 添加其他排序字段（如果有多字段排序需求）
          const otherFields = Object.entries(orderBy).slice(1);
          for (const [field, direction] of otherFields) {
            queryBuilder = queryBuilder.addOrderBy(field, direction);
          }
        }
      } else {
        // 如果没有指定排序，则使用默认排序（可选）
        queryBuilder = queryBuilder.orderBy('doc.created_at', 'DESC');
      }

      const skip = (page - 1) * limit;
      const [data, total] = await queryBuilder
        .skip(skip)
        .take(limit)
        .getManyAndCount();

      const totalPages = Math.ceil(total / limit);

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      this.logger.error(`根据集合ID和排序选项分页查找文档失败`, {
        collectionId,
        query,
        orderBy,
        error: (error as Error).message,
      });
      throw error;
    }
  }
}
