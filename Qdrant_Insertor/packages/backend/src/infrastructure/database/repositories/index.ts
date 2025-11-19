/**
 * Repository导出文件
 * 统一导出所有Repository实现和接口
 */

// 新的统一仓库架构
export { AbstractRepository } from './AbstractRepository.js';
export { DatabaseRepository } from './DatabaseRepository.js';
export {
  RepositoryFactory,
  RepositoryFactoryBuilder,
} from './RepositoryFactory.js';

/**
 * 基础Repository类，提供通用CRUD操作
 */
export { BaseRepository } from './BaseRepository.js';

/**
 * 统一Repository适配器
 */
export { UnifiedRepositoryAdapter } from './UnifiedRepositoryAdapter.js';

/**
 * Repository扩展
 */
export type { IRepositoryExtensions } from './extensions/RepositoryExtensions.js';
export { RepositoryExtensionFactory } from './extensions/RepositoryExtensions.js';

/**
 * 集合Repository，处理集合相关操作
 */
export { CollectionRepository } from './CollectionRepository.js';

/**
 * 文档Repository，处理文档相关操作
 */
export { DocRepository } from './DocRepository.js';

/**
 * 块Repository，处理块相关操作
 */
export { ChunkRepository } from './ChunkRepository.js';

/**
 * 块全文搜索Repository，处理PostgreSQL全文搜索相关操作
 */
export { ChunkFullTextRepository } from './ChunkFullTextRepository.js';

/**
 * 块元数据Repository，处理块元数据相关操作
 */
export { ChunkMetaRepository } from './ChunkMetaRepository.js';

// Sync job DB-backed repository and adapter removed — sync jobs are now in-memory

/**
 * 系统指标Repository，处理系统指标相关操作
 */
export { SystemMetricsRepository } from './SystemMetricsRepository.js';

/**
 * 告警规则Repository，处理告警规则相关操作
 */
export { AlertRulesRepository } from './AlertRulesRepository.js';

/**
 * 系统健康Repository，处理系统健康相关操作
 */
export { SystemHealthRepository } from './SystemHealthRepository.js';

/**
 * 告警历史Repository，处理告警历史相关操作
 */
export { AlertHistoryRepository } from './AlertHistoryRepository.js';

/**
 * 抓取结果Repository，处理抓取结果相关操作
 */
export { ScrapeResultsRepository } from './ScrapeResultsRepository.js';

/**
 * TypeORM主Repository，实现ISQLiteRepo接口
 */
export { TypeORMRepository } from './TypeORMRepository.js';

/**
 * TypeORM Repository 模块化组件
 */
export { TypeORMRepositoryCore } from './TypeORMRepositoryCore.js';
export { TypeORMRepositoryTransactions } from './TypeORMRepositoryTransactions.js';
export { TypeORMRepositoryCollections } from './TypeORMRepositoryCollections.js';
export { TypeORMRepositoryDocuments } from './TypeORMRepositoryDocuments.js';
export { TypeORMRepositoryChunks } from './TypeORMRepositoryChunks.js';
export { TypeORMRepositoryDatabase } from './TypeORMRepositoryDatabase.js';

/**
 * 集合聚合仓储，处理集合聚合相关操作
 */
export { CollectionAggregateRepository } from './CollectionAggregateRepository.js';

/**
 * 文档聚合仓储，处理文档聚合相关操作
 */
export { DocumentAggregateRepository } from './DocumentAggregateRepository.js';

/**
 * PostgreSQL关键词检索器
 */
export { PostgreSQLKeywordRetriever } from './PostgreSQLKeywordRetriever.js';

/**
 * 关键词检索器工厂
 */
export {
  KeywordRetrieverFactory,
  DatabaseType,
} from './KeywordRetrieverFactory.js';
