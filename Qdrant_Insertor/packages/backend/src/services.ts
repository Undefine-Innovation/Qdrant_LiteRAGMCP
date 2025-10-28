import Database from 'better-sqlite3';
import { Logger } from './logger.js';
import { AppConfig } from './config.js';
import { SQLiteRepo } from './infrastructure/SQLiteRepo.js';
import { QdrantRepo } from './infrastructure/QdrantRepo.js';
import { createOpenAIEmbeddingProviderFromConfig } from './infrastructure/OpenAIEmbeddingProvider.js';
import { MarkdownSplitter } from './infrastructure/MarkdownSplitter.js';
import { LocalFileLoader } from './infrastructure/LocalFileLoader.js';
import { IQdrantRepo } from './domain/IQdrantRepo.js';
import { IEmbeddingProvider } from './domain/embedding.js';
import { ISplitter } from './domain/splitter.js';
import { IFileLoader } from './domain/loader.js';
import { ImportService } from './application/ImportService.js';
import { SearchService } from './application/SearchService.js';
import { GraphService } from './application/GraphService.js';
import { AutoGCService } from './application/AutoGCService.js';
import { CollectionService } from './application/CollectionService.js';
import { DocumentService } from './application/DocumentService.js';
import { FileProcessingService } from './application/FileProcessingService.js';
import { PersistentSyncStateMachine } from './application/PersistentSyncStateMachine.js';
import { MonitoringService } from './application/MonitoringService.js';
import { AlertService } from './application/AlertService.js';
import { MonitoringApiService } from './application/MonitoringApiService.js';
import { BatchService } from './application/BatchService.js';
import { ISearchService } from './domain/ISearchService.js';
import { IGraphService } from './domain/graph.js';
import { ICollectionService } from './domain/ICollectionService.js';
import { IDocumentService } from './domain/IDocumentService.js';
import { IFileProcessingService } from './domain/IFileProcessingService.js';
import { IBatchService } from './domain/IBatchService.js';
import { AppServices } from './app.js';

/**
 * 基础设施组件接口
 */
export interface InfrastructureComponents {
  dbRepo: SQLiteRepo;
  qdrantRepo: IQdrantRepo;
  embeddingProvider: IEmbeddingProvider;
  splitter: ISplitter;
  fileLoader: IFileLoader;
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

  logger.info('基础设施组件已初始化。');

  return {
    dbRepo,
    qdrantRepo,
    embeddingProvider,
    splitter,
    fileLoader,
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
    dbRepo,
    qdrantRepo,
    embeddingProvider,
    splitter,
    logger,
  );

  // 初始化持久化同步状态机
  await persistentSyncStateMachine.initialize();
  logger.info('持久化同步状态机已初始化。');

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
  const autoGCService = new AutoGCService(dbRepo, qdrantRepo, logger, config);

  const collectionService: ICollectionService = new CollectionService(
    dbRepo,
    qdrantRepo,
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

  const alertService = new AlertService(dbRepo, logger);
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
  );

  logger.info('应用服务已初始化。');

  return {
    importService,
    searchService,
    graphService,
    collectionService,
    documentService,
    fileProcessingService,
    batchService,
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
  dbRepo: SQLiteRepo,
  persistentSyncStateMachine: PersistentSyncStateMachine,
  logger: Logger,
): MonitoringServices {
  const monitoringService = new MonitoringService(
    dbRepo,
    persistentSyncStateMachine,
    logger,
  );

  const alertService = new AlertService(dbRepo, logger);
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
