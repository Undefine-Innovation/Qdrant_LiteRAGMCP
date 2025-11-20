import {
  In,
  Between,
  ILike,
  DataSource,
  Repository,
  ObjectLiteral,
  DeepPartial,
  FindOptionsWhere,
  FindOptionsOrder,
  SelectQueryBuilder,
  FindManyOptions,
  FindOneOptions,
} from 'typeorm';
import { Logger } from '@logging/logger.js';
import { CachedRepositoryBase, QueryCacheConfig } from '../cache/QueryCache.js';

// Create a null logger for when no logger is provided
const createNullLogger = (): Logger => ({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
});

// Export types used by derived repositories
export interface PaginationOptions {
  page?: number;
  limit?: number;
  // Backwards-compatible alias used in older code
  pageSize?: number;
  orderBy?: Record<string, 'ASC' | 'DESC'>;
}

export interface PaginatedResult<T> {
  data: T[];
  items?: T[]; // Backward compatibility alias
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Backwards-compatible aliases for older imports
export type PaginationResult<T> = PaginatedResult<T>;

export interface QueryOptions<T = unknown> {
  where?: FindOptionsWhere<T> | FindOptionsWhere<T>[];
  order?: FindOptionsOrder<T>;
  take?: number;
  skip?: number;
  limit?: number;
  page?: number;
  pageSize?: number;
  [key: string]: unknown;
}

export interface BatchOperationResult {
  success: number;
  failed: number;
  errors?: unknown[];
  updated?: number; // Backward compatibility
}

/**
 * 基础TypeORM Repository类（TypeScript版本）
 * 提供通用的CRUD操作和错误处理
 * 优化了查询性能和批量操作
 * 集成了缓存和监控功能
 */
export class BaseRepository<
  T extends ObjectLiteral = ObjectLiteral,
> extends CachedRepositoryBase {
  dataSource: DataSource | undefined;
  entity: (new () => T) | string;
  // Use definite assignment so derived code can access `this.repository` without
  // TypeScript complaining about it being possibly undefined. The code still
  // performs runtime checks via getRepositoryOrThrow when needed.
  repository!: Repository<T>;
  entityName: string;
  // Public logger for derived classes - always initialized to avoid undefined errors
  declare public logger: Logger;

  constructor(
    dataSource: DataSource | undefined,
    entity: (new () => T) | string,
    logger?: Logger,
    metricsCollector?: Record<string, unknown>,
    cacheConfig?: QueryCacheConfig,
  ) {
    // Adapt Logger (optional methods) to the stricter Logger interface
    const loggerForCache: Logger | undefined = logger
      ? {
          debug: (message: string, ...args: unknown[]) =>
            logger.debug?.(message, ...args),
          info: (message: string, ...args: unknown[]) =>
            logger.info?.(message, ...args),
          warn: (message: string, ...args: unknown[]) =>
            logger.warn?.(message, ...args),
          error: (message: string, ...args: unknown[]) =>
            logger.error?.(message, ...args),
        }
      : undefined;

    super(loggerForCache, cacheConfig);
    this.dataSource = dataSource;
    this.entity = entity;
    // Only assign repository when a DataSource is provided. We use a
    // definite assignment (`repository!`) so callers that assume a
    // repository exists do not get `possibly undefined` TS errors.
    if (dataSource) {
      this.repository = dataSource.getRepository(entity) as Repository<T>;
    }
    this.entityName = this.getEntityName();
    // Ensure logger is always available (use adapted Logger for strict type)
    this.logger = loggerForCache || createNullLogger();
  }

  getEntityName(): string {
    if (typeof this.entity === 'string') return this.entity;
    if (typeof this.entity === 'function') return this.entity.name;
    return 'Unknown';
  }

  // Helper method for derived classes
  // Return a non-optional Repository - throw if not initialized.
  protected getRepository(): Repository<T> {
    return this.getRepositoryOrThrow();
  }

  // Helper method for derived classes - throws if repository not initialized
  protected getRepositoryOrThrow(): Repository<T> {
    if (!this.repository) throw new Error('Repository not initialized');
    return this.repository;
  }

  // Helper method for derived classes - throws if dataSource not initialized
  protected getDataSourceOrThrow(): DataSource {
    if (!this.dataSource) throw new Error('DataSource not initialized');
    return this.dataSource;
  }

  // Standardized error handler for repositories - logs and re-throws
  protected handleError(
    message: string,
    error: unknown,
    meta?: Record<string, unknown>,
  ): never {
    try {
      this.logger.error(message, {
        ...meta,
        error: error instanceof Error ? error.message : String(error),
      });
    } catch (e) {
      // ensure we do not mask the original error
    }
    if (error instanceof Error) throw error;
    throw new Error(String(error));
  }

  async create(data: DeepPartial<T>): Promise<T> {
    if (!this.repository) throw new Error('Repository not initialized');
    const entity = this.repository.create(data);
    const result = await this.repository.save(entity);
    return result as T;
  }

  async createBatch(dataList: DeepPartial<T>[], batchSize = 100): Promise<T[]> {
    if (!this.repository) throw new Error('Repository not initialized');
    const results: T[] = [];
    for (let i = 0; i < dataList.length; i += batchSize) {
      const batch = dataList.slice(i, i + batchSize);
      const entities = batch.map((d) => this.repository!.create(d));
      const batchResults = await this.repository.save(entities);
      results.push(...(batchResults as T[]));
    }
    return results;
  }

  async findById(
    id: string | number,
    options?: FindOneOptions<T>,
  ): Promise<T | null> {
    if (!this.repository) throw new Error('Repository not initialized');
    const whereCondition: FindOptionsWhere<T> = {
      id,
    } as unknown as FindOptionsWhere<T>;
    return (
      (await this.repository.findOne({
        where: whereCondition,
        ...(options || {}),
      })) || null
    );
  }

  async findByIds(
    ids: (string | number)[],
    options?: FindManyOptions<T>,
  ): Promise<T[]> {
    if (!this.repository) throw new Error('Repository not initialized');
    if (ids.length === 0) return [];
    const whereCondition: FindOptionsWhere<T> = {
      id: In(ids),
    } as unknown as FindOptionsWhere<T>;
    return this.repository.find({ where: whereCondition, ...(options || {}) });
  }

  async findAll(options?: FindManyOptions<T>): Promise<T[]> {
    if (!this.repository) throw new Error('Repository not initialized');
    return this.repository.find(options || {});
  }

  async findBy(
    where: Record<string, unknown>,
    options?: FindManyOptions<T>,
  ): Promise<T[]> {
    if (!this.repository) throw new Error('Repository not initialized');
    const whereCondition: FindOptionsWhere<T> =
      where as unknown as FindOptionsWhere<T>;
    return this.repository.find({ where: whereCondition, ...(options || {}) });
  }

  async findOneBy(
    where: Record<string, unknown>,
    options?: FindOneOptions<T>,
  ): Promise<T | null> {
    if (!this.repository) throw new Error('Repository not initialized');
    const whereCondition: FindOptionsWhere<T> =
      where as unknown as FindOptionsWhere<T>;
    return (
      (await this.repository.findOne({
        where: whereCondition,
        ...(options || {}),
      })) || null
    );
  }

  async count(
    where?:
      | FindOptionsWhere<T>
      | FindOptionsWhere<T>[]
      | Record<string, unknown>,
  ): Promise<number> {
    if (!this.repository) throw new Error('Repository not initialized');
    const whereCondition: FindOptionsWhere<T> | FindOptionsWhere<T>[] =
      (where || {}) as unknown as FindOptionsWhere<T> | FindOptionsWhere<T>[];
    return this.repository.count({ where: whereCondition });
  }

  async update(
    criteria: Record<string, unknown> | string | number,
    data: DeepPartial<T>,
  ): Promise<unknown> {
    if (!this.repository) throw new Error('Repository not initialized');
    let whereCondition: FindOptionsWhere<T>;
    if (typeof criteria === 'string' || typeof criteria === 'number') {
      whereCondition = { id: criteria } as unknown as FindOptionsWhere<T>;
    } else {
      whereCondition = criteria as unknown as FindOptionsWhere<T>;
    }
    // TypeScript 类型问题：TypeORM 的 _QueryDeepPartialEntity 与我们的 DeepPartial 类型签名不兼容
    // 通过 unknown->any 转换来满足 TypeScript，同时委托给 TypeORM 运行时处理
    const result = await this.repository
      .createQueryBuilder()
      .update()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set(data as unknown as any) // TypeORM 的 _QueryDeepPartialEntity 与我们的泛型类型系统不兼容
      .where(whereCondition)
      .execute();
    return { affected: result.affected || 0 };
  }

  async delete(
    criteria: Record<string, unknown> | string | number,
  ): Promise<unknown> {
    if (!this.repository) throw new Error('Repository not initialized');
    const whereCondition: FindOptionsWhere<T> = (
      typeof criteria === 'string' || typeof criteria === 'number'
        ? ({ id: criteria } as unknown)
        : (criteria as unknown)
    ) as FindOptionsWhere<T>;
    return this.repository.delete(whereCondition);
  }

  async softDelete(criteria: Record<string, unknown>): Promise<unknown> {
    if (!this.repository) throw new Error('Repository not initialized');
    const whereCondition = criteria as unknown as FindOptionsWhere<T>;
    const updateData = { deleted: true, deleted_at: new Date() };
    // TypeScript 类型问题：TypeORM 的 _QueryDeepPartialEntity 与我们的泛型类型系统不兼容
    return this.repository
      .createQueryBuilder()
      .update()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set(updateData as unknown as any) // TypeORM 的 _QueryDeepPartialEntity 与我们的泛型类型系统不兼容
      .where(whereCondition)
      .execute();
  }

  async updateBatch(
    ids: (string | number)[],
    data: DeepPartial<T>,
    batchSize = 100,
  ): Promise<BatchOperationResult> {
    if (!this.repository) throw new Error('Repository not initialized');
    let success = 0;
    let failed = 0;
    const errors: string[] = [];
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      for (const id of batch) {
        try {
          const whereCondition = { id } as unknown as FindOptionsWhere<T>;
          // TypeScript 类型问题：TypeORM 的 _QueryDeepPartialEntity 与我们的泛型类型系统不兼容
          await this.repository
            .createQueryBuilder()
            .update()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .set(data as unknown as any) // TypeORM 的 _QueryDeepPartialEntity 与我们的泛型类型系统不兼容
            .where(whereCondition)
            .execute();
          success++;
        } catch (error: unknown) {
          failed++;
          const message =
            error instanceof Error ? error.message : String(error);
          errors.push(`ID ${id}: ${message}`);
        }
      }
    }
    // 只在有错误时返回 errors 字段，以保持向后兼容性
    const result: BatchOperationResult = { success, failed, errors: [] };
    if (errors.length > 0) {
      result.errors = errors;
    }
    return result;
  }

  async softDeleteBatch(
    ids: (string | number)[],
    batchSize = 100,
  ): Promise<number> {
    if (!this.repository) throw new Error('Repository not initialized');
    let deletedCount = 0;
    const updateData = { deleted: true, deleted_at: new Date() };
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const whereCondition = {
        id: In(batch),
      } as unknown as FindOptionsWhere<T>;
      // TypeScript 类型问题：TypeORM 的 _QueryDeepPartialEntity 与我们的泛型类型系统不兼容
      // TypeORM 需要特定的内部类型，与我们的泛型类型冲突
      const result = await this.repository
        .createQueryBuilder()
        .update()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .set(updateData as unknown as any) // TypeORM 的 _QueryDeepPartialEntity 与我们的泛型类型系统不兼容
        .where(whereCondition)
        .execute();
      deletedCount += result.affected || 0;
    }
    return deletedCount;
  }

  async findWithPagination(
    paginationOptions?: unknown,
    pageSizeOrQuery?: unknown,
    maybeQuery?: unknown,
  ): Promise<PaginatedResult<T>> {
    if (!this.repository) throw new Error('Repository not initialized');

    // Support legacy signature: (page: number, pageSize: number, options?)
    let page = 1;
    let limit = 10;
    let orderBy: Record<string, 'ASC' | 'DESC'> | undefined;
    let query: unknown | undefined;

    if (typeof paginationOptions === 'number') {
      page = paginationOptions;
      if (typeof pageSizeOrQuery === 'number') limit = pageSizeOrQuery;
      if (maybeQuery !== undefined) query = maybeQuery;
    } else {
      const opts = (paginationOptions || {}) as PaginationOptions;
      page = opts.page ?? 1;
      limit = opts.limit ?? opts.pageSize ?? 10;
      orderBy = opts.orderBy;
      query = pageSizeOrQuery;
    }

    const skip = (page - 1) * limit;
    let queryBuilder = this.repository.createQueryBuilder();

    if (typeof query === 'string') {
      queryBuilder = queryBuilder.where(query);
    } else if (query && typeof (query as Record<string, unknown>).getQuery === 'function') {
      queryBuilder = query as SelectQueryBuilder<T>;
    }

    if (orderBy) {
      Object.entries(orderBy).forEach(([field, direction]) => {
        queryBuilder.addOrderBy(field, direction);
      });
    }

    const total = await queryBuilder.getCount();
    const data = await queryBuilder.skip(skip).take(limit).getMany();
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

  // Execute a raw query against the data source
  async executeQuery(query: string, params?: unknown[]): Promise<Array<Record<string, unknown>>> {
    const ds = this.getDataSourceOrThrow();
    // TypeORM DataSource exposes `query` for raw SQL
    // Cast to a minimal query-caller shape to avoid `any` in public API
    const q = ds as unknown as { query: (q: string, p?: unknown[]) => Promise<Array<Record<string, unknown>>> };
    return q.query(query, params || []);
  }

  async findByTimeRange(...args: unknown[]): Promise<T[]> {
    if (!this.repository) throw new Error('Repository not initialized');
    // Support multiple signatures:
    // findByTimeRange(startTime: number, endTime: number)
    // findByTimeRange(fieldName: string, startTime: number | Date, endTime: number | Date, options?)
    if (args.length === 2) {
      // Direct timestamp range (startTime: number, endTime: number)
      const [startTime, endTime] = args as [number | Date, number | Date];
      const whereCondition: FindOptionsWhere<T> = {
        timestamp: Between(startTime, endTime),
      } as unknown as FindOptionsWhere<T>;
      return this.repository.find({ where: whereCondition });
    } else if (args.length >= 3) {
      // Field-based range (fieldName, startTime, endTime, options?)
      const [fieldName, startTime, endTime, options] = args;
      const whereCondition: FindOptionsWhere<T> = {
        [fieldName as string]: Between(startTime, endTime),
      } as unknown as FindOptionsWhere<T>;
      return this.repository.find({
        where: whereCondition,
        ...((options as Record<string, unknown>) || {}),
      });
    }
    return [];
  }

  async findByFuzzySearch(
    fieldName: string,
    searchText: string,
    options?: Record<string, unknown>,
  ): Promise<T[]> {
    if (!this.repository) throw new Error('Repository not initialized');
    const whereCondition: FindOptionsWhere<T> = {
      [fieldName]: ILike(`%${searchText}%`),
    } as unknown as FindOptionsWhere<T>;
    return this.repository.find({ where: whereCondition, ...(options || {}) } as FindManyOptions<T>);
  }

  async getStatistics(
    groupBy: string,
    where?: Record<string, unknown>,
  ): Promise<Record<string, number>> {
    if (!this.repository) throw new Error('Repository not initialized');
    const whereCondition: FindOptionsWhere<T> = (where ||
      {}) as unknown as FindOptionsWhere<T>;
    const results = await this.repository
      .createQueryBuilder()
      .select([`${groupBy}`, 'COUNT(*) as count'])
      .where(whereCondition)
      .groupBy(groupBy)
      .getRawMany();

    const statistics: Record<string, number> = {};
    for (const result of results) {
      if (result && typeof result === 'object') {
        const key = String((result as Record<string, unknown>)[groupBy]);
        const count = (result as Record<string, unknown>).count;
        statistics[key] =
          typeof count === 'string'
            ? parseInt(count, 10)
            : (count as number) || 0;
      }
    }
    return statistics;
  }

  async upsert(
    data: Partial<T>,
    identifierFields: string[] = ['id'],
  ): Promise<T> {
    if (!this.repository) throw new Error('Repository not initialized');
    const whereObj: Record<string, unknown> = {};
    for (const field of identifierFields) {
      if (field in (data as Record<string, unknown>)) {
        whereObj[field] = (data as Record<string, unknown>)[field];
      }
    }

    const whereCondition: FindOptionsWhere<T> =
      whereObj as unknown as FindOptionsWhere<T>;
    const existing = await this.repository.findOne({ where: whereCondition });
    if (existing) {
      // TypeScript 类型问题：TypeORM 的 _QueryDeepPartialEntity 与我们的泛型类型系统不兼容
      await this.repository
        .createQueryBuilder()
        .update()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .set(data as unknown as any) // TypeORM 的 _QueryDeepPartialEntity 与我们的泛型类型系统不兼容
        .where(whereCondition)
        .execute();
      const result = await this.repository.findOne({ where: whereCondition });
      return result as T;
    }
    return this.create(data as DeepPartial<T>);
  }

  createQueryBuilder(alias?: string): SelectQueryBuilder<T> {
    if (!this.repository) throw new Error('Repository not initialized');
    return this.repository.createQueryBuilder(alias || this.entityName) as SelectQueryBuilder<T>;
  }

  // Backward-compatible convenience method: findOne
  async findOne(options?: FindOneOptions<T>): Promise<T | null> {
    if (!this.repository) throw new Error('Repository not initialized');
    const opt = options as unknown;
    const where = (opt && (((opt as FindOneOptions<T>).where as unknown) || opt)) as unknown as FindOptionsWhere<T>;
    return (await this.repository.findOne({ where } as FindOneOptions<T>)) || null;
  }
}

