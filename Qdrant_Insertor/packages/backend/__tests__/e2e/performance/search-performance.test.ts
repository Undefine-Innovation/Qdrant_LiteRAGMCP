import { Doc } from '@infrastructure/database/entities/Doc.js';
import { Chunk } from '@infrastructure/database/entities/Chunk.js';
import { CollectionId, DocId } from '@domain/entities/types.js';
import { TestDataFactory } from '../../integration/test-data-factory.js';
import {
  describePerformance,
  setupPerformanceSuite,
} from './performance-test-utils.js';

describePerformance('Search Performance', () => {
  const suite = setupPerformanceSuite();

  beforeEach(async () => {
    const { dataSource, testCollection } = suite;
    const docRepository = dataSource.getRepository(Doc);
    const chunkRepository = dataSource.getRepository(Chunk);

    const docs = await docRepository.save(
      Array.from({ length: 100 }, (_, i) =>
        TestDataFactory.createDoc({
          collectionId: testCollection.id as CollectionId,
          name: `Search Test Document ${i}`,
          content: `Document content ${i} with various terms`,
        }),
      ),
    );

    await chunkRepository.save(
      docs.flatMap((doc) =>
        Array.from({ length: 50 }, (_, i) =>
          TestDataFactory.createChunk({
            docId: doc.key as DocId,
            collectionId: testCollection.id as CollectionId,
            chunkIndex: i,
            title: `Search Test Chunk ${i}`,
            content: `Chunk content ${i} with search terms: machine learning, artificial intelligence, database, web development, performance testing`,
          }),
        ),
      ),
    );
  });

  it('应该能够高效处理关键词搜索', async () => {
    const { searchService, testCollection } = suite;
    const searchTerms = [
      'machine learning',
      'artificial intelligence',
      'database',
      'web development',
    ];
    const searchCount = 100;

    const startTime = Date.now();
    const searchPromises = [];

    for (let i = 0; i < searchCount; i++) {
      const searchTerm = searchTerms[i % searchTerms.length];
      searchPromises.push(
        searchService.keywordSearch(searchTerm, {
          collectionId: testCollection.id as CollectionId,
          limit: 20,
        }),
      );
    }

    const results = await Promise.all(searchPromises);
    const searchTime = Date.now() - startTime;
    const avgSearchTime = searchTime / searchCount;

    console.log(`Performed ${searchCount} keyword searches in ${searchTime}ms`);
    console.log(`Average search time: ${avgSearchTime}ms`);

    expect(results).toHaveLength(searchCount);
    expect(results.every((r) => Array.isArray(r))).toBe(true);
    expect(avgSearchTime).toBeLessThan(100);
  });

  it('应该能够高效处理语义搜索', async () => {
    const { searchService, testCollection } = suite;
    const searchTerms = [
      'machine learning algorithms',
      'artificial intelligence applications',
      'database design patterns',
    ];
    const searchCount = 50;

    const startTime = Date.now();
    const searchPromises = [];

    for (let i = 0; i < searchCount; i++) {
      const searchTerm = searchTerms[i % searchTerms.length];
      searchPromises.push(
        searchService.semanticSearch(searchTerm, {
          collectionId: testCollection.id as CollectionId,
          limit: 10,
        }),
      );
    }

    const results = await Promise.all(searchPromises);
    const searchTime = Date.now() - startTime;
    const avgSearchTime = searchTime / searchCount;

    console.log(
      `Performed ${searchCount} semantic searches in ${searchTime}ms`,
    );
    console.log(`Average search time: ${avgSearchTime}ms`);

    expect(results).toHaveLength(searchCount);
    expect(results.every((r) => Array.isArray(r))).toBe(true);
    expect(avgSearchTime).toBeLessThan(200);
  });

  it('应该能够高效处理混合搜索', async () => {
    const { searchService, testCollection } = suite;
    const searchTerms = [
      'performance testing',
      'database optimization',
      'search algorithms',
    ];
    const searchCount = 30;

    const startTime = Date.now();
    const searchPromises = [];

    for (let i = 0; i < searchCount; i++) {
      const searchTerm = searchTerms[i % searchTerms.length];
      searchPromises.push(
        searchService.hybridSearch(searchTerm, {
          collectionId: testCollection.id as CollectionId,
          keywordWeight: 0.3,
          semanticWeight: 0.7,
          limit: 15,
        }),
      );
    }

    const results = await Promise.all(searchPromises);
    const searchTime = Date.now() - startTime;
    const avgSearchTime = searchTime / searchCount;

    console.log(`Performed ${searchCount} hybrid searches in ${searchTime}ms`);
    console.log(`Average search time: ${avgSearchTime}ms`);

    expect(results).toHaveLength(searchCount);
    expect(results.every((r) => Array.isArray(r))).toBe(true);
    expect(avgSearchTime).toBeLessThan(150);
  });
});
