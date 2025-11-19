import { QdrantRepo } from '../../../src/infrastructure/repositories/QdrantRepository.js';
import { AppConfig } from '../../../src/config/config.js';
import { Logger } from '@logging/logger.js';
import { CollectionId, PointId } from '@domain/entities/types.js';

// Mock logger
const mockLogger: Logger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
} as unknown as Logger;

// Mock Qdrant client
const mockQdrantClient = {
  getCollections: jest.fn(),
  createCollection: jest.fn(),
  getCollection: jest.fn(),
  upsert: jest.fn(),
  search: jest.fn(),
  delete: jest.fn(),
  scroll: jest.fn(),
};

// Mock QdrantClient constructor
jest.mock('@qdrant/js-client-rest', () => ({
  QdrantClient: jest.fn(() => mockQdrantClient),
}));

describe.skip('QdrantRepository Batch Performance Tests', () => {
  let qdrantRepo: QdrantRepo;
  let mockConfig: AppConfig;

  beforeEach(() => {
    mockConfig = {
      qdrant: {
        url: 'http://localhost:6333',
        collection: 'test-collection',
        vectorSize: 1536,
      },
    } as AppConfig;

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock responses
    mockQdrantClient.getCollections.mockResolvedValue({
      collections: [{ name: 'test-collection' }],
    });

    mockQdrantClient.getCollection.mockResolvedValue({
      config: {
        params: {
          vectors: {
            size: 1536,
            distance: 'Cosine',
          },
        },
      },
    });

    qdrantRepo = new QdrantRepo(mockConfig, mockLogger);
  });

  describe('Batch Upsert Performance', () => {
    it('should handle large batch upserts efficiently', async () => {
      const collectionId: CollectionId = 'test-collection' as CollectionId;
      const points = Array.from({ length: 1000 }, (_, i) => ({
        id: `point-${i}`,
        vector: Array.from({ length: 1536 }, () => Math.random()),
        payload: {
          content: `Test content ${i}`,
          docId: `doc-${i}`,
          collectionId,
          chunkIndex: i,
        },
      }));

      mockQdrantClient.upsert.mockResolvedValue({ status: 'ok' });

      const startTime = Date.now();

      await qdrantRepo.upsertCollection(collectionId, points, {
        batchSize: 100,
        maxConcurrentBatches: 4,
        enableProgressMonitoring: true,
      });

      const duration = Date.now() - startTime;

      // 验证性能
      expect(duration).toBeLessThan(10000); // 应该在10秒内完成
      expect(mockQdrantClient.upsert).toHaveBeenCalledTimes(10); // 1000个点，批次大小100，应该有10次调用

      // 验证日志记录
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('开始向集合'),
        expect.objectContaining({
          totalPoints: 1000,
          batchSize: 100,
          maxConcurrentBatches: 4,
        }),
      );
    });

    it('should demonstrate performance improvement with concurrent batches', async () => {
      const collectionId: CollectionId = 'test-collection' as CollectionId;
      const points = Array.from({ length: 500 }, (_, i) => ({
        id: `point-${i}`,
        vector: Array.from({ length: 1536 }, () => Math.random()),
        payload: {
          content: `Test content ${i}`,
          docId: `doc-${i}`,
          collectionId,
          chunkIndex: i,
        },
      }));

      // 模拟较慢的upsert操作
      mockQdrantClient.upsert.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { status: 'ok' };
      });

      // 测试串行处理
      const serialStartTime = Date.now();
      await qdrantRepo.upsertCollection(collectionId, points, {
        batchSize: 50,
        maxConcurrentBatches: 1, // 串行处理
      });
      const serialDuration = Date.now() - serialStartTime;

      // 重置mock
      mockQdrantClient.upsert.mockClear();

      // 测试并发处理
      const concurrentStartTime = Date.now();
      await qdrantRepo.upsertCollection(collectionId, points, {
        batchSize: 50,
        maxConcurrentBatches: 4, // 并发处理
      });
      const concurrentDuration = Date.now() - concurrentStartTime;

      // 并发处理应该明显更快
      expect(concurrentDuration).toBeLessThan(serialDuration * 0.7); // 至少快30%
    });

    it('should provide accurate progress monitoring during batch upserts', async () => {
      const collectionId: CollectionId = 'test-collection' as CollectionId;
      const points = Array.from({ length: 200 }, (_, i) => ({
        id: `point-${i}`,
        vector: Array.from({ length: 1536 }, () => Math.random()),
        payload: {
          content: `Test content ${i}`,
          docId: `doc-${i}`,
          collectionId,
          chunkIndex: i,
        },
      }));

      const progressUpdates: any[] = [];

      mockQdrantClient.upsert.mockResolvedValue({ status: 'ok' });

      await qdrantRepo.upsertCollection(collectionId, points, {
        batchSize: 25,
        maxConcurrentBatches: 2,
        enableProgressMonitoring: true,
        onProgress: (progress) => {
          progressUpdates.push({ ...progress });
        },
      });

      expect(progressUpdates.length).toBeGreaterThan(0);

      // 验证最终进度
      const finalProgress = progressUpdates[progressUpdates.length - 1];
      expect(finalProgress.processed).toBe(200);
      expect(finalProgress.total).toBe(200);
      expect(finalProgress.percentage).toBe(100);
      expect(finalProgress.currentBatch).toBe(8); // 200/25 = 8批次
      expect(finalProgress.totalBatches).toBe(8);
    });
  });

  describe('Batch Delete Performance', () => {
    it('should handle batch deletions efficiently', async () => {
      const collectionId: CollectionId = 'test-collection' as CollectionId;
      const pointIds = Array.from(
        { length: 500 },
        (_, i) => `point-${i}` as PointId,
      );

      mockQdrantClient.delete.mockResolvedValue({ status: 'ok' });

      const startTime = Date.now();

      await qdrantRepo.deletePoints(collectionId, pointIds);

      const duration = Date.now() - startTime;

      // 验证性能
      expect(duration).toBeLessThan(5000); // 应该在5秒内完成
      expect(mockQdrantClient.delete).toHaveBeenCalledTimes(5); // 500个点，批次大小100，应该有5次调用

      // 验证日志记录
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('开始删除集合'),
        expect.objectContaining({
          totalPoints: 500,
          batchSize: 100,
        }),
      );
    });

    it('should handle collection deletion efficiently', async () => {
      const collectionId: CollectionId = 'test-collection' as CollectionId;

      mockQdrantClient.delete.mockResolvedValue({ status: 'ok' });

      const startTime = Date.now();

      await qdrantRepo.deletePointsByCollection(collectionId);

      const duration = Date.now() - startTime;

      // 验证性能
      expect(duration).toBeLessThan(1000); // 应该在1秒内完成
      expect(mockQdrantClient.delete).toHaveBeenCalledTimes(1);

      // 验证删除参数
      expect(mockQdrantClient.delete).toHaveBeenCalledWith(
        'test-collection',
        expect.objectContaining({
          filter: {
            must: [{ key: 'collectionId', match: { value: collectionId } }],
          },
        }),
      );
    });
  });

  describe('Search Performance', () => {
    it('should handle search operations efficiently', async () => {
      const collectionId: CollectionId = 'test-collection' as CollectionId;
      const queryVector = Array.from({ length: 1536 }, () => Math.random());

      const mockSearchResults = Array.from({ length: 10 }, (_, i) => ({
        id: `point-${i}`,
        score: 0.9 - i * 0.1,
        payload: {
          content: `Test content ${i}`,
          docId: `doc-${i}`,
          collectionId,
          chunkIndex: i,
        },
      }));

      mockQdrantClient.search.mockResolvedValue(mockSearchResults);

      const startTime = Date.now();

      const results = await qdrantRepo.search(collectionId, {
        vector: queryVector,
        limit: 10,
      });

      const duration = Date.now() - startTime;

      // 验证性能
      expect(duration).toBeLessThan(1000); // 应该在1秒内完成
      expect(results).toHaveLength(10);
      expect(mockQdrantClient.search).toHaveBeenCalledTimes(1);

      // 验证搜索参数
      expect(mockQdrantClient.search).toHaveBeenCalledWith(
        'test-collection',
        expect.objectContaining({
          vector: queryVector,
          limit: 10,
          with_payload: true,
        }),
      );
    });

    it('should handle search retries on transient errors', async () => {
      const collectionId: CollectionId = 'test-collection' as CollectionId;
      const queryVector = Array.from({ length: 1536 }, () => Math.random());

      // 模拟前两次失败，第三次成功
      mockQdrantClient.search
        .mockRejectedValueOnce(new Error('fetch failed'))
        .mockRejectedValueOnce(new Error('fetch failed'))
        .mockResolvedValueOnce([]);

      const startTime = Date.now();

      const results = await qdrantRepo.search(collectionId, {
        vector: queryVector,
        limit: 10,
      });

      const duration = Date.now() - startTime;

      // 验证重试机制
      expect(mockQdrantClient.search).toHaveBeenCalledTimes(3);
      expect(results).toHaveLength(0);
      expect(duration).toBeLessThan(2000); // 即使有重试，也应该在2秒内完成

      // 验证警告日志
      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should handle large vector data without memory issues', async () => {
      const collectionId: CollectionId = 'test-collection' as CollectionId;
      const points = Array.from({ length: 2000 }, (_, i) => ({
        id: `point-${i}`,
        vector: Array.from({ length: 1536 }, () => Math.random()),
        payload: {
          content: `Large test content ${i}`.repeat(100), // 较大的内容
          docId: `doc-${i}`,
          collectionId,
          chunkIndex: i,
        },
      }));

      mockQdrantClient.upsert.mockResolvedValue({ status: 'ok' });

      const startTime = Date.now();

      await qdrantRepo.upsertCollection(collectionId, points, {
        batchSize: 50, // 较小的批次以避免内存问题
        maxConcurrentBatches: 2,
      });

      const duration = Date.now() - startTime;

      // 验证大数据集处理
      expect(duration).toBeLessThan(15000); // 应该在15秒内完成
      expect(mockQdrantClient.upsert).toHaveBeenCalledTimes(40); // 2000/50 = 40批次
    });

    it('should optimize batch sizes based on data characteristics', async () => {
      const collectionId: CollectionId = 'test-collection' as CollectionId;

      // 创建不同大小的数据集
      const smallPoints = Array.from({ length: 100 }, (_, i) => ({
        id: `small-${i}`,
        vector: Array.from({ length: 1536 }, () => Math.random()),
        payload: {
          content: 'Small',
          docId: `doc-${i}`,
          collectionId,
          chunkIndex: i,
        },
      }));

      const largePoints = Array.from({ length: 100 }, (_, i) => ({
        id: `large-${i}`,
        vector: Array.from({ length: 1536 }, () => Math.random()),
        payload: {
          content: 'Large content '.repeat(1000), // 大内容
          docId: `doc-${i}`,
          collectionId,
          chunkIndex: i,
        },
      }));

      mockQdrantClient.upsert.mockResolvedValue({ status: 'ok' });

      // 测试小数据集
      const smallStartTime = Date.now();
      await qdrantRepo.upsertCollection(collectionId, smallPoints, {
        batchSize: 100,
        maxConcurrentBatches: 4,
      });
      const smallDuration = Date.now() - smallStartTime;

      // 重置mock
      mockQdrantClient.upsert.mockClear();

      // 测试大数据集
      const largeStartTime = Date.now();
      await qdrantRepo.upsertCollection(collectionId, largePoints, {
        batchSize: 100,
        maxConcurrentBatches: 4,
      });
      const largeDuration = Date.now() - largeStartTime;

      // 大数据集处理时间应该更长，但仍在合理范围内
      expect(largeDuration).toBeGreaterThan(smallDuration);
      expect(largeDuration).toBeLessThan(smallDuration * 3); // 不应该慢3倍以上
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle batch upsert errors gracefully', async () => {
      const collectionId: CollectionId = 'test-collection' as CollectionId;
      const points = Array.from({ length: 100 }, (_, i) => ({
        id: `point-${i}` as PointId,
        vector: Array.from({ length: 1536 }, () => Math.random()),
        payload: {
          content: `Test content ${i}`,
          docId: `doc-${i}`,
          collectionId,
          chunkIndex: i,
        },
      }));

      // 模拟某些批次失败
      mockQdrantClient.upsert
        .mockResolvedValueOnce({ status: 'ok' })
        .mockRejectedValueOnce(new Error('Batch failed'))
        .mockResolvedValueOnce({ status: 'ok' });

      await expect(
        qdrantRepo.upsertCollection(collectionId, points, {
          batchSize: 33,
          maxConcurrentBatches: 1,
        }),
      ).rejects.toThrow('Batch failed');

      // 验证错误日志
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('批次'),
        expect.objectContaining({
          error: expect.any(Error),
        }),
      );
    });

    it('should handle network timeouts gracefully', async () => {
      const collectionId: CollectionId = 'test-collection' as CollectionId;
      const points = Array.from({ length: 50 }, (_, i) => ({
        id: `point-${i}`,
        vector: Array.from({ length: 1536 }, () => Math.random()),
        payload: {
          content: `Test content ${i}`,
          docId: `doc-${i}`,
          collectionId,
          chunkIndex: i,
        },
      }));

      // 模拟网络超时
      mockQdrantClient.upsert.mockRejectedValue(new Error('Network timeout'));

      await expect(
        qdrantRepo.upsertCollection(collectionId, points, {
          batchSize: 25,
          maxConcurrentBatches: 1,
        }),
      ).rejects.toThrow('Network timeout');

      // 验证错误处理
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
