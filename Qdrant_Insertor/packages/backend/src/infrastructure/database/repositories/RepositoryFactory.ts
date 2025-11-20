import { DataSource, DataSourceOptions } from 'typeorm';
import {
  IRepositoryFactory,
  IRepositoryManager,
  IRepositoryFactoryConfig,
  IRepositoryFactoryBuilder,
} from '@domain/repositories/IRepositoryFactory.js';
import {
  IRepository,
  IQueryRepository,
  ICommandRepository,
  IAggregateRepository,
} from '@domain/repositories/index.js';
import {
  DatabaseConfig,
  IDatabaseRepository,
} from '@domain/repositories/IDatabaseRepository.js';
import { EntityFactory } from '@domain/repositories/IDatabaseRepository.js';
import { Logger } from '@logging/logger.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';
import { AbstractRepository } from './AbstractRepository.js';
import { DatabaseRepository } from './DatabaseRepository.js';

/**
 * 仓库工厂实现
 * 负责创建各种类型的仓库实例
 */
/**
 * 自定义仓库类型的工厂函数签名
 */
type RepositoryFactoryFn = <T, ID>(
  entityClass: EntityFactory<T>,
  config: DatabaseConfig,
  logger: Logger,
  qdrantRepo?: IQdrantRepo,
) => IRepository<T, ID>;

export class RepositoryFactory implements IRepositoryFactory {
  private readonly config: IRepositoryFactoryConfig;
  private readonly customRepositoryTypes: Map<string, RepositoryFactoryFn> = new Map();

  constructor(config: IRepositoryFactoryConfig = {}) {
    this.config = {
      enableCache: false,
      enablePerformanceMonitoring: false,
      enableConnectionPool: true,
      ...config,
    };
  }

  static getEntityName(entityClass: EntityFactory<unknown>): string {
    if (typeof entityClass === 'string') return entityClass;
    if (typeof entityClass === 'function') {
      const fn = entityClass as unknown as { name?: unknown };
      if (typeof fn.name === 'string') return fn.name;
      return '<anonymous>';
    }
    const maybeName = (entityClass as unknown as { name?: unknown })?.name;
    if (typeof maybeName === 'string') return maybeName;
    return 'unknown';
  }

  /**
   * 创建基础仓库
   * @param entityClass 实体类
   * @param config 数据库配置
   * @param logger 日志记录器
   * @param qdrantRepo Qdrant仓库（可选）
   * @returns 基础仓库实例
   */
  createRepository<T, ID>(
    entityClass: EntityFactory<T>,
    config: DatabaseConfig,
    logger: Logger,
    qdrantRepo?: IQdrantRepo,
  ): IRepository<T, ID> {
    this.validateConfig(config);

    switch (config.type) {
      case 'postgresql':
        return this.createPostgreSQLRepository<T, ID>(
          entityClass,
          config,
          logger,
          qdrantRepo,
        );
      case 'sqlite':
        return this.createSQLiteRepository<T, ID>(
          entityClass,
          config,
          logger,
          qdrantRepo,
        );
      case 'typeorm':
        return this.createTypeORMRepository<T, ID>(
          entityClass,
          config,
          logger,
          qdrantRepo,
        );
      default:
        throw new Error(`Unsupported database type: ${config.type}`);
    }
  }

  /**
   * 创建查询仓库
   * @param entityClass 实体类
   * @param config 数据库配置
   * @param logger 日志记录器
   * @returns 查询仓库实例
   */
  createQueryRepository<T, ID>(
    entityClass: EntityFactory<T>,
    config: DatabaseConfig,
    logger: Logger,
  ): IQueryRepository<T, ID> {
    // 查询仓库通常基于基础仓库实现
    const baseRepository = this.createRepository<T, ID>(
      entityClass,
      config,
      logger,
    );

    // 这里应该返回一个实现了IQueryRepository的实例
    // 为了简化，暂时返回基础仓库
    // 在实际实现中，应该创建一个QueryRepository包装器
    return baseRepository as IQueryRepository<T, ID>;
  }

  /**
   * 创建命令仓库
   * @param entityClass 实体类
   * @param config 数据库配置
   * @param logger 日志记录器
   * @returns 命令仓库实例
   */
  createCommandRepository<T, ID>(
    entityClass: EntityFactory<T>,
    config: DatabaseConfig,
    logger: Logger,
  ): ICommandRepository<T, ID> {
    // 命令仓库通常基于基础仓库实现
    const baseRepository = this.createRepository<T, ID>(
      entityClass,
      config,
      logger,
    );

    // 这里应该返回一个实现了ICommandRepository的实例
    // 为了简化，暂时返回基础仓库
    // 在实际实现中，应该创建一个CommandRepository包装器
    return baseRepository as ICommandRepository<T, ID>;
  }

  /**
   * 创建聚合仓库
   * @param entityClass 实体类
   * @param config 数据库配置
   * @param logger 日志记录器
   * @param qdrantRepo Qdrant仓库（可选）
   * @returns 聚合仓库实例
   */
  createAggregateRepository<T, ID>(
    entityClass: EntityFactory<T>,
    config: DatabaseConfig,
    logger: Logger,
    qdrantRepo?: IQdrantRepo,
  ): IAggregateRepository<T, ID> {
    // 聚合仓库通常基于数据库仓库实现
    const databaseRepository = this.createDatabaseRepository<T, ID>(
      entityClass,
      config,
      logger,
      qdrantRepo,
    );

    // 这里应该返回一个实现了IAggregateRepository的实例
    // 为了简化，暂时返回数据库仓库
    // 在实际实现中，应该创建一个AggregateRepository包装器
    return databaseRepository as IAggregateRepository<T, ID>;
  }

  /**
   * 创建集合聚合仓库
   * @param config 数据库配置
   * @param logger 日志记录器
   * @param qdrantRepo Qdrant仓库（可选）
   * @returns 集合聚合仓库实例
   */
  createCollectionAggregateRepository(
    config: DatabaseConfig,
    logger: Logger,
    qdrantRepo?: IQdrantRepo,
  ): import('@domain/repositories/IAggregateRepository.js').ICollectionAggregateRepository {
    // 这里应该创建一个专门的集合聚合仓库实现
    // 为了简化，暂时抛出未实现错误
    throw new Error('CollectionAggregateRepository not implemented yet');
  }

  /**
   * 创建文档聚合仓库
   * @param config 数据库配置
   * @param logger 日志记录器
   * @param qdrantRepo Qdrant仓库（可选）
   * @returns 文档聚合仓库实例
   */
  createDocumentAggregateRepository(
    config: DatabaseConfig,
    logger: Logger,
    qdrantRepo?: IQdrantRepo,
  ): import('@domain/repositories/IAggregateRepository.js').IDocumentAggregateRepository {
    // 这里应该创建一个专门的文档聚合仓库实现
    // 为了简化，暂时抛出未实现错误
    throw new Error('DocumentAggregateRepository not implemented yet');
  }

  /**
   * 创建数据库仓库
   * @param entityClass 实体类
   * @param config 数据库配置
   * @param logger 日志记录器
   * @param qdrantRepo Qdrant仓库（可选）
   * @returns 数据库仓库实例
   */
  createDatabaseRepository<T, ID>(
    entityClass: EntityFactory<T>,
    config: DatabaseConfig,
    logger: Logger,
    qdrantRepo?: IQdrantRepo,
  ): IDatabaseRepository<T, ID> {
    this.validateConfig(config);

    switch (config.type) {
      case 'postgresql':
        return this.createPostgreSQLRepository<T, ID>(
          entityClass,
          config,
          logger,
          qdrantRepo,
        );
      case 'sqlite':
        return this.createSQLiteRepository<T, ID>(
          entityClass,
          config,
          logger,
          qdrantRepo,
        );
      case 'typeorm':
        return this.createTypeORMRepository<T, ID>(
          entityClass,
          config,
          logger,
          qdrantRepo,
        );
      default:
        throw new Error(`Unsupported database type: ${config.type}`);
    }
  }

  /**
   * 注册自定义仓库类型
   * @param repositoryType 仓库类型名称
   * @param factory 工厂函数
   */
  registerRepositoryType(
    repositoryType: string,
    factory: RepositoryFactoryFn,
  ): void {
    this.customRepositoryTypes.set(repositoryType, factory);
  }

  /**
   * 获取已注册的仓库类型
   * @param repositoryType 仓库类型名称
   * @returns 工厂函数
   */
  getRegisteredRepositoryType(
    repositoryType: string,
  ):
    | RepositoryFactoryFn
    | undefined {
    return this.customRepositoryTypes.get(repositoryType);
  }

  /**
   * 获取所有已注册的仓库类型
   * @returns 仓库类型映射
   */
  getAllRegisteredRepositoryTypes(): Map<string, RepositoryFactoryFn> {
    return new Map(this.customRepositoryTypes) as Map<string, RepositoryFactoryFn>;
  }

  /**
   * 创建指定类型的仓库
   * @param repositoryType 仓库类型
   * @param entityClass 实体类
   * @param config 数据库配置
   * @param logger 日志记录器
   * @param qdrantRepo Qdrant仓库（可选）
   * @returns 仓库实例
   */
  createRepositoryByType<T, ID>(
    repositoryType: string,
    entityClass: EntityFactory<T>,
    config: DatabaseConfig,
    logger: Logger,
    qdrantRepo?: IQdrantRepo,
  ):
    | IRepository<T, ID>
    | IQueryRepository<T, ID>
    | ICommandRepository<T, ID>
    | IAggregateRepository<T, ID> {
    const customFactory = this.customRepositoryTypes.get(repositoryType) as RepositoryFactoryFn | undefined;
    if (customFactory) {
      // call the custom factory and narrow the return to expected repository unions
      const repo = customFactory(entityClass as EntityFactory<unknown>, config, logger, qdrantRepo);
      return repo as unknown as
        | IRepository<T, ID>
        | IQueryRepository<T, ID>
        | ICommandRepository<T, ID>
        | IAggregateRepository<T, ID>;
    }

    throw new Error(`Unknown repository type: ${repositoryType}`);
  }

  /**
   * 验证配置
   * @param config 数据库配置
   * @returns 验证结果
   */
  validateConfig(config: DatabaseConfig): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!config.type) {
      errors.push('Database type is required');
    }

    if (!config.connectionString) {
      errors.push('Connection string is required');
    }

    if (
      config.type &&
      !this.getSupportedDatabaseTypes().includes(config.type)
    ) {
      errors.push(`Unsupported database type: ${config.type}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 获取支持的数据库类型
   * @returns 支持的数据库类型列表
   */
  getSupportedDatabaseTypes(): string[] {
    return ['postgresql', 'sqlite', 'typeorm'];
  }

  /**
   * 检查数据库连接
   * @param config 数据库配置
   * @returns 连接状态
   */
  async testConnection(config: DatabaseConfig): Promise<{
    connected: boolean;
    error?: string;
    responseTime?: number;
  }> {
    const startTime = Date.now();

    try {
      const dsType: DataSourceOptions['type'] = config.type === 'postgresql' ? 'postgres' : config.type === 'sqlite' ? 'sqlite' : (config.type as DataSourceOptions['type']);
      const dataSource = new DataSource({
        // TypeORM expects db driver names like 'postgres' / 'sqlite'
        type: dsType,
        url: config.connectionString,
        ...config.pool,
      } as DataSourceOptions);

      await dataSource.initialize();
      await dataSource.query('SELECT 1');
      await dataSource.destroy();

      const responseTime = Date.now() - startTime;

      return {
        connected: true,
        responseTime,
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * 创建仓库管理器
   * @param config 数据库配置
   * @param logger 日志记录器
   * @param qdrantRepo Qdrant仓库（可选）
   * @returns 仓库管理器实例
   */
  createRepositoryManager(
    config: DatabaseConfig,
    logger: Logger,
    qdrantRepo?: IQdrantRepo,
  ): IRepositoryManager {
    return new RepositoryManager(this, config, logger, qdrantRepo);
  }

  /**
   * 创建PostgreSQL仓库
   * @param entityClass 实体类
   * @param config 数据库配置
   * @param logger 日志记录器
   * @param qdrantRepo Qdrant仓库（可选）
   * @returns PostgreSQL仓库实例
   */
  protected createPostgreSQLRepository<T, ID>(
    entityClass: EntityFactory<T>,
    config: DatabaseConfig,
    logger: Logger,
    qdrantRepo?: IQdrantRepo,
  ): IDatabaseRepository<T, ID> {
    // 这里应该创建一个具体的PostgreSQLRepository实现
    // 为了简化，暂时抛出未实现错误
    throw new Error('PostgreSQLRepository not implemented yet');
  }

  /**
   * 创建SQLite仓库
   * @param entityClass 实体类
   * @param config 数据库配置
   * @param logger 日志记录器
   * @param qdrantRepo Qdrant仓库（可选）
   * @returns SQLite仓库实例
   */
  protected createSQLiteRepository<T, ID>(
    entityClass: EntityFactory<T>,
    config: DatabaseConfig,
    logger: Logger,
    qdrantRepo?: IQdrantRepo,
  ): IDatabaseRepository<T, ID> {
    // 这里应该创建一个具体的SQLiteRepository实现
    // 为了简化，暂时抛出未实现错误
    throw new Error('SQLiteRepository not implemented yet');
  }

  /**
   * 创建TypeORM仓库
   * @param entityClass 实体类
   * @param config 数据库配置
   * @param logger 日志记录器
   * @param qdrantRepo Qdrant仓库（可选）
   * @returns TypeORM仓库实例
   */
  protected createTypeORMRepository<T, ID>(
    entityClass: EntityFactory<T>,
    config: DatabaseConfig,
    logger: Logger,
    qdrantRepo?: IQdrantRepo,
  ): IDatabaseRepository<T, ID> {
    // 这里应该创建一个具体的TypeORMRepository实现
    // 为了简化，暂时抛出未实现错误
    throw new Error('TypeORMRepository not implemented yet');
  }
}

/**
 * 仓库管理器实现
 * 管理多个仓库实例的生命周期
 */
class RepositoryManager implements IRepositoryManager {
  private readonly factory: RepositoryFactory;
  private readonly config: DatabaseConfig;
  private readonly logger: Logger;
  private readonly qdrantRepo?: IQdrantRepo;
  private readonly activeRepositories: Map<string, unknown> = new Map();
  private currentTransaction?: import('@domain/repositories/IDatabaseRepository.js').ITransactionContext;
  private lastActivity: Date = new Date();

  constructor(
    factory: RepositoryFactory,
    config: DatabaseConfig,
    logger: Logger,
    qdrantRepo?: IQdrantRepo,
  ) {
    this.factory = factory;
    this.config = config;
    this.logger = logger;
    this.qdrantRepo = qdrantRepo;
  }

  /**
   * 获取基础仓库
   * @param entityClass 实体类
   * @returns 基础仓库实例
   */
  getRepository<T, ID>(entityClass: EntityFactory<T>): IRepository<T, ID> {
    const key = `repository_${RepositoryFactory.getEntityName(entityClass)}`;

    if (!this.activeRepositories.has(key)) {
      const repository = this.factory.createRepository<T, ID>(
        entityClass,
        this.config,
        this.logger,
        this.qdrantRepo,
      );
      this.activeRepositories.set(key, repository);
    }

    this.lastActivity = new Date();
    return this.activeRepositories.get(key) as IRepository<T, ID>;
  }

  /**
   * 获取查询仓库
   * @param entityClass 实体类
   * @returns 查询仓库实例
   */
  getQueryRepository<T, ID>(entityClass: EntityFactory<T>): IQueryRepository<T, ID> {
    const key = `query_${RepositoryFactory.getEntityName(entityClass)}`;

    if (!this.activeRepositories.has(key)) {
      const repository = this.factory.createQueryRepository<T, ID>(
        entityClass,
        this.config,
        this.logger,
      );
      this.activeRepositories.set(key, repository);
    }

    this.lastActivity = new Date();
    return this.activeRepositories.get(key) as IQueryRepository<T, ID>;
  }

  /**
   * 获取命令仓库
   * @param entityClass 实体类
   * @returns 命令仓库实例
   */
  getCommandRepository<T, ID>(entityClass: EntityFactory<T>): ICommandRepository<T, ID> {
    const key = `command_${RepositoryFactory.getEntityName(entityClass)}`;

    if (!this.activeRepositories.has(key)) {
      const repository = this.factory.createCommandRepository<T, ID>(
        entityClass,
        this.config,
        this.logger,
      );
      this.activeRepositories.set(key, repository);
    }

    this.lastActivity = new Date();
    return this.activeRepositories.get(key) as ICommandRepository<T, ID>;
  }

  /**
   * 获取聚合仓库
   * @param entityClass 实体类
   * @returns 聚合仓库实例
   */
  getAggregateRepository<T, ID>(entityClass: EntityFactory<T>): IAggregateRepository<T, ID> {
    const key = `aggregate_${RepositoryFactory.getEntityName(entityClass)}`;

    if (!this.activeRepositories.has(key)) {
      const repository = this.factory.createAggregateRepository<T, ID>(
        entityClass,
        this.config,
        this.logger,
        this.qdrantRepo,
      );
      this.activeRepositories.set(key, repository);
    }

    this.lastActivity = new Date();
    return this.activeRepositories.get(key) as IAggregateRepository<T, ID>;
  }

  /**
   * 获取集合聚合仓库
   * @returns 集合聚合仓库实例
   */
  getCollectionAggregateRepository(): import('@domain/repositories/IAggregateRepository.js').ICollectionAggregateRepository {
    const key = 'collection_aggregate';

    if (!this.activeRepositories.has(key)) {
      const repository = this.factory.createCollectionAggregateRepository(
        this.config,
        this.logger,
        this.qdrantRepo,
      );
      this.activeRepositories.set(key, repository);
    }

    this.lastActivity = new Date();
    return this.activeRepositories.get(key) as import('@domain/repositories/IAggregateRepository.js').ICollectionAggregateRepository;
  }

  /**
   * 获取文档聚合仓库
   * @returns 文档聚合仓库实例
   */
  getDocumentAggregateRepository(): import('@domain/repositories/IAggregateRepository.js').IDocumentAggregateRepository {
    const key = 'document_aggregate';

    if (!this.activeRepositories.has(key)) {
      const repository = this.factory.createDocumentAggregateRepository(
        this.config,
        this.logger,
        this.qdrantRepo,
      );
      this.activeRepositories.set(key, repository);
    }

    this.lastActivity = new Date();
    return this.activeRepositories.get(key) as import('@domain/repositories/IAggregateRepository.js').IDocumentAggregateRepository;
  }

  /**
   * 获取数据库仓库
   * @param entityClass 实体类
   * @returns 数据库仓库实例
   */
  getDatabaseRepository<T, ID>(
    entityClass: EntityFactory<T>,
  ): import('@domain/repositories/IDatabaseRepository.js').IDatabaseRepository<
    T,
    ID
  > {
    const key = `database_${RepositoryFactory.getEntityName(entityClass)}`;

    if (!this.activeRepositories.has(key)) {
      const repository = this.factory.createDatabaseRepository<T, ID>(
        entityClass,
        this.config,
        this.logger,
        this.qdrantRepo,
      );
      this.activeRepositories.set(key, repository);
    }

    this.lastActivity = new Date();
    return this.activeRepositories.get(key) as import('@domain/repositories/IDatabaseRepository.js').IDatabaseRepository<
      T,
      ID
    >;
  }

  /**
   * 在事务中执行操作
   * @param operation 事务操作函数
   * @returns 操作结果
   */
  async executeInTransaction<T>(
    operation: (manager: IRepositoryManager) => Promise<T>,
  ): Promise<T> {
    const context = await this.beginTransaction();
    try {
      const result = await operation(this);
      await this.commitTransaction(context);
      return result;
    } catch (error) {
      await this.rollbackTransaction(context);
      throw error;
    }
  }

  /**
   * 开始事务
   * @returns 事务上下文
   */
  async beginTransaction(): Promise<
    import('@domain/repositories/IDatabaseRepository.js').ITransactionContext
  > {
    if (this.currentTransaction) {
      throw new Error('Transaction already active');
    }

    const databaseRepo = this.getDatabaseRepository<unknown, unknown>(Object as unknown as EntityFactory<unknown>);
    this.currentTransaction = await databaseRepo.beginTransaction();
    return this.currentTransaction;
  }

  /**
   * 提交事务
   * @param context 事务上下文
   */
  async commitTransaction(
    context: import('@domain/repositories/IDatabaseRepository.js').ITransactionContext,
  ): Promise<void> {
    if (
      !this.currentTransaction ||
      this.currentTransaction.transactionId !== context.transactionId
    ) {
      throw new Error('Invalid transaction context');
    }

    const databaseRepo = this.getDatabaseRepository<unknown, unknown>(Object as unknown as EntityFactory<unknown>);
    await databaseRepo.commitTransaction(context);
    this.currentTransaction = undefined;
  }

  /**
   * 回滚事务
   * @param context 事务上下文
   */
  async rollbackTransaction(
    context: import('@domain/repositories/IDatabaseRepository.js').ITransactionContext,
  ): Promise<void> {
    if (
      !this.currentTransaction ||
      this.currentTransaction.transactionId !== context.transactionId
    ) {
      throw new Error('Invalid transaction context');
    }

    const databaseRepo = this.getDatabaseRepository<unknown, unknown>(Object as unknown as EntityFactory<unknown>);
    await databaseRepo.rollbackTransaction(context);
    this.currentTransaction = undefined;
  }

  /**
   * 获取所有活跃的仓库实例
   * @returns 仓库实例映射
   */
  getActiveRepositories(): Map<string, IRepository<unknown, unknown>> {
    const result = new Map<string, IRepository<unknown, unknown>>();
    for (const [k, v] of this.activeRepositories.entries()) {
      result.set(k, v as IRepository<unknown, unknown>);
    }
    return result;
  }

  /**
   * 清理资源
   */
  async dispose(): Promise<void> {
    this.activeRepositories.clear();
    this.currentTransaction = undefined;
    this.logger.info?.('RepositoryManager disposed');
  }

  /**
   * 获取管理器状态
   * @returns 状态信息
   */
  getStatus(): {
    activeRepositories: number;
    transactionActive: boolean;
    lastActivity: Date;
  } {
    return {
      activeRepositories: this.activeRepositories.size,
      transactionActive: !!this.currentTransaction,
      lastActivity: this.lastActivity,
    };
  }
}

/**
 * 仓库工厂构建器实现
 */
export class RepositoryFactoryBuilder implements IRepositoryFactoryBuilder {
  private config: IRepositoryFactoryConfig = {};

  /**
   * 设置默认数据库配置
   * @param config 数据库配置
   * @returns 构建器实例
   */
  withDefaultConfig(config: DatabaseConfig): IRepositoryFactoryBuilder {
    this.config.defaultDatabaseConfig = config;
    return this;
  }

  /**
   * 启用缓存
   * @param ttl 缓存TTL
   * @param maxSize 最大缓存大小
   * @returns 构建器实例
   */
  withCache(ttl?: number, maxSize?: number): IRepositoryFactoryBuilder {
    this.config.enableCache = true;
    if (ttl !== undefined) {
      this.config.cacheConfig = { ...this.config.cacheConfig, ttl };
    }
    if (maxSize !== undefined) {
      this.config.cacheConfig = { ...this.config.cacheConfig, maxSize };
    }
    return this;
  }

  /**
   * 启用性能监控
   * @returns 构建器实例
   */
  withPerformanceMonitoring(): IRepositoryFactoryBuilder {
    this.config.enablePerformanceMonitoring = true;
    return this;
  }

  /**
   * 启用连接池
   * @param config 连接池配置参数
   * @param config.min 最小连接数
   * @param config.max 最大连接数
   * @param config.idleTimeoutMillis 空闲超时时间（毫秒）
   * @returns 构建器实例
   */
  withConnectionPool(config?: {
    min: number;
    max: number;
    idleTimeoutMillis: number;
  }): IRepositoryFactoryBuilder {
    this.config.enableConnectionPool = true;
    if (config) {
      this.config.connectionPoolConfig = config;
    }
    return this;
  }

  /**
   * 注册自定义仓库类型
   * @param repositoryType 仓库类型名称
   * @param factory 工厂函数
   * @returns 构建器实例
   */
  withCustomRepositoryType(
    repositoryType: string,
    factory: RepositoryFactoryFn,
  ): IRepositoryFactoryBuilder {
    if (!this.config.customRepositoryTypes) {
      this.config.customRepositoryTypes = new Map();
    }
    this.config.customRepositoryTypes.set(repositoryType, factory as RepositoryFactoryFn);
    return this;
  }

  /**
   * 构建仓库工厂
   * @returns 仓库工厂实例
   */
  build(): IRepositoryFactory {
    const factory = new RepositoryFactory(this.config);

    // 注册自定义仓库类型
    if (this.config.customRepositoryTypes) {
      for (const [type, factoryFn] of this.config.customRepositoryTypes) {
        factory.registerRepositoryType(type, factoryFn);
      }
    }

    return factory;
  }
}
