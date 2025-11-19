import type { Database } from 'better-sqlite3';
import { Logger } from '@logging/logger.js';
import { promises as fs } from 'fs';

/**
 * 数据库状态检查器
 * 负责检查数据库文件和表的存在状态
 * 注意：已迁移到 TypeORM，此类保留用于兼容性
 */
export class DatabaseStatusChecker {
  /**
   * 构造函数
   * @param db - 数据库实例
   * @param dbPath - 数据库文件路径
   * @param logger - 日志记录器
   */
  constructor(
    private readonly db: Database,
    private readonly dbPath: string,
    private readonly logger: Logger,
  ) {}

  /**
   * 检查数据库文件是否存在
   * @returns 数据库文件是否存在
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
   * 检查必要的表是否存在
   * @returns 是否存在所有必要的表
   */
  public async checkTablesExist(): Promise<boolean> {
    // 已迁移到 TypeORM，直接返回 true
    return true;
  }

  /**
   * 确保数据库目录存在
   * @returns 无返回值
   */
  public async ensureDatabaseDirectory(): Promise<void> {
    try {
      await fs.access(this.dbPath);
    } catch {
      this.logger.info(`创建数据库目录: ${this.dbPath}`);
      const dir = this.dbPath.substring(0, this.dbPath.lastIndexOf('/'));
      await fs.mkdir(dir, { recursive: true });
    }
  }

  /**
   * 获取必需的表名称列表
   * @returns 必需的表名称列表
   */
  public getRequiredTableNames(): string[] {
    // 已迁移到 TypeORM，返回空列表
    return [];
  }

  /**
   * 获取数据库中已存在的表名列表
   * @returns 已存在的表名列表
   */
  public getExistingTables(): string[] {
    // 已迁移到 TypeORM，返回空列表
    return [];
  }

  /**
   * 检查关键表是否存在
   * @returns 所有关键表是否存在
   */
  public checkRequiredTablesExist(): boolean {
    // 已迁移到 TypeORM，直接返回 true
    return true;
  }

  /**
   * 获取数据库文件状态信息
   * @returns 数据库文件状态信息
   */
  public async getDatabaseFileInfo(): Promise<{
    exists: boolean;
    size?: number;
  }> {
    // 已迁移到 TypeORM，返回空信息
    return { exists: true };
  }

  /**
   * 获取表数量统计
   * @returns 表数量
   */
  public getTableCount(): number {
    // 已迁移到 TypeORM，返回 0
    return 0;
  }
}
