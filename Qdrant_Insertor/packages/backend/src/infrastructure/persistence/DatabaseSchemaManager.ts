import type { Database } from 'better-sqlite3';
import { Logger } from '@logging/logger.js';

/**
 * 数据库架构管理器
 * 负责执行数据库架构初始化和更新
 * 注意：已迁移到 TypeORM，此类保留用于兼容性
 */
export class DatabaseSchemaManager {
  /**
   * 构造函数
   * @param db - 数据库实例
   * @param logger - 日志记录器
   */
  constructor(
    private readonly db: Database,
    private readonly logger: Logger,
  ) {}

  /**
   * 空方法，保留用于兼容性（已迁移到 TypeORM）
   * @returns Promise<void>
   */
  public async ensureFts5SchemaUpToDate(): Promise<void> {
    this.logger.debug(
      'ensureFts5SchemaUpToDate - no-op (TypeORM migration complete)',
    );
  }

  /**
   * 空方法，保留用于兼容性（已迁移到 TypeORM）
   * @returns Promise<boolean>
   */
  public async needsMonitoringSchemaUpdate(): Promise<boolean> {
    return false;
  }

  /**
   * 空方法，保留用于兼容性（已迁移到 TypeORM）
   * @returns Promise<void>
   */
  public async executeInitialSchema(): Promise<void> {
    this.logger.debug(
      'executeInitialSchema - no-op (TypeORM migration complete)',
    );
  }

  /**
   * 空方法，保留用于兼容性（已迁移到 TypeORM）
   * @returns Promise<void>
   */
  public async executeMonitoringSchema(): Promise<void> {
    this.logger.debug(
      'executeMonitoringSchema - no-op (TypeORM migration complete)',
    );
  }
}
