import Database from 'better-sqlite3';
import { Logger } from '@logging/logger.js';
import { AppConfig } from '@config/config.js';
import { SQLiteRepo } from '@infrastructure/repositories/SQLiteRepository.js';
import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { QdrantRepo } from '@infrastructure/repositories/QdrantRepository.js';
import { createOpenAIEmbeddingProviderFromConfig } from '@infrastructure/external/OpenAIEmbeddingProvider.js';
import { MarkdownSplitter } from '@infrastructure/external/MarkdownSplitter.js';
import { LocalFileLoader } from '@infrastructure/external/LocalFileLoader.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';
import { IEmbeddingProvider } from '@domain/entities/embedding.js';
import { ISplitter } from '@domain/services/splitter.js';
import { IFileLoader } from '@domain/services/loader.js';
import { ImportService } from '@application/services/ImportService.js';
import { SearchService } from '@application/services/SearchService.js';
import { GraphService } from '@application/services/GraphService.js';
import { AutoGCService } from '@application/services/AutoGCService.js';
import { CollectionService } from '@application/services/CollectionService.js';
import { DocumentService } from '@application/services/DocumentService.js';
import { FileProcessingService } from '@application/services/FileProcessingService.js';
import { PersistentSyncStateMachine } from '@application/services/PersistentSyncStateMachine.js';
import { MonitoringService } from '@application/services/MonitoringService.js';
import { AlertService } from '@application/services/AlertService.js';
import { MonitoringApiService } from '@application/services/MonitoringApiService.js';
import { BatchService } from '@application/services/BatchService.js';
import { StateMachineService } from '@application/services/StateMachineService.js';
import { ISearchService } from '@domain/repositories/ISearchService.js';
import { IGraphService } from '@domain/entities/graph.js';
import { ICollectionService } from '@domain/repositories/ICollectionService.js';
import { IDocumentService } from '@domain/repositories/IDocumentService.js';
import { IFileProcessingService } from '@domain/repositories/IFileProcessingService.js';
import { IBatchService } from '@domain/repositories/IBatchService.js';
import { AppServices } from '../../app.js';
import { IScrapeService } from '@domain/entities/scrape.js';
import { ScrapeService } from '@application/services/ScrapeService.js';
import { WebCrawler } from '@infrastructure/external/WebCrawler.js';
import { ContentExtractor } from '@infrastructure/external/ContentExtractor.js';
import { SystemHealthTable } from '@infrastructure/sqlite/dao/SystemHealthTable.js';
import { TransactionManager } from '@infrastructure/transactions/TransactionManager.js';

/**
 * 基础设施组件接口
 */
export interface InfrastructureComponents {
  dbRepo: ISQLiteRepo;
  qdrantRepo: IQdrantRepo;
  embeddingProvider: IEmbeddingProvider;
  splitter: ISplitter;
  fileLoader: IFileLoader;
  systemHealth: SystemHealthTable;
}

/**
 * 监控服务接口
 */
export interface MonitoringServices {
  monitoringService: MonitoringService;
  alertService: AlertService;
  monitoringApiService: MonitoringApiService;
}

/**
 * 初始化基础设施组件
 *
 * @param config - 应用程序配置
 * @param logger - 日志器实例
 * @returns 基础设施组件实例
 */
export async function initializeInfrastructure(
  config: AppConfig,
  logger: Logger,
): Promise<InfrastructureComponents> {
  // 创建数据库实例
  const dbInstance = new Database(config.db.path);
  const dbRepo = new SQLiteRepo(dbInstance, logger);

  // 初始化数据库
  logger.info('正在初始化数据库...');
  const initResult = await dbRepo.initializeDatabase(config.db.path, logger);
  if (!initResult.success) {
    logger.error(`数据库初始化失败: ${initResult.error}`);
    throw new Error(`数据库初始化失败: ${initResult.error}`);
  }
  logger.info(`数据库初始化成功: ${initResult.message}`);

  // 创建其他基础设施组件
  const qdrantRepo: IQdrantRepo = new QdrantRepo(config, logger);
  const embeddingProvider: IEmbeddingProvider =
    createOpenAIEmbeddingProviderFromConfig();
  const splitter: ISplitter = new MarkdownSplitter();
  const fileLoader: IFileLoader = new LocalFileLoader();

  logger.info('基础设施组件已初始化');

  return {
    dbRepo,
    qdrantRepo,
    embeddingProvider,
    splitter,
    fileLoader,
    systemHealth: dbRepo.systemHealth,
  };
}

/**
 * 初始化应用程序服务
 *
 * @param infrastructure - 基础设施组件
 * @param config - 应用程序配置
 * @param logger - 日志器实例
 * @returns 应用程序服务实例
 */
export async function initializeServices(
  infrastructure: InfrastructureComponents,
  config: AppConfig,
  logger: Logger,
): Promise<AppServices> {
  const { dbRepo, qdrantRepo, embeddingProvider, splitter, fileLoader } =
    infrastructure;

  // 创建持久化同步状态机
  const persistentSyncStateMachine = new PersistentSyncStateMachine(
    dbRepo as ISQLiteRepo, // 确保类型匹配
    qdrantRepo,
    embeddingProvider,
    splitter,
    logger,
  );

  // 初始化持久化同步状态机
  await persistentSyncStateMachine.initialize();
  logger.info('持久化同步状态机已初始化');

  // 创建应用服务
  const importService = new ImportService(
    fileLoader,
    splitter,
    embeddingProvider,
    dbRepo,
    qdrantRepo,
    logger,
    persistentSyncStateMachine,
  );

  const searchService: ISearchService = new SearchService(
    embeddingProvider,
    dbRepo,
    qdrantRepo,
    logger,
  );

  const graphService: IGraphService = new GraphService();

  // 创建状态机服务
  const stateMachineService = new StateMachineService(
    logger,
    (dbRepo as any).getDb?.(), // eslint-disable-line @typescript-eslint/no-explicit-any -- 获取底层数据库实例
  );

  const webCrawler = new WebCrawler(logger, new ContentExtractor(logger));
  const scrapeService: ScrapeService = new ScrapeService(
    stateMachineService.getEngine(),
    logger,
  );
  const autoGCService = new AutoGCService(dbRepo, qdrantRepo, logger, config);

  const collectionService: ICollectionService = new CollectionService(
    dbRepo,
    qdrantRepo,
    (
      dbRepo as ISQLiteRepo & {
        getTransactionManager: () => TransactionManager;
      }
    ).getTransactionManager?.() || undefined,
  );
  const documentService: IDocumentService = new DocumentService(
    dbRepo,
    importService,
    qdrantRepo, // Add QdrantRepo dependency
  );

  const fileProcessingService: IFileProcessingService =
    new FileProcessingService(dbRepo, logger);

  // 初始化监控服务
  const monitoringService = new MonitoringService(
    dbRepo,
    persistentSyncStateMachine,
    logger,
  );

  const alertService = new AlertService(dbRepo, logger); // DIP修复：现在AlertService依赖ISQLiteRepo接口
  const monitoringApiService = new MonitoringApiService(
    monitoringService,
    alertService,
    dbRepo.syncJobs,
  );

  // 创建批量操作服务
  const batchService: IBatchService = new BatchService(
    importService,
    collectionService,
    documentService,
    logger,
    stateMachineService,
  );

  logger.info('应用服务已初始化');

  return {
    importService,
    searchService,
    graphService,
    collectionService,
    documentService,
    fileProcessingService,
    batchService,
    scrapeService,
    logger,
    stateMachineService,
    monitoringApiService,
    autoGCService,
  };
}

/**
 * 初始化监控服务
 *
 * @param dbRepo - 数据库仓库
 * @param persistentSyncStateMachine - 持久化同步状态机
 * @param logger - 日志器实例
 * @returns 监控服务实例
 */
export function initializeMonitoringServices(
  dbRepo: ISQLiteRepo,
  persistentSyncStateMachine: PersistentSyncStateMachine,
  logger: Logger,
): MonitoringServices {
  const monitoringService = new MonitoringService(
    dbRepo,
    persistentSyncStateMachine,
    logger,
  );

  const alertService = new AlertService(dbRepo, logger); // DIP修复：现在AlertService依赖ISQLiteRepo接口
  const monitoringApiService = new MonitoringApiService(
    monitoringService,
    alertService,
    dbRepo.syncJobs,
  );

  return {
    monitoringService,
    alertService,
    monitoringApiService,
  };
}
