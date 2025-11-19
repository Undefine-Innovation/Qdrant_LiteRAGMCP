/**
 * 领域服务模块主导出文件
 * 导出所有纯粹的领域服务（不包含基础设施依赖）
 */

// 核心领域服务
export type { ICollectionManagementService } from './CollectionManagementService.js';
export { CollectionManagementService } from './CollectionManagementService.js';

export type { IDocumentProcessingService } from './DocumentProcessingService.js';
export { DocumentProcessingService } from './DocumentProcessingService.js';

export type { IEmbeddingGenerationService } from './EmbeddingGenerationService.js';
export { EmbeddingGenerationService } from './EmbeddingGenerationService.js';

export type { ISearchDomainService } from './SearchService.js';
export { SearchDomainService } from './SearchService.js';

// 搜索相关类型
export * from './SearchTypes.js';

// 事件系统服务（领域逻辑部分）
export {
  EventSystemService,
  EventSystemServiceFactory,
} from './EventSystemService.js';

// 限流相关服务
export { RateLimiterFactory, RateLimitStrategy } from './RateLimitStrategy.js';
export { RateLimitMetrics } from './RateLimitMetrics.js';
export { TokenBucketRateLimiter } from './TokenBucketRateLimiter.js';

// 值对象示例服务
export { ValueObjectExampleService } from './ValueObjectExampleService.js';

// 注意：以下服务已移至application层，因为它们包含应用逻辑
// - fileProcessor, loader, splitter, stream-loader 等文件处理服务
// 这些服务现在位于 application/services/file-processing/ 目录下
