import { Logger } from '@logging/logger.js';
import { DatabaseConfig } from '@domain/interfaces/IDatabaseRepository.js';

/**
 * PostgreSQL性能指标处理器
 * 负责收集PostgreSQL特定的性能指标
 */
export class PostgreSQLMetrics {
  constructor(
    private readonly config: DatabaseConfig,
    private readonly logger: Logger,
    private readonly query: (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>,
  ) {}

  /**
   * 获取数据库特定的性能指标
   * @returns 数据库性能指标
   */
  async getDatabaseSpecificMetrics(): Promise<{
    memoryUsage?: number;
    diskUsage?: number;
    indexUsage?: number;
    cacheHitRate?: number;
  }> {
    try {
      const metrics = await Promise.all([
        this.getDatabaseSize(),
        this.getIndexUsage(),
        this.getCacheHitRate(),
        this.getConnectionPoolMetrics(),
      ]);

      return {
        diskUsage: metrics[0],
        indexUsage: metrics[1],
        cacheHitRate: metrics[2],
        memoryUsage: metrics[3],
      };
    } catch (error) {
      this.logger.error('获取PostgreSQL性能指标失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {};
    }
  }

  /**
   * 获取数据库大小
   * @returns 数据库大小（字节）
   */
  private async getDatabaseSize(): Promise<number> {
    try {
      const result = await this.query('SELECT pg_database_size($1) as size', [
        this.config.database,
      ]);
      return parseInt(String(result[0]?.['size'] ?? '0'));
    } catch (error) {
      this.logger.error(`获取数据库大小失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

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
   * 获取缓存命中率
   * @returns {Promise<number>} 缓存命中率
   */
  private async getCacheHitRate(): Promise<number> {
    try {
      const result = await this.query(`
        SELECT 
          SUM(heap_blks_hit) as hits,
          SUM(heap_blks_read) as reads
        FROM pg_statio_user_tables
      `);

      const stats = result[0] as Record<string, unknown> | undefined;
      if (!stats) return 0;

      const hits = parseInt(String(stats['hits'] ?? '0'));
      const reads = parseInt(String(stats['reads'] ?? '0'));
      const total = hits + reads;

      return total > 0 ? hits / total : 0;
    } catch (error) {
      this.logger.error(`获取缓存命中率失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * 获取连接池指标
   * @returns 活跃连接数
   */
  private async getConnectionPoolMetrics(): Promise<number> {
    try {
      const result = await this.query(`
        SELECT count(*) as connections
        FROM pg_stat_activity
        WHERE state = 'active'
      `);

      return parseInt(String(result[0]?.['connections'] ?? '0'));
    } catch (error) {
      this.logger.error(`获取连接池指标失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * 获取索引大小
   * @returns 索引总大小（字节）
   */
  private async getIndexSize(): Promise<number> {
    try {
      const result = await this.query(`
        SELECT 
          SUM(pg_relation_size(indexrelid)) as size
        FROM pg_index
        WHERE schemaname = 'public'
      `);

      return parseInt(String(result[0]?.['size'] ?? '0'));
    } catch (error) {
      this.logger.error(`获取索引大小失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * 获取数据库统计信息
   * @returns 数据库统计信息
   */
  async getStatistics(): Promise<{
    totalCollections: number;
    totalDocuments: number;
    totalChunks: number;
    databaseSize: number;
    indexSize: number;
  }> {
    try {
      const [collections, documents, chunks, databaseSize, indexSize] =
        await Promise.all([
          this.query('SELECT COUNT(*) as count FROM collections'),
          this.query('SELECT COUNT(*) as count FROM docs'),
          this.query('SELECT COUNT(*) as count FROM chunks'),
          this.getDatabaseSize(),
          this.getIndexSize(),
        ]);

      return {
        totalCollections: parseInt(String(collections[0]?.['count'] ?? '0')),
        totalDocuments: parseInt(String(documents[0]?.['count'] ?? '0')),
        totalChunks: parseInt(String(chunks[0]?.['count'] ?? '0')),
        databaseSize: databaseSize || 0,
        indexSize: indexSize || 0,
      };
    } catch (error) {
      this.logger.error(`获取PostgreSQL统计信息失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
