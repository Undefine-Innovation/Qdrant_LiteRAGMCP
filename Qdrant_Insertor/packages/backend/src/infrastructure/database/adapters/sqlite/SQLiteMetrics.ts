import { Logger } from '@logging/logger.js';
import { CollectionId, DocId, PointId } from '@domain/entities/types.js';

export class SQLiteMetrics {
  constructor(
    private readonly query: (sql: string, params?: unknown[]) => Promise<unknown>,
    private readonly logger: Logger,
  ) {}

  async getDatabaseSize(): Promise<number> {
    try {
      const result = await this.query(`
        SELECT page_count * page_size as size 
        FROM pragma_page_count(), pragma_page_size()
      `);
      const rows = result as Array<Record<string, unknown>>;
      return Number(rows[0]?.['size'] ?? 0);
    } catch (error) {
      this.logger.error(`获取数据库大小失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  async getIndexSize(): Promise<number> {
    try {
      const result = await this.query(`
        SELECT SUM(pgsize) as index_size 
        FROM pragma_index_list()
      `);
      const rows = result as Array<Record<string, unknown>>;
      return Number(rows[0]?.['index_size'] ?? 0);
    } catch (error) {
      this.logger.error(`获取索引大小失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  async getCacheHitRate(): Promise<number> {
    try {
      const result = await this.query(`
        SELECT cache_hit as hit_rate 
        FROM pragma_cache_status()
      `);
      const rows = result as Array<Record<string, unknown>>;
      return Number(rows[0]?.['hit_rate'] ?? 0);
    } catch (error) {
      this.logger.error(`获取缓存命中率失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  async getPageCacheStats(): Promise<{
    cacheSize: number;
    indexUsage: number;
  } | null> {
    try {
      const [cacheResult, indexResult] = (await Promise.all([
        this.query('PRAGMA cache_size'),
        this.query('PRAGMA index_list'),
      ])) as [Array<Record<string, unknown>>, Array<Record<string, unknown>>];

      return {
        cacheSize: Number(cacheResult[0]?.['cache_size'] ?? 0),
        indexUsage: indexResult.length,
      };
    } catch (error) {
      this.logger.error(`获取页面缓存统计失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async getStatistics(): Promise<{
    totalCollections: number;
    totalDocuments: number;
    totalChunks: number;
    databaseSize: number;
    indexSize: number;
  }> {
    try {
      const [collections, documents, chunks, databaseSize, indexSize] =
        (await Promise.all([
          this.query('SELECT COUNT(*) as count FROM collections'),
          this.query('SELECT COUNT(*) as count FROM docs'),
          this.query('SELECT COUNT(*) as count FROM chunks'),
          this.getDatabaseSize(),
          this.getIndexSize(),
        ])) as [Array<Record<string, unknown>>, Array<Record<string, unknown>>, Array<Record<string, unknown>>, number, number];

      return {
        totalCollections: Number(collections[0]?.['count'] ?? 0),
        totalDocuments: Number(documents[0]?.['count'] ?? 0),
        totalChunks: Number(chunks[0]?.['count'] ?? 0),
        databaseSize: databaseSize || 0,
        indexSize: indexSize || 0,
      };
    } catch (error) {
      this.logger.error(`获取SQLite统计信息失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
