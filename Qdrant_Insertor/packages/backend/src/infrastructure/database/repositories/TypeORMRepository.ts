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
// SyncJobRepository removed (DB-backed sync jobs are no longer supported)
import { SimpleBaseRepository } from './SimpleBaseRepository.js';
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
import {
  CollectionId,
  DocId,
  PointId,
  SearchResult,
  DocumentChunk,
  ChunkMeta as ChunkMetaType,
  PaginationQuery,
  PaginatedResponse,
  Doc as DomainDoc,
} from '@domain/entities/types.js';
import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
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
 * TypeORM Repository实现
 * 替代原有的同步SQLiteRepo，提供异步操作
 * 注意：虽然实现了 ISQLiteRepo 接口方法，但由于 TypeORM 的异步性质，
 * 某些同步方法返回空值或抛出错误。应通过类型断言使用此类。
 */
export class TypeORMRepository {
  // 公开的Repository实例，使用适配器保持与原有接口的兼容性
  public readonly collections: CollectionRepositoryAdapter;
  public readonly docs: DocRepositoryAdapter;
  public readonly chunksMeta: ChunkMetaRepository; // 使用具体的ChunkMetaRepository
  public readonly chunksFts5: SimpleBaseRepository<FTSPlaceholder>; // 保持兼容性，FTS功能需要单独实现
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

  private collectionRepository: CollectionRepository;
  private docRepository: DocRepository;
  private chunkRepository: ChunkRepository;
  private chunkFullTextRepository: ChunkFullTextRepository;
  private chunkMetaRepository: ChunkMetaRepository;
  // removed syncJobRepository (DB-backed)
  private scrapeResultsRepository: ScrapeResultsRepository;
  private systemHealthRepository: SystemHealthRepository;
  private systemMetricsRepository: SystemMetricsRepository;
  private alertRulesRepository: AlertRulesRepository;
  private alertHistoryRepository: AlertHistoryRepository;

  /**
   * 创建TypeORMRepository实例
   * @param dataSource TypeORM数据源
   * @param logger 日志记录器
   * @param qdrantRepo 可选的Qdrant仓库
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: Logger,
    private readonly qdrantRepo?: IQdrantRepo,
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

    // 创建适配器实例
    this.collections = new CollectionRepositoryAdapter(
      this.collectionRepository,
      dataSource,
    );
    this.docs = new DocRepositoryAdapter(this.docRepository, dataSource);
    this.chunks = new ChunkRepositoryAdapter(this.chunkRepository, dataSource);

    // 创建其他Repository实例
    this.chunksFts5 = new SimpleBaseRepository<FTSPlaceholder>(
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
   * 在数据库事务中执行一个函数
   * @param fn 包含数据库操作的函数
   * @returns 事务函数的返回值
   */
  transaction<T>(fn: () => T): T {
    // 为了保持接口兼容性，这里需要同步返回
    // 但TypeORM是异步的，所以我们需要抛出错误提示需要异步调用
    throw new Error(
      'TypeORMRepository.transaction需要异步调用，请使用asyncTransaction方法',
    );
  }

  /**
   * 异步事务方法
   * @param fn 包含数据库操作的函数
   * @returns 事务函数的返回值
   */
  async asyncTransaction<T>(fn: () => Promise<T>): Promise<T> {
    return await this.dataSource.transaction(async (manager) => {
      // 在事务中执行函数
      return await fn();
    });
  }

  /**
   * 删除一个集合及其所有关联的文档和块
   * @param collectionId 要删除的集合ID
   */
  async deleteCollection(collectionId: CollectionId): Promise<void> {
    await this.asyncTransaction(async () => {
      // 删除关联的块
      await this.chunkRepository.deleteByCollectionId(collectionId);

      // 删除关联的文档
      const docs = await this.docs.listByCollection(collectionId);
      for (const doc of docs) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await this.docs.delete((doc as any).docId as DocId);
      }

      // 删除集合
      await this.collections.delete(collectionId);

      this.logger.info(`删除集合成功`, { collectionId });
    });
  }

  /**
   * 删除一个文档及其所有关联的块
   * @param docId 要删除的文档ID
   * @returns 如果找到并删除了文档，则返回true，否则返回false
   */
  deleteDoc(docId: DocId): boolean {
    // 为了保持接口兼容性，这里返回false
    // 实际使用应该调用异步版本
    this.logger.warn(`deleteDoc是同步方法，请使用asyncDeleteDoc`);
    return false;
  }

  /**
   * 异步版本的deleteDoc
   * @param docId 要删除的文档ID
   * @returns 如果找到并删除了文档，则返回true，否则返回false
   */
  async asyncDeleteDoc(docId: DocId): Promise<boolean> {
    return await this.asyncTransaction(async () => {
      // 删除关联的块
      await this.chunkRepository.deleteByDocId(docId);

      // 删除文档
      const success = await this.docs.delete(docId);

      if (success) {
        this.logger.info(`删除文档成功`, { docId });
      }

      return success;
    });
  }

  /**
   * 检索块通过ID列表的详细信息
   * @param pointIds 点ID数组
   * @param collectionId 集合ID
   * @returns 搜索结果数组
   */
  getChunksByPointIds(
    pointIds: PointId[],
    collectionId: CollectionId,
  ): SearchResult[] {
    // 为了保持接口兼容性，这里返回空数组
    // 实际使用应该调用异步版本
    this.logger.warn(
      `getChunksByPointIds是同步方法，请使用asyncGetChunksByPointIds`,
    );
    return [];
  }

  /**
   * 异步版本的getChunksByPointIds
   * @param pointIds 点ID数组
   * @param collectionId 集合ID
   * @returns 搜索结果数组
   */
  async asyncGetChunksByPointIds(
    pointIds: PointId[],
    collectionId: CollectionId,
  ): Promise<SearchResult[]> {
    try {
      const chunks = await this.chunkRepository.findByPointIds(pointIds);

      // 转换为SearchResult格式
      return chunks.map((chunk) => ({
        pointId: chunk.pointId as PointId,
        docId: chunk.docId as DocId,
        collectionId: chunk.collectionId as CollectionId,
        chunkIndex: chunk.chunkIndex,
        title: chunk.title,
        content: chunk.content,
        score: 0, // TypeORM不直接支持FTS评分，设为默认值
      }));
    } catch (error) {
      this.logger.error(`获取块详细信息失败`, {
        pointIds,
        collectionId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 获取文档的块列表
   * @param docId 文档ID
   * @returns 文档块数组
   */
  getDocumentChunks(docId: DocId): Array<{
    pointId: PointId;
    docId: DocId;
    collectionId: CollectionId;
    chunkIndex: number;
    title?: string;
    content: string;
  }> {
    // 为了保持接口兼容性，这里返回空数组
    // 实际使用应该调用异步版本
    this.logger.warn(
      `getDocumentChunks是同步方法，请使用asyncGetDocumentChunks`,
    );
    return [];
  }

  /**
   * 异步版本的getDocumentChunks
   * @param docId 文档ID
   * @returns 文档块数组
   */
  async asyncGetDocumentChunks(docId: DocId): Promise<
    Array<{
      pointId: PointId;
      docId: DocId;
      collectionId: CollectionId;
      chunkIndex: number;
      title?: string;
      content: string;
    }>
  > {
    try {
      const chunks = await this.chunkRepository.findByDocId(docId);

      return chunks.map((chunk) => ({
        pointId: chunk.pointId as PointId,
        docId: chunk.docId as DocId,
        collectionId: chunk.collectionId as CollectionId,
        chunkIndex: chunk.chunkIndex,
        title: chunk.title,
        content: chunk.content,
      }));
    } catch (error) {
      this.logger.error(`获取文档块列表失败`, {
        docId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 分页获取文档的块列表
   * @param docId 文档ID
   * @param query 分页查询参数
   * @returns 分页的文档块响应
   */
  getDocumentChunksPaginated(
    docId: DocId,
    query: PaginationQuery,
  ): PaginatedResponse<{
    pointId: PointId;
    docId: DocId;
    collectionId: CollectionId;
    chunkIndex: number;
    title?: string;
    content: string;
  }> {
    // 为了保持接口兼容性，这里返回空结果
    // 实际使用应该调用异步版本
    this.logger.warn(
      `getDocumentChunksPaginated是同步方法，请使用asyncGetDocumentChunksPaginated`,
    );
    return {
      data: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    };
  }

  /**
   * 异步版本的getDocumentChunksPaginated
   * @param docId 文档ID
   * @param query 分页查询参数
   * @returns 分页的文档块响应
   */
  async asyncGetDocumentChunksPaginated(
    docId: DocId,
    query: PaginationQuery,
  ): Promise<
    PaginatedResponse<{
      pointId: PointId;
      docId: DocId;
      collectionId: CollectionId;
      chunkIndex: number;
      title?: string;
      content: string;
    }>
  > {
    try {
      const chunks = await this.chunkRepository.findByDocId(docId);

      // 手动实现分页逻辑
      const { page = 1, limit = 10 } = query;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedChunks = chunks.slice(startIndex, endIndex);

      const totalPages = Math.ceil(chunks.length / limit);

      return {
        data: paginatedChunks.map((chunk) => ({
          pointId: chunk.pointId as PointId,
          docId: chunk.docId as DocId,
          collectionId: chunk.collectionId as CollectionId,
          chunkIndex: chunk.chunkIndex,
          title: chunk.title,
          content: chunk.content,
        })),
        pagination: {
          page,
          limit,
          total: chunks.length,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      this.logger.error(`分页获取文档块列表失败`, {
        docId,
        query,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 获取文档
   * @param docId 文档ID
   * @returns 文档对象
   */
  async getDoc(docId: DocId): Promise<DomainDoc | undefined> {
    try {
      const doc = await this.docRepository.findById(docId as unknown as string);
      // 转换为领域类型
      if (doc) {
        return {
          id: doc.key as DocId, // 使用key字段作为id
          docId: doc.key as DocId, // 向后兼容
          collectionId: doc.collectionId as CollectionId,
          key: doc.key,
          name: doc.name,
          size_bytes: doc.size_bytes,
          mime: doc.mime,
          created_at:
            typeof doc.created_at === 'number'
              ? doc.created_at
              : (doc.created_at as Date)?.getTime?.() || Date.now(),
          updated_at:
            typeof doc.updated_at === 'number'
              ? doc.updated_at
              : (doc.updated_at as Date)?.getTime?.() || Date.now(),
          deleted: doc.deleted,
          content: doc.content,
        } as DomainDoc;
      }
      return undefined;
    } catch (error) {
      this.logger.error(`获取文档失败`, {
        docId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 获取文档的块元数据
   * @param docId 文档ID
   * @returns 块元数据数组
   */
  async getChunkMetasByDocId(docId: DocId): Promise<ChunkMetaType[]> {
    try {
      const chunkMetas = await this.chunkMetaRepository.findByDocId(docId);

      // 转换为领域类型
      return chunkMetas.map(
        (meta) =>
          ({
            id: meta.id as DocId,
            docId: meta.docId as DocId,
            chunkIndex: meta.chunkIndex,
            tokenCount: meta.tokenCount,
            embeddingStatus: meta.embeddingStatus as
              | 'pending'
              | 'processing'
              | 'completed'
              | 'failed',
            syncedAt: meta.syncedAt,
            error: meta.error,
            created_at: meta.created_at,
            updated_at: meta.updated_at,
            pointId: meta.pointId as PointId,
            collectionId: meta.collectionId as CollectionId,
          }) as ChunkMetaType,
      );
    } catch (error) {
      this.logger.error(`获取文档块元数据失败`, {
        docId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 获取集合的块元数据
   * @param collectionId 集合ID
   * @returns 块元数据数组
   */
  async getChunkMetasByCollectionId(
    collectionId: CollectionId,
  ): Promise<ChunkMetaType[]> {
    try {
      const chunkMetas =
        await this.chunkMetaRepository.findByCollectionId(collectionId);

      // 转换为领域类型
      return chunkMetas.map(
        (meta) =>
          ({
            id: meta.id as DocId,
            docId: meta.docId as DocId,
            chunkIndex: meta.chunkIndex,
            tokenCount: meta.tokenCount,
            embeddingStatus: meta.embeddingStatus as
              | 'pending'
              | 'processing'
              | 'completed'
              | 'failed',
            syncedAt: meta.syncedAt,
            error: meta.error,
            created_at: meta.created_at,
            updated_at: meta.updated_at,
            pointId: meta.pointId as PointId,
            collectionId: meta.collectionId as CollectionId,
          }) as ChunkMetaType,
      );
    } catch (error) {
      this.logger.error(`获取集合块元数据失败`, {
        collectionId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 检索块通过ID列表的文本内容
   * @param pointIds 点ID数组
   * @returns 一个记录，将每个pointId映射到其内容和标题
   */
  async getChunkTexts(
    pointIds: PointId[],
  ): Promise<Record<string, { content: string }>> {
    try {
      const chunks = await this.chunkRepository.findByPointIds(pointIds);

      const result: Record<string, { content: string }> = {};
      for (const chunk of chunks) {
        result[chunk.pointId] = {
          content: chunk.content,
        };
      }

      return result;
    } catch (error) {
      this.logger.error(`获取块文本内容失败`, {
        pointIds,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 添加文档块
   * @param docId 文档ID
   * @param documentChunks 文档块数组
   */
  async addChunks(
    docId: DocId,
    documentChunks: DocumentChunk[],
  ): Promise<void> {
    await this.asyncTransaction(async () => {
      const chunks = documentChunks.map((chunk, index) => ({
        pointId: `${docId}_${index}` as PointId,
        docId,
        collectionId: '' as CollectionId, // DocumentChunk没有collectionId字段，使用空字符串
        chunkIndex: index,
        title: chunk.titleChain?.join(' > ') || '', // 使用titleChain
        content: chunk.content,
      }));

      await this.chunkRepository.createBatch(chunks);

      this.logger.debug(`添加文档块成功`, {
        docId,
        count: chunks.length,
      });
    });
  }

  /**
   * 标记文档为已同步
   * @param docId 文档ID
   */
  async markDocAsSynced(docId: DocId): Promise<void> {
    try {
      // 这里需要在Doc实体中添加同步状态字段，暂时只记录日志
      this.logger.debug(`标记文档为已同步`, { docId });
      // 实际实现需要在Doc实体中添加synced_at字段
    } catch (error) {
      this.logger.error(`标记文档为已同步失败`, {
        docId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 获取所有集合的ID
   * @returns 包含所有集合ID的数组
   */
  async getAllCollectionIds(): Promise<CollectionId[]> {
    try {
      const collections = await this.collections.listAll();

      return collections.map(
        (collection: unknown) =>
          (collection as { id: string }).id as CollectionId,
      );
    } catch (error) {
      this.logger.error(`获取所有集合ID失败`, {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 初始化数据库
   * @param dbPath 数据库文件路径
   * @param logger 日志记录器
   * @returns 初始化结果
   */
  async initializeDatabase(
    dbPath: string,
    logger: Logger,
  ): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    try {
      // TypeORM会自动初始化数据库，这里只记录日志
      await this.dataSource.initialize();

      logger.info(`TypeORM数据库初始化成功`, { dbPath });

      return {
        success: true,
        message: `数据库初始化成功: ${dbPath}`,
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      logger.error(`TypeORM数据库初始化失败`, {
        dbPath,
        error: errorMessage,
      });

      return {
        success: false,
        message: `数据库初始化失败: ${dbPath}`,
        error: errorMessage,
      };
    }
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    try {
      if (this.dataSource.isInitialized) {
        await this.dataSource.destroy();
        this.logger.info(`TypeORM数据库连接已关闭`);
      }
    } catch (error) {
      this.logger.error(`关闭数据库连接失败`, {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 检查数据库连接是否存活
   * @returns 如果连接响应正常则返回true，否则返回false
   */
  ping(): boolean {
    // 为了保持接口兼容性，这里返回false
    // 实际使用应该调用异步版本
    this.logger.warn(`ping是同步方法，请使用asyncPing`);
    return false;
  }

  /**
   * 异步版本的ping
   * @returns 如果连接响应正常则返回true，否则返回false
   */
  async asyncPing(): Promise<boolean> {
    try {
      if (!this.dataSource.isInitialized) {
        return false;
      }

      // 执行简单查询测试连接
      await this.dataSource.query('SELECT 1');
      return true;
    } catch (error) {
      this.logger.warn(`数据库ping检查失败`, {
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * 列出已删除的文档
   * @returns 已删除的文档数组
   */
  listDeletedDocs(): DomainDoc[] {
    // 同步方法 - 委托到 docs 适配器
    // 由于 TypeORM 是异步的，这里返回空数组
    // 实际使用应调用 docs.findDeleted() 异步方法
    this.logger.warn(
      `listDeletedDocs是同步方法但 TypeORM 是异步的，请使用 docs.findDeleted()`,
    );
    return [];
  }

  /**
   * 硬删除文档
   * @param docId 文档ID
   */
  async hardDelete(docId: DocId): Promise<void> {
    try {
      await this.docs.delete(docId);
      this.logger.debug(`硬删除文档成功`, { docId });
    } catch (error) {
      this.logger.error(`硬删除文档失败`, {
        docId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 批量删除块元数据
   * @param pointIds 要删除的点ID数组
   */
  async deleteBatch(pointIds: PointId[]): Promise<void> {
    try {
      await this.chunkRepository.deleteByPointIds(pointIds);
      this.logger.debug(`批量删除块成功`, {
        count: pointIds.length,
      });
    } catch (error) {
      this.logger.error(`批量删除块失败`, {
        pointIds,
        error: (error as Error).message,
      });
      throw error;
    }
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
