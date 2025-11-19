import { DataSource, ObjectLiteral, DeepPartial } from 'typeorm';
import {
  BaseRepository,
  PaginationOptions,
  PaginatedResult,
  QueryOptions,
} from './BaseRepository.js';
import {
  CollectionId,
  DocId,
  PointId,
  PaginationQuery,
} from '@domain/entities/types.js';

/**
 * 统一的Repository适配器
 * 提供通用的适配器模式，减少重复的适配器代码
 */
export class UnifiedRepositoryAdapter<T extends ObjectLiteral> {
  constructor(
    protected readonly repository: BaseRepository<T>,
    protected readonly dataSource: DataSource,
  ) {}

  /**
   * 获取数据源
   * @returns 数据源实例
   */
  get db(): DataSource {
    return this.dataSource;
  }

  /**
   * 根据ID获取实体
   * @param id 实体ID
   * @returns 实体或null
   */
  async getById(id: string | number): Promise<T | null> {
    return await this.repository.findById(id);
  }

  /**
   * 获取所有实体
   * @param options 查询选项
   * @returns 实体数组
   */
  async listAll(options?: QueryOptions<T>): Promise<T[]> {
    return await this.repository.findAll(options);
  }

  /**
   * 创建实体
   * @param data 实体数据
   * @returns 创建的实体
   */
  async create(data: Partial<T>): Promise<T> {
    return await this.repository.create(data as DeepPartial<T>);
  }

  /**
   * 更新实体
   * @param id 实体ID
   * @param data 更新数据
   * @returns 更新后的实体或null
   */
  async update(id: string | number, data: Partial<T>): Promise<T | null> {
    await this.repository.update({ id } as unknown as Record<string, unknown>, data as DeepPartial<T>);
    return await this.repository.findById(id);
  }

  /**
   * 删除实体
   * @param id 实体ID
   * @returns 删除是否成功
   */
  async delete(id: string | number): Promise<boolean> {
    try {
      await this.repository.delete({ id } as unknown as Record<string, unknown>);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 统计实体数量
   * @param options 查询选项
   * @returns 实体数量
   */
  async getCount(options?: QueryOptions<T>): Promise<number> {
    return await this.repository.count(options?.where as unknown as Record<string, unknown>);
  }

  /**
   * 分页获取实体
   * @param query 分页查询参数
   * @returns 分页结果
   */
  async listPaginated(query: PaginationQuery): Promise<PaginatedResult<T>> {
    const paginationOptions: PaginationOptions = {
      page: query.page,
      limit: query.limit,
    };
    return await this.repository.findWithPagination(paginationOptions);
  }

  /**
   * 检查连接状态
   * @returns 连接是否正常
   */
  async ping(): Promise<boolean> {
    try {
      await this.repository.count();
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * 集合适配器
 * 专门处理集合相关的适配逻辑
 */
export class UnifiedCollectionAdapter extends UnifiedRepositoryAdapter<Record<string, unknown>> {
  async getByName(name: string): Promise<Record<string, unknown> | null> {
    return (await this.repository.findOneBy({ name, deleted: false } as Record<string, unknown>)) as Record<string, unknown> | null;
  }

  async listPaginated(query: PaginationQuery): Promise<PaginatedResult<Record<string, unknown>>> {
    const paginationOptions: PaginationOptions = {
      page: query.page,
      limit: query.limit,
    };

    const queryBuilder = this.repository
      .createQueryBuilder('collection')
      .where('collection.deleted = :deleted', { deleted: false });

    return await this.repository.findWithPagination(
      paginationOptions,
      queryBuilder,
    );
  }
}

/**
 * 文档适配器
 * 专门处理文档相关的适配逻辑
 */
export class UnifiedDocAdapter extends UnifiedRepositoryAdapter<Record<string, unknown>> {
  async listByCollection(collectionId: CollectionId): Promise<Array<Record<string, unknown>>> {
    return (await this.repository.findBy({ collectionId } as Record<string, unknown>)) as Array<Record<string, unknown>>;
  }

  async findDeleted(): Promise<Array<Record<string, unknown>>> {
    return (await this.repository.findBy({ deleted: true } as Record<string, unknown>)) as Array<Record<string, unknown>>;
  }

  async hardDelete(id: DocId): Promise<boolean> {
    try {
      await this.repository.delete({ id } as unknown as Record<string, unknown>);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * 块适配器
 * 专门处理块相关的适配逻辑
 */
export class UnifiedChunkAdapter extends UnifiedRepositoryAdapter<Record<string, unknown>> {
  async getByPointIds(pointIds: PointId[]): Promise<Array<Record<string, unknown>>> {
    if (pointIds.length === 0) return [];

    // 使用原生查询来处理IN操作
    const query = `
      SELECT * FROM chunks 
      WHERE pointId IN (${pointIds.map(() => '?').join(',')})
    `;

    return (await this.repository.executeQuery(query, pointIds)) as Array<Record<string, unknown>>;
  }

  async getByDocId(docId: DocId): Promise<Array<Record<string, unknown>>> {
    return (await this.repository.findBy({ docId } as Record<string, unknown>)) as Array<Record<string, unknown>>;
  }

  async getByCollectionId(collectionId: CollectionId): Promise<Array<Record<string, unknown>>> {
    return (await this.repository.findBy({ collectionId } as Record<string, unknown>)) as Array<Record<string, unknown>>;
  }

  async createBatch(chunks: Array<Record<string, unknown>>): Promise<Array<Record<string, unknown>>> {
    return (await this.repository.createBatch(chunks as DeepPartial<Record<string, unknown>>[])) as Array<Record<string, unknown>>;
  }

  async deleteByPointIds(pointIds: PointId[]): Promise<number> {
    if (pointIds.length === 0) return 0;

    const query = `
      DELETE FROM chunks 
      WHERE pointId IN (${pointIds.map(() => '?').join(',')})
    `;

    await this.repository.executeQuery(query, pointIds);
    return pointIds.length;
  }

  async deleteByDocId(docId: DocId): Promise<number> {
    await this.repository.delete({ docId } as unknown as Record<string, unknown>);
    return 1;
  }

  async count(docId?: DocId, collectionId?: CollectionId): Promise<number> {
    const where: Record<string, unknown> = {};
    if (docId) where.docId = docId;
    if (collectionId) where.collectionId = collectionId;

    return await this.repository.count(where);
  }

  async listPaginatedByDocId(
    docId: DocId,
    query: PaginationQuery,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const paginationOptions: PaginationOptions = {
      page: query.page,
      limit: query.limit,
    };

    const queryBuilder = this.repository
      .createQueryBuilder('chunk')
      .where('chunk.docId = :docId', { docId });

    return await this.repository.findWithPagination(
      paginationOptions,
      queryBuilder,
    );
  }
}

/**
 * 适配器工厂
 * 用于创建统一类型的适配器
 */
export class UnifiedAdapterFactory {
  static createCollectionAdapter(
    repository: BaseRepository<Record<string, unknown>>,
    dataSource: DataSource,
  ): UnifiedCollectionAdapter {
    return new UnifiedCollectionAdapter(repository, dataSource);
  }

  static createDocAdapter(
    repository: BaseRepository<Record<string, unknown>>,
    dataSource: DataSource,
  ): UnifiedDocAdapter {
    return new UnifiedDocAdapter(repository, dataSource);
  }

  static createChunkAdapter(
    repository: BaseRepository<Record<string, unknown>>,
    dataSource: DataSource,
  ): UnifiedChunkAdapter {
    return new UnifiedChunkAdapter(repository, dataSource);
  }

  static createGenericAdapter<T extends ObjectLiteral>(
    repository: BaseRepository<T>,
    dataSource: DataSource,
  ): UnifiedRepositoryAdapter<T> {
    return new UnifiedRepositoryAdapter(repository, dataSource);
  }
}
