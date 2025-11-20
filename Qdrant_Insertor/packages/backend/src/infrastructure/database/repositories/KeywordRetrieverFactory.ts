import { DataSource } from 'typeorm';
import { Logger } from '../../../infrastructure/logging/logger.js';
import { IKeywordRetriever } from '../../../domain/repositories/IKeywordRetriever.js';
import { PostgreSQLKeywordRetriever } from './PostgreSQLKeywordRetriever.js';

/**
 * 数据库类型枚举
 */
export enum DatabaseType {
  POSTGRESQL = 'postgresql',
  SQLITE = 'sqlite',
}

/**
 * 关键词检索器工厂
 * 根据数据库类型创建相应的关键词检索器实例
 * 注意：已弃用SQLite DAO支持，仅使用TypeORM
 */
export class KeywordRetrieverFactory {
  /**
   * 创建关键词检索器实例
   * @param dataSource TypeORM数据源
   * @param databaseType 数据库类型
   * @param logger 日志记录器
   * @returns 关键词检索器实例
   */
  static create(
    dataSource: DataSource,
    databaseType: DatabaseType,
    logger: Logger,
  ): IKeywordRetriever {
    switch (databaseType) {
      case DatabaseType.POSTGRESQL:
        return new PostgreSQLKeywordRetriever(dataSource, logger);

      default:
        // SQLite现在通过TypeORM处理
        return new PostgreSQLKeywordRetriever(dataSource, logger);
    }
  }

  /**
   * 自动检测数据库类型并创建相应的关键词检索器
   * @param dataSource TypeORM数据源
   * @param logger 日志记录器
   * @returns 关键词检索器实例
   */
  static createAuto(dataSource: DataSource, logger: Logger): IKeywordRetriever {
    if (!dataSource) {
      throw new Error('创建关键词检索器需要提供有效的DataSource');
    }

    const databaseType = this.detectDatabaseType(dataSource);
    return this.create(dataSource, databaseType, logger);
  }

  /**
   * 检测数据库类型
   * @param dataSource TypeORM数据源
   * @returns 数据库类型
   */
  private static detectDatabaseType(dataSource: DataSource): DatabaseType {
    const options = dataSource.options;

    // 检查是否为PostgreSQL
    if (options.type === 'postgres') {
      return DatabaseType.POSTGRESQL;
    }

    // 默认为SQLite（通过TypeORM）
    return DatabaseType.SQLITE;
  }

  /**
   * 创建PostgreSQL关键词检索器
   * @param dataSource TypeORM数据源
   * @param logger 日志记录器
   * @returns PostgreSQL关键词检索器实例
   */
  static createPostgreSQL(
    dataSource: DataSource,
    logger: Logger,
  ): IKeywordRetriever {
    return this.create(dataSource, DatabaseType.POSTGRESQL, logger);
  }

  /**
   * 检查数据库是否支持全文搜索
   * @param dataSource TypeORM数据源
   * @returns 是否支持全文搜索
   */
  static isFullTextSearchSupported(dataSource?: DataSource): boolean {
    try {
      if (!dataSource) {
        return false;
      }

      // PostgreSQL原生支持全文搜索
      const databaseType = this.detectDatabaseType(dataSource);
      return databaseType === DatabaseType.POSTGRESQL;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取数据库的全文搜索能力信息
   * @param dataSource TypeORM数据源
   * @returns 全文搜索能力信息
   */
  static getFullTextSearchCapabilities(dataSource?: DataSource): {
    supported: boolean;
    type: 'native' | 'extension' | 'none';
    features: string[];
    databaseType: DatabaseType | 'unknown';
  } {
    let databaseType: DatabaseType | 'unknown' = 'unknown';
    let supported = false;
    let type: 'native' | 'extension' | 'none' = 'none';
    const features: string[] = [];

    try {
      if (dataSource) {
        databaseType = this.detectDatabaseType(dataSource);

        if (databaseType === DatabaseType.POSTGRESQL) {
          supported = true;
          type = 'native';
          features.push(
            'full-text-search',
            'ranking',
            'highlighting',
            'multi-language',
            'fuzzy-search',
            'phrase-search',
          );
        }
      }
    } catch (error) {
      // 检测失败，保持默认值
    }

    return {
      supported,
      type,
      features,
      databaseType,
    };
  }
}
