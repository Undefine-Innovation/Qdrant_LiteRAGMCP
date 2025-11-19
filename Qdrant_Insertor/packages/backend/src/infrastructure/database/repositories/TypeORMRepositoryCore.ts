import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import {
  Collection,
  ChunkMeta,
  SystemMetrics,
  AlertRules,
  AlertHistory,
  SystemHealth,
  ScrapeResults,
} from '../entities/index.js';
import { BaseRepository } from './BaseRepository.js';
import { CollectionRepository } from './CollectionRepository.js';
import { DocRepository } from './DocRepository.js';
import { ChunkRepository } from './ChunkRepository.js';
import { ChunkFullTextRepository } from './ChunkFullTextRepository.js';
import { ChunkMetaRepository } from './ChunkMetaRepository.js';
import { ScrapeResultsRepository } from './ScrapeResultsRepository.js';
import { SystemHealthRepository } from './SystemHealthRepository.js';
import { SystemMetricsRepository } from './SystemMetricsRepository.js';
import { AlertRulesRepository } from './AlertRulesRepository.js';
import { AlertHistoryRepository } from './AlertHistoryRepository.js';
import {
  CollectionRepositoryAdapter,
  DocRepositoryAdapter,
  ChunkRepositoryAdapter,
} from './CompatibilityAdapter.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';
import { IKeywordRetriever } from '@domain/repositories/IKeywordRetriever.js';
import { PostgreSQLKeywordRetriever } from './PostgreSQLKeywordRetriever.js';
import {
  KeywordRetrieverFactory,
  DatabaseType,
} from './KeywordRetrieverFactory.js';
import { DAOStub } from '@infrastructure/persistence/DAOStub.js';

/** FTS占位符实体类型 */
interface FTSPlaceholder {
  id?: string;
}

/**
 * TypeORM Repository 核心类
 * 包含基础构造函数和属性初始化
 */
export class TypeORMRepositoryCore {
  // 公开的Repository实例，使用适配器保持与原有接口的兼容性
  public readonly collections: CollectionRepositoryAdapter;
  public readonly docs: DocRepositoryAdapter;
  public readonly chunksMeta: ChunkMetaRepository; // 使用具体的ChunkMetaRepository
  public readonly chunksFts5: BaseRepository<FTSPlaceholder>; // 保持兼容性，FTS功能需要单独实现
  public readonly chunks: ChunkRepositoryAdapter;
  // syncJobs (DB-backed) removed - using in-memory state machine instead
  public readonly systemMetrics: SystemMetricsRepository; // 使用具体的SystemMetricsRepository
  public readonly alertRules: AlertRulesRepository; // 使用具体的AlertRulesRepository
  public readonly systemHealth: SystemHealthRepository; // 使用具体的SystemHealthRepository
  public readonly alertHistory: AlertHistoryRepository; // 使用具体的AlertHistoryRepository
  public readonly scrapeResults: ScrapeResultsRepository; // 使用ScrapeResultsRepository

  // 数据源实例
  public readonly db: DataSource; // 保持兼容性
  public readonly core: Record<string, unknown>; // 保持兼容性
  public readonly collectionManager: DAOStub; // 兼容性占位符
  public readonly documentManager: DAOStub; // 兼容性占位符

  // 关键词检索器实例
  public readonly keywordRetriever: IKeywordRetriever;

  protected collectionRepository: CollectionRepository;
  protected docRepository: DocRepository;
  protected chunkRepository: ChunkRepository;
  protected chunkFullTextRepository: ChunkFullTextRepository;
  protected chunkMetaRepository: ChunkMetaRepository;
  // removed syncJobRepository (DB-backed)
  protected scrapeResultsRepository: ScrapeResultsRepository;
  protected systemHealthRepository: SystemHealthRepository;
  protected systemMetricsRepository: SystemMetricsRepository;
  protected alertRulesRepository: AlertRulesRepository;
  protected alertHistoryRepository: AlertHistoryRepository;

  /**
   * 创建TypeORMRepository实例
   * @param dataSource TypeORM数据源
   * @param logger 日志记录器
   * @param qdrantRepo 可选的Qdrant仓库
   */
  constructor(
    protected readonly dataSource: DataSource,
    protected readonly logger: Logger,
    protected readonly qdrantRepo?: IQdrantRepo,
  ) {
    // 初始化各个Repository
    this.collectionRepository = new CollectionRepository(dataSource, logger);
    this.docRepository = new DocRepository(dataSource, logger);
    this.chunkRepository = new ChunkRepository(dataSource, logger);
    this.chunkFullTextRepository = new ChunkFullTextRepository(
      dataSource,
      logger,
    );
    this.chunkMetaRepository = new ChunkMetaRepository(dataSource, logger);
    // SyncJobRepository (DB-backed) intentionally not created
    this.scrapeResultsRepository = new ScrapeResultsRepository(
      dataSource,
      logger,
    );
    this.systemHealthRepository = new SystemHealthRepository(
      dataSource,
      logger,
    );
    this.systemMetricsRepository = new SystemMetricsRepository(
      dataSource,
      logger,
    );
    this.alertRulesRepository = new AlertRulesRepository(dataSource, logger);
    this.alertHistoryRepository = new AlertHistoryRepository(
      dataSource,
      logger,
    );

    // 创建统一适配器实例
    this.collections = new CollectionRepositoryAdapter(
      this.collectionRepository,
      dataSource,
    );
    this.docs = new DocRepositoryAdapter(this.docRepository, dataSource);
    this.chunks = new ChunkRepositoryAdapter(this.chunkRepository, dataSource);

    // 创建其他Repository实例
    this.chunksFts5 = new BaseRepository<FTSPlaceholder>(
      dataSource,
      class FTSPlaceholderEntity {
        id?: string;
      } as unknown as new () => FTSPlaceholder,
      logger,
    );
    // this.syncJobs removed (DB-backed sync jobs are no longer supported)
    this.systemMetrics = this.systemMetricsRepository;
    this.alertRules = this.alertRulesRepository;
    this.systemHealth = this.systemHealthRepository;
    this.alertHistory = this.alertHistoryRepository;
    this.scrapeResults = this.scrapeResultsRepository;

    // 创建关键词检索器
    this.keywordRetriever = KeywordRetrieverFactory.createPostgreSQL(
      dataSource,
      logger,
    );

    // 为了保持兼容性，创建DAO存根对象
    this.db = dataSource;
    this.core = {};
    this.collectionManager = new DAOStub();
    this.documentManager = new DAOStub();
  }

  /**
   * 获取数据源实例
   * @returns 数据源实例
   */
  getDataSource(): DataSource {
    return this.dataSource;
  }

  /**
   * 获取关键词检索器实例
   * @returns 关键词检索器实例
   */
  getKeywordRetriever(): IKeywordRetriever {
    return this.keywordRetriever;
  }

  /**
   * 检查全文搜索是否可用
   * @returns 是否支持全文搜索
   */
  isFullTextSearchSupported(): boolean {
    return KeywordRetrieverFactory.isFullTextSearchSupported(this.dataSource);
  }

  /**
   * 获取全文搜索能力信息
   * @returns 全文搜索能力信息
   */
  getFullTextSearchCapabilities() {
    return KeywordRetrieverFactory.getFullTextSearchCapabilities(
      this.dataSource,
    );
  }
}
