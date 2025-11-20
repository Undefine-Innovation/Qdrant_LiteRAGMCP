import { DataSource, FindOptionsWhere, Between, ILike } from 'typeorm';
import { BaseRepository } from './BaseRepository.js';
import { Doc } from '../entities/Doc.js';
import { Logger } from '@logging/logger.js';
import { CollectionId } from '@domain/entities/types.js';

/**
 * 简化的文档高级查询功能
 * 提供复杂查询和搜索功能
 */
export class SimplifiedDocAdvancedQueries extends BaseRepository<Doc> {
  constructor(dataSource: DataSource, logger: Logger) {
    super(dataSource, Doc, logger);
  }

  /**
   * 搜索文档内容
   * @param searchText - 搜索文本
   * @param options - 搜索选项
   * @param options.collectionId - 集合ID过滤
   * @param options.limit - 结果数量限制
   * @param options.searchFields - 搜索字段
   * @returns 文档数组
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
      const queryBuilder = this.repository.createQueryBuilder('doc');

      // 基础条件
      queryBuilder.where('doc.deleted = :deleted', { deleted: false });

      if (options.collectionId) {
        queryBuilder.andWhere('doc.collectionId = :collectionId', {
          collectionId: options.collectionId,
        });
      }

      // 搜索条件
      const searchFields = options.searchFields || ['name', 'key', 'content'];
      const searchConditions = searchFields.map(
        (field) => `doc.${field} ILIKE :searchText`,
      );

      queryBuilder.andWhere(`(${searchConditions.join(' OR ')})`, {
        searchText: `%${searchText}%`,
      });

      // 排序和限制
      queryBuilder.orderBy('doc.updated_at', 'DESC');

      if (options.limit) {
        queryBuilder.limit(options.limit);
      }

      const results = await queryBuilder.getMany();

      this.logger.debug(`搜索文档内容完成`, {
        searchText,
        collectionId: options.collectionId,
        searchFields,
        limit: options.limit,
        found: results.length,
      });

      return results;
    } catch (error) {
      this.logger.error(`搜索文档内容失败`, {
        searchText,
        options,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 查找可处理的文档
   * @param collectionId - 集合ID
   * @param limit - 结果数量限制
   * @returns 文档数组
   */
  async findProcessable(
    collectionId: CollectionId,
    limit?: number,
  ): Promise<Doc[]> {
    try {
      const queryBuilder = this.repository
        .createQueryBuilder('doc')
        .where('doc.collectionId = :collectionId', { collectionId })
        .andWhere('doc.status IN (:...statuses)', {
          statuses: ['new', 'failed'],
        })
        .andWhere('doc.deleted = :deleted', { deleted: false })
        .orderBy('doc.created_at', 'ASC');

      if (limit) {
        queryBuilder.limit(limit);
      }

      const results = await queryBuilder.getMany();

      this.logger.debug(`查找可处理文档完成`, {
        collectionId,
        limit,
        found: results.length,
      });

      return results;
    } catch (error) {
      this.logger.error(`查找可处理文档失败`, {
        collectionId,
        limit,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 根据时间范围查找文档
   * @param startTime - 开始时间
   * @param endTime - 结束时间
   * @param options - 查询选项
   * @param options.collectionId - 集合ID过滤
   * @param options.status - 状态过滤
   * @param options.limit - 结果数量限制
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
      const queryBuilder = this.repository
        .createQueryBuilder('doc')
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

      queryBuilder.orderBy('doc.created_at', 'DESC');

      if (options.limit) {
        queryBuilder.limit(options.limit);
      }

      const results = await queryBuilder.getMany();

      this.logger.debug(`根据时间范围查找文档完成`, {
        startTime,
        endTime,
        collectionId: options.collectionId,
        status: options.status,
        limit: options.limit,
        found: results.length,
      });

      return results;
    } catch (error) {
      this.logger.error(`根据时间范围查找文档失败`, {
        startTime,
        endTime,
        options,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 查找大文档
   * @param minSizeBytes - 最小文件大小（字节）
   * @param options - 查询选项
   * @param options.collectionId - 集合ID过滤
   * @param options.limit - 结果数量限制
   * @returns 文档数组
   */
  async findLargeDocuments(
    minSizeBytes: number = 1024 * 1024, // 默认1MB
    options: {
      collectionId?: CollectionId;
      limit?: number;
    } = {},
  ): Promise<Doc[]> {
    try {
      const queryBuilder = this.repository
        .createQueryBuilder('doc')
        .where('doc.size_bytes >= :minSizeBytes', { minSizeBytes })
        .andWhere('doc.deleted = :deleted', { deleted: false });

      if (options.collectionId) {
        queryBuilder.andWhere('doc.collectionId = :collectionId', {
          collectionId: options.collectionId,
        });
      }

      queryBuilder.orderBy('doc.size_bytes', 'DESC');

      if (options.limit) {
        queryBuilder.limit(options.limit);
      }

      const results = await queryBuilder.getMany();

      this.logger.debug(`查找大文档完成`, {
        minSizeBytes,
        collectionId: options.collectionId,
        limit: options.limit,
        found: results.length,
      });

      return results;
    } catch (error) {
      this.logger.error(`查找大文档失败`, {
        minSizeBytes,
        options,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 查找重复文档（基于内容哈希）
   * @param options - 查询选项
   * @param options.collectionId - 集合ID过滤
   * @param options.limit - 结果数量限制
   * @returns 重复文档分组数组
   */
  async findDuplicateDocuments(
    options: {
      collectionId?: CollectionId;
      limit?: number;
    } = {},
  ): Promise<Array<{ contentHash: string; documents: Doc[] }>> {
    try {
      const queryBuilder = this.repository
        .createQueryBuilder('doc')
        .select('doc.contentHash', 'contentHash')
        .addSelect('COUNT(*)', 'count')
        .where('doc.contentHash IS NOT NULL')
        .andWhere('doc.deleted = :deleted', { deleted: false })
        .groupBy('doc.contentHash')
        .having('COUNT(*) > 1');

      if (options.collectionId) {
        queryBuilder.andWhere('doc.collectionId = :collectionId', {
          collectionId: options.collectionId,
        });
      }

      queryBuilder.orderBy('count', 'DESC');

      if (options.limit) {
        queryBuilder.limit(options.limit);
      }

      const duplicateHashes = await queryBuilder.getRawMany();

      // 获取每个哈希对应的文档
      const results: Array<{ contentHash: string; documents: Doc[] }> = [];

      for (const { contentHash } of duplicateHashes) {
        const documents = await this.findAll({
          where: {
            content_hash: contentHash,
            deleted: false,
            ...(options.collectionId && { collectionId: options.collectionId }),
          },
          order: { created_at: 'DESC' },
        });

        results.push({ contentHash, documents });
      }

      this.logger.debug(`查找重复文档完成`, {
        collectionId: options.collectionId,
        limit: options.limit,
        duplicateGroups: results.length,
      });

      return results;
    } catch (error) {
      this.logger.error(`查找重复文档失败`, {
        options,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 查找孤立文档（没有对应集合的文档）
   * @param limit - 结果数量限制
   * @returns 文档数组
   */
  async findOrphanedDocuments(limit?: number): Promise<Doc[]> {
    try {
      const queryBuilder = this.repository
        .createQueryBuilder('doc')
        .leftJoin('doc.collection', 'collection')
        .where('collection.id IS NULL')
        .andWhere('doc.deleted = :deleted', { deleted: false })
        .orderBy('doc.created_at', 'DESC');

      if (limit) {
        queryBuilder.limit(limit);
      }

      const results = await queryBuilder.getMany();

      this.logger.debug(`查找孤立文档完成`, {
        limit,
        found: results.length,
      });

      return results;
    } catch (error) {
      this.logger.error(`查找孤立文档失败`, {
        limit,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 查找长时间未更新的文档
   * @param olderThanHours - 未更新时间阈值（小时）
   * @param options - 查询选项
   * @param options.collectionId - 集合ID过滤
   * @param options.status - 状态过滤
   * @param options.limit - 结果数量限制
   * @returns 文档数组
   */
  async findStaleDocuments(
    olderThanHours: number = 24,
    options: {
      collectionId?: CollectionId;
      status?: 'new' | 'processing' | 'completed' | 'failed';
      limit?: number;
    } = {},
  ): Promise<Doc[]> {
    try {
      const cutoffTime = Date.now() - olderThanHours * 60 * 60 * 1000;

      const queryBuilder = this.repository
        .createQueryBuilder('doc')
        .where('doc.updated_at < :cutoffTime', { cutoffTime })
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

      queryBuilder.orderBy('doc.updated_at', 'ASC');

      if (options.limit) {
        queryBuilder.limit(options.limit);
      }

      const results = await queryBuilder.getMany();

      this.logger.debug(`查找长时间未更新文档完成`, {
        olderThanHours,
        cutoffTime,
        collectionId: options.collectionId,
        status: options.status,
        limit: options.limit,
        found: results.length,
      });

      return results;
    } catch (error) {
      this.logger.error(`查找长时间未更新文档失败`, {
        olderThanHours,
        options,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
