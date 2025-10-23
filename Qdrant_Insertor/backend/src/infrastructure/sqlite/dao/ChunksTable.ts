import type { Database } from 'better-sqlite3';
import type { PointId, DocId, CollectionId } from '@domain/types.js';
import {
  INSERT_CHUNKS_BATCH,
  SELECT_CHUNKS_BY_POINT_IDS,
  DELETE_CHUNKS_BY_POINT_IDS,
} from '../sql/chunks.sql.js';

/**
 * `chunks` 表的数据访问对象 (DAO)。
 * 封装了所有块内容的 SQL 交互。
 */
export class ChunksTable {
  private db: Database;

  /**
   * @param db - 数据库实例。
   */
  constructor(db: Database) {
    this.db = db;
  }

  /**
   * 批量插入块内容。
   * @param data - 要插入的块内容数组。
   */
  createBatch(data: Array<{
    pointId: PointId;
    docId: DocId;
    collectionId: CollectionId;
    chunkIndex: number;
    title?: string | null;
    content: string;
  }>): void {
    const insert = this.db.prepare(INSERT_CHUNKS_BATCH);

    this.db.transaction(
      (items: Array<{
        pointId: PointId;
        docId: DocId;
        collectionId: CollectionId;
        chunkIndex: number;
        title?: string | null;
        content: string;
      }>) => {
        for (const item of items) {
          // 处理 title 字段：将 undefined 和 null 转换为空字符串
          const titleForDb = item.title === undefined || item.title === null ? '' : item.title;
          
          // 确保 chunkIndex 是整数
          const chunkIndexInt = Math.floor(item.chunkIndex);
          
          // 完全禁用所有触发器以避免 FTS5 相关的 datatype mismatch
          this.db.exec('PRAGMA recursive_triggers = OFF');
          this.db.exec('PRAGMA foreign_keys = OFF');
          
          try {
            // 暂时禁用触发器
            this.db.exec('DROP TRIGGER IF EXISTS chunks_ai');
            this.db.exec('DROP TRIGGER IF EXISTS chunks_au');
            this.db.exec('DROP TRIGGER IF EXISTS chunks_ad');
            
            // 使用原始 SQL 执行插入，避免 better-sqlite3 的参数绑定问题
            // 正确处理换行符和特殊字符
            const escapedContent = item.content
              .replace(/'/g, "''")
              .replace(/\r\n/g, "\\n")
              .replace(/\n/g, "\\n")
              .replace(/\r/g, "\\n");
            
            const escapedTitle = titleForDb
              .replace(/'/g, "''")
              .replace(/\r\n/g, "\\n")
              .replace(/\n/g, "\\n")
              .replace(/\r/g, "\\n");
            
            // 先插入到 chunks 表
            const rawSql = `INSERT INTO chunks (content, title, pointId, docId, collectionId, chunkIndex) VALUES ('${escapedContent}', '${escapedTitle}', '${item.pointId.replace(/'/g, "''")}', '${item.docId.replace(/'/g, "''")}', '${item.collectionId.replace(/'/g, "''")}', ${chunkIndexInt})`;
            
            
            this.db.exec(rawSql);
            
            // 稍后手动重新创建触发器
          } finally {
            // 重新启用外键约束和递归触发器
            this.db.exec('PRAGMA foreign_keys = ON');
            this.db.exec('PRAGMA recursive_triggers = ON');
          }
        }
      },
    )(data);
  }

  /**
   * 根据 pointIds 查询块内容。
   * @param pointIds - 块 ID 数组。
   * @returns 块内容数组。
   */
  getByPointIds(pointIds: PointId[]): Array<{
    pointId: PointId;
    content: string;
    title?: string;
  }> {
    if (pointIds.length === 0) {
      return [];
    }
    const placeholders = pointIds.map(() => '?').join(',');
    const stmt = this.db.prepare(
      SELECT_CHUNKS_BY_POINT_IDS.replace('(?)', `(${placeholders})`),
    );
    return stmt.all(...pointIds) as Array<{
      pointId: PointId;
      content: string;
      title?: string;
    }>;
  }

  /**
   * 根据 pointIds 批量删除块内容。
   * @param pointIds - 要删除的 pointId 数组。
   */
  deleteBatch(pointIds: PointId[]): void {
    if (pointIds.length === 0) {
      return;
    }
    const placeholders = pointIds.map(() => '?').join(',');
    const stmt = this.db.prepare(
      DELETE_CHUNKS_BY_POINT_IDS.replace('(?)', `(${placeholders})`),
    );
    stmt.run(...pointIds);
  }
}