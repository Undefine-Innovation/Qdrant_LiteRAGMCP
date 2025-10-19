import express from 'express';
import Database from 'better-sqlite3';
import cron from 'node-cron';
import { createLogger, Logger } from './logger.js';
import { validateConfig, AppConfig } from './config.js';
import { createApiRouter } from './api.js';
import { errorHandler } from './error-handler.js';

// Infrastructure
import { SQLiteRepo } from './infrastructure/SQLiteRepo.js';
import { QdrantRepo } from './infrastructure/QdrantRepo.js';
import { createOpenAIEmbeddingProviderFromConfig } from './infrastructure/OpenAIEmbeddingProvider.js';
import { MarkdownSplitter } from './infrastructure/MarkdownSplitter.js';
import { LocalFileLoader } from './infrastructure/LocalFileLoader.js';
import { IQdrantRepo } from './domain/IQdrantRepo.js';
import { IEmbeddingProvider } from './domain/embedding.js';
import { ISplitter } from './domain/splitter.js';
import { IFileLoader } from './domain/loader.js';

// Application Services
import { ImportService } from './application/ImportService.js';
import { SearchService } from './application/SearchService.js';
import { GraphService } from './application/GraphService.js';
import { SyncStateMachine } from './application/SyncStateMachine.js';
import { AutoGCService } from './application/AutoGCService.js';
import { CollectionService } from './application/CollectionService.js';
import { DocumentService } from './application/DocumentService.js';
import { ISearchService } from './domain/ISearchService.js';
import { IGraphService } from './domain/graph.js';
import { ICollectionService } from './domain/ICollectionService.js';
import { IDocumentService } from './domain/IDocumentService.js';
// 从新的 domain/types.js 导入 CollectionId 和 DocId

/**
 * @function main
 * @description 应用程序的入口点，负责初始化配置、基础设施组件、应用服务、Express 应用程序以及设置定时任务。
 * @async
 */
async function main() {
  // 1. 加载并校验应用程序配置
  const config: AppConfig = validateConfig(); // 应用程序配置对象
  const logger: Logger = createLogger(config); // 日志器实例
  logger.info('配置已加载。');

  // 2. 实例化所有基础设施组件
  const dbInstance = new Database(config.db.path); // SQLite 数据库实例
  const dbRepo = new SQLiteRepo(dbInstance); // SQLite 仓库，用于持久化数据
  const qdrantRepo: IQdrantRepo = new QdrantRepo(config, logger); // Qdrant 向量数据库仓库，用于存储和检索向量
  const embeddingProvider: IEmbeddingProvider = createOpenAIEmbeddingProviderFromConfig(); // 嵌入提供者，用于生成文本嵌入
  const splitter: ISplitter = new MarkdownSplitter(); // 文本分割器，用于将文档分割成块
  const fileLoader: IFileLoader = new LocalFileLoader(); // 文件加载器，用于从本地文件系统加载文档
  logger.info('基础设施组件已初始化。');

  // 3. 实例化应用服务，注入基础设施依赖
  const syncStateMachine = new SyncStateMachine( // 同步状态机，管理文档同步流程
    dbRepo,
    qdrantRepo,
    embeddingProvider,
    splitter,
    logger,
  );

  const importService = new ImportService( // 导入服务，负责文档的加载、分割、嵌入和存储
    fileLoader,
    splitter,
    embeddingProvider,
    dbRepo,
    qdrantRepo,
    logger,
    syncStateMachine,
  );
  const searchService: ISearchService = new SearchService( // 搜索服务，负责处理搜索请求
    embeddingProvider,
    dbRepo,
    qdrantRepo,
    logger,
  );
  const graphService: IGraphService = new GraphService(); // 图服务，用于构建和查询文档关系图
  const autoGCService = new AutoGCService(dbRepo, qdrantRepo, logger, config); // 自动垃圾回收服务，定期清理过期数据

  // 新增：实例化 CollectionService 和 DocumentService
  const collectionService: ICollectionService = new CollectionService(dbRepo); // 集合服务，管理文档集合
  const documentService: IDocumentService = new DocumentService(dbRepo, importService); // 文档服务，管理文档的生命周期，依赖导入服务

  logger.info('应用服务已初始化。');

  // 4. 创建和配置 Express 应用程序
  const app = express();
  app.use(express.json());

  /**
   * @description 将所有应用服务注入到 API 路由器中。
   */
  const apiRouter = createApiRouter({
    importService,
    searchService,
    graphService,
    collectionService,
    documentService,
  });
  app.use('/api', apiRouter); // 将路由器挂载到 /api 前缀下

  // 5. 添加集中式错误处理中间件
  app.use(errorHandler);
  logger.info('Express 应用程序已配置路由和错误处理。');

  // 6. 启动 Express API 服务器
  const apiPort = config.api.port; // API 端口
  app.listen(apiPort, () => {
    logger.info(`API 服务器正在运行于 http://localhost:${apiPort}`);
  });

  // 7. 设置自动垃圾回收（AutoGC）定时任务
  const gcIntervalHours = config.gc.intervalHours; // 垃圾回收间隔小时数
  logger.info(`AutoGC 定时任务已设置，每 ${gcIntervalHours} 小时运行一次。`);

  // 立即运行一次垃圾回收（可选）
  setTimeout(() => {
    logger.info('执行初始垃圾回收...');
    autoGCService.runGC().catch(err => {
      logger.error(`初始垃圾回收失败: ${(err as Error).message}`, err);
    });
  }, 5000); // 5秒后执行，确保应用完全启动

  // 设置定时任务
  // cron 表达式：'0 */${gcIntervalHours} * * *' 表示每 gcIntervalHours 小时执行一次，在小时的第 0 分钟
  cron.schedule(`0 */${gcIntervalHours} * * *`, () => {
    logger.info('执行定时垃圾回收...');
    autoGCService.runGC().catch(err => {
      logger.error(`定时垃圾回收失败: ${(err as Error).message}`, err);
    });
  });
}

main().catch(err => {
  // 在应用启动时发生致命错误，使用默认 logger 记录，因为它可能在配置 logger 之前发生。
  // 确保传入完整的 AppConfig 结构，即使大部分字段为空，以满足 createLogger 的类型要求。
  createLogger({
    log: { level: "error" },
    openai: { baseUrl: "", apiKey: "", model: "" },
    db: { path: "" },
    qdrant: { url: "", collection: "", vectorSize: 0 },
    embedding: { batchSize: 0 },
    api: { port: 0 },
    gc: { intervalHours: 0 },
  }).error(
    `应用启动期间发生致命错误: ${(err as Error).message}`,
    err
  );
  process.exit(1);
});