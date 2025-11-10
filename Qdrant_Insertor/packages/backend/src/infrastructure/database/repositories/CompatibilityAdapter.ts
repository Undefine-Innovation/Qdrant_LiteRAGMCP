import { CollectionRepository } from './CollectionRepository.js';
import { DocRepository } from './DocRepository.js';
import { ChunkRepository } from './ChunkRepository.js';
import {
  CollectionId,
  DocId,
  PointId,
  PaginationQuery,
  PaginatedResponse,
} from '@domain/entities/types.js';

/**
 * 集合表接口
 */
interface CollectionsTable {
  db: unknown;
  getById(id: CollectionId): Promise<unknown>;
  getByName(name: string): Promise<unknown>;
  listAll(): Promise<unknown[]>;
  create(collection: unknown): Promise<unknown>;
  update(id: CollectionId, data: unknown): Promise<unknown>;
  delete(id: CollectionId): Promise<boolean>;
  getCount(): Promise<number>;
  listPaginated(query: PaginationQuery): Promise<PaginatedResponse<unknown>>;
  ping(): Promise<boolean>;
}

/**
 * 文档表接口
 */
interface DocsTable {
  db: unknown;
  getById(id: DocId): Promise<unknown>;
  listByCollection(collectionId: CollectionId): Promise<unknown[]>;
  listAll(): Promise<unknown[]>;
  create(doc: unknown): Promise<unknown>;
  update(id: DocId, data: unknown): Promise<unknown>;
  delete(id: DocId): Promise<boolean>;
  getCount(): Promise<number>;
  listPaginated(query: PaginationQuery): Promise<PaginatedResponse<unknown>>;
  hardDelete(id: DocId): Promise<boolean>;
  findDeleted(): Promise<unknown[]>;
}

/**
 * 块表接口
 */
interface ChunksTable {
  db: unknown;
  getByPointIds(pointIds: PointId[]): Promise<unknown[]>;
  getByDocId(docId: DocId): Promise<unknown[]>;
  getByCollectionId(collectionId: CollectionId): Promise<unknown[]>;
  create(chunk: unknown): Promise<unknown>;
  createBatch(chunks: unknown[]): Promise<unknown[]>;
  deleteByPointIds(pointIds: PointId[]): Promise<number>;
  deleteByDocId(docId: DocId): Promise<number>;
  deleteByCollectionId(collectionId: CollectionId): Promise<number>;
  count(docId?: DocId, collectionId?: CollectionId): Promise<number>;
  deleteBatch(pointIds: PointId[]): Promise<number>;
  getCountByDocId(docId: DocId): Promise<number>;
  listPaginatedByDocId(
    docId: DocId,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<unknown>>;
}

/**
 * CollectionRepository适配器
 * 将TypeORM的CollectionRepository适配为CollectionsTable接口
 */
/**
 * CollectionRepository适配器
 * 将TypeORM的CollectionRepository适配为CollectionsTable接口
 */
export class CollectionRepositoryAdapter implements CollectionsTable {
  /**
   * 创建CollectionRepositoryAdapter实例
   * @param repository TypeORM CollectionRepository实例
   * @param dataSource 数据源
   */
  constructor(
    private readonly repository: CollectionRepository,
    private readonly dataSource: unknown,
  ) {}

  /**
   * 获取数据源
   * @returns 数据源实例
   */
  get db(): unknown {
    return this.dataSource;
  }

  /**
   * 根据ID获取集合
   * @param id 集合ID
   * @returns 集合对象
   */
  async getById(id: CollectionId): Promise<unknown> {
    return await this.repository.findById(id as unknown as string);
  }

  /**
   * 根据名称获取集合
   * @param name 集合名称
   * @returns 集合对象
   */
  async getByName(name: string): Promise<unknown> {
    return await this.repository.findByName(name);
  }

  /**
   * 获取所有集合
   * @returns 集合数组
   */
  async listAll(): Promise<unknown[]> {
    return await this.repository.findAll();
  }

  /**
   * 创建集合
   * @param collection 集合数据
   * @returns 创建后的集合
   */
  async create(collection: unknown): Promise<unknown> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await this.repository.create(collection as any);
  }

  /**
   * 更新集合
   * @param id 集合ID
   * @param data 更新数据
   * @returns 更新后的集合
   */
  async update(id: CollectionId, data: unknown): Promise<unknown> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await this.repository.update(id as unknown as string, data as any);
  }

  /**
   * 删除集合
   * @param id 集合ID
   * @returns 是否删除成功
   */
  async delete(id: CollectionId): Promise<boolean> {
    return await this.repository.delete(id as unknown as string);
  }

  /**
   * 获取集合总数
   * @returns 集合总数
   */
  async getCount(): Promise<number> {
    return await this.repository.count();
  }

  /**
   * 分页获取集合
   * @param query 分页查询参数
   * @returns 分页结果
   */
  async listPaginated(
    query: PaginationQuery,
  ): Promise<PaginatedResponse<unknown>> {
    const collections = await this.repository.findAll();
    const { page = 1, limit = 10 } = query;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedCollections = collections.slice(startIndex, endIndex);

    const totalPages = Math.ceil(collections.length / limit);

    return {
      data: paginatedCollections,
      pagination: {
        page,
        limit,
        total: collections.length,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * 检查连接状态
   * @returns 连接状态
   */
  async ping(): Promise<boolean> {
    // 简单的ping实现
    return true;
  }
}

/**
 * DocRepository适配器
 * 将TypeORM的DocRepository适配为DocsTable接口
 */
/**
 * DocRepository适配器
 * 将TypeORM的DocRepository适配为DocsTable接口
 */
export class DocRepositoryAdapter implements DocsTable {
  /**
   * 创建DocRepositoryAdapter实例
   * @param repository TypeORM DocRepository实例
   * @param dataSource 数据源
   */
  constructor(
    private readonly repository: DocRepository,
    private readonly dataSource: unknown,
  ) {}

  /**
   * 获取数据源
   * @returns 数据源实例
   */
  get db(): unknown {
    return this.dataSource;
  }

  /**
   * 根据ID获取文档
   * @param id 文档ID
   * @returns 文档对象
   */
  async getById(id: DocId): Promise<unknown> {
    return await this.repository.findById(id as unknown as string);
  }

  /**
   * 根据集合ID获取文档
   * @param collectionId 集合ID
   * @returns 文档数组
   */
  async listByCollection(collectionId: CollectionId): Promise<unknown[]> {
    return await this.repository.findByCollectionId(collectionId);
  }

  /**
   * 获取所有文档
   * @returns 文档数组
   */
  async listAll(): Promise<unknown[]> {
    return await this.repository.findAll();
  }

  /**
   * 创建文档
   * @param doc 文档数据
   * @returns 创建的文档
   */
  async create(doc: unknown): Promise<unknown> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await this.repository.create(doc as any);
  }

  /**
   * 更新文档
   * @param id 文档ID
   * @param data 更新数据
   * @returns 更新后的文档
   */
  async update(id: DocId, data: unknown): Promise<unknown> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await this.repository.update(id as unknown as string, data as any);
  }

  /**
   * 删除文档
   * @param id 文档ID
   * @returns 是否删除成功
   */
  async delete(id: DocId): Promise<boolean> {
    return await this.repository.delete(id as unknown as string);
  }

  /**
   * 获取已删除的文档
   * @returns 已删除的文档数组
   */
  async findDeleted(): Promise<unknown[]> {
    return await this.repository.findDeleted();
  }

  /**
   * 获取文档总数
   * @returns 文档总数
   */
  async getCount(): Promise<number> {
    return await this.repository.count();
  }

  /**
   * 分页获取文档
   * @param query 分页查询参数
   * @returns 分页结果
   */
  async listPaginated(
    query: PaginationQuery,
  ): Promise<PaginatedResponse<unknown>> {
    const docs = await this.repository.findAll();
    const { page = 1, limit = 10 } = query;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedDocs = docs.slice(startIndex, endIndex);

    const totalPages = Math.ceil(docs.length / limit);

    return {
      data: paginatedDocs,
      pagination: {
        page,
        limit,
        total: docs.length,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * 硬删除文档
   * @param id 文档ID
   * @returns 是否删除成功
   */
  async hardDelete(id: DocId): Promise<boolean> {
    return await this.repository.delete(id as unknown as string);
  }

  /**
   * 列出已删除的文档（同步方法，不推荐使用）
   * @returns 已删除的文档数组
   * @throws Error 提示使用异步方法
   */
  listDeletedDocs(): unknown[] {
    // 同步方法 - 返回空数组，实际应该使用 findDeleted 异步方法
    throw new Error(
      'listDeletedDocs is async in TypeORM. Use findDeleted() instead.',
    );
  }
}

/**
 * ChunkRepository适配器
 * 将TypeORM的ChunkRepository适配为ChunksTable接口
 */
/**
 * ChunkRepository适配器
 * 将TypeORM的ChunkRepository适配为ChunksTable接口
 */
export class ChunkRepositoryAdapter implements ChunksTable {
  /**
   * 创建ChunkRepositoryAdapter实例
   * @param repository TypeORM ChunkRepository实例
   * @param dataSource 数据源
   */
  constructor(
    private readonly repository: ChunkRepository,
    private readonly dataSource: unknown,
  ) {}

  /**
   * 获取数据源
   * @returns 数据源实例
   */
  get db(): unknown {
    return this.dataSource;
  }

  /**
   * 根据点ID数组获取块
   * @param pointIds 点ID数组
   * @returns 块数组
   */
  async getByPointIds(pointIds: PointId[]): Promise<unknown[]> {
    return await this.repository.findByPointIds(pointIds);
  }

  /**
   * 根据文档ID获取块
   * @param docId 文档ID
   * @returns 块数组
   */
  async getByDocId(docId: DocId): Promise<unknown[]> {
    return await this.repository.findByDocId(docId);
  }

  /**
   * 根据集合ID获取块
   * @param collectionId 集合ID
   * @returns 块数组
   */
  async getByCollectionId(collectionId: CollectionId): Promise<unknown[]> {
    return await this.repository.findByCollectionId(collectionId);
  }

  /**
   * 创建块
   * @param chunk 块数据
   * @returns 创建的块
   */
  async create(chunk: unknown): Promise<unknown> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await this.repository.create(chunk as any);
  }

  /**
   * 批量创建块
   * @param chunks 块数组
   * @returns 创建的块数组
   */
  async createBatch(chunks: unknown[]): Promise<unknown[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await this.repository.createBatch(chunks as any[]);
  }

  /**
   * 根据点ID数组删除块
   * @param pointIds 点ID数组
   * @returns 删除的块数量
   */
  async deleteByPointIds(pointIds: PointId[]): Promise<number> {
    return await this.repository.deleteByPointIds(pointIds);
  }

  /**
   * 根据文档ID删除块
   * @param docId 文档ID
   * @returns 删除的块数量
   */
  async deleteByDocId(docId: DocId): Promise<number> {
    return await this.repository.deleteByDocId(docId);
  }

  /**
   * 根据集合ID删除块
   * @param collectionId 集合ID
   * @returns 删除的块数量
   */
  async deleteByCollectionId(collectionId: CollectionId): Promise<number> {
    return await this.repository.deleteByCollectionId(collectionId);
  }

  /**
   * 统计块数量
   * @param docId 可选的文档ID
   * @param collectionId 可选的集合ID
   * @returns 块总数
   */
  async count(docId?: DocId, collectionId?: CollectionId): Promise<number> {
    return await this.repository.getCount(docId, collectionId);
  }

  /**
   * 批量删除块
   * @param pointIds 点ID数组
   * @returns 删除的块数量
   */
  async deleteBatch(pointIds: PointId[]): Promise<number> {
    return await this.deleteByPointIds(pointIds);
  }

  /**
   * 根据文档ID统计块数量
   * @param docId 文档ID
   * @returns 块数量
   */
  async getCountByDocId(docId: DocId): Promise<number> {
    return await this.repository.getCount(docId);
  }

  /**
   * 分页获取文档的块
   * @param docId 文档ID
   * @param query 分页查询参数
   * @returns 分页结果
   */
  async listPaginatedByDocId(
    docId: DocId,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<unknown>> {
    const chunks = await this.getByDocId(docId);
    const { page = 1, limit = 10 } = query;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedChunks = chunks.slice(startIndex, endIndex);

    const totalPages = Math.ceil(chunks.length / limit);

    return {
      data: paginatedChunks,
      pagination: {
        page,
        limit,
        total: chunks.length,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }
}
