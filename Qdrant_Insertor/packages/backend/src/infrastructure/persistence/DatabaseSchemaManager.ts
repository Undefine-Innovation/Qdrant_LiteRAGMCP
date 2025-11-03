import type { Database } from 'better-sqlite3';
import { Logger } from '@logging/logger.js';
import {
  CREATE_INITIAL_SCHEMA,
  CREATE_MONITORING_SCHEMA,
} from '@infrastructure/sqlite/sql/schema.sql.js';

/**
 * 数据库架构管理器
 * 负责执行数据库架构初始化和更新
 */
export class DatabaseSchemaManager {
  /**
   *
   * @param db
   * @param logger
   */
  constructor(
    private readonly db: Database,
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
   * 确保 FTS5 表和触发器为最新配置（使用 rowid 关联而非 pointId）
   * 如果检测到旧的 content_rowid='pointId' 或触发器引用 pointId，则自动迁移
   */
  public async ensureFts5SchemaUpToDate(): Promise<void> {
    try {
      // 查询 chunks_fts5 的创建 SQL
      const row = this.db
        .prepare(
          `SELECT sql FROM sqlite_master WHERE type='table' AND name='chunks_fts5'`,
        )
        .get() as { sql?: string } | undefined;

      const existingSql = row?.sql || '';
      const isOldMapping = existingSql.includes("content_rowid='pointId'");

      // 查询触发器定义
      const triggers = this.db
        .prepare(
          `SELECT name, sql FROM sqlite_master WHERE type='trigger' AND name IN ('chunks_ai','chunks_au','chunks_ad')`,
        )
        .all() as Array<{ name: string; sql: string }>;
      const triggersUsePointId = triggers.some((t) =>
        /NEW\.pointId|OLD\.pointId/.test(t.sql || ''),
      );

      if (isOldMapping || triggersUsePointId) {
        this.logger.warn(
          '[DatabaseSchemaManager] 检测到旧版 FTS5 配置，开始迁移为 rowid 映射…',
        );

        const migrate = this.db.transaction(() => {
          // 删除旧触发器和虚拟表
          this.db.exec(`
            DROP TRIGGER IF EXISTS chunks_ai;
            DROP TRIGGER IF EXISTS chunks_au;
            DROP TRIGGER IF EXISTS chunks_ad;
            DROP TABLE IF EXISTS chunks_fts5;
          `);

          // 创建新的 FTS5 表与触发器（基于 rowid）
          this.db.exec(`
            CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts5
            USING fts5(content, title, tokenize='porter', content='chunks');

            CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
              INSERT INTO chunks_fts5(rowid, content, title) VALUES (NEW.rowid, NEW.content, NEW.title);
            END;

            CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
              INSERT INTO chunks_fts5(chunks_fts5, rowid, content, title) VALUES ('delete', OLD.rowid, OLD.content, OLD.title);
              INSERT INTO chunks_fts5(rowid, content, title) VALUES (NEW.rowid, NEW.content, NEW.title);
            END;

            CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
              INSERT INTO chunks_fts5(chunks_fts5, rowid, content, title) VALUES ('delete', OLD.rowid, OLD.content, OLD.title);
            END;
          `);

          // 触发重建以回填现有内容
          this.db.exec(`INSERT INTO chunks_fts5(chunks_fts5) VALUES('rebuild')`);
        });

        migrate();
        this.logger.info('[DatabaseSchemaManager] FTS5 架构迁移完成');
      } else {
        this.logger.info('[DatabaseSchemaManager] FTS5 架构已是最新，无需迁移');
      }
    } catch (error) {
      this.logger.error('[DatabaseSchemaManager] 检测/迁移 FTS5 架构失败', error);
      // 不抛出以避免阻塞主流程，但保留错误日志
    }
  }

  /**
   * 检查是否需要应用监控架构更新
   */
  public async needsMonitoringSchemaUpdate(): Promise<boolean> {
    // 测试环境中不需要监控架构更新
    if (this.isTestEnvironment()) {
      return false;
    }

    try {
      // 检查sync_jobs表是否有新增的列
      const pragmaSql = 'PRAGMA table_info(sync_jobs)';
      const stmt = this.db.prepare(pragmaSql);
      const columns = stmt.all() as Array<{ name: string }>;
      const columnNames = columns.map((c) => c.name);

      const requiredColumns = [
        'started_at',
        'completed_at',
        'duration_ms',
        'error_category',
        'last_retry_strategy',
        'progress',
      ];
      return !requiredColumns.every((col) => columnNames.includes(col));
    } catch (error) {
      this.logger.error('检查监控架构更新失败', error);
      return true; // 出错时默认需要更新
    }
  }

  /**
   * 执行初始架构
   */
  public async executeInitialSchema(): Promise<void> {
    await this.executeSqlScript(CREATE_INITIAL_SCHEMA, '初始架构');
  }

  /**
   * 执行监控和持久化架构
   */
  public async executeMonitoringSchema(): Promise<void> {
    await this.executeSqlScript(CREATE_MONITORING_SCHEMA, '监控和持久化架构');
  }

  /**
   * 执行单个SQL脚本
   * @param sql
   * @param scriptName
   */
  private async executeSqlScript(
    sql: string,
    scriptName: string,
  ): Promise<void> {
    try {
      this.logger.info(`执行${scriptName}脚本...`);

      // 分割SQL语句并执行，处理触发器等多行语句
      const statements = this.splitSqlStatements(sql);

      for (const statement of statements) {
        if (statement.trim()) {
          try {
            this.db.exec(statement);
          } catch (stmtError) {
            this.logger.error(
              `执行SQL语句失败: ${statement.substring(0, 100)}...`,
              stmtError,
            );
            throw stmtError;
          }
        }
      }

      this.logger.info(`${scriptName}脚本执行完成`);
    } catch (error) {
      this.logger.error(`执行${scriptName}脚本失败`, error);
      throw error;
    }
  }

  /**
   * 分割SQL语句，正确处理触发器等多行语句
   * @param sql
   */
  private splitSqlStatements(sql: string): string[] {
    const statements: string[] = [];
    let currentStatement = '';
    let inTrigger = false;
    let triggerDepth = 0;

    const lines = sql.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();

      // 跳过注释
      if (trimmedLine.startsWith('--')) {
        continue;
      }

      currentStatement += line + '\n';

      // 检测触发器开始
      if (trimmedLine.toUpperCase().startsWith('CREATE TRIGGER')) {
        inTrigger = true;
        triggerDepth = 0;
      }

      // 检测BEGIN和END
      if (inTrigger) {
        if (trimmedLine.toUpperCase().includes('BEGIN')) {
          triggerDepth++;
        }
        if (trimmedLine.toUpperCase().includes('END')) {
          triggerDepth--;
          if (triggerDepth === 0) {
            inTrigger = false;
            // 触发器结束，添加到语句列表
            const triggerStatement = currentStatement.trim();
            if (triggerStatement) {
              statements.push(triggerStatement);
            }
            currentStatement = '';
            continue;
          }
        }
      }

      // 如果不在触发器中且遇到分号，则语句结束
      if (!inTrigger && trimmedLine.endsWith(';')) {
        const statement = currentStatement.trim();
        if (statement) {
          statements.push(statement);
        }
        currentStatement = '';
      }
    }

    // 添加最后一个语句（如果没有以分号结尾）
    const lastStatement = currentStatement.trim();
    if (lastStatement) {
      statements.push(lastStatement);
    }

    return statements;
  }
}
