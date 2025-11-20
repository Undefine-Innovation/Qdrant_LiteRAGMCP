import { IRepository } from './IRepository.js';
import { CollectionId, DocId, PointId } from '../entities/types.js';
import { IQdrantRepo } from './IQdrantRepo.js';
import { Logger } from '@logging/logger.js';

// Helper types to avoid using `any` in public interfaces
export type EntityConstructor<T> = new (...args: unknown[]) => T;

// Allow either a constructor or a plain factory function that returns T
export type EntityFactory<T> = EntityConstructor<T> | ((...args: unknown[]) => T);

/**
 * 数据库配置接口
 */
export interface DatabaseConfig {
  /** 数据库类型 */
  type: 'postgresql' | 'sqlite' | 'typeorm';
  /** 连接字符串 */
  connectionString: string;
  /** 连接池配置 */
  pool?: {
    min?: number;
    max?: number;
    idleTimeoutMillis?: number;
  };
  /** 其他配置选项 */
  [key: string]: unknown;
}

/**
 * 数据库仓库接口
 * 扩展基础仓库接口，添加数据库特定的操作
 */
export interface IDatabaseRepository<T, ID> extends IRepository<T, ID> {
  /**
   * 删除集合及其所有关联数据
   * @param collectionId 集合ID
   */
  deleteCollection(collectionId: CollectionId): Promise<void>;

  /**
   * 删除文档及其所有关联数据
   * @param docId 文档ID
   * @returns 是否成功删除
   */
  deleteDoc(docId: DocId): Promise<boolean>;

  /**
   * 执行原生SQL查询
   * @param query SQL查询语句
   * @param params 查询参数
   * @returns 查询结果
   */
  executeQuery(query: string, params?: unknown[]): Promise<Array<Record<string, unknown>>>;

  /**
   * 开始事务
   * @returns 事务上下文
   */
  beginTransaction(): Promise<ITransactionContext>;

  /**
   * 提交事务
   * @param context 事务上下文
   */
  commitTransaction(context: ITransactionContext): Promise<void>;

  /**
   * 回滚事务
   * @param context 事务上下文
   */
  rollbackTransaction(context: ITransactionContext): Promise<void>;

  /**
   * 在事务中执行操作
   * @param operation 事务操作函数
   * @returns 操作结果
   */
  executeInTransaction<T>(
    operation: (context: ITransactionContext) => Promise<T>,
  ): Promise<T>;

  /**
   * 获取数据库连接状态
   * @returns 连接状态信息
   */
  getConnectionStatus(): Promise<{
    connected: boolean;
    lastChecked: Date;
    responseTime?: number;
  }>;

  /**
   * 执行数据库健康检查
   * @returns 健康检查结果
   */
  healthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    metrics: Record<string, number>;
  }>;

  /**
   * 获取数据库统计信息
   * @returns 统计信息
   */
  getDatabaseStatistics(): Promise<{
    totalConnections: number;
    activeConnections: number;
    totalQueries: number;
    averageQueryTime: number;
    [key: string]: number;
  }>;

  /**
   * 优化数据库表
   * @param tableName 表名（可选，不提供则优化所有表）
   * @returns 优化结果
   */
  optimizeTables(tableName?: string): Promise<{
    optimized: string[];
    errors: string[];
  }>;

  /**
   * 备份数据
   * @param backupPath 备份路径
   * @param options 备份选项
   * @returns 备份结果
   */
  backupData(
    backupPath: string,
    options?: {
      includeTables?: string[];
      excludeTables?: string[];
      compress?: boolean;
    },
  ): Promise<{
    success: boolean;
    backupPath: string;
    size: number;
    duration: number;
  }>;

  /**
   * 恢复数据
   * @param backupPath 备份路径
   * @param options 恢复选项
   * @returns 恢复结果
   */
  restoreData(
    backupPath: string,
    options?: {
      dropExisting?: boolean;
      includeTables?: string[];
      excludeTables?: string[];
    },
  ): Promise<{
    success: boolean;
    restoredTables: string[];
    errors: string[];
    duration: number;
  }>;

  /**
   * 迁移数据到新版本
   * @param targetVersion 目标版本
   * @returns 迁移结果
   */
  migrateData(targetVersion: string): Promise<{
    success: boolean;
    migrations: Array<{
      version: string;
      description: string;
      duration: number;
    }>;
    errors: string[];
  }>;

  /**
   * 获取Qdrant仓库实例
   * @returns Qdrant仓库实例
   */
  getQdrantRepository(): IQdrantRepo | undefined;

  /**
   * 设置Qdrant仓库实例
   * @param qdrantRepo Qdrant仓库实例
   */
  setQdrantRepository(qdrantRepo: IQdrantRepo): void;

  /**
   * 同步数据到Qdrant
   * @param options 同步选项
   * @returns 同步结果
   */
  syncToQdrant(options?: {
    collectionId?: CollectionId;
    docId?: DocId;
    force?: boolean;
  }): Promise<{
    success: boolean;
    syncedCollections: number;
    syncedDocuments: number;
    syncedChunks: number;
    errors: string[];
  }>;

  /**
   * 从Qdrant同步数据
   * @param options 同步选项
   * @returns 同步结果
   */
  syncFromQdrant(options?: {
    collectionId?: CollectionId;
    docId?: DocId;
    force?: boolean;
  }): Promise<{
    success: boolean;
    syncedCollections: number;
    syncedDocuments: number;
    syncedChunks: number;
    errors: string[];
  }>;
}

/**
 * 事务上下文接口
 */
export interface ITransactionContext {
  /** 事务ID */
  readonly transactionId: string;
  /** 是否活跃 */
  isActive: boolean;
  /** 开始时间 */
  readonly startTime: number;
  /** 隔离级别 */
  readonly isolationLevel?:
    | 'READ_UNCOMMITTED'
    | 'READ_COMMITTED'
    | 'REPEATABLE_READ'
    | 'SERIALIZABLE';

  /**
   * 提交事务
   */
  commit(): Promise<void>;

  /**
   * 回滚事务
   */
  rollback(): Promise<void>;

  /**
   * 创建保存点
   * @param savepointName 保存点名称
   */
  createSavepoint(savepointName: string): Promise<void>;

  /**
   * 回滚到保存点
   * @param savepointName 保存点名称
   */
  rollbackToSavepoint(savepointName: string): Promise<void>;

  /**
   * 释放保存点
   * @param savepointName 保存点名称
   */
  releaseSavepoint(savepointName: string): Promise<void>;
}

/**
 * 数据库仓库工厂接口
 */
export interface IDatabaseRepositoryFactory {
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
  ): IDatabaseRepository<T, ID>;

  /**
   * 创建PostgreSQL仓库
   * @param entityClass 实体类
   * @param config 数据库配置
   * @param logger 日志记录器
   * @param qdrantRepo Qdrant仓库（可选）
   * @returns PostgreSQL仓库实例
   */
  createPostgreSQLRepository<T, ID>(
    entityClass: EntityFactory<T>,
    config: DatabaseConfig,
    logger: Logger,
    qdrantRepo?: IQdrantRepo,
  ): IDatabaseRepository<T, ID>;

  /**
   * 创建SQLite仓库
   * @param entityClass 实体类
   * @param config 数据库配置
   * @param logger 日志记录器
   * @param qdrantRepo Qdrant仓库（可选）
   * @returns SQLite仓库实例
   */
  createSQLiteRepository<T, ID>(
    entityClass: EntityFactory<T>,
    config: DatabaseConfig,
    logger: Logger,
    qdrantRepo?: IQdrantRepo,
  ): IDatabaseRepository<T, ID>;

  /**
   * 创建TypeORM仓库
   * @param entityClass 实体类
   * @param config 数据库配置
   * @param logger 日志记录器
   * @param qdrantRepo Qdrant仓库（可选）
   * @returns TypeORM仓库实例
   */
  createTypeORMRepository<T, ID>(
    entityClass: EntityFactory<T>,
    config: DatabaseConfig,
    logger: Logger,
    qdrantRepo?: IQdrantRepo,
  ): IDatabaseRepository<T, ID>;
}
