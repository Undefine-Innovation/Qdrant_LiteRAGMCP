import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import {
  DatabaseConfig,
  DatabaseMigration,
} from '@domain/interfaces/IDatabaseRepository.js';

/**
 * PostgreSQL维护操作管理器
 * 负责数据库迁移、备份、优化等维护操作
 */
export class PostgreSQLMaintenanceOperations {
  /**
   * 创建PostgreSQLMaintenanceOperations实例
   * @param dataSource TypeORM数据源
   * @param config 数据库配置
   * @param logger 日志记录器
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: DatabaseConfig,
    private readonly logger: Logger,
  ) {}

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
      await this.dataSource.transaction(async () => {
        // 创建迁移表（如果不存在）
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
            // 检查迁移是否已应用
            const existing = await this.dataSource.query(
              'SELECT id FROM migrations WHERE id = $1',
              [migration.id],
            );

            if (existing.length === 0) {
              // 执行迁移
              await this.dataSource.query(migration.up);

              // 记录迁移
              await this.dataSource.query(
                'INSERT INTO migrations (id, name, version, description) VALUES ($1, $2, $3, $4)',
                [
                  migration.id,
                  migration.name,
                  migration.version,
                  migration.description,
                ],
              );

              applied.push(migration.id);
              this.logger.info('应用迁移成功', { migrationId: migration.id });
            }
          } catch (error) {
            failed.push(migration.id);
            this.logger.error('应用迁移失败', {
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
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          version VARCHAR(50) NOT NULL,
          description TEXT,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 获取已应用的迁移
      const applied = (await this.dataSource.query('SELECT id FROM migrations')) as Array<Record<string, unknown>>;
      const appliedIds = new Set(applied.map((row: Record<string, unknown>) => String(row['id'] ?? '')));

      // 返回未应用的迁移
      return migrations.filter((migration) => !appliedIds.has(migration.id));
    } catch (error) {
      this.logger.error('获取待执行迁移失败', {
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
      const result = (await this.dataSource.query(`
        SELECT id, name, version, description, applied_at 
        FROM migrations 
        ORDER BY applied_at ASC
      `)) as Array<Record<string, unknown>>;

      return result.map((row: Record<string, unknown>) => ({
        id: String(row['id'] ?? ''),
        name: String(row['name'] ?? ''),
        version: String(row['version'] ?? ''),
        description: String(row['description'] ?? ''),
        appliedAt: new Date(String(row['applied_at'] ?? '')),
        up: '', // 不存储up SQL
        down: '', // 不存储down SQL
      }));
    } catch (error) {
      this.logger.error('获取已应用迁移失败', {
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

      const command = `pg_dump -h ${this.config.host} -p ${this.config.port} -U ${this.config.username} -d ${this.config.database} > ${backupPath}`;

      await new Promise<void>((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      this.logger.info('PostgreSQL备份创建成功', { backupPath });

      return {
        success: true,
        message: `备份创建成功: ${backupPath}`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('创建PostgreSQL备份失败', { error: errorMessage });

      return {
        success: false,
        message: '备份创建失败',
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

      const command = `psql -h ${this.config.host} -p ${this.config.port} -U ${this.config.username} -d ${this.config.database} < ${backupPath}`;

      await new Promise<void>((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      this.logger.info('PostgreSQL备份恢复成功', { backupPath });

      return {
        success: true,
        message: `备份恢复成功: ${backupPath}`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('恢复PostgreSQL备份失败', { error: errorMessage });

      return {
        success: false,
        message: '备份恢复失败',
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
      await this.dataSource.transaction(async () => {
        // 更新表统计信息
        await this.dataSource.query('ANALYZE');

        // 重建索引
        await this.dataSource.query(`
          SELECT 'REINDEX INDEX ' || indexname || ';' 
          FROM pg_indexes 
          WHERE schemaname = 'public'
        `);

        // 清理死元组
        await this.dataSource.query('VACUUM ANALYZE');
      });

      this.logger.info('PostgreSQL数据库优化完成');

      return {
        success: true,
        message: '数据库优化完成',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('PostgreSQL数据库优化失败', { error: errorMessage });

      return {
        success: false,
        message: '数据库优化失败',
        error: errorMessage,
      };
    }
  }

  /**
   * 获取数据库统计信息
   * @returns 统计信息
   */
  async getStatistics(): Promise<{
    totalCollections: number;
    totalDocuments: number;
    totalChunks: number;
    databaseSize: number;
    indexSize: number;
  }> {
    try {
      // 获取表统计信息
      const collectionsResult = await this.dataSource.query(
        'SELECT COUNT(*) as count FROM collections',
      );
      const documentsResult = await this.dataSource.query(
        'SELECT COUNT(*) as count FROM docs',
      );
      const chunksResult = await this.dataSource.query(
        'SELECT COUNT(*) as count FROM chunks',
      );

      // 获取数据库大小
      const sizeResult = await this.dataSource.query(`
        SELECT pg_database_size(current_database()) as size
      `);

      // 获取索引大小
      const indexResult = await this.dataSource.query(`
        SELECT 
          SUM(pg_relation_size(indexrelid)) as index_size
        FROM pg_index
        WHERE schemaname = 'public'
      `);

      return {
        totalCollections: parseInt(collectionsResult[0]?.count || '0'),
        totalDocuments: parseInt(documentsResult[0]?.count || '0'),
        totalChunks: parseInt(chunksResult[0]?.count || '0'),
        databaseSize: parseInt(sizeResult[0]?.size || '0'),
        indexSize: parseInt(indexResult[0]?.index_size || '0'),
      };
    } catch (error) {
      this.logger.error('获取PostgreSQL统计信息失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
