import { Logger } from '@logging/logger.js';
import { DatabaseConfig } from '@domain/interfaces/IDatabaseRepository.js';

/**
 * PostgreSQL初始化处理器
 * 负责PostgreSQL特定的初始化操作
 */
export class PostgreSQLInitialization {
  constructor(
    private readonly config: DatabaseConfig,
    private readonly logger: Logger,
    private readonly query: (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>,
  ) {}

  /**
   * 执行数据库特定的初始化
   */
  async performDatabaseInitialization(): Promise<void> {
    try {
      // 创建PostgreSQL特定的扩展
      await this.createExtensions();

      // 创建PostgreSQL特定的索引
      await this.createIndexes();

      // 配置PostgreSQL特定的参数
      await this.configurePostgreSQLSettings();

      this.logger.info('PostgreSQL特定初始化完成');
    } catch (error) {
      this.logger.error('PostgreSQL初始化失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 创建PostgreSQL扩展
   */
  private async createExtensions(): Promise<void> {
    const extensions = [
      'pg_trgm', // 三元组扩展，用于模糊搜索
      'unaccent', // 去除重音符号
      'pg_stat_statements', // 查询统计
    ];

    for (const extension of extensions) {
      try {
        await this.query(`CREATE EXTENSION IF NOT EXISTS "${extension}"`);
        this.logger.debug(`创建PostgreSQL扩展成功`, { extension });
      } catch (error) {
        this.logger.warn(`创建PostgreSQL扩展失败`, {
          extension,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * 创建PostgreSQL特定的索引
   */
  private async createIndexes(): Promise<void> {
    const indexes = [
      // 全文搜索索引
      "CREATE INDEX IF NOT EXISTS idx_chunks_content_gin ON chunks USING gin(to_tsvector('english', content))",
      "CREATE INDEX IF NOT EXISTS idx_chunks_title_gin ON chunks USING gin(to_tsvector('english', title))",

      // 复合索引
      'CREATE INDEX IF NOT EXISTS idx_chunks_doc_collection ON chunks(doc_id, collection_id)',
      'CREATE INDEX IF NOT EXISTS idx_docs_collection_deleted ON docs(collection_id, deleted)',

      // 三元组索引（用于模糊搜索）
      'CREATE INDEX IF NOT EXISTS idx_chunks_content_trgm ON chunks USING gin(content gin_trgm_ops)',
      'CREATE INDEX IF NOT EXISTS idx_chunks_title_trgm ON chunks USING gin(title gin_trgm_ops)',
    ];

    for (const indexSql of indexes) {
      try {
        await this.query(indexSql);
        this.logger.debug(`创建PostgreSQL索引成功`, {
          index: indexSql.split('idx_')[1]?.split(' ')[0],
        });
      } catch (error) {
        this.logger.warn(`创建PostgreSQL索引失败`, {
          index: indexSql,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * 配置PostgreSQL特定参数
   */
  private async configurePostgreSQLSettings(): Promise<void> {
    const settings = [
      "SET work_mem = '64MB'", // 工作内存
      "SET maintenance_work_mem = '256MB'", // 维护工作内存
      "SET effective_cache_size = '1GB'", // 有效缓存大小
      'SET random_page_cost = 1.1', // 随机页面成本（SSD优化）
      'SET effective_io_concurrency = 200', // 有效IO并发数
    ];

    for (const setting of settings) {
      try {
        await this.query(setting);
        this.logger.debug(`配置PostgreSQL参数成功`, { setting });
      } catch (error) {
        this.logger.warn(`配置PostgreSQL参数失败`, {
          setting,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
