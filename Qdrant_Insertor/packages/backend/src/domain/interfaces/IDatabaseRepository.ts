import {
  Doc,
  SearchResult,
  CollectionId,
  DocId,
  PointId,
  DocumentChunk,
  ChunkMeta,
  PaginationQuery,
  PaginatedResponse,
} from '@domain/entities/types.js';
import { Logger } from '@logging/logger.js';

/**
 * 数据库类型枚举
 */
export enum DatabaseType {
  SQLITE = 'sqlite',
  POSTGRESQL = 'postgres',
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
 * 数据库配置接口
 */
export interface DatabaseConfig {
  type: DatabaseType;
  // SQLite配置
  path?: string;
  // PostgreSQL配置
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  ssl?: boolean;
  // 连接池配置
  maxConnections?: number;
  minConnections?: number;
  connectionTimeout?: number;
  idleTimeout?: number;
  maxLifetime?: number;
}

/**
 * 数据库健康状态接口
 */
export interface DatabaseHealthStatus {
  status: DatabaseConnectionStatus;
  lastCheckTime?: number;
  lastCheck?: Date;
  connected?: boolean;
  responseTime?: number;
  error?: string;
  // 连接池指标（仅PostgreSQL）
  connectionPool?: {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    waitingClients?: number;
    idleInTransaction?: number;
  };
  // 性能指标
  performanceMetrics?: {
    averageQueryTime: number;
    slowQueryCount: number;
    totalQueries: number;
  };
}

/**
 * 数据库迁移接口
 */
export interface DatabaseMigration {
  id: string;
  name: string;
  version: string;
  description: string;
  up: string; // SQL语句
  down: string; // 回滚SQL语句
  appliedAt?: Date;
}

/**
 * 数据库性能指标接口
 */
export interface DatabasePerformanceMetrics {
  databaseType: DatabaseType;
  connectionTime: number;
  queryTime: number;
  transactionTime: number;
  memoryUsage?: number;
  diskUsage?: number;
  indexUsage?: number;
  cacheHitRate?: number;
  averageQueryTime?: number;
  activeConnections?: number;
  totalConnections?: number;
  idleConnections?: number;
  queryCount?: number;
}

/**
 * 通用数据库仓库接口
 * 定义了所有数据库操作的标准接口，支持SQLite和PostgreSQL
 */
export interface IDatabaseRepository {
  /**
   * 数据库类型
   */
  readonly databaseType: DatabaseType;

  /**
   * 数据库配置
   */
  readonly config: DatabaseConfig;

  /**
   * 初始化数据库连接
   * @param logger 日志记录器
   * @returns 初始化结果
   */
  initialize(logger: Logger): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }>;

  /**
   * 关闭数据库连接
   * @returns 关闭结果
   */
  close(): Promise<void>;

  /**
   * 检查数据库连接是否健康
   * @returns 健康状态
   */
  ping(): Promise<boolean>;

  /**
   * 获取数据库健康状态
   * @returns 健康状态详情
   */
  getHealthStatus(): Promise<DatabaseHealthStatus>;

  /**
   * 获取数据库性能指标
   * @returns 性能指标
   */
  getPerformanceMetrics(): Promise<DatabasePerformanceMetrics>;

  /**
   * 在数据库事务中执行一个函数
   * @param fn 包含数据库操作的函数
   * @returns 事务函数的返回值
   */
  transaction<T>(fn: () => Promise<T>): Promise<T>;

  /**
   * 删除一个集合及其所有关联的文档和块
   * @param collectionId 要删除的集合 ID
   */
  deleteCollection(collectionId: CollectionId): Promise<void>;

  /**
   * 删除一个文档及其所有关联的块
   * @param docId 要删除的文档 ID
   * @returns 如果找到并删除了文档，则返回 true，否则返回 false
   */
  deleteDoc(docId: DocId): Promise<boolean>;

  /**
   * 检索块通过ID列表的详细信息
   * @param pointIds 点ID数组
   * @param collectionId 集合ID
   * @returns 搜索结果数组
   */
  getChunksByPointIds(
    pointIds: PointId[],
    collectionId: CollectionId,
  ): Promise<SearchResult[]>;

  /**
   * 获取文档的块列表
   * @param docId 文档ID
   * @returns 文档块数组
   */
  getDocumentChunks(docId: DocId): Promise<
    Array<{
      pointId: PointId;
      docId: DocId;
      collectionId: CollectionId;
      chunkIndex: number;
      title?: string;
      content: string;
    }>
  >;

  /**
   * 分页获取文档的块列表
   * @param docId 文档ID
   * @param query 分页查询参数
   * @returns 分页的文档块响应
   */
  getDocumentChunksPaginated(
    docId: DocId,
    query: PaginationQuery,
  ): Promise<
    PaginatedResponse<{
      pointId: PointId;
      docId: DocId;
      collectionId: CollectionId;
      chunkIndex: number;
      title?: string;
      content: string;
    }>
  >;

  /**
   * 获取文档
   * @param docId 文档ID
   * @returns 文档对象
   */
  getDoc(docId: DocId): Promise<Doc | undefined>;

  /**
   * 获取文档的块元数据
   * @param docId 文档ID
   * @returns 块元数据数组
   */
  getChunkMetasByDocId(docId: DocId): Promise<ChunkMeta[]>;

  /**
   * 获取块文本内容
   * @param pointIds 点ID数组
   * @returns 块文本内容映射
   */
  getChunkTexts(
    pointIds: PointId[],
  ): Promise<Record<string, { content: string }>>;

  /**
   * 添加块
   * @param docId 文档ID
   * @param documentChunks 文档块数组
   */
  addChunks(docId: DocId, documentChunks: DocumentChunk[]): Promise<void>;

  /**
   * 标记文档为已同步
   * @param docId 文档ID
   */
  markDocAsSynced(docId: DocId): Promise<void>;

  /**
   * 获取所有集合的ID
   * @returns 包含所有集合ID的数组
   */
  getAllCollectionIds(): Promise<CollectionId[]>;

  /**
   * 列出已删除的文档
   * @returns 已删除的文档数组
   */
  listDeletedDocs(): Promise<Doc[]>;

  /**
   * 硬删除文档
   * @param docId 文档ID
   */
  hardDelete(docId: DocId): Promise<void>;

  /**
   * 批量删除块元数据
   * @param pointIds 要删除的点ID数组
   */
  deleteBatch(pointIds: PointId[]): Promise<void>;

  /**
   * 获取集合的块元数据
   * @param collectionId 集合ID
   * @returns 块元数据数组
   */
  getChunkMetasByCollectionId(collectionId: CollectionId): Promise<ChunkMeta[]>;

  /**
   * 执行数据库迁移
   * @param migrations 迁移数组
   * @returns 迁移结果
   */
  runMigrations(migrations: DatabaseMigration[]): Promise<{
    success: boolean;
    applied: string[];
    failed: string[];
    error?: string;
  }>;

  /**
   * 获取待执行的迁移列表
   * @param migrations 所有可用迁移
   * @returns 待执行的迁移
   */
  getPendingMigrations(
    migrations: DatabaseMigration[],
  ): Promise<DatabaseMigration[]>;

  /**
   * 获取已应用的迁移列表
   * @returns 已应用的迁移
   */
  getAppliedMigrations(): Promise<DatabaseMigration[]>;

  /**
   * 创建数据库备份
   * @param backupPath 备份文件路径
   * @returns 备份结果
   */
  createBackup(backupPath: string): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }>;

  /**
   * 从备份恢复数据库
   * @param backupPath 备份文件路径
   * @returns 恢复结果
   */
  restoreFromBackup(backupPath: string): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }>;

  /**
   * 优化数据库性能
   * @returns 优化结果
   */
  optimize(): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }>;

  /**
   * 获取数据库统计信息
   * @returns 统计信息
   */
  getStatistics(): Promise<{
    totalCollections: number;
    totalDocuments: number;
    totalChunks: number;
    databaseSize: number;
    indexSize: number;
  }>;
}

/**
 * 数据库仓库工厂接口
 */
export interface IDatabaseRepositoryFactory {
  /**
   * 创建数据库仓库实例
   * @param config 数据库配置
   * @param logger 日志记录器
   * @returns 数据库仓库实例
   */
  createRepository(
    config: DatabaseConfig,
    logger: Logger,
  ): Promise<IDatabaseRepository>;

  /**
   * 获取支持的数据库类型
   * @returns 支持的数据库类型数组
   */
  getSupportedDatabaseTypes(): DatabaseType[];

  /**
   * 验证数据库配置
   * @param config 数据库配置
   * @returns 验证结果
   */
  validateConfig(config: DatabaseConfig): {
    valid: boolean;
    errors: string[];
  };
}
