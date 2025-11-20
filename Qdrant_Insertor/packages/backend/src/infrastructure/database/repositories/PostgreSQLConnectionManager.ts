import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import {
  DatabaseConfig,
  DatabaseHealthStatus,
  DatabaseConnectionStatus,
  DatabasePerformanceMetrics,
  DatabaseType,
} from '@domain/interfaces/IDatabaseRepository.js';

/**
 * PostgreSQL连接管理器
 * 负责数据库连接、健康检查和性能监控
 */
export class PostgreSQLConnectionManager {
  /**
   * 创建PostgreSQLConnectionManager实例
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
   * 初始化数据库连接
   * @param logger 日志记录器
   * @returns 初始化结果
   */
  async initialize(logger: Logger): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    try {
      // 测试连接
      await this.dataSource.query('SELECT 1');

      // 创建必要的索引
      await this.createIndexes();

      // 创建全文搜索表
      await this.createFullTextSearchTables();

      logger.info('PostgreSQL数据库初始化成功');
      return {
        success: true,
        message: 'PostgreSQL数据库初始化成功',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('PostgreSQL数据库初始化失败', { error: errorMessage });
      return {
        success: false,
        message: 'PostgreSQL数据库初始化失败',
        error: errorMessage,
      };
    }
  }

  /**
   * 关闭数据库连接
   * @returns 关闭结果
   */
  async close(): Promise<void> {
    try {
      if (this.dataSource.isInitialized) {
        await this.dataSource.destroy();
        this.logger.info('PostgreSQL数据库连接已关闭');
      }
    } catch (error) {
      this.logger.error('关闭PostgreSQL数据库连接失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 检查数据库连接是否健康
   * @returns 健康状态
   */
  async ping(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch (error) {
      this.logger.error('PostgreSQL数据库ping失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * 获取数据库健康状态
   * @returns 健康状态详情
   */
  async getHealthStatus(): Promise<DatabaseHealthStatus> {
    try {
      const isConnected = await this.ping();
      const connectionStatus = isConnected
        ? DatabaseConnectionStatus.CONNECTED
        : DatabaseConnectionStatus.DISCONNECTED;

      // 获取连接池状态
      const poolStatus = await this.getConnectionPoolStatus();

      return {
        status: connectionStatus,
        connected: isConnected,
        lastCheck: new Date(),
        lastCheckTime: Date.now(),
        connectionPool: {
          totalConnections: poolStatus.totalConnections,
          activeConnections: poolStatus.activeConnections,
          idleConnections: poolStatus.idleConnections,
          waitingClients: poolStatus.waitingClients,
          idleInTransaction: poolStatus.idleInTransaction,
        },
      };
    } catch (error) {
      this.logger.error('获取PostgreSQL数据库健康状态失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        status: DatabaseConnectionStatus.ERROR,
        connected: false,
        lastCheck: new Date(),
        lastCheckTime: Date.now(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 获取数据库性能指标
   * @returns 性能指标
   */
  async getPerformanceMetrics(): Promise<DatabasePerformanceMetrics> {
    try {
      const metrics = (await this.dataSource.query(`
        SELECT 
          datname as database_name,
          numbackends as active_connections,
          xact_commit as transactions_committed,
          xact_rollback as transactions_rolled_back,
          blks_read as blocks_read,
          blks_hit as blocks_hit,
          tup_returned as tuples_returned,
          tup_fetched as tuples_fetched,
          tup_inserted as tuples_inserted,
          tup_updated as tuples_updated,
          tup_deleted as tuples_deleted
        FROM pg_stat_database 
        WHERE datname = current_database()
      `)) as Array<Record<string, unknown>>;

      const metric = (metrics && metrics[0]) as Record<string, unknown> | undefined;
      const blocksHit = Number(metric?.['blocks_hit'] ?? 0);
      const blocksRead = Number(metric?.['blocks_read'] ?? 0);
      const hitRate = blocksHit > 0 ? (blocksHit / (blocksRead + blocksHit)) * 100 : 0;

      const activeConnections = Number(metric?.['active_connections'] ?? 0);
      const totalConnections = Number(
        metric?.['total_connections'] ?? metric?.['numbackends'] ?? activeConnections,
      );

      return {
        databaseType: DatabaseType.POSTGRESQL,
        connectionTime: 0,
        queryTime: 0,
        transactionTime: 0,
        activeConnections,
        totalConnections,
        idleConnections: 0,
        queryCount:
          Number(metric?.['transactions_committed'] ?? 0) +
          Number(metric?.['transactions_rolled_back'] ?? 0),
        averageQueryTime: 0,
        cacheHitRate: hitRate,
        memoryUsage: 0,
        diskUsage: await this.getDatabaseSize(),
        indexUsage: await this.getIndexSize(),
      };
    } catch (error) {
      this.logger.error('获取PostgreSQL性能指标失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 在数据库事务中执行一个函数
   * @param fn 包含数据库操作的函数
   * @returns 事务函数的返回值
   */
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await this.dataSource.transaction(fn);
    } catch (error) {
      this.logger.error('PostgreSQL事务执行失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // === 私有辅助方法 ===

  /**
   * 创建必要的索引
   */
  private async createIndexes(): Promise<void> {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_docs_collection_id ON docs(collectionId)',
      'CREATE INDEX IF NOT EXISTS idx_docs_doc_id ON docs(docId)',
      'CREATE INDEX IF NOT EXISTS idx_docs_status ON docs(status)',
      'CREATE INDEX IF NOT EXISTS idx_docs_deleted ON docs(deleted)',
      'CREATE INDEX IF NOT EXISTS idx_chunks_doc_id ON chunks(docId)',
      'CREATE INDEX IF NOT EXISTS idx_chunks_collection_id ON chunks(collectionId)',
      'CREATE INDEX IF NOT EXISTS idx_chunks_point_id ON chunks(pointId)',
      'CREATE INDEX IF NOT EXISTS idx_chunk_meta_doc_id ON chunk_meta(docId)',
      'CREATE INDEX IF NOT EXISTS idx_chunk_meta_collection_id ON chunk_meta(collectionId)',
    ];

    for (const indexSql of indexes) {
      try {
        await this.dataSource.query(indexSql);
      } catch (error) {
        this.logger.warn('创建索引失败', {
          indexSql,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * 创建全文搜索表
   */
  private async createFullTextSearchTables(): Promise<void> {
    try {
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS chunk_fulltext (
          pointId VARCHAR(255) PRIMARY KEY,
          docId VARCHAR(255) NOT NULL,
          collectionId VARCHAR(255) NOT NULL,
          chunkIndex INTEGER NOT NULL,
          title TEXT,
          content TEXT,
          search_vector tsvector,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await this.dataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_chunk_fulltext_search_vector 
        ON chunk_fulltext USING gin(search_vector)
      `);

      // 创建触发器自动更新搜索向量
      await this.dataSource.query(`
        CREATE OR REPLACE FUNCTION update_chunk_fulltext_search_vector()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.search_vector := 
            setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
            setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'B');
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
      `);

      await this.dataSource.query(`
        DROP TRIGGER IF EXISTS trigger_update_chunk_fulltext_search_vector 
        ON chunk_fulltext
      `);

      await this.dataSource.query(`
        CREATE TRIGGER trigger_update_chunk_fulltext_search_vector
          BEFORE INSERT OR UPDATE ON chunk_fulltext
          FOR EACH ROW EXECUTE FUNCTION update_chunk_fulltext_search_vector()
      `);
    } catch (error) {
      this.logger.error('创建全文搜索表失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 获取连接池状态
   * @returns 连接池状态信息
   */
  private async getConnectionPoolStatus(): Promise<Record<string, number>> {
    try {
      const result = await this.dataSource.query(`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections,
          count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
        FROM pg_stat_activity
        WHERE datname = current_database()
      `);

      const row = result[0] as Record<string, unknown> | undefined;
      return {
        totalConnections: Number(row?.['total_connections'] ?? row?.['count'] ?? 0),
        activeConnections: Number(row?.['active_connections'] ?? 0),
        idleConnections: Number(row?.['idle_connections'] ?? 0),
        waitingClients: Number(row?.['waiting_clients'] ?? 0),
        idleInTransaction: Number(row?.['idle_in_transaction'] ?? 0),
      };
    } catch (error) {
      this.logger.error('获取连接池状态失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {} as Record<string, number>;
    }
  }

  /**
   * 获取数据库大小
   * @returns 数据库大小（字节）
   */
  private async getDatabaseSize(): Promise<number> {
    try {
      const result = await this.dataSource.query(`
        SELECT pg_database_size(current_database()) as size
      `);
      return parseInt(result[0]?.size || '0');
    } catch (error) {
      return 0;
    }
  }

  /**
   * 获取索引大小
   * @returns 索引大小（字节）
   */
  private async getIndexSize(): Promise<number> {
    try {
      const result = await this.dataSource.query(`
        SELECT 
          SUM(pg_relation_size(indexrelid)) as index_size
        FROM pg_index
        WHERE schemaname = 'public'
      `);
      return parseInt(result[0]?.index_size || '0');
    } catch (error) {
      return 0;
    }
  }
}
