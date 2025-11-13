import express from 'express';
import { IImportService } from '@application/services/index.js';
import { ISearchService } from '@application/services/index.js';
import { IGraphService } from '@domain/entities/index.js';
import { ICollectionService } from '@application/services/index.js';
import { IDocumentService } from '@application/services/index.js';
import { IFileProcessingService } from '@application/services/index.js';
import { IBatchService } from '@application/services/index.js';
import { IMonitoringService } from '@application/services/index.js';
import { MonitoringApiService } from '@application/services/api/index.js';
import { IMonitoringApiService } from '@domain/repositories/IMonitoringApiService.js';
import { IScrapeService } from '@domain/entities/index.js';
import { IImportAndIndexUseCase } from '@application/use-cases/index.js';
import { Logger } from '@infrastructure/logging/index.js';
import {
  createGraphRoutes,
  createCollectionRoutes,
  createDocumentRoutes,
  createBatchRoutes,
  createSearchRoutes,
  createScrapeRoutes,
  createPreviewRoutes,
  createCommonRoutes,
  createMonitoringApiRoutes,
} from '@api/routes/index.js';

/**
 * @interface ApiServices
 * @description API 层所需的应用服务接口集合，遵循依赖倒置原则
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
  importAndIndexUseCase: IImportAndIndexUseCase;
  logger: Logger;
  stateMachineService?: {
    getEngine: () => unknown;
  };
  monitoringApiService?:
    | IMonitoringApiService
    | MonitoringApiService
    | undefined;
  typeormRepo: Record<string, unknown>; // TypeORMRepository will be imported dynamically
}

/**
 * @function createApiRouter
 * @description 创建并配置Express API路由器
 *   此函数作为Express控制器层，负责接收请求、解构参数、调用应用服务、封装响应
 *   它不包含任何业务逻辑，也不应包含 try...catch 块，错误将由全局错误处理中间件统一处理
 * @param {ApiServices} services - 包含所有必要应用服务实例的对象
 * @returns {express.Router} 配置好的 Express 路由实例
 */
export { createGraphRoutes };

/**
 * @description 重新导出ApiServices接口供其他模块使用
 */
export type { ApiServices };

/**
 * @function createApiRouter
 * @description 创建并配置Express API路由器
 * @param {ApiServices} services - 包含所有必要应用服务实例的对象
 * @returns {express.Router} 配置好的 Express 路由实例
 */
export function createApiRouter(services: ApiServices): express.Router {
  const router = express.Router();

  // 注册批量处理路由 (必须在 documents 和 collections 路由之前注册，避免被参数化路由拦截)
  router.use(createBatchRoutes(services.batchService));

  // 注册集合管理路由 (已包含 /collections 前缀)
  router.use(createCollectionRoutes(services.collectionService));

  // 注册文档管理路由 (已包含 /docs 前缀)
  router.use(
    createDocumentRoutes(
      services.importService,
      services.collectionService,
      services.documentService,
      services.importAndIndexUseCase,
    ),
  );

  // 注册搜索路由 (添加 /search 前缀)
  router.use(
    '/search',
    createSearchRoutes(services.searchService, services.logger),
  );

  // 注册爬虫路由 (已包含 /scrape 前缀)
  router.use(createScrapeRoutes(services.scrapeService, services.logger));

  // 注册预览路由 (已包含 /preview 前缀)
  router.use(createPreviewRoutes(services.fileProcessingService));

  // 注册图谱路由 (已包含 /graph 前缀)
  router.use(createGraphRoutes(services.graphService));

  // 注册监控路由 (添加 /monitoring 前缀)
  if (services.monitoringApiService) {
    router.use(
      '/monitoring',
      createMonitoringApiRoutes(services.monitoringApiService),
    );
  }

  // 注册通用路由（健康检查等）(已包含 /health 前缀)
  router.use(createCommonRoutes());

  services.logger.info('所有API路由已注册');

  return router;
}
