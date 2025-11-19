import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { DatabaseMigration } from '@domain/interfaces/IDatabaseRepository.js';

export class SQLiteRepositoryMaintenance {
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: Logger,
  ) {}

  async runMigrations(migrations: DatabaseMigration[]): Promise<{
    success: boolean;
    applied: string[];
    failed: string[];
    error?: string;
  }> {
    const applied: string[] = [];
    const failed: string[] = [];

    try {
      await this.dataSource.transaction(async () => {
        await this.dataSource.query(`
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
            const existing = await this.dataSource.query(
              'SELECT id FROM migrations WHERE id = ?',
              [migration.id],
            );

            if (existing.length === 0) {
              await this.dataSource.query(migration.up);

              await this.dataSource.query(
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

  async getPendingMigrations(
    migrations: DatabaseMigration[],
  ): Promise<DatabaseMigration[]> {
    try {
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          version VARCHAR(50) NOT NULL,
          description TEXT,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const applied = await this.dataSource.query('SELECT id FROM migrations');
      const appliedIds = new Set(
        applied.map((row: Record<string, unknown>) => String(row.id)),
      );

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
      const result = await this.dataSource.query(`
        SELECT id, name, version, description, applied_at 
        FROM migrations 
        ORDER BY applied_at ASC
      `);

      return result.map((row: Record<string, unknown>) => ({
        id: String(row.id ?? ''),
        name: String(row.name ?? ''),
        version: String(row.version ?? ''),
        description: String(row.description ?? ''),
        appliedAt: new Date(String(row.applied_at ?? '')),
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
      // config.path is not available here; caller should copy from adapter
      const dsOptions = this.dataSource as unknown as { options?: Record<string, unknown> };
      const dbPath = String(dsOptions?.options?.database ?? '');
      await fs.copyFile(dbPath, backupPath);

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
    targetPath: string,
  ): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      const fs = await import('fs/promises');
      await fs.copyFile(backupPath, targetPath);

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
      await this.dataSource.transaction(async () => {
        await this.dataSource.query('ANALYZE');
        await this.dataSource.query('VACUUM');
        await this.dataSource.query('REINDEX');
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
