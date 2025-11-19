/**
 * 查询缓存相关模块重导出
 * 提供数据库查询缓存功能，包括缓存管理、失效策略和仓储基类
 */
export {
  QueryCache,
  CacheInvalidation,
  CachedRepositoryBase,
  QueryCacheManager,
  DEFAULT_QUERY_CACHE_CONFIG,
} from '../../cache/QueryCache.js';

/**
 * 查询缓存配置类型
 */
export type { QueryCacheConfig } from '../../cache/QueryCache.js';
