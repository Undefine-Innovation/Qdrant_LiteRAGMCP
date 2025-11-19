/**
 * ChunkRepository 查询和统计方法单元测试
 * 测试块相关的查询和统计操作
 */

import { ChunkRepository } from '@infrastructure/database/repositories/ChunkRepository.js';
import { DataSource } from 'typeorm';
import { DocId, CollectionId } from '@domain/entities/types.js';
import {
  MockFactory,
  DatabaseAssertions,
  TestEnvironmentManager,
} from '../../utils';

describe('ChunkRepository - 查询和统计方法', () => {
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

  describe('getCount', () => {
    it('应该返回块总数', async () => {
      // Arrange
      const expectedCount = 15;
      const mockQueryBuilder = MockFactory.createQueryBuilder({
        getCount: jest.fn().mockResolvedValue(expectedCount),
      });
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await chunkRepository.getCount();

      // Assert
      expect(result).toBe(expectedCount);
      expect(mockQueryBuilder.getCount).toHaveBeenCalled();
    });

    it('应该支持文档ID过滤', async () => {
      // Arrange
      const docId = 'doc-1' as DocId;
      const expectedCount = 5;
      const mockQueryBuilder = MockFactory.createQueryBuilder({
        getCount: jest.fn().mockResolvedValue(expectedCount),
      });
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await chunkRepository.getCount(docId);

      // Assert
      expect(result).toBe(expectedCount);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'chunk.docId = :docId',
        { docId },
      );
    });

    it('应该支持集合ID过滤', async () => {
      // Arrange
      const collectionId = 'collection-1' as CollectionId;
      const expectedCount = 10;
      const mockQueryBuilder = MockFactory.createQueryBuilder({
        getCount: jest.fn().mockResolvedValue(expectedCount),
      });
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await chunkRepository.getCount(undefined, collectionId);

      // Assert
      expect(result).toBe(expectedCount);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'chunk.collectionId = :collectionId',
        { collectionId },
      );
    });

    it('应该支持状态过滤', async () => {
      // Arrange
      const status = 'completed' as const;
      const syncStatus = 'completed' as const;
      const expectedCount = 8;
      const mockQueryBuilder = MockFactory.createQueryBuilder({
        getCount: jest.fn().mockResolvedValue(expectedCount),
      });
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await chunkRepository.getCount(undefined, undefined, {
        status,
        syncStatus,
      });

      // Assert
      expect(result).toBe(expectedCount);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'chunk.embeddingStatus = :status',
        { status },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'chunk.syncStatus = :syncStatus',
        { syncStatus },
      );
    });

    it('当数据库查询失败时应该抛出错误', async () => {
      // Arrange
      const error = new Error('Database error');
      const mockQueryBuilder = MockFactory.createQueryBuilder({
        getCount: jest.fn().mockRejectedValue(error),
      });
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act & Assert
      await expect(chunkRepository.getCount()).rejects.toThrow(
        'Database error',
      );
      expect(mockLogger.error).toHaveBeenCalledWith('获取块总数失败', {
        docId: undefined,
        collectionId: undefined,
        options: {},
        error: 'Database error',
      });
    });
  });

  describe('getStatistics', () => {
    it('应该返回块统计信息', async () => {
      // Arrange
      const collectionId = 'collection-1' as CollectionId;
      const docId = 'doc-1' as DocId;
      const expectedStats = {
        total: 10,
        pending: 2,
        processing: 1,
        completed: 6,
        failed: 1,
        totalTokens: 1000,
        avgContentLength: 150.5,
      };

      const mockQueryBuilder = MockFactory.createQueryBuilder({
        getRawOne: jest.fn().mockResolvedValue({
          total: '10',
          pending: '2',
          processing: '1',
          completed: '6',
          failed: '1',
          totalTokens: '1000',
          avgContentLength: '150.5',
        }),
      });
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await chunkRepository.getStatistics({
        collectionId,
        docId,
      });

      // Assert
      expect(result).toEqual(expectedStats);
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('COUNT(*)', 'total');
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith(
        'SUM(CASE WHEN embeddingStatus = :pending THEN 1 ELSE 0 END)',
        'pending',
      );
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith(
        'SUM(CASE WHEN embeddingStatus = :processing THEN 1 ELSE 0 END)',
        'processing',
      );
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith(
        'SUM(CASE WHEN embeddingStatus = :completed THEN 1 ELSE 0 END)',
        'completed',
      );
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith(
        'SUM(CASE WHEN embeddingStatus = :failed THEN 1 ELSE 0 END)',
        'failed',
      );
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith(
        'SUM(tokenCount)',
        'totalTokens',
      );
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith(
        'AVG(contentLength)',
        'avgContentLength',
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'chunk.collectionId = :collectionId',
        { collectionId },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'chunk.docId = :docId',
        { docId },
      );
      expect(mockQueryBuilder.setParameters).toHaveBeenCalledWith({
        pending: 'pending',
        processing: 'processing',
        completed: 'completed',
        failed: 'failed',
      });
    });

    it('当不指定过滤条件时应该返回全局统计', async () => {
      // Arrange
      const mockQueryBuilder = MockFactory.createQueryBuilder({
        getRawOne: jest.fn().mockResolvedValue({
          total: '5',
          pending: '1',
          processing: '0',
          completed: '4',
          failed: '0',
          totalTokens: '500',
          avgContentLength: '100.0',
        }),
      });
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await chunkRepository.getStatistics({});

      // Assert
      expect(result).toEqual({
        total: 5,
        pending: 1,
        processing: 0,
        completed: 4,
        failed: 0,
        totalTokens: 500,
        avgContentLength: 100.0,
      });
      expect(mockQueryBuilder.where).not.toHaveBeenCalled();
      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
    });

    it('当数据库查询失败时应该抛出错误', async () => {
      // Arrange
      const collectionId = 'collection-1' as CollectionId;
      const error = new Error('Database error');

      const mockQueryBuilder = MockFactory.createQueryBuilder({
        getRawOne: jest.fn().mockRejectedValue(error),
      });
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act & Assert
      await expect(
        chunkRepository.getStatistics({ collectionId }),
      ).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('获取块统计信息失败', {
        collectionId,
        docId: undefined,
        error: 'Database error',
      });
    });

    it('应该处理空结果', async () => {
      // Arrange
      const mockQueryBuilder = MockFactory.createQueryBuilder({
        getRawOne: jest.fn().mockResolvedValue(null),
      });
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await chunkRepository.getStatistics({});

      // Assert
      expect(result).toEqual({
        total: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        totalTokens: 0,
        avgContentLength: 0,
      });
    });
  });
});
