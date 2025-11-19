// Compatibility: re-export domain interface types into application namespace
// Use `export type` for interfaces to stay compatible with `isolatedModules`.
export type { IEmbeddingProvider } from '../../../domain/interfaces/embedding.js';
export type { SplitterOptions } from '../../../domain/interfaces/splitter.js';
export type {
  IDatabaseRepository,
  IDatabaseRepositoryFactory,
  DatabaseConfig,
  DatabaseType,
  DatabaseHealthStatus,
  DatabasePerformanceMetrics,
} from '../../../domain/interfaces/IDatabaseRepository.js';
export type {
  RateLimitResult,
  RateLimitConfig,
  IRateLimiter,
  IRateLimiterFactory,
  IRateLimitStrategy,
  IRateLimitMetrics,
  RateLimitStatistics,
} from '../../../domain/interfaces/IRateLimiter.js';
export type { ITransactionManager } from '../../../domain/interfaces/ITransactionManager.js';
