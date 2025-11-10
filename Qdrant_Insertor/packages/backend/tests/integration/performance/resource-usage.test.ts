import { CollectionId } from '@domain/entities/types.js';
import { TestDataFactory } from '../utils/test-data-factory.js';
import {
  describePerformance,
  setupPerformanceSuite,
} from './performance-test-utils.js';

describePerformance('Memory and Resource Usage', () => {
  const suite = setupPerformanceSuite();

  it('应该能够控制内存使用', async () => {
    const { transactionManager } = suite;
    const initialMemory = process.memoryUsage();
    const largeDataSize = 100000;

    const startTime = Date.now();
    const largeCollections = Array.from({ length: largeDataSize }, (_, i) =>
      TestDataFactory.createCollection({
        name: `Memory Test Collection ${i}`,
        description: 'x'.repeat(100),
      }),
    );

    const batchSize = 1000;
    for (let i = 0; i < largeCollections.length; i += batchSize) {
      const batch = largeCollections.slice(i, i + batchSize);

      const context = transactionManager.beginTransaction({
        operation: 'memory-test-batch',
      });

      for (const collection of batch) {
        await transactionManager.executeOperation(context.transactionId, {
          type: 'CREATE',
          target: 'collection',
          targetId: collection.id as CollectionId,
          data: collection,
        });
      }

      await transactionManager.commit(context.transactionId);

      if (i % (batchSize * 10) === 0 && global.gc) {
        global.gc();
      }
    }

    const processingTime = Date.now() - startTime;
    const memoryIncrease =
      process.memoryUsage().heapUsed - initialMemory.heapUsed;

    console.log(
      `Processed ${largeDataSize} collections in ${processingTime}ms`,
    );
    console.log(`Memory increase: ${memoryIncrease / 1024 / 1024}MB`);

    expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024);
  });

  it('应该能够高效使用数据库连接', async () => {
    const { transactionManager } = suite;
    const connectionCount = 100;

    const startTime = Date.now();
    const promises = Array.from({ length: connectionCount }, async (_, i) => {
      const context = transactionManager.beginTransaction({
        operation: `connection-test-${i}`,
      });

      await transactionManager.executeOperation(context.transactionId, {
        type: 'CREATE',
        target: 'collection',
        targetId: `conn-test-${i}` as CollectionId,
        data: { name: `Connection Test Collection ${i}` },
      });

      await transactionManager.commit(context.transactionId);
      return { index: i, success: true };
    });

    const results = await Promise.all(promises);
    const processingTime = Date.now() - startTime;
    const avgTimePerOperation = processingTime / connectionCount;

    console.log(
      `Executed ${connectionCount} concurrent operations in ${processingTime}ms`,
    );
    console.log(`Average time per operation: ${avgTimePerOperation}ms`);

    expect(results).toHaveLength(connectionCount);
    expect(results.every((r) => r.success)).toBe(true);
    expect(avgTimePerOperation).toBeLessThan(10);
  });
});
