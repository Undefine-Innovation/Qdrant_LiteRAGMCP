import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { BaseRepository } from '../../../src/infrastructure/database/repositories/BaseRepository.js';
import { ChunkBatchOperations } from '../../../src/infrastructure/database/repositories/ChunkBatchOperations.js';
import { BatchOperationManager } from '../../../src/infrastructure/database/repositories/BatchOperationManager.js';
import { Chunk } from '../../../src/infrastructure/database/entities/Chunk.js';
import { DocId, CollectionId, PointId } from '@domain/entities/types.js';

/**
 * 批量操作性能测试
 * 验证优化后的批量操作性能和内存使用情况
 */
describe('批量操作性能测试', () => {
  let dataSource: DataSource;
  let logger: Logger;
  let baseRepository: BaseRepository<Chunk>;
  let chunkBatchOperations: ChunkBatchOperations;
  let batchManager: BatchOperationManager;

  beforeAll(async () => {
    // 初始化测试数据源
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [Chunk],
      synchronize: true,
      logging: false,
    });

    await dataSource.initialize();

    // 创建日志记录器
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
    } as unknown as Logger;

    // 初始化Repository
    baseRepository = new BaseRepository(dataSource, Chunk, logger);
    chunkBatchOperations = new ChunkBatchOperations(dataSource, logger);
    batchManager = new BatchOperationManager(logger);
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  describe('BaseRepository批量操作性能', () => {
    it('createBatch应该高效处理大量数据', async () => {
      const testData = Array.from({ length: 1000 }, (_, index) => ({
        id: index + 1,
        docId: `doc_${index}` as DocId,
        collectionId: `collection_${index % 10}` as CollectionId,
        pointId: `point_${index}` as PointId,
        content: `测试内容 ${index}`.repeat(100), // 较大的内容
        contentLength: 100 * 10,
        embeddingStatus: 'pending' as const,
        syncStatus: 'pending' as const,
      }));

      const startTime = Date.now();
      const results = await baseRepository.createBatch(testData, 100);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(testData.length);
      expect(duration).toBeLessThan(5000); // 应该在5秒内完成

      // 验证性能指标
      const throughput = testData.length / (duration / 1000); // 每秒处理的项目数
      expect(throughput).toBeGreaterThan(200); // 至少每秒200个项目

      console.log(
        `createBatch性能: ${testData.length}个项目耗时${duration}ms, 吞吐量: ${throughput.toFixed(2)}项/秒`,
      );
    });

    it('updateBatch应该高效处理大量更新', async () => {
      // 先创建测试数据
      const testData = Array.from({ length: 500 }, (_, index) => ({
        id: index + 1,
        docId: `doc_${index}` as DocId,
        collectionId: `collection_${index % 10}` as CollectionId,
        pointId: `point_${index}` as PointId,
        content: `测试内容 ${index}`,
        contentLength: 10,
        embeddingStatus: 'pending' as const,
        syncStatus: 'pending' as const,
      }));

      await baseRepository.createBatch(testData);

      // 测试批量更新
      const updateData = {
        embeddingStatus: 'completed' as const,
        syncStatus: 'completed' as const,
      };

      const ids = testData.map((item) => item.id);
      const startTime = Date.now();
      const result = await baseRepository.updateBatch(ids, updateData, 50);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(testData.length);
      expect(result.failed).toBe(0);
      expect(duration).toBeLessThan(3000); // 应该在3秒内完成

      const throughput = testData.length / (duration / 1000);
      expect(throughput).toBeGreaterThan(150); // 至少每秒150个更新

      console.log(
        `updateBatch性能: ${testData.length}个更新耗时${duration}ms, 吞吐量: ${throughput.toFixed(2)}项/秒`,
      );
    });

    it('softDeleteBatch应该高效处理大量删除', async () => {
      // 先创建测试数据
      const testData = Array.from({ length: 300 }, (_, index) => ({
        id: index + 1,
        docId: `doc_${index}` as DocId,
        collectionId: `collection_${index % 10}` as CollectionId,
        pointId: `point_${index}` as PointId,
        content: `测试内容 ${index}`,
        contentLength: 10,
        embeddingStatus: 'pending' as const,
        syncStatus: 'pending' as const,
      }));

      await baseRepository.createBatch(testData);

      const ids = testData.map((item) => item.id);
      const startTime = Date.now();
      const deletedCount = await baseRepository.softDeleteBatch(ids, 50);
      const duration = Date.now() - startTime;

      expect(deletedCount).toBe(testData.length);
      expect(duration).toBeLessThan(2000); // 应该在2秒内完成

      const throughput = testData.length / (duration / 1000);
      expect(throughput).toBeGreaterThan(100); // 至少每秒100个删除

      console.log(
        `softDeleteBatch性能: ${testData.length}个删除耗时${duration}ms, 吞吐量: ${throughput.toFixed(2)}项/秒`,
      );
    });
  });

  describe('ChunkBatchOperations性能', () => {
    it('createBatch应该处理大量块数据', async () => {
      const testData = Array.from({ length: 800 }, (_, index) => ({
        docId: `doc_${index}` as DocId,
        collectionId: `collection_${index % 5}` as CollectionId,
        pointId: `point_${index}` as PointId,
        content: `块内容 ${index}`.repeat(50),
        contentLength: 50 * 8,
        embeddingStatus: 'pending' as const,
        syncStatus: 'pending' as const,
      }));

      const startTime = Date.now();
      const results = await chunkBatchOperations.createBatch(testData, {
        batchSize: 50,
        maxConcurrentBatches: 2,
        enableProgressMonitoring: true,
        onProgress: (progress) => {
          expect(progress.operationId).toBeDefined();
          expect(progress.totalItems).toBe(testData.length);
          expect(progress.processedItems).toBeLessThanOrEqual(
            progress.totalItems,
          );
        },
      });
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(testData.length);
      expect(duration).toBeLessThan(8000); // 应该在8秒内完成

      const throughput = testData.length / (duration / 1000);
      expect(throughput).toBeGreaterThan(100); // 至少每秒100个块

      console.log(
        `ChunkBatchOperations.createBatch性能: ${testData.length}个块耗时${duration}ms, 吞吐量: ${throughput.toFixed(2)}块/秒`,
      );
    });
  });

  describe('BatchOperationManager性能', () => {
    it('应该高效处理大量批量操作', async () => {
      const testData = Array.from({ length: 2000 }, (_, index) => ({
        id: index + 1,
        value: `测试数据 ${index}`.repeat(20),
      }));

      const processor = {
        processBatch: async (
          batch: (typeof testData)[0][],
          batchNumber: number,
        ) => {
          // 模拟处理时间
          await new Promise((resolve) => setTimeout(resolve, 10));
          return batch.map((item) => ({
            ...item,
            processed: true,
            batchNumber,
          }));
        },
      };

      const startTime = Date.now();
      const { results, operationResult, progress } =
        await batchManager.executeBatchOperation(testData, processor, {
          batchSize: 100,
          maxConcurrentBatches: 3,
          enableProgressMonitoring: true,
          onProgress: (progressInfo) => {
            expect(progressInfo.operationId).toBeDefined();
            expect(progressInfo.totalItems).toBe(testData.length);
            expect(progressInfo.status).toBeOneOf([
              'pending',
              'processing',
              'completed',
            ]);
          },
        });
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(testData.length);
      expect(operationResult.success).toBe(testData.length);
      expect(operationResult.failed).toBe(0);
      expect(progress.status).toBe('completed');
      expect(duration).toBeLessThan(15000); // 应该在15秒内完成

      const throughput = testData.length / (duration / 1000);
      expect(throughput).toBeGreaterThan(130); // 至少每秒130个项目

      console.log(
        `BatchOperationManager性能: ${testData.length}个项目耗时${duration}ms, 吞吐量: ${throughput.toFixed(2)}项/秒`,
      );
    });

    it('应该正确处理内存管理', async () => {
      // 创建大量数据以测试内存管理
      const largeTestData = Array.from({ length: 5000 }, (_, index) => ({
        id: index + 1,
        data: 'x'.repeat(1000), // 每个项目1KB数据
      }));

      let progressUpdates = 0;
      const processor = {
        processBatch: async (
          batch: (typeof largeTestData)[0][],
          batchNumber: number,
        ) => {
          progressUpdates++;
          // 模拟内存密集型处理
          await new Promise((resolve) => setTimeout(resolve, 5));
          return batch.map((item) => ({ ...item, processed: true }));
        },
      };

      const startTime = Date.now();
      const { results, operationResult, progress } =
        await batchManager.executeBatchOperation(largeTestData, processor, {
          batchSize: 50, // 较小的批次以测试内存管理
          maxConcurrentBatches: 2,
          enableProgressMonitoring: true,
          onProgress: (progressInfo) => {
            expect(progressInfo.processedItems).toBeLessThanOrEqual(
              progressInfo.totalItems,
            );
            if (progressInfo.estimatedTimeRemaining) {
              expect(progressInfo.estimatedTimeRemaining).toBeGreaterThan(0);
            }
          },
        });
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(largeTestData.length);
      expect(operationResult.success).toBe(largeTestData.length);
      expect(progress.status).toBe('completed');
      expect(progressUpdates).toBeGreaterThan(0); // 应该有进度更新

      // 验证内存效率
      const memoryEfficiency = (largeTestData.length * 1000) / duration; // 字节/毫秒
      expect(memoryEfficiency).toBeGreaterThan(300); // 至少300字节/毫秒的处理效率

      console.log(
        `内存管理测试: ${largeTestData.length}个项目(总计${((largeTestData.length * 1000) / 1024).toFixed(2)}KB)耗时${duration}ms, 内存效率: ${memoryEfficiency.toFixed(2)}字节/毫秒`,
      );
    });
  });

  describe('并发性能测试', () => {
    it('应该支持高效的并发批量操作', async () => {
      const concurrentOperations = 5;
      const itemsPerOperation = 200;

      const operations = Array.from(
        { length: concurrentOperations },
        (_, opIndex) => {
          const testData = Array.from(
            { length: itemsPerOperation },
            (_, index) => ({
              id: opIndex * itemsPerOperation + index + 1,
              docId: `doc_${opIndex}_${index}` as DocId,
              collectionId: `collection_${opIndex}` as CollectionId,
              pointId: `point_${opIndex}_${index}` as PointId,
              content: `并发测试内容 ${opIndex}_${index}`,
              contentLength: 20,
              embeddingStatus: 'pending' as const,
              syncStatus: 'pending' as const,
            }),
          );

          return baseRepository.createBatch(testData, 50);
        },
      );

      const startTime = Date.now();
      const results = await Promise.all(operations);
      const duration = Date.now() - startTime;

      // 验证所有操作都成功
      results.forEach((result, index) => {
        expect(result).toHaveLength(itemsPerOperation);
        console.log(
          `并发操作 ${index + 1}: ${itemsPerOperation}个项目处理完成`,
        );
      });

      const totalItems = concurrentOperations * itemsPerOperation;
      const totalThroughput = totalItems / (duration / 1000);

      expect(duration).toBeLessThan(10000); // 应该在10秒内完成
      expect(totalThroughput).toBeGreaterThan(100); // 至少每秒100个项目

      console.log(
        `并发性能测试: ${concurrentOperations}个并发操作，总计${totalItems}个项目耗时${duration}ms, 总吞吐量: ${totalThroughput.toFixed(2)}项/秒`,
      );
    });
  });

  describe('性能回归测试', () => {
    it('批量操作性能应该优于循环单个操作', async () => {
      const testData = Array.from({ length: 100 }, (_, index) => ({
        id: index + 1,
        docId: `doc_${index}` as DocId,
        collectionId: `collection_${index}` as CollectionId,
        pointId: `point_${index}` as PointId,
        content: `性能测试内容 ${index}`,
        contentLength: 15,
        embeddingStatus: 'pending' as const,
        syncStatus: 'pending' as const,
      }));

      // 测试批量操作性能
      const batchStartTime = Date.now();
      await baseRepository.createBatch(testData, 50);
      const batchDuration = Date.now() - batchStartTime;

      // 测试单个操作性能
      const individualStartTime = Date.now();
      for (const item of testData) {
        await baseRepository.create(item);
      }
      const individualDuration = Date.now() - individualStartTime;

      // 批量操作应该明显更快
      const speedupRatio = individualDuration / batchDuration;
      expect(speedupRatio).toBeGreaterThan(3); // 至少快3倍

      console.log(
        `性能对比: 批量操作${batchDuration}ms vs 单个操作${individualDuration}ms, 加速比: ${speedupRatio.toFixed(2)}x`,
      );
    });
  });
});
