import type { Database } from 'better-sqlite3';
import type {
  PointId,
  DocId,
  CollectionId,
  PaginationQuery,
  PaginatedResponse,
} from '@domain/entities/types.js';
import {
  INSERT_CHUNKS_BATCH,
  SELECT_CHUNKS_BY_POINT_IDS,
  DELETE_CHUNKS_BY_POINT_IDS,
  SELECT_CHUNKS_BY_DOC_ID,
} from '../sql/chunks.sql.js';
import { parsePaginationQuery } from '../../../utils/pagination.js';

/**
 * chunks 表的数据访问对象 (DAO)
 * 封装了所有块内容的 SQL 交互
 */
export class ChunksTable {
  private db: Database;

  /**
   * @param db - 数据库实例
   */
  constructor(db: Database) {
    this.db = db;
  }

  /**
   * 批量插入块内容
   * @param data - 要插入的块内容数组
   */
  createBatch(
    data: Array<{
      pointId: PointId;
      docId: DocId;
      collectionId: CollectionId;
      chunkIndex: number;
      title?: string;
      content: string;
    }>,
  ): void {
    console.log(
      `[ChunksTable.createBatch] 开始批量插入chunks，数量: ${data.length}`,
    );

    if (data.length > 0) {
      console.log(`[ChunksTable.createBatch] 第一条数据示例:`, {
        pointId: data[0].pointId,
        pointIdType: typeof data[0].pointId,
        docId: data[0].docId,
        docIdType: typeof data[0].docId,
        collectionId: data[0].collectionId,
        collectionIdType: typeof data[0].collectionId,
        chunkIndex: data[0].chunkIndex,
        chunkIndexType: typeof data[0].chunkIndex,
        title: data[0].title,
        titleType: typeof data[0].title,
        content: data[0].content,
        contentType: typeof data[0].content,
      });
    }

    const insert = this.db.prepare(INSERT_CHUNKS_BATCH);

    const insertMany = this.db.transaction(
      (
        items: Array<{
          pointId: PointId;
          docId: DocId;
          collectionId: CollectionId;
          chunkIndex: number;
          title?: string;
          content: string;
        }>,
      ) => {
        for (const item of items) {
          // 处理 title 字段：将 undefined/null 转换为空字符串
          const titleForDb =
            item.title === undefined || item.title === null ? '' : item.title;

          // 确保 chunkIndex 是整数
          const chunkIndexInt = Math.floor(item.chunkIndex);

          try {
            // 暂时禁用所有触发器以避免 FTS5 相关的 datatype mismatch
            this.db.exec('PRAGMA recursive_triggers = OFF');
            this.db.exec('PRAGMA foreign_keys = OFF');

            // 使用原始 SQL 执行插入，避免 better-sqlite3 的参数绑定问题
            const rawSql = `INSERT INTO chunks (content, title, pointId, docId, collectionId, chunkIndex) VALUES ('${item.content.replace(/'/g, "''")}', '${titleForDb.replace(/'/g, "''")}', '${item.pointId.replace(/'/g, "''")}', '${item.docId.replace(/'/g, "''")}', '${item.collectionId.replace(/'/g, "''")}', ${chunkIndexInt})`;

            this.db.exec(rawSql);
          } catch (insertError) {
            console.error(`[ChunksTable.createBatch] 插入数据失败:`, {
              error: (insertError as Error).message,
              stack: (insertError as Error).stack,
              pointId: item.pointId,
              pointIdType: typeof item.pointId,
              docId: item.docId,
              docIdType: typeof item.docId,
              collectionId: item.collectionId,
              collectionIdType: typeof item.collectionId,
              chunkIndex: item.chunkIndex,
              chunkIndexType: typeof item.chunkIndex,
              title: item.title,
              titleType: typeof item.title,
              content: item.content,
              contentType: typeof item.content,
            });
            throw insertError;
          }
        }
      },
    );

    try {
      insertMany(data);
      console.log(`[ChunksTable.createBatch] 批量插入chunks完成`);

      // 重新启用触发器
      this.db.exec('PRAGMA recursive_triggers = ON');
      this.db.exec('PRAGMA foreign_keys = ON');
    } catch (error) {
      console.error(`[ChunksTable.createBatch] 批量插入chunks失败:`, {
        error: (error as Error).message,
        stack: (error as Error).stack,
        dataCount: data.length,
      });
      throw error;
    }
  }

  /**
   * 根据pointIds 查询块内容
   * @param pointIds - 点ID数组
   * @returns 块内容数组
   */
  getByPointIds(pointIds: PointId[]): Array<{
    pointId: PointId;
    docId: DocId;
    collectionId: CollectionId;
    chunkIndex: number;
    title?: string;
    content: string;
  }> {
    if (pointIds.length === 0) {
      return [];
    }
    const placeholders = pointIds.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      SELECT_CHUNKS_BY_POINT_IDS.replace(
        '(?)',
        (${placeholders}),
      )
    `);
    return stmt.all(...pointIds) as Array<{
      pointId: PointId;
      docId: DocId;
      collectionId: CollectionId;
      chunkIndex: number;
      title?: string;
      content: string;
    }>;
  }

  /**
   * 根据文档ID查询块内容
   * @param docId - 文档ID
   * @returns 块内容数组
   */
  getByDocId(docId: DocId): Array<{
    pointId: PointId;
    docId: DocId;
    collectionId: CollectionId;
    chunkIndex: number;
    title?: string;
    content: string;
  }> {
    const stmt = this.db.prepare(SELECT_CHUNKS_BY_DOC_ID);
    return stmt.all(docId) as Array<{
      pointId: PointId;
      docId: DocId;
      collectionId: CollectionId;
      chunkIndex: number;
      title?: string;
      content: string;
    }>;
  }

  /**
   * 根据集合ID查询块内容
   * @param collectionId - 集合ID
   * @returns 块内容数组
   */
  getByCollectionId(collectionId: CollectionId): Array<{
    pointId: PointId;
    docId: DocId;
    collectionId: CollectionId;
    chunkIndex: number;
    title?: string;
    content: string;
  }> {
    const stmt = this.db.prepare(SELECT_CHUNKS_BY_DOC_ID);
    return stmt.all(collectionId) as Array<{
      pointId: PointId;
      docId: DocId;
      collectionId: CollectionId;
      chunkIndex: number;
      title?: string;
      content: string;
    }>;
  }

  /**
   * 根据pointIds 批量删除块内容
   * @param pointIds - 要删除的pointId数组
   */
  deleteBatch(pointIds: PointId[]): void {
    if (pointIds.length === 0) {
      return;
    }
    const placeholders = pointIds.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      DELETE_CHUNKS_BY_POINT_IDS.replace(
        '(?)',
        (${placeholders}),
      )
    `);
    stmt.run(...pointIds);
  }

  /**
   * 获取文档的块总数
   * @param docId - 文档ID
   * @returns 块总数
   */
  getCountByDocId(docId: DocId): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM chunks WHERE docId = ?
    `);
    const result = stmt.get(docId) as { count: number };
    return result.count;
  }

  /**
   * 分页获取文档的块列表
   * @param docId - 文档ID
   * @param query - 分页查询参数
   * @returns 分页的块响应
   */
  listPaginatedByDocId(
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
    const { page, limit, sort, order } = parsePaginationQuery(query);

    // 获取总数
    const total = this.getCountByDocId(docId);

    // 构建排序和分页查询
    const validSortFields = ['chunkIndex', 'title', 'created_at'];
    const sortField = validSortFields.includes(sort) ? sort : 'chunkIndex';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
    const offset = (page - 1) * limit;

    const sql = `
      SELECT * FROM chunks
      WHERE docId = ?
      ORDER BY ${sortField} ${sortOrder}
      LIMIT ? OFFSET ?
    `;

    const stmt = this.db.prepare(sql);
    const chunks = stmt.all(docId, limit, offset) as Array<{
      pointId: PointId;
      docId: DocId;
      collectionId: CollectionId;
      chunkIndex: number;
      title?: string;
      content: string;
    }>;

    const totalPages = Math.ceil(total / limit);

    return {
      data: chunks,
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
}
