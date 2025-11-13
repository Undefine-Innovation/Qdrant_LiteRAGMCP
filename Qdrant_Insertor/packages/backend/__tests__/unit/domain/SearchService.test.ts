import { SearchService } from '@application/services/core/SearchService.js';
import { IEmbeddingProvider } from '@domain/entities/embedding.js';
import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';
import { IKeywordRetriever } from '@domain/repositories/IKeywordRetriever.js';
import { ISearchDomainService } from '@domain/services/index.js';
import { IDocumentAggregateRepository } from '@domain/repositories/index.js';
import { Logger } from '@logging/logger.js';
import { CollectionId } from '@domain/entities/types.js';

describe('SearchService 单元测试', () => {
  let searchService: SearchService;
  let mockEmbeddingProvider: jest.Mocked<IEmbeddingProvider>;
  let mockSqliteRepo: jest.Mocked<ISQLiteRepo>;
  let mockQdrantRepo: jest.Mocked<IQdrantRepo>;
  let mockKeywordRetriever: jest.Mocked<IKeywordRetriever>;
  let mockSearchDomainService: jest.Mocked<ISearchDomainService>;
  let mockDocumentRepository: jest.Mocked<IDocumentAggregateRepository>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockEmbeddingProvider = {
      embed: jest.fn(),
      batchEmbed: jest.fn(),
    } as unknown as jest.Mocked<IEmbeddingProvider>;

    mockSqliteRepo = {
      docs: {
        findById: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findByCollectionId: jest.fn(),
        findAll: jest.fn(),
      },
      chunkMeta: {
        create: jest.fn(),
        createBatch: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findByDocId: jest.fn(),
        findAll: jest.fn(),
      },
      transaction: jest.fn(),
    } as unknown as jest.Mocked<ISQLiteRepo>;

    mockQdrantRepo = {
      batchUpsert: jest.fn(),
      batchDelete: jest.fn(),
      search: jest.fn(),
      deleteByCollectionId: jest.fn(),
      exists: jest.fn(),
    } as unknown as jest.Mocked<IQdrantRepo>;

    mockKeywordRetriever = {
      search: jest.fn(),
    } as unknown as jest.Mocked<IKeywordRetriever>;

    mockSearchDomainService = {
      semanticSearch: jest.fn().mockResolvedValue([]),
      keywordSearch: jest.fn().mockReturnValue([]),
      hybridSearch: jest.fn().mockResolvedValue([]),
      fuseResults: jest.fn().mockReturnValue([]),
      convertToRetrievalResults: jest.fn().mockReturnValue([]),
    } as unknown as jest.Mocked<ISearchDomainService>;

    mockDocumentRepository = {
      findByCollectionId: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      findAll: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<IDocumentAggregateRepository>;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    searchService = new SearchService(
      mockEmbeddingProvider,
      mockSqliteRepo,
      mockQdrantRepo,
      mockKeywordRetriever,
      mockSearchDomainService,
      mockDocumentRepository,
      mockLogger,
    );
  });

  describe('向量搜索', () => {
    it('应该成功执行向量搜索', async () => {
      const collectionId = 'test-collection' as CollectionId;
      const queryVector = [0.1, 0.2, 0.3, 0.4, 0.5];
      const mockResults = [
        {
          id: 'point-1',
          score: 0.95,
          payload: { docId: 'doc-1', chunk: 0, text: 'test content' },
        },
      ];

      mockQdrantRepo.search = jest.fn().mockResolvedValue({
        results: mockResults,
        query_vector: queryVector,
      });

      const result = await searchService.vectorSearch(
        collectionId,
        queryVector,
        {
          limit: 10,
          scoreThreshold: 0.5,
        },
      );

      expect(mockQdrantRepo.search).toHaveBeenCalledWith(
        collectionId,
        queryVector,
        expect.objectContaining({ limit: 10, scoreThreshold: 0.5 }),
      );
      expect(result).toBeDefined();
    });

    it('应该在搜索失败时处理错误', async () => {
      const collectionId = 'test-collection' as CollectionId;
      const queryVector = [0.1, 0.2, 0.3];

      mockQdrantRepo.search = jest
        .fn()
        .mockRejectedValue(new Error('Qdrant service error'));

      await expect(
        searchService.vectorSearch(collectionId, queryVector),
      ).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('应该处理空的搜索结果', async () => {
      const collectionId = 'test-collection' as CollectionId;
      const queryVector = [0.1, 0.2, 0.3];

      mockQdrantRepo.search = jest.fn().mockResolvedValue({
        results: [],
        query_vector: queryVector,
      });

      const result = await searchService.vectorSearch(
        collectionId,
        queryVector,
      );

      expect(result).toBeDefined();
      expect(mockQdrantRepo.search).toHaveBeenCalled();
    });
  });

  describe('关键词搜索', () => {
    it('应该成功执行关键词搜索', async () => {
      const collectionId = 'test-collection' as CollectionId;
      const keyword = 'test';
      const mockDocs = [
        {
          docId: 'doc-1',
          collectionId: 'test-collection',
          content: 'test content',
        },
      ];

      mockSqliteRepo.docs.findByCollectionId = jest
        .fn()
        .mockResolvedValue(mockDocs);

      const result = await searchService.keywordSearch(collectionId, keyword);

      expect(result).toBeDefined();
      expect(mockSqliteRepo.docs.findByCollectionId).toHaveBeenCalledWith(
        collectionId,
      );
    });

    it('应该在关键词搜索中过滤空白关键词', async () => {
      const collectionId = 'test-collection' as CollectionId;

      const result = await searchService.keywordSearch(collectionId, '');

      expect(result).toBeDefined();
    });

    it('应该在关键词搜索失败时记录错误', async () => {
      const collectionId = 'test-collection' as CollectionId;
      const keyword = 'test';

      mockSqliteRepo.docs.findByCollectionId = jest
        .fn()
        .mockRejectedValue(new Error('Database error'));

      await expect(
        searchService.keywordSearch(collectionId, keyword),
      ).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('混合搜索', () => {
    it('应该成功执行混合搜索', async () => {
      const collectionId = 'test-collection' as CollectionId;
      const queryVector = [0.1, 0.2, 0.3];
      const keyword = 'test';

      mockQdrantRepo.search = jest.fn().mockResolvedValue({
        results: [
          {
            id: 'point-1',
            score: 0.95,
            payload: { docId: 'doc-1', text: 'test' },
          },
        ],
      });

      mockSqliteRepo.docs.findByCollectionId = jest.fn().mockResolvedValue([]);

      const result = await searchService.hybridSearch(
        collectionId,
        queryVector,
        keyword,
        { vectorWeight: 0.7, keywordWeight: 0.3 },
      );

      expect(result).toBeDefined();
    });

    it('应该处理混合搜索中的向量和关键词权重', async () => {
      const collectionId = 'test-collection' as CollectionId;
      const queryVector = [0.1, 0.2, 0.3];
      const keyword = 'test';

      mockQdrantRepo.search = jest.fn().mockResolvedValue({
        results: [],
      });

      mockSqliteRepo.docs.findByCollectionId = jest.fn().mockResolvedValue([]);

      const result = await searchService.hybridSearch(
        collectionId,
        queryVector,
        keyword,
        { vectorWeight: 0.6, keywordWeight: 0.4 },
      );

      expect(result).toBeDefined();
      expect(mockQdrantRepo.search).toHaveBeenCalled();
    });

    it('应该在混合搜索失败时处理错误', async () => {
      const collectionId = 'test-collection' as CollectionId;
      const queryVector = [0.1, 0.2, 0.3];
      const keyword = 'test';

      mockQdrantRepo.search = jest
        .fn()
        .mockRejectedValue(new Error('Search error'));

      await expect(
        searchService.hybridSearch(collectionId, queryVector, keyword),
      ).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('搜索验证', () => {
    it('应该验证查询向量的有效性', async () => {
      const collectionId = 'test-collection' as CollectionId;
      const invalidVector: number[] = [];

      mockQdrantRepo.search = jest
        .fn()
        .mockRejectedValue(new Error('Invalid vector'));

      await expect(
        searchService.vectorSearch(collectionId, invalidVector),
      ).rejects.toThrow();
    });

    it('应该处理超大搜索结果集', async () => {
      const collectionId = 'test-collection' as CollectionId;
      const queryVector = [0.1, 0.2, 0.3];
      const largeResults = Array.from({ length: 1000 }, (_, i) => ({
        id: `point-${i}`,
        score: 0.9 - i * 0.0001,
        payload: { docId: `doc-${i}`, chunk: 0 },
      }));

      mockQdrantRepo.search = jest.fn().mockResolvedValue({
        results: largeResults,
      });

      const result = await searchService.vectorSearch(
        collectionId,
        queryVector,
        {
          limit: 1000,
        },
      );

      expect(result).toBeDefined();
    });
  });

  describe('搜索性能', () => {
    it('应该在合理时间内完成搜索', async () => {
      const collectionId = 'test-collection' as CollectionId;
      const queryVector = [0.1, 0.2, 0.3];

      mockQdrantRepo.search = jest.fn().mockResolvedValue({
        results: [],
      });

      const startTime = Date.now();
      await searchService.vectorSearch(collectionId, queryVector);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // 应该5秒内完成
    });

    it('应该支持并发搜索', async () => {
      const collectionId = 'test-collection' as CollectionId;
      const queryVector = [0.1, 0.2, 0.3];

      mockQdrantRepo.search = jest.fn().mockResolvedValue({
        results: [],
      });

      const searches = Array.from({ length: 10 }, () =>
        searchService.vectorSearch(collectionId, queryVector),
      );

      const results = await Promise.all(searches);

      expect(results).toHaveLength(10);
      expect(mockQdrantRepo.search).toHaveBeenCalledTimes(10);
    });
  });
});
