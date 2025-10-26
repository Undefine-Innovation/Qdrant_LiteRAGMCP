import express from 'express';
import { IImportService } from './domain/IImportService.js';
import { ISearchService } from './domain/ISearchService.js';
import { IGraphService } from './domain/graph.js';
import { ICollectionService } from './domain/ICollectionService.js';
import { IDocumentService } from './domain/IDocumentService.js';
import { MonitoringApiService } from './application/MonitoringApiService.js';
import { createApiRouter } from './api/routes/index.js';

/**
 * @interface ApiServices
 * @description API 层所需的应用服务接口集合
 */
interface ApiServices {
  importService: IImportService;
  searchService: ISearchService;
  graphService: IGraphService;
  collectionService: ICollectionService;
  documentService: IDocumentService;
  monitoringApiService?: MonitoringApiService;
}

/**
 * @function createApiRouter
 * @description 创建并配置 Express API 路由。
 *   此函数作为 Express 控制器层，负责接收请求、解构参数、调用应用服务、封装响应。
 *   它不包含任何业务逻辑，也不应包含 try...catch 块，错误将由全局错误处理中间件统一处理。
 * @param {ApiServices} services - 包含所有必要应用服务实例的对象。
 * @returns {express.Router} 配置好的 Express 路由实例。
 */
export { createApiRouter };

// 重新导出ApiServices接口供其他模块使用
export type { ApiServices };
