/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  DataSource,
  EntityTarget,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
  SelectQueryBuilder,
  DeepPartial,
} from 'typeorm';
import type { MetricsCollector } from '../../monitoring/MetricsCollector.js';
import { Logger } from '@logging/logger.js';
import { CachedRepositoryBase } from '../../cache/QueryCache.js';

export interface PaginationOptions {
  page?: number;
  limit?: number;
  orderBy?: Record<string, 'ASC' | 'DESC'>;
}

export interface PaginatedResult<T> {
  data: T[];
  items?: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface BatchOperationResult {
  success: number;
  failed: number;
  errors?: string[];
  updated?: number;
}

export declare class BaseRepository<
  T extends ObjectLiteral,
> extends CachedRepositoryBase {
  [key: string]: any;
  protected readonly dataSource: DataSource;
  protected readonly entity: EntityTarget<T>;
  protected readonly logger: Logger;
  protected readonly metricsCollector?: MetricsCollector;
  protected readonly repository: Repository<T>;
  protected readonly entityName: string;

  constructor(
    dataSource: DataSource,
    entity: EntityTarget<T>,
    logger: Logger,
    metricsCollector?: MetricsCollector,
    cacheConfig?: import('../../cache/QueryCache.js').QueryCacheConfig,
  );

  create(data: DeepPartial<T>): Promise<T>;
  createOrUpdate(data: DeepPartial<T>): Promise<T>;
  createBatch(data: DeepPartial<T>[], batchSize?: number): Promise<T[]>;
  createBatchWithManager(
    manager: unknown,
    data: DeepPartial<T>[],
    batchSize?: number,
  ): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  findByIds(ids: string[]): Promise<T[]>;
  findOne(options: FindOneOptions<T>): Promise<T | null>;
  findAll(options?: FindManyOptions<T>): Promise<T[]>;
  findWithPagination(
    paginationOptions?: PaginationOptions,
    query?: string | SelectQueryBuilder<T> | FindOptionsWhere<T>,
  ): Promise<PaginatedResult<T>>;
  findByTimeRange(...args: any[]): Promise<T[]>;
  findByFuzzySearch(
    fieldName: string,
    searchText: string,
    options?: FindManyOptions<T>,
  ): Promise<T[]>;
  findWithQuery(queryBuilder: SelectQueryBuilder<T>): Promise<T[]>;
  count(where?: FindOptionsWhere<T>): Promise<number>;
  getStatistics(...args: any[]): Promise<Record<string, number>>;
  update(criteria: any, data: DeepPartial<T>): Promise<any>;
  delete(criteria: any): Promise<any>;
  softDelete(criteria: any): Promise<any>;
  updateBatch(
    ids: (string | number)[],
    data: DeepPartial<T>,
    batchSize?: number,
  ): Promise<BatchOperationResult>;
  softDeleteBatch(
    ids: (string | number)[],
    batchSize?: number,
  ): Promise<number>;
  clearCache(): Promise<void>;
  destroy(): Promise<void>;
  executeRawQuery(query: string, parameters?: unknown[]): Promise<unknown>;
  createQueryBuilder(alias?: string): SelectQueryBuilder<T>;
  getRepository(): Repository<T>;
}
