import type { Database } from 'better-sqlite3';
import {
  INSERT_COLLECTION,
  SELECT_COLLECTION_BY_ID,
  SELECT_COLLECTION_BY_NAME,
  SELECT_ALL_COLLECTIONS,
  UPDATE_COLLECTION,
  DELETE_COLLECTION_BY_ID,
} from '../sql/collections.sql.js';
import type {
  Collection,
  CollectionId,
  PaginationQuery,
  PaginatedResponse,
} from '@domain/entities/types.js';
import { makeCollectionId } from '@domain/utils/id.js';
import {
  parsePaginationQuery,
  buildSqlPagination,
} from '../../../utils/pagination.js';

/**
 * collections 表的数据访问对象 (DAO)�?
 * 封装了所有集合的 SQL 交互�?
 */
export class CollectionsTable {
  private db: Database;

  /**
   * @param db - 数据库实例�?
   */
  constructor(db: Database) {
    this.db = db;
  }

  /**
   * 创建一个新的集合记录�?
   * @param data - 新集合的数据�?
   * @returns 新创建集合的 ID�?
   */
  create(data: Omit<Collection, 'collectionId' | 'created_at'>): CollectionId {
    const collectionId = makeCollectionId() as CollectionId;
    const createdAt = Date.now();
    const updatedAt = createdAt;
    const stmt = this.db.prepare(INSERT_COLLECTION);
    stmt.run(collectionId, data.name, data.description, createdAt, updatedAt);
    return collectionId;
  }

  /**
   * 根据 ID 检索集合�?
   * @param collectionId - 要检索的集合 ID�?
   * @returns 集合对象，如果未找到则返�?undefined�?
   */
  getById(collectionId: CollectionId): Collection | undefined {
    const stmt = this.db.prepare(SELECT_COLLECTION_BY_ID);
    const row = stmt.get(collectionId) as Collection | undefined;
    return row;
  }

  /**
   * 根据名称检索集合�?
   * @param name - 要检索的集合名称�?
   * @returns 集合对象，如果未找到则返�?undefined�?
   */
  getByName(name: string): Collection | undefined {
    const stmt = this.db.prepare(SELECT_COLLECTION_BY_NAME);
    const row = stmt.get(name) as Collection | undefined;
    return row;
  }

  /**
   * 从数据库中检索所有集合�?
   * @returns 所有集合的数组�?
   */
  listAll(): Collection[] {
    const stmt = this.db.prepare(SELECT_ALL_COLLECTIONS);
    return stmt.all() as Collection[];
  }

  /**
   * 获取集合总数
   * @returns 集合总数
   */
  getCount(): number {
    const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM collections`);
    const result = stmt.get() as { count: number };
    return result.count;
  }

  /**
   * 分页检索集�?
   * @param query - 分页查询参数
   * @returns 分页的集合响�?
   */
  listPaginated(query: PaginationQuery): PaginatedResponse<Collection> {
    const { page, limit, sort, order } = parsePaginationQuery(query);
    const offset = (page - 1) * limit;

    // 获取总数
    const total = this.getCount();

    // 构建排序和分页查�?
    const validSortFields = ['name', 'created_at', 'description'];
    const sortField = validSortFields.includes(sort) ? sort : 'created_at';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

    const sql = `
      SELECT
        c.*,
        (SELECT COUNT(*) FROM docs d WHERE d.collectionId = c.collectionId AND d.is_deleted = 0) as documentCount
      FROM collections c
        ORDER BY ${sortField} ${sortOrder}
        LIMIT ? OFFSET ?
    `;

    const stmt = this.db.prepare(sql);
    const collections = stmt.all(limit, offset) as Collection[];

    // 构建分页响应
    const totalPages = Math.ceil(total / limit);

    return {
      data: collections,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * 更新现有集合�?
   * @param collectionId - 要更新的集合 ID�?
   * @param data - 要更新的数据。只有提供的字段会被更新�?
   */
  update(
    collectionId: CollectionId,
    data: Partial<Omit<Collection, 'collectionId' | 'created_at'>>,
  ): void {
    const stmt = this.db.prepare(UPDATE_COLLECTION);
    stmt.run(data.name, data.description, collectionId);
  }

  /**
   * 根据 ID 删除集合�?
   * @param collectionId - 要删除的集合 ID�?
   */
  delete(collectionId: CollectionId): void {
    const stmt = this.db.prepare(DELETE_COLLECTION_BY_ID);
    stmt.run(collectionId);
  }

  /**
   * 检查数据库连接是否存活�?
   * @returns 如果连接响应正常则返�?true，否则返�?false�?
   */
  ping(): boolean {
    try {
      this.db.prepare(`SELECT 1`).get();
      return true;
    } catch (e) {
      console.error('Database ping failed:', e);
      return false;
    }
  }
}
