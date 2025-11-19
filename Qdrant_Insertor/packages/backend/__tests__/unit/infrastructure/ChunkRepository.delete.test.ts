/**
 * ChunkRepository 删除方法单元测试
 * 测试块相关的删除操作
 */

import { ChunkRepository } from '@infrastructure/database/repositories/ChunkRepository.js';
import { DataSource } from 'typeorm';
import { DocId, CollectionId, PointId } from '@domain/entities/types.js';
import {
  MockFactory,
  DatabaseAssertions,
  TestEnvironmentManager,
} from '../../utils';

describe('ChunkRepository - 删除方法', () => {
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

  describe('deleteByDocId', () => {
    it('应该根据文档ID删除块', async () => {
      // Arrange
      const docId = 'doc-1' as DocId;
      const deleteResult = { affected: 5 };
      mockRepository.delete.mockResolvedValue(deleteResult);

      // Act
      const result = await chunkRepository.deleteByDocId(docId);

      // Assert
      expect(result).toBe(5);
      expect(mockRepository.delete).toHaveBeenCalledWith({ docId });
      expect(mockLogger.debug).toHaveBeenCalledWith('根据文档ID删除块成功', {
        docId,
        count: 5,
      });
    });

    it('当没有块被删除时应该返回0', async () => {
      // Arrange
      const docId = 'non-existent' as DocId;
      const deleteResult = { affected: 0 };
      mockRepository.delete.mockResolvedValue(deleteResult);

      // Act
      const result = await chunkRepository.deleteByDocId(docId);

      // Assert
      expect(result).toBe(0);
    });

    it('当删除失败时应该抛出错误', async () => {
      // Arrange
      const docId = 'doc-1' as DocId;
      const error = new Error('Delete failed');
      mockRepository.delete.mockRejectedValue(error);

      // Act & Assert
      await expect(chunkRepository.deleteByDocId(docId)).rejects.toThrow(
        'Delete failed',
      );
      expect(mockLogger.error).toHaveBeenCalledWith('根据文档ID删除块失败', {
        docId,
        error: 'Delete failed',
      });
    });
  });

  describe('deleteByCollectionId', () => {
    it('应该根据集合ID删除块', async () => {
      // Arrange
      const collectionId = 'collection-1' as CollectionId;
      const deleteResult = { affected: 10 };
      mockRepository.delete.mockResolvedValue(deleteResult);

      // Act
      const result = await chunkRepository.deleteByCollectionId(collectionId);

      // Assert
      expect(result).toBe(10);
      expect(mockRepository.delete).toHaveBeenCalledWith({ collectionId });
      expect(mockLogger.debug).toHaveBeenCalledWith('根据集合ID删除块成功', {
        collectionId,
        count: 10,
      });
    });

    it('当删除失败时应该抛出错误', async () => {
      // Arrange
      const collectionId = 'collection-1' as CollectionId;
      const error = new Error('Delete failed');
      mockRepository.delete.mockRejectedValue(error);

      // Act & Assert
      await expect(
        chunkRepository.deleteByCollectionId(collectionId),
      ).rejects.toThrow('Delete failed');
      expect(mockLogger.error).toHaveBeenCalledWith('根据集合ID删除块失败', {
        collectionId,
        error: 'Delete failed',
      });
    });
  });

  describe('deleteByPointIds', () => {
    it('应该根据点ID数组批量删除块', async () => {
      // Arrange
      const pointIds = ['point-1', 'point-2', 'point-3'] as PointId[];
      const batchSize = 2;
      const deleteResult1 = { affected: 2 };
      const deleteResult2 = { affected: 1 };

      mockRepository.delete
        .mockResolvedValueOnce(deleteResult1)
        .mockResolvedValueOnce(deleteResult2);

      // Act
      const result = await chunkRepository.deleteByPointIds(
        pointIds,
        batchSize,
      );

      // Assert
      expect(result).toBe(3);
      expect(mockRepository.delete).toHaveBeenCalledTimes(2);
      expect(mockRepository.delete).toHaveBeenNthCalledWith(1, {
        pointId: expect.any(Object), // In(batch) creates an In object
      });
      expect(mockRepository.delete).toHaveBeenNthCalledWith(2, {
        pointId: expect.any(Object),
      });
      expect(mockLogger.debug).toHaveBeenCalledWith('批量删除块批次完成', {
        batch: 1,
        batchSize: 2,
        deleted: 2,
      });
      expect(mockLogger.debug).toHaveBeenCalledWith('批量删除块批次完成', {
        batch: 2,
        batchSize: 1,
        deleted: 1,
      });
      expect(mockLogger.debug).toHaveBeenCalledWith('批量删除块完成', {
        requested: 3,
        deleted: 3,
      });
    });

    it('当点ID数组为空时应该返回0', async () => {
      // Arrange
      const pointIds: PointId[] = [];

      // Act
      const result = await chunkRepository.deleteByPointIds(pointIds);

      // Assert
      expect(result).toBe(0);
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });

    it('当删除失败时应该抛出错误', async () => {
      // Arrange
      const pointIds = ['point-1'] as PointId[];
      const error = new Error('Delete failed');
      mockRepository.delete.mockRejectedValue(error);

      // Act & Assert
      await expect(chunkRepository.deleteByPointIds(pointIds)).rejects.toThrow(
        'Delete failed',
      );
      expect(mockLogger.error).toHaveBeenCalledWith('批量删除块失败', {
        pointIds,
        error: 'Delete failed',
      });
    });
  });

  describe('deleteByDocIdWithManager', () => {
    it('应该使用事务管理器根据文档ID删除块', async () => {
      // Arrange
      const docId = 'doc-1' as DocId;
      const deleteResult = { affected: 5 };
      const mockManager = {
        delete: jest.fn().mockResolvedValue(deleteResult),
      };

      // Act
      const result = await chunkRepository.deleteByDocIdWithManager(
        docId,
        mockManager,
      );

      // Assert
      expect(result).toBe(5);
      expect(mockManager.delete).toHaveBeenCalledWith(expect.any(Function), {
        docId,
      });
      expect(mockLogger.debug).toHaveBeenCalledWith('根据文档ID删除块成功', {
        docId,
        count: 5,
      });
    });

    it('当删除失败时应该抛出错误', async () => {
      // Arrange
      const docId = 'doc-1' as DocId;
      const mockManager = {
        delete: jest.fn().mockRejectedValue(new Error('Delete failed')),
      };

      // Act & Assert
      await expect(
        chunkRepository.deleteByDocIdWithManager(docId, mockManager),
      ).rejects.toThrow('Delete failed');
      expect(mockLogger.error).toHaveBeenCalledWith('根据文档ID删除块失败', {
        docId,
        error: 'Delete failed',
      });
    });
  });
});
