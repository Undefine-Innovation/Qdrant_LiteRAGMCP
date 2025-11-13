/**
 * 仓储模块主导出文件
 * 导出所有仓储相关的接口（不包含实现）
 */

// 基础仓储接口
export * from './ISQLiteRepo.js';
export * from './IQdrantRepo.js';
export * from './IKeywordRetriever.js';
export * from './ITransactionManager.js';

// 聚合仓储接口
export * from './IAggregateRepository.js';

// 注意：以下接口已移至application层，因为它们是应用服务接口
// - ICollectionService, IDocumentService, ISearchService, IImportService
// - IFileProcessingService, IBatchService, IAlertService, IMonitoringService
// 这些接口现在位于 application/services/ 目录下
