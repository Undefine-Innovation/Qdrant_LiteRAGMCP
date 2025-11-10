import { Logger, EnhancedLogger } from '@logging/logger.js';
import { AppConfig } from '@config/config.js';
import { LogTag } from '@logging/enhanced-logger.js';
import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { QdrantRepo } from '@infrastructure/repositories/QdrantRepository.js';
import {
  initializeTypeORMDatabase,
  getTypeORMDatabaseStatus,
} from '@infrastructure/database/index.js';
import {
  DatabaseConnectionManager,
  createTypeORMDataSource,
} from '@infrastructure/database/config.js';
import { TypeORMRepository } from '@infrastructure/database/repositories/TypeORMRepository.js';
import {
  CollectionAggregateRepository,
  DocumentAggregateRepository,
  SyncJobsTableAdapter,
} from '@infrastructure/database/repositories/index.js';
import { DocRepository } from '@infrastructure/database/repositories/DocRepository.js';
import { CollectionRepository } from '@infrastructure/database/repositories/CollectionRepository.js';
import { createOpenAIEmbeddingProviderFromConfig } from '@infrastructure/external/OpenAIEmbeddingProvider.js';
import { MarkdownSplitter } from '@infrastructure/external/MarkdownSplitter.js';
import { LocalFileLoader } from '@infrastructure/external/LocalFileLoader.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';
import { IEmbeddingProvider } from '@domain/entities/embedding.js';
import { ISplitter } from '@domain/services/splitter.js';
import { IFileLoader } from '@domain/services/loader.js';
import { ImportService } from '@application/services/batch/index.js';
import { SearchService } from '@application/services/core/index.js';
import { GraphService } from '@application/services/core/index.js';
import { AutoGCService } from '@application/services/system/index.js';
import { CollectionService } from '@application/services/core/index.js';
import { DocumentService } from '@application/services/core/index.js';
import { FileProcessingService } from '@application/services/file-processing/index.js';
import { EnhancedFileProcessingService } from '@application/services/file-processing/index.js';
import { SyncStateMachine as MemorySyncStateMachine } from '@application/services/sync/index.js';
import { MonitoringService } from '@application/services/monitoring/index.js';
import { AlertService } from '@application/services/alerting/index.js';
import { MonitoringApiService } from '@application/services/api/index.js';
import { BatchService } from '@application/services/batch/index.js';
import { StateMachineService } from '@application/services/state-machine/index.js';
import { ISearchService } from '@domain/repositories/ISearchService.js';
import { IGraphService } from '@domain/entities/graph.js';
import { ICollectionService } from '@domain/repositories/ICollectionService.js';
import { IDocumentService } from '@domain/repositories/IDocumentService.js';
import { IFileProcessingService } from '@domain/repositories/IFileProcessingService.js';
import { IBatchService } from '@domain/repositories/IBatchService.js';
import { AppServices } from '../../app.js';
import { IScrapeService } from '@domain/entities/scrape.js';
import { ScrapeService } from '@application/services/scraping/index.js';
import { WebCrawler } from '@infrastructure/external/WebCrawler.js';
import { ContentExtractor } from '@infrastructure/external/ContentExtractor.js';
import { TypeORMTransactionManager } from '@infrastructure/transactions/TypeORMTransactionManager.js';
import { ITransactionManager } from '@domain/repositories/ITransactionManager.js';
// 新增文件处理相关导入
import { FileProcessorRegistry } from '@infrastructure/external/FileProcessorRegistry.js';
import { TextFileProcessor } from '@infrastructure/external/processors/TextFileProcessor.js';
import { MarkdownFileProcessor } from '@infrastructure/external/processors/MarkdownFileProcessor.js';
import { MarkdownSplitterAdapter } from '@infrastructure/external/MarkdownSplitterAdapter.js';

// 新增领域服务导入
import {
  DocumentProcessingService,
  EmbeddingGenerationService,
  SearchDomainService,
  CollectionManagementService,
  EventSystemService,
  EventSystemServiceFactory,
} from '@domain/services/index.js';
import { IEventPublisher } from '@domain/events/index.js';
import {
  ICollectionAggregateRepository,
  IDocumentAggregateRepository,
} from '@domain/repositories/index.js';

// 新增用例导入
import { ImportAndIndexUseCase } from '@application/use-cases/index.js';
import type { IImportAndIndexUseCase } from '@domain/use-cases/index.js';

// Orchestration 管线导入
import { Pipeline } from '@application/orchestration/core/Pipeline.js';
import { StrategyRegistry } from '@infrastructure/strategies/StrategyRegistry.js';
import { ImportStep } from '@application/orchestration/steps/ImportStep.js';
import { SplitStep } from '@application/orchestration/steps/SplitStep.js';
import { EmbedStep } from '@application/orchestration/steps/EmbedStep.js';
import { IndexStep } from '@application/orchestration/steps/IndexStep.js';
import { RetrievalStep } from '@application/orchestration/steps/RetrievalStep.js';
import { RerankStep } from '@application/orchestration/steps/RerankStep.js';
import { DefaultStreamFileLoader } from '@infrastructure/external/DefaultStreamFileLoader.js';

/**
 * 基础设施组件接口
 */
export interface InfrastructureComponents {
  dbRepo: ISQLiteRepo;
  typeormRepo: TypeORMRepository;
  qdrantRepo: IQdrantRepo;
  embeddingProvider: IEmbeddingProvider;
  splitter: ISplitter;
  fileLoader: IFileLoader;
  fileProcessorRegistry: FileProcessorRegistry;
  dbConnectionManager: DatabaseConnectionManager;
  typeormDataSource: import('typeorm').DataSource;
  transactionManager: ITransactionManager;
  eventPublisher: IEventPublisher;
  eventSystemService: EventSystemService;
  enhancedLogger?: EnhancedLogger; // 新增增强日志器
}

/**
 * 监控服务接口
 */
export interface MonitoringServices {
  monitoringService: MonitoringService | null;
  alertService: AlertService;
  monitoringApiService: MonitoringApiService | null;
}

/**
 * 初始化基础设施组件
 * @param config - 应用程序配置
 * @param logger - 日志器实例
 * @param enhancedLogger - 增强日志器实例（可选）
 * @returns 基础设施组件实例
 */
export async function initializeInfrastructure(
  config: AppConfig,
  logger: Logger,
  enhancedLogger?: EnhancedLogger,
): Promise<InfrastructureComponents> {
  // 先创建 Qdrant 仓库
  const qdrantRepo: IQdrantRepo = new QdrantRepo(config, logger);

  // 使用增强日志记录Qdrant初始化过程
  const qdrantLogger = enhancedLogger?.withTag(LogTag.QDRANT) || logger;

  // 确保Qdrant集合已创建且向量维度匹配
  try {
    await (qdrantRepo as QdrantRepo).ensureCollection();
    qdrantLogger.info(
      `Qdrant collection ensured: ${(config.qdrant && config.qdrant.collection) || 'chunks'}`,
    );

    if (enhancedLogger) {
      enhancedLogger.info('Qdrant集合初始化完成', LogTag.QDRANT, {
        collection: config.qdrant.collection,
        vectorSize: config.qdrant.vectorSize,
        url: config.qdrant.url,
      });
    }
  } catch (e) {
    qdrantLogger.error('Failed to ensure Qdrant collection on startup', {
      error: e,
    });

    if (enhancedLogger) {
      enhancedLogger.error('Qdrant集合初始化失败', LogTag.QDRANT, {
        collection: config.qdrant.collection,
        error: (e as Error).message,
        stack: (e as Error).stack,
      });
    }
    // 不中断启动，让上层有机会继续运行（如纯关键字检索场景）
  }

  // 创建TypeORM数据源和连接管理器
  const typeormDataSource = createTypeORMDataSource(config, logger);

  // 使用增强日志记录数据库初始化过程
  const dbLogger = enhancedLogger?.withTag(LogTag.DATABASE) || logger;
  
  // 检查是否为测试环境且数据源已初始化（避免重复初始化）
  const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID;
  
  dbLogger.info('TypeORM DataSource状态', {
    isInitialized: typeormDataSource.isInitialized,
    isTestEnvironment,
    type: typeormDataSource.options.type,
  });

  // 正在初始化 TypeORM DataSource (skip re-init in tests if already initialized)
  if (!typeormDataSource.isInitialized) {
    dbLogger.info('开始初始化TypeORM DataSource');
    await typeormDataSource.initialize();
    dbLogger.info('TypeORM DataSource 初始化完成');
  } else if (isTestEnvironment) {
    dbLogger.info('使用已初始化的测试 TypeORM DataSource');
  }
  dbLogger.info('TypeORM DataSource 初始化成功');

  if (enhancedLogger) {
    enhancedLogger.info('TypeORM数据源初始化完成', LogTag.DATABASE, {
      dbType: config.db.type,
      connected: true,
    });
  }

  const dbConnectionManager = new DatabaseConnectionManager(config, logger);

  // 初始化TypeORM数据库连接
  dbLogger.info('正在初始化TypeORM数据库...');
  if (!process.env.JEST_WORKER_ID) {
    await dbConnectionManager.initialize();
  }
  dbLogger.info('TypeORM数据库连接初始化成功');

  // 验证数据库状态
  const dbStatus = await getTypeORMDatabaseStatus(typeormDataSource, logger);
  dbLogger.info('TypeORM数据库状态验证完成', dbStatus);

  if (enhancedLogger) {
    enhancedLogger.info('数据库状态验证完成', LogTag.DATABASE, dbStatus);
  }

  // 创建TypeORM Repository实例
  const typeormRepo = new TypeORMRepository(
    typeormDataSource,
    logger,
    qdrantRepo,
  );

  // 完全使用TypeORM Repository作为主要数据库实现
  const dbRepo: ISQLiteRepo = typeormRepo as unknown as ISQLiteRepo;
  logger.info('使用TypeORM Repository作为主要数据库实现');

  const embeddingProvider: IEmbeddingProvider =
    createOpenAIEmbeddingProviderFromConfig();
  const fileLoader: IFileLoader = new LocalFileLoader();

  // 初始化文件处理器注册表
  const fileProcessorRegistry = new FileProcessorRegistry(logger);

  // 注册内置文件处理器
  fileProcessorRegistry.register(new TextFileProcessor(logger));
  fileProcessorRegistry.register(new MarkdownFileProcessor(logger));

  logger.info(
    '文件处理器注册表已初始化，已注册处理器数量: ' +
      fileProcessorRegistry.getAllProcessors().length,
  );

  if (enhancedLogger) {
    enhancedLogger.info('文件处理器注册表初始化完成', LogTag.SYSTEM, {
      processorCount: fileProcessorRegistry.getAllProcessors().length,
      processors: fileProcessorRegistry
        .getAllProcessors()
        .map((p) => p.constructor.name),
    });
  }

  // 使用适配器创建splitter，保持向后兼容
  const splitter: ISplitter = new MarkdownSplitterAdapter(
    fileProcessorRegistry,
    logger,
  );

  // 创建统一事务管理器
  const transactionManager: ITransactionManager = new TypeORMTransactionManager(
    typeormDataSource,
    qdrantRepo,
    logger,
  ) as ITransactionManager;

  const isTestEnv =
    process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID;

  // 初始化事件系统，在测试环境使用轻量配置
  let eventSystemService =
    EventSystemServiceFactory.createProductionService(
      logger,
      typeormDataSource,
      transactionManager,
    );

  if (isTestEnv) {
    logger.info('测试环境下使用轻量级事件系统配置');
    eventSystemService =
      EventSystemServiceFactory.createDevelopmentService(logger);
  }

  try {
    await eventSystemService.initialize();
    logger.info('事件系统已初始化', {
      environment: isTestEnv ? 'test' : 'production',
    });
  } catch (error) {
    logger.error('事件系统初始化失败', { error });
    throw error;
  }


  // 从事件系统服务获取事件发布器
  const eventPublisher = eventSystemService.getEventPublisher();

  logger.info('基础设施组件已初始化');

  if (enhancedLogger) {
    enhancedLogger.info('所有基础设施组件初始化完成', LogTag.SYSTEM);
  }

  return {
    dbRepo,
    typeormRepo,
    qdrantRepo,
    embeddingProvider,
    splitter,
    fileLoader,
    fileProcessorRegistry,
    dbConnectionManager,
    typeormDataSource,
    transactionManager,
    eventPublisher,
    eventSystemService,
    enhancedLogger, // 添加增强日志器到返回值
  };
}

/**
 * 初始化应用程序服务
 * @param infrastructure - 基础设施组件
 * @param config - 应用程序配置
 * @param logger - 日志器实例
 * @param enhancedLogger - 增强日志器实例（可选）
 * @returns 应用程序服务实例
 */
export async function initializeServices(
  infrastructure: InfrastructureComponents,
  config: AppConfig,
  logger: Logger,
  enhancedLogger?: EnhancedLogger,
): Promise<AppServices> {
  const {
    dbRepo,
    typeormRepo,
    qdrantRepo,
    embeddingProvider,
    splitter,
    fileLoader,
    fileProcessorRegistry,
    transactionManager,
    eventPublisher,
    eventSystemService,
    typeormDataSource,
    enhancedLogger: infraEnhancedLogger,
  } = infrastructure;

  // 创建纯内存同步状态机
  const syncStateMachine = new MemorySyncStateMachine(
    dbRepo, // 使用新的TypeORM Repository
    qdrantRepo,
    embeddingProvider,
    splitter,
    logger,
  );

  logger.info('内存同步状态机已创建');

  // 创建TypeORM repositories
  const docRepository = new DocRepository(typeormDataSource, logger);
  const collectionRepository = new CollectionRepository(
    typeormDataSource,
    logger,
  );

  // 创建应用服务
  const importService = new ImportService(
    fileLoader,
    splitter,
    embeddingProvider,
    dbRepo,
    qdrantRepo,
    logger,
    syncStateMachine, // 使用纯内存状态机
    transactionManager, // 注入统一事务管理器
    docRepository, // 注入文档仓库
    collectionRepository, // 注入集合仓库
  );

  // 初始化领域服务
  const documentProcessingService = new DocumentProcessingService(
    eventPublisher,
    logger,
  );
  const embeddingGenerationService = new EmbeddingGenerationService(
    embeddingProvider,
    eventPublisher,
    logger,
  );
  const searchDomainService = new SearchDomainService(
    embeddingProvider,
    eventPublisher,
    logger,
  );
  const collectionManagementService = new CollectionManagementService(
    eventPublisher,
    logger,
  );

  const collectionAggregateRepository = new CollectionAggregateRepository(
    typeormDataSource,
    logger,
  );
  const documentAggregateRepository = new DocumentAggregateRepository(
    typeormDataSource,
    logger,
  );

  logger.info('聚合仓储已初始化', {
    collectionRepository: 'CollectionAggregateRepository',
    documentRepository: 'DocumentAggregateRepository',
  });

  const searchService: ISearchService = new SearchService(
    embeddingProvider,
    dbRepo,
    qdrantRepo,
    undefined, // keywordRetriever parameter
    searchDomainService,
    documentAggregateRepository, // Use document aggregate repository
    logger,
  );

  const graphService: IGraphService = new GraphService();

  // 创建状态机服务
  const stateMachineService = new StateMachineService(
    logger,
    typeormDataSource, // 直接使用TypeORM数据源
  );

  // 初始化状态机（确保数据库表存在）
  try {
    // 使用TypeORM初始化状态机持久化表
    const { TypeORMStatePersistence } = await import(
      '../state-machine/TypeORMStatePersistence.js'
    );
    const persistence = new TypeORMStatePersistence(typeormDataSource, logger);
    await persistence.initializeTable();
    logger.info('状态机数据库表初始化完成');
  } catch (error: unknown) {
    logger.error('状态机数据库表初始化失败:', String(error));
  }

  const contentExtractor = new ContentExtractor(logger);
  const webCrawler = new WebCrawler(logger, contentExtractor);
  const scrapeService: ScrapeService = new ScrapeService(
    stateMachineService.getEngine(),
    logger,
    dbRepo, // 使用新的TypeORM Repository
    webCrawler,
    contentExtractor,
    importService,
  );
  const autoGCService = new AutoGCService(dbRepo, qdrantRepo, logger, config);

  const collectionService: ICollectionService = new CollectionService(
    collectionAggregateRepository, // 使用集合聚合仓储
    qdrantRepo,
    eventPublisher, // 注入事件发布器
    logger,
    transactionManager, // 使用统一事务管理器
    infraEnhancedLogger || enhancedLogger, // 注入增强日志器
  );
  const documentService: IDocumentService = new DocumentService(
    documentAggregateRepository, // 使用文档聚合仓储
    importService,
    qdrantRepo, // Add QdrantRepo dependency
    eventPublisher, // 注入事件发布器
    logger,
    infraEnhancedLogger || enhancedLogger, // 注入增强日志器
  );

  // 使用增强的文件处理服务，同时保持向后兼容
  const fileProcessingService: IFileProcessingService =
    new EnhancedFileProcessingService(
      dbRepo,
      fileProcessorRegistry,
      fileLoader,
      logger,
    );

  // 暂时禁用监控服务，因为它依赖持久化状态机
  // TODO: 重构监控服务以支持内存状态机
  const monitoringService: MonitoringService | null = null;
  // 如果在测试环境中，立即停止监控服务以避免长期定时器导致 Jest 无法退出
  if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
    try {
      // 监控服务在当前实现中被禁用（为 null），因此无需调用 stop()
      logger.info('监控服务在测试环境中未启用，跳过停止步骤');
    } catch (e) {
      logger.warn('在尝试停止监控服务时发生错误（测试环境）', { error: e });
    }
  }
  const alertService = new AlertService(dbRepo, logger); // 使用TypeORM Repository
  // 在测试环境中停止告警服务（告警服务内部有定时器）
  if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
    try {
      alertService.stop();
      logger.info('告警服务在测试环境中已停止以避免未关闭的句柄');
    } catch (e) {
      logger.warn('在尝试停止告警服务时发生错误（测试环境）', { error: e });
    }
  }
  // 创建监控API服务
  const monitoringApiService: MonitoringApiService | undefined = monitoringService
    ? new MonitoringApiService(monitoringService, alertService)
    : undefined;

  // 创建批量操作服务
  const batchService: IBatchService = new BatchService(
    importService,
    collectionService,
    documentService,
    logger,
    stateMachineService,
  );

  // 初始化管线编排系统
  const streamFileLoader = new DefaultStreamFileLoader(logger);
  
  const strategyRegistry = new StrategyRegistry(logger);
  // 使用默认键注册核心策略（分块和嵌入）
  strategyRegistry.registerSplitter('default', splitter);
  strategyRegistry.registerEmbedding('default', embeddingProvider);
  
  // 创建管线步骤
  const importStep = new ImportStep(streamFileLoader, logger);
  const splitStep = new SplitStep(strategyRegistry, logger);
  const embedStep = new EmbedStep(strategyRegistry, logger);
  const indexStep = new IndexStep(dbRepo, qdrantRepo, logger);
  const retrievalStep = new RetrievalStep(strategyRegistry, embeddingProvider, logger);
  const rerankStep = new RerankStep(strategyRegistry, logger);

  logger.info('Orchestration 管线步骤已初始化', {
    stepsCount: 6,
    steps: ['ImportStep', 'SplitStep', 'EmbedStep', 'IndexStep', 'RetrievalStep', 'RerankStep'],
  });

  // 创建用例层
  const importAndIndexUseCase: IImportAndIndexUseCase =
    new ImportAndIndexUseCase(importStep, splitStep, embedStep, indexStep, logger);

  logger.info('应用服务已初始化');

  // 使用增强日志记录服务初始化完成
  const serviceLogger = infraEnhancedLogger || enhancedLogger;
  if (serviceLogger) {
    serviceLogger.info('所有应用服务初始化完成', LogTag.SYSTEM, {
      servicesCount: 15, // 大约的服务数量
      timestamp: new Date().toISOString(),
    });
  }

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
    enhancedLogger: infraEnhancedLogger || enhancedLogger, // 添加增强日志器到返回值
    stateMachineService,
    monitoringApiService,
    autoGCService,
    typeormRepo, // 添加TypeORM Repository到返回值
    transactionManager, // 添加事务管理器到返回值
    documentProcessingService, // 添加领域服务到返回值
    embeddingGenerationService,
    searchDomainService,
    collectionManagementService,
    eventSystemService, // 添加事件系统服务到返回值
    importAndIndexUseCase, // 添加用例层到返回值
  };
}

/**
 * 初始化监控服务（暂时禁用）
 *
 * TODO: 重构监控服务以支持内存状态机
 * @param dbRepo - 数据库仓库
 * @param logger - 日志器实例
 * @returns 监控服务实例
 */
export function initializeMonitoringServices(
  dbRepo: ISQLiteRepo,
  logger: Logger,
): MonitoringServices {
  // 暂时禁用监控服务，因为它依赖持久化状态机
  const monitoringService = null;

  const alertService = new AlertService(dbRepo, logger); // DIP修复：现在AlertService依赖ISQLiteRepo接口
  const monitoringApiService = null; // 暂时禁用，因为依赖监控服务

  return {
    monitoringService,
    alertService,
    monitoringApiService,
  };
}

