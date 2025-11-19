import { DataSource, FindOptionsWhere, Not, In, Between, FindManyOptions } from 'typeorm';
import {
  BaseRepository,
  PaginationOptions,
  PaginationResult,
} from './BaseRepository.js';
import { Doc } from '../entities/Doc.js';
import { Logger } from '@logging/logger.js';
import { DocId, CollectionId } from '@domain/entities/types.js';

/**
 * 简化的文档查询功能
 * 提供基本的查询操作
 */
export class SimplifiedDocQueries extends BaseRepository<Doc> {
  constructor(dataSource: DataSource, logger: Logger) {
    super(dataSource, Doc, logger);
  }

  /**
   * 根据docId查找文档
   * @param docId - 文档ID
   * @returns 找到的文档或null
   */
  async findById(docId: string): Promise<Doc | null> {
    try {
      return await this.findOne({ docId } as FindOptionsWhere<Doc>);
    } catch (error) {
      this.logger.error(`根据docId查找文档失败`, {
        docId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 根据集合ID和键值查找文档
   * @param collectionId - 集合ID
   * @param key - 文档键值
   * @returns 找到的文档或null
   */
  async findByCollectionAndKey(
    collectionId: CollectionId,
    key: string,
  ): Promise<Doc | null> {
    try {
      return await this.findOne({
        collectionId,
        key,
        deleted: false,
      } as FindOptionsWhere<Doc>);
    } catch (error) {
      this.logger.error(`根据集合ID和键值查找文档失败`, {
        collectionId,
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 根据内容哈希查找文档
   * @param contentHash - 内容哈希值
   * @returns 找到的文档或null
   */
  async findByContentHash(contentHash: string): Promise<Doc | null> {
    try {
      return await this.findOne({
        contentHash,
        deleted: false,
      } as FindOptionsWhere<Doc>);
    } catch (error) {
      this.logger.error(`根据内容哈希查找文档失败`, {
        contentHash,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 根据多个内容哈希批量查找文档
   * @param contentHashes - 内容哈希值数组
   * @returns 找到的文档数组
   */
  async findByContentHashes(contentHashes: string[]): Promise<Doc[]> {
    try {
      if (contentHashes.length === 0) {
        return [];
      }

      return await this.findAll({
        where: {
          contentHash: In(contentHashes),
          deleted: false,
        } as FindOptionsWhere<Doc>,
      });
    } catch (error) {
      this.logger.error(`根据内容哈希批量查找文档失败`, {
        contentHashCount: contentHashes.length,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 根据集合ID查找文档
   * @param collectionId - 集合ID
   * @param options - 查询选项
   * @param options.status - 可选的状态过滤器
   * @param options.limit - 可选的限制数量
   * @param options.orderBy - 可选的排序字段
   * @returns 找到的文档数组
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
      const whereCondition: FindOptionsWhere<Doc> = {
        collectionId,
        deleted: false,
      };

      if (options.status) {
        whereCondition.status = options.status;
      }

      const queryOptions: FindManyOptions<Doc> = {
        where: whereCondition,
        order: options.orderBy || { created_at: 'DESC' },
      };

      if (options.limit) {
        queryOptions.take = options.limit;
      }

      return await this.findAll(queryOptions);
    } catch (error) {
      this.logger.error(`根据集合ID查找文档失败`, {
        collectionId,
        options,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 查找所有活跃文档
   * @param options - 查询选项
   * @param options.status - 可选的状态过滤器
   * @param options.limit - 可选的限制数量
   * @param options.orderBy - 可选的排序字段
   * @returns 找到的文档数组
   */
  async findAllActive(
    options: {
      status?: 'new' | 'processing' | 'completed' | 'failed';
      limit?: number;
      orderBy?: Record<string, 'ASC' | 'DESC'>;
    } = {},
  ): Promise<Doc[]> {
    try {
      const whereCondition: FindOptionsWhere<Doc> = {
        deleted: false,
      };

      if (options.status) {
        whereCondition.status = options.status;
      }

      const queryOptions: FindManyOptions<Doc> = {
        where: whereCondition,
        order: options.orderBy || { created_at: 'DESC' },
      };

      if (options.limit) {
        queryOptions.take = options.limit;
      }

      return await this.findAll(queryOptions);
    } catch (error) {
      this.logger.error(`查找所有活跃文档失败`, {
        options,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 分页查找文档
   * @param paginationOptions - 分页选项
   * @param collectionId - 可选的集合ID过滤器
   * @param status - 可选的状态过滤器
   * @returns 分页结果
   */
  async findWithPagination(
    paginationOptions: PaginationOptions,
    collectionId?: CollectionId,
    status?: 'new' | 'processing' | 'completed' | 'failed',
  ): Promise<PaginationResult<Doc>> {
    try {
      const whereCondition: FindOptionsWhere<Doc> = {
        deleted: false,
      };

      if (collectionId) {
        whereCondition.collectionId = collectionId;
      }

      if (status) {
        whereCondition.status = status;
      }

      const options = {
        where: whereCondition,
        order: { created_at: 'DESC' },
      };

      return await super.findWithPagination(
        paginationOptions.page,
        paginationOptions.pageSize,
        options,
      );
    } catch (error) {
      this.logger.error(`分页查找文档失败`, {
        paginationOptions,
        collectionId,
        status,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 获取文档数量
   * @param collectionId - 可选的集合ID过滤器
   * @param status - 可选的状态过滤器
   * @returns 文档数量
   */
  async getCount(
    collectionId?: CollectionId,
    status?: 'new' | 'processing' | 'completed' | 'failed',
  ): Promise<number> {
    try {
      const whereCondition: FindOptionsWhere<Doc> = {
        deleted: false,
      };

      if (collectionId) {
        whereCondition.collectionId = collectionId;
      }

      if (status) {
        whereCondition.status = status;
      }

      return await this.count(whereCondition);
    } catch (error) {
      this.logger.error(`获取文档数量失败`, {
        collectionId,
        status,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 根据状态查找文档
   * @param status - 文档状态
   * @returns 找到的文档数组
   */
  async findByStatus(status: string): Promise<Doc[]> {
    try {
      return await this.findAll({
        where: { status, deleted: false },
        order: { created_at: 'DESC' },
      });
    } catch (error) {
      this.logger.error(`根据状态查找文档失败`, {
        status,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 根据集合ID和状态查找文档
   * @param collectionId - 集合ID
   * @param status - 文档状态
   * @returns 找到的文档数组
   */
  async findByCollectionIdAndStatus(
    collectionId: CollectionId,
    status: string,
  ): Promise<Doc[]> {
    try {
      return await this.findAll({
        where: { collectionId, status, deleted: false },
        order: { created_at: 'DESC' },
      });
    } catch (error) {
      this.logger.error(`根据集合ID和状态查找文档失败`, {
        collectionId,
        status,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 查找已删除的文档
   * @param collectionId - 可选的集合ID过滤器
   * @returns 找到的已删除文档数组
   */
  async findDeleted(collectionId?: CollectionId): Promise<Doc[]> {
    try {
      const whereCondition: FindOptionsWhere<Doc> = {
        deleted: true,
      };

      if (collectionId) {
        whereCondition.collectionId = collectionId;
      }

      return await this.findAll({
        where: whereCondition,
        order: { updated_at: 'DESC' },
      });
    } catch (error) {
      this.logger.error(`查找已删除文档失败`, {
        collectionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 查找失败的文档
   * @param collectionId - 可选的集合ID过滤器
   * @returns 找到的失败文档数组
   */
  async findFailed(collectionId?: CollectionId): Promise<Doc[]> {
    try {
      const whereCondition: FindOptionsWhere<Doc> = {
        status: 'failed',
        deleted: false,
      };

      if (collectionId) {
        whereCondition.collectionId = collectionId;
      }

      return await this.findAll({
        where: whereCondition,
        order: { updated_at: 'DESC' },
      });
    } catch (error) {
      this.logger.error(`查找失败文档失败`, {
        collectionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 查找已完成的文档
   * @param collectionId - 可选的集合ID过滤器
   * @returns 找到的已完成文档数组
   */
  async findCompleted(collectionId?: CollectionId): Promise<Doc[]> {
    try {
      const whereCondition: FindOptionsWhere<Doc> = {
        status: 'completed',
        deleted: false,
      };

      if (collectionId) {
        whereCondition.collectionId = collectionId;
      }

      return await this.findAll({
        where: whereCondition,
        order: { updated_at: 'DESC' },
      });
    } catch (error) {
      this.logger.error(`查找已完成文档失败`, {
        collectionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 分页查找文档（简化版）
   * @param page - 页码（从1开始）
   * @param limit - 每页数量
   * @param orderBy - 可选的排序字段
   * @returns 分页结果
   */
  async findPaginated(
    page: number,
    limit: number,
    orderBy?: Record<string, 'ASC' | 'DESC'>,
  ): Promise<PaginationResult<Doc>> {
    try {
      const options = {
        where: { deleted: false },
        order: orderBy || { created_at: 'DESC' },
      };

      return await super.findWithPagination(page, limit, options);
    } catch (error) {
      this.logger.error(`分页查找文档失败`, {
        page,
        limit,
        orderBy,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 根据集合ID分页查找文档并排序
   * @param collectionId - 集合ID
   * @param pagination - 分页选项
   * @param orderBy - 可选的排序字段
   * @returns 分页结果
   */
  async findByCollectionIdPaginatedWithSorting(
    collectionId: CollectionId,
    pagination: PaginationOptions,
    orderBy?: Record<string, 'ASC' | 'DESC'>,
  ): Promise<PaginationResult<Doc>> {
    try {
      const options = {
        where: { collectionId, deleted: false },
        order: orderBy || { created_at: 'DESC' },
      };

      return await super.findWithPagination(
        pagination.page,
        pagination.pageSize,
        options,
      );
    } catch (error) {
      this.logger.error(`根据集合ID分页查找文档失败`, {
        collectionId,
        pagination,
        orderBy,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
