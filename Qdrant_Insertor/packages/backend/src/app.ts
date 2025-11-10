import express from 'express';
import {
  Logger,
  EnhancedLogger,
  LogTag,
} from './infrastructure/logging/logger.js';
import { AppConfig } from './infrastructure/config/config.js';
import { DataSource } from 'typeorm';
import { createApiRouter, ApiServices } from './api.js';
import { errorHandler } from './api/middleware/error-handler.js';
import { dbConnectionCheck } from './api/middleware/db-connection-check.js';
import {
  loggingMiddleware,
  errorLoggingMiddleware,
  performanceMiddleware,
  LoggedRequest,
} from './middlewares/logging.js';
import { ImportService } from './application/services/batch/index.js';
import { SearchService } from './application/services/core/index.js';
import { GraphService } from './application/services/core/index.js';
import { CollectionService } from './application/services/core/index.js';
import { DocumentService } from './application/services/core/index.js';
import { FileProcessingService } from './application/services/file-processing/index.js';
import { MonitoringApiService } from './application/services/api/index.js';
import { BatchService } from './application/services/batch/index.js';
import { StateMachineService } from './application/services/state-machine/index.js';
import { AutoGCService } from './application/services/system/index.js';
import { ISearchService } from './domain/repositories/ISearchService.js';
import { IGraphService } from './domain/entities/graph.js';
import { ICollectionService } from './domain/repositories/ICollectionService.js';
import { IDocumentService } from './domain/repositories/IDocumentService.js';
import { IFileProcessingService } from './domain/repositories/IFileProcessingService.js';
import { IBatchService } from './domain/repositories/IBatchService.js';
import { IImportService } from './domain/repositories/IImportService.js';
import { IStateMachineService } from './domain/repositories/IStateMachineService.js';
import { IMonitoringApiService } from './domain/repositories/IMonitoringApiService.js';
import { IAutoGCService } from './domain/repositories/IAutoGCService.js';
import { IScrapeService } from './domain/entities/scrape.js';
import { ITransactionManager } from './domain/repositories/ITransactionManager.js';

// 新增领域服务接口导入
import {
  IDocumentProcessingService,
  IEmbeddingGenerationService,
  ISearchDomainService,
  ICollectionManagementService,
} from './domain/services/index.js';
import { EventSystemService } from './domain/services/index.js';

// 新增用例接口导入
import type { IImportAndIndexUseCase } from './domain/use-cases/index.js';

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
  monitoringApiService?:
    | IMonitoringApiService
    | MonitoringApiService
    | undefined; // ✅ 已实现接口
  autoGCService: IAutoGCService; // ✅ 已实现接口
  scrapeService: IScrapeService;
  logger: Logger;
  enhancedLogger?: EnhancedLogger; // 新增增强日志器
  typeormRepo: import('./infrastructure/database/repositories/TypeORMRepository.js').TypeORMRepository;
  transactionManager: ITransactionManager; // 统一事务管理器

  // 新增领域服务
  documentProcessingService: IDocumentProcessingService;
  embeddingGenerationService: IEmbeddingGenerationService;
  searchDomainService: ISearchDomainService;
  collectionManagementService: ICollectionManagementService;
  eventSystemService: EventSystemService;

  // 新增用例层
  importAndIndexUseCase: IImportAndIndexUseCase;
}

/**
 * 创建和配置Express应用程序
 *
 * @param services - 应用程序服务实例
 * @param config - 应用程序配置
 * @param logger - 日志器实例
 * @param enhancedLogger - 增强日志器实例（可选）
 * @param typeormDataSource - TypeORM数据源实例
 * @returns 配置好的Express应用程序实例
 */
export function createApp(
  services: AppServices,
  config: AppConfig,
  logger: Logger,
  enhancedLogger?: EnhancedLogger,
  typeormDataSource?: DataSource,
): express.Application {
  const app = express();

  // 配置中间件
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // 添加日志中间件（如果启用了增强日志）
  if (enhancedLogger && config.log?.enableTraceId) {
    app.use(loggingMiddleware(enhancedLogger));

    // 添加性能监控中间件（如果启用）
    if (config.log?.enablePerformanceLogging) {
      app.use(performanceMiddleware(enhancedLogger));
    }

    // 添加错误日志中间件
    app.use(errorLoggingMiddleware(enhancedLogger));
  }

  // 配置 CORS 中间件
  app.use(
    (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      // 允许来自前端的请求
      const origin = req.headers.origin;
      if (origin) {
        res.header('Access-Control-Allow-Origin', origin);
      } else {
        res.header('Access-Control-Allow-Origin', '*');
      }
      res.header(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS, PATCH',
      );
      res.header(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With, Accept, Origin, User-Agent, DNT, Cache-Control, X-Mx-ReqToken, Keep-Alive, X-Requested-With, If-Modified-Since',
      );
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Max-Age', '86400');

      // 处理 OPTIONS 预检请求
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }

      next();
    },
  );

  // 如果提供了TypeORM DataSource，将其传递到响应locals中供中间件使用
  if (typeormDataSource) {
    app.use(
      (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
      ) => {
        res.locals.typeormDataSource = typeormDataSource;
        next();
      },
    );

    // 为所有API路由添加数据库连接检查中间件
    app.use('/api', dbConnectionCheck);
  }

  // 创建API路由
  const apiRouter = createApiRouter(services);

  // 挂载路由
  app.use('/api', apiRouter);

  // 添加错误处理中间件
  app.use(errorHandler);

  logger.info('Express 应用程序已配置路由和错误处理');

  // 记录增强日志系统状态
  if (enhancedLogger) {
    enhancedLogger.info('Express 应用程序已配置增强日志系统', LogTag.SYSTEM, {
      enableTraceId: config.log.enableTraceId,
      enableModuleTag: config.log.enableModuleTag,
      enablePerformanceLogging: config.log.enablePerformanceLogging,
      logSlowQueriesThreshold: config.log.logSlowQueriesThreshold,
    });
  }

  return app;
}

/**
 * 启动HTTP服务器
 *
 * @param app - Express应用程序实例
 * @param port - 端口号
 * @param logger - 日志器实例
 * @param enhancedLogger - 增强日志器实例（可选）
 */
export function startServer(
  app: express.Application,
  port: number,
  logger: Logger,
  enhancedLogger?: EnhancedLogger,
): void {
  app.listen(port, () => {
    logger.info(`API 服务器正在运行于 http://localhost:${port}`);

    // 使用增强日志记录服务器启动信息
    if (enhancedLogger) {
      enhancedLogger.info('API 服务器启动成功', LogTag.SYSTEM, {
        port,
        url: `http://localhost:${port}`,
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
      });
    }
  });
}
