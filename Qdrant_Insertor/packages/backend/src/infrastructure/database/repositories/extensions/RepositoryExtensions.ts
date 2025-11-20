import { FindOptionsWhere, EntityManager, ObjectLiteral, FindOptionsOrder, DeepPartial } from 'typeorm';
import { Logger } from '@logging/logger.js';
import {
  BaseRepository,
  BatchOperationResult,
  QueryOptions,
} from '../BaseRepository.js';
import { DocId, CollectionId, PointId } from '@domain/entities/types.js';
import { DbSyncJobStatus } from '@domain/sync/SyncJobStatusMapper.js';

/**
 * Repository扩展接口
 * 定义特定实体类型的扩展操作
 */
export interface IRepositoryExtensions<T> {
  /**
   * 根据业务ID查找实体
   */
  findByBusinessId?(
    id: string | number,
    options?: QueryOptions<T>,
  ): Promise<T | null>;

  /**
   * 根据集合ID查找实体
   */
  findByCollectionId?(
    collectionId: CollectionId,
    options?: QueryOptions<T>,
  ): Promise<T[]>;

  /**
   * 根据文档ID查找实体
   */
  findByDocId?(docId: DocId, options?: QueryOptions<T>): Promise<T[]>;

  /**
   * 根据点ID查找实体
   */
  findByPointId?(
    pointId: PointId,
    options?: QueryOptions<T>,
  ): Promise<T | null>;

  /**
   * 根据点ID数组查找实体
   */
  findByPointIds?(pointIds: PointId[], options?: QueryOptions<T>): Promise<T[]>;

  /**
   * 根据状态查找实体
   */
  findByStatus?(status: string, options?: QueryOptions<T>): Promise<T[]>;

  /**
   * 批量更新状态
   */
  batchUpdateStatus?(
    ids: (string | number)[],
    status: string,
  ): Promise<BatchOperationResult>;

  /**
   * 批量更新同步状态
   */
  batchUpdateSyncStatus?(
    ids: (string | number)[],
    syncStatus: DbSyncJobStatus | string,
  ): Promise<BatchOperationResult>;
}

/**
 * 集合Repository扩展
 * 提供集合特定的操作
 */
export class CollectionRepositoryExtensions<T extends ObjectLiteral>
  implements IRepositoryExtensions<T>
{
  constructor(
    private readonly baseRepository: BaseRepository<T>,
    private readonly logger: Logger,
  ) {}

  async findByBusinessId(
    id: string | number,
    options?: QueryOptions<T>,
  ): Promise<T | null> {
    try {
      return await this.baseRepository.findOneBy(
        { collectionId: id } as unknown as FindOptionsWhere<T>,
        options,
      );
    } catch (error) {
      this.logger.error('根据业务ID查找集合失败', { id, error });
      throw error;
    }
  }

  async findByName(name: string, options?: QueryOptions<T>): Promise<T | null> {
    try {
      return await this.baseRepository.findOneBy(
        { name } as unknown as FindOptionsWhere<T>,
        options,
      );
    } catch (error) {
      this.logger.error('根据名称查找集合失败', { name, error });
      throw error;
    }
  }

  async findByPrefix(prefix: string, options?: QueryOptions<T>): Promise<T[]> {
    try {
      return await this.baseRepository.findByFuzzySearch(
        'name',
        `${prefix}%`,
        options,
      );
    } catch (error) {
      this.logger.error('根据前缀查找集合失败', { prefix, error });
      throw error;
    }
  }

  async findBySuffix(suffix: string, options?: QueryOptions<T>): Promise<T[]> {
    try {
      return await this.baseRepository.findByFuzzySearch(
        'name',
        `%${suffix}`,
        options,
      );
    } catch (error) {
      this.logger.error('根据后缀查找集合失败', { suffix, error });
      throw error;
    }
  }

  async updateDocumentCount(
    id: string | number,
    count: number,
  ): Promise<boolean> {
    try {
      const whereCondition = { id } as unknown as FindOptionsWhere<T>;
      await this.baseRepository
        .createQueryBuilder()
        .update()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .set({ documentCount: count } as any) // TypeORM 的 _QueryDeepPartialEntity 与我们的泛型类型系统不兼容
        .where(whereCondition)
        .execute();
      return true;
    } catch (error) {
      this.logger.error('更新集合文档数量失败', { id, count, error });
      throw error;
    }
  }

  async updateChunkCount(id: string | number, count: number): Promise<boolean> {
    try {
      const whereCondition = { id } as unknown as FindOptionsWhere<T>;
      await this.baseRepository
        .createQueryBuilder()
        .update()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .set({ chunkCount: count } as any) // TypeORM 的 _QueryDeepPartialEntity 与我们的泛型类型系统不兼容
        .where(whereCondition)
        .execute();
      return true;
    } catch (error) {
      this.logger.error('更新集合块数量失败', { id, count, error });
      throw error;
    }
  }
}

/**
 * 文档Repository扩展
 * 提供文档特定的操作
 */
export class DocRepositoryExtensions<T extends ObjectLiteral>
  implements IRepositoryExtensions<T>
{
  constructor(
    private readonly baseRepository: BaseRepository<T>,
    private readonly logger: Logger,
  ) {}

  async findByCollectionId(
    collectionId: CollectionId,
    options?: QueryOptions<T>,
  ): Promise<T[]> {
    try {
      return await this.baseRepository.findBy(
        { collectionId } as unknown as FindOptionsWhere<T>,
        options,
      );
    } catch (error) {
      this.logger.error('根据集合ID查找文档失败', { collectionId, error });
      throw error;
    }
  }

  async findByCollectionAndKey(
    collectionId: CollectionId,
    key: string,
    options?: QueryOptions<T>,
  ): Promise<T | null> {
    try {
      return await this.baseRepository.findOneBy(
        { collectionId, key } as unknown as FindOptionsWhere<T>,
        options,
      );
    } catch (error) {
      this.logger.error('根据集合和键查找文档失败', {
        collectionId,
        key,
        error,
      });
      throw error;
    }
  }

  async findByContentHash(
    contentHash: string,
    options?: QueryOptions<T>,
  ): Promise<T | null> {
    try {
      return await this.baseRepository.findOneBy(
        { contentHash } as unknown as FindOptionsWhere<T>,
        options,
      );
    } catch (error) {
      this.logger.error('根据内容哈希查找文档失败', { contentHash, error });
      throw error;
    }
  }

  async findByStatus(status: string, options?: QueryOptions<T>): Promise<T[]> {
    try {
      return await this.baseRepository.findBy(
        { status } as unknown as FindOptionsWhere<T>,
        options,
      );
    } catch (error) {
      this.logger.error('根据状态查找文档失败', { status, error });
      throw error;
    }
  }

  async findProcessable(
    collectionId: CollectionId,
    limit?: number,
  ): Promise<T[]> {
    try {
      const options: QueryOptions<T> = {
        where: {
          collectionId,
          status: 'new',
          deleted: false,
        } as unknown as FindOptionsWhere<T>,
        take: limit,
        order: { created_at: 'ASC' } as unknown as FindOptionsOrder<T>,
      };
      return await this.baseRepository.findAll(options);
    } catch (error) {
      this.logger.error('查找可处理文档失败', { collectionId, limit, error });
      throw error;
    }
  }

  async batchUpdateStatus(
    ids: (string | number)[],
    status: string,
  ): Promise<BatchOperationResult> {
    try {
      return await this.baseRepository.updateBatch(ids, { status } as unknown as DeepPartial<T>);
    } catch (error) {
      this.logger.error('批量更新文档状态失败', { ids, status, error });
      throw error;
    }
  }

  async softDeleteDoc(id: DocId): Promise<boolean> {
    try {
      await this.baseRepository.softDelete({
        id,
      } as unknown as FindOptionsWhere<T>);
      return true;
    } catch (error) {
      this.logger.error('软删除文档失败', { id, error });
      throw error;
    }
  }

  async restore(id: string | number): Promise<boolean> {
    try {
      const whereCondition = { id } as unknown as FindOptionsWhere<T>;
      await this.baseRepository
        .createQueryBuilder()
        .update()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .set({ deletedAt: null } as any) // TypeORM 的 _QueryDeepPartialEntity 与我们的泛型类型系统不兼容
        .where(whereCondition)
        .execute();
      return true;
    } catch (error) {
      this.logger.error('恢复记录失败', { id, error });
      throw error;
    }
  }
}

/**
 * 块Repository扩展
 * 提供块特定的操作
 */
export class ChunkRepositoryExtensions<T extends ObjectLiteral>
  implements IRepositoryExtensions<T>
{
  constructor(
    private readonly baseRepository: BaseRepository<T>,
    private readonly logger: Logger,
  ) {}

  async findByDocId(docId: DocId, options?: QueryOptions<T>): Promise<T[]> {
    try {
      return await this.baseRepository.findBy(
        { docId } as unknown as FindOptionsWhere<T>,
        options,
      );
    } catch (error) {
      this.logger.error('根据文档ID查找块失败', { docId, error });
      throw error;
    }
  }

  async findByCollectionId(
    collectionId: CollectionId,
    options?: QueryOptions<T>,
  ): Promise<T[]> {
    try {
      return await this.baseRepository.findBy(
        { collectionId } as unknown as FindOptionsWhere<T>,
        options,
      );
    } catch (error) {
      this.logger.error('根据集合ID查找块失败', { collectionId, error });
      throw error;
    }
  }

  async findByPointId(
    pointId: PointId,
    options?: QueryOptions<T>,
  ): Promise<T | null> {
    try {
      return await this.baseRepository.findOneBy(
        { pointId } as unknown as FindOptionsWhere<T>,
        options,
      );
    } catch (error) {
      this.logger.error('根据点ID查找块失败', { pointId, error });
      throw error;
    }
  }

  async findByPointIds(
    pointIds: PointId[],
    options?: QueryOptions<T>,
  ): Promise<T[]> {
    try {
      if (pointIds.length === 0) return [];

      // 使用原生查询来处理IN操作
      const query = `
        SELECT * FROM chunks 
        WHERE pointId IN (${pointIds.map(() => '?').join(',')})
        ${options?.take ? `LIMIT ${options.take}` : ''}
      `;

      return (await this.baseRepository.executeQuery(query, pointIds)) as T[];
    } catch (error) {
      this.logger.error('根据点ID数组查找块失败', { pointIds, error });
      throw error;
    }
  }

  async findByStatus(status: string, options?: QueryOptions<T>): Promise<T[]> {
    try {
      return await this.baseRepository.findBy(
        { embeddingStatus: status } as unknown as FindOptionsWhere<T>,
        options,
      );
    } catch (error) {
      this.logger.error('根据状态查找块失败', { status, error });
      throw error;
    }
  }

  async batchUpdateStatus(
    ids: (string | number)[],
    status: string,
  ): Promise<BatchOperationResult> {
    try {
      return await this.baseRepository.updateBatch(ids, { embeddingStatus: status } as unknown as DeepPartial<T>);
    } catch (error) {
      this.logger.error('批量更新块状态失败', { ids, status, error });
      throw error;
    }
  }

  async batchUpdateSyncStatus(
    ids: (string | number)[],
    syncStatus: DbSyncJobStatus | string,
  ): Promise<BatchOperationResult> {
    try {
      return await this.baseRepository.updateBatch(ids, { syncStatus } as unknown as DeepPartial<T>);
    } catch (error) {
      this.logger.error('批量更新块同步状态失败', { ids, syncStatus, error });
      throw error;
    }
  }

  async deleteByDocId(docId: DocId): Promise<number> {
    try {
      await this.baseRepository.delete({
        docId,
      } as unknown as FindOptionsWhere<T>);
      return 1; // 简化实现，实际应该返回删除的数量
    } catch (error) {
      this.logger.error('根据文档ID删除块失败', { docId, error });
      throw error;
    }
  }

  async deleteByCollectionId(collectionId: CollectionId): Promise<number> {
    try {
      await this.baseRepository.delete({
        collectionId,
      } as unknown as FindOptionsWhere<T>);
      return 1; // 简化实现，实际应该返回删除的数量
    } catch (error) {
      this.logger.error('根据集合ID删除块失败', { collectionId, error });
      throw error;
    }
  }

  async deleteByPointIds(pointIds: PointId[]): Promise<number> {
    try {
      if (pointIds.length === 0) return 0;

      // 使用原生查询来处理批量删除
      const query = `
        DELETE FROM chunks 
        WHERE pointId IN (${pointIds.map(() => '?').join(',')})
      `;

      await this.baseRepository.executeQuery(query, pointIds);
      return pointIds.length;
    } catch (error) {
      this.logger.error('根据点ID数组删除块失败', { pointIds, error });
      throw error;
    }
  }
}

/**
 * Repository扩展工厂
 * 用于创建特定类型的Repository扩展
 */
export class RepositoryExtensionFactory {
  static createCollectionExtensions<T extends ObjectLiteral>(
    baseRepository: BaseRepository<T>,
    logger: Logger,
  ): CollectionRepositoryExtensions<T> {
    return new CollectionRepositoryExtensions(baseRepository, logger);
  }

  static createDocExtensions<T extends ObjectLiteral>(
    baseRepository: BaseRepository<T>,
    logger: Logger,
  ): DocRepositoryExtensions<T> {
    return new DocRepositoryExtensions(baseRepository, logger);
  }

  static createChunkExtensions<T extends ObjectLiteral>(
    baseRepository: BaseRepository<T>,
    logger: Logger,
  ): ChunkRepositoryExtensions<T> {
    return new ChunkRepositoryExtensions(baseRepository, logger);
  }
}

