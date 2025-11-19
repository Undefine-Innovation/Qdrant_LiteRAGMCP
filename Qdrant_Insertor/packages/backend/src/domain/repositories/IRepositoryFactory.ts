import {
  IRepository,
  IQueryRepository,
  ICommandRepository,
  IAggregateRepository,
} from './index.js';
import { DatabaseConfig, EntityFactory, LoggerLike } from './IDatabaseRepository.js';
import { IQdrantRepo } from './IQdrantRepo.js';

/**
 * 统一仓库工厂接口
 * 负责创建各种类型的仓库实例
 */
export interface IRepositoryFactory {
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
    logger: LoggerLike,
    qdrantRepo?: IQdrantRepo,
  ): IRepository<T, ID>;

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
    logger: LoggerLike,
  ): IQueryRepository<T, ID>;

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
    logger: LoggerLike,
  ): ICommandRepository<T, ID>;

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
    logger: LoggerLike,
    qdrantRepo?: IQdrantRepo,
  ): IAggregateRepository<T, ID>;

  /**
   * 创建集合聚合仓库
   * @param config 数据库配置
   * @param logger 日志记录器
   * @param qdrantRepo Qdrant仓库（可选）
   * @returns 集合聚合仓库实例
   */
  createCollectionAggregateRepository(
    config: DatabaseConfig,
    logger: LoggerLike,
    qdrantRepo?: IQdrantRepo,
  ): import('./IAggregateRepository.js').ICollectionAggregateRepository;

  /**
   * 创建文档聚合仓库
   * @param config 数据库配置
   * @param logger 日志记录器
   * @param qdrantRepo Qdrant仓库（可选）
   * @returns 文档聚合仓库实例
   */
  createDocumentAggregateRepository(
    config: DatabaseConfig,
    logger: LoggerLike,
    qdrantRepo?: IQdrantRepo,
  ): import('./IAggregateRepository.js').IDocumentAggregateRepository;

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
    logger: LoggerLike,
    qdrantRepo?: IQdrantRepo,
  ): import('./IDatabaseRepository.js').IDatabaseRepository<T, ID>;

  /**
   * 注册自定义仓库类型
   * @param repositoryType 仓库类型名称
   * @param factory 工厂函数
   */
  /**
   * 注册自定义仓库类型的工厂函数签名
   */
  registerRepositoryType(
    repositoryType: string,
    factory: <T, ID>(
      entityClass: EntityFactory<T>,
      config: DatabaseConfig,
      logger: LoggerLike,
      qdrantRepo?: IQdrantRepo,
    ) => IRepository<T, ID>,
  ): void;

  /**
   * 获取已注册的仓库类型
   * @param repositoryType 仓库类型名称
   * @returns 工厂函数
   */
  getRegisteredRepositoryType(
    repositoryType: string,
  ):
    | (<T, ID>(
        entityClass: EntityFactory<T>,
        config: DatabaseConfig,
        logger: LoggerLike,
        qdrantRepo?: IQdrantRepo,
      ) => IRepository<T, ID>)
    | undefined;

  /**
   * 获取所有已注册的仓库类型
   * @returns 仓库类型映射
   */
  getAllRegisteredRepositoryTypes(): Map<
    string,
    <T, ID>(
      entityClass: EntityFactory<T>,
      config: DatabaseConfig,
      logger: LoggerLike,
      qdrantRepo?: IQdrantRepo,
    ) => IRepository<T, ID>
  >;

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
    logger: LoggerLike,
    qdrantRepo?: IQdrantRepo,
  ):
    | IRepository<T, ID>
    | IQueryRepository<T, ID>
    | ICommandRepository<T, ID>
    | IAggregateRepository<T, ID>;

  /**
   * 验证配置
   * @param config 数据库配置
   * @returns 验证结果
   */
  validateConfig(config: DatabaseConfig): {
    isValid: boolean;
    errors: string[];
  };

  /**
   * 获取支持的数据库类型
   * @returns 支持的数据库类型列表
   */
  getSupportedDatabaseTypes(): string[];

  /**
   * 检查数据库连接
   * @param config 数据库配置
   * @returns 连接状态
   */
  testConnection(config: DatabaseConfig): Promise<{
    connected: boolean;
    error?: string;
    responseTime?: number;
  }>;

  /**
   * 创建仓库管理器
   * @param config 数据库配置
   * @param logger 日志记录器
   * @param qdrantRepo Qdrant仓库（可选）
   * @returns 仓库管理器实例
   */
  createRepositoryManager(
    config: DatabaseConfig,
    logger: LoggerLike,
    qdrantRepo?: IQdrantRepo,
  ): IRepositoryManager;
}

/**
 * 仓库管理器接口
 * 管理多个仓库实例的生命周期
 */
export interface IRepositoryManager {
  /**
   * 获取基础仓库
   * @param entityClass 实体类
   * @returns 基础仓库实例
   */
  getRepository<T, ID>(entityClass: EntityFactory<T>): IRepository<T, ID>;

  /**
   * 获取查询仓库
   * @param entityClass 实体类
   * @returns 查询仓库实例
   */
  getQueryRepository<T, ID>(entityClass: EntityFactory<T>): IQueryRepository<T, ID>;

  /**
   * 获取命令仓库
   * @param entityClass 实体类
   * @returns 命令仓库实例
   */
  getCommandRepository<T, ID>(entityClass: EntityFactory<T>): ICommandRepository<T, ID>;

  /**
   * 获取聚合仓库
   * @param entityClass 实体类
   * @returns 聚合仓库实例
   */
  getAggregateRepository<T, ID>(entityClass: EntityFactory<T>): IAggregateRepository<T, ID>;

  /**
   * 获取集合聚合仓库
   * @returns 集合聚合仓库实例
   */
  getCollectionAggregateRepository(): import('./IAggregateRepository.js').ICollectionAggregateRepository;

  /**
   * 获取文档聚合仓库
   * @returns 文档聚合仓库实例
   */
  getDocumentAggregateRepository(): import('./IAggregateRepository.js').IDocumentAggregateRepository;

  /**
   * 获取数据库仓库
   * @param entityClass 实体类
   * @returns 数据库仓库实例
   */
  getDatabaseRepository<T, ID>(
    entityClass: EntityFactory<T>,
  ): import('./IDatabaseRepository.js').IDatabaseRepository<T, ID>;

  /**
   * 在事务中执行操作
   * @param operation 事务操作函数
   * @returns 操作结果
   */
  executeInTransaction<T>(
    operation: (manager: IRepositoryManager) => Promise<T>,
  ): Promise<T>;

  /**
   * 开始事务
   * @returns 事务上下文
   */
  beginTransaction(): Promise<
    import('./IDatabaseRepository.js').ITransactionContext
  >;

  /**
   * 提交事务
   * @param context 事务上下文
   */
  commitTransaction(
    context: import('./IDatabaseRepository.js').ITransactionContext,
  ): Promise<void>;

  /**
   * 回滚事务
   * @param context 事务上下文
   */
  rollbackTransaction(
    context: import('./IDatabaseRepository.js').ITransactionContext,
  ): Promise<void>;

  /**
   * 获取所有活跃的仓库实例
   * @returns 仓库实例映射
   */
  getActiveRepositories(): Map<string, IRepository<unknown, unknown>>;

  /**
   * 清理资源
   */
  dispose(): Promise<void>;

  /**
   * 获取管理器状态
   * @returns 状态信息
   */
  getStatus(): {
    activeRepositories: number;
    transactionActive: boolean;
    lastActivity: Date;
  };
}

/**
 * 仓库工厂配置接口
 */
export interface IRepositoryFactoryConfig {
  /** 默认数据库配置 */
  defaultDatabaseConfig?: DatabaseConfig;
  /** 是否启用缓存 */
  enableCache?: boolean;
  /** 缓存配置 */
  cacheConfig?: {
    ttl?: number;
    maxSize?: number;
  };
  /** 是否启用性能监控 */
  enablePerformanceMonitoring?: boolean;
  /** 是否启用连接池 */
  enableConnectionPool?: boolean;
  /** 连接池配置 */
  connectionPoolConfig?: {
    min: number;
    max: number;
    idleTimeoutMillis: number;
  };
  /** 自定义仓库类型映射 */
  customRepositoryTypes?: Map<
    string,
    <T, ID>(
      entityClass: EntityFactory<T>,
      config: DatabaseConfig,
      logger: LoggerLike,
      qdrantRepo?: IQdrantRepo,
    ) => IRepository<T, ID>
  >;
}

/**
 * 仓库工厂构建器接口
 */
export interface IRepositoryFactoryBuilder {
  /**
   * 设置默认数据库配置
   * @param config 数据库配置
   * @returns 构建器实例
   */
  withDefaultConfig(config: DatabaseConfig): IRepositoryFactoryBuilder;

  /**
   * 启用缓存
   * @param ttl 缓存TTL
   * @param maxSize 最大缓存大小
   * @returns 构建器实例
   */
  withCache(ttl?: number, maxSize?: number): IRepositoryFactoryBuilder;

  /**
   * 启用性能监控
   * @returns 构建器实例
   */
  withPerformanceMonitoring(): IRepositoryFactoryBuilder;

  /**
   * 启用连接池
   * @param config 连接池配置
   * @returns 构建器实例
   */
  withConnectionPool(config?: {
    min: number;
    max: number;
    idleTimeoutMillis: number;
  }): IRepositoryFactoryBuilder;

  /**
   * 注册自定义仓库类型
   * @param repositoryType 仓库类型名称
   * @param factory 工厂函数
   * @returns 构建器实例
   */
  withCustomRepositoryType(
    repositoryType: string,
    factory: <T, ID>(
      entityClass: EntityFactory<T>,
      config: DatabaseConfig,
      logger: LoggerLike,
      qdrantRepo?: IQdrantRepo,
    ) => IRepository<T, ID>,
  ): IRepositoryFactoryBuilder;

  /**
   * 构建仓库工厂
   * @returns 仓库工厂实例
   */
  build(): IRepositoryFactory;
}
