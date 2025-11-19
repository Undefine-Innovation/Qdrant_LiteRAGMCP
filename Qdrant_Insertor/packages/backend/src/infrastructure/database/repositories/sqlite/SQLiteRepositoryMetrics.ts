import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { DatabasePerformanceMetrics } from '@domain/interfaces/IDatabaseRepository.js';

export class SQLiteRepositoryMetrics {
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: Logger,
  ) {}

  async getPerformanceMetrics(): Promise<Partial<DatabasePerformanceMetrics>> {
    try {
      const sizeResult = await this.dataSource.query(`
        SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()
      `);
      const diskUsage = parseInt(sizeResult[0]?.size || '0');

      // pragma_cache_status may not be available; best-effort
      let cacheHitRate = 0;
      try {
        const cacheResult = await this.dataSource.query(
          `SELECT cache_hit as hit_rate FROM pragma_cache_status()`,
        );
        cacheHitRate = parseFloat(cacheResult[0]?.hit_rate || '0');
      } catch (_) {
        // ignore
      }

      return {
        diskUsage,
        cacheHitRate,
      };
    } catch (error) {
      this.logger.error('获取SQLite性能指标失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {};
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
      const collectionsResult = await this.dataSource.query(
        'SELECT COUNT(*) as count FROM collections',
      );
      const documentsResult = await this.dataSource.query(
        'SELECT COUNT(*) as count FROM docs',
      );
      const chunksResult = await this.dataSource.query(
        'SELECT COUNT(*) as count FROM chunks',
      );

      const sizeResult = await this.dataSource.query(`
        SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()
      `);

      const indexResult = await this.dataSource.query(
        `SELECT SUM(pgsize) as index_size FROM pragma_index_list()`,
      );

      return {
        totalCollections: parseInt(collectionsResult[0]?.count || '0'),
        totalDocuments: parseInt(documentsResult[0]?.count || '0'),
        totalChunks: parseInt(chunksResult[0]?.count || '0'),
        databaseSize: parseInt(sizeResult[0]?.size || '0'),
        indexSize: parseInt(indexResult[0]?.index_size || '0'),
      };
    } catch (error) {
      this.logger.error(`获取SQLite统计信息失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
