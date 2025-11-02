import express from 'express';
import { Logger } from '@logging/logger.js';
import { AppConfig } from '@config/config.js';
import { createApiRouter, ApiServices } from './api.js';
import { errorHandler } from '@middleware/error-handler.js';
import { ImportService } from '@application/services/ImportService.js';
import { SearchService } from '@application/services/SearchService.js';
import { GraphService } from '@application/services/GraphService.js';
import { CollectionService } from '@application/services/CollectionService.js';
import { DocumentService } from '@application/services/DocumentService.js';
import { FileProcessingService } from '@application/services/FileProcessingService.js';
import { MonitoringApiService } from '@application/services/MonitoringApiService.js';
import { BatchService } from '@application/services/BatchService.js';
import { StateMachineService } from '@application/services/StateMachineService.js';
import { AutoGCService } from '@application/services/AutoGCService.js';
import { ISearchService } from '@domain/repositories/ISearchService.js';
import { IGraphService } from '@domain/entities/graph.js';
import { ICollectionService } from '@domain/repositories/ICollectionService.js';
import { IDocumentService } from '@domain/repositories/IDocumentService.js';
import { IFileProcessingService } from '@domain/repositories/IFileProcessingService.js';
import { IBatchService } from '@domain/repositories/IBatchService.js';
import { IImportService } from '@domain/repositories/IImportService.js';
import { IStateMachineService } from '@domain/repositories/IStateMachineService.js';
import { IMonitoringApiService } from '@domain/repositories/IMonitoringApiService.js';
import { IAutoGCService } from '@domain/repositories/IAutoGCService.js';
import { IScrapeService } from '@domain/entities/scrape.js';

/**
 * 应用程序服务接口
 * @description 迁移到Domain层接口，遵循依赖倒置原则
 */
export interface AppServices {
  importService: IImportService;
  searchService: ISearchService;
  graphService: IGraphService;
  collectionService: ICollectionService;
  documentService: IDocumentService;
  fileProcessingService: IFileProcessingService;
  batchService: IBatchService;
  stateMachineService: IStateMachineService; // ✅ 已实现接口
  monitoringApiService: IMonitoringApiService; // ✅ 已实现接口
  autoGCService: IAutoGCService; // ✅ 已实现接口
  scrapeService: IScrapeService;
  logger: Logger;
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

  // 创建API路由 (使用类型转换以兼容具体服务类型要求)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiRouter = createApiRouter(services as any);

  // 挂载路由
  app.use('/api', apiRouter);

  // 添加错误处理中间件
  app.use(errorHandler);

  logger.info('Express 应用程序已配置路由和错误处理');

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
