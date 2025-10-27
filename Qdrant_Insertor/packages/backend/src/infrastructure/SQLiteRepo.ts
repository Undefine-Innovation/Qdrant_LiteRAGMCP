import Database from 'better-sqlite3';
import { Logger } from '../logger.js';
import {
  Doc,
  SearchResult,
  CollectionId,
  DocId,
  PointId,
  DocumentChunk,
  ChunkMeta,
} from '../domain/types.js';
import { SQLiteRepoCore } from './SQLiteRepoCore.js';
import { CollectionManager } from './CollectionManager.js';
import { DocumentManager } from './DocumentManager.js';
import { ChunkManager } from './ChunkManager.js';

// Import DAOs
import { CollectionsTable } from './sqlite/dao/CollectionsTable.js';
import { DocsTable } from './sqlite/dao/DocsTable.js';
import { ChunkMetaTable } from './sqlite/dao/ChunkMetaTable.js';
import { ChunksFts5Table } from './sqlite/dao/ChunksFts5Table.js';
import { ChunksTable } from './sqlite/dao/ChunksTable.js';
import { SyncJobsTable } from './sqlite/dao/SyncJobsTable.js';
import { SystemMetricsTable } from './sqlite/dao/SystemMetricsTable.js';
import { AlertRulesTable } from './sqlite/dao/AlertRulesTable.js';
import { SystemHealthTable } from './sqlite/dao/SystemHealthTable.js';
import { AlertHistoryTable } from './sqlite/dao/AlertHistoryTable.js';

/**
 * SQLiteRepo 作为数据访问对象 (DAO) 的协调器。
 * 它管理数据库连接，提供对 DAO 的访问，
 * 并封装跨多个表的复杂事务操作。
 */
export class SQLiteRepo {
  public readonly collections: CollectionsTable;
  public readonly docs: DocsTable;
  public readonly chunkMeta: ChunkMetaTable;
  public readonly chunksFts5: ChunksFts5Table;
  public readonly chunks: ChunksTable;
  public readonly syncJobs: SyncJobsTable;
  public readonly systemMetrics: SystemMetricsTable;
  public readonly alertRules: AlertRulesTable;
  public readonly systemHealth: SystemHealthTable;
  public readonly alertHistory: AlertHistoryTable;
  public readonly db: Database.Database;

  private readonly core: SQLiteRepoCore;
  private readonly collectionManager: CollectionManager;
  private readonly documentManager: DocumentManager;
  private readonly chunkManager: ChunkManager;

  /**
   * @param db `better-sqlite3` 数据库实例。
   */
  constructor(
    db: Database.Database,
    private readonly logger: Logger,
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

    this.collectionManager = new CollectionManager(
      this.collections,
      this.core,
      this.logger,
    );
    this.documentManager = new DocumentManager(
      this.docs,
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
   * 在数据库事务中执行一个函数。
   * @param fn 包含数据库操作的函数。
   * @returns 事务函数的返回值。
   */
  transaction<T>(fn: () => T): T {
    return this.core.transaction(fn);
  }

  /**
   * 关闭数据库连接。
   */
  public close() {
    this.core.close();
  }

  /**
   * 检查数据库连接是否存活。
   * @returns 如果连接响应正常则返回 true，否则返回 false。
   */
  ping(): boolean {
    return this.core.ping();
  }

  /**
   * 删除一个集合及其所有关联的文档和块。
   * 这是一个事务性操作。
   * @param collectionId 要删除的集合 ID。
   */
  deleteCollection(collectionId: CollectionId): void {
    this.collectionManager.deleteCollection(collectionId);
  }

  /**
   * 更新文档的内容和元数据。
   * 如果内容发生变化，旧文档及其块将被删除，并创建一个新文档。
   * @param docId - 要更新的文档 ID。
   * @param content - 新的文档内容。
   * @param name - 可选的文档名称。
   * @param mime - 可选的 MIME 类型。
   * @returns 更新后的 Doc 对象，如果未找到原始文档则返回 null。
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
   * 删除一个文档及其所有关联的块。
   * 这是一个在事务中执行的硬删除操作。
   * @param docId - 要删除的文档 ID。
   * @returns 如果找到并删除了文档，则返回 true，否则返回 false。
   */
  deleteDoc(docId: DocId): boolean {
    return this.documentManager.deleteDoc(docId);
  }

  /**
   * 检索块点 ID 列表的文本内容。
   * @param pointIds - 块 ID 数组。
   * @returns 一个记录，将每个 pointId 映射到其内容和标题。
   */
  getChunkTexts(
    pointIds: PointId[],
  ): Record<string, { content: string; title?: string }> | null {
    return this.chunkManager.getChunkTexts(pointIds);
  }

  /**
   * 检索块点 ID 列表的详细信息。
   * @param pointIds - 块 ID 数组。
   * @param collectionId - 集合的 ID。
   * @returns 搜索结果数组。
   */
  getChunksByPointIds(
    pointIds: PointId[],
    collectionId: CollectionId,
  ): SearchResult[] {
    return this.chunkManager.getChunksByPointIds(pointIds, collectionId);
  }

  /**
   * 检查数据库连接是否存活。
   * @returns 如果连接响应正常则返回 true，否则返回 false。
   */
  public async getDoc(docId: DocId): Promise<Doc | undefined> {
    return this.documentManager.getDoc(docId);
  }

  public async getChunkMetasByDocId(docId: DocId): Promise<ChunkMeta[]> {
    return this.chunkManager.getChunkMetasByDocId(docId);
  }

  public async addChunks(
    docId: DocId,
    documentChunks: DocumentChunk[],
  ): Promise<void> {
    return this.chunkManager.addChunks(docId, documentChunks);
  }

  public async markDocAsSynced(docId: DocId): Promise<void> {
    return this.documentManager.markDocAsSynced(docId);
  }

  /**
   * 获取文档的块列表
   * @param docId - 文档ID
   * @returns 文档块数组
   */
  public getDocumentChunks(docId: DocId): any[] {
    return this.chunks.getByDocId(docId);
  }

  /**
   * 获取所有集合的 ID。
   * @returns 包含所有集合 ID 的数组。
   */
  public async getAllCollectionIds(): Promise<CollectionId[]> {
    return this.collectionManager.getAllCollectionIds();
  }

  /**
   * 初始化数据库
   * @param dbPath - 数据库文件路径
   * @param logger - 日志记录器
   * @returns 初始化结果
   */
  async initializeDatabase(dbPath: string, logger: Logger): Promise<any> {
    return this.core.initializeDatabase(dbPath, logger);
  }

  /**
   * 获取数据库状态信息
   * @param dbPath - 数据库文件路径
   * @param logger - 日志记录器
   * @returns 数据库状态信息
   */
  async getDatabaseStatus(dbPath: string, logger: Logger) {
    return this.core.getDatabaseStatus(dbPath, logger);
  }

  /**
   * 检查数据库初始化状态
   * @param dbPath - 数据库文件路径
   * @param logger - 日志记录器
   * @returns 初始化状态
   */
  async checkInitializationStatus(dbPath: string, logger: Logger) {
    return this.core.checkInitializationStatus(dbPath, logger);
  }
}
