/**
 * PostgreSQL仓库操作模块
 * 包含本地CRUD操作方法
 */

import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import {
  CollectionRepository,
  DocRepository,
  ChunkRepository,
  ChunkMetaRepository,
} from './index.js';
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

// 导入拆分后的模块
import { PostgreSQLCollectionOperations } from './PostgreSQLCollectionOperations.js';
import { PostgreSQLDocumentOperations } from './PostgreSQLDocumentOperations.js';
import { PostgreSQLChunkOperations } from './PostgreSQLChunkOperations.js';
import { PostgreSQLBatchOperations } from './PostgreSQLBatchOperations.js';
import { PostgreSQLChunkMetaOperations } from './PostgreSQLChunkMetaOperations.js';
import { PostgreSQLPaginationOperations } from './PostgreSQLPaginationOperations.js';
import { PostgreSQLSearchOperations } from './PostgreSQLSearchOperations.js';
import { PostgreSQLAdvancedOperations } from './PostgreSQLAdvancedOperations.js';
import { PostgreSQLDocumentManagementOperations } from './PostgreSQLDocumentManagementOperations.js';

/**
 * PostgreSQL仓库操作模块
 * 包含本地CRUD操作方法
 */
export class PostgreSQLRepositoryOperations {
  private readonly collectionOperations: PostgreSQLCollectionOperations;
  private readonly documentOperations: PostgreSQLDocumentOperations;
  private readonly chunkOperations: PostgreSQLChunkOperations;
  private readonly batchOperations: PostgreSQLBatchOperations;
  private readonly chunkMetaOperations: PostgreSQLChunkMetaOperations;
  private readonly paginationOperations: PostgreSQLPaginationOperations;
  private readonly searchOperations: PostgreSQLSearchOperations;
  private readonly advancedOperations: PostgreSQLAdvancedOperations;
  private readonly documentManagementOperations: PostgreSQLDocumentManagementOperations;

  /**
   * 创建PostgreSQLRepositoryOperations实例
   * @param dataSource TypeORM数据源
   * @param logger 日志记录器
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: Logger,
  ) {
    this.collectionOperations = new PostgreSQLCollectionOperations(
      dataSource,
      logger,
    );
    this.documentOperations = new PostgreSQLDocumentOperations(
      dataSource,
      logger,
    );
    this.chunkOperations = new PostgreSQLChunkOperations(dataSource, logger);
    this.batchOperations = new PostgreSQLBatchOperations(dataSource, logger);
    this.chunkMetaOperations = new PostgreSQLChunkMetaOperations(
      dataSource,
      logger,
    );
    this.paginationOperations = new PostgreSQLPaginationOperations(
      dataSource,
      logger,
    );
    this.searchOperations = new PostgreSQLSearchOperations(dataSource, logger);
    this.advancedOperations = new PostgreSQLAdvancedOperations(
      dataSource,
      logger,
    );
    this.documentManagementOperations =
      new PostgreSQLDocumentManagementOperations(dataSource, logger);
  }

  // === 集合操作 ===

  /**
   * 创建集合
   * @param name 集合名称
   * @param description 集合描述
   * @returns 创建的集合ID
   */
  async createCollection(
    name: string,
    description?: string,
  ): Promise<CollectionId> {
    return this.collectionOperations.createCollection(name, description);
  }

  /**
   * 获取集合
   * @param id 集合ID
   * @returns 集合对象或null
   */
  async getCollection(id: CollectionId): Promise<Record<string, unknown> | null> {
    return this.collectionOperations.getCollection(id) as Promise<Record<string, unknown> | null>;
  }

  /**
   * 获取所有集合
   * @returns 集合数组
   */
  async getAllCollections(): Promise<Array<Record<string, unknown>>> {
    return this.collectionOperations.getAllCollections() as Promise<Array<Record<string, unknown>>>;
  }

  /**
   * 更新集合
   * @param id 集合ID
   * @param updates 更新数据
   * @returns 更新结果
   */
  async updateCollection(
    id: CollectionId,
    updates: Partial<Record<string, unknown>>,
  ): Promise<Record<string, unknown>> {
    return this.collectionOperations.updateCollection(
      id,
      updates as Partial<Record<string, unknown>>,
    ) as Promise<Record<string, unknown>>;
  }

  /**
   * 删除集合
   * @param id 集合ID
   * @returns 删除结果
   */
  async deleteCollection(id: CollectionId): Promise<boolean> {
    return this.collectionOperations.deleteCollection(id);
  }

  // === 文档操作 ===

  /**
   * 创建文档
   * @param collectionId 集合ID
   * @param key 文档键
   * @param name 文档名称
   * @param content 文档内容
   * @param sizeBytes 文档大小（字节）
   * @param mime MIME类型
   * @returns 创建的文档ID
   */
  async createDoc(
    collectionId: CollectionId,
    key: string,
    name: string,
    content: string,
    sizeBytes: number,
    mime?: string,
  ): Promise<DocId> {
    return this.documentOperations.createDoc(
      collectionId,
      key,
      name,
      content,
      sizeBytes,
      mime,
    );
  }

  /**
   * 获取文档
   * @param id 文档ID
   * @returns 文档对象或null
   */
  async getDoc(id: DocId): Promise<Record<string, unknown> | null> {
    return this.documentOperations.getDoc(id) as Promise<Record<string, unknown> | null>;
  }

  /**
   * 根据集合ID和键获取文档
   * @param collectionId 集合ID
   * @param key 文档键
   * @returns 文档对象或null
   */
  async getDocByCollectionAndKey(
    collectionId: CollectionId,
    key: string,
  ): Promise<Record<string, unknown> | null> {
    return this.documentOperations.getDocByCollectionAndKey(
      collectionId,
      key,
    ) as Promise<Record<string, unknown> | null>;
  }

  /**
   * 根据集合ID获取文档列表
   * @param collectionId 集合ID
   * @returns 文档数组
   */
  async getDocsByCollectionId(collectionId: CollectionId): Promise<Array<Record<string, unknown>>> {
    return this.documentOperations.getDocsByCollectionId(collectionId) as Promise<Array<Record<string, unknown>>>;
  }

  /**
   * 更新文档
   * @param id 文档ID
   * @param updates 更新数据
   * @returns 更新结果
   */
  async updateDoc(id: DocId, updates: Partial<Record<string, unknown>>): Promise<Record<string, unknown>> {
    return this.documentOperations.updateDoc(id, updates as Partial<Record<string, unknown>>) as Promise<Record<string, unknown>>;
  }

  /**
   * 删除文档
   * @param id 文档ID
   * @returns 删除结果
   */
  async deleteDoc(id: DocId): Promise<boolean> {
    return this.documentOperations.deleteDoc(id);
  }

  // === 块操作 ===

  /**
   * 创建文档块
   * @param docId 文档ID
   * @param chunkIndex 块索引
   * @param title 块标题
   * @param content 块内容
   * @param pointId 点ID
   * @param collectionId 集合ID
   * @returns 创建的块ID
   */
  async createChunk(
    docId: DocId,
    chunkIndex: number,
    pointId: PointId,
    collectionId: CollectionId,
    title?: string,
    content?: string,
  ): Promise<string> {
    return this.chunkOperations.createChunk(
      docId,
      chunkIndex,
      pointId,
      collectionId,
      title,
      content,
    );
  }

  /**
   * 获取文档块
   * @param id 块ID
   * @returns 块对象或null
   */
  async getChunk(id: string): Promise<Record<string, unknown> | null> {
    return this.chunkOperations.getChunk(id) as Promise<Record<string, unknown> | null>;
  }

  /**
   * 根据文档ID获取块列表
   * @param docId 文档ID
   * @returns 块数组
   */
  async getChunksByDocId(docId: DocId): Promise<Array<Record<string, unknown>>> {
    return this.chunkOperations.getChunksByDocId(docId) as Promise<Array<Record<string, unknown>>>;
  }

  /**
   * 更新文档块
   * @param id 块ID
   * @param updates 更新数据
   * @returns 更新结果
   */
  async updateChunk(id: string, updates: Partial<Record<string, unknown>>): Promise<Record<string, unknown>> {
    return this.chunkOperations.updateChunk(id, updates as Partial<Record<string, unknown>>) as Promise<Record<string, unknown>>;
  }

  /**
   * 删除文档块
   * @param id 块ID
   * @returns 删除结果
   */
  async deleteChunk(id: string): Promise<boolean> {
    return this.chunkOperations.deleteChunk(id);
  }

  // === 批量操作 ===

  /**
   * 批量创建文档块
   * @param chunks 块数组
   * @returns 创建结果
   */
  async createBatchChunks(
    chunks: Array<{
      docId: DocId;
      chunkIndex: number;
      title?: string;
      content: string;
      pointId: PointId;
      collectionId: CollectionId;
    }>,
  ): Promise<string[]> {
    return this.batchOperations.createBatchChunks(chunks);
  }

  // === 块元数据操作 ===

  /**
   * 创建块元数据
   * @param chunkId 块ID
   * @param tokenCount 令数量
   * @param embeddingStatus 嵌入状态
   * @param syncedAt 同步时间
   * @param error 错误信息
   * @returns 创建结果
   */
  async createChunkMeta(
    chunkId: string,
    tokenCount: number,
    embeddingStatus: 'pending' | 'processing' | 'completed' | 'failed',
    syncedAt?: number,
    error?: string,
  ): Promise<string> {
    return this.chunkMetaOperations.createChunkMeta(
      chunkId,
      tokenCount,
      embeddingStatus,
      syncedAt,
      error,
    );
  }

  /**
   * 获取块元数据
   * @param id 块元数据ID
   * @returns 块元数据对象或null
   */
  async getChunkMeta(id: string): Promise<Record<string, unknown> | null> {
    return this.chunkMetaOperations.getChunkMeta(id) as Promise<Record<string, unknown> | null>;
  }

  /**
   * 更新块元数据
   * @param id 块元数据ID
   * @param updates 更新数据
   * @returns 更新结果
   */
  async updateChunkMeta(id: string, updates: Partial<Record<string, unknown>>): Promise<Record<string, unknown>> {
    return this.chunkMetaOperations.updateChunkMeta(id, updates as Partial<Record<string, unknown>>) as Promise<Record<string, unknown>>;
  }

  /**
   * 根据文档ID获取块元数据
   * @param docId 文档ID
   * @returns 块元数据数组
   */
  async getChunkMetasByDocId(docId: DocId): Promise<Array<Record<string, unknown>>> {
    return this.chunkMetaOperations.getChunkMetasByDocId(docId) as Promise<Array<Record<string, unknown>>>;
  }

  /**
   * 根据集合ID获取块元数据
   * @param collectionId 集合ID
   * @returns 块元数据数组
   */
  async getChunkMetasByCollectionId(
    collectionId: CollectionId,
  ): Promise<Array<Record<string, unknown>>> {
    return this.chunkMetaOperations.getChunkMetasByCollectionId(collectionId) as Promise<Array<Record<string, unknown>>>;
  }

  // === 分页查询 ===

  /**
   * 分页获取文档
   * @param collectionId 集合ID
   * @param query 分页查询参数
   * @returns 分页结果
   */
  async getDocsPaginated(
    collectionId: CollectionId,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    return this.paginationOperations.getDocsPaginated(collectionId, query) as Promise<PaginatedResponse<Record<string, unknown>>>;
  }

  /**
   * 分页获取文档块
   * @param docId 文档ID
   * @param query 分页查询参数
   * @returns 分页结果
   */
  async getChunksPaginated(
    docId: DocId,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    return this.paginationOperations.getChunksPaginated(docId, query) as Promise<PaginatedResponse<Record<string, unknown>>>;
  }

  // === 搜索功能 ===

  /**
   * 搜索文档
   * @param query 搜索查询参数
   * @param query.keyword 搜索关键词
   * @param query.collectionId 集合ID
   * @param query.limit 结果限制数量
   * @returns 搜索结果
   */
  async searchDocs(query: {
    keyword?: string;
    collectionId?: CollectionId;
    limit?: number;
  }): Promise<Array<Record<string, unknown>>> {
    return this.searchOperations.searchDocs(query) as Promise<Array<Record<string, unknown>>>;
  }

  /**
   * 搜索文档块
   * @param query 搜索查询参数
   * @param query.keyword 搜索关键词
   * @param query.docId 文档ID
   * @param query.limit 结果限制数量
   * @returns 搜索结果
   */
  async searchChunks(query: {
    keyword?: string;
    docId?: DocId;
    limit?: number;
  }): Promise<Array<Record<string, unknown>>> {
    return this.searchOperations.searchChunks(query) as Promise<Array<Record<string, unknown>>>;
  }

  // === 高级查询 ===

  /**
   * 根据点ID获取块列表
   * @param pointIds 点ID数组
   * @param collectionId 集合ID
   * @returns 搜索结果数组
   */
  async getChunksByPointIds(
    pointIds: PointId[],
    collectionId: CollectionId,
  ): Promise<SearchResult[]> {
    return this.advancedOperations.getChunksByPointIds(pointIds, collectionId);
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
    return this.advancedOperations.getDocumentChunks(docId);
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
    return this.advancedOperations.getDocumentChunksPaginated(docId, query);
  }

  /**
   * 检索块通过ID列表的文本内容
   * @param pointIds 点ID数组
   * @returns 块文本内容映射
   */
  async getChunkTexts(
    pointIds: PointId[],
  ): Promise<Record<string, { content: string }>> {
    return this.advancedOperations.getChunkTexts(pointIds);
  }

  // === 文档管理 ===

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
    return this.documentManagementOperations.addChunks(docId, documentChunks);
  }

  /**
   * 标记文档为已同步
   * @param docId 文档ID
   * @returns Promise<void>
   */
  async markDocAsSynced(docId: DocId): Promise<void> {
    return this.documentManagementOperations.markDocAsSynced(docId);
  }

  /**
   * 获取所有集合的ID
   * @returns 包含所有集合ID的数组
   */
  async getAllCollectionIds(): Promise<CollectionId[]> {
    return this.documentManagementOperations.getAllCollectionIds();
  }

  /**
   * 列出已删除的文档
   * @returns 已删除的文档数组
   */
  async listDeletedDocs(): Promise<DomainDoc[]> {
    return this.documentManagementOperations.listDeletedDocs();
  }

  /**
   * 硬删除文档
   * @param docId 文档ID
   * @returns Promise<void>
   */
  async hardDelete(docId: DocId): Promise<void> {
    return this.documentManagementOperations.hardDelete(docId);
  }

  /**
   * 批量删除块元数据
   * @param pointIds 要删除的点ID数组
   * @returns Promise<void>
   */
  async deleteBatch(pointIds: PointId[]): Promise<void> {
    return this.documentManagementOperations.deleteBatch(pointIds);
  }
}
