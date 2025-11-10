import { IEmbeddingProvider } from '@domain/entities/embedding.js';
import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { Logger } from '@logging/logger.js';
import {
  CollectionId,
  PointId,
  DocId,
  SearchResult as UniversalSearchResult,
  RetrievalResultDTO,
  RetrievalResultType,
  PaginationQuery,
  PaginatedResponse,
} from '@domain/entities/types.js';
import { Chunk } from '@domain/entities/Chunk.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js'; // Import IQdrantRepo
import { ISearchService } from '@domain/repositories/ISearchService.js'; // Import ISearchService
import { IKeywordRetriever } from '@domain/repositories/IKeywordRetriever.js'; // Import IKeywordRetriever
import {
  parsePaginationQuery,
  createPaginatedResponse,
} from '../../../utils/pagination.js';
import { ISearchDomainService } from '@domain/services/index.js';
import { IDocumentAggregateRepository } from '@domain/repositories/index.js';

/**
 * 搜索服务实现类
 * 提供语义搜索和关键词搜索的融合功能
 * 使用领域服务完成业务操作，处理跨聚合的协调工作
 */
export class SearchService implements ISearchService {
  // Implement ISearchService
  /**
   * 创建搜索服务实例
   * @param embeddingProvider 嵌入提供者
   * @param sqliteRepo SQLite 仓库实例
   * @param qdrantRepo Qdrant 仓库实例
   * @param keywordRetriever 关键词检索器实例（可选）
   * @param searchDomainService 搜索领域服务实例
   * @param documentRepository 文档聚合仓储实例
   * @param logger 日志记录器
   */
  constructor(
    private readonly embeddingProvider: IEmbeddingProvider,
    private readonly sqliteRepo: ISQLiteRepo,
    private readonly qdrantRepo: IQdrantRepo, // Changed to IQdrantRepo
    private readonly keywordRetriever: IKeywordRetriever | undefined,
    private readonly searchDomainService: ISearchDomainService,
    private readonly documentRepository: IDocumentAggregateRepository,
    private readonly logger: Logger,
  ) {}

  /**
   * 执行搜索
   * @param query 搜索查询字符串
   * @param collectionId 集合ID
   * @param options 搜索选项
   * @param options.limit 结果数量限制
   * @returns {Promise<RetrievalResultDTO[]>} 返回搜索结果列表
   */
  public async search(
    query: string,
    collectionId: CollectionId,
    options: { limit?: number } = {},
  ): Promise<RetrievalResultDTO[]> {
    const { limit = 10 } = options;

    this.logger.info(
      `Starting search for query "${query}" in collection "${collectionId}" with limit ${limit}.`,
    );

    try {
      // 获取集合中的所有文档聚合
      const documentAggregates =
        await this.documentRepository.findByCollectionId(collectionId);

      // 获取所有文档的块
      const allChunks: Chunk[] = [];
      for (const docAggregate of documentAggregates) {
        allChunks.push(...docAggregate.getChunks());
      }

      if (allChunks.length === 0) {
        this.logger.info('No chunks found in collection');
        return [];
      }

      // 使用领域服务执行语义搜索
      const semanticResults = await this.searchDomainService.semanticSearch(
        query,
        collectionId,
        allChunks,
        limit,
      );

      // 使用领域服务执行关键词搜索
      const keywordResults = this.searchDomainService.keywordSearch(
        query,
        collectionId,
        allChunks,
        limit,
      );

      // 使用领域服务融合结果
      const fusedResults = this.searchDomainService.fuseResults(
        semanticResults,
        keywordResults,
      );

      // 转换为RetrievalResultDTO格式
      const finalResults = this.searchDomainService.convertToRetrievalResults(
        fusedResults.slice(0, limit),
      );

      this.logger.info(
        `Found ${finalResults.length} results for query "${query}".`,
      );

      return finalResults;
    } catch (err) {
      this.logger.error(
        `An error occurred during search for query "${query}":`,
        {
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          collectionId,
        },
      );
      throw err; // Re-throw to be handled by API error middleware
    }
  }

  /**
   * 执行分页搜索
   * @param query 搜索查询字符串
   * @param collectionId 集合ID（可选）
   * @param paginationQuery 分页查询参数
   * @returns {Promise<PaginatedResponse<RetrievalResultDTO>>} 返回分页的搜索结果
   */
  public async searchPaginated(
    query: string,
    collectionId: CollectionId | undefined,
    paginationQuery: PaginationQuery,
  ): Promise<PaginatedResponse<RetrievalResultDTO>> {
    const { page, limit } = parsePaginationQuery(paginationQuery);

    this.logger.info(
      `Starting paginated search for query "${query}" in collection "${collectionId}" with page ${page} and limit ${limit}.`,
    );

    try {
      // 如果没有提供集合ID，返回空结果
      if (!collectionId) {
        this.logger.warn('Collection ID is required for search');
        return createPaginatedResponse([], 0, paginationQuery);
      }

      // 获取集合中的所有文档聚合
      const documentAggregates =
        await this.documentRepository.findByCollectionId(collectionId);

      // 获取所有文档的块
      const allChunks: Chunk[] = [];
      for (const docAggregate of documentAggregates) {
        allChunks.push(...docAggregate.getChunks());
      }

      if (allChunks.length === 0) {
        this.logger.info('No chunks found in collection');
        return createPaginatedResponse([], 0, paginationQuery);
      }

      // 使用领域服务执行语义搜索
      const semanticResults = await this.searchDomainService.semanticSearch(
        query,
        collectionId,
        allChunks,
        limit * page, // 获取更多结果以计算分页
      );

      // 使用领域服务执行关键词搜索
      const keywordResults = this.searchDomainService.keywordSearch(
        query,
        collectionId,
        allChunks,
        limit * page, // 获取更多结果以计算分页
      );

      // 使用领域服务融合结果
      const fusedResults = this.searchDomainService.fuseResults(
        semanticResults,
        keywordResults,
      );

      // 转换为RetrievalResultDTO格式
      const allResults =
        this.searchDomainService.convertToRetrievalResults(fusedResults);

      // 应用分页
      const total = allResults.length;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedResults = allResults.slice(startIndex, endIndex);

      this.logger.info(
        `Found ${total} total results for query "${query}", returning ${paginatedResults.length} for page ${page}.`,
      );

      return createPaginatedResponse(paginatedResults, total, paginationQuery);
    } catch (err) {
      this.logger.error(
        `An error occurred during search for query "${query}":`,
        {
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          collectionId,
        },
      );
      // Return empty results instead of throwing error to ensure API always returns a response
      return createPaginatedResponse([], 0, paginationQuery);
    }
  }
}
