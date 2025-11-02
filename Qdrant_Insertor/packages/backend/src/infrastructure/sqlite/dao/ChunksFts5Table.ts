import type { Database } from 'better-sqlite3';
import type {
  PointId,
  DocId,
  CollectionId,
  SearchResult,
} from '@domain/entities/types.js';
import {
  SEARCH_CHUNKS_FTS5_BY_COLLECTION,
  DELETE_CHUNKS_FTS5_BY_DOC_ID,
  DELETE_CHUNKS_FTS5_BY_COLLECTION_ID,
  DELETE_CHUNKS_FTS5_BATCH,
} from '../sql/chunks_fts5.sql.js';

/**
 * FTS 搜索结果的类型定义
 * 注意：在 share/type.ts 中，SearchResult 是一个更通用的类型，
 * FTS 的原始结果可能包含额外的字段，如 rank
 * 为保持一致性，我们将其映射到SearchResult
 */
export type FtsResult = SearchResult;

/**
 * chunks_fts5 虚拟表的数据访问对象 (DAO)
 * 封装了所有块全文搜索SQL交互
 */
export class ChunksFts5Table {
  private db: Database;

  /**
   * @param db - 数据库实例
   */
  constructor(db: Database) {
    this.db = db;
  }

  /**
   * 在特定集合中执行全文搜索
   *
   * @param query - FTS 查询字符串
   * @param collectionId - 要搜索的集合 ID
   * @param limit - 返回结果的最大数量
   * @returns 搜索结果数组
   */
  search(
    query: string,
    collectionId: CollectionId,
    limit: number,
  ): FtsResult[] {
    const stmt = this.db.prepare(SEARCH_CHUNKS_FTS5_BY_COLLECTION);
    // FTS 查询处理其自身在 MATCH 字符串中的参数化
    // 因此我们无需担心查询文本本身SQL 注入
    const results = stmt.all(query, collectionId, limit) as {
      pointId: PointId;
      docId: DocId;
      collectionId: CollectionId;
      chunkIndex: number;
      title: string;
      content: string;
      doc_name: string;
    }[];

    return results.map((row) => ({
      pointId: row.pointId,
      docId: row.docId,
      collectionId: row.collectionId,
      chunkIndex: row.chunkIndex,
      titleChain: row.title,
      content: row.content,
      title: row.doc_name, // 将doc_name映射到title以兼容SearchResult
      // 注意：score (rank) 在SQL中隐式用于排序，但此处不返回
      // 如果需要，可以通过选择"rank"列来添加
    }));
  }

  /**
   * 删除与特定文档关联的所有FTS 索引条目
   *
   * @param docId - 要删除其 FTS 记录的文档ID
   */
  deleteByDocId(docId: DocId): void {
    const stmt = this.db.prepare(DELETE_CHUNKS_FTS5_BY_DOC_ID);
    stmt.run(docId);
  }

  /**
   * 删除与特定集合关联的所有FTS 索引条目
   *
   * @param collectionId - 要删除其 FTS 记录的集合ID
   */
  deleteByCollectionId(collectionId: CollectionId): void {
    const stmt = this.db.prepare(DELETE_CHUNKS_FTS5_BY_COLLECTION_ID);
    stmt.run(collectionId);
  }

  /**
   *
   * @param data
   */
  createBatch(
    data: Array<{
      pointId: PointId;
      content: string;
      titleChain?: string;
    }>,
  ): void {
    // 重新创建 FTS5 表，不使用content_rowid 参数
    try {
      // 删除现有的FTS5 表
      this.db.exec('DROP TABLE IF EXISTS chunks_fts5');

      // 重新创建 FTS5 表，不使用content_rowid
      this.db.exec(
        `CREATE VIRTUAL TABLE chunks_fts5 USING fts5(content, title, tokenize='porter')`
      );

      // 使用原始 SQL 执行插入，避免better-sqlite3 的参数绑定问题
      this.db.transaction(
        (
          items: Array<{
            pointId: PointId;
            content: string;
            titleChain?: string;
          }>,
        ) => {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];

            try {
              // 正确处理换行符和特殊字符
              const escapedContent = item.content
                .replace(/'/g, "''")
                .replace(/\r\n/g, '\\n')
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\n');

              const escapedTitle = (item.titleChain || '')
                .replace(/'/g, "''")
                .replace(/\r\n/g, '\\n')
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\n');

              // 不指定rowid，让 FTS5 自动分配
              const rawSql = `INSERT INTO chunks_fts5 (content, title) VALUES ('${escapedContent}', '${escapedTitle}')`;

              this.db.exec(rawSql);
            } catch (insertError) {
              console.error(
                `[ChunksFts5Table.createBatch] 插入第${i + 1}条数据失败`,
                {
                  error: (insertError as Error).message,
                  pointId: item.pointId,
                  pointIdType: typeof item.pointId,
                  contentLength: item.content.length,
                  titleChain: item.titleChain || '',
                },
              );
              throw insertError;
            }
          }
        },
      )(data);
    } catch (error) {
      console.error(`[ChunksFts5Table.createBatch] 批量插入FTS5数据失败:`, {
        error: (error as Error).message,
        stack: (error as Error).stack,
        dataCount: data.length,
      });
      throw error;
    }
  }

  /**
   * 根据 pointId 批量删除 FTS 索引条目
   * @param pointIds - 要删除的 pointId 数组
   */
  deleteBatch(pointIds: PointId[]): void {
    if (pointIds.length === 0) {
      return;
    }
    const placeholders = pointIds.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      DELETE_CHUNKS_FTS5_BATCH.replace('(?)', (${placeholders}))
    `);
    stmt.run(...pointIds);
  }
}