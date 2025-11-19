import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
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
  DatabaseConnectionStatus,
  DatabaseMigration,
  DatabasePerformanceMetrics,
} from '@domain/interfaces/IDatabaseRepository.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';
import { IKeywordRetriever } from '@domain/repositories/IKeywordRetriever.js';
import { PostgreSQLKeywordRetriever } from './PostgreSQLKeywordRetriever.js';

// 导入拆分后的模块
import { PostgreSQLConnectionManager } from './PostgreSQLConnectionManager.js';
import { PostgreSQLDocumentOperations } from './PostgreSQLDocumentOperations.js';
import { PostgreSQLMaintenanceOperations } from './PostgreSQLMaintenanceOperations.js';
import { PostgreSQLRepositoryHelpers } from './PostgreSQLRepositoryHelpers.js';

/**
 * 简化的PostgreSQL数据库仓库实现
 * 合并了PostgreSQLRepository、PostgreSQLRepositoryComponents、PostgreSQLRepositoryComponents2等
 * 实现IDatabaseRepository接口，提供PostgreSQL特定的数据库操作
 */
export class SimplifiedPostgreSQLRepository implements IDatabaseRepository {
  readonly databaseType = DatabaseType.POSTGRESQL;
  readonly config: DatabaseConfig;

  private readonly connectionManager: PostgreSQLConnectionManager;
  private readonly documentOperations: PostgreSQLDocumentOperations;
  private readonly maintenanceOperations: PostgreSQLMaintenanceOperations;
  private readonly helpers: PostgreSQLRepositoryHelpers;

  /**
   * 创建SimplifiedPostgreSQLRepository实例
   * @param dataSource TypeORM数据源
   * @param config 数据库配置
   * @param logger 日志记录器
   * @param qdrantRepo 可选的Qdrant仓库
   */
  constructor(
    private readonly dataSource: DataSource,
    config: DatabaseConfig,
    private readonly logger: Logger,
    private readonly qdrantRepo?: IQdrantRepo,
  ) {
    this.config = config;

    // 初始化各个功能模块
    this.connectionManager = new PostgreSQLConnectionManager(
      dataSource,
      config,
      logger,
    );

    this.documentOperations = new PostgreSQLDocumentOperations(
      dataSource,
      logger,
    );

    this.maintenanceOperations = new PostgreSQLMaintenanceOperations(
      dataSource,
      config,
      logger,
    );

    this.helpers = new PostgreSQLRepositoryHelpers(dataSource, logger);
  }

  // === 基础连接管理 ===

  /**
   * 初始化数据库连接
   * @param logger 日志记录器
   * @returns 初始化结果
   */
  async initialize(logger: Logger): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    return this.connectionManager.initialize(logger);
  }

  /**
   * 关闭数据库连接
   * @returns 关闭结果
   */
  async close(): Promise<void> {
    return this.connectionManager.close();
  }

  /**
   * 检查数据库连接是否健康
   * @returns 健康状态
   */
  async ping(): Promise<boolean> {
    return this.connectionManager.ping();
  }

  /**
   * 获取数据库健康状态
   * @returns 健康状态详情
   */
  async getHealthStatus(): Promise<DatabaseHealthStatus> {
    return this.connectionManager.getHealthStatus();
  }

  /**
   * 获取数据库性能指标
   * @returns 性能指标
   */
  async getPerformanceMetrics(): Promise<DatabasePerformanceMetrics> {
    return this.connectionManager.getPerformanceMetrics();
  }

  /**
   * 在数据库事务中执行一个函数
   * @param fn 包含数据库操作的函数
   * @returns 事务函数的返回值
   */
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return this.connectionManager.transaction(fn);
  }

  // === 文档和集合操作 ===

  /**
   * 删除一个集合及其所有关联的文档和块
   * @param collectionId 要删除的集合ID
   * @returns Promise<void>
   */
  async deleteCollection(collectionId: CollectionId): Promise<void> {
    return this.documentOperations.deleteCollection(collectionId);
  }

  /**
   * 删除一个文档及其所有关联的块
   * @param docId 要删除的文档ID
   * @returns 如果找到并删除了文档，则返回true，否则返回false
   */
  async deleteDoc(docId: DocId): Promise<boolean> {
    return this.documentOperations.deleteDoc(docId);
  }

  /**
   * 检索块通过ID列表的详细信息
   * @param pointIds 点ID数组
   * @param collectionId 集合ID
   * @returns 搜索结果数组
   */
  async getChunksByPointIds(
    pointIds: PointId[],
    collectionId: CollectionId,
  ): Promise<SearchResult[]> {
    return this.documentOperations.getChunksByPointIds(pointIds, collectionId);
  }

  /**
   * 获取文档的块列表
   * @param docId 文档ID
   * @returns 文档块数组
   */
  async getDocumentChunks(docId: DocId): Promise<
    Array<{
      pointId: PointId;
      docId: DocId;
      collectionId: CollectionId;
      chunkIndex: number;
      title?: string;
      content: string;
    }>
  > {
    return this.documentOperations.getDocumentChunks(docId);
  }

  /**
   * 分页获取文档的块列表
   * @param docId 文档ID
   * @param query 分页查询参数
   * @returns 分页的文档块响应
   */
  async getDocumentChunksPaginated(
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
  > {
    return this.documentOperations.getDocumentChunksPaginated(docId, query);
  }

  /**
   * 获取文档
   * @param docId 文档ID
   * @returns 文档对象
   */
  async getDoc(docId: DocId): Promise<DomainDoc | undefined> {
    return this.documentOperations.getDoc(docId);
  }

  /**
   * 获取文档的块元数据
   * @param docId 文档ID
   * @returns 块元数据数组
   */
  async getChunkMetasByDocId(docId: DocId): Promise<ChunkMetaType[]> {
    return this.documentOperations.getChunkMetasByDocId(docId);
  }

  /**
   * 获取集合的块元数据
   * @param collectionId 集合ID
   * @returns 块元数据数组
   */
  async getChunkMetasByCollectionId(
    collectionId: CollectionId,
  ): Promise<ChunkMetaType[]> {
    return this.documentOperations.getChunkMetasByCollectionId(collectionId);
  }

  /**
   * 检索块通过ID列表的文本内容
   * @param pointIds 点ID数组
   * @returns 块文本内容映射
   */
  async getChunkTexts(
    pointIds: PointId[],
  ): Promise<Record<string, { content: string }>> {
    return this.documentOperations.getChunkTexts(pointIds);
  }

  /**
   * 添加文档块
   * @param docId 文档ID
   * @param documentChunks 文档块数组
   * @returns Promise<void>
   */
  async addChunks(
    docId: DocId,
    documentChunks: DocumentChunk[],
  ): Promise<void> {
    return this.documentOperations.addChunks(docId, documentChunks);
  }

  /**
   * 标记文档为已同步
   * @param docId 文档ID
   * @returns Promise<void>
   */
  async markDocAsSynced(docId: DocId): Promise<void> {
    return this.documentOperations.markDocAsSynced(docId);
  }

  /**
   * 获取所有集合的ID
   * @returns 包含所有集合ID的数组
   */
  async getAllCollectionIds(): Promise<CollectionId[]> {
    return this.documentOperations.getAllCollectionIds();
  }

  /**
   * 列出已删除的文档
   * @returns 已删除的文档数组
   */
  async listDeletedDocs(): Promise<DomainDoc[]> {
    return this.documentOperations.listDeletedDocs();
  }

  /**
   * 硬删除文档
   * @param docId 文档ID
   * @returns Promise<void>
   */
  async hardDelete(docId: DocId): Promise<void> {
    return this.documentOperations.hardDelete(docId);
  }

  /**
   * 批量删除块元数据
   * @param pointIds 要删除的点ID数组
   * @returns Promise<void>
   */
  async deleteBatch(pointIds: PointId[]): Promise<void> {
    return this.documentOperations.deleteBatch(pointIds);
  }

  // === 迁移和维护操作 ===

  /**
   * 执行数据库迁移
   * @param migrations 迁移数组
   * @returns 迁移结果
   */
  async runMigrations(migrations: DatabaseMigration[]): Promise<{
    success: boolean;
    applied: string[];
    failed: string[];
    error?: string;
  }> {
    return this.maintenanceOperations.runMigrations(migrations);
  }

  /**
   * 获取待执行的迁移列表
   * @param migrations 所有可用迁移
   * @returns 待执行的迁移
   */
  async getPendingMigrations(
    migrations: DatabaseMigration[],
  ): Promise<DatabaseMigration[]> {
    return this.maintenanceOperations.getPendingMigrations(migrations);
  }

  /**
   * 获取已应用的迁移列表
   * @returns 已应用的迁移
   */
  async getAppliedMigrations(): Promise<DatabaseMigration[]> {
    return this.maintenanceOperations.getAppliedMigrations();
  }

  /**
   * 创建数据库备份
   * @param backupPath 备份文件路径
   * @returns 备份结果
   */
  async createBackup(backupPath: string): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    return this.maintenanceOperations.createBackup(backupPath);
  }

  /**
   * 从备份恢复数据库
   * @param backupPath 备份文件路径
   * @returns 恢复结果
   */
  async restoreFromBackup(backupPath: string): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    return this.maintenanceOperations.restoreFromBackup(backupPath);
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
    return this.maintenanceOperations.optimize();
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
    return this.maintenanceOperations.getStatistics();
  }

  /**
   * 获取关键词检索器
   * @returns 关键词检索器实例
   */
  getKeywordRetriever(): IKeywordRetriever {
    return this.helpers.getKeywordRetriever();
  }
}
