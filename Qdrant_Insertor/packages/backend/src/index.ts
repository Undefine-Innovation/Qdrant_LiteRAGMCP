import 'reflect-metadata';
import {
  createLogger,
  Logger,
  createEnhancedLoggerFromConfig,
  EnhancedLogger,
  LogTag,
} from './infrastructure/logging/logger.js';
import { validateConfig, AppConfig } from './infrastructure/config/config.js';
import { createApp, startServer } from './app.js';
import {
  initializeInfrastructure,
  initializeServices,
} from './infrastructure/di/services.js';
import { setupScheduledTasks } from './infrastructure/scheduling/scheduler.js';
import { setupGracefulShutdown } from './infrastructure/lifecycle/shutdown.js';
import { MonitoringApiService } from './application/services/api/index.js';
import { AutoGCService } from './application/services/system/index.js';

/**
 * 应用程序主入口点
 *
 * @description 负责初始化配置、基础设施组件、应用服务、Express 应用程序以及设置定时任务
 * @async
 */
async function main(): Promise<void> {
  try {
    // 1. 加载并校验应用程序配置
    const config: AppConfig = validateConfig();

    // 2. 创建增强的日志器实例
    const enhancedLogger: EnhancedLogger = createEnhancedLoggerFromConfig(
      config,
    ) as EnhancedLogger;
    const logger: Logger = enhancedLogger; // 兼容性处理

    enhancedLogger.info('应用程序启动', LogTag.SYSTEM, {
      nodeVersion: process.version,
      platform: process.platform,
      env: process.env.NODE_ENV || 'development',
    });

    logger.info('配置已加载');

    // 3. 初始化基础设施组件
    const infrastructure = await initializeInfrastructure(
      config,
      logger,
      enhancedLogger,
    );

    // 4. 初始化应用服务
    const services = await initializeServices(
      infrastructure,
      config,
      logger,
      enhancedLogger,
    );

    // 5. 创建和配置Express 应用程序（传递 TypeORM DataSource）
    const app = createApp(
      services,
      config,
      logger,
      enhancedLogger,
      infrastructure.typeormDataSource,
    );

    // 6. 启动 Express API 服务器
    const apiPort = config.api.port;
    startServer(app, apiPort, logger, enhancedLogger);

    // 7. 设置定时任务
    const _monitoringApiService = services.monitoringApiService as unknown as
      | MonitoringApiService
      | undefined;
    setupScheduledTasks(
      _monitoringApiService?.monitoringService as import('./application/services/monitoring/index.js').MonitoringService,
      _monitoringApiService?.alertService as import('./application/services/alerting/index.js').AlertService,
      services.autoGCService as AutoGCService,
      config,
      logger,
      enhancedLogger,
    );

    // 8. 设置优雅关闭处理
    setupGracefulShutdown(
      _monitoringApiService?.monitoringService as import('./application/services/monitoring/index.js').MonitoringService,
      _monitoringApiService?.alertService as import('./application/services/alerting/index.js').AlertService,
      logger,
    );
  } catch (error) {
    // 在应用启动时发生致命错误，使用默认logger 记录
    const fallbackLogger = createLogger({
      log: { level: 'error' },
      openai: { baseUrl: '', apiKey: '', model: '' },
      db: { type: 'sqlite', path: '' },
      qdrant: { url: '', collection: '', vectorSize: 0 },
      embedding: { batchSize: 0 },
      api: { port: 0 },
      gc: { intervalHours: 0 },
    });

    fallbackLogger.error(
      `应用启动期间发生致命错误: ${(error as Error).message}`,
      error,
    );

    process.exit(1);
  }
}

// 启动应用程序
main();
