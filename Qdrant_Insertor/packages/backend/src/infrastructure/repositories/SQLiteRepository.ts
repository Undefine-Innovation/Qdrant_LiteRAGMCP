import Database from 'better-sqlite3';
import { Logger } from '@logging/logger.js';
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
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';
import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { SQLiteRepoCore } from './SQLiteRepositoryCore.js';
import { CollectionManager } from './CollectionManager.js';
import { DocumentManager } from './DocumentManager.js';
import { ChunkManager } from './ChunkManager.js';
import { TransactionManager } from '@infrastructure/transactions/TransactionManager.js';

// Import DAOs
import { CollectionsTable } from '@infrastructure/sqlite/dao/CollectionsTable.js';
import { DocsTable } from '@infrastructure/sqlite/dao/DocsTable.js';
import { ChunkMetaTable } from '@infrastructure/sqlite/dao/ChunkMetaTable.js';
import { ChunksFts5Table } from '@infrastructure/sqlite/dao/ChunksFts5Table.js';
import { ChunksTable } from '@infrastructure/sqlite/dao/ChunksTable.js';
import { SyncJobsTable } from '@infrastructure/sqlite/dao/SyncJobsTable.js';
import { SystemMetricsTable } from '@infrastructure/sqlite/dao/SystemMetricsTable.js';
import { AlertRulesTable } from '@infrastructure/sqlite/dao/AlertRulesTable.js';
import { SystemHealthTable } from '@infrastructure/sqlite/dao/SystemHealthTable.js';
import { AlertHistoryTable } from '@infrastructure/sqlite/dao/AlertHistoryTable.js';

/**
 * SQLiteRepo 作为数据访问对象 (DAO) 的协调器�?
 * 它管理数据库连接，提供对 DAO 的访问，
 * 并封装跨多个表的复杂事务操作�?
 */
export class SQLiteRepo implements ISQLiteRepo {
  public readonly collections: CollectionsTable;
  public readonly docs: DocsTable;
  public readonly chunkMeta: ChunkMetaTable;
  public readonly chunksFts5: ChunksFts5Table;
  public readonly chunks: ChunksTable;
  public readonly syncJobs: SyncJobsTable;
  public readonly systemMetrics: SystemMetricsTable;
  public readonly alertRules: AlertRulesTable;
  public readonly alertHistory: AlertHistoryTable;
  public readonly db: Database.Database;
  public readonly systemHealth: SystemHealthTable;

  public readonly core: SQLiteRepoCore;
  public readonly collectionManager: CollectionManager;
  public readonly documentManager: DocumentManager;
  private readonly chunkManager: ChunkManager;
  private readonly transactionManager: TransactionManager;

  /**
   * @param db `better-sqlite3` 数据库实例�?
   * @param logger
   */
  constructor(
    db: Database.Database,
    private readonly logger: Logger,
    private readonly qdrantRepo?: IQdrantRepo, // QdrantRepo将在实际使用时注入
  ) {
    this.db = db;
    this.core = new SQLiteRepoCore(db);
    this.collections = new CollectionsTable(db);
    this.docs = new DocsTable(db);
    this.chunkMeta = new ChunkMetaTable(db);
    this.chunksFts5 = new ChunksFts5Table(db);
    this.chunks = new ChunksTable(db);
    this.syncJobs = new SyncJobsTable(db);
    this.systemMetrics = new SystemMetricsTable(db);
    this.alertRules = new AlertRulesTable(db);
    this.systemHealth = new SystemHealthTable(db);
    this.alertHistory = new AlertHistoryTable(db);

    // 创建事务管理器
    this.transactionManager = new TransactionManager(
      this.core,
      this.qdrantRepo || {} as IQdrantRepo, // 提供默认空实现或抛出错误
      this.logger,
    );

    this.collectionManager = new CollectionManager(
      {
        getById: this.collections.getById,
        delete: this.collections.delete,
        chunkMeta: this.chunkMeta,
        chunksFts5: this.chunksFts5,
        docs: this.docs,
        listAll: this.collections.listAll,
      } as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- FIXME: 需要定义正确的接口类型来替代any
      this.core,
      this.logger,
      this.transactionManager,
    );
    this.documentManager = new DocumentManager(
      {
        ...this.docs,
        chunkMeta: this.chunkMeta,
        chunksFts5: this.chunksFts5,
      } as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- FIXME: 需要定义正确的接口类型来替代any
      this.core,
      this.logger,
    );
    this.chunkManager = new ChunkManager(
      this.chunkMeta,
      this.chunksFts5,
      this.chunks,
      this.core,
      this.logger,
    );
  }

  /**
   * 在数据库事务中执行一个函数�?
   * @param fn 包含数据库操作的函数�?
   * @returns 事务函数的返回值�?
   */
  transaction<T>(fn: () => T): T {
    return this.core.transaction(fn);
  }

  /**
   * 关闭数据库连接�?
   */
  public close() {
    this.core.close();
  }

  /**
   * 检查数据库连接是否存活�?
   * @returns 如果连接响应正常则返�?true，否则返�?false�?
   */
  ping(): boolean {
    return this.core.ping();
  }

  /**
   * 获取数据库实�?
   * @returns 数据库实�?
   */
  getDb(): Database.Database {
    return this.db;
  }

  /**
   * 删除一个集合及其所有关联的文档和块�?
   * 这是一个事务性操作�?
   * @param collectionId 要删除的集合 ID�?
   */
  deleteCollection(collectionId: CollectionId): void {
    this.collectionManager.deleteCollection(collectionId);
  }

  /**
   * 更新文档的内容和元数据�?
   * 如果内容发生变化，旧文档及其块将被删除，并创建一个新文档�?
   * @param docId - 要更新的文档 ID�?
   * @param content - 新的文档内容�?
   * @param name - 可选的文档名称�?
   * @param mime - 可选的 MIME 类型�?
   * @returns 更新后的 Doc 对象，如果未找到原始文档则返�?null�?
   */
  updateDoc(
    docId: DocId,
    content: string | Uint8Array,
    name?: string,
    mime?: string,
  ): Doc | null {
    return this.documentManager.updateDoc(docId, content, name, mime);
  }

  /**
   * 删除一个文档及其所有关联的块�?
   * 这是一个在事务中执行的硬删除操作�?
   * @param docId - 要删除的文档 ID�?
   * @returns 如果找到并删除了文档，则返回 true，否则返�?false�?
   */
  deleteDoc(docId: DocId): boolean {
    return this.documentManager.deleteDoc(docId);
  }

  /**
   * 检索块�?ID 列表的文本内容�?
   * @param pointIds - �?ID 数组�?
   * @returns 一个记录，将每�?pointId 映射到其内容和标题�?
   */
  getChunkTexts(
    pointIds: PointId[],
  ): Promise<Record<string, { content: string }>> {
    const result = this.chunkManager.getChunkTexts(pointIds);
    if (!result) return Promise.resolve({});
    
    // 转换格式以匹配接口
    const converted: Record<string, { content: string }> = {};
    for (const [pointId, value] of Object.entries(result)) {
      converted[pointId] = {
        content: value.content
      };
    }
    return Promise.resolve(converted);
  }

  /**
   * 检索块�?ID 列表的详细信息�?
   * @param pointIds - �?ID 数组�?
   * @param collectionId - 集合�?ID�?
   * @returns 搜索结果数组�?
   */
  getChunksByPointIds(
    pointIds: PointId[],
    collectionId: CollectionId,
  ): SearchResult[] {
    return this.chunkManager.getChunksByPointIds(pointIds, collectionId);
  }

  /**
   * 检查数据库连接是否存活�?
   * @param docId
   * @returns 如果连接响应正常则返�?true，否则返�?false�?
   */
  public async getDoc(docId: DocId): Promise<Doc | undefined> {
    return this.documentManager.getDoc(docId);
  }

  /**
   *
   * @param docId
   */
  public async getChunkMetasByDocId(docId: DocId): Promise<ChunkMeta[]> {
    return this.chunkManager.getChunkMetasByDocId(docId);
  }

  /**
   *
   * @param docId
   * @param documentChunks
   */
  public async addChunks(
    docId: DocId,
    documentChunks: DocumentChunk[],
  ): Promise<void> {
    return this.chunkManager.addChunks(docId, documentChunks);
  }

  /**
   *
   * @param docId
   */
  public async markDocAsSynced(docId: DocId): Promise<void> {
    return this.documentManager.markDocAsSynced(docId);
  }

  /**
   * 获取文档的块列表
   * @param docId - 文档ID
   * @returns 文档块数�?
   */
  public getDocumentChunks(docId: DocId): Array<{
    pointId: PointId;
    docId: DocId;
    collectionId: CollectionId;
    chunkIndex: number;
    title?: string;
    content: string;
  }> {
    return this.chunks.getByDocId(docId);
  }

  /**
   * 获取所有集合的 ID�?
   * @returns 包含所有集�?ID 的数组�?
   */
  public async getAllCollectionIds(): Promise<CollectionId[]> {
    return this.collectionManager.getAllCollectionIds();
  }

  /**
   * 初始化数据库
   * @param dbPath - 数据库文件路�?
   * @param logger - 日志记录�?
   * @returns 初始化结�?
   */
  async initializeDatabase(dbPath: string, logger: Logger): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    return this.core.initializeDatabase(dbPath, logger);
  }

  /**
   * 获取数据库状态信�?
   * @param dbPath - 数据库文件路�?
   * @param logger - 日志记录�?
   * @returns 数据库状态信�?
   */
  async getDatabaseStatus(dbPath: string, logger: Logger) {
    return this.core.getDatabaseStatus(dbPath, logger);
  }

  /**
   * 检查数据库初始化状�?
   * @param dbPath - 数据库文件路�?
   * @param logger - 日志记录�?
   * @returns 初始化状�?
   */
  async checkInitializationStatus(dbPath: string, logger: Logger) {
    return this.core.checkInitializationStatus(dbPath, logger);
  }

  /**
   * 列出已删除的文档
   * @returns 已删除的文档数组
   */
  listDeletedDocs(): Doc[] {
    return this.docs.listDeletedDocs();
  }

  /**
   * 硬删除文档
   * @param docId - 文档ID
   */
  hardDelete(docId: DocId): void {
    return this.docs.hardDelete(docId);
  }

  /**
   * 批量删除块元数据
   * @param pointIds - 要删除的点ID数组
   */
  deleteBatch(pointIds: PointId[]): void {
    this.chunkMeta.deleteBatch(pointIds);
    this.chunksFts5.deleteBatch(pointIds);
  }

  /**
   * 分页获取文档的块列表
   * @param docId - 文档ID
   * @param query - 分页查询参数
   * @returns 分页的文档块响应
   */
  getDocumentChunksPaginated(
    docId: DocId,
    query: PaginationQuery,
  ): PaginatedResponse<{
    pointId: PointId;
    docId: DocId;
    collectionId: CollectionId;
    chunkIndex: number;
    title?: string;
    content: string;
  }> {
    return this.chunks.listPaginatedByDocId(docId, query);
  }

  /**
   * 获取事务管理器
   * @returns 事务管理器实例
   */
  getTransactionManager(): TransactionManager {
    return this.transactionManager;
  }
}