import { QdrantRepo } from '@infrastructure/repositories/QdrantRepository.js';
import { AppConfig } from '@config/config.js';
import { Logger } from '@logging/logger.js';
import { CollectionId, Point } from '@domain/entities/types.js';
import {
  describePerformance,
  setupPerformanceSuite,
} from './performance-test-utils.js';

describePerformance('QdrantRepository Performance', () => {
  const suite = setupPerformanceSuite();
  let qdrantRepo: QdrantRepo;
  let testCollectionId: CollectionId;
  let mockLogger: Logger;

  beforeAll(async () => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    // 创建测试配置
    const testConfig: AppConfig = {
      qdrant: {
        url: process.env.QDRANT_URL || 'http://localhost:6333',
        collection: 'test-performance-collection',
        vectorSize: 1536,
      },
    } as AppConfig;

    qdrantRepo = new QdrantRepo(testConfig, mockLogger);
    testCollectionId = 'test-performance-collection' as CollectionId;

    // 确保测试集合存在
    await qdrantRepo.ensureCollection();
  });

  afterAll(async () => {
    // 清理测试数据
    try {
      await qdrantRepo.deletePointsByCollection(testCollectionId);
    } catch (error) {
      console.warn('Failed to cleanup test collection:', error);
    }
  });

  it('应该能够高效处理大批量向量插入', async () => {
    const pointCount = 5000;
    const points: Point[] = Array.from({ length: pointCount }, (_, i) => ({
      id: `${testCollectionId}_${i}`,
      vector: Array.from({ length: 1536 }, () => Math.random()),
      payload: {
        content: `Test content for point ${i}`,
        titleChain: `Document ${i}`,
        docId: `doc_${i}`,
        collectionId: testCollectionId,
        chunkIndex: i,
      },
    }));

    const progressUpdates: any[] = [];

    const startTime = Date.now();
    await qdrantRepo.upsertCollection(testCollectionId, points, {
      batchSize: 200,
      maxConcurrentBatches: 3,
      enableProgressMonitoring: true,
      onProgress: (progress) => {
        progressUpdates.push({
          processed: progress.processed,
          total: progress.total,
          percentage: progress.percentage,
          currentBatch: progress.currentBatch,
          totalBatches: progress.totalBatches,
        });
      },
    });
    const processingTime = Date.now() - startTime;
    const avgTimePerPoint = processingTime / pointCount;
    const throughput = pointCount / (processingTime / 1000);

    console.log(`Upserted ${pointCount} points in ${processingTime}ms`);
    console.log(`Average time per point: ${avgTimePerPoint.toFixed(2)}ms`);
    console.log(`Throughput: ${throughput.toFixed(2)} points/second`);
    console.log(`Progress updates received: ${progressUpdates.length}`);

    expect(avgTimePerPoint).toBeLessThan(10); // 每个点处理时间应小于10ms
    expect(throughput).toBeGreaterThan(100); // 吞吐量应大于100点/秒
    expect(progressUpdates.length).toBeGreaterThan(0);
  });

  it('应该能够高效处理并发批次插入', async () => {
    const pointCount = 3000;
    const points: Point[] = Array.from({ length: pointCount }, (_, i) => ({
      id: `${testCollectionId}_concurrent_${i}`,
      vector: Array.from({ length: 1536 }, () => Math.random()),
      payload: {
        content: `Concurrent test content ${i}`,
        titleChain: `Concurrent Document ${i}`,
        docId: `concurrent_doc_${i}`,
        collectionId: testCollectionId,
        chunkIndex: i,
      },
    }));

    // 测试串行处理
    const serialStartTime = Date.now();
    await qdrantRepo.upsertCollection(testCollectionId, points, {
      batchSize: 150,
      maxConcurrentBatches: 1, // 串行处理
      enableProgressMonitoring: false,
    });
    const serialTime = Date.now() - serialStartTime;

    // 清理数据
    await qdrantRepo.deletePointsByCollection(testCollectionId);

    // 测试并发处理
    const concurrentStartTime = Date.now();
    await qdrantRepo.upsertCollection(testCollectionId, points, {
      batchSize: 150,
      maxConcurrentBatches: 4, // 并发处理
      enableProgressMonitoring: false,
    });
    const concurrentTime = Date.now() - concurrentStartTime;

    const speedupRatio = serialTime / concurrentTime;
    const serialThroughput = pointCount / (serialTime / 1000);
    const concurrentThroughput = pointCount / (concurrentTime / 1000);

    console.log(
      `Serial processing: ${serialTime}ms (${serialThroughput.toFixed(2)} points/sec)`,
    );
    console.log(
      `Concurrent processing: ${concurrentTime}ms (${concurrentThroughput.toFixed(2)} points/sec)`,
    );
    console.log(`Speedup ratio: ${speedupRatio.toFixed(2)}x`);

    expect(speedupRatio).toBeGreaterThan(1.5); // 并发处理应该至少快50%
    expect(concurrentTime).toBeLessThan(serialTime);
  });

  it('应该能够处理不同批次大小的性能差异', async () => {
    const pointCount = 2000;
    const basePoints: Point[] = Array.from({ length: pointCount }, (_, i) => ({
      id: `${testCollectionId}_batchsize_${i}`,
      vector: Array.from({ length: 1536 }, () => Math.random()),
      payload: {
        content: `Batch size test content ${i}`,
        titleChain: `Batch Size Document ${i}`,
        docId: `batchsize_doc_${i}`,
        collectionId: testCollectionId,
        chunkIndex: i,
      },
    }));

    const batchSizes = [50, 100, 200, 500];
    const results: Array<{
      batchSize: number;
      time: number;
      throughput: number;
    }> = [];

    for (const batchSize of batchSizes) {
      const points = basePoints.map((p, i) => ({
        ...p,
        id: `${testCollectionId}_batchsize_${batchSize}_${i}`,
      }));

      const startTime = Date.now();
      await qdrantRepo.upsertCollection(testCollectionId, points, {
        batchSize,
        maxConcurrentBatches: 2,
        enableProgressMonitoring: false,
      });
      const processingTime = Date.now() - startTime;
      const throughput = pointCount / (processingTime / 1000);

      results.push({ batchSize, time: processingTime, throughput });

      console.log(
        `Batch size ${batchSize}: ${processingTime}ms (${throughput.toFixed(2)} points/sec)`,
      );

      // 清理数据
      await qdrantRepo.deletePointsByCollection(testCollectionId);
    }

    // 找到最佳批次大小
    const bestResult = results.reduce((best, current) =>
      current.throughput > best.throughput ? current : best,
    );

    console.log(
      `Best batch size: ${bestResult.batchSize} with ${bestResult.throughput.toFixed(2)} points/sec`,
    );

    // 验证批次大小对性能有显著影响
    const minThroughput = Math.min(...results.map((r) => r.throughput));
    const maxThroughput = Math.max(...results.map((r) => r.throughput));
    const throughputVariation = maxThroughput / minThroughput;

    expect(throughputVariation).toBeGreaterThan(1.2); // 批次大小应该对性能有显著影响
  });

  it('应该能够提供准确的进度监控', async () => {
    const pointCount = 1000;
    const points: Point[] = Array.from({ length: pointCount }, (_, i) => ({
      id: `${testCollectionId}_progress_${i}`,
      vector: Array.from({ length: 1536 }, () => Math.random()),
      payload: {
        content: `Progress test content ${i}`,
        titleChain: `Progress Document ${i}`,
        docId: `progress_doc_${i}`,
        collectionId: testCollectionId,
        chunkIndex: i,
      },
    }));

    const progressUpdates: any[] = [];

    await qdrantRepo.upsertCollection(testCollectionId, points, {
      batchSize: 100,
      maxConcurrentBatches: 2,
      enableProgressMonitoring: true,
      onProgress: (progress) => {
        progressUpdates.push({
          processed: progress.processed,
          total: progress.total,
          percentage: progress.percentage,
          currentBatch: progress.currentBatch,
          totalBatches: progress.totalBatches,
          duration: progress.duration,
        });
      },
    });

    console.log(`Received ${progressUpdates.length} progress updates`);

    expect(progressUpdates.length).toBeGreaterThan(0);

    // 检查进度更新是否合理
    const firstUpdate = progressUpdates[0];
    const lastUpdate = progressUpdates[progressUpdates.length - 1];

    expect(firstUpdate.processed).toBeGreaterThan(0);
    expect(lastUpdate.processed).toBe(pointCount);
    expect(lastUpdate.percentage).toBe(100);
    expect(lastUpdate.totalBatches).toBe(Math.ceil(pointCount / 100));

    // 检查进度是否递增
    for (let i = 1; i < progressUpdates.length; i++) {
      expect(progressUpdates[i].processed).toBeGreaterThanOrEqual(
        progressUpdates[i - 1].processed,
      );
      expect(progressUpdates[i].duration).toBeGreaterThanOrEqual(
        progressUpdates[i - 1].duration,
      );
    }
  });

  it('应该能够高效处理批量删除', async () => {
    const pointCount = 2000;
    const points: Point[] = Array.from({ length: pointCount }, (_, i) => ({
      id: `${testCollectionId}_delete_${i}`,
      vector: Array.from({ length: 1536 }, () => Math.random()),
      payload: {
        content: `Delete test content ${i}`,
        titleChain: `Delete Document ${i}`,
        docId: `delete_doc_${i}`,
        collectionId: testCollectionId,
        chunkIndex: i,
      },
    }));

    // 先插入数据
    await qdrantRepo.upsertCollection(testCollectionId, points, {
      batchSize: 200,
      maxConcurrentBatches: 2,
      enableProgressMonitoring: false,
    });

    // 获取所有点ID
    const pointIds = points.map((p) => p.id);

    // 测试批量删除性能
    const startTime = Date.now();
    await qdrantRepo.deletePoints(testCollectionId, pointIds);
    const deleteTime = Date.now() - startTime;
    const avgTimePerPoint = deleteTime / pointCount;
    const deleteThroughput = pointCount / (deleteTime / 1000);

    console.log(`Deleted ${pointCount} points in ${deleteTime}ms`);
    console.log(`Average time per point: ${avgTimePerPoint.toFixed(2)}ms`);
    console.log(
      `Delete throughput: ${deleteThroughput.toFixed(2)} points/second`,
    );

    expect(avgTimePerPoint).toBeLessThan(5); // 每个点删除时间应小于5ms
    expect(deleteThroughput).toBeGreaterThan(200); // 删除吞吐量应大于200点/秒
  });
});
