/**
 * TypeORM Repository导出文件
 * 统一导出所有Repository实现
 */

/**
 * 基础Repository类，提供通用CRUD操作
 */
export { BaseRepository } from './BaseRepository.js';

/**
 * 简单基础Repository类，提供基础CRUD操作
 */
export { SimpleBaseRepository } from './SimpleBaseRepository.js';

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

/**
 * 同步任务Repository，处理同步任务相关操作
 */
export { SyncJobRepository } from './SyncJobRepository.js';

/**
 * SyncJobsTable适配器，将SyncJobRepository适配为SyncJobsTable接口
 */
export { SyncJobsTableAdapter } from './SyncJobsTableAdapter.js';

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
