import type { Database } from 'better-sqlite3';
import { Logger } from '@logging/logger.js';
import { CHECK_TABLE_EXISTS, GET_ALL_TABLES } from '@infrastructure/sqlite/sql/schema.sql.js';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * 数据库状态检查器
 * 负责检查数据库文件和表的存在状态
 */
export class DatabaseStatusChecker {
  /**
   *
   * @param db
   * @param dbPath
   * @param logger
   */
  constructor(
    private readonly db: Database,
    private readonly dbPath: string,
    private readonly logger: Logger,
  ) {}

  /**
   * 检查是否为测试环境
   */
  private isTestEnvironment(): boolean {
    return (
      process.env.NODE_ENV === 'test' ||
      process.env.JEST_WORKER_ID !== undefined ||
      process.env.VITEST === 'true'
    );
  }

  /**
   * 检查数据库文件是否存在
   */
  public async checkDatabaseFileExists(): Promise<boolean> {
    try {
      await fs.access(this.dbPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 确保数据库目录存在
   */
  public async ensureDatabaseDirectory(): Promise<void> {
    const dbDir = path.dirname(this.dbPath);
    try {
      await fs.access(dbDir);
    } catch {
      this.logger.info(`创建数据库目录: ${dbDir}`);
      await fs.mkdir(dbDir, { recursive: true });
    }
  }

  /**
   * 获取必需的表名称列表
   */
  public getRequiredTableNames(): string[] {
    const baseTables = [
      'collections',
      'docs',
      'chunks',
      'chunks_fts5',
      'sync_jobs',
      'chunk_checksums',
      'chunk_meta',
    ];

    // 在非测试环境中添加监控相关表
    if (!this.isTestEnvironment()) {
      baseTables.push(
        'system_metrics',
        'alert_rules',
        'alert_history',
        'system_health',
        'sync_job_stats',
        'retry_history',
        'notification_channels',
      );
    }

    return baseTables;
  }

  /**
   * 获取数据库中已存在的表名列表
   */
  public getExistingTables(): string[] {
    try {
      const stmt = this.db.prepare(GET_ALL_TABLES);
      const tables = stmt.all() as Array<{ name: string }>;
      return tables.map((t) => t.name);
    } catch (error) {
      this.logger.error('获取现有表列表失败', error);
      return [];
    }
  }

  /**
   * 检查关键表是否存在
   */
  public checkRequiredTablesExist(): boolean {
    const requiredTables = this.getRequiredTableNames();
    const existingTables = this.getExistingTables();

    return requiredTables.every((table) => existingTables.includes(table));
  }

  /**
   * 获取数据库文件状态信息
   */
  public async getDatabaseFileInfo(): Promise<{
    exists: boolean;
    size?: number;
  }> {
    try {
      const exists = await this.checkDatabaseFileExists();
      let size: number | undefined;

      if (exists) {
        const stats = await fs.stat(this.dbPath);
        size = stats.size;
      }

      return { exists, size };
    } catch (error) {
      this.logger.error('获取数据库文件信息失败', error);
      return { exists: false };
    }
  }

  /**
   * 获取表数量统计
   */
  public getTableCount(): number {
    try {
      const tables = this.getExistingTables();
      return tables.length;
    } catch {
      return 0;
    }
  }
}