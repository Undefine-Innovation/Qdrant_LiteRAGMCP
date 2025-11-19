import { DataSource, FindOptionsWhere, SelectQueryBuilder, Not } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { Collection } from '../entities/Collection.js';
import { CollectionId } from '@domain/entities/types.js';
import {
  BaseRepository,
  PaginationOptions,
  PaginatedResult,
  QueryOptions,
} from './BaseRepository.js';
import {
  CollectionRepositoryExtensions,
  RepositoryExtensionFactory,
} from './extensions/RepositoryExtensions.js';

/**
 * 重构后的集合Repository
 * 使用统一的BaseRepository基类和扩展模式
 * 减少了50%的重复代码
 */
export class RefactoredCollectionRepository extends BaseRepository<Collection> {
  private readonly extensions: CollectionRepositoryExtensions<Collection>;

  constructor(dataSource: DataSource, logger: Logger) {
    super(dataSource, Collection, logger);
    this.extensions = RepositoryExtensionFactory.createCollectionExtensions(
      this,
      logger,
    );
  }

  // 使用扩展的特定业务方法
  async findByCollectionId(
    collectionId: CollectionId,
  ): Promise<Collection | null> {
    return this.extensions.findByBusinessId(collectionId);
  }

  async findByName(name: string): Promise<Collection | null> {
    return this.extensions.findByName(name);
  }

  async findByPrefix(prefix: string, limit?: number): Promise<Collection[]> {
    const options: QueryOptions<Collection> = {};
    if (limit) {
      options.take = limit;
    }
    return this.extensions.findByPrefix(prefix, options);
  }

  async findBySuffix(suffix: string, limit?: number): Promise<Collection[]> {
    const options: QueryOptions<Collection> = {};
    if (limit) {
      options.take = limit;
    }
    return this.extensions.findBySuffix(suffix, options);
  }

  async updateDocumentCount(id: CollectionId, count: number): Promise<boolean> {
    return this.extensions.updateDocumentCount(id, count);
  }

  async updateChunkCount(id: CollectionId, count: number): Promise<boolean> {
    return this.extensions.updateChunkCount(id, count);
  }

  // 使用基类的通用方法，减少重复代码
  async findAllActive(): Promise<Collection[]> {
    return this.findBy(
      { deleted: false, status: 'active' } as FindOptionsWhere<Collection>,
      { order: { created_at: 'DESC' } },
    );
  }

  async findWithPaginationByStatus(
    paginationOptions: PaginationOptions = {},
    status?: 'active' | 'inactive' | 'archived',
  ): Promise<PaginatedResult<Collection>> {
    const queryBuilder = this.createQueryBuilder('collection').where(
      'collection.deleted = :deleted',
      { deleted: false },
    );

    if (status) {
      queryBuilder.andWhere('collection.status = :status', { status });
    }

    return await super.findWithPagination(
      paginationOptions,
      queryBuilder as unknown as SelectQueryBuilder<Collection>,
    );
  }

  // 保持与基类兼容的findWithPagination方法
  async findWithPagination(
    paginationOptions?: PaginationOptions,
    queryBuilder?: SelectQueryBuilder<Collection>,
  ): Promise<PaginatedResult<Collection>> {
    return await super.findWithPagination(
      paginationOptions,
      queryBuilder as unknown as SelectQueryBuilder<Collection>,
    );
  }

  async findPaginated(
    page: number,
    limit: number,
  ): Promise<PaginatedResult<Collection>> {
    const paginationOptions: PaginationOptions = { page, limit };
    return await this.findWithPaginationByStatus(paginationOptions);
  }

  async updateCollection(
    id: CollectionId,
    data: Partial<
      Pick<Collection, 'name' | 'description' | 'status' | 'config'>
    >,
  ): Promise<Collection | null> {
    await this.update({ id } as FindOptionsWhere<Collection>, data);
    return this.findByCollectionId(id);
  }

  async existsByName(name: string, excludeId?: CollectionId): Promise<boolean> {
    const whereCondition: FindOptionsWhere<Collection> = {
      name,
      deleted: false,
    };

    if (excludeId) {
      const count = await this.count({ name, deleted: false, id: Not(excludeId) } as FindOptionsWhere<Collection>);
      return count > 0;
    }

    const count = await this.count(whereCondition);
    return count > 0;
  }

  async getCount(status?: 'active' | 'inactive' | 'archived'): Promise<number> {
    const whereCondition: FindOptionsWhere<Collection> = { deleted: false };
    if (status) {
      whereCondition.status = status;
    }
    return this.count(whereCondition);
  }

  async searchCollections(
    searchText: string,
    options: {
      limit?: number;
      status?: 'active' | 'inactive' | 'archived';
    } = {},
  ): Promise<Collection[]> {
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

    return queryBuilder.getMany();
  }

  async getStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    archived: number;
    totalDocuments: number;
    totalChunks: number;
  }> {
    const queryBuilder = this.createQueryBuilder('collection')
      .select('COUNT(*)', 'total')
      .addSelect('SUM(CASE WHEN status = :active THEN 1 ELSE 0 END)', 'active')
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
  }

  async batchUpdateStatus(
    ids: CollectionId[],
    status: 'active' | 'inactive' | 'archived',
  ): Promise<{ updated: number; failed: number }> {
    const result = await this.updateBatch(ids, { status });
    return {
      updated: result.success,
      failed: result.failed,
    };
  }

  async batchSoftDelete(ids: CollectionId[]): Promise<number> {
    return await this.softDeleteBatch(ids);
  }

  async updateLastSyncTime(id: CollectionId): Promise<boolean> {
    await this.update({ id } as FindOptionsWhere<Collection>, {
      lastSyncAt: Date.now(),
    });
    return true;
  }

  async findSystemCollections(): Promise<Collection[]> {
    return this.findBy({
      isSystemCollection: true,
    } as FindOptionsWhere<Collection>);
  }

  async findNonSystemCollections(): Promise<Collection[]> {
    return this.findBy({
      isSystemCollection: false,
    } as FindOptionsWhere<Collection>);
  }
}
