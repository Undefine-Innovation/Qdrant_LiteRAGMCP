import express from 'express';
import { Logger } from './logger.js';
import { AppConfig } from './config.js';
import { createApiRouter } from './api.js';
import { errorHandler } from './error-handler.js';
import { ImportService } from './application/ImportService.js';
import { SearchService } from './application/SearchService.js';
import { GraphService } from './application/GraphService.js';
import { CollectionService } from './application/CollectionService.js';
import { DocumentService } from './application/DocumentService.js';
import { MonitoringApiService } from './application/MonitoringApiService.js';
import { AutoGCService } from './application/AutoGCService.js';
import { ISearchService } from './domain/ISearchService.js';
import { IGraphService } from './domain/graph.js';
import { ICollectionService } from './domain/ICollectionService.js';
import { IDocumentService } from './domain/IDocumentService.js';

/**
 * 应用程序服务接口
 */
export interface AppServices {
  importService: ImportService;
  searchService: ISearchService;
  graphService: IGraphService;
  collectionService: ICollectionService;
  documentService: IDocumentService;
  monitoringApiService: MonitoringApiService;
  autoGCService: AutoGCService;
}

/**
 * 创建和配置Express应用程序
 *
 * @param services - 应用程序服务实例
 * @param config - 应用程序配置
 * @param logger - 日志器实例
 * @returns 配置好的Express应用程序实例
 */
export function createApp(
  services: AppServices,
  config: AppConfig,
  logger: Logger,
): express.Application {
  const app = express();

  // 配置中间件
  app.use(express.json());

  // 创建API路由器
  const apiRouter = createApiRouter(services);

  // 挂载路由
  app.use('/api', apiRouter);

  // 添加错误处理中间件
  app.use(errorHandler);

  logger.info('Express 应用程序已配置路由和错误处理。');

  return app;
}

/**
 * 启动HTTP服务器
 *
 * @param app - Express应用程序实例
 * @param port - 端口号
 * @param logger - 日志器实例
 */
export function startServer(
  app: express.Application,
  port: number,
  logger: Logger,
): void {
  app.listen(port, () => {
    logger.info(`API 服务器正在运行于 http://localhost:${port}`);
  });
}
