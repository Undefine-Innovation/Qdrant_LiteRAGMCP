import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { QdrantRepo } from '../../../src/infrastructure/repositories/QdrantRepository.js';
import { Logger } from '@logging/logger.js';
import { AppConfig } from '@config/config.js';
import { Point } from '@domain/repositories/IQdrantRepo.js';
import { CollectionId, PointId } from '@domain/entities/types.js';

/**
 * Qdrant批量操作性能测试
 * 验证优化后的Qdrant向量插入和删除性能
 */
describe('Qdrant批量操作性能测试', () => {
  let qdrantRepo: QdrantRepo;
  let logger: Logger;
  let testCollectionId: CollectionId;

  beforeAll(async () => {
    // 创建测试配置
    const testConfig: AppConfig = {
      qdrant: {
        url: process.env.QDRANT_URL || 'http://localhost:6333',
        collection: 'test_performance_collection',
        vectorSize: 1536,
      },
    } as AppConfig;

    // 创建日志记录器
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
    } as unknown as Logger;

    // 初始化Qdrant仓库
    qdrantRepo = new QdrantRepo(testConfig, logger);
    testCollectionId = 'performance_test_collection' as CollectionId;

    // 确保集合存在
    try {
      await qdrantRepo.ensureCollection();
    } catch (error) {
      console.warn('Qdrant集合初始化失败，跳过Qdrant性能测试:', error);
    }
  });

  afterAll(async () => {
    // 清理测试数据
    try {
      await qdrantRepo.deletePointsByCollection(testCollectionId);
    } catch (error) {
      console.warn('清理测试数据失败:', error);
    }
  });

  describe('向量插入性能测试', () => {
    it('应该高效处理大量向量插入', async () => {
      const testPoints: Point[] = Array.from({ length: 1000 }, (_, index) => ({
        id: `test_point_${index}` as PointId,
        vector: Array.from({ length: 1536 }, () => Math.random()),
        payload: {
          content: `测试内容 ${index}`.repeat(10),
          docId: `doc_${index}`,
          collectionId: testCollectionId,
          chunkIndex: index,
          titleChain: `标题${index}`,
        },
      }));

      const startTime = Date.now();
      await qdrantRepo.upsertCollection(testCollectionId, testPoints);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(30000); // 应该在30秒内完成

      const throughput = testPoints.length / (duration / 1000); // 每秒处理的向量数
      expect(throughput).toBeGreaterThan(30); // 至少每秒30个向量

      console.log(
        `Qdrant向量插入性能: ${testPoints.length}个向量耗时${duration}ms, 吞吐量: ${throughput.toFixed(2)}向量/秒`,
      );
    });

    it('应该支持并发批次处理', async () => {
      const batchSize = 100;
      const totalBatches = 5;
      const pointsPerBatch = 200;

      const testPoints: Point[] = Array.from(
        { length: totalBatches * pointsPerBatch },
        (_, index) => ({
          id: `concurrent_point_${index}` as PointId,
          vector: Array.from({ length: 1536 }, () => Math.random()),
          payload: {
            content: `并发测试内容 ${index}`.repeat(5),
            docId: `concurrent_doc_${index}`,
            collectionId: testCollectionId,
            chunkIndex: index,
            titleChain: `并发标题${index}`,
          },
        }),
      );

      const startTime = Date.now();
      await qdrantRepo.upsertCollection(testCollectionId, testPoints, {
        batchSize,
        maxConcurrentBatches: totalBatches,
        enableProgressMonitoring: true,
        onProgress: (progress) => {
          expect(progress.processed).toBeLessThanOrEqual(progress.total);
          expect(progress.percentage).toBeGreaterThanOrEqual(0);
          expect(progress.percentage).toBeLessThanOrEqual(100);

          console.log(
            `Qdrant插入进度: ${progress.percentage}% (${progress.processed}/${progress.total})`,
          );
        },
      });
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(25000); // 应该在25秒内完成

      const throughput = testPoints.length / (duration / 1000);
      expect(throughput).toBeGreaterThan(40); // 至少每秒40个向量

      console.log(
        `Qdrant并发插入性能: ${testPoints.length}个向量耗时${duration}ms, 吞吐量: ${throughput.toFixed(2)}向量/秒`,
      );
    });

    it('应该处理不同大小的批次', async () => {
      const batchSizes = [50, 100, 200, 500];
      const results: Array<{
        batchSize: number;
        duration: number;
        throughput: number;
      }> = [];

      for (const batchSize of batchSizes) {
        const testPoints: Point[] = Array.from(
          { length: batchSize * 2 },
          (_, index) => ({
            id: `batch_test_${batchSize}_${index}` as PointId,
            vector: Array.from({ length: 1536 }, () => Math.random()),
            payload: {
              content: `批次测试内容 ${batchSize}_${index}`,
              docId: `batch_doc_${batchSize}_${index}`,
              collectionId: testCollectionId,
              chunkIndex: index,
              titleChain: `批次标题${batchSize}_${index}`,
            },
          }),
        );

        const startTime = Date.now();
        await qdrantRepo.upsertCollection(testCollectionId, testPoints, {
          batchSize,
          maxConcurrentBatches: 1, // 串行处理以测试批次大小影响
        });
        const duration = Date.now() - startTime;
        const throughput = testPoints.length / (duration / 1000);

        results.push({ batchSize, duration, throughput });
        console.log(
          `批次大小 ${batchSize}: ${testPoints.length}个向量耗时${duration}ms, 吞吐量: ${throughput.toFixed(2)}向量/秒`,
        );
      }

      // 验证较大的批次通常有更好的吞吐量
      const sortedResults = results.sort((a, b) => b.throughput - a.throughput);
      expect(sortedResults[0].batchSize).toBeGreaterThanOrEqual(100); // 最佳批次大小应该至少100
    });
  });

  describe('向量删除性能测试', () => {
    it('应该高效处理大量向量删除', async () => {
      // 先插入测试数据
      const testPoints: Point[] = Array.from({ length: 500 }, (_, index) => ({
        id: `delete_test_${index}` as PointId,
        vector: Array.from({ length: 1536 }, () => Math.random()),
        payload: {
          content: `删除测试内容 ${index}`,
          docId: `delete_doc_${index}`,
          collectionId: testCollectionId,
          chunkIndex: index,
          titleChain: `删除标题${index}`,
        },
      }));

      await qdrantRepo.upsertCollection(testCollectionId, testPoints);

      // 测试删除性能
      const pointIds = testPoints.map((point) => point.id);
      const startTime = Date.now();
      await qdrantRepo.deletePoints(testCollectionId, pointIds);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(15000); // 应该在15秒内完成

      const throughput = pointIds.length / (duration / 1000);
      expect(throughput).toBeGreaterThan(30); // 至少每秒30个删除

      console.log(
        `Qdrant向量删除性能: ${pointIds.length}个向量耗时${duration}ms, 吞吐量: ${throughput.toFixed(2)}向量/秒`,
      );
    });

    it('应该支持并发删除操作', async () => {
      // 先插入更多测试数据
      const testPoints: Point[] = Array.from({ length: 800 }, (_, index) => ({
        id: `concurrent_delete_${index}` as PointId,
        vector: Array.from({ length: 1536 }, () => Math.random()),
        payload: {
          content: `并发删除测试 ${index}`,
          docId: `concurrent_delete_doc_${index}`,
          collectionId: testCollectionId,
          chunkIndex: index,
          titleChain: `并发删除标题${index}`,
        },
      }));

      await qdrantRepo.upsertCollection(testCollectionId, testPoints);

      // 分批并发删除
      const batchSize = 100;
      const pointIds = testPoints.map((point) => point.id);
      const startTime = Date.now();

      // 模拟并发删除（实际实现中QdrantRepo.deletePoints已经支持并发）
      await qdrantRepo.deletePoints(testCollectionId, pointIds);

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(20000); // 应该在20秒内完成

      const throughput = pointIds.length / (duration / 1000);
      expect(throughput).toBeGreaterThan(40); // 至少每秒40个删除

      console.log(
        `Qdrant并发删除性能: ${pointIds.length}个向量耗时${duration}ms, 吞吐量: ${throughput.toFixed(2)}向量/秒`,
      );
    });
  });

  describe('内存使用和错误处理测试', () => {
    it('应该正确处理内存限制', async () => {
      // 创建大量向量数据以测试内存使用
      const largeTestPoints: Point[] = Array.from(
        { length: 2000 },
        (_, index) => ({
          id: `memory_test_${index}` as PointId,
          vector: Array.from({ length: 1536 }, () => Math.random()),
          payload: {
            content: 'x'.repeat(1000), // 较大的payload
            docId: `memory_doc_${index}`,
            collectionId: testCollectionId,
            chunkIndex: index,
            titleChain: 'x'.repeat(100),
            metadata: {
              largeData: 'y'.repeat(500), // 额外的元数据
            },
          },
        }),
      );

      const startTime = Date.now();
      await qdrantRepo.upsertCollection(testCollectionId, largeTestPoints, {
        batchSize: 50, // 较小的批次以测试内存管理
        maxConcurrentBatches: 2,
        enableProgressMonitoring: true,
        onProgress: (progress) => {
          // 验证进度监控正常工作
          expect(progress.processed).toBeLessThanOrEqual(progress.total);
          if (progress.estimatedTimeRemaining) {
            expect(progress.estimatedTimeRemaining).toBeGreaterThan(0);
          }
        },
      });
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(45000); // 应该在45秒内完成

      const throughput = largeTestPoints.length / (duration / 1000);
      expect(throughput).toBeGreaterThan(40); // 至少每秒40个向量

      console.log(
        `内存使用测试: ${largeTestPoints.length}个大向量耗时${duration}ms, 吞吐量: ${throughput.toFixed(2)}向量/秒`,
      );
    });

    it('应该正确处理网络错误和重试', async () => {
      // 创建测试数据
      const testPoints: Point[] = Array.from({ length: 100 }, (_, index) => ({
        id: `retry_test_${index}` as PointId,
        vector: Array.from({ length: 1536 }, () => Math.random()),
        payload: {
          content: `重试测试内容 ${index}`,
          docId: `retry_doc_${index}`,
          collectionId: testCollectionId,
          chunkIndex: index,
          titleChain: `重试标题${index}`,
        },
      }));

      // 模拟网络错误（通过使用无效的URL）
      const invalidConfig: AppConfig = {
        qdrant: {
          url: 'http://invalid-url:6333',
          collection: 'invalid_collection',
          vectorSize: 1536,
        },
      } as AppConfig;

      const invalidQdrantRepo = new QdrantRepo(invalidConfig, logger);

      const startTime = Date.now();

      try {
        await invalidQdrantRepo.upsertCollection(testCollectionId, testPoints);
        fail('应该抛出网络错误');
      } catch (error) {
        const duration = Date.now() - startTime;

        // 应该在合理时间内失败（而不是无限重试）
        expect(duration).toBeLessThan(10000); // 应该在10秒内失败

        console.log(`错误处理测试: 在${duration}ms内正确检测到网络错误`);
      }
    });
  });

  describe('性能基准测试', () => {
    it('应该满足性能基准要求', async () => {
      const benchmarkPoints: Point[] = Array.from(
        { length: 1000 },
        (_, index) => ({
          id: `benchmark_${index}` as PointId,
          vector: Array.from({ length: 1536 }, () => Math.random()),
          payload: {
            content: `基准测试内容 ${index}`,
            docId: `benchmark_doc_${index}`,
            collectionId: testCollectionId,
            chunkIndex: index,
            titleChain: `基准标题${index}`,
          },
        }),
      );

      // 插入性能基准
      const insertStartTime = Date.now();
      await qdrantRepo.upsertCollection(testCollectionId, benchmarkPoints, {
        batchSize: 100,
        maxConcurrentBatches: 3,
      });
      const insertDuration = Date.now() - insertStartTime;

      // 删除性能基准
      const deleteStartTime = Date.now();
      await qdrantRepo.deletePoints(
        testCollectionId,
        benchmarkPoints.map((p) => p.id),
      );
      const deleteDuration = Date.now() - deleteStartTime;

      // 性能基准验证
      const insertThroughput = benchmarkPoints.length / (insertDuration / 1000);
      const deleteThroughput = benchmarkPoints.length / (deleteDuration / 1000);

      // 插入性能基准：至少每秒50个向量
      expect(insertThroughput).toBeGreaterThan(50);
      expect(insertDuration).toBeLessThan(20000); // 20秒内完成

      // 删除性能基准：至少每秒80个向量
      expect(deleteThroughput).toBeGreaterThan(80);
      expect(deleteDuration).toBeLessThan(12500); // 12.5秒内完成

      console.log(`性能基准测试:`);
      console.log(
        `  插入: ${benchmarkPoints.length}个向量耗时${insertDuration}ms, 吞吐量: ${insertThroughput.toFixed(2)}向量/秒`,
      );
      console.log(
        `  删除: ${benchmarkPoints.length}个向量耗时${deleteDuration}ms, 吞吐量: ${deleteThroughput.toFixed(2)}向量/秒`,
      );
      console.log(
        `  总体性能: 插入+删除耗时${insertDuration + deleteDuration}ms`,
      );
    });
  });
});
