import { IEmbeddingProvider } from '@domain/entities/embedding.js';
import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { Logger } from '@logging/logger.js';
import {
  CollectionId,
  PointId,
  DocId,
  SearchResult as UniversalSearchResult,
  SearchResult,
  RetrievalResultDTO,
  RetrievalResultType,
  PaginationQuery,
  PaginatedResponse,
} from '@domain/entities/types.js';
import { Chunk } from '@domain/entities/Chunk.js';
import { Doc } from '@infrastructure/database/entities/Doc.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js'; // Import IQdrantRepo
import { ISearchService } from '@application/services/index.js'; // Import ISearchService from application layer
import { IKeywordRetriever } from '@domain/repositories/IKeywordRetriever.js'; // Import IKeywordRetriever
import {
  parsePaginationQuery,
  createPaginatedResponse,
} from '../../../utils/Pagination.js';
import { ISearchDomainService } from '@domain/services/index.js';
import { IDocumentAggregateRepository } from '@domain/repositories/index.js';

type QdrantSearchResponse =
  | SearchResult[]
  | {
      results?: SearchResult[];
    }
  | undefined;

type SqliteDocSummary = {
  docId?: string;
  id?: string;
  content?: string;
  name?: string;
};

type DocsRepositoryWithCollectionLookup = {
  findByCollectionId?: (
    collectionId: CollectionId,
  ) => Promise<SqliteDocSummary[]> | SqliteDocSummary[];
};

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
   * 执行向量搜索（用于测试）
   * @param collectionId 集合ID
   * @param queryVector 查询向量
   * @param options 搜索选项
   * @param options.limit 结果数量限制
   * @param options.scoreThreshold 分数阈值
   * @returns 搜索结果
   */
  public async vectorSearch(
    collectionId: CollectionId,
    queryVector: number[],
    options?: { limit?: number; scoreThreshold?: number },
  ): Promise<UniversalSearchResult[]> {
    const { limit = 10, scoreThreshold = 0 } = options || {};

    this.logger.info(
      `Starting vector search in collection "${collectionId}" with limit ${limit} and score threshold ${scoreThreshold}.`,
    );

    try {
      const raw = await this.qdrantRepo.search(collectionId, {
        vector: queryVector,
        limit,
        scoreThreshold,
      });

      const resultArray = this.normalizeSearchResults(raw);

      this.logger.info(
        `Found ${resultArray.length || 0} results for vector search.`,
      );

      return resultArray;
    } catch (err) {
      this.logger.error(
        `An error occurred during vector search in collection "${collectionId}":`,
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
   * 执行关键词搜索
   * @param collectionId 集合ID
   * @param keyword 关键词
   * @returns 搜索结果
   */
  public async keywordSearch(
    collectionId: CollectionId,
    keyword: string,
  ): Promise<UniversalSearchResult[]> {
    this.logger.info(
      `Starting keyword search for "${keyword}" in collection "${collectionId}".`,
    );

    try {
      // 过滤空白关键词
      if (!keyword || keyword.trim() === '') {
        this.logger.info('Empty keyword provided, returning empty results');
        return [];
      }

      // ��ʵ�֣���ѯ sqlite �е��ĵ��б�������һ����С�Ľ���ṹ
      const docs = await this.fetchDocsByCollection(collectionId);

      const mapped: SearchResult[] = docs.map((docRecord, index) => {
        const identifier = this.resolveDocIdentifier(docRecord);
        return {
          pointId: `${identifier}_kw_${index}` as PointId,
          docId: identifier as DocId,
          chunkIndex: 0,
          content: docRecord.content ?? '',
          collectionId,
          title: docRecord.name,
          score: 1,
        };
      });


      this.logger.info(`Found ${mapped.length} documents for keyword search.`);

      return mapped;
    } catch (err) {
      this.logger.error(
        `An error occurred during keyword search for "${keyword}" in collection "${collectionId}":`,
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
   * 执行混合搜索
   * @param collectionId 集合ID
   * @param queryVector 查询向量
   * @param keyword 关键词
   * @param weights 权重配置
   * @param weights.vectorWeight 向量搜索权重
   * @param weights.keywordWeight 关键词搜索权重
   * @returns 搜索结果
   */
  public async hybridSearch(
    collectionId: CollectionId,
    queryVector: number[],
    keyword: string,
    weights?: { vectorWeight?: number; keywordWeight?: number },
  ): Promise<UniversalSearchResult[]> {
    const { vectorWeight = 0.7, keywordWeight = 0.3 } = weights || {};

    this.logger.info(
      `Starting hybrid search for "${keyword}" in collection "${collectionId}" with vector weight ${vectorWeight} and keyword weight ${keywordWeight}.`,
    );

    try {
      // 执行向量搜索（对接 vectorSearch 的同样逻辑以保持一致性）
      const rawVector = await this.qdrantRepo.search(collectionId, {
        vector: queryVector,
        limit: 10,
      });

      const vectorResult = this.normalizeSearchResults(rawVector);

      // 执行关键词搜索 (暂时注释掉，因为keywordRetriever的接口不匹配)
      // const keywordResult = await this.keywordRetriever?.search(keyword) || [];
      const keywordResult: UniversalSearchResult[] = [];

      // 获取集合中的所有文档 (暂时返回空数组，等待实现真实的数据访问)
      // TODO: 实现真实的文档查询逻辑
      const docs: SearchResult[] = [];

      this.logger.info(
        `Found ${vectorResult.length || 0} vector results and ${keywordResult.length} keyword results.`,
      );

      // 简单的结果融合（实际实现会更复杂）
      return [...(vectorResult || []), ...keywordResult, ...docs];
    } catch (err) {
      this.logger.error(
        `An error occurred during hybrid search in collection "${collectionId}":`,
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
   * 执行文本搜索（保留原有功能）
   * @param query 搜索查询字符串
   * @param collectionId 集合ID
   * @param options 搜索选项
   * @param options.limit 结果数量限制
   * @returns {Promise<RetrievalResultDTO[]>} 返回搜索结果列表
   */
  public async searchText(
    query: string,
    collectionId: CollectionId,
    options: { limit?: number } = {},
  ): Promise<RetrievalResultDTO[]> {
    const { limit = 10 } = options;

    this.logger.info(
      `Starting text search for query "${query}" in collection "${collectionId}" with limit ${limit}.`,
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

  /**
   * 实现ISearchService接口的search方法（向后兼容）
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
    return this.searchText(query, collectionId, options);
  }

  /**
   * ��sqlite docs�ֿ��л�ȡָ�����ϵ��ĵ��б�
   * @param collectionId ����ID
   * @returns ��ȡ����ĵ�
   */
  private async fetchDocsByCollection(
    collectionId: CollectionId,
  ): Promise<SqliteDocSummary[]> {
    const repo = this.sqliteRepo.docs as DocsRepositoryWithCollectionLookup;
    if (!repo.findByCollectionId) {
      return [];
    }

    const result = await repo.findByCollectionId(collectionId);
    return Array.isArray(result) ? result : [];
  }

  /**
   * ȷ�������ĵ���ʶ
   * @param docRecord sqlite�ĵ���¼
   * @returns �ĵ�ID���ַ���
   */
  private resolveDocIdentifier(docRecord: SqliteDocSummary): string {
    return docRecord.docId ?? docRecord.id ?? 'unknown';
  }

  /**
   * ��һ����������
   * @param response Qdrant��ѯ���
   * @returns ��һ��������
   */
  private normalizeSearchResults(
    response: QdrantSearchResponse,
  ): UniversalSearchResult[] {
    if (!response) {
      return [];
    }

    return Array.isArray(response) ? response : response.results ?? [];
  }
}
