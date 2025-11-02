import express from 'express';
import { IImportService } from '@domain/repositories/IImportService.js';
import { ISearchService } from '@domain/repositories/ISearchService.js';
import { IGraphService } from '@domain/entities/graph.js';
import { ICollectionService } from '@domain/repositories/ICollectionService.js';
import { IDocumentService } from '@domain/repositories/IDocumentService.js';
import { IFileProcessingService } from '@domain/repositories/IFileProcessingService.js';
import { IBatchService } from '@domain/repositories/IBatchService.js';
import { IMonitoringApiService } from '@domain/repositories/IMonitoringApiService.js';
import { IScrapeService } from '@domain/entities/scrape.js';
import { Logger } from '@logging/logger.js';
import { createApiRouter } from '@api/routes/index.js';

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
  logger: Logger;
  stateMachineService?: {
    getEngine: () => unknown;
  };
  monitoringApiService?: IMonitoringApiService;
}

/**
 * @function createApiRouter
 * @description 创建并配置Express API路由器
 *   此函数作为Express控制器层，负责接收请求、解构参数、调用应用服务、封装响应
 *   它不包含任何业务逻辑，也不应包含 try...catch 块，错误将由全局错误处理中间件统一处理
 * @param {ApiServices} services - 包含所有必要应用服务实例的对象
 * @returns {express.Router} 配置好的 Express 路由实例
 */
export { createApiRouter };

/**
 * @description 重新导出ApiServices接口供其他模块使用
 */
export type { ApiServices };
