import { Doc } from '@infrastructure/database/entities/Doc.js';
import { Chunk } from '@infrastructure/database/entities/Chunk.js';
import { CollectionId, DocId } from '@domain/entities/types.js';
import { TestDataFactory } from '../utils/test-data-factory.js';
import {
  describePerformance,
  setupPerformanceSuite,
} from './performance-test-utils.js';

describePerformance('Batch Operations Performance', () => {
  const suite = setupPerformanceSuite();

  it('应该能够高效处理文档批量上传', async () => {
    const { batchService, testCollection } = suite;
    const batchSize = 1000;
    const documents = Array.from({ length: batchSize }, (_, i) => ({
      name: `Batch Document ${i}`,
      content: `Content for batch document ${i}`,
      mime: 'text/plain',
    }));

    const startTime = Date.now();
    const result = await batchService.batchUploadDocuments(
      testCollection.id as CollectionId,
      documents,
      { batchSize: 100 },
    );
    const processingTime = Date.now() - startTime;
    const avgTimePerDoc = processingTime / batchSize;

    console.log(`Batch uploaded ${batchSize} documents in ${processingTime}ms`);
    console.log(`Average time per document: ${avgTimePerDoc}ms`);

    expect(result.success).toBe(true);
    expect(result.imported).toHaveLength(batchSize);
    expect(avgTimePerDoc).toBeLessThan(3);
  });

  it('应该能够高效处理批量删除', async () => {
    const { dataSource, batchService, testCollection } = suite;
    const docRepository = dataSource.getRepository(Doc);
    const chunkRepository = dataSource.getRepository(Chunk);

    const docs = await docRepository.save(
      Array.from({ length: 2000 }, (_, i) =>
        TestDataFactory.createDoc({
          collectionId: testCollection.id as CollectionId,
          name: `Delete Test Document ${i}`,
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
          }),
        ),
      ),
    );

    const docIds = docs.map((doc) => doc.key as DocId);

    const startTime = Date.now();
    const result = await batchService.batchDeleteDocuments(docIds);
    const processingTime = Date.now() - startTime;
    const avgTimePerDoc = processingTime / docIds.length;

    console.log(
      `Batch deleted ${docIds.length} documents in ${processingTime}ms`,
    );
    console.log(`Average time per document: ${avgTimePerDoc}ms`);

    expect(result.success).toBe(true);
    expect(result.deleted).toHaveLength(docIds.length);

    const remainingDocs = await docRepository.find({
      where: { collectionId: testCollection.id as CollectionId },
    });
    expect(remainingDocs).toHaveLength(0);

    const remainingChunks = await chunkRepository.find({
      where: { collectionId: testCollection.id as CollectionId },
    });
    expect(remainingChunks).toHaveLength(0);

    expect(avgTimePerDoc).toBeLessThan(2);
  });
});
