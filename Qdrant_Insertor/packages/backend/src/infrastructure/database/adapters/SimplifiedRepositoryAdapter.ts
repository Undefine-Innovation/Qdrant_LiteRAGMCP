/**
 * 简化的仓库适配器
 * 统一PostgreSQL、SQLite和TypeORM的实现，减少代码重复
 */

import {
  DataSource,
  EntityTarget,
  ObjectLiteral,
  DeepPartial,
  Repository,
  EntityManager,
  FindOptionsWhere,
  
  SelectQueryBuilder,
} from 'typeorm';
import { LoggerLike } from '@domain/repositories/IDatabaseRepository.js';
import {
  CollectionId,
  DocId,
  PointId,
  SearchResult,
  DocumentChunk,
  ChunkMeta as ChunkMetaType,
  PaginationQuery,
  PaginatedResponse,
  Doc as DomainDoc,
} from '@domain/entities/types.js';
import {
  DatabaseType,
  DatabaseConfig,
  DatabaseMigration,
} from '@domain/interfaces/IDatabaseRepository.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';

/**
 * 简化的仓库适配器
 * 支持多种数据库类型，提供统一的接口
 */
export class SimplifiedRepositoryAdapter<T extends ObjectLiteral> {
  readonly databaseType: DatabaseType;
  readonly config: DatabaseConfig;

  // TypeORM Repository实例（懒加载）
  private _repository: Repository<T> | undefined = undefined;
  private _entityClass: EntityTarget<T>;
  protected dataSource: DataSource;
  protected logger: LoggerLike;
  protected qdrantRepo?: IQdrantRepo;

  /**
   * 创建SimplifiedRepositoryAdapter实例
   * @param entityClass 实体类
   * @param dataSource TypeORM数据源
   * @param config 数据库配置
   * @param logger 日志记录器
   * @param qdrantRepo 可选的Qdrant仓库
   */
  constructor(
    entityClass: EntityTarget<T>,
    dataSource: DataSource,
    config: DatabaseConfig,
    logger: LoggerLike,
    qdrantRepo?: IQdrantRepo,
  ) {
    this.dataSource = dataSource;
    this._entityClass = entityClass;
    this.config = config;
    this.logger = logger;
    this.qdrantRepo = qdrantRepo;
    this.databaseType = config.type || DatabaseType.SQLITE;
  }

  /**
   * 懒加载 repository（在首次访问时从 dataSource 获取）
   * @returns TypeORM repository实例
   */
  private get repository(): Repository<T> {
    if (this._repository === undefined) {
      try {
        this._repository = this.dataSource.getRepository(this._entityClass) as Repository<T>;
      } catch (error) {
        this.logger.error?.(`Failed to get repository for entity class`, {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }
    return this._repository as Repository<T>;
  }

  // === 基础CRUD操作 ===

  /**
   * 创建实体
    * @param {Partial<T>} entity 实体数据
    * @returns {Promise<T>} 创建的实体
   */
  async create(entity: Partial<T>): Promise<T> {
    try {
      const result = await this.repository.save(entity as DeepPartial<T>);
      this.logger?.debug?.(`创建实体成功`, { entity: result });
      return result;
    } catch (error) {
      this.logger?.error?.(`创建实体失败`, {
        entity,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 批量创建实体
    * @param {Partial<T>[]} entities 实体数组
    * @returns {Promise<T[]>} 创建的实体数组
   */
  async createBatch(entities: Partial<T>[]): Promise<T[]> {
    try {
      const results = await this.repository.save(entities as DeepPartial<T>[]);
      this.logger?.debug?.(`批量创建实体成功`, { count: results.length });
      return results;
    } catch (error) {
      this.logger?.error?.(`批量创建实体失败`, {
        count: entities.length,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 根据ID查找实体
    * @param {(string|number)} id 实体ID
    * @returns {Promise<T|undefined>} 找到的实体或 undefined
   */
  async findById(id: string | number): Promise<T | undefined> {
    try {
      const where = { id } as unknown as FindOptionsWhere<T>;
      const result = await this.repository.findOne({ where });
      return result || undefined;
    } catch (error) {
      this.logger?.error?.(`根据ID查找实体失败`, {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 根据条件查找实体
    * @param {Partial<T>} conditions 查询条件
    * @returns {Promise<T[]>} 匹配的实体数组
   */
  async find(conditions: Partial<T>): Promise<T[]> {
    try {
      const where = conditions as unknown as FindOptionsWhere<T>;
      const results = await this.repository.find({ where });
      return results;
    } catch (error) {
      this.logger?.error?.(`根据条件查找实体失败`, {
        conditions,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 根据条件查找单个实体
    * @param {Partial<T>} conditions 查询条件
    * @returns {Promise<T|undefined>} 找到的实体或 undefined
   */
  async findOne(conditions: Partial<T>): Promise<T | undefined> {
    try {
      const where = conditions as unknown as FindOptionsWhere<T>;
      const result = await this.repository.findOne({ where });
      return result || undefined;
    } catch (error) {
      this.logger?.error?.(`根据条件查找单个实体失败`, {
        conditions,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 更新实体
   * @param {Partial<T>} conditions 更新条件
   * @param {Partial<T>} updates 更新数据
   * @returns {Promise<{ affected: number }>} 更新结果
   */
  async update(
    conditions: Partial<T>,
    updates: Partial<T>,
  ): Promise<{ affected: number }> {
    try {
      const criteria = conditions as unknown as FindOptionsWhere<T>;
      const partial = updates as unknown as DeepPartial<T>;
      // Partial update shape may use TypeORM internal type; narrow cast here.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (this.repository as any).update(criteria, partial as any);
      const affected = ((result as unknown) as { affected?: number })?.affected ?? 0;
      this.logger?.debug?.(`更新实体成功`, {
        conditions,
        updates,
        affected,
      });
      return { affected };
    } catch (error) {
      this.logger?.error?.(`更新实体失败`, {
        conditions,
        updates,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 删除实体
    * @param {Partial<T>} conditions 删除条件
    * @returns {Promise<{ affected: number }>} 删除结果
   */
  async delete(conditions: Partial<T>): Promise<{ affected: number }> {
    try {
      const criteria = conditions as unknown as FindOptionsWhere<T>;
      const result = await this.repository.delete(criteria);
      const affected = ((result as unknown) as { affected?: number })?.affected ?? 0;
      this.logger?.debug?.(`删除实体成功`, {
        conditions,
        affected,
      });
      return { affected };
    } catch (error) {
      this.logger?.error?.(`删除实体失败`, {
        conditions,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 统计实体数量
    * @param {Partial<T>=} conditions 统计条件（可选）
    * @returns {Promise<number>} 实体数量
   */
  async count(conditions?: Partial<T>): Promise<number> {
    try {
      const where = conditions as unknown as FindOptionsWhere<T> | undefined;
      const count = await this.repository.count({ where });
      return count;
    } catch (error) {
      this.logger?.error?.(`统计实体数量失败`, {
        conditions,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // === 高级查询操作 ===

  /**
   * 分页查询
   * @param conditions 查询条件
   * @param pagination 分页参数
   * @param pagination.page 页码
   * @param pagination.limit 每页数量
   * @returns {Promise<PaginatedResponse<T>>} 分页结果
   */
  async findWithPagination(
    conditions: Partial<T>,
    pagination: { page: number; limit: number },
  ): Promise<PaginatedResponse<T>> {
    try {
      const { page, limit } = pagination;
      const skip = (page - 1) * limit;

      const where = conditions as unknown as FindOptionsWhere<T>;
      const [data, total] = await this.repository.findAndCount({
        where,
        skip,
        take: limit,
      });

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
      this.logger?.error?.(`分页查询失败`, {
        conditions,
        pagination,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 执行原生SQL查询
   * @param query SQL查询语句
   * @param parameters 查询参数
    * @returns {Promise<any[]>} 查询结果数组
   */
  async query(query: string, parameters?: unknown[]): Promise<unknown[]> {
    try {
      const results = await this.dataSource.query(query, parameters);
      return results;
    } catch (error) {
      this.logger?.error?.(`执行SQL查询失败`, {
        query,
        parameters,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 执行原生SQL查询（返回单条记录）
   * @param query SQL查询语句
   * @param parameters 查询参数
    * @returns {Promise<any|null>} 单条查询结果或 null
   */
  async queryOne(query: string, parameters?: unknown[]): Promise<unknown | null> {
    try {
      const results = await this.dataSource.query(query, parameters);
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      this.logger?.error?.(`执行SQL查询失败`, {
        query,
        parameters,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 执行事务
   * @param {(manager: EntityManager) => Promise<T>} fn 事务函数，接收 TypeORM 的 `EntityManager`
   * @returns {Promise<T>} 事务结果
   */
  async executeTransaction<T>(fn: (manager: EntityManager) => Promise<T>): Promise<T> {
    try {
      const result = await this.dataSource.transaction(fn);
      return result;
    } catch (error) {
      this.logger?.error?.(`执行事务失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // === 数据库特定操作 ===

  /**
   * 删除集合（PostgreSQL/SQLite通用）
   * @param collectionId 集合ID
   */
  async deleteCollection(collectionId: CollectionId): Promise<void> {
    try {
      await this.executeTransaction(async (manager) => {
        // 删除相关的chunks
        await manager.delete('Chunk', { collectionId });
        // 删除相关的docs
        await manager.delete('Doc', { collectionId });
        // 删除collection
        await manager.delete('Collection', { collectionId });
      });

      this.logger?.info?.(`删除集合成功`, { collectionId });
    } catch (error) {
      this.logger?.error?.(`删除集合失败`, {
        collectionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 删除文档（PostgreSQL/SQLite通用）
   * @param docId 文档ID
   * @returns 是否删除成功
   */
  async deleteDoc(docId: DocId): Promise<boolean> {
    try {
      const result = await this.executeTransaction(async (manager) => {
        // 删除相关的chunks
        const chunkResult = await manager.delete('Chunk', { docId });
        // 删除doc
        const docResult = await manager.delete('Doc', { docId });
        return {
          chunkAffected: chunkResult.affected,
          docAffected: docResult.affected,
        };
      });

      const success = (result?.docAffected ?? 0) > 0;
      this.logger?.info?.(`删除文档成功`, { docId, success });
      return success;
    } catch (error) {
      this.logger?.error?.(`删除文档失败`, {
        docId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 获取数据库统计信息
   * @returns 统计信息
   */
  async getStatistics(): Promise<{
    totalCollections: number;
    totalDocuments: number;
    totalChunks: number;
    databaseSize: number;
    indexSize: number;
  }> {
    try {
      let databaseSize = 0;
      let indexSize = 0;

      // 根据数据库类型获取大小信息
      if (this.databaseType === DatabaseType.POSTGRESQL) {
        const sizeResult = await this.queryOne(`
          SELECT pg_database_size(current_database()) as size
        `);
        const sizeVal = (sizeResult as Record<string, unknown> | null)?.size;
        databaseSize = parseInt(String(sizeVal ?? '0'));

        const indexResult = await this.queryOne(`
          SELECT SUM(pg_relation_size(indexrelid)) as index_size
          FROM pg_index
          WHERE schemaname = 'public'
        `);
        const indexVal = (indexResult as Record<string, unknown> | null)?.index_size;
        indexSize = parseInt(String(indexVal ?? '0'));
      } else if (this.databaseType === DatabaseType.SQLITE) {
        // SQLite获取数据库大小
        const pageResult = await this.queryOne('PRAGMA page_count');
        const sizeResult = await this.queryOne('PRAGMA page_size');
        const pageCount = (pageResult as Record<string, unknown> | null)?.page_count ?? 0;
        const pageSize = (sizeResult as Record<string, unknown> | null)?.page_size ?? 0;
        databaseSize = Number(pageCount) * Number(pageSize);
      }

      // 获取表统计
      const collectionsResult = await this.queryOne(
        'SELECT COUNT(*) as count FROM collections',
      );
      const documentsResult = await this.queryOne(
        'SELECT COUNT(*) as count FROM docs',
      );
      const chunksResult = await this.queryOne(
        'SELECT COUNT(*) as count FROM chunks',
      );

      const collCount = (collectionsResult as Record<string, unknown> | null)?.count;
      const docsCount = (documentsResult as Record<string, unknown> | null)?.count;
      const chCount = (chunksResult as Record<string, unknown> | null)?.count;

      return {
        totalCollections: parseInt(String(collCount ?? '0')),
        totalDocuments: parseInt(String(docsCount ?? '0')),
        totalChunks: parseInt(String(chCount ?? '0')),
        databaseSize,
        indexSize,
      };
    } catch (error) {
      this.logger?.error?.(`获取数据库统计信息失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 优化数据库性能
   * @returns 优化结果
   */
  async optimize(): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    try {
      if (this.databaseType === DatabaseType.POSTGRESQL) {
        await this.query('ANALYZE');
        await this.query('VACUUM ANALYZE');
      } else if (this.databaseType === DatabaseType.SQLITE) {
        await this.query('VACUUM');
        await this.query('ANALYZE');
      }

      this.logger?.info?.(`数据库优化完成`);
      return {
        success: true,
        message: '数据库优化完成',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger?.error?.(`数据库优化失败`, { error: errorMessage });
      return {
        success: false,
        message: '数据库优化失败',
        error: errorMessage,
      };
    }
  }

  // === 工具方法 ===

  /**
   * 转换为领域对象
   * @param entity 数据库实体
   * @returns 领域对象
   */
  toDomainObject(entity: T): unknown {
    // 基础转换逻辑，子类可以重写
    return entity as unknown;
  }

  /**
   * 从领域对象转换
   * @param domainObject 领域对象
   * @returns 数据库实体
   */
  fromDomainObject(domainObject: unknown): Partial<T> {
    // 基础转换逻辑，子类可以重写
    return domainObject as Partial<T>;
  }

  /**
   * 创建查询构建器
   * @param alias 表别名
   * @returns 查询构建器
   */
  createQueryBuilder(alias: string = 'entity'): SelectQueryBuilder<T> {
    return this.repository.createQueryBuilder(alias) as SelectQueryBuilder<T>;
  }
}
