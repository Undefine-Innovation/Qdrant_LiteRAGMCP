/**
 * ChunkRepository 创建和更新方法单元测试
 * 测试块相关的创建和更新操作
 */

import { ChunkRepository } from '@infrastructure/database/repositories/ChunkRepository.js';
import { DataSource } from 'typeorm';
import { Chunk } from '@infrastructure/database/entities/Chunk.js';
import { PointId } from '@domain/entities/types.js';
import {
  MockFactory,
  DatabaseAssertions,
  UnifiedDataFactory,
  TestEnvironmentManager,
} from '../../utils';

describe('ChunkRepository - 创建和更新方法', () => {
  let chunkRepository: ChunkRepository;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockLogger: jest.Mocked<any>;
  let mockRepository: any;
  let testEnv: TestEnvironmentManager;

  beforeEach(async () => {
    testEnv = new TestEnvironmentManager();
    const mocks = MockFactory.createRepositoryMocks('Chunk');
    mockDataSource = mocks.dataSource;
    mockLogger = mocks.logger;
    mockRepository = mocks.repository;

    chunkRepository = new ChunkRepository(mockDataSource, mockLogger);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await chunkRepository.destroy();
  });

  describe('createBatch', () => {
    it('应该批量创建块', async () => {
      const chunks = UnifiedDataFactory.createPartialChunks(2);
      const expectedChunks = UnifiedDataFactory.createChunks(2, {
        pointIds: chunks.map((entry) => entry.pointId),
        docIds: chunks.map((entry) => entry.docId),
        collectionIds: chunks.map((entry) => entry.collectionId),
      });
      const batchOperations = (chunkRepository as any).batchOperations;
      const createBatchSpy = jest
        .spyOn(batchOperations, 'createBatchWithConfig')
        .mockResolvedValue(expectedChunks);
      const result = await chunkRepository.createBatch(chunks);
      DatabaseAssertions.assertArraysEqual(result, expectedChunks);
      const processedChunks = chunks.map((chunk) => ({
        ...chunk,
        contentLength: chunk.content ? chunk.content.length : 0,
      }));
      expect(createBatchSpy).toHaveBeenCalledWith(chunks, {
        batchSize: 100,
      });
    });
    it('应该支持自定义批次大小', async () => {
      const chunks = UnifiedDataFactory.createPartialChunks(1);
      const expectedChunks = UnifiedDataFactory.createChunks(1, {
        pointIds: [chunks[0].pointId],
        docIds: [chunks[0].docId],
        collectionIds: [chunks[0].collectionId],
      });
      const batchOperations = (chunkRepository as any).batchOperations;
      const createBatchSpy = jest
        .spyOn(batchOperations, 'createBatchWithConfig')
        .mockResolvedValue(expectedChunks);
      const result = await chunkRepository.createBatch(chunks, 50);
      DatabaseAssertions.assertArraysEqual(result, expectedChunks);
      expect(createBatchSpy).toHaveBeenCalledWith(expect.any(Array), {
        batchSize: 50,
      });
    });
    it('当批量创建失败时应该抛出错误', async () => {
      const chunks = UnifiedDataFactory.createPartialChunks(1);
      const error = new Error('Batch create failed');
      const batchOperations = (chunkRepository as any).batchOperations;
      jest
        .spyOn(batchOperations, 'createBatchWithConfig')
        .mockRejectedValue(error);
      await expect(chunkRepository.createBatch(chunks)).rejects.toThrow(
        'Batch create failed',
      );
    });
  });
  describe('batchUpdateStatus', () => {
    it('应该批量更新块状态', async () => {
      const pointIds = ['point-1', 'point-2'] as PointId[];
      const status = 'completed' as const;
      const expectedResult = { success: 2, failed: 0 };
      const batchOperations = (chunkRepository as any).batchOperations;
      const batchSpy = jest
        .spyOn(batchOperations, 'batchUpdateStatus')
        .mockResolvedValue(expectedResult);
      const result = await chunkRepository.batchUpdateStatus(pointIds, status);
      expect(result).toEqual(expectedResult);
      expect(batchSpy).toHaveBeenCalledWith(pointIds, status);
    });
    it('当批量更新失败时应该抛出错误', async () => {
      const pointIds = ['point-1'] as PointId[];
      const status = 'failed' as const;
      const error = new Error('Batch update failed');
      const batchOperations = (chunkRepository as any).batchOperations;
      jest.spyOn(batchOperations, 'batchUpdateStatus').mockRejectedValue(error);
      await expect(
        chunkRepository.batchUpdateStatus(pointIds, status),
      ).rejects.toThrow('Batch update failed');
    });
  });
  describe('batchUpdateSyncStatus', () => {
    it('应该批量更新块同步状态', async () => {
      const pointIds = ['point-1', 'point-2'] as PointId[];
      const syncStatus = 'completed' as const;
      const expectedResult = { success: 2, failed: 0 };
      const batchOperations = (chunkRepository as any).batchOperations;
      const spy = jest
        .spyOn(batchOperations, 'batchUpdateSyncStatus')
        .mockResolvedValue(expectedResult);
      const result = await chunkRepository.batchUpdateSyncStatus(
        pointIds,
        syncStatus,
      );
      expect(result).toEqual(expectedResult);
      expect(spy).toHaveBeenCalledWith(pointIds, syncStatus);
    });
    it('当批量同步状态更新失败时应该抛出错误', async () => {
      const pointIds = ['point-1'] as PointId[];
      const syncStatus = 'failed' as const;
      const error = new Error('Batch update failed');
      const batchOperations = (chunkRepository as any).batchOperations;
      jest
        .spyOn(batchOperations, 'batchUpdateSyncStatus')
        .mockRejectedValue(error);
      await expect(
        chunkRepository.batchUpdateSyncStatus(pointIds, syncStatus),
      ).rejects.toThrow('Batch update failed');
    });
  });
  describe('createBatchWithManager', () => {
    it('应该使用事务管理器批量创建块', async () => {
      // Arrange
      const chunks = UnifiedDataFactory.createPartialChunks(2);
      const expectedChunks = UnifiedDataFactory.createChunks(2, {
        pointIds: chunks.map((c) => c.pointId),
        docIds: chunks.map((c) => c.docId),
        collectionIds: chunks.map((c) => c.collectionId),
      });

      const mockManager = {
        save: jest.fn().mockResolvedValue(expectedChunks),
      };

      mockRepository.create.mockReturnValue(expectedChunks);

      // Act
      const result = await chunkRepository.createBatchWithManager(
        chunks,
        mockManager,
      );

      // Assert
      DatabaseAssertions.assertArraysEqual(result, expectedChunks);
      expect(mockRepository.create).toHaveBeenCalledWith(
        chunks.map((chunk) => ({
          ...chunk,
          contentLength: chunk.content ? chunk.content.length : 0,
        })),
      );
      expect(mockManager.save).toHaveBeenCalledWith(expectedChunks);
      expect(mockLogger.debug).toHaveBeenCalledWith('批量创建块成功', {
        count: expectedChunks.length,
      });
    });

    it('当批量创建失败时应该抛出错误', async () => {
      // Arrange
      const chunks = UnifiedDataFactory.createPartialChunks(1);

      const mockManager = {
        save: jest.fn().mockRejectedValue(new Error('Batch create failed')),
      };

      mockRepository.create.mockReturnValue([]);

      // Act & Assert
      await expect(
        chunkRepository.createBatchWithManager(chunks, mockManager),
      ).rejects.toThrow('Batch create failed');
      expect(mockLogger.error).toHaveBeenCalledWith('批量创建块失败', {
        count: chunks.length,
        error: 'Batch create failed',
      });
    });
  });
});
