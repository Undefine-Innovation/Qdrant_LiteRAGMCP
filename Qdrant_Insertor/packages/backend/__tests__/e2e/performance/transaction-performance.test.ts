import { CollectionId } from '@domain/entities/types.js';
import {
  describePerformance,
  setupPerformanceSuite,
} from './performance-test-utils.js';

describePerformance('Transaction Performance', () => {
  const suite = setupPerformanceSuite();

  it('应该能够高效处理大量事务', async () => {
    const { transactionManager } = suite;
    const transactionCount = 1000;

    const startTime = Date.now();

    for (let i = 0; i < transactionCount; i++) {
      const context = transactionManager.beginTransaction({
        operation: `performance-transaction-${i}`,
      });

      await transactionManager.executeOperation(context.transactionId, {
        type: 'CREATE',
        target: 'collection',
        targetId: `perf-collection-${i}` as CollectionId,
        data: { name: `Performance Collection ${i}` },
      });

      await transactionManager.commit(context.transactionId);
    }

    const processingTime = Date.now() - startTime;
    const avgTimePerTransaction = processingTime / transactionCount;

    console.log(
      `Processed ${transactionCount} transactions in ${processingTime}ms`,
    );
    console.log(`Average time per transaction: ${avgTimePerTransaction}ms`);

    expect(avgTimePerTransaction).toBeLessThan(5);
    expect(transactionManager.getActiveTransactions()).toHaveLength(0);
  });

  it('应该能够高效处理嵌套事务', async () => {
    const { transactionManager } = suite;
    const nestingLevel = 5;
    const transactionCount = 100;

    const startTime = Date.now();

    for (let i = 0; i < transactionCount; i++) {
      let contextId: string | undefined;

      for (let level = 0; level < nestingLevel; level++) {
        if (level === 0) {
          const context = transactionManager.beginTransaction({
            operation: `nested-transaction-${i}`,
          });
          contextId = context.transactionId;
        } else {
          contextId = await transactionManager.beginNestedTransaction(
            contextId!,
            {
              operation: `nested-level-${level}`,
            },
          );
        }
      }

      for (let level = nestingLevel - 1; level >= 0; level--) {
        await transactionManager.commit(contextId!);
      }
    }

    const processingTime = Date.now() - startTime;
    const avgTimePerNestedTransaction = processingTime / transactionCount;

    console.log(
      `Processed ${transactionCount} nested transactions in ${processingTime}ms`,
    );
    console.log(
      `Average time per nested transaction: ${avgTimePerNestedTransaction}ms`,
    );

    expect(avgTimePerNestedTransaction).toBeLessThan(20);
  });
});
