import express from 'express';
import { IImportService } from '@domain/repositories/IImportService.js';
import { ISearchService } from '@domain/repositories/ISearchService.js';
import { IGraphService } from '@domain/entities/graph.js';
import { ICollectionService } from '@domain/repositories/ICollectionService.js';
import { IDocumentService } from '@domain/repositories/IDocumentService.js';
import { IFileProcessingService } from '@domain/repositories/IFileProcessingService.js';
import { IBatchService } from '@domain/repositories/IBatchService.js';
import { MonitoringApiService } from '@application/services/MonitoringApiService.js';
import { IMonitoringApiService } from '@domain/repositories/IMonitoringApiService.js';
import { createCollectionRoutes } from './collections.js';
import { createDocumentRoutes } from './documents.js';
import { createSearchRoutes } from './search.js';
import { createGraphRoutes } from './graph.js';
import { createPreviewRoutes } from './preview.js';
import { createCommonRoutes } from './common.js';
import { createBatchRoutes } from './batch.js';
import { createMonitoringRoutes } from '@api/monitoring.js';
import { IScrapeService } from '@domain/entities/scrape.js';
import { Logger } from '@logging/logger.js';
import { createScrapeRoutes } from './scrape.js';

/**
 * @interface ApiServices
 * API 层所需的应用服务接口集合，遵循依赖倒置原则
 */
interface ApiServices {
  importService: IImportService;
  searchService: ISearchService;
  graphService: IGraphService;
  collectionService: ICollectionService;
  documentService: IDocumentService;
  fileProcessingService: IFileProcessingService;
  batchService: IBatchService;
  scrapeService: IScrapeService;
  logger: Logger;
  stateMachineService?: {
    getEngine: () => unknown;
  };
  monitoringApiService?: MonitoringApiService;
}

/**
 * @function createApiRouter
 * 创建并配置Express API 路由器
 *   此函数作�?Express 控制器层，负责接收请求、解构参数、调用应用服务、封装响应�?
 *   它不包含任何业务逻辑，也不应包含 try...catch 块，错误将由全局错误处理中间件统一处理�?
 * @param {ApiServices} services - 包含所有必要应用服务实例的对象�?
 * @returns 配置好的 Express 路由器实例
 */
export function createApiRouter(services: ApiServices): express.Router {
  const router = express.Router();

  // 通用路由
  router.use('/', createCommonRoutes());

  // 集合路由
  router.use('/', createCollectionRoutes(services.collectionService));

  // 文档路由
  router.use(
    '/',
    createDocumentRoutes(
      services.importService,
      services.collectionService,
      services.documentService,
    ),
  );

  // 搜索路由
  router.use('/', createSearchRoutes(services.searchService));

  // 图谱路由
  router.use('/', createGraphRoutes(services.graphService));

  // 预览和下载路�?
  router.use('/', createPreviewRoutes(services.fileProcessingService));

  // 批量操作路由
  router.use('/', createBatchRoutes(services.batchService));

  // 爬虫路由
  router.use(
    '/scrape',
    createScrapeRoutes(services.scrapeService, services.logger),
  );

  // 监控路由
  if (services.monitoringApiService) {
    router.use(
      '/monitoring',
      createMonitoringRoutes(services.monitoringApiService),
    );
  }

  return router;
}
