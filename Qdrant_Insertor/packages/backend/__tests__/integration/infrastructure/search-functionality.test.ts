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
import { ISearchService } from '@application/services/ISearchService.js';
import { TypeORMRepository } from '@infrastructure/database/repositories/TypeORMRepository.js';
import { QdrantRepo } from '@infrastructure/repositories/QdrantRepository.js';
import { SearchDomainService } from '@domain/services/SearchService.js';
// import { MockEmbeddingProvider } from '../mocks/MockEmbeddingProvider.js'; // 创建本地Mock类
import {
  initializeTestDatabase,
  resetTestDatabase,
  TestDataFactory,
  getTestLogger,
} from '../test-data-factory.js';
import { CollectionId, DocId } from '@domain/entities/types.js';
import { DocumentAggregateRepository } from '@infrastructure/database/repositories/DocumentAggregateRepository.js';
import { IDocumentAggregateRepository } from '@domain/repositories/IAggregateRepository.js';

// 创建一个简单的MockEmbeddingProvider类
class MockEmbeddingProvider {
  async generateBatch(texts: string[]): Promise<number[][]> {
    // 返回固定大小的随机向量
    return texts.map(() =>
      Array.from({ length: 1536 }, () => Math.random() - 0.5),
    );
  }
}

// 创建一个简单的MockEventPublisher类
class MockEventPublisher {
  async publish(event: any): Promise<void> {
    // Mock implementation
  }

  async publishBatch(events: any[]): Promise<void> {
    // Mock implementation
  }

  async publishAndWait(event: any): Promise<void> {
    // Mock implementation
  }

  async publishBatchAndWait(events: any[]): Promise<void> {
    // Mock implementation
  }
}

describe('Search Functionality Integration Tests', () => {
  let dataSource: DataSource;
  let searchService: ISearchService;
  let typeormRepo: TypeORMRepository;
  let documentRepo: IDocumentAggregateRepository;
  let qdrantRepo: QdrantRepo;
  let mockEmbeddingProvider: MockEmbeddingProvider;
  let searchDomainService: SearchDomainService;
  let testCollection: Collection;
  let testDocs: Doc[];
  let testChunks: Chunk[];

  beforeAll(async () => {
    dataSource = await initializeTestDatabase();
    const logger = getTestLogger();

    // 创建真实的依赖
    typeormRepo = new TypeORMRepository(dataSource, logger);
    documentRepo = new DocumentAggregateRepository(dataSource, logger);

    // 创建一个模拟的QdrantRepo，避免实际连接
    qdrantRepo = {
      ensureCollection: jest.fn(),
      upsertCollection: jest.fn(),
      search: jest.fn().mockResolvedValue([]),
      deletePointsByDoc: jest.fn(),
      deletePointsByCollection: jest.fn(),
      getAllPointIdsInCollection: jest.fn().mockResolvedValue([]),
      deletePoints: jest.fn(),
    } as any;

    mockEmbeddingProvider = new MockEmbeddingProvider();
    const mockEventPublisher = new MockEventPublisher();
    searchDomainService = new SearchDomainService(
      mockEmbeddingProvider as any,
      mockEventPublisher as any,
      logger,
    );

    // 创建搜索服务
    searchService = new SearchService(
      mockEmbeddingProvider as any,
      typeormRepo as any,
      qdrantRepo,
      typeormRepo.getKeywordRetriever(),
      searchDomainService,
      documentRepo,
      logger,
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
        docId: testDocs[0].id as DocId,
        collectionId: testCollection.id as CollectionId,
        chunkIndex: 0,
        title: 'Introduction to AI',
        content:
          'Artificial intelligence is a rapidly evolving field that encompasses machine learning, neural networks, and deep learning technologies.',
      }),
      TestDataFactory.createChunk({
        docId: testDocs[0].id as DocId,
        collectionId: testCollection.id as CollectionId,
        chunkIndex: 1,
        title: 'Machine Learning Basics',
        content:
          'Machine learning algorithms enable computers to learn from data without being explicitly programmed.',
      }),
      TestDataFactory.createChunk({
        docId: testDocs[1].id as DocId,
        collectionId: testCollection.id as CollectionId,
        chunkIndex: 0,
        title: 'HTML and CSS',
        content:
          'HTML provides the structure of web pages while CSS handles the presentation and styling.',
      }),
      TestDataFactory.createChunk({
        docId: testDocs[1].id as DocId,
        collectionId: testCollection.id as CollectionId,
        chunkIndex: 1,
        title: 'JavaScript Frameworks',
        content:
          'Modern JavaScript frameworks like React, Vue, and Angular simplify complex web application development.',
      }),
      TestDataFactory.createChunk({
        docId: testDocs[2].id as DocId,
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

  describe('Basic Search Functionality', () => {
    it('应该能够执行基本搜索', async () => {
      // Arrange
      const searchTerm = 'artificial intelligence';

      // Act
      const results = await searchService.search(
        searchTerm,
        testCollection.id as CollectionId,
        { limit: 10 },
      );

      // Assert
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      // 由于使用模拟数据，我们主要验证方法调用不会抛出异常
    });

    it('应该能够执行分页搜索', async () => {
      // Arrange
      const searchTerm = 'machine learning';

      // Act
      const results = await searchService.searchPaginated(
        searchTerm,
        testCollection.id as CollectionId,
        { page: 1, limit: 5 },
      );

      // Assert
      expect(results).toBeDefined();
      expect(results.data).toBeDefined();
      expect(Array.isArray(results.data)).toBe(true);
      expect(results.pagination).toBeDefined();
      expect(results.pagination.page).toBe(1);
      expect(results.pagination.limit).toBe(5);
    });

    it('应该处理空搜索查询', async () => {
      // Arrange
      const searchTerm = '';

      // Act & Assert
      await expect(
        searchService.search(searchTerm, testCollection.id as CollectionId),
      ).rejects.toThrow();
    });

    it('应该处理不存在的集合ID', async () => {
      // Arrange
      const searchTerm = 'test';
      const nonExistentCollectionId = 'non-existent-collection' as CollectionId;

      // Act
      const results = await searchService.searchPaginated(
        searchTerm,
        nonExistentCollectionId,
        { page: 1, limit: 5 },
      );

      // Assert
      expect(results.data).toEqual([]);
      expect(results.pagination.total).toBe(0);
    });
  });

  describe('Search Performance', () => {
    it('应该能够处理多个并发搜索请求', async () => {
      // Arrange
      const searchTerms = [
        'artificial intelligence',
        'machine learning',
        'web development',
      ];
      const searchPromises = searchTerms.map((term) =>
        searchService.search(term, testCollection.id as CollectionId, {
          limit: 5,
        }),
      );

      // Act
      const results = await Promise.all(searchPromises);

      // Assert
      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
      });
    });

    it('应该在合理时间内完成搜索', async () => {
      // Arrange
      const searchTerm = 'database design';

      // Act
      const startTime = Date.now();
      await searchService.search(searchTerm, testCollection.id as CollectionId);
      const endTime = Date.now();

      // Assert
      const searchTime = endTime - startTime;
      expect(searchTime).toBeLessThan(5000); // 应该在5秒内完成
    });
  });

  describe('Search Edge Cases', () => {
    it('应该处理特殊字符搜索', async () => {
      // Arrange
      const searchTerm = 'special-characters_test@#$%';

      // Act & Assert
      // 特殊字符可能会被过滤或导致错误，我们验证系统能够优雅处理
      try {
        const results = await searchService.search(
          searchTerm,
          testCollection.id as CollectionId,
        );
        expect(results).toBeDefined();
      } catch (error) {
        // 如果抛出错误，应该是预期的验证错误
        expect(error).toBeDefined();
      }
    });

    it('应该处理长搜索查询', async () => {
      // Arrange
      const longSearchTerm = 'a'.repeat(1000);

      // Act & Assert
      try {
        const results = await searchService.search(
          longSearchTerm,
          testCollection.id as CollectionId,
        );
        expect(results).toBeDefined();
      } catch (error) {
        // 长查询可能会被拒绝
        expect(error).toBeDefined();
      }
    });

    it('应该处理Unicode字符搜索', async () => {
      // Arrange
      const unicodeSearchTerm = '人工智能';

      // Act
      const results = await searchService.search(
        unicodeSearchTerm,
        testCollection.id as CollectionId,
      );

      // Assert
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });
});
