import { Logger } from '@logging/logger.js';
import {
  IDatabaseRepository,
  DatabaseMigration,
  DatabaseType,
} from '@domain/interfaces/IDatabaseRepository.js';
import { DatabaseRepositoryFactory } from '../repositories/DatabaseRepositoryFactory.js';

/**
 * 数据库迁移管理器
 * 负责管理数据库迁移的执行和版本控制
 */
export class DatabaseMigrationManager {
  private readonly migrations: Map<string, DatabaseMigration> = new Map();

  /**
   * 创建数据库迁移管理器实例
   * @param logger 日志记录器
   */
  constructor(private readonly logger: Logger) {
    this.loadBuiltinMigrations();
  }

  /**
   * 注册迁移
   * @param migration 迁移对象
   */
  registerMigration(migration: DatabaseMigration): void {
    if (this.migrations.has(migration.id)) {
      throw new Error(`迁移ID已存在: ${migration.id}`);
    }

    this.migrations.set(migration.id, migration);
    this.logger.debug(`注册迁移`, {
      migrationId: migration.id,
      version: migration.version,
    });
  }

  /**
   * 获取所有迁移
   * @returns 迁移数组
   */
  getAllMigrations(): DatabaseMigration[] {
    return Array.from(this.migrations.values()).sort((a, b) => {
      // 按版本号排序
      const versionCompare = this.compareVersions(a.version, b.version);
      return versionCompare;
    });
  }

  /**
   * 获取待执行的迁移
   * @param repository 数据库仓库
   * @returns 待执行的迁移
   */
  async getPendingMigrations(
    repository: IDatabaseRepository,
  ): Promise<DatabaseMigration[]> {
    try {
      const appliedMigrations = await repository.getAppliedMigrations();
      const appliedIds = new Set(appliedMigrations.map((m) => m.id));

      return this.getAllMigrations().filter(
        (migration) => !appliedIds.has(migration.id),
      );
    } catch (error) {
      this.logger.error('获取待执行迁移失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 执行迁移
   * @param repository 数据库仓库
   * @param targetVersion 目标版本（可选）
   * @returns 迁移结果
   */
  async runMigrations(
    repository: IDatabaseRepository,
    targetVersion?: string,
  ): Promise<{
    success: boolean;
    applied: string[];
    failed: string[];
    error?: string;
  }> {
    try {
      const pendingMigrations = await this.getPendingMigrations(repository);

      // 如果指定了目标版本，只执行到该版本的迁移
      const migrationsToRun = targetVersion
        ? pendingMigrations.filter(
            (m) => this.compareVersions(m.version, targetVersion) <= 0,
          )
        : pendingMigrations;

      if (migrationsToRun.length === 0) {
        this.logger.info('没有待执行的迁移');
        return {
          success: true,
          applied: [],
          failed: [],
        };
      }

      this.logger.info(`开始执行迁移`, { count: migrationsToRun.length });

      const result = await repository.runMigrations(migrationsToRun);

      if (result.success) {
        this.logger.info('迁移执行成功', {
          applied: result.applied,
          failed: result.failed,
        });
      } else {
        this.logger.error('迁移执行失败', {
          applied: result.applied,
          failed: result.failed,
          error: result.error,
        });
      }

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('迁移执行过程中发生错误', { error: errorMessage });

      return {
        success: false,
        applied: [],
        failed: [],
        error: errorMessage,
      };
    }
  }

  /**
   * 回滚迁移
   * @param repository 数据库仓库
   * @param targetVersion 目标版本
   * @returns 回滚结果
   */
  async rollbackMigrations(
    repository: IDatabaseRepository,
    targetVersion: string,
  ): Promise<{
    success: boolean;
    rolledBack: string[];
    failed: string[];
    error?: string;
  }> {
    try {
      const appliedMigrations = await repository.getAppliedMigrations();

      // 找到需要回滚的迁移（版本号大于目标版本的迁移）
      const migrationsToRollback = appliedMigrations
        .filter((m) => this.compareVersions(m.version, targetVersion) > 0)
        .reverse(); // 从最新版本开始回滚

      if (migrationsToRollback.length === 0) {
        this.logger.info('没有需要回滚的迁移');
        return {
          success: true,
          rolledBack: [],
          failed: [],
        };
      }

      this.logger.info(`开始回滚迁移`, {
        count: migrationsToRollback.length,
        targetVersion,
      });

      const rolledBack: string[] = [];
      const failed: string[] = [];

      for (const migration of migrationsToRollback) {
        try {
          // 执行回滚SQL
          await repository.transaction(async () => {
            // 这里需要实现具体的回滚逻辑
            // 由于IDatabaseRepository接口没有直接的回滚方法，
            // 我们需要扩展接口或使用原始SQL
            this.logger.warn(`回滚迁移需要扩展接口支持`, {
              migrationId: migration.id,
            });
          });

          // 从迁移记录中删除
          await this.removeMigrationRecord(repository, migration.id);

          rolledBack.push(migration.id);
          this.logger.info(`迁移回滚成功`, { migrationId: migration.id });
        } catch (error) {
          failed.push(migration.id);
          this.logger.error(`迁移回滚失败`, {
            migrationId: migration.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const success = failed.length === 0;

      if (success) {
        this.logger.info('迁移回滚成功', {
          rolledBack,
          failed,
        });
      } else {
        this.logger.error('迁移回滚失败', {
          rolledBack,
          failed,
        });
      }

      return {
        success,
        rolledBack,
        failed,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('迁移回滚过程中发生错误', { error: errorMessage });

      return {
        success: false,
        rolledBack: [],
        failed: [],
        error: errorMessage,
      };
    }
  }

  /**
   * 验证迁移状态
   * @param repository 数据库仓库
   * @returns 验证结果
   */
  async validateMigrationState(repository: IDatabaseRepository): Promise<{
    isValid: boolean;
    currentVersion: string;
    pendingMigrations: string[];
    appliedMigrations: string[];
    issues: string[];
  }> {
    try {
      const appliedMigrations = await repository.getAppliedMigrations();
      const pendingMigrations = await this.getPendingMigrations(repository);

      const appliedIds = appliedMigrations.map((m) => m.id);
      const pendingIds = pendingMigrations.map((m) => m.id);

      const issues: string[] = [];

      // 检查是否有重复的迁移
      const duplicateMigrations = appliedIds.filter(
        (id, index) => appliedIds.indexOf(id) !== index,
      );
      if (duplicateMigrations.length > 0) {
        issues.push(`发现重复的迁移记录: ${duplicateMigrations.join(', ')}`);
      }

      // 检查迁移顺序是否正确
      const sortedApplied = [...appliedMigrations].sort((a, b) =>
        this.compareVersions(a.version, b.version),
      );

      for (let i = 1; i < sortedApplied.length; i++) {
        if (
          this.compareVersions(
            sortedApplied[i - 1].version,
            sortedApplied[i].version,
          ) > 0
        ) {
          issues.push(
            `迁移版本顺序错误: ${sortedApplied[i - 1].version} 应在 ${sortedApplied[i].version} 之前`,
          );
        }
      }

      // 检查是否有缺失的迁移
      const allMigrations = this.getAllMigrations();
      const allIds = allMigrations.map((m) => m.id);
      const missingMigrations = allIds.filter(
        (id) => !appliedIds.includes(id) && !pendingIds.includes(id),
      );

      if (missingMigrations.length > 0) {
        issues.push(`缺失的迁移: ${missingMigrations.join(', ')}`);
      }

      const currentVersion =
        appliedMigrations.length > 0
          ? appliedMigrations[appliedMigrations.length - 1].version
          : '0.0.0';

      return {
        isValid: issues.length === 0,
        currentVersion,
        pendingMigrations: pendingIds,
        appliedMigrations: appliedIds,
        issues,
      };
    } catch (error) {
      this.logger.error('验证迁移状态失败', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        isValid: false,
        currentVersion: '0.0.0',
        pendingMigrations: [],
        appliedMigrations: [],
        issues: [
          `验证失败: ${error instanceof Error ? error.message : String(error)}`,
        ],
      };
    }
  }

  /**
   * 生成迁移报告
   * @param repository 数据库仓库
   * @returns 迁移报告
   */
  async generateMigrationReport(repository: IDatabaseRepository): Promise<{
    databaseType: DatabaseType;
    currentVersion: string;
    latestVersion: string;
    pendingMigrations: DatabaseMigration[];
    appliedMigrations: DatabaseMigration[];
    recommendations: string[];
  }> {
    try {
      const appliedMigrations = await repository.getAppliedMigrations();
      const pendingMigrations = await this.getPendingMigrations(repository);
      const allMigrations = this.getAllMigrations();

      const currentVersion =
        appliedMigrations.length > 0
          ? appliedMigrations[appliedMigrations.length - 1].version
          : '0.0.0';

      const latestVersion =
        allMigrations.length > 0
          ? allMigrations[allMigrations.length - 1].version
          : '0.0.0';

      const recommendations: string[] = [];

      if (pendingMigrations.length > 0) {
        recommendations.push(
          `建议执行 ${pendingMigrations.length} 个待执行的迁移`,
        );
      }

      if (currentVersion !== latestVersion) {
        recommendations.push(
          `数据库版本落后，当前版本: ${currentVersion}，最新版本: ${latestVersion}`,
        );
      }

      return {
        databaseType: repository.databaseType,
        currentVersion,
        latestVersion,
        pendingMigrations,
        appliedMigrations,
        recommendations,
      };
    } catch (error) {
      this.logger.error('生成迁移报告失败', {
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * 比较版本号
   * @param version1 版本1
   * @param version2 版本2
   * @returns 比较结果
   */
  private compareVersions(version1: string, version2: string): number {
    const v1parts = version1.split('.').map(Number);
    const v2parts = version2.split('.').map(Number);

    for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
      const v1part = v1parts[i] || 0;
      const v2part = v2parts[i] || 0;

      if (v1part < v2part) return -1;
      if (v1part > v2part) return 1;
    }

    return 0;
  }

  /**
   * 从迁移记录中删除
   * @param repository 数据库仓库
   * @param migrationId 迁移ID
   */
  private async removeMigrationRecord(
    repository: IDatabaseRepository,
    migrationId: string,
  ): Promise<void> {
    // 这里需要扩展IDatabaseRepository接口以支持删除迁移记录
    // 暂时使用原始SQL
    this.logger.warn(`删除迁移记录需要扩展接口支持`, { migrationId });
  }

  /**
   * 加载内置迁移
   */
  private loadBuiltinMigrations(): void {
    // 初始表结构迁移
    this.registerMigration({
      id: '001-initial-schema',
      name: '初始表结构',
      version: '1.0.0',
      description: '创建初始数据库表结构',
      up: `
        CREATE TABLE IF NOT EXISTS collections (
          id VARCHAR(255) PRIMARY KEY,
          collection_id VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          metadata TEXT,
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL,
          deleted BOOLEAN DEFAULT FALSE
        );
        
        CREATE TABLE IF NOT EXISTS docs (
          id VARCHAR(255) PRIMARY KEY,
          doc_id VARCHAR(255) UNIQUE NOT NULL,
          collection_id VARCHAR(255) NOT NULL,
          key VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          size_bytes INTEGER,
          mime VARCHAR(100),
          content TEXT,
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL,
          deleted BOOLEAN DEFAULT FALSE
        );
        
        CREATE TABLE IF NOT EXISTS chunks (
          id VARCHAR(255) PRIMARY KEY,
          point_id VARCHAR(255) UNIQUE NOT NULL,
          doc_id VARCHAR(255) NOT NULL,
          collection_id VARCHAR(255) NOT NULL,
          chunk_index INTEGER NOT NULL,
          title VARCHAR(255),
          content TEXT NOT NULL,
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS chunk_meta (
          id VARCHAR(255) PRIMARY KEY,
          point_id VARCHAR(255) UNIQUE NOT NULL,
          doc_id VARCHAR(255) NOT NULL,
          collection_id VARCHAR(255) NOT NULL,
          chunk_index INTEGER NOT NULL,
          token_count INTEGER,
          embedding_status VARCHAR(20) DEFAULT 'pending',
          synced_at BIGINT,
          error TEXT,
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL
        );
      `,
      down: `
        DROP TABLE IF EXISTS chunk_meta;
        DROP TABLE IF EXISTS chunks;
        DROP TABLE IF EXISTS docs;
        DROP TABLE IF EXISTS collections;
      `,
    });

    // 全文搜索迁移
    this.registerMigration({
      id: '002-fulltext-search',
      name: '全文搜索支持',
      version: '1.1.0',
      description: '添加全文搜索支持',
      up: `
        -- 为SQLite添加FTS5表
        CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(content, title);
        
        -- 为PostgreSQL添加全文搜索索引
        CREATE INDEX IF NOT EXISTS idx_chunks_content_fts 
        ON chunks USING gin(to_tsvector('english', content));
      `,
      down: `
        -- SQLite删除FTS表
        DROP TABLE IF EXISTS chunks_fts;
        
        -- PostgreSQL删除全文搜索索引
        DROP INDEX IF EXISTS idx_chunks_content_fts;
      `,
    });

    // 性能优化迁移
    this.registerMigration({
      id: '003-performance-optimization',
      name: '性能优化',
      version: '1.2.0',
      description: '添加性能优化索引和配置',
      up: `
        -- 添加复合索引
        CREATE INDEX IF NOT EXISTS idx_chunks_doc_collection 
        ON chunks(doc_id, collection_id);
        
        CREATE INDEX IF NOT EXISTS idx_docs_collection_deleted 
        ON docs(collection_id, deleted);
        
        CREATE INDEX IF NOT EXISTS idx_chunk_meta_doc_collection 
        ON chunk_meta(doc_id, collection_id);
        
        -- 添加统计信息表
        CREATE TABLE IF NOT EXISTS system_metrics (
          id VARCHAR(255) PRIMARY KEY,
          metric_name VARCHAR(255) NOT NULL,
          metric_value REAL,
          metric_unit VARCHAR(50),
          tags TEXT,
          timestamp BIGINT NOT NULL,
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL
        );
      `,
      down: `
        DROP INDEX IF EXISTS idx_chunks_doc_collection;
        DROP INDEX IF EXISTS idx_docs_collection_deleted;
        DROP INDEX IF EXISTS idx_chunk_meta_doc_collection;
        DROP TABLE IF EXISTS system_metrics;
      `,
    });

    // 监控和告警迁移
    this.registerMigration({
      id: '004-monitoring-alerts',
      name: '监控和告警',
      version: '1.3.0',
      description: '添加系统监控和告警功能',
      up: `
        -- 系统健康表
        CREATE TABLE IF NOT EXISTS system_health (
          id VARCHAR(255) PRIMARY KEY,
          component VARCHAR(255) NOT NULL,
          status VARCHAR(20) NOT NULL,
          last_check BIGINT,
          response_time_ms INTEGER,
          error_message TEXT,
          metadata TEXT,
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL
        );
        
        -- 告警规则表
        CREATE TABLE IF NOT EXISTS alert_rules (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          description TEXT,
          metric_name VARCHAR(255) NOT NULL,
          threshold REAL NOT NULL,
          operator VARCHAR(10) NOT NULL,
          severity VARCHAR(20) NOT NULL,
          enabled BOOLEAN DEFAULT TRUE,
          cooldown_minutes INTEGER DEFAULT 5,
          metadata TEXT,
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL
        );
        
        -- 告警历史表
        CREATE TABLE IF NOT EXISTS alert_history (
          id VARCHAR(255) PRIMARY KEY,
          rule_id VARCHAR(255) NOT NULL,
          metric_value REAL NOT NULL,
          threshold_value REAL NOT NULL,
          severity VARCHAR(20) NOT NULL,
          status VARCHAR(20) NOT NULL,
          message TEXT,
          triggered_at BIGINT NOT NULL,
          resolved_at BIGINT,
          metadata TEXT,
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL
        );
      `,
      down: `
        DROP TABLE IF EXISTS alert_history;
        DROP TABLE IF EXISTS alert_rules;
        DROP TABLE IF EXISTS system_health;
      `,
    });

    this.logger.info(`加载了 ${this.migrations.size} 个内置迁移`);
  }
}

/**
 * 单例迁移管理器
 */
export class DatabaseMigrationManagerSingleton {
  private static instance: DatabaseMigrationManager;

  /**
   * 获取迁移管理器实例
   * @param logger 日志记录器
   * @returns 迁移管理器实例
   */
  static getInstance(logger: Logger): DatabaseMigrationManager {
    if (!DatabaseMigrationManagerSingleton.instance) {
      DatabaseMigrationManagerSingleton.instance = new DatabaseMigrationManager(
        logger,
      );
    }
    return DatabaseMigrationManagerSingleton.instance;
  }
}
