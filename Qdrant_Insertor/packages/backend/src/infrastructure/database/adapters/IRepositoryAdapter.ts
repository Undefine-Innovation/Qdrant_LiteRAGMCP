import { DataSource, EntityTarget, ObjectLiteral } from 'typeorm';
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
  IDatabaseRepository,
  DatabaseType,
  DatabaseConfig,
  DatabaseHealthStatus,
  DatabaseMigration,
  DatabasePerformanceMetrics,
} from '@domain/interfaces/IDatabaseRepository.js';

/**
 * 通用仓库适配器接口
 * 提供统一的数据库操作接口，支持多种数据库类型
 * @template T 实体类型
 */
export interface IRepositoryAdapter<T> extends IDatabaseRepository {
  /**
   * 数据库类型
   */
  readonly databaseType: DatabaseType;

  /**
   * 数据库配置
   */
  readonly config: DatabaseConfig;

  /**
   * TypeORM数据源
   */
  readonly dataSource: DataSource;

  /**
   * 日志记录器（宽松接口，允许替代实现）
   */
  readonly logger: LoggerLike;

  /**
   * 创建实体
   * @param entity 要创建的实体
   * @returns 创建的实体
   */
  create(entity: Partial<T>): Promise<T>;

  /**
   * 批量创建实体
   * @param entities 要创建的实体数组
   * @returns 创建的实体数组
   */
  createBatch(entities: Partial<T>[]): Promise<T[]>;

  /**
   * 根据ID查找实体
   * @param id 实体ID
   * @returns 找到的实体或undefined
   */
  findById(id: string | number): Promise<T | undefined>;

  /**
   * 根据条件查找实体
   * @param conditions 查询条件
   * @returns 找到的实体数组
   */
  find(conditions: Partial<T>): Promise<T[]>;

  /**
   * 查找单个实体
   * @param conditions 查询条件
   * @returns 找到的实体或undefined
   */
  findOne(conditions: Partial<T>): Promise<T | undefined>;

  /**
   * 更新实体
   * @param conditions 查询条件
   * @param updates 更新数据
   * @returns 更新结果
   */
  update(
    conditions: Partial<T>,
    updates: Partial<T>,
  ): Promise<{ affected: number }>;

  /**
   * 删除实体
   * @param conditions 查询条件
   * @returns 删除结果
   */
  delete(conditions: Partial<T>): Promise<{ affected: number }>;

  /**
   * 计算实体数量
   * @param conditions 查询条件
   * @returns 实体数量
   */
  count(conditions?: Partial<T>): Promise<number>;

  /**
   * 分页查询实体
   * @param conditions 查询条件
   * @param pagination 分页参数
   * @returns 分页结果
   */
  findWithPagination(
    conditions: Partial<T>,
    pagination: { page: number; limit: number },
  ): Promise<PaginatedResponse<T>>;

  /**
   * 执行原生SQL查询
   * @param query SQL查询语句
   * @param parameters 查询参数
   * @returns 查询结果
   */
  query(query: string, parameters?: unknown[]): Promise<Record<string, unknown>[]>;

  /**
   * 执行原生SQL查询并返回单个结果
   * @param query SQL查询语句
   * @param parameters 查询参数
   * @returns 查询结果
   */
  queryOne(query: string, parameters?: unknown[]): Promise<Record<string, unknown> | undefined>;

  /**
   * 执行事务
   * @param fn 事务函数
   * @returns 事务结果
   */
  executeTransaction<T>(fn: (manager: unknown) => Promise<T>): Promise<T>;

  /**
   * 获取仓库统计信息
   * @returns 统计信息
   */
  getRepositoryStats(): Promise<{
    totalRecords: number;
    lastUpdated: Date;
    averageQueryTime: number;
    slowQueries: number;
  }>;

  /**
   * 优化仓库性能
   * @returns 优化结果
   */
  optimizeRepository(): Promise<{
    success: boolean;
    message: string;
    optimizations: string[];
  }>;

  /**
   * 验证实体数据
   * @param entity 要验证的实体
   * @returns 验证结果
   */
  validateEntity(entity: Partial<T>): {
    valid: boolean;
    errors: string[];
  };

  /**
   * 转换为领域对象
   * @param entity 数据库实体
   * @returns 领域对象
   */
  toDomainObject(entity: T): unknown;

  /**
   * 从领域对象转换
   * @param domainObject 领域对象
   * @returns 数据库实体
   */
  fromDomainObject(domainObject: unknown): Partial<T>;
}

/**
 * 仓库适配器工厂接口
 */
export interface IRepositoryAdapterFactory {
  /**
   * 创建仓库适配器
   * @param entityType 实体类型
   * @param dataSource 数据源
   * @param config 数据库配置
   * @param logger 日志记录器
   * @returns 仓库适配器实例
   */
  createAdapter<T extends ObjectLiteral>(
    entityType: EntityTarget<T>,
    dataSource: DataSource,
    config: DatabaseConfig,
    logger: LoggerLike,
  ): IRepositoryAdapter<T>;

  /**
   * 获取支持的数据库类型
   * @returns 支持的数据库类型数组
   */
  getSupportedDatabaseTypes(): DatabaseType[];

  /**
   * 验证适配器配置
   * @param config 数据库配置
   * @returns 验证结果
   */
  validateAdapterConfig(config: DatabaseConfig): {
    valid: boolean;
    errors: string[];
  };
}

/**
 * 适配器性能指标接口
 */
export interface AdapterPerformanceMetrics {
  /**
   * 数据库类型
   */
  databaseType: DatabaseType;

  /**
   * 实体类型
   */
  entityType: string;

  /**
   * 总查询数
   */
  totalQueries: number;

  /**
   * 平均查询时间
   */
  averageQueryTime: number;

  /**
   * 慢查询数量
   */
  slowQueryCount: number;

  /**
   * 缓存命中率
   */
  cacheHitRate?: number;

  /**
   * 连接池使用率
   */
  connectionPoolUsage?: number;

  /**
   * 内存使用量
   */
  memoryUsage?: number;

  /**
   * 最后更新时间
   */
  lastUpdated: Date;
}

/**
 * 适配器健康状态接口
 */
export interface AdapterHealthStatus {
  /**
   * 适配器状态
   */
  status: 'healthy' | 'degraded' | 'unhealthy';

  /**
   * 数据库连接状态
   */
  connectionStatus: DatabaseConnectionStatus;

  /**
   * 最后检查时间
   */
  lastCheckTime: Date;

  /**
   * 响应时间
   */
  responseTime?: number;

  /**
   * 错误信息
   */
  error?: string;

  /**
   * 性能指标
   */
  performanceMetrics?: AdapterPerformanceMetrics;

  /**
   * 连接池指标
   */
  poolMetrics?: {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    waitingClients: number;
  };
}

/**
 * 数据库连接状态枚举
 */
export enum DatabaseConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

/**
 * 适配器配置接口
 */
export interface AdapterConfig {
  /**
   * 是否启用查询缓存
   */
  enableQueryCache?: boolean;

  /**
   * 缓存过期时间（毫秒）
   */
  cacheExpiration?: number;

  /**
   * 是否启用性能监控
   */
  enablePerformanceMonitoring?: boolean;

  /**
   * 慢查询阈值（毫秒）
   */
  slowQueryThreshold?: number;

  /**
   * 是否启用连接池监控
   */
  enablePoolMonitoring?: boolean;

  /**
   * 批量操作大小
   */
  batchSize?: number;

  /**
   * 事务超时时间（毫秒）
   */
  transactionTimeout?: number;

  /**
   * 重试次数
   */
  retryAttempts?: number;

  /**
   * 重试延迟（毫秒）
   */
  retryDelay?: number;
}

/**
 * 适配器事件类型
 */
export enum AdapterEventType {
  QUERY_EXECUTED = 'query_executed',
  SLOW_QUERY = 'slow_query',
  CONNECTION_ERROR = 'connection_error',
  TRANSACTION_STARTED = 'transaction_started',
  TRANSACTION_COMPLETED = 'transaction_completed',
  CACHE_HIT = 'cache_hit',
  CACHE_MISS = 'cache_miss',
}

/**
 * 适配器事件接口
 */
export interface AdapterEvent {
  /**
   * 事件类型
   */
  type: AdapterEventType;

  /**
   * 事件时间
   */
  timestamp: Date;

  /**
   * 实体类型
   */
  entityType: string;

  /**
   * 数据库类型
   */
  databaseType: DatabaseType;

  /**
   * 事件数据
   */
  data: Record<string, unknown>;

  /**
   * 持续时间（毫秒）
   */
  duration?: number;

  /**
   * 错误信息
   */
  error?: string;
}

/**
 * 适配器事件监听器接口
 */
export interface IAdapterEventListener {
  /**
   * 处理适配器事件
   * @param event 适配器事件
   */
  onAdapterEvent(event: AdapterEvent): void;
}
