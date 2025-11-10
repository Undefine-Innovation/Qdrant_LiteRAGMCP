import { DataSource, FindOptionsWhere, Not } from 'typeorm';
import {
  BaseRepository,
  PaginationOptions,
  PaginatedResult,
} from './BaseRepository.js';
import { Collection } from '../entities/Collection.js';
import { Logger } from '@logging/logger.js';
import { CollectionId } from '@domain/entities/types.js';

/**
 * 集合Repository
 * 提供集合相关的数据库操作
 * 优化了查询性能和批量操作
 */
export class CollectionRepository extends BaseRepository<Collection> {
  /**
   * 创建CollectionRepository实例
   * @param dataSource TypeORM数据源
   * @param logger 日志记录器
   */
  constructor(dataSource: DataSource, logger: Logger) {
    super(dataSource, Collection, logger);
  }

  /**
   * 根据名称查找集合
   * @param name 集合名称
   * @returns 找到的集合或null
   */
  async findByName(name: string): Promise<Collection | null> {
    try {
      const result = await this.repository.findOne({
        where: {
          name,
          deleted: false,
        } as FindOptionsWhere<Collection>,
      });
      return result || null;
    } catch (error) {
      this.logger.error(`根据名称查找集合失败`, {
        name,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据集合ID查找集合
   * @param collectionId 集合ID
   * @returns 找到的集合或null
   */
  async findByCollectionId(
    collectionId: CollectionId,
  ): Promise<Collection | null> {
    try {
      const result = await this.repository.findOne({
        where: {
          collectionId,
          deleted: false,
        } as FindOptionsWhere<Collection>,
      });
      return result || null;
    } catch (error) {
      this.logger.error(`根据集合ID查找集合失败`, {
        collectionId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 获取所有活跃集合
   * @returns 集合数组
   */
  async findAllActive(): Promise<Collection[]> {
    try {
      const results = await this.repository.find({
        where: {
          deleted: false,
          status: 'active',
        } as FindOptionsWhere<Collection>,
        order: { created_at: 'DESC' },
      });
      return results;
    } catch (error) {
      this.logger.error(`获取所有活跃集合失败`, {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 分页获取集合
   * @param paginationOptions 分页选项
   * @param status 可选的状态过滤
   * @returns 分页结果
   */
  async findWithPagination(
    paginationOptions: PaginationOptions = {},
    status?: 'active' | 'inactive' | 'archived',
  ): Promise<PaginatedResult<Collection>> {
    try {
      // 创建QueryBuilder而不是使用where条件对象
      const queryBuilder = this.createQueryBuilder('collection').where(
        'collection.deleted = :deleted',
        { deleted: false },
      );

      if (status) {
        queryBuilder.andWhere('collection.status = :status', { status });
      }

      return await super.findWithPagination(paginationOptions, queryBuilder);
    } catch (error) {
      this.logger.error(`分页获取集合失败`, {
        paginationOptions,
        status,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 分页获取集合（简化版接口，供 CollectionAggregateRepository 使用）
   * @param page 页码
   * @param limit 每页数量
   * @returns 分页结果
   */
  async findPaginated(page: number, limit: number): Promise<PaginatedResult<Collection>> {
    const paginationOptions: PaginationOptions = { page, limit };
    return await this.findWithPagination(paginationOptions);
  }

  /**
   * 更新集合
   * @param id 集合ID
   * @param data 更新数据
   * @returns 更新后的集合
   */
  async updateCollection(
    id: CollectionId,
    data: Partial<
      Pick<Collection, 'name' | 'description' | 'status' | 'config'>
    >,
  ): Promise<Collection | null> {
    try {
      const result = await this.update(id, data);
      if (result) {
        this.logger.debug(`更新集合成功`, {
          id,
          updatedFields: Object.keys(data),
        });
      }
      return result;
    } catch (error) {
      this.logger.error(`更新集合失败`, {
        id,
        data,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 检查集合名称是否存在
   * @param name 集合名称
   * @param excludeId 排除的ID（用于更新时检查）
   * @returns 是否存在
   */
  async existsByName(name: string, excludeId?: CollectionId): Promise<boolean> {
    try {
      const whereCondition: FindOptionsWhere<Collection> = {
        name,
        deleted: false,
      };

      if (excludeId) {
        whereCondition.id = Not(excludeId);
      }

      const count = await this.repository.count({ where: whereCondition });
      return count > 0;
    } catch (error) {
      this.logger.error(`检查集合名称存在性失败`, {
        name,
        excludeId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 获取集合总数
   * @param status 可选的状态过滤
   * @returns 集合总数
   */
  async getCount(status?: 'active' | 'inactive' | 'archived'): Promise<number> {
    try {
      const whereCondition: FindOptionsWhere<Collection> = { deleted: false };
      if (status) {
        whereCondition.status = status;
      }

      return await this.repository.count({ where: whereCondition });
    } catch (error) {
      this.logger.error(`获取集合总数失败`, {
        status,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据前缀查找集合
   * @param prefix 前缀
   * @param limit 结果限制
   * @returns 集合数组
   */
  async findByPrefix(prefix: string, limit?: number): Promise<Collection[]> {
    try {
      const queryBuilder = this.createQueryBuilder('collection')
        .where('collection.name LIKE :prefix', { prefix: `${prefix}%` })
        .andWhere('collection.deleted = :deleted', { deleted: false })
        .orderBy('collection.created_at', 'DESC');

      if (limit) {
        queryBuilder.limit(limit);
      }

      const results = await queryBuilder.getMany();
      return results;
    } catch (error) {
      this.logger.error(`根据前缀查找集合失败`, {
        prefix,
        limit,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据后缀查找集合
   * @param suffix 后缀
   * @param limit 结果限制
   * @returns 集合数组
   */
  async findBySuffix(suffix: string, limit?: number): Promise<Collection[]> {
    try {
      const queryBuilder = this.createQueryBuilder('collection')
        .where('collection.name LIKE :suffix', { suffix: `%${suffix}` })
        .andWhere('collection.deleted = :deleted', { deleted: false })
        .orderBy('collection.created_at', 'DESC');

      if (limit) {
        queryBuilder.limit(limit);
      }

      const results = await queryBuilder.getMany();
      return results;
    } catch (error) {
      this.logger.error(`根据后缀查找集合失败`, {
        suffix,
        limit,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 模糊搜索集合
   * @param searchText 搜索文本
   * @param options 搜索选项
   * @returns 集合数组
   * @param options.limit �������
   * @param options.status ״̬����
   */
  async searchCollections(
    searchText: string,
    options: {
      limit?: number;
      status?: 'active' | 'inactive' | 'archived';
    } = {},
  ): Promise<Collection[]> {
    try {
      const queryBuilder = this.createQueryBuilder('collection')
        .where('collection.name ILIKE :searchText', {
          searchText: `%${searchText}%`,
        })
        .orWhere('collection.description ILIKE :searchText', {
          searchText: `%${searchText}%`,
        })
        .andWhere('collection.deleted = :deleted', { deleted: false });

      if (options.status) {
        queryBuilder.andWhere('collection.status = :status', {
          status: options.status,
        });
      }

      if (options.limit) {
        queryBuilder.limit(options.limit);
      }

      queryBuilder.orderBy('collection.created_at', 'DESC');

      const results = await queryBuilder.getMany();
      return results;
    } catch (error) {
      this.logger.error(`模糊搜索集合失败`, {
        searchText,
        options,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 获取集合统计信息
   * @returns 统计信息
   */
  async getStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    archived: number;
    totalDocuments: number;
    totalChunks: number;
  }> {
    try {
      const queryBuilder = this.createQueryBuilder('collection')
        .select('COUNT(*)', 'total')
        .addSelect(
          'SUM(CASE WHEN status = :active THEN 1 ELSE 0 END)',
          'active',
        )
        .addSelect(
          'SUM(CASE WHEN status = :inactive THEN 1 ELSE 0 END)',
          'inactive',
        )
        .addSelect(
          'SUM(CASE WHEN status = :archived THEN 1 ELSE 0 END)',
          'archived',
        )
        .addSelect('SUM(documentCount)', 'totalDocuments')
        .addSelect('SUM(chunkCount)', 'totalChunks')
        .where('collection.deleted = :deleted', { deleted: false })
        .setParameters({
          active: 'active',
          inactive: 'inactive',
          archived: 'archived',
        });

      const result = await queryBuilder.getRawOne();

      // 处理空结果的情况
      if (!result) {
        return {
          total: 0,
          active: 0,
          inactive: 0,
          archived: 0,
          totalDocuments: 0,
          totalChunks: 0,
        };
      }

      return {
        total: parseInt(result.total, 10) || 0,
        active: parseInt(result.active, 10) || 0,
        inactive: parseInt(result.inactive, 10) || 0,
        archived: parseInt(result.archived, 10) || 0,
        totalDocuments: parseInt(result.totalDocuments, 10) || 0,
        totalChunks: parseInt(result.totalChunks, 10) || 0,
      };
    } catch (error) {
      this.logger.error(`获取集合统计信息失败`, {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 批量更新集合状态
   * @param ids 集合ID数组
   * @param status 新状态
   * @returns 批量操作结果
   */
  async batchUpdateStatus(
    ids: CollectionId[],
    status: 'active' | 'inactive' | 'archived',
  ): Promise<{ updated: number; failed: number }> {
    try {
      const result = await this.updateBatch(ids, { status });
      const response = {
        updated: result.success,
        failed: result.failed,
      };
      this.logger.debug(`批量更新集合状态完成`, {
        requested: ids.length,
        updated: response.updated,
        failed: response.failed,
        status,
      });
      return response;
    } catch (error) {
      this.logger.error(`批量更新集合状态失败`, {
        ids,
        status,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 批量软删除集合
   * @param ids 集合ID数组
   * @returns 删除的记录数
   */
  async batchSoftDelete(ids: CollectionId[]): Promise<number> {
    try {
      const deletedCount = await this.softDeleteBatch(ids);
      this.logger.debug(`批量软删除集合完成`, {
        requested: ids.length,
        deleted: deletedCount,
      });
      return deletedCount;
    } catch (error) {
      this.logger.error(`批量软删除集合失败`, {
        ids,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 更新集合文档数量
   * @param id 集合ID
   * @param count 文档数量
   * @returns 是否更新成功
   */
  async updateDocumentCount(id: CollectionId, count: number): Promise<boolean> {
    try {
      const result = await this.update(id, { documentCount: count });
      if (result) {
        this.logger.debug(`更新集合文档数量成功`, { id, count });
      }
      return !!result;
    } catch (error) {
      this.logger.error(`更新集合文档数量失败`, {
        id,
        count,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 更新集合块数量
   * @param id 集合ID
   * @param count 块数量
   * @returns 是否更新成功
   */
  async updateChunkCount(id: CollectionId, count: number): Promise<boolean> {
    try {
      const result = await this.update(id, { chunkCount: count });
      if (result) {
        this.logger.debug(`更新集合块数量成功`, { id, count });
      }
      return !!result;
    } catch (error) {
      this.logger.error(`更新集合块数量失败`, {
        id,
        count,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 更新最后同步时间
   * @param id 集合ID
   * @returns 是否更新成功
   */
  async updateLastSyncTime(id: CollectionId): Promise<boolean> {
    try {
      const result = await this.update(id, { lastSyncAt: Date.now() });
      if (result) {
        this.logger.debug(`更新集合最后同步时间成功`, { id });
      }
      return !!result;
    } catch (error) {
      this.logger.error(`更新集合最后同步时间失败`, {
        id,
        error: (error as Error).message,
      });
      throw error;
    }
  }
}
