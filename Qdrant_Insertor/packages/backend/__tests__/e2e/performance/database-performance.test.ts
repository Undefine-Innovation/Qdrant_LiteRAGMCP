import { Collection } from '@infrastructure/database/entities/Collection.js';
import { Doc } from '@infrastructure/database/entities/Doc.js';
import { Chunk } from '@infrastructure/database/entities/Chunk.js';
import { CollectionId, DocId, PointId } from '@domain/entities/types.js';
import { TestDataFactory } from '../../integration/test-data-factory.js';
import {
  describePerformance,
  setupPerformanceSuite,
} from './performance-test-utils.js';

describePerformance('Database Performance', () => {
  const suite = setupPerformanceSuite();

  it('应该能够高效处理大量集合创建', async () => {
    const { transactionManager, dataSource } = suite;
    const collectionCount = 1000;
    const collections = Array.from({ length: collectionCount }, (_, i) =>
      TestDataFactory.createCollection({
        name: `Performance Collection ${i}`,
      }),
    );

    const startTime = Date.now();
    const context = transactionManager.beginTransaction({
      operation: 'bulk-collection-creation',
    });

    for (const collection of collections) {
      await transactionManager.executeOperation(context.transactionId, {
        type: 'CREATE',
        target: 'collection',
        targetId: collection.id as CollectionId,
        data: collection,
      });
    }

    await transactionManager.commit(context.transactionId);
    const processingTime = Date.now() - startTime;
    const avgTimePerCollection = processingTime / collectionCount;

    console.log(
      `Created ${collectionCount} collections in ${processingTime}ms`,
    );
    console.log(`Average time per collection: ${avgTimePerCollection}ms`);

    expect(avgTimePerCollection).toBeLessThan(10);

    const collectionRepository = dataSource.getRepository(Collection);
    const savedCollections = await collectionRepository.find();
    expect(savedCollections).toHaveLength(collectionCount);
  });

  it('应该能够高效处理大量文档创建', async () => {
    const { transactionManager, dataSource, testCollection } = suite;
    const docCount = 5000;
    const docs = Array.from({ length: docCount }, (_, i) =>
      TestDataFactory.createDoc({
        collectionId: testCollection.id as CollectionId,
        name: `Performance Document ${i}`,
        content: `Content for performance document ${i}`,
      }),
    );

    const startTime = Date.now();
    const context = transactionManager.beginTransaction({
      operation: 'bulk-document-creation',
    });

    const batchSize = 100;
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = docs.slice(i, i + batchSize);

      for (const doc of batch) {
        await transactionManager.executeOperation(context.transactionId, {
          type: 'CREATE',
          target: 'document',
          targetId: doc.id as DocId,
          data: doc,
        });
      }

      if (i + batchSize < docs.length) {
        await transactionManager.commit(context.transactionId);
        const newContext = transactionManager.beginTransaction({
          operation: 'bulk-document-creation-continued',
        });
        Object.assign(context, newContext);
      }
    }

    await transactionManager.commit(context.transactionId);
    const processingTime = Date.now() - startTime;
    const avgTimePerDoc = processingTime / docCount;

    console.log(`Created ${docCount} documents in ${processingTime}ms`);
    console.log(`Average time per document: ${avgTimePerDoc}ms`);

    expect(avgTimePerDoc).toBeLessThan(5);

    const docRepository = dataSource.getRepository(Doc);
    const savedDocs = await docRepository.find({
      where: { collectionId: testCollection.id as CollectionId },
    });
    expect(savedDocs).toHaveLength(docCount);
  });

  it('应该能够高效处理大量块创建', async () => {
    const { transactionManager, dataSource, testCollection } = suite;
    const chunkCount = 10000;
    const chunks = Array.from({ length: chunkCount }, (_, i) =>
      TestDataFactory.createChunk({
        docId: `perf-doc-${Math.floor(i / 100)}` as DocId,
        collectionId: testCollection.id as CollectionId,
        chunkIndex: i % 100,
        title: `Performance Chunk ${i}`,
        content: `Content for performance chunk ${i}`,
      }),
    );

    const startTime = Date.now();
    const context = transactionManager.beginTransaction({
      operation: 'bulk-chunk-creation',
    });

    const batchSize = 500;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);

      for (const chunk of batch) {
        await transactionManager.executeOperation(context.transactionId, {
          type: 'CREATE',
          target: 'chunk',
          targetId: chunk.id as PointId,
          data: chunk,
        });
      }

      if (i + batchSize < chunks.length) {
        await transactionManager.commit(context.transactionId);
        const newContext = transactionManager.beginTransaction({
          operation: 'bulk-chunk-creation-continued',
        });
        Object.assign(context, newContext);
      }
    }

    await transactionManager.commit(context.transactionId);
    const processingTime = Date.now() - startTime;
    const avgTimePerChunk = processingTime / chunkCount;

    console.log(`Created ${chunkCount} chunks in ${processingTime}ms`);
    console.log(`Average time per chunk: ${avgTimePerChunk}ms`);

    expect(avgTimePerChunk).toBeLessThan(2);

    const chunkRepository = dataSource.getRepository(Chunk);
    const savedChunks = await chunkRepository.find({
      where: { collectionId: testCollection.id as CollectionId },
    });
    expect(savedChunks).toHaveLength(chunkCount);
  });

  it('应该能够高效处理复杂查询', async () => {
    const { dataSource, testCollection } = suite;
    const docRepository = dataSource.getRepository(Doc);
    const chunkRepository = dataSource.getRepository(Chunk);

    const docs = await docRepository.save(
      Array.from({ length: 1000 }, (_, i) =>
        TestDataFactory.createDoc({
          collectionId: testCollection.id as CollectionId,
          name: `Query Test Document ${i}`,
        }),
      ),
    );

    await chunkRepository.save(
      docs.flatMap((doc) =>
        Array.from({ length: 10 }, (_, i) =>
          TestDataFactory.createChunk({
            docId: doc.key as DocId,
            collectionId: testCollection.id as CollectionId,
            chunkIndex: i,
            title: `Query Test Chunk ${i}`,
            content: `Content for query test chunk ${i}`,
          }),
        ),
      ),
    );

    const startTime = Date.now();

    const complexQueries = [
      chunkRepository
        .createQueryBuilder('chunk')
        .leftJoin('chunk.doc', 'doc')
        .leftJoin('doc.collection', 'collection')
        .where('collection.name = :collectionName', {
          collectionName: 'Performance Test Collection',
        })
        .andWhere('chunk.chunkIndex BETWEEN :start AND :end', {
          start: 0,
          end: 5,
        })
        .getMany(),
      chunkRepository
        .createQueryBuilder('chunk')
        .select('doc.name', 'documentName')
        .addSelect('COUNT(chunk.id)', 'chunkCount')
        .leftJoin('chunk.doc', 'doc')
        .where('doc.collectionId = :collectionId', {
          collectionId: testCollection.id,
        })
        .groupBy('doc.id')
        .having('COUNT(chunk.id) > :minChunks', { minChunks: 5 })
        .getMany(),
      chunkRepository
        .createQueryBuilder('chunk')
        .where(
          'chunk.docId IN (SELECT id FROM doc WHERE collectionId = :collectionId LIMIT 100)',
          {
            collectionId: testCollection.id,
          },
        )
        .orderBy('chunk.chunkIndex', 'DESC')
        .limit(50)
        .getMany(),
    ];

    const results = await Promise.all(complexQueries);
    const queryTime = Date.now() - startTime;

    console.log(
      `Executed ${complexQueries.length} complex queries in ${queryTime}ms`,
    );

    expect(results[0]).toHaveLength(expect.any(Number));
    expect(results[1]).toHaveLength(expect.any(Number));
    expect(results[2]).toHaveLength(50);
    expect(queryTime).toBeLessThan(5000);
  });
});
