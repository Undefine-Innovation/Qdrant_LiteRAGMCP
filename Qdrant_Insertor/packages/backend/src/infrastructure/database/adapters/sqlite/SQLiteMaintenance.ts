import { Logger } from '@logging/logger.js';
import { DatabaseMigration } from '@domain/interfaces/IDatabaseRepository.js';

export class SQLiteMaintenance {
  constructor(
    private readonly query: (sql: string, params?: unknown[]) => Promise<unknown>,
    private readonly transaction: (fn: () => Promise<unknown>) => Promise<unknown>,
    private readonly logger: Logger,
    private readonly config: Record<string, unknown>,
  ) {}

  async performDatabaseOptimizations(): Promise<string[]> {
    const optimizations: string[] = [];

    try {
      await this.query('ANALYZE');
      optimizations.push('分析表统计信息');

      await this.query('VACUUM');
      optimizations.push('清理数据库');

      await this.query('REINDEX');
      optimizations.push('重建索引');

      await this.query('PRAGMA wal_checkpoint(TRUNCATE)');
      optimizations.push('优化WAL检查点');
    } catch (error) {
      this.logger.error('SQLite优化失败', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return optimizations;
  }

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
        await this.query(`
          CREATE TABLE IF NOT EXISTS migrations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            version TEXT NOT NULL,
            description TEXT,
            applied_at INTEGER DEFAULT (strftime('%s', 'now'))
          )
        `);

        for (const migration of migrations) {
          try {
            const existing = (await this.query(
              'SELECT id FROM migrations WHERE id = ?',
              [migration.id],
            )) as Array<Record<string, unknown>>;
            if ((existing?.length ?? 0) === 0) {
              await this.query(migration.up);
              await this.query(
                'INSERT INTO migrations (id, name, version, description) VALUES (?, ?, ?, ?)',
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

      return { success: failed.length === 0, applied, failed };
    } catch (error) {
      return {
        success: false,
        applied,
        failed,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getPendingMigrations(
    migrations: DatabaseMigration[],
  ): Promise<DatabaseMigration[]> {
    try {
      await this.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          version TEXT NOT NULL,
          description TEXT,
          applied_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
      `);

      const applied = (await this.query('SELECT id FROM migrations')) as Array<Record<string, unknown>>;
      const appliedIds = new Set(applied.map((row) => String(row['id'])));
      return migrations.filter((migration) => !appliedIds.has(migration.id));
    } catch (error) {
      this.logger.error(`获取待执行迁移失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getAppliedMigrations(): Promise<DatabaseMigration[]> {
    try {
      const result = (await this.query(`
        SELECT id, name, version, description, applied_at 
        FROM migrations 
        ORDER BY applied_at ASC
      `)) as Array<Record<string, unknown>>;

      return result.map((row) => ({
        id: String(row['id']),
        name: String(row['name'] ?? ''),
        version: String(row['version'] ?? ''),
        description: String(row['description'] ?? ''),
        appliedAt: new Date(Number(row['applied_at'] ?? 0) * 1000),
        up: '',
        down: '',
      }));
    } catch (error) {
      this.logger.error(`获取已应用迁移失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async createBackup(
    backupPath: string,
  ): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      const fs = await import('fs/promises');
      await fs.copyFile(this.config.path || './data/app.db', backupPath);
      this.logger.info(`SQLite备份创建成功`, { backupPath });
      return { success: true, message: `备份创建成功: ${backupPath}` };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`创建SQLite备份失败`, { error: errorMessage });
      return { success: false, message: `备份创建失败`, error: errorMessage };
    }
  }

  async restoreFromBackup(
    backupPath: string,
  ): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      const fs = await import('fs/promises');
      await fs.copyFile(backupPath, this.config.path || './data/app.db');
      this.logger.info(`SQLite备份恢复成功`, { backupPath });
      return { success: true, message: `备份恢复成功: ${backupPath}` };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`恢复SQLite备份失败`, { error: errorMessage });
      return { success: false, message: `备份恢复失败`, error: errorMessage };
    }
  }

  async optimize(): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    try {
      await this.transaction(async () => {
        await this.query('ANALYZE');
        await this.query('VACUUM');
        await this.query('REINDEX');
        await this.query('PRAGMA wal_checkpoint(TRUNCATE)');
      });
      this.logger.info(`SQLite数据库优化完成`);
      return { success: true, message: '数据库优化完成' };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`SQLite数据库优化失败`, { error: errorMessage });
      return { success: false, message: '数据库优化失败', error: errorMessage };
    }
  }
}
