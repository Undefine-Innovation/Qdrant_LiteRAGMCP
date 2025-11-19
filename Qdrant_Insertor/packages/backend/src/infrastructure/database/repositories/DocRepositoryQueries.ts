import {
  DataSource,
  FindOptionsWhere,
  In,
  Between,
  SelectQueryBuilder,
} from 'typeorm';
import {
  BaseRepository,
  PaginationOptions,
  PaginatedResult,
} from './BaseRepository.js';
import { Doc } from '../entities/Doc.js';
import { Logger } from '@logging/logger.js';
import { DocId, CollectionId } from '@domain/entities/types.js';

/**
 * DocRepository 查询和统计方法
 */
export class DocRepositoryQueries {
  constructor(
    protected dataSource: DataSource,
    protected logger: Logger,
  ) {}

  /**
   * 创建查询构建器
   * @param alias 别名
   * @returns 查询构建器
   */
  protected createQueryBuilder(alias: string = 'doc') {
    return this.dataSource.getRepository(Doc).createQueryBuilder(alias);
  }

  /**
   * 根据集合ID查找文档
   * @param collectionId 集合ID
   * @param options 查询选项
   * @param options.status 状态过滤
   * @param options.limit 结果数量限制
   * @param options.orderBy 排序字段
   * @returns 文档数组
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
   * 获取所有活跃文档
   * @param options 查询选项
   * @param options.status 状态过滤
   * @param options.limit 结果数量限制
   * @param options.orderBy 排序字段
   * @returns 文档数组
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

      return await this.performPagination(paginationOptions, queryBuilder);
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
   * 执行分页查询
   * @param paginationOptions 分页选项
   * @param queryBuilder 查询构建器
   * @returns 分页结果
   */
  protected async performPagination(
    paginationOptions: PaginationOptions,
    queryBuilder: SelectQueryBuilder<Doc>,
  ): Promise<PaginatedResult<Doc>> {
    const { page = 1, limit = 10 } = paginationOptions;
    const skip = (page - 1) * limit;

    // 添加排序（如果尚未添加）
    if (
      !queryBuilder.expressionMap.orderBys ||
      Object.keys(queryBuilder.expressionMap.orderBys).length === 0
    ) {
      queryBuilder.orderBy('doc.created_at', 'DESC');
    }

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
    try {
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
    } catch (error) {
      this.logger.error(`分页查找文档失败`, {
        page,
        limit,
        orderBy,
        error: (error as Error).message,
      });
      throw error;
    }
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
   * 批量查找内容哈希
   * @param contentHashes 内容哈希数组
   * @returns 文档数组
   */
  async findByContentHashes(contentHashes: string[]): Promise<Doc[]> {
    try {
      if (contentHashes.length === 0) {
        return [];
      }

      const repository = this.dataSource.getRepository(Doc);
      const results = await repository.find({
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
}
