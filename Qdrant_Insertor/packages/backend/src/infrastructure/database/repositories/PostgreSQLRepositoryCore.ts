/**
 * PostgreSQL仓库核心功能
 * 包含核心连接管理和健康检查功能
 */

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
 * PostgreSQL仓库核心功能
 * 包含核心连接管理和健康检查功能
 */
export class PostgreSQLRepositoryCore {
  // 性能监控
  protected queryCount = 0;
  protected totalQueryTime = 0;
  protected slowQueryCount = 0;
  protected lastHealthCheck = 0;
  protected connectionStartTime = 0;

  /**
   * 创建PostgreSQLRepositoryCore实例
   * @param dataSource TypeORM数据源
   * @param config 数据库配置
   * @param logger 日志记录器
   */
  constructor(
    protected readonly dataSource: DataSource,
    protected readonly config: DatabaseConfig,
    protected readonly logger: Logger,
  ) {
    this.connectionStartTime = Date.now();
  }

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
      logger.info('正在初始化PostgreSQL数据库连接...');

      if (!this.dataSource.isInitialized) {
        await this.dataSource.initialize();
      }

      // 测试连接
      await this.dataSource.query('SELECT 1');

      // 执行数据库特定的初始化
      await this.performDatabaseInitialization();

      logger.info('PostgreSQL数据库连接初始化成功');

      return {
        success: true,
        message: 'PostgreSQL数据库初始化成功',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('PostgreSQL数据库初始化失败', {
        error: errorMessage,
      });

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
      if (!this.dataSource.isInitialized) {
        return false;
      }

      const startTime = Date.now();
      await this.dataSource.query('SELECT 1');
      const responseTime = Date.now() - startTime;

      this.lastHealthCheck = Date.now();
      return responseTime < 5000; // 5秒内响应视为健康
    } catch (error) {
      this.logger.warn('PostgreSQL数据库ping检查失败', {
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
    const startTime = Date.now();
    let status = DatabaseConnectionStatus.CONNECTED;
    let responseTime: number | undefined;
    let error: string | undefined;

    try {
      if (!this.dataSource.isInitialized) {
        status = DatabaseConnectionStatus.DISCONNECTED;
        error = '数据库未初始化';
      } else {
        await this.dataSource.query('SELECT 1');
        responseTime = Date.now() - startTime;
        status =
          responseTime < 5000
            ? DatabaseConnectionStatus.CONNECTED
            : DatabaseConnectionStatus.ERROR;
      }
    } catch (err) {
      status = DatabaseConnectionStatus.ERROR;
      error = err instanceof Error ? err.message : String(err);
    }

    return {
      status,
      lastCheckTime: Date.now(),
      responseTime,
      error,
      performanceMetrics: {
        averageQueryTime:
          this.queryCount > 0 ? this.totalQueryTime / this.queryCount : 0,
        slowQueryCount: this.slowQueryCount,
        totalQueries: this.queryCount,
      },
    };
  }

  /**
   * 获取数据库性能指标
   * @returns 性能指标
   */
  async getPerformanceMetrics(): Promise<DatabasePerformanceMetrics> {
    try {
      const dbMetrics = await this.getDatabaseSpecificMetrics();

      return {
        databaseType: DatabaseType.POSTGRESQL,
        connectionTime:
          this.connectionStartTime > 0
            ? Date.now() - this.connectionStartTime
            : 0,
        queryTime:
          this.queryCount > 0 ? this.totalQueryTime / this.queryCount : 0,
        transactionTime: 0, // 需要额外实现事务时间统计
        ...dbMetrics,
      };
    } catch (error) {
      this.logger.error('获取PostgreSQL性能指标失败', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        databaseType: DatabaseType.POSTGRESQL,
        connectionTime: 0,
        queryTime: 0,
        transactionTime: 0,
      };
    }
  }

  /**
   * 在数据库事务中执行一个函数
   * @param fn 包含数据库操作的函数
   * @returns 事务函数的返回值
   */
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await this.dataSource.transaction(async (manager) => {
        // 在事务中执行函数
        return await fn();
      });

      const queryTime = Date.now() - startTime;
      this.recordQueryTime(queryTime);

      return result;
    } catch (error) {
      this.logger.error('PostgreSQL事务执行失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 执行原生SQL查询
   * @param query SQL查询语句
   * @param parameters 查询参数
   * @returns 查询结果
   */
  async query(query: string, parameters?: unknown[]): Promise<Record<string, unknown>[]> {
    const startTime = Date.now();
    try {
      const result = (await this.dataSource.query(query, parameters)) as Array<Record<string, unknown>>;
      const queryTime = Date.now() - startTime;
      this.recordQueryTime(queryTime);

      return result;
    } catch (error) {
      this.logger.error('执行PostgreSQL原生SQL查询失败', {
        error: error instanceof Error ? error.message : String(error),
        query,
        parameters,
      });
      throw error;
    }
  }

  /**
   * 执行原生SQL查询并返回单个结果
   * @param query SQL查询语句
   * @param parameters 查询参数
   * @returns 查询结果
   */
  async queryOne(query: string, parameters?: unknown[]): Promise<Record<string, unknown> | undefined> {
    const startTime = Date.now();
    try {
      const result = (await this.dataSource.query(query, parameters)) as Array<Record<string, unknown>>;
      const queryTime = Date.now() - startTime;
      this.recordQueryTime(queryTime);

      return Array.isArray(result) && result.length > 0 ? result[0] : undefined;
    } catch (error) {
      this.logger.error('执行PostgreSQL原生SQL查询失败', {
        error: error instanceof Error ? error.message : String(error),
        query,
        parameters,
      });
      throw error;
    }
  }

  /**
   * 记录查询时间
   * @param queryTime 查询时间
   */
  protected recordQueryTime(queryTime: number): void {
    this.queryCount++;
    this.totalQueryTime += queryTime;

    const slowQueryThreshold = 1000; // 使用默认值，因为DatabaseConfig中没有slowQueryThreshold属性
    if (queryTime > slowQueryThreshold) {
      this.slowQueryCount++;
    }
  }

  /**
   * 执行数据库特定的初始化
   */
  protected async performDatabaseInitialization(): Promise<void> {
    // 这里可以添加PostgreSQL特定的初始化逻辑
    // 例如：设置连接池参数、创建扩展等
    this.logger.debug('执行PostgreSQL特定初始化');
  }

  /**
   * 获取数据库特定的性能指标
   * @returns 数据库特定的性能指标
   */
  protected async getDatabaseSpecificMetrics(): Promise<
    Partial<DatabasePerformanceMetrics>
  > {
    try {
      // 获取数据库大小
      const sizeResult = (await this.dataSource.query(`
        SELECT pg_database_size(current_database()) as size
      `)) as Array<Record<string, unknown>>;
      const diskUsage = parseInt(String(sizeResult[0]?.size ?? '0'));

      // 获取连接池指标
      const poolResult = (await this.dataSource.query(`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections,
          count(*) FILTER (WHERE wait_event_type = 'Lock') as waiting_clients
        FROM pg_stat_activity
        WHERE datname = current_database()
      `)) as Array<Record<string, unknown>>;
      const poolMetrics = {
        totalConnections: parseInt(String(poolResult[0]?.total_connections ?? '0')),
        activeConnections: parseInt(String(poolResult[0]?.active_connections ?? '0')),
        idleConnections: parseInt(String(poolResult[0]?.idle_connections ?? '0')),
        waitingClients: parseInt(String(poolResult[0]?.waiting_clients ?? '0')),
      };

      return {
        diskUsage,
      };
    } catch (error) {
      this.logger.warn('获取PostgreSQL特定性能指标失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {};
    }
  }

  /**
   * 重置性能统计
   */
  resetPerformanceStats(): void {
    this.queryCount = 0;
    this.totalQueryTime = 0;
    this.slowQueryCount = 0;
    this.lastHealthCheck = 0;
    this.connectionStartTime = Date.now();
  }

  /**
   * 获取连接池状态
   * @returns 连接池状态
   */
  async getConnectionPoolStatus(): Promise<{
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    waitingClients: number;
  }> {
    try {
      const result = (await this.dataSource.query(`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections,
          count(*) FILTER (WHERE wait_event_type = 'Lock') as waiting_clients
        FROM pg_stat_activity
        WHERE datname = current_database()
      `)) as Array<Record<string, unknown>>;

      return {
        totalConnections: parseInt(String(result[0]?.total_connections ?? '0')),
        activeConnections: parseInt(String(result[0]?.active_connections ?? '0')),
        idleConnections: parseInt(String(result[0]?.idle_connections ?? '0')),
        waitingClients: parseInt(String(result[0]?.waiting_clients ?? '0')),
      };
    } catch (error) {
      this.logger.warn('获取PostgreSQL连接池状态失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        totalConnections: 0,
        activeConnections: 0,
        idleConnections: 0,
        waitingClients: 0,
      };
    }
  }

  /**
   * 获取数据库版本信息
   * @returns 版本信息
   */
  async getDatabaseVersion(): Promise<{
    version: string;
    postgresVersion: string;
  }> {
    try {
      const result = (await this.dataSource.query('SELECT version()')) as Array<Record<string, unknown>>;
      const versionResult = (await this.dataSource.query('SELECT version()')) as Array<Record<string, unknown>>;

      return {
        version: String(result[0]?.version ?? 'unknown'),
        postgresVersion: String(versionResult[0]?.version ?? 'unknown'),
      };
    } catch (error) {
      this.logger.warn('获取PostgreSQL数据库版本信息失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        version: 'unknown',
        postgresVersion: 'unknown',
      };
    }
  }

  /**
   * 获取数据库统计信息
   * @returns 统计信息
   */
  async getDatabaseStats(): Promise<{
    totalTables: number;
    totalIndexes: number;
    totalSize: string;
  }> {
    try {
      // 获取表数量
      const tablesResult = (await this.dataSource.query(`
        SELECT count(*) as total_tables
        FROM information_schema.tables
        WHERE table_schema = 'public'
      `)) as Array<Record<string, unknown>>;
      const totalTables = parseInt(String(tablesResult[0]?.total_tables ?? '0'));

      // 获取索引数量
      const indexesResult = (await this.dataSource.query(`
        SELECT count(*) as total_indexes
        FROM pg_indexes
        WHERE schemaname = 'public'
      `)) as Array<Record<string, unknown>>;
      const totalIndexes = parseInt(String(indexesResult[0]?.total_indexes ?? '0'));

      // 获取数据库大小
      const sizeResult = (await this.dataSource.query(`
        SELECT pg_database_size(current_database()) as size
      `)) as Array<Record<string, unknown>>;
      const totalSize = String(sizeResult[0]?.size ?? '0');

      return {
        totalTables,
        totalIndexes,
        totalSize,
      };
    } catch (error) {
      this.logger.warn('获取PostgreSQL数据库统计信息失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        totalTables: 0,
        totalIndexes: 0,
        totalSize: '0',
      };
    }
  }
}
