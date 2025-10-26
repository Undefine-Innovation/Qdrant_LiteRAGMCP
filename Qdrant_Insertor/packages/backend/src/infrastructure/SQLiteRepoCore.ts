import Database from 'better-sqlite3';
import { Logger } from '../logger.js';
import {
  DatabaseInitializer,
  DatabaseInitResult,
} from './DatabaseInitializer.js';

/**
 * SQLite仓库核心
 * 负责数据库连接和基本事务操作
 */
export class SQLiteRepoCore {
  public readonly db: Database.Database;
  private dbInitializer: DatabaseInitializer | null = null;

  /**
   * @param db `better-sqlite3` 数据库实例。
   */
  constructor(db: Database.Database) {
    this.db = db;
    this.bootstrap();
  }

  /**
   * 设置数据库模式和 PRAGMA 设置。
   * 假设数据库模式已通过迁移脚本创建。
   */
  private bootstrap() {
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');
  }

  /**
   * 在数据库事务中执行一个函数。
   * @param fn 包含数据库操作的函数。
   * @returns 事务函数的返回值。
   */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  /**
   * 关闭数据库连接。
   */
  public close() {
    this.db.close();
  }

  /**
   * 检查数据库连接是否存活。
   * @returns 如果连接响应正常则返回 true，否则返回 false。
   */
  ping(): boolean {
    // 这里应该实现实际的ping检查
    // 暂时返回true
    return true;
  }

  /**
   * 初始化数据库
   * @param dbPath - 数据库文件路径
   * @param logger - 日志记录器
   * @returns 初始化结果
   */
  async initializeDatabase(
    dbPath: string,
    logger: Logger,
  ): Promise<DatabaseInitResult> {
    if (!this.dbInitializer) {
      this.dbInitializer = new DatabaseInitializer(this.db, dbPath, logger);
    }
    return this.dbInitializer.initialize();
  }

  /**
   * 获取数据库状态信息
   * @param dbPath - 数据库文件路径
   * @param logger - 日志记录器
   * @returns 数据库状态信息
   */
  async getDatabaseStatus(dbPath: string, logger: Logger) {
    if (!this.dbInitializer) {
      this.dbInitializer = new DatabaseInitializer(this.db, dbPath, logger);
    }
    return this.dbInitializer.getDatabaseStatus();
  }

  /**
   * 检查数据库初始化状态
   * @param dbPath - 数据库文件路径
   * @param logger - 日志记录器
   * @returns 初始化状态
   */
  async checkInitializationStatus(dbPath: string, logger: Logger) {
    if (!this.dbInitializer) {
      this.dbInitializer = new DatabaseInitializer(this.db, dbPath, logger);
    }
    return this.dbInitializer.checkInitializationStatus();
  }
}
