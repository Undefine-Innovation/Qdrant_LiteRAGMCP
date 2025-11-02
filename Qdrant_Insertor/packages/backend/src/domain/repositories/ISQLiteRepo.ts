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
import type { Database } from 'better-sqlite3';

// 导入表类型
import type { CollectionsTable } from '../../infrastructure/sqlite/dao/CollectionsTable.js';
import type { DocsTable } from '../../infrastructure/sqlite/dao/DocsTable.js';
import type { ChunkMetaTable } from '../../infrastructure/sqlite/dao/ChunkMetaTable.js';
import type { ChunksFts5Table } from '../../infrastructure/sqlite/dao/ChunksFts5Table.js';
import type { ChunksTable } from '../../infrastructure/sqlite/dao/ChunksTable.js';
import type { SyncJobsTable } from '../../infrastructure/sqlite/dao/SyncJobsTable.js';
import type { SystemMetricsTable } from '../../infrastructure/sqlite/dao/SystemMetricsTable.js';
import type { AlertRulesTable } from '../../infrastructure/sqlite/dao/AlertRulesTable.js';
import type { SystemHealthTable } from '../../infrastructure/sqlite/dao/SystemHealthTable.js';
import type { AlertHistoryTable } from '../../infrastructure/sqlite/dao/AlertHistoryTable.js';
import type { SQLiteRepoCore } from '../../infrastructure/repositories/SQLiteRepositoryCore.js';
import type { CollectionManager } from '../../infrastructure/repositories/CollectionManager.js';
import type { DocumentManager } from '../../infrastructure/repositories/DocumentManager.js';

/**
 * SQLite仓库接口
 * 定义SQLite数据库操作的核心方法
 */
export interface ISQLiteRepo {
  /**
   * 集合表访问器
   */
  readonly collections: CollectionsTable;
  
  /**
   * 文档表访问器
   */
  readonly docs: DocsTable;
  
  /**
   * 块元数据表访问器
   */
  readonly chunkMeta: ChunkMetaTable;
  
  /**
   * 块全文搜索表访问器
   */
  readonly chunksFts5: ChunksFts5Table;
  
  /**
   * 块表访问器
   */
  readonly chunks: ChunksTable;
  
  /**
   * 同步任务表访问器
   */
  readonly syncJobs: SyncJobsTable;

  /**
   * 系统指标表访问器
   */
  readonly systemMetrics: SystemMetricsTable;

  /**
   * 告警规则表访问器
   */
  readonly alertRules: AlertRulesTable;

  /**
   * 系统健康表访问器
   */
  readonly systemHealth: SystemHealthTable;

  /**
   * 告警历史表访问器
   */
  readonly alertHistory: AlertHistoryTable;

  /**
   * 数据库实例（用于兼容性）
   */
  readonly db: Database;

  /**
   * 核心仓库实例（用于兼容性）
   */
  readonly core: SQLiteRepoCore;

  /**
   * 集合管理器（用于兼容性）
   */
  readonly collectionManager: CollectionManager;

  /**
   * 文档管理器（用于兼容性）
   */
  readonly documentManager: DocumentManager;

  /**
   * 在数据库事务中执行一个函数
   * @param fn 包含数据库操作的函数
   * @returns 事务函数的返回值
   */
  transaction<T>(fn: () => T): T;

  /**
   * 删除一个集合及其所有关联的文档和块
   * 这是一个事务性操作
   * @param collectionId 要删除的集合 ID
   */
  deleteCollection(collectionId: CollectionId): void;

  /**
   * 删除一个文档及其所有关联的块
   * 这是一个在事务中执行的硬删除操作
   * @param docId - 要删除的文档 ID
   * @returns 如果找到并删除了文档，则返回 true，否则返回 false
   */
  deleteDoc(docId: DocId): boolean;

  /**
   * 检索块通过ID列表的详细信息
   * @param pointIds - 点ID数组
   * @param collectionId - 集合ID
   * @returns 搜索结果数组
   */
  getChunksByPointIds(
    pointIds: PointId[],
    collectionId: CollectionId,
  ): SearchResult[];

  /**
   * 获取文档的块列表
   * @param docId - 文档ID
   * @returns 文档块数组
   */
  getDocumentChunks(docId: DocId): Array<{
    pointId: PointId;
    docId: DocId;
    collectionId: CollectionId;
    chunkIndex: number;
    title?: string;
    content: string;
  }>;

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
  }>;

  /**
   * 获取文档
   * @param docId - 文档ID
   * @returns 文档对象
   */
  getDoc(docId: DocId): Promise<Doc | undefined>;

  /**
   * 获取文档的块元数据
   * @param docId - 文档ID
   * @returns 块元数据数组
   */
  getChunkMetasByDocId(docId: DocId): Promise<ChunkMeta[]>;

  /**
   * 获取块文本内容
   * @param pointIds - 点ID数组
   * @returns 块文本内容映射
   */
  getChunkTexts(pointIds: PointId[]): Promise<Record<string, { content: string }>>;

  /**
   * 添加块
   * @param docId - 文档ID
   * @param documentChunks - 文档块数组
   */
  addChunks(
    docId: DocId,
    documentChunks: DocumentChunk[],
  ): Promise<void>;

  /**
   * 标记文档为已同步
   * @param docId - 文档ID
   */
  markDocAsSynced(docId: DocId): Promise<void>;

  /**
   * 初始化数据库
   * @param dbPath - 数据库文件路径
   * @param logger - 日志记录器
   * @returns 初始化结果
   */
  initializeDatabase(dbPath: string, logger: Logger): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }>;

  /**
   * 关闭数据库连接
   */
  close(): void;

  /**
   * 检查数据库连接是否存活
   * @returns 如果连接响应正常则返回true，否则返回false
   */
  ping(): boolean;

  /**
   * 获取所有集合的ID
   * @returns 包含所有集合ID的数组
   */
  getAllCollectionIds(): Promise<CollectionId[]>;

  /**
   * 列出已删除的文档
   * @returns 已删除的文档数组
   */
  listDeletedDocs(): Doc[];

  /**
   * 硬删除文档
   * @param docId - 文档ID
   */
  hardDelete(docId: DocId): void;

  /**
   * 批量删除块元数据
   * @param pointIds - 要删除的点ID数组
   */
  deleteBatch(pointIds: PointId[]): void;
}