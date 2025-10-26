import { createLogger, Logger } from './logger.js';
import { validateConfig, AppConfig } from './config.js';
import { createApp, startServer } from './app.js';
import { initializeInfrastructure, initializeServices } from './services.js';
import { setupScheduledTasks } from './scheduler.js';
import { setupGracefulShutdown } from './shutdown.js';

/**
 * 应用程序主入口点
 *
 * @description 负责初始化配置、基础设施组件、应用服务、Express 应用程序以及设置定时任务。
 * @async
 */
async function main(): Promise<void> {
  try {
    // 1. 加载并校验应用程序配置
    const config: AppConfig = validateConfig();
    const logger: Logger = createLogger(config);
    logger.info('配置已加载。');

    // 2. 初始化基础设施组件
    const infrastructure = await initializeInfrastructure(config, logger);

    // 3. 初始化应用服务
    const services = await initializeServices(infrastructure, config, logger);

    // 4. 创建和配置 Express 应用程序
    const app = createApp(services, config, logger);

    // 5. 启动 Express API 服务器
    const apiPort = config.api.port;
    startServer(app, apiPort, logger);

    // 6. 设置定时任务
    setupScheduledTasks(
      services.monitoringApiService.monitoringService,
      services.monitoringApiService.alertService,
      services.autoGCService,
      config,
      logger,
    );

    // 7. 设置优雅关闭处理
    setupGracefulShutdown(
      services.monitoringApiService.monitoringService,
      services.monitoringApiService.alertService,
      logger,
    );
  } catch (error) {
    // 在应用启动时发生致命错误，使用默认 logger 记录
    createLogger({
      log: { level: 'error' },
      openai: { baseUrl: '', apiKey: '', model: '' },
      db: { path: '' },
      qdrant: { url: '', collection: '', vectorSize: 0 },
      embedding: { batchSize: 0 },
      api: { port: 0 },
      gc: { intervalHours: 0 },
    }).error(`应用启动期间发生致命错误: ${(error as Error).message}`, error);

    process.exit(1);
  }
}

// 启动应用程序
main();
