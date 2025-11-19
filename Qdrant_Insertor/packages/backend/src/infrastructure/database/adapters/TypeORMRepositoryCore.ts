/**
 * TypeORM仓库核心功能
 * 包含基础功能、初始化、连接管理和事件处理
 */

import {
  DataSource,
  Repository,
  EntityTarget,
  ObjectLiteral,
  DeepPartial,
  FindOneOptions,
  FindManyOptions,
  FindOptionsWhere,
  UpdateResult,
  EntityManager,
  SelectQueryBuilder,
} from 'typeorm';
import { LoggerLike } from '@domain/repositories/IDatabaseRepository.js';
import {
  DatabaseType,
  DatabaseConfig,
  DatabaseHealthStatus,
  DatabaseConnectionStatus,
  DatabasePerformanceMetrics,
  DatabaseMigration,
} from '@domain/interfaces/IDatabaseRepository.js';
import {
  SearchResult,
  DocumentChunk,
  ChunkMeta,
  PaginationQuery,
  PaginatedResponse,
  Doc,
} from '@domain/entities/types.js';
import {
  IRepositoryAdapter,
  AdapterConfig,
  AdapterEventType,
  AdapterEvent,
  IAdapterEventListener,
  DatabaseConnectionStatus as AdapterConnectionStatus,
} from './IRepositoryAdapter.js';
import { CollectionId, DocId, PointId } from '@domain/entities/types.js';

/**
 * TypeORM仓库核心功能
 * 提供基础功能、初始化、连接管理和事件处理
 * @template T 实体类型
 */
export abstract class TypeORMRepositoryCore<T extends ObjectLiteral>
  implements IRepositoryAdapter<T>
{
  readonly databaseType: DatabaseType;
  readonly config: DatabaseConfig;
  readonly dataSource: DataSource;
  readonly logger: LoggerLike;

  // TypeORM Repository实例
  protected repository: Repository<T>;

  // 性能监控
  protected queryCount = 0;
  protected totalQueryTime = 0;
  protected slowQueryCount = 0;
  protected lastHealthCheck = 0;
  protected connectionStartTime = 0;

  // 配置
  protected adapterConfig: AdapterConfig;

  // 事件监听器
  protected eventListeners: IAdapterEventListener[] = [];

  /**
   * 创建TypeORMRepositoryCore实例
   * @param entityClass 实体类
   * @param dataSource TypeORM数据源
   * @param config 数据库配置
   * @param logger 日志记录器
   * @param adapterConfig 适配器配置
   */
  constructor(
    entityClass: EntityTarget<T>,
    dataSource: DataSource,
    config: DatabaseConfig,
    logger: LoggerLike,
    adapterConfig: AdapterConfig = {},
  ) {
    this.dataSource = dataSource;
    this.config = config;
    this.logger = logger;
    this.adapterConfig = {
      // 默认配置
      enableQueryCache: true,
      cacheExpiration: 300000, // 5分钟
      enablePerformanceMonitoring: true,
      slowQueryThreshold: 1000, // 1秒
      enablePoolMonitoring: true,
      batchSize: 100,
      transactionTimeout: 30000, // 30秒
      retryAttempts: 3,
      retryDelay: 1000, // 1秒
      ...adapterConfig,
    };

    this.repository = dataSource.getRepository(entityClass);
    this.connectionStartTime = Date.now();
  }

  /**
   * 初始化数据库连接
   * @param logger 日志记录器
   * @returns 初始化结果
   */
  async initialize(logger: LoggerLike): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    try {
      logger.info(`正在初始化${this.databaseType}数据库连接...`);

      if (!this.dataSource.isInitialized) {
        await this.dataSource.initialize();
      }

      // 测试连接
      await this.dataSource.query('SELECT 1');

      // 执行数据库特定的初始化
      await this.performDatabaseInitialization();

      logger.info(`${this.databaseType}数据库连接初始化成功`);

      return {
        success: true,
        message: `${this.databaseType}数据库初始化成功`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`${this.databaseType}数据库初始化失败`, {
        error: errorMessage,
      });

      return {
        success: false,
        message: `${this.databaseType}数据库初始化失败`,
        error: errorMessage,
      };
    }
  }

  /**
   * 关闭数据库连接
   * @returns 关闭结果
   */
  async close(): Promise<void> {
    try {
      if (this.dataSource.isInitialized) {
        await this.dataSource.destroy();
        this.logger.info(`${this.databaseType}数据库连接已关闭`);
      }
    } catch (error) {
      this.logger.error(`关闭${this.databaseType}数据库连接失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 检查数据库连接是否健康
   * @returns 健康状态
   */
  async ping(): Promise<boolean> {
    try {
      if (!this.dataSource.isInitialized) {
        return false;
      }

      const startTime = Date.now();
      await this.dataSource.query('SELECT 1');
      const responseTime = Date.now() - startTime;

      this.lastHealthCheck = Date.now();
      return responseTime < 5000; // 5秒内响应视为健康
    } catch (error) {
      this.logger.warn(`${this.databaseType}数据库ping检查失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * 获取数据库健康状态
   * @returns 健康状态详情
   */
  async getHealthStatus(): Promise<DatabaseHealthStatus> {
    const startTime = Date.now();
    let status = DatabaseConnectionStatus.CONNECTED;
    let responseTime: number | undefined;
    let error: string | undefined;

    try {
      if (!this.dataSource.isInitialized) {
        status = DatabaseConnectionStatus.DISCONNECTED;
        error = '数据库未初始化';
      } else {
        await this.dataSource.query('SELECT 1');
        responseTime = Date.now() - startTime;
        status =
          responseTime < 5000
            ? DatabaseConnectionStatus.CONNECTED
            : DatabaseConnectionStatus.ERROR;
      }
    } catch (err) {
      status = DatabaseConnectionStatus.ERROR;
      error = err instanceof Error ? err.message : String(err);
    }

    return {
      status,
      lastCheckTime: Date.now(),
      responseTime,
      error,
      performanceMetrics: {
        averageQueryTime:
          this.queryCount > 0 ? this.totalQueryTime / this.queryCount : 0,
        slowQueryCount: this.slowQueryCount,
        totalQueries: this.queryCount,
      },
    };
  }

  /**
   * 获取数据库性能指标
   * @returns 性能指标
   */
  async getPerformanceMetrics(): Promise<DatabasePerformanceMetrics> {
    try {
      const dbMetrics = await this.getDatabaseSpecificMetrics();

      return {
        databaseType: this.databaseType,
        connectionTime:
          this.connectionStartTime > 0
            ? Date.now() - this.connectionStartTime
            : 0,
        queryTime:
          this.queryCount > 0 ? this.totalQueryTime / this.queryCount : 0,
        transactionTime: 0, // 需要额外实现事务时间统计
        ...dbMetrics,
      };
    } catch (error) {
      this.logger.error(`获取${this.databaseType}性能指标失败`, {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        databaseType: this.databaseType,
        connectionTime: 0,
        queryTime: 0,
        transactionTime: 0,
      };
    }
  }

  /**
   * 在数据库事务中执行一个函数
   * @param fn 包含数据库操作的函数
   * @returns 事务函数的返回值
   */
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await this.dataSource.transaction(async (manager) => {
        // 在事务中执行函数
        return await fn();
      });

      const queryTime = Date.now() - startTime;
      this.recordQueryTime(queryTime);
      this.emitEvent({
        type: AdapterEventType.TRANSACTION_COMPLETED,
        timestamp: new Date(),
        entityType: this.getEntityName(),
        databaseType: this.databaseType,
        data: { duration: queryTime },
        duration: queryTime,
      });

      return result;
    } catch (error) {
      this.logger.error(`${this.databaseType}事务执行失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 添加事件监听器
   * @param listener 事件监听器
   */
  addEventListener(listener: IAdapterEventListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * 移除事件监听器
   * @param listener 事件监听器
   */
  removeEventListener(listener: IAdapterEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * 发送事件
   * @param event 适配器事件
   */
  protected emitEvent(event: AdapterEvent): void {
    this.eventListeners.forEach((listener) => {
      try {
        listener.onAdapterEvent(event);
      } catch (error) {
        this.logger.error('事件监听器执行失败', {
          eventType: event.type,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  /**
   * 记录查询时间
   * @param queryTime 查询时间
   */
  protected recordQueryTime(queryTime: number): void {
    this.queryCount++;
    this.totalQueryTime += queryTime;

    const slowQueryThreshold = this.adapterConfig.slowQueryThreshold || 1000;
    if (queryTime > slowQueryThreshold) {
      this.slowQueryCount++;

      this.emitEvent({
        type: AdapterEventType.SLOW_QUERY,
        timestamp: new Date(),
        entityType: this.getEntityName(),
        databaseType: this.databaseType,
        data: { queryTime, threshold: slowQueryThreshold },
        duration: queryTime,
      });
    }
  }

  /**
   * 获取实体名称
   * @returns 实体名称
   */
  protected getEntityName(): string {
    return this.repository.metadata.targetName || 'Unknown';
  }

  /**
   * 执行数据库特定的初始化
   * 子类可以重写此方法实现特定的初始化逻辑
   * @returns 当初始化完成时解析（无返回值）
   */
  protected async performDatabaseInitialization(): Promise<void> {
    // 默认实现为空，子类可以重写
  }

  /**
   * 获取数据库特定的性能指标
   * 子类可以重写此方法实现特定的性能指标收集
   * @returns 局部的数据库性能指标集合（可选字段）
   */
  protected async getDatabaseSpecificMetrics(): Promise<
    Partial<DatabasePerformanceMetrics>
  > {
    return {};
  }

  /**
   * 获取仓库统计信息
   * @returns {Promise<{totalRecords: number, lastUpdated: Date, averageQueryTime: number, slowQueries: number}>}
   * 包含总记录数、最后更新时间、平均查询时间和慢查询数量的统计信息
   */
  async getRepositoryStats(): Promise<{
    totalRecords: number;
    lastUpdated: Date;
    averageQueryTime: number;
    slowQueries: number;
  }> {
    try {
      const totalRecords = await this.repository.count();
      const averageQueryTime =
        this.queryCount > 0 ? this.totalQueryTime / this.queryCount : 0;

      return {
        totalRecords,
        lastUpdated: new Date(),
        averageQueryTime,
        slowQueries: this.slowQueryCount,
      };
    } catch (error) {
      this.logger.error(`获取仓库统计信息失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 优化仓库性能
   * @returns {Promise<{success: boolean, message: string, optimizations: string[]}>} 包含优化成功状态、消息和执行的优化列表
   */
  async optimizeRepository(): Promise<{
    success: boolean;
    message: string;
    optimizations: string[];
  }> {
    const optimizations: string[] = [];

    try {
      // 执行数据库特定的优化
      const dbOptimizations = await this.performDatabaseOptimizations();
      optimizations.push(...dbOptimizations);

      this.logger.info(`仓库优化完成`, { optimizations });

      return {
        success: true,
        message: '仓库优化完成',
        optimizations,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`仓库优化失败`, { error: errorMessage });

      return {
        success: false,
        message: '仓库优化失败',
        optimizations,
      };
    }
  }

  /**
   * 验证实体数据
   * @param entity 要验证的实体
   * @returns 验证结果
   */
  validateEntity(entity: Partial<T>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // 基础验证逻辑，子类可以重写
    if (!entity) {
      errors.push('实体不能为空');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 执行数据库特定的优化
   * 子类可以重写此方法实现特定的优化逻辑
   * @returns {Promise<string[]>} 执行的优化操作名称列表
   */
  protected async performDatabaseOptimizations(): Promise<string[]> {
    return [];
  }

  // 实现IRepositoryAdapter接口的方法
  /**
   * 创建新实体
   * @param entity 要创建的实体数据
   * @returns 创建的实体
   */
  async create(entity: Partial<T>): Promise<T> {
    return this.repository.save(entity as T);
  }

  /**
   * 批量创建实体
   * @param entities 要创建的实体数据数组
   * @returns 创建的实体数组
   */
  async createBatch(entities: Partial<T>[]): Promise<T[]> {
    return this.repository.save(entities as T[]);
  }

  /**
   * 根据ID查找实体
   * @param id 实体ID
   * @returns 找到的实体或undefined
   */
  async findById(id: string | number): Promise<T | undefined> {
    const where = { id } as unknown as FindOptionsWhere<T>;
    const result = await this.repository.findOne({ where } as FindOneOptions<T>);
    return result || undefined;
  }

  /**
   * 根据条件查找多个实体
   * @param conditions 查询条件
   * @returns 找到的实体数组
   */
  async find(conditions: Partial<T>): Promise<T[]> {
    return this.repository.find(
      ({ where: conditions as FindOptionsWhere<T> } as unknown) as FindManyOptions<T>,
    );
  }

  /**
   * 查找单个实体
   * @param conditions 查询条件
   * @returns 找到的实体或 `undefined`（如果未找到）
   */
  async findOne(conditions: Partial<T>): Promise<T | undefined> {
    const result = await this.repository.findOne(
      ({ where: conditions as FindOptionsWhere<T> } as unknown) as FindOneOptions<T>,
    );
    return result || undefined;
  }

  /**
   * 更新实体
   * @param conditions 更新条件
   * @param updates 要应用的更新
   * @returns 包含受影响行数的对象
   */
  async update(
    conditions: Partial<T>,
    updates: Partial<T>,
  ): Promise<{ affected: number }> {
    // 使用 QueryBuilder 执行更新以避免 TypeORM 内部 _QueryDeepPartialEntity 与
    // 我们的 DeepPartial<T> 泛型之间的类型不兼容问题。
    // TypeORM 内部期望 _QueryDeepPartialEntity 类型，与我们的 DeepPartial<T>
    // 在某些泛型组合下不兼容。为保持最小改动范围，这里对传入值做一次
    // 局部宽松转换并解释原因（尽量不扩散 any 到外部 API）。
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const result = await this.repository
      .createQueryBuilder()
      .update()
      .set(updates as unknown as any)
      .where(conditions as unknown as any)
      .execute();
    /* eslint-enable @typescript-eslint/no-explicit-any */
    return { affected: result.affected || 0 };
  }

  /**
   * 删除实体
   * @param conditions 删除条件
   * @returns 包含受影响行数的对象
   */
  async delete(conditions: Partial<T>): Promise<{ affected: number }> {
    const result = await this.repository.delete(conditions as unknown as FindOptionsWhere<T>);
    return { affected: result.affected || 0 };
  }

  /**
   * 计数符合条件的实体数量
   * @param conditions 可选的条件
   * @returns 符合条件的实体数量
   */
  async count(conditions?: Partial<T>): Promise<number> {
    return this.repository.count(
      ({ where: conditions as FindOptionsWhere<T> } as unknown) as FindManyOptions<T>,
    );
  }

  /**
   * 分页查找实体
   * @param conditions 查询条件
   * @param pagination 分页参数
   * @param pagination.page 页码（从1开始）
   * @param pagination.limit 每页数量
   * @returns 分页结果包含数据和分页信息
   */
  async findWithPagination(
    conditions: Partial<T>,
    pagination: { page: number; limit: number },
  ): Promise<{ data: T[]; pagination: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean } }> {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await this.repository.findAndCount({
      where: conditions as FindOptionsWhere<T>,
      skip,
      take: limit,
    });

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * 执行原始查询并返回结果数组
   * @param query SQL 查询字符串
   * @param parameters 可选参数数组
   * @returns 查询结果数组
   */
  async query(query: string, parameters?: unknown[]): Promise<unknown[]> {
    return (await this.dataSource.query(query, parameters)) as unknown[];
  }

  /**
   * 执行原始查询并返回第一条结果
   * @param query SQL 查询字符串
   * @param parameters 可选参数数组
   * @returns 第一条记录或 `undefined`
   */
  async queryOne(query: string, parameters?: unknown[]): Promise<unknown | undefined> {
    const results = (await this.dataSource.query(query, parameters)) as unknown[];
    return results.length > 0 ? results[0] : undefined;
  }

  /**
   * 在事务中执行传入函数
   * @param fn 接收 manager 的事务函数
   * @returns 事务执行结果
   */
  async executeTransaction<T>(fn: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(fn);
  }

  // 抽象方法，子类必须实现
  abstract deleteCollection(collectionId: CollectionId): Promise<void>;
  abstract deleteDoc(docId: DocId): Promise<boolean>;
  abstract getChunksByPointIds(
    pointIds: PointId[],
    collectionId: CollectionId,
  ): Promise<SearchResult[]>;
  abstract getDocumentChunks(docId: DocId): Promise<
    Array<{
      pointId: PointId;
      docId: DocId;
      collectionId: CollectionId;
      chunkIndex: number;
      title?: string;
      content: string;
    }>
  >;
  abstract getDocumentChunksPaginated(docId: DocId, query: PaginationQuery): Promise<
    PaginatedResponse<{
      pointId: PointId;
      docId: DocId;
      collectionId: CollectionId;
      chunkIndex: number;
      title?: string;
      content: string;
    }>
  >;
  abstract getDoc(docId: DocId): Promise<Doc | undefined>;
  abstract getChunkMetasByDocId(docId: DocId): Promise<ChunkMeta[]>;
  abstract getChunkMetasByCollectionId(
    collectionId: CollectionId,
  ): Promise<ChunkMeta[]>;
  abstract getChunkTexts(
    pointIds: PointId[],
  ): Promise<Record<string, { content: string }>>;
  abstract addChunks(docId: DocId, documentChunks: DocumentChunk[]): Promise<void>;
  abstract markDocAsSynced(docId: DocId): Promise<void>;
  abstract getAllCollectionIds(): Promise<CollectionId[]>;
  abstract listDeletedDocs(): Promise<Doc[]>;
  abstract hardDelete(docId: DocId): Promise<void>;
  abstract deleteBatch(pointIds: PointId[]): Promise<void>;
  abstract runMigrations(migrations: DatabaseMigration[]): Promise<{
    success: boolean;
    applied: string[];
    failed: string[];
    error?: string;
  }>;
  abstract getPendingMigrations(migrations: DatabaseMigration[]): Promise<DatabaseMigration[]>;
  abstract getAppliedMigrations(): Promise<DatabaseMigration[]>;
  abstract createBackup(backupPath: string): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }>;
  abstract restoreFromBackup(backupPath: string): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }>;
  abstract optimize(): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }>;
  abstract getStatistics(): Promise<{
    totalCollections: number;
    totalDocuments: number;
    totalChunks: number;
    databaseSize: number;
    indexSize: number;
  }>;
  abstract toDomainObject(entity: T): unknown;
  abstract fromDomainObject(domainObject: unknown): Partial<T>;
}
