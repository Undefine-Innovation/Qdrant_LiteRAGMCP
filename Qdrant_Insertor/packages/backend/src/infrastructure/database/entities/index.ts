/**
 * TypeORM实体导出文件
 * 统一导出所有数据库实体
 */

/**
 * 基础实体类，包含通用字段
 */
export { BaseEntity } from './BaseEntity.js';

/**
 * 集合实体
 */
export { Collection } from './Collection.js';

/**
 * 文档实体
 */
export { Doc } from './Doc.js';

/**
 * 块实体
 */
export { Chunk } from './Chunk.js';

/**
 * 块全文搜索实体
 */
export { ChunkFullText } from './ChunkFullText.js';

/**
 * 块元数据实体
 */
export { ChunkMeta } from './ChunkMeta.js';

/**
 * 同步作业实体
 */
export { SyncJobEntity } from './SyncJob.js';

/**
 * 系统指标实体
 */
export { SystemMetrics } from './SystemMetrics.js';

/**
 * 告警规则实体
 */
export { AlertRules } from './AlertRules.js';

/**
 * 告警历史实体
 */
export { AlertHistory } from './AlertHistory.js';

/**
 * 系统健康实体
 */
export { SystemHealth } from './SystemHealth.js';

/**
 * 爬虫结果实体
 */
export { ScrapeResults } from './ScrapeResults.js';

/**
 * 事件实体
 */
export { Event } from './Event.js';

/**
 * 所有实体数组，用于TypeORM配置（动态导入用）
 * 注意：TypeORM 配置已使用 glob 模式自动加载实体，该数组主要用于兼容性
 */
export const allEntities = [
  'BaseEntity',
  'Collection',
  'Doc',
  'Chunk',
  'ChunkFullText',
  'ChunkMeta',
  'SyncJobEntity',
  'SystemMetrics',
  'AlertRules',
  'AlertHistory',
  'SystemHealth',
  'ScrapeResults',
  'Event',
];
