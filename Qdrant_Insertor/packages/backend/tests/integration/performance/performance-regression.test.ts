import { CollectionId, DocId, PointId } from '@domain/entities/types.js';
import { TestDataFactory } from '../utils/test-data-factory.js';
import {
  describePerformance,
  setupPerformanceSuite,
} from './performance-test-utils.js';

describePerformance('Performance Regression Tests', () => {
  const suite = setupPerformanceSuite();

  it('应该检测性能回归', async () => {
    const baselineMetrics = {
      collectionCreation: 5,
      documentCreation: 3,
      chunkCreation: 2,
      searchTime: 50,
    };

    const performanceResults = await runPerformanceBenchmarks();

    console.log('Performance Benchmark Results:', performanceResults);

    expect(performanceResults.collectionCreation).toBeLessThan(
      baselineMetrics.collectionCreation * 1.2,
    );
    expect(performanceResults.documentCreation).toBeLessThan(
      baselineMetrics.documentCreation * 1.2,
    );
    expect(performanceResults.chunkCreation).toBeLessThan(
      baselineMetrics.chunkCreation * 1.2,
    );
    expect(performanceResults.searchTime).toBeLessThan(
      baselineMetrics.searchTime * 1.2,
    );
  });

  async function runPerformanceBenchmarks() {
    const { transactionManager, searchService, testCollection } = suite;
    const collectionCount = 100;
    const docCount = 500;
    const chunkCount = 1000;
    const searchCount = 50;

    const collectionStartTime = Date.now();
    const collections = Array.from({ length: collectionCount }, (_, i) =>
      TestDataFactory.createCollection({
        name: `Benchmark Collection ${i}`,
      }),
    );

    const collectionContext = transactionManager.beginTransaction({
      operation: 'benchmark-collections',
    });

    for (const collection of collections) {
      await transactionManager.executeOperation(collectionContext.transactionId, {
        type: 'CREATE',
        target: 'collection',
        targetId: collection.id as CollectionId,
        data: collection,
      });
    }

    await transactionManager.commit(collectionContext.transactionId);
    const collectionCreationTime = Date.now() - collectionStartTime;

    const docStartTime = Date.now();
    const docs = Array.from({ length: docCount }, (_, i) =>
      TestDataFactory.createDoc({
        collectionId: testCollection.id as CollectionId,
        name: `Benchmark Document ${i}`,
      }),
    );

    const docContext = transactionManager.beginTransaction({
      operation: 'benchmark-docs',
    });

    for (const doc of docs) {
      await transactionManager.executeOperation(docContext.transactionId, {
        type: 'CREATE',
        target: 'document',
        targetId: doc.id as DocId,
        data: doc,
      });
    }

    await transactionManager.commit(docContext.transactionId);
    const documentCreationTime = Date.now() - docStartTime;

    const chunkStartTime = Date.now();
    const chunks = Array.from({ length: chunkCount }, (_, i) =>
      TestDataFactory.createChunk({
        docId: 'benchmark-doc' as DocId,
        collectionId: testCollection.id as CollectionId,
        chunkIndex: i,
      }),
    );

    const chunkContext = transactionManager.beginTransaction({
      operation: 'benchmark-chunks',
    });

    for (const chunk of chunks) {
      await transactionManager.executeOperation(chunkContext.transactionId, {
        type: 'CREATE',
        target: 'chunk',
        targetId: chunk.id as PointId,
        data: chunk,
      });
    }

    await transactionManager.commit(chunkContext.transactionId);
    const chunkCreationTime = Date.now() - chunkStartTime;

    const searchStartTime = Date.now();
    const searchPromises = [];

    for (let i = 0; i < searchCount; i++) {
      searchPromises.push(
        searchService.keywordSearch(`benchmark search ${i}`, {
          collectionId: testCollection.id as CollectionId,
          limit: 10,
        }),
      );
    }

    await Promise.all(searchPromises);
    const searchTime = Date.now() - searchStartTime;

    return {
      collectionCreation: collectionCreationTime / collectionCount,
      documentCreation: documentCreationTime / docCount,
      chunkCreation: chunkCreationTime / chunkCount,
      searchTime: searchTime / searchCount,
    };
  }
});
