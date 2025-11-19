import { Logger } from '@logging/logger.js';
import {
  DatabaseConfig,
  DatabaseMigration,
} from '@domain/interfaces/IDatabaseRepository.js';

/**
 * PostgreSQL维护处理器
 * 负责PostgreSQL特定的维护操作
 */
export class PostgreSQLMaintenance {
  constructor(
    private readonly config: DatabaseConfig,
    private readonly logger: Logger,
    private readonly query: (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>,
    private readonly transaction: (
      callback: () => Promise<void>,
    ) => Promise<void>,
  ) {}

  /**
   * 执行数据库特定的优化
   * @returns 执行的优化操作列表
   */
  async performDatabaseOptimizations(): Promise<string[]> {
    const optimizations: string[] = [];

    try {
      // 更新表统计信息
      await this.query('ANALYZE');
      optimizations.push('更新表统计信息');

      // 清理死元组
      await this.query('VACUUM ANALYZE');
      optimizations.push('清理死元组');

      // 重建索引（如果需要）
      const indexUsage = await this.getIndexUsage();
      if (indexUsage && indexUsage < 0.8) {
        await this.query('REINDEX DATABASE ' + this.config.database);
        optimizations.push('重建数据库索引');
      }

      // 优化连接池
      await this.optimizeConnectionPool();
      optimizations.push('优化连接池');
    } catch (error) {
      this.logger.error('PostgreSQL优化失败', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return optimizations;
  }

  /**
   * 执行数据库迁移
   * @param migrations 迁移数组
   * @returns 迁移结果
   */
  async runMigrations(migrations: DatabaseMigration[]): Promise<{
    success: boolean;
    applied: string[];
    failed: string[];
    error?: string;
  }> {
    const applied: string[] = [];
    const failed: string[] = [];

    try {
      await this.transaction(async () => {
        // 创建迁移表（如果不存在）
        await this.query(`
          CREATE TABLE IF NOT EXISTS migrations (
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            version VARCHAR(50) NOT NULL,
            description TEXT,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);

        for (const migration of migrations) {
          try {
            // 检查迁移是否已应用
            const existing = await this.query(
              'SELECT id FROM migrations WHERE id = $1',
              [migration.id],
            );

            if (existing.length === 0) {
              // 执行迁移
              await this.query(migration.up);

              // 记录迁移
              await this.query(
                'INSERT INTO migrations (id, name, version, description) VALUES ($1, $2, $3, $4)',
                [
                  migration.id,
                  migration.name,
                  migration.version,
                  migration.description,
                ],
              );

              applied.push(migration.id);
              this.logger.info(`应用迁移成功`, { migrationId: migration.id });
            }
          } catch (error) {
            failed.push(migration.id);
            this.logger.error(`应用迁移失败`, {
              migrationId: migration.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      });

      return {
        success: failed.length === 0,
        applied,
        failed,
      };
    } catch (error) {
      return {
        success: false,
        applied,
        failed,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 获取待执行的迁移列表
   * @param migrations 所有可用迁移
   * @returns 待执行的迁移
   */
  async getPendingMigrations(
    migrations: DatabaseMigration[],
  ): Promise<DatabaseMigration[]> {
    try {
      // 确保迁移表存在
      await this.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          version VARCHAR(50) NOT NULL,
          description TEXT,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 获取已应用的迁移
      const applied = await this.query('SELECT id FROM migrations');
      const appliedIds = new Set(
        applied.map((row: Record<string, unknown>) => row['id']),
      );

      // 返回未应用的迁移
      return migrations.filter((migration) => !appliedIds.has(migration.id));
    } catch (error) {
      this.logger.error(`获取待执行迁移失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 获取已应用的迁移列表
   * @returns 已应用的迁移
   */
  async getAppliedMigrations(): Promise<DatabaseMigration[]> {
    try {
      const result = await this.query(`
        SELECT id, name, version, description, applied_at 
        FROM migrations 
        ORDER BY applied_at ASC
      `);

      return result.map((row: Record<string, unknown>) => ({
        id: row['id'] as string,
        name: row['name'] as string,
        version: row['version'] as string,
        description: row['description'] as string,
        appliedAt: new Date(row['applied_at'] as string),
        up: '', // 不存储up SQL
        down: '', // 不存储down SQL
      }));
    } catch (error) {
      this.logger.error(`获取已应用迁移失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 创建数据库备份
   * @param backupPath 备份文件路径
   * @returns 备份结果
   */
  async createBackup(backupPath: string): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    try {
      // 使用pg_dump创建备份
      const { exec } = await import('child_process');
      const pgDumpCommand = `pg_dump ${this.config.database} > ${backupPath}`;

      await new Promise<void>((resolve, reject) => {
        exec(pgDumpCommand, (error, stdout, stderr) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      this.logger.info(`PostgreSQL备份创建成功`, { backupPath });

      return {
        success: true,
        message: `备份创建成功: ${backupPath}`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`创建PostgreSQL备份失败`, { error: errorMessage });

      return {
        success: false,
        message: `备份创建失败`,
        error: errorMessage,
      };
    }
  }

  /**
   * 从备份恢复数据库
   * @param backupPath 备份文件路径
   * @returns 恢复结果
   */
  async restoreFromBackup(backupPath: string): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    try {
      // 使用psql恢复备份
      const { exec } = await import('child_process');
      const psqlCommand = `psql ${this.config.database} < ${backupPath}`;

      await new Promise<void>((resolve, reject) => {
        exec(psqlCommand, (error, stdout, stderr) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      this.logger.info(`PostgreSQL备份恢复成功`, { backupPath });

      return {
        success: true,
        message: `备份恢复成功: ${backupPath}`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`恢复PostgreSQL备份失败`, { error: errorMessage });

      return {
        success: false,
        message: `备份恢复失败`,
        error: errorMessage,
      };
    }
  }

  /**
   * 优化数据库性能
   * @returns 优化结果
   */
  async optimize(): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    try {
      await this.transaction(async () => {
        // 更新表统计信息
        await this.query('ANALYZE');

        // 清理死元组
        await this.query('VACUUM ANALYZE');

        // 重建索引（如果需要）
        const indexUsage = await this.getIndexUsage();
        if (indexUsage && indexUsage < 0.8) {
          await this.query('REINDEX DATABASE ' + this.config.database);
        }
      });

      this.logger.info(`PostgreSQL数据库优化完成`);

      return {
        success: true,
        message: '数据库优化完成',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`PostgreSQL数据库优化失败`, { error: errorMessage });

      return {
        success: false,
        message: '数据库优化失败',
        error: errorMessage,
      };
    }
  }

  // 私有方法

  /**
   * 获取索引使用率
   * @returns {Promise<number>} 索引使用率
   */
  private async getIndexUsage(): Promise<number> {
    try {
      const result = await this.query(`
        SELECT 
          SUM(idx_scan) as total_scans,
          SUM(idx_tup_read) as total_reads,
          SUM(seq_scan) as total_seq_scans,
          SUM(seq_tup_read) as total_seq_reads
        FROM pg_stat_user_indexes
      `);

      const stats = result[0] as Record<string, unknown> | undefined;
      if (!stats) return 0;

      const totalReads =
        parseInt(String(stats['total_reads'] ?? '0')) +
        parseInt(String(stats['total_seq_reads'] ?? '0'));
      const indexReads = parseInt(String(stats['total_reads'] ?? '0'));

      return totalReads > 0 ? indexReads / totalReads : 0;
    } catch (error) {
      this.logger.error(`获取索引使用率失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * 优化连接池
   * @returns {Promise<void>}
   */
  private async optimizeConnectionPool(): Promise<void> {
    try {
      // 终止长时间空闲的连接
      await this.query(`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE state = 'idle' 
          AND query_start < now() - interval '1 hour'
          AND pid != pg_backend_pid()
      `);

      this.logger.debug(`优化连接池完成`);
    } catch (error) {
      this.logger.error(`优化连接池失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
