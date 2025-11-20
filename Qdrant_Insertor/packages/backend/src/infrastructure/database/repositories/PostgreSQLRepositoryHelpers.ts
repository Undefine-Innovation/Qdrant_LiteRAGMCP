import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { IKeywordRetriever } from '@domain/repositories/IKeywordRetriever.js';
import { PostgreSQLKeywordRetriever } from './PostgreSQLKeywordRetriever.js';

/**
 * PostgreSQL仓库辅助工具
 * 负责提供辅助功能和工具方法
 */
export class PostgreSQLRepositoryHelpers {
  /**
   * 创建PostgreSQLRepositoryHelpers实例
   * @param dataSource TypeORM数据源
   * @param logger 日志记录器
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: Logger,
  ) {}

  /**
   * 获取关键词检索器
   * @returns 关键词检索器实例
   */
  getKeywordRetriever(): IKeywordRetriever {
    return new PostgreSQLKeywordRetriever(this.dataSource, this.logger);
  }
}
