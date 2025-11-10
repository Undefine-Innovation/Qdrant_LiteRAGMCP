/**
 * 搜索功能集成测试
 * 测试关键词搜索和语义搜索功能
 */

import { DataSource } from 'typeorm';
import { Collection } from '@infrastructure/database/entities/Collection.js';
import { Doc } from '@infrastructure/database/entities/Doc.js';
import { Chunk } from '@infrastructure/database/entities/Chunk.js';
import { ChunkFullText } from '@infrastructure/database/entities/ChunkFullText.js';
import { SearchService } from '@application/services/core/SearchService.js';
import { ISearchService } from '@domain/repositories/ISearchService.js';
import { IKeywordRetriever } from '@domain/repositories/IKeywordRetriever.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';
import {
  initializeTestDatabase,
  getTestDataSource,
  resetTestDatabase,
  TestDataFactory,
  TestAssertions,
} from '../utils/test-data-factory.js';
import { CollectionId, DocId, PointId } from '@domain/entities/types.js';

describe('Search Functionality Integration Tests', () => {
  let dataSource: DataSource;
  let searchService: ISearchService;
  let mockKeywordRetriever: jest.Mocked<IKeywordRetriever>;
  let mockQdrantRepo: jest.Mocked<IQdrantRepo>;
  let testCollection: Collection;
  let testDocs: Doc[];
  let testChunks: Chunk[];

  beforeAll(async () => {
    dataSource = await initializeTestDatabase();

    // 创建模拟的关键词检索器
    mockKeywordRetriever = {
      search: () => Promise.resolve([]),
      searchByCollection: () => Promise.resolve([]),
      searchByDocument: () => Promise.resolve([]),
      getSearchCapabilities: () => ({ supportsKeyword: true }),
    } as any;

    // 创建模拟的Qdrant仓库
    mockQdrantRepo = {
      deletePointsByCollection: jest.fn(),
      deletePointsByDoc: jest.fn(),
      deletePoints: jest.fn(),
      ensureCollection: jest.fn(),
      getAllPointIdsInCollection: jest.fn(),
      search: jest.fn(),
      upsertCollection: jest.fn(),
    } as any;

    // 创建搜索服务
    searchService = new SearchService(
      dataSource,
      mockKeywordRetriever,
      mockQdrantRepo,
      getTestLogger(),
    );
  });

  beforeEach(async () => {
    await resetTestDatabase();
    jest.clearAllMocks();

    // 创建测试数据
    await createTestData();
  });

  async function createTestData() {
    const collectionRepository = dataSource.getRepository(Collection);
    const docRepository = dataSource.getRepository(Doc);
    const chunkRepository = dataSource.getRepository(Chunk);
    const ftsRepository = dataSource.getRepository(ChunkFullText);

    // 创建测试集合
    testCollection = await collectionRepository.save(
      TestDataFactory.createCollection({
        name: 'Search Test Collection',
      }),
    );

    // 创建测试文档
    testDocs = await docRepository.save([
      TestDataFactory.createDoc({
        collectionId: testCollection.id as CollectionId,
        name: 'AI Research Paper',
        content:
          'This paper discusses artificial intelligence and machine learning',
      }),
      TestDataFactory.createDoc({
        collectionId: testCollection.id as CollectionId,
        name: 'Web Development Guide',
        content: 'A comprehensive guide to modern web development technologies',
      }),
      TestDataFactory.createDoc({
        collectionId: testCollection.id as CollectionId,
        name: 'Database Design Patterns',
        content: 'Common patterns and best practices for database design',
      }),
    ]);

    // 创建测试块
    testChunks = await chunkRepository.save([
      TestDataFactory.createChunk({
        docId: testDocs[0].key as DocId,
        collectionId: testCollection.id as CollectionId,
        chunkIndex: 0,
        title: 'Introduction to AI',
        content:
          'Artificial intelligence is a rapidly evolving field that encompasses machine learning, neural networks, and deep learning technologies.',
      }),
      TestDataFactory.createChunk({
        docId: testDocs[0].key as DocId,
        collectionId: testCollection.id as CollectionId,
        chunkIndex: 1,
        title: 'Machine Learning Basics',
        content:
          'Machine learning algorithms enable computers to learn from data without being explicitly programmed.',
      }),
      TestDataFactory.createChunk({
        docId: testDocs[1].key as DocId,
        collectionId: testCollection.id as CollectionId,
        chunkIndex: 0,
        title: 'HTML and CSS',
        content:
          'HTML provides the structure of web pages while CSS handles the presentation and styling.',
      }),
      TestDataFactory.createChunk({
        docId: testDocs[1].key as DocId,
        collectionId: testCollection.id as CollectionId,
        chunkIndex: 1,
        title: 'JavaScript Frameworks',
        content:
          'Modern JavaScript frameworks like React, Vue, and Angular simplify complex web application development.',
      }),
      TestDataFactory.createChunk({
        docId: testDocs[2].key as DocId,
        collectionId: testCollection.id as CollectionId,
        chunkIndex: 0,
        title: 'Normalization',
        content:
          'Database normalization is the process of organizing data to reduce redundancy and improve data integrity.',
      }),
    ]);

    // 创建全文搜索数据
    for (const chunk of testChunks) {
      const ftsData = new ChunkFullText();
      ftsData.id = chunk.id;
      ftsData.chunkId = chunk.id;
      ftsData.content = chunk.content;
      await ftsRepository.save(ftsData);
    }
  }

  describe('Keyword Search', () => {
    it('应该能够通过关键词搜索块', async () => {
      // Arrange
      const searchTerm = 'artificial intelligence';
      const expectedResults = [
        {
          pointId: testChunks[0].pointId,
          docId: testChunks[0].docId,
          collectionId: testChunks[0].collectionId,
          chunkIndex: testChunks[0].chunkIndex,
          title: testChunks[0].title,
          content: testChunks[0].content,
          score: 0.9,
        },
      ];

      mockKeywordRetriever.search.mockResolvedValue(expectedResults);

      // Act
      const results = await searchService.keywordSearch(searchTerm, {
        collectionId: testCollection.id as CollectionId,
      });

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].pointId).toBe(testChunks[0].pointId);
      expect(results[0].title).toBe('Introduction to AI');
      expect(results[0].content).toContain('artificial intelligence');
      expect(mockKeywordRetriever.search).toHaveBeenCalledWith(
        searchTerm,
        expect.objectContaining({
          collectionId: testCollection.id,
        }),
      );
    });

    it('应该支持模糊搜索', async () => {
      // Arrange
      const searchTerm = 'machin learn'; // 拼写错误
      const expectedResults = [
        {
          pointId: testChunks[1].pointId,
          docId: testChunks[1].docId,
          collectionId: testChunks[1].collectionId,
          chunkIndex: testChunks[1].chunkIndex,
          title: testChunks[1].title,
          content: testChunks[1].content,
          score: 0.8,
        },
      ];

      mockKeywordRetriever.search.mockResolvedValue(expectedResults);

      // Act
      const results = await searchService.keywordSearch(searchTerm, {
        collectionId: testCollection.id as CollectionId,
        fuzzy: true,
      });

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Machine Learning Basics');
      expect(mockKeywordRetriever.search).toHaveBeenCalledWith(
        searchTerm,
        expect.objectContaining({
          fuzzy: true,
        }),
      );
    });

    it('应该支持按集合搜索', async () => {
      // Arrange
      const searchTerm = 'database';
      const expectedResults = [
        {
          pointId: testChunks[4].pointId,
          docId: testChunks[4].docId,
          collectionId: testChunks[4].collectionId,
          chunkIndex: testChunks[4].chunkIndex,
          title: testChunks[4].title,
          content: testChunks[4].content,
          score: 0.9,
        },
      ];

      mockKeywordRetriever.searchByCollection.mockResolvedValue(
        expectedResults,
      );

      // Act
      const results = await searchService.keywordSearch(searchTerm, {
        collectionId: testCollection.id as CollectionId,
      });

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Normalization');
      expect(results[0].content).toContain('database');
      expect(mockKeywordRetriever.searchByCollection).toHaveBeenCalledWith(
        searchTerm,
        testCollection.id as CollectionId,
        expect.any(Object),
      );
    });

    it('应该支持按文档搜索', async () => {
      // Arrange
      const searchTerm = 'javascript';
      const expectedResults = [
        {
          pointId: testChunks[3].pointId,
          docId: testChunks[3].docId,
          collectionId: testChunks[3].collectionId,
          chunkIndex: testChunks[3].chunkIndex,
          title: testChunks[3].title,
          content: testChunks[3].content,
          score: 0.9,
        },
      ];

      mockKeywordRetriever.searchByDocument.mockResolvedValue(expectedResults);

      // Act
      const results = await searchService.keywordSearch(searchTerm, {
        docId: testDocs[1].key as DocId,
      });

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('JavaScript Frameworks');
      expect(results[0].content).toContain('javascript');
      expect(mockKeywordRetriever.searchByDocument).toHaveBeenCalledWith(
        searchTerm,
        testDocs[1].key as DocId,
        expect.any(Object),
      );
    });

    it('应该支持分页结果', async () => {
      // Arrange
      const searchTerm = 'technology';
      const expectedResults = [
        {
          pointId: testChunks[3].pointId,
          title: 'JavaScript Frameworks',
          score: 0.9,
        },
        {
          pointId: testChunks[2].pointId,
          title: 'HTML and CSS',
          score: 0.8,
        },
      ];

      mockKeywordRetriever.search.mockResolvedValue(expectedResults);

      // Act
      const results = await searchService.keywordSearch(searchTerm, {
        collectionId: testCollection.id as CollectionId,
        page: 1,
        limit: 1,
      });

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('JavaScript Frameworks');
      expect(mockKeywordRetriever.search).toHaveBeenCalledWith(
        searchTerm,
        expect.objectContaining({
          page: 1,
          limit: 1,
        }),
      );
    });

    it('应该处理空搜索结果', async () => {
      // Arrange
      const searchTerm = 'nonexistent term';
      mockKeywordRetriever.search.mockResolvedValue([]);

      // Act
      const results = await searchService.keywordSearch(searchTerm, {
        collectionId: testCollection.id as CollectionId,
      });

      // Assert
      expect(results).toHaveLength(0);
      expect(mockKeywordRetriever.search).toHaveBeenCalledWith(
        searchTerm,
        expect.any(Object),
      );
    });
  });

  describe('Semantic Search', () => {
    it('应该能够进行语义搜索', async () => {
      // Arrange
      const searchTerm = 'machine learning algorithms';
      const expectedResults = [
        {
          pointId: testChunks[1].pointId,
          docId: testChunks[1].docId,
          collectionId: testChunks[1].collectionId,
          chunkIndex: testChunks[1].chunkIndex,
          title: testChunks[1].title,
          content: testChunks[1].content,
          score: 0.95,
        },
      ];

      mockQdrantRepo.search.mockResolvedValue(expectedResults);

      // Act
      const results = await searchService.semanticSearch(searchTerm, {
        collectionId: testCollection.id as CollectionId,
      });

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].pointId).toBe(testChunks[1].pointId);
      expect(results[0].title).toBe('Machine Learning Basics');
      expect(results[0].score).toBe(0.95);
      expect(mockQdrantRepo.search).toHaveBeenCalledWith(
        searchTerm,
        expect.objectContaining({
          collectionId: testCollection.id,
        }),
      );
    });

    it('应该支持相似度阈值', async () => {
      // Arrange
      const searchTerm = 'web development';
      const allResults = [
        {
          pointId: testChunks[2].pointId,
          title: 'HTML and CSS',
          score: 0.7,
        },
        {
          pointId: testChunks[3].pointId,
          title: 'JavaScript Frameworks',
          score: 0.9,
        },
      ];

      mockQdrantRepo.search.mockResolvedValue(allResults);

      // Act
      const results = await searchService.semanticSearch(searchTerm, {
        collectionId: testCollection.id as CollectionId,
        threshold: 0.8,
      });

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('JavaScript Frameworks');
      expect(results[0].score).toBeGreaterThan(0.8);
      expect(mockQdrantRepo.search).toHaveBeenCalledWith(
        searchTerm,
        expect.objectContaining({
          threshold: 0.8,
        }),
      );
    });

    it('应该支持限制结果数量', async () => {
      // Arrange
      const searchTerm = 'artificial intelligence';
      const allResults = [
        {
          pointId: testChunks[0].pointId,
          title: 'Introduction to AI',
          score: 0.95,
        },
        {
          pointId: 'other-chunk-id',
          title: 'Other AI Content',
          score: 0.9,
        },
      ];

      mockQdrantRepo.search.mockResolvedValue(allResults);

      // Act
      const results = await searchService.semanticSearch(searchTerm, {
        collectionId: testCollection.id as CollectionId,
        limit: 1,
      });

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Introduction to AI');
      expect(mockQdrantRepo.search).toHaveBeenCalledWith(
        searchTerm,
        expect.objectContaining({
          limit: 1,
        }),
      );
    });

    it('应该处理搜索错误', async () => {
      // Arrange
      const searchTerm = 'test query';
      mockQdrantRepo.search.mockRejectedValue(
        new Error('Search service unavailable'),
      );

      // Act & Assert
      await expect(
        searchService.semanticSearch(searchTerm, {
          collectionId: testCollection.id as CollectionId,
        }),
      ).rejects.toThrow('Search service unavailable');
    });
  });

  describe('Hybrid Search', () => {
    it('应该能够结合关键词和语义搜索', async () => {
      // Arrange
      const searchTerm = 'machine learning';
      const keywordResults = [
        {
          pointId: testChunks[1].pointId,
          title: 'Machine Learning Basics',
          score: 0.8,
        },
      ];

      const semanticResults = [
        {
          pointId: testChunks[0].pointId,
          title: 'Introduction to AI',
          score: 0.9,
        },
        {
          pointId: testChunks[1].pointId,
          title: 'Machine Learning Basics',
          score: 0.85,
        },
      ];

      mockKeywordRetriever.search.mockResolvedValue(keywordResults);
      mockQdrantRepo.search.mockResolvedValue(semanticResults);

      // Act
      const results = await searchService.hybridSearch(searchTerm, {
        collectionId: testCollection.id as CollectionId,
        keywordWeight: 0.3,
        semanticWeight: 0.7,
      });

      // Assert
      expect(results).toHaveLength(2);
      // 结果应该按组合分数排序
      expect(results[0].title).toBe('Introduction to AI');
      expect(results[1].title).toBe('Machine Learning Basics');

      // 验证权重计算
      expect(results[0].score).toBeCloseTo(0.9 * 0.7, 2); // 语义分数 * 语义权重
      expect(results[1].score).toBeCloseTo(0.8 * 0.3 + 0.85 * 0.7, 2); // 关键词分数 * 关键词权重 + 语义分数 * 语义权重
    });

    it('应该支持不同的权重配置', async () => {
      // Arrange
      const searchTerm = 'database design';
      const keywordResults = [
        {
          pointId: testChunks[4].pointId,
          title: 'Normalization',
          score: 0.9,
        },
      ];

      const semanticResults = [
        {
          pointId: testChunks[4].pointId,
          title: 'Normalization',
          score: 0.7,
        },
      ];

      mockKeywordRetriever.search.mockResolvedValue(keywordResults);
      mockQdrantRepo.search.mockResolvedValue(semanticResults);

      // Act
      const results = await searchService.hybridSearch(searchTerm, {
        collectionId: testCollection.id as CollectionId,
        keywordWeight: 0.8,
        semanticWeight: 0.2,
      });

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].score).toBeCloseTo(0.9 * 0.8 + 0.7 * 0.2, 2);
    });
  });

  describe('Search Performance', () => {
    it('应该能够高效处理大量搜索请求', async () => {
      // Arrange
      const searchCount = 100;
      const searchTerm = 'test query';
      const mockResults = [
        {
          pointId: testChunks[0].pointId,
          title: 'Test Result',
          score: 0.9,
        },
      ];

      mockKeywordRetriever.search.mockResolvedValue(mockResults);

      // Act
      const startTime = Date.now();
      const promises = [];

      for (let i = 0; i < searchCount; i++) {
        promises.push(
          searchService.keywordSearch(`${searchTerm} ${i}`, {
            collectionId: testCollection.id as CollectionId,
          }),
        );
      }

      await Promise.all(promises);
      const endTime = Date.now();

      // Assert
      const searchTime = endTime - startTime;
      console.log(`Processed ${searchCount} searches in ${searchTime}ms`);

      // 性能断言：处理100个搜索请求应该在合理时间内完成（例如10秒）
      expect(searchTime).toBeLessThan(10000);
      expect(mockKeywordRetriever.search).toHaveBeenCalledTimes(searchCount);
    });

    it('应该能够缓存搜索结果', async () => {
      // Arrange
      const searchTerm = 'cached query';
      const mockResults = [
        {
          pointId: testChunks[0].pointId,
          title: 'Cached Result',
          score: 0.9,
        },
      ];

      mockKeywordRetriever.search.mockResolvedValue(mockResults);

      // Act
      const startTime1 = Date.now();
      const results1 = await searchService.keywordSearch(searchTerm, {
        collectionId: testCollection.id as CollectionId,
        useCache: true,
      });
      const endTime1 = Date.now();

      const startTime2 = Date.now();
      const results2 = await searchService.keywordSearch(searchTerm, {
        collectionId: testCollection.id as CollectionId,
        useCache: true,
      });
      const endTime2 = Date.now();

      // Assert
      expect(results1).toEqual(results2);
      expect(endTime1 - startTime1).toBeGreaterThan(endTime2 - startTime2);

      // 第二次搜索应该更快（使用缓存）
      expect(mockKeywordRetriever.search).toHaveBeenCalledTimes(1); // 只调用一次，第二次使用缓存
    });
  });

  describe('Search Analytics', () => {
    it('应该记录搜索统计', async () => {
      // Arrange
      const searchTerm = 'analytics test';
      const mockResults = [
        {
          pointId: testChunks[0].pointId,
          title: 'Analytics Result',
          score: 0.9,
        },
      ];

      mockKeywordRetriever.search.mockResolvedValue(mockResults);

      // Act
      const results = await searchService.keywordSearch(searchTerm, {
        collectionId: testCollection.id as CollectionId,
        trackAnalytics: true,
      });

      // Assert
      expect(results).toHaveLength(1);

      // 验证搜索统计被记录
      const analytics = await searchService.getSearchAnalytics({
        collectionId: testCollection.id as CollectionId,
        dateRange: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24小时前
          end: new Date(),
        },
      });

      expect(analytics.totalSearches).toBeGreaterThan(0);
      expect(analytics.searchTerms).toContain(searchTerm);
    });

    it('应该提供热门搜索词', async () => {
      // Arrange
      const popularTerms = [
        'machine learning',
        'artificial intelligence',
        'database design',
      ];

      // 模拟多次搜索
      for (const term of popularTerms) {
        mockKeywordRetriever.search.mockResolvedValue([]);
        await searchService.keywordSearch(term, {
          collectionId: testCollection.id as CollectionId,
          trackAnalytics: true,
        });
      }

      // Act
      const topTerms = await searchService.getTopSearchTerms({
        collectionId: testCollection.id as CollectionId,
        limit: 5,
      });

      // Assert
      expect(topTerms).toHaveLength(3);
      expect(topTerms.map((t) => t.term)).toEqual(
        expect.arrayContaining(popularTerms),
      );
    });
  });

  describe('Search Quality', () => {
    it('应该提供相关性评分', async () => {
      // Arrange
      const searchTerm = 'machine learning';
      const mockResults = [
        {
          pointId: testChunks[1].pointId,
          title: 'Machine Learning Basics',
          content:
            'Machine learning algorithms enable computers to learn from data',
          score: 0.95,
        },
        {
          pointId: testChunks[0].pointId,
          title: 'Introduction to AI',
          content: 'Artificial intelligence is a rapidly evolving field',
          score: 0.7,
        },
      ];

      mockKeywordRetriever.search.mockResolvedValue(mockResults);

      // Act
      const results = await searchService.keywordSearch(searchTerm, {
        collectionId: testCollection.id as CollectionId,
        includeRelevanceScore: true,
      });

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].relevanceScore).toBeGreaterThan(
        results[1].relevanceScore,
      );
      expect(results[0].relevanceScore).toBeCloseTo(0.95, 2);
    });

    it('应该支持搜索结果高亮', async () => {
      // Arrange
      const searchTerm = 'machine learning';
      const mockResults = [
        {
          pointId: testChunks[1].pointId,
          title: 'Machine Learning Basics',
          content:
            'Machine learning algorithms enable computers to learn from data',
          score: 0.95,
        },
      ];

      mockKeywordRetriever.search.mockResolvedValue(mockResults);

      // Act
      const results = await searchService.keywordSearch(searchTerm, {
        collectionId: testCollection.id as CollectionId,
        highlight: true,
      });

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].highlightedTitle).toContain('<mark>');
      expect(results[0].highlightedContent).toContain('<mark>');
      expect(results[0].highlightedTitle).toContain('Machine Learning');
      expect(results[0].highlightedContent).toContain('machine learning');
    });
  });
});
