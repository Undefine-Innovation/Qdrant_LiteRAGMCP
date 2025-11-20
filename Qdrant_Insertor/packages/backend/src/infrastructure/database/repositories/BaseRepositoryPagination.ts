import {
  DataSource,
  EntityTarget,
  ObjectLiteral,
  Repository,
  SelectQueryBuilder,
  FindManyOptions,
  FindOptionsOrder,
} from 'typeorm';
import { Logger } from '@logging/logger.js';

/**
 * 分页选项接口
 */
export interface PaginationOptions {
  page: number;
  pageSize: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

/**
 * 分页结果接口
 */
export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * BaseRepository分页功能
 * 提供分页相关操作
 */
export class BaseRepositoryPagination<T extends ObjectLiteral> {
  /**
   * 创建BaseRepositoryPagination实例
   * @param dataSource TypeORM数据源
   * @param entity 实体类
   * @param logger 日志记录器
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly entity: EntityTarget<T>,
    private readonly logger: Logger,
  ) {}

  /**
   * 获取Repository实例
   * @returns {Repository<T>} Repository实例
   */
  protected getRepository(): Repository<T> {
    return this.dataSource.getRepository(this.entity);
  }

  /**
   * 分页查询实体
   * @param page 页码
   * @param pageSize 每页大小
   * @param options 查询选项
   * @returns 分页结果
   */
  async findWithPagination(
    page: number,
    pageSize: number,
    options?: FindManyOptions<T> & { orderBy?: string; orderDirection?: 'ASC' | 'DESC' },
  ): Promise<PaginationResult<T>> {
    try {
      const repository = this.getRepository();
      const skip = (page - 1) * pageSize;

      // 构建查询选项
      const queryOptions: FindManyOptions<T> = {
        skip,
        take: pageSize,
        ...(options as FindManyOptions<T>),
      };

      // 如果有排序选项，添加到查询中
      if (options && (options as { orderBy?: string }).orderBy) {
        const o = options as { orderBy?: string; orderDirection?: 'ASC' | 'DESC' };
        queryOptions.order = {
          [o.orderBy as string]: (o.orderDirection || 'ASC') as 'ASC' | 'DESC',
        } as unknown as FindOptionsOrder<T>;
      }

      // 并行执行查询和计数
      const whereVal = options ? (options as FindManyOptions<T> & { where?: FindOptionsOrder<T> }).where : undefined;
      const whereCountArg = whereVal ? { where: whereVal } : {};
      const [data, total] = (await Promise.all([
        repository.find(queryOptions),
        repository.count(whereCountArg),
      ])) as [T[], number];

      // 计算分页信息
      const totalPages = Math.ceil(total / pageSize);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      this.logger.debug(`分页查询成功`, {
        page,
        pageSize,
        total,
        totalPages,
      });

      return {
        data,
        total,
        page,
        pageSize,
        totalPages,
        hasNext,
        hasPrev,
      };
    } catch (error) {
      this.logger.error(`分页查询失败`, {
        page,
        pageSize,
        options,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 使用QueryBuilder进行分页查询
   * @param queryBuilder QueryBuilder实例
   * @param page 页码
   * @param pageSize 每页大小
   * @returns 分页结果
   */
  async findWithPaginationByQueryBuilder(
    queryBuilder: SelectQueryBuilder<T>,
    page: number,
    pageSize: number,
  ): Promise<PaginationResult<T>> {
    try {
      const skip = (page - 1) * pageSize;

      // 克隆QueryBuilder用于计数
      const countQueryBuilder = queryBuilder.clone();

      // 并行执行查询和计数
      const [data, totalResult] = await Promise.all([
        queryBuilder.skip(skip).take(pageSize).getMany(),
        countQueryBuilder.getCount(),
      ]);

      const total = typeof totalResult === 'number' ? totalResult : 0;

      // 计算分页信息
      const totalPages = Math.ceil(total / pageSize);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      this.logger.debug(`QueryBuilder分页查询成功`, {
        page,
        pageSize,
        total,
        totalPages,
      });

      return {
        data,
        total,
        page,
        pageSize,
        totalPages,
        hasNext,
        hasPrev,
      };
    } catch (error) {
      this.logger.error(`QueryBuilder分页查询失败`, {
        page,
        pageSize,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
