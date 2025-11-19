import { BaseRepository } from '@infrastructure/database/repositories/BaseRepository.js';
import { BatchOperationManager } from '@infrastructure/database/repositories/BatchOperationManager.js';
import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { Doc } from '@infrastructure/database/entities/Doc.js';
import { Chunk } from '@infrastructure/database/entities/Chunk.js';
import { CollectionId, DocId } from '@domain/entities/types.js';
import { TestDataFactory } from '../../integration/test-data-factory.js';
import {
  describePerformance,
  setupPerformanceSuite,
  PerformanceMeasurer,
  MemoryMonitor,
  ThroughputCalculator,
} from './performance-test-utils.js';

describePerformance('Performance Benchmark Tests', () => {
  const suite = setupPerformanceSuite();
  let dataSource: DataSource;
  let baseRepository: BaseRepository;
  let batchManager: BatchOperationManager;
  let mockLogger: Logger;
  let performanceMeasurer: PerformanceMeasurer;
  let memoryMonitor: MemoryMonitor;

  beforeEach(() => {
    dataSource = suite.dataSource;
    mockLogger = suite.logger;
    baseRepository = new BaseRepository(dataSource, mockLogger);
    batchManager = new BatchOperationManager(mockLogger);
    performanceMeasurer = new PerformanceMeasurer();
    memoryMonitor = new MemoryMonitor();
  });

  describe('文档批量操作性能基准', () => {
    it('基准测试：传统循环插入 vs 批量插入', async () => {
      const docCount = 1000;
      const testCollectionId = 'benchmark-collection' as CollectionId;

      // 准备测试数据
      const documents = Array.from({ length: docCount }, (_, i) =>
        TestDataFactory.createDoc({
          collectionId: testCollectionId,
          name: `Benchmark Document ${i}`,
          content: `Benchmark content for document ${i}`,
        }),
      );

      // 测试传统循环插入
      memoryMonitor.record();
      const endTraditionalInsert = performanceMeasurer.start(
        'Traditional Loop Insert',
      );

      for (const doc of documents) {
        await baseRepository.create('Doc', doc);
      }

      const traditionalTime = endTraditionalInsert();
      memoryMonitor.record();

      // 清理数据
      await baseRepository.deleteAll('Doc');
      await dataSource.query('DELETE FROM sqlite_sequence WHERE name="doc"');

      // 测试批量插入
      memoryMonitor.record();
      const endBatchInsert = performanceMeasurer.start('Batch Insert');

      await baseRepository.createBatch('Doc', documents);

      const batchTime = endBatchInsert();
      memoryMonitor.record();

      // 计算性能提升
      const speedupRatio = traditionalTime / batchTime;
      const traditionalThroughput = ThroughputCalculator.calculate(
        docCount,
        traditionalTime,
      );
      const batchThroughput = ThroughputCalculator.calculate(
        docCount,
        batchTime,
      );

      console.log('\n=== Document Insert Performance Benchmark ===');
      console.log(`Traditional Loop Insert: ${traditionalTime}ms`);
      console.log(`Batch Insert: ${batchTime}ms`);
      console.log(`Speedup: ${speedupRatio.toFixed(2)}x`);
      console.log(
        `Traditional Throughput: ${traditionalThroughput.itemsPerSecond.toFixed(2)} docs/sec`,
      );
      console.log(
        `Batch Throughput: ${batchThroughput.itemsPerSecond.toFixed(2)} docs/sec`,
      );

      const memoryStats = memoryMonitor.getStatistics();
      console.log(
        `Memory Usage - Min: ${Math.round(memoryStats.minHeapUsed / 1024 / 1024)}MB, Max: ${Math.round(memoryStats.maxHeapUsed / 1024 / 1024)}MB`,
      );
      console.log('=============================================\n');

      // 验证批量插入确实更快
      expect(speedupRatio).toBeGreaterThan(2); // 批量插入应该至少快2倍
      expect(batchTime).toBeLessThan(traditionalTime);
      expect(batchThroughput.itemsPerSecond).toBeGreaterThan(
        traditionalThroughput.itemsPerSecond,
      );
    });

    it('基准测试：传统循环更新 vs 批量更新', async () => {
      const docCount = 500;
      const testCollectionId = 'benchmark-update-collection' as CollectionId;

      // 先插入测试数据
      const documents = Array.from({ length: docCount }, (_, i) =>
        TestDataFactory.createDoc({
          collectionId: testCollectionId,
          name: `Update Benchmark Document ${i}`,
          content: `Original content for document ${i}`,
        }),
      );

      await baseRepository.createBatch('Doc', documents);

      // 准备更新数据
      const updates = documents.map((doc, i) => ({
        ...doc,
        name: `Updated Document ${i}`,
        content: `Updated content for document ${i}`,
      }));

      // 测试传统循环更新
      memoryMonitor.record();
      const endTraditionalUpdate = performanceMeasurer.start(
        'Traditional Loop Update',
      );

      for (const update of updates) {
        await baseRepository.update('Doc', update.key as DocId, update);
      }

      const traditionalTime = endTraditionalUpdate();
      memoryMonitor.record();

      // 准备第二次更新数据
      const secondUpdates = updates.map((doc, i) => ({
        ...doc,
        name: `Second Updated Document ${i}`,
        content: `Second updated content for document ${i}`,
      }));

      // 测试批量更新
      memoryMonitor.record();
      const endBatchUpdate = performanceMeasurer.start('Batch Update');

      await baseRepository.updateBatch('Doc', secondUpdates);

      const batchTime = endBatchUpdate();
      memoryMonitor.record();

      // 计算性能提升
      const speedupRatio = traditionalTime / batchTime;
      const traditionalThroughput = ThroughputCalculator.calculate(
        docCount,
        traditionalTime,
      );
      const batchThroughput = ThroughputCalculator.calculate(
        docCount,
        batchTime,
      );

      console.log('\n=== Document Update Performance Benchmark ===');
      console.log(`Traditional Loop Update: ${traditionalTime}ms`);
      console.log(`Batch Update: ${batchTime}ms`);
      console.log(`Speedup: ${speedupRatio.toFixed(2)}x`);
      console.log(
        `Traditional Throughput: ${traditionalThroughput.itemsPerSecond.toFixed(2)} docs/sec`,
      );
      console.log(
        `Batch Throughput: ${batchThroughput.itemsPerSecond.toFixed(2)} docs/sec`,
      );
      console.log('=============================================\n');

      // 验证批量更新确实更快
      expect(speedupRatio).toBeGreaterThan(1.5); // 批量更新应该至少快1.5倍
      expect(batchTime).toBeLessThan(traditionalTime);
    });
  });

  describe('数据块批量操作性能基准', () => {
    it('基准测试：数据块批量插入性能', async () => {
      const chunkCount = 2000;
      const testCollectionId = 'benchmark-chunk-collection' as CollectionId;
      const testDocId = 'benchmark-doc' as DocId;

      // 准备测试数据
      const chunks = Array.from({ length: chunkCount }, (_, i) =>
        TestDataFactory.createChunk({
          collectionId: testCollectionId,
          docId: testDocId,
          chunkIndex: i,
          content: `Chunk content ${i}`,
        }),
      );

      // 测试传统循环插入
      memoryMonitor.record();
      const endTraditionalInsert = performanceMeasurer.start(
        'Traditional Chunk Loop Insert',
      );

      for (const chunk of chunks) {
        await baseRepository.create('Chunk', chunk);
      }

      const traditionalTime = endTraditionalInsert();
      memoryMonitor.record();

      // 清理数据
      await baseRepository.deleteAll('Chunk');
      await dataSource.query('DELETE FROM sqlite_sequence WHERE name="chunk"');

      // 测试批量插入
      memoryMonitor.record();
      const endBatchInsert = performanceMeasurer.start('Batch Chunk Insert');

      await baseRepository.createBatch('Chunk', chunks);

      const batchTime = endBatchInsert();
      memoryMonitor.record();

      // 计算性能提升
      const speedupRatio = traditionalTime / batchTime;
      const traditionalThroughput = ThroughputCalculator.calculate(
        chunkCount,
        traditionalTime,
      );
      const batchThroughput = ThroughputCalculator.calculate(
        chunkCount,
        batchTime,
      );

      console.log('\n=== Chunk Insert Performance Benchmark ===');
      console.log(`Traditional Loop Insert: ${traditionalTime}ms`);
      console.log(`Batch Insert: ${batchTime}ms`);
      console.log(`Speedup: ${speedupRatio.toFixed(2)}x`);
      console.log(
        `Traditional Throughput: ${traditionalThroughput.itemsPerSecond.toFixed(2)} chunks/sec`,
      );
      console.log(
        `Batch Throughput: ${batchThroughput.itemsPerSecond.toFixed(2)} chunks/sec`,
      );
      console.log('==========================================\n');

      // 验证批量插入确实更快
      expect(speedupRatio).toBeGreaterThan(3); // 数据块批量插入应该至少快3倍
      expect(batchTime).toBeLessThan(traditionalTime);
      expect(batchThroughput.itemsPerSecond).toBeGreaterThan(
        traditionalThroughput.itemsPerSecond,
      );
    });
  });

  describe('BatchOperationManager性能基准', () => {
    it('基准测试：不同批次大小的性能对比', async () => {
      const itemCount = 5000;
      const items = Array.from({ length: itemCount }, (_, i) => ({
        id: i,
        data: `Benchmark data ${i}`,
        timestamp: Date.now(),
      }));

      const batchSizes = [50, 100, 200, 500, 1000];
      const results: Array<{
        batchSize: number;
        time: number;
        throughput: number;
      }> = [];

      for (const batchSize of batchSizes) {
        const processor = {
          processBatch: jest.fn().mockImplementation(async (batch: any[]) => {
            // 模拟处理时间
            await new Promise((resolve) => setTimeout(resolve, 5));
            return batch.map((item) => ({ ...item, processed: true }));
          }),
        };

        memoryMonitor.record();
        const endMeasurement = performanceMeasurer.start(
          `Batch Size ${batchSize}`,
        );

        const result = await batchManager.executeBatchOperation(
          items,
          processor,
          {
            batchSize,
            maxConcurrentBatches: 2,
            enableProgressMonitoring: false,
          },
        );

        const processingTime = endMeasurement();
        memoryMonitor.record();

        const throughput = ThroughputCalculator.calculate(
          itemCount,
          processingTime,
        );
        results.push({
          batchSize,
          time: processingTime,
          throughput: throughput.itemsPerSecond,
        });

        console.log(
          `Batch size ${batchSize}: ${processingTime}ms (${throughput.itemsPerSecond.toFixed(2)} items/sec)`,
        );
      }

      // 找到最佳批次大小
      const bestResult = results.reduce((best, current) =>
        current.throughput > best.throughput ? current : best,
      );

      console.log('\n=== Batch Size Performance Benchmark ===');
      results.forEach((result) => {
        console.log(
          `Batch Size ${result.batchSize}: ${result.throughput.toFixed(2)} items/sec`,
        );
      });
      console.log(
        `Best batch size: ${bestResult.batchSize} with ${bestResult.throughput.toFixed(2)} items/sec`,
      );
      console.log('========================================\n');

      // 验证批次大小对性能有显著影响
      const minThroughput = Math.min(...results.map((r) => r.throughput));
      const maxThroughput = Math.max(...results.map((r) => r.throughput));
      const throughputVariation = maxThroughput / minThroughput;

      expect(throughputVariation).toBeGreaterThan(1.5); // 批次大小应该对性能有显著影响
      expect(bestResult.throughput).toBeGreaterThan(100); // 最佳吞吐量应该大于100项/秒
    });

    it('基准测试：并发处理 vs 串行处理', async () => {
      const itemCount = 3000;
      const items = Array.from({ length: itemCount }, (_, i) => ({
        id: i,
        data: `Concurrency test data ${i}`,
      }));

      const processor = {
        processBatch: jest.fn().mockImplementation(async (batch: any[]) => {
          // 模拟处理时间
          await new Promise((resolve) => setTimeout(resolve, 20));
          return batch.map((item) => ({ ...item, processed: true }));
        }),
      };

      // 测试串行处理
      memoryMonitor.record();
      const endSerial = performanceMeasurer.start('Serial Processing');

      await batchManager.executeBatchOperation(items, processor, {
        batchSize: 100,
        maxConcurrentBatches: 1, // 串行处理
        enableProgressMonitoring: false,
      });

      const serialTime = endSerial();
      memoryMonitor.record();

      // 测试并发处理
      memoryMonitor.record();
      const endConcurrent = performanceMeasurer.start('Concurrent Processing');

      await batchManager.executeBatchOperation(items, processor, {
        batchSize: 100,
        maxConcurrentBatches: 4, // 并发处理
        enableProgressMonitoring: false,
      });

      const concurrentTime = endConcurrent();
      memoryMonitor.record();

      // 计算性能提升
      const speedupRatio = serialTime / concurrentTime;
      const serialThroughput = ThroughputCalculator.calculate(
        itemCount,
        serialTime,
      );
      const concurrentThroughput = ThroughputCalculator.calculate(
        itemCount,
        concurrentTime,
      );

      console.log('\n=== Concurrency Performance Benchmark ===');
      console.log(
        `Serial Processing: ${serialTime}ms (${serialThroughput.itemsPerSecond.toFixed(2)} items/sec)`,
      );
      console.log(
        `Concurrent Processing: ${concurrentTime}ms (${concurrentThroughput.itemsPerSecond.toFixed(2)} items/sec)`,
      );
      console.log(`Speedup: ${speedupRatio.toFixed(2)}x`);
      console.log('=====================================\n');

      // 验证并发处理确实更快
      expect(speedupRatio).toBeGreaterThan(1.5); // 并发处理应该至少快1.5倍
      expect(concurrentTime).toBeLessThan(serialTime);
      expect(concurrentThroughput.itemsPerSecond).toBeGreaterThan(
        serialThroughput.itemsPerSecond,
      );
    });
  });

  afterEach(() => {
    // 打印性能统计报告
    performanceMeasurer.printReport();
    memoryMonitor.printReport();

    // 重置测量器
    performanceMeasurer.reset();
    memoryMonitor.reset();
  });
});
