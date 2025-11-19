/**
 * DocRepository 查找方法单元测试
 * 测试文档相关的查找操作
 */

import { DocRepository } from '@infrastructure/database/repositories/DocRepository.js';
import { DataSource } from 'typeorm';
import { Doc } from '@infrastructure/database/entities/Doc.js';
import { DocId, CollectionId } from '@domain/entities/types.js';
import {
  MockFactory,
  DatabaseAssertions,
  UnifiedDataFactory,
  TestEnvironmentManager,
} from '../../utils';

describe('DocRepository - 查找方法', () => {
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

  describe('findByCollectionId', () => {
    it('应该根据集合ID查找文档', async () => {
      // Arrange
      const collectionId = 'collection-1' as CollectionId;
      const expectedDocs = UnifiedDataFactory.createDocs(2, { collectionId });

      // Mock repository.find to return the expected docs
      mockRepository.find.mockResolvedValue(expectedDocs);

      // Act
      const result = await docRepository.findByCollectionId(collectionId);

      // Assert
      expect(result).toEqual(expectedDocs);
      expect(mockRepository.find).toHaveBeenCalled();
    });

    it('应该支持状态过滤', async () => {
      // Arrange
      const collectionId = 'collection-1' as CollectionId;
      const status = 'completed' as const;
      const expectedDocs = UnifiedDataFactory.createDocs(1, {
        collectionId,
        status,
      });

      mockRepository.find.mockResolvedValue(expectedDocs);

      // Act
      const result = await docRepository.findByCollectionId(collectionId, {
        status,
      });

      // Assert
      expect(result).toEqual(expectedDocs);
      expect(mockRepository.find).toHaveBeenCalled();
    });

    it('应该支持结果限制', async () => {
      // Arrange
      const collectionId = 'collection-1' as CollectionId;
      const limit = 5;
      const expectedDocs = UnifiedDataFactory.createDocs(limit, {
        collectionId,
      });

      mockRepository.find.mockResolvedValue(expectedDocs);

      // Act
      const result = await docRepository.findByCollectionId(collectionId, {
        limit,
      });

      // Assert
      expect(result).toHaveLength(limit);
      expect(mockRepository.find).toHaveBeenCalled();
    });

    it('应该支持自定义排序', async () => {
      // Arrange
      const collectionId = 'collection-1' as CollectionId;
      const expectedDocs = UnifiedDataFactory.createDocs(2, { collectionId });

      mockRepository.find.mockResolvedValue(expectedDocs);

      // Act
      const result = await docRepository.findByCollectionId(collectionId, {
        orderBy: { name: 'ASC' },
      });

      // Assert
      expect(result).toEqual(expectedDocs);
      expect(mockRepository.find).toHaveBeenCalled();
    });

    it('当数据库查询失败时应该抛出错误', async () => {
      // Arrange
      const collectionId = 'collection-1' as CollectionId;
      const error = new Error('Database error');

      mockRepository.find.mockRejectedValue(error);

      // Act & Assert
      await expect(
        docRepository.findByCollectionId(collectionId),
      ).rejects.toThrow('Database error');
    });

    it('应该根据集合ID和键值查找文档', async () => {
      // Arrange
      const collectionId = 'collection-1' as CollectionId;
      const key = 'doc-key-1';
      const expectedDoc = UnifiedDataFactory.createDoc({ collectionId, key });

      mockRepository.findOne.mockResolvedValue(expectedDoc);

      // Act
      const result = await docRepository.findByCollectionAndKey(
        collectionId,
        key,
      );

      // Assert
      expect(result).toEqual(expectedDoc);
      expect(mockRepository.findOne).toHaveBeenCalled();
    });

    it('当数据库查询失败时应该抛出错误', async () => {
      // Arrange
      const collectionId = 'collection-1' as CollectionId;
      const key = 'doc-key-1';
      const error = new Error('Database error');

      mockRepository.findOne.mockRejectedValue(error);

      // Act & Assert
      await expect(
        docRepository.findByCollectionAndKey(collectionId, key),
      ).rejects.toThrow('Database error');
    });
  });

  describe('findAllActive', () => {
    it('应该返回所有活跃文档', async () => {
      // Arrange
      const expectedDocs = UnifiedDataFactory.createDocs(3, { deleted: false });

      mockRepository.find.mockResolvedValue(expectedDocs);

      // Act
      const result = await docRepository.findAllActive();

      // Assert
      expect(result).toEqual(expectedDocs);
      expect(mockRepository.find).toHaveBeenCalled();
    });

    it('应该支持状态过滤', async () => {
      // Arrange
      const status = 'completed' as const;
      const expectedDocs = UnifiedDataFactory.createDocs(1, {
        status,
        deleted: false,
      });

      mockRepository.find.mockResolvedValue(expectedDocs);

      // Act
      const result = await docRepository.findAllActive({ status });

      // Assert
      expect(result).toEqual(expectedDocs);
      expect(mockRepository.find).toHaveBeenCalled();
    });

    it('当数据库查询失败时应该抛出错误', async () => {
      // Arrange
      const error = new Error('Database error');

      mockRepository.find.mockRejectedValue(error);

      // Act & Assert
      await expect(docRepository.findAllActive()).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('findByContentHash', () => {
    it('应该根据内容哈希查找文档', async () => {
      // Arrange
      const contentHash = 'hash-123';
      const expectedDoc = UnifiedDataFactory.createDoc({ contentHash });

      mockRepository.findOne.mockResolvedValue(expectedDoc);

      // Act
      const result = await docRepository.findByContentHash(contentHash);

      // Assert
      expect(result).toEqual(expectedDoc);
      expect(mockRepository.findOne).toHaveBeenCalled();
    });

    it('当哈希不存在时应该返回null', async () => {
      // Arrange
      const contentHash = 'non-existent-hash';

      mockRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await docRepository.findByContentHash(contentHash);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('findByContentHashes', () => {
    it('应该批量查找内容哈希', async () => {
      // Arrange
      const contentHashes = ['hash-1', 'hash-2', 'hash-3'];
      const expectedDocs = UnifiedDataFactory.createDocs(3, {
        contentHash: contentHashes[0],
      });

      mockRepository.find.mockResolvedValue(expectedDocs);

      // Act
      const result = await docRepository.findByContentHashes(contentHashes);

      // Assert
      expect(result).toEqual(expectedDocs);
      expect(mockRepository.find).toHaveBeenCalled();
    });

    it('当哈希数组为空时应该返回空数组', async () => {
      // Arrange
      const contentHashes: string[] = [];

      // Act
      const result = await docRepository.findByContentHashes(contentHashes);

      // Assert
      expect(result).toEqual([]);
      expect(mockRepository.find).not.toHaveBeenCalled();
    });

    it('当数据库查询失败时应该抛出错误', async () => {
      // Arrange
      const contentHashes = ['hash-1', 'hash-2'];
      const error = new Error('Database error');

      mockRepository.find.mockRejectedValue(error);

      // Act & Assert
      await expect(
        docRepository.findByContentHashes(contentHashes),
      ).rejects.toThrow('Database error');
    });
  });

  describe('findByStatus', () => {
    it('应该根据状态查找文档', async () => {
      // Arrange
      const status = 'completed';
      const expectedDocs = UnifiedDataFactory.createDocs(2, { status });

      mockRepository.find.mockResolvedValue(expectedDocs);

      // Act
      const result = await docRepository.findByStatus(status);

      // Assert
      expect(result).toEqual(expectedDocs);
      expect(mockRepository.find).toHaveBeenCalled();
    });

    it('应该支持集合ID过滤', async () => {
      // Arrange
      const collectionId = 'collection-1' as CollectionId;
      const status = 'completed';
      const expectedDocs = UnifiedDataFactory.createDocs(1, {
        collectionId,
        status,
      });

      mockRepository.find.mockResolvedValue(expectedDocs);

      // Act
      const result = await docRepository.findByCollectionIdAndStatus(
        collectionId,
        status,
      );

      // Assert
      expect(result).toEqual(expectedDocs);
      expect(mockRepository.find).toHaveBeenCalled();
    });

    it('当数据库查询失败时应该抛出错误', async () => {
      // Arrange
      const status = 'completed';
      const error = new Error('Database error');

      mockRepository.find.mockRejectedValue(error);

      // Act & Assert
      await expect(docRepository.findByStatus(status)).rejects.toThrow(
        'Database error',
      );
    });
  });
});
