/**
 * DocRepository 统计方法单元测试
 * 测试文档相关的统计操作
 */

import { DocRepository } from '@infrastructure/database/repositories/DocRepository.js';
import { DataSource } from 'typeorm';
import { Doc } from '@infrastructure/database/entities/Doc.js';
import { CollectionId } from '@domain/entities/types.js';
import {
  MockFactory,
  DatabaseAssertions,
  UnifiedDataFactory,
  TestEnvironmentManager,
} from '../../utils';

describe('DocRepository - 统计方法', () => {
  let docRepository: DocRepository;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockLogger: jest.Mocked<any>;
  let mockRepository: any;
  let testEnv: TestEnvironmentManager;

  beforeEach(async () => {
    testEnv = new TestEnvironmentManager();
    const mocks = MockFactory.createRepositoryMocks('Doc');
    mockDataSource = mocks.dataSource;
    mockLogger = mocks.logger;
    mockRepository = mocks.repository;

    docRepository = new DocRepository(mockDataSource, mockLogger);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await docRepository.destroy();
  });

  describe('getStatistics', () => {
    it('应该返回文档统计信息', async () => {
      // Arrange
      const collectionId = 'collection-1' as CollectionId;
      const expectedStats = {
        total: 10,
        new: 2,
        processing: 3,
        completed: 4,
        failed: 1,
        deleted: 0,
        totalSize: 10240,
      };

      const mockQueryBuilder = MockFactory.createQueryBuilder({
        getRawOne: jest.fn().mockResolvedValue({
          total: '10',
          new: '2',
          processing: '3',
          completed: '4',
          failed: '1',
          deleted: '0',
          totalSize: '10240',
        }),
      });
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await docRepository.getDocStatistics(collectionId);

      // Assert
      expect(result).toEqual(expectedStats);
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('COUNT(*)', 'total');
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith(
        'SUM(CASE WHEN doc.status = :new THEN 1 ELSE 0 END)',
        'new',
      );
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith(
        'SUM(CASE WHEN doc.status = :processing THEN 1 ELSE 0 END)',
        'processing',
      );
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith(
        'SUM(CASE WHEN doc.status = :completed THEN 1 ELSE 0 END)',
        'completed',
      );
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith(
        'SUM(CASE WHEN doc.status = :failed THEN 1 ELSE 0 END)',
        'failed',
      );
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith(
        'SUM(CASE WHEN doc.deleted = true THEN 1 ELSE 0 END)',
        'deleted',
      );
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith(
        'SUM(doc.size_bytes)',
        'totalSize',
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'doc.collectionId = :collectionId',
        { collectionId },
      );
      expect(mockQueryBuilder.setParameters).toHaveBeenCalledWith({
        new: 'new',
        processing: 'processing',
        completed: 'completed',
        failed: 'failed',
      });
    });

    it('当不指定集合ID时应该返回全局统计', async () => {
      // Arrange
      const mockQueryBuilder = MockFactory.createQueryBuilder({
        getRawOne: jest.fn().mockResolvedValue({
          total: '5',
          new: '1',
          processing: '1',
          completed: '2',
          failed: '1',
          deleted: '0',
          totalSize: '5120',
        }),
      });
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      await docRepository.getDocStatistics();

      // Assert
      expect(mockQueryBuilder.where).not.toHaveBeenCalled();
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
        docRepository.getDocStatistics(collectionId),
      ).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('获取文档统计信息失败', {
        collectionId,
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
      const result = await docRepository.getDocStatistics();

      // Assert
      expect(result).toEqual({
        total: 0,
        new: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        deleted: 0,
        totalSize: 0,
      });
    });
  });
});
