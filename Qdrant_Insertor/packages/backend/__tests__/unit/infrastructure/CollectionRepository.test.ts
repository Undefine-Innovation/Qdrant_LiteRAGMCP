/**
 * CollectionRepository 单元测试
 * 测试集合相关的数据库操作
 */

import { CollectionRepository } from '@infrastructure/database/repositories/CollectionRepository.js';
import { DataSource } from 'typeorm';
import { Collection } from '@infrastructure/database/entities/Collection.js';
import { Logger } from '@logging/logger.js';
import { CollectionId } from '@domain/entities/types.js';

// Mock dependencies
jest.mock('@logging/logger.js');

describe('CollectionRepository', () => {
  let collectionRepository: CollectionRepository;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockLogger: jest.Mocked<Logger>;
  let mockRepository: any;

  beforeEach(() => {
    // 创建mock对象
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    // 创建一个完整的mock QueryBuilder
    const createMockQueryBuilder = () => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
      getMany: jest.fn().mockResolvedValue([]),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({
        total: '0',
        active: '0',
        inactive: '0',
        archived: '0',
        totalDocuments: '0',
        totalChunks: '0',
      }),
      limit: jest.fn().mockReturnThis(),
    });

    mockRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest
        .fn()
        .mockImplementation(() => createMockQueryBuilder()),
      update: jest.fn(),
      delete: jest.fn(),
      save: jest.fn(),
    };

    mockDataSource = {
      getRepository: jest.fn().mockReturnValue(mockRepository),
    } as any;

    collectionRepository = new CollectionRepository(mockDataSource, mockLogger);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    // 清理缓存定时器以防止Jest挂起
    await collectionRepository.destroy();
  });

  describe('findByName', () => {
    it('应该根据名称找到集合', async () => {
      // Arrange
      const collectionName = 'Test Collection';
      const expectedCollection = {
        id: 'collection-1' as CollectionId,
        collectionId: 'collection-1',
        name: collectionName,
        description: 'Test Description',
        status: 'active',
        deleted: false,
      } as Collection;

      mockRepository.findOne.mockResolvedValue(expectedCollection);

      // Act
      const result = await collectionRepository.findByName(collectionName);

      // Assert
      expect(result).toEqual(expectedCollection);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: {
          name: collectionName,
          deleted: false,
        },
      });
    });

    it('当集合不存在时应该返回null', async () => {
      // Arrange
      const collectionName = 'Non-existent Collection';
      mockRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await collectionRepository.findByName(collectionName);

      // Assert
      expect(result).toBeNull();
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: {
          name: collectionName,
          deleted: false,
        },
      });
    });

    it('当数据库查询失败时应该抛出错误', async () => {
      // Arrange
      const collectionName = 'Test Collection';
      const error = new Error('Database error');
      mockRepository.findOne.mockRejectedValue(error);

      // Act & Assert
      await expect(
        collectionRepository.findByName(collectionName),
      ).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('根据名称查找集合失败', {
        name: collectionName,
        error: 'Database error',
      });
    });
  });

  describe('findByCollectionId', () => {
    it('应该根据集合ID找到集合', async () => {
      // Arrange
      const collectionId = 'collection-1' as CollectionId;
      const expectedCollection = {
        id: 'collection-1',
        collectionId,
        name: 'Test Collection',
        description: 'Test Description',
        status: 'active',
        deleted: false,
      } as Collection;

      mockRepository.findOne.mockResolvedValue(expectedCollection);

      // Act
      const result =
        await collectionRepository.findByCollectionId(collectionId);

      // Assert
      expect(result).toEqual(expectedCollection);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: {
          collectionId,
          deleted: false,
        },
      });
    });

    it('当集合ID不存在时应该返回null', async () => {
      // Arrange
      const collectionId = 'non-existent' as CollectionId;
      mockRepository.findOne.mockResolvedValue(null);

      // Act
      const result =
        await collectionRepository.findByCollectionId(collectionId);

      // Assert
      expect(result).toBeNull();
    });

    it('当数据库查询失败时应该抛出错误', async () => {
      // Arrange
      const collectionId = 'collection-1' as CollectionId;
      const error = new Error('Database error');
      mockRepository.findOne.mockRejectedValue(error);

      // Act & Assert
      await expect(
        collectionRepository.findByCollectionId(collectionId),
      ).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('根据集合ID查找集合失败', {
        collectionId,
        error: 'Database error',
      });
    });
  });

  describe('findAllActive', () => {
    it('应该返回所有活跃集合', async () => {
      // Arrange
      const expectedCollections = [
        {
          id: 'collection-1',
          collectionId: 'collection-1',
          name: 'Collection 1',
          status: 'active',
          deleted: false,
        },
        {
          id: 'collection-2',
          collectionId: 'collection-2',
          name: 'Collection 2',
          status: 'active',
          deleted: false,
        },
      ] as Collection[];

      mockRepository.find.mockResolvedValue(expectedCollections);

      // Act
      const result = await collectionRepository.findAllActive();

      // Assert
      expect(result).toEqual(expectedCollections);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: {
          deleted: false,
          status: 'active',
        },
        order: { created_at: 'DESC' },
      });
    });

    it('当数据库查询失败时应该抛出错误', async () => {
      // Arrange
      const error = new Error('Database error');
      mockRepository.find.mockRejectedValue(error);

      // Act & Assert
      await expect(collectionRepository.findAllActive()).rejects.toThrow(
        'Database error',
      );
      expect(mockLogger.error).toHaveBeenCalledWith('获取所有活跃集合失败', {
        error: 'Database error',
      });
    });
  });

  describe('findWithPagination', () => {
    it('应该返回分页的集合', async () => {
      // Arrange
      const paginationOptions = { page: 1, limit: 10 };
      const expectedCollections = [
        {
          id: 'collection-1',
          collectionId: 'collection-1',
          name: 'Collection 1',
          status: 'active',
          deleted: false,
        },
      ] as Collection[];

      // 为这个测试定制mock QueryBuilder
      mockRepository.createQueryBuilder.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        getMany: jest.fn().mockResolvedValue(expectedCollections),
        getManyAndCount: jest.fn().mockResolvedValue([expectedCollections, 1]),
      }));

      // Act
      const result =
        await collectionRepository.findWithPagination(paginationOptions);

      // Assert
      expect(result.data).toEqual(expectedCollections);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    it('应该支持状态过滤', async () => {
      // Arrange
      const paginationOptions = { page: 1, limit: 10 };
      const status = 'inactive' as const;

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      await collectionRepository.findWithPagination(paginationOptions, status);

      // Assert
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'collection.status = :status',
        { status },
      );
    });

    it('当数据库查询失败时应该抛出错误', async () => {
      // Arrange
      const paginationOptions = { page: 1, limit: 10 };
      const error = new Error('Database error');

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockRejectedValue(error),
        getMany: jest.fn().mockRejectedValue(error),
        getManyAndCount: jest.fn().mockRejectedValue(error),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act & Assert
      await expect(
        collectionRepository.findWithPagination(paginationOptions),
      ).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('分页获取集合失败', {
        paginationOptions,
        status: undefined,
        error: 'Database error',
      });
    });
  });

  describe('updateCollection', () => {
    it('应该更新集合信息', async () => {
      // Arrange
      const collectionId = 'collection-1' as CollectionId;
      const updateData = {
        name: 'Updated Collection',
        description: 'Updated Description',
      };
      const updatedCollection = {
        id: collectionId,
        collectionId,
        name: 'Updated Collection',
        description: 'Updated Description',
        status: 'active',
        deleted: false,
      } as Collection;

      // Mock the update method from BaseRepository
      jest
        .spyOn(collectionRepository, 'update')
        .mockResolvedValue(updatedCollection);

      // Act
      const result = await collectionRepository.updateCollection(
        collectionId,
        updateData,
      );

      // Assert
      expect(result).toEqual(updatedCollection);
      expect(collectionRepository.update).toHaveBeenCalledWith(
        collectionId,
        updateData,
      );
      expect(mockLogger.debug).toHaveBeenCalledWith('更新集合成功', {
        id: collectionId,
        updatedFields: ['name', 'description'],
      });
    });

    it('当更新失败时应该抛出错误', async () => {
      // Arrange
      const collectionId = 'collection-1' as CollectionId;
      const updateData = { name: 'Updated Collection' };
      const error = new Error('Update failed');

      jest.spyOn(collectionRepository, 'update').mockRejectedValue(error);

      // Act & Assert
      await expect(
        collectionRepository.updateCollection(collectionId, updateData),
      ).rejects.toThrow('Update failed');
      expect(mockLogger.error).toHaveBeenCalledWith('更新集合失败', {
        id: collectionId,
        data: updateData,
        error: 'Update failed',
      });
    });
  });

  describe('existsByName', () => {
    it('当集合名称存在时应该返回true', async () => {
      // Arrange
      const collectionName = 'Existing Collection';
      mockRepository.count.mockResolvedValue(1);

      // Act
      const result = await collectionRepository.existsByName(collectionName);

      // Assert
      expect(result).toBe(true);
      expect(mockRepository.count).toHaveBeenCalledWith({
        where: {
          name: collectionName,
          deleted: false,
        },
      });
    });

    it('当集合名称不存在时应该返回false', async () => {
      // Arrange
      const collectionName = 'Non-existent Collection';
      mockRepository.count.mockResolvedValue(0);

      // Act
      const result = await collectionRepository.existsByName(collectionName);

      // Assert
      expect(result).toBe(false);
    });

    it('应该支持排除特定ID的检查', async () => {
      // Arrange
      const collectionName = 'Collection Name';
      const excludeId = 'collection-1' as CollectionId;
      mockRepository.count.mockResolvedValue(0);

      // Act
      await collectionRepository.existsByName(collectionName, excludeId);

      // Assert
      expect(mockRepository.count).toHaveBeenCalledWith({
        where: {
          name: collectionName,
          deleted: false,
          id: expect.any(Object), // Not(excludeId) creates a Not object
        },
      });
    });

    it('当数据库查询失败时应该抛出错误', async () => {
      // Arrange
      const collectionName = 'Test Collection';
      const error = new Error('Database error');
      mockRepository.count.mockRejectedValue(error);

      // Act & Assert
      await expect(
        collectionRepository.existsByName(collectionName),
      ).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('检查集合名称存在性失败', {
        name: collectionName,
        excludeId: undefined,
        error: 'Database error',
      });
    });
  });

  describe('getCount', () => {
    it('应该返回集合总数', async () => {
      // Arrange
      const expectedCount = 5;
      mockRepository.count.mockResolvedValue(expectedCount);

      // Act
      const result = await collectionRepository.getCount();

      // Assert
      expect(result).toBe(expectedCount);
      expect(mockRepository.count).toHaveBeenCalledWith({
        where: {
          deleted: false,
        },
      });
    });

    it('应该支持状态过滤', async () => {
      // Arrange
      const status = 'active' as const;
      const expectedCount = 3;
      mockRepository.count.mockResolvedValue(expectedCount);

      // Act
      const result = await collectionRepository.getCount(status);

      // Assert
      expect(result).toBe(expectedCount);
      expect(mockRepository.count).toHaveBeenCalledWith({
        where: {
          deleted: false,
          status,
        },
      });
    });

    it('当数据库查询失败时应该抛出错误', async () => {
      // Arrange
      const error = new Error('Database error');
      mockRepository.count.mockRejectedValue(error);

      // Act & Assert
      await expect(collectionRepository.getCount()).rejects.toThrow(
        'Database error',
      );
      expect(mockLogger.error).toHaveBeenCalledWith('获取集合总数失败', {
        status: undefined,
        error: 'Database error',
      });
    });
  });

  describe('findByPrefix', () => {
    it('应该根据前缀查找集合', async () => {
      // Arrange
      const prefix = 'Test';
      const expectedCollections = [
        {
          id: 'collection-1',
          collectionId: 'collection-1',
          name: 'Test Collection 1',
          status: 'active',
          deleted: false,
        },
        {
          id: 'collection-2',
          collectionId: 'collection-2',
          name: 'Test Collection 2',
          status: 'active',
          deleted: false,
        },
      ] as Collection[];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(expectedCollections),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await collectionRepository.findByPrefix(prefix);

      // Assert
      expect(result).toEqual(expectedCollections);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'collection.name LIKE :prefix',
        { prefix: `${prefix}%` },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'collection.deleted = :deleted',
        { deleted: false },
      );
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'collection.created_at',
        'DESC',
      );
      expect(mockQueryBuilder.limit).not.toHaveBeenCalled();
    });

    it('应该支持结果限制', async () => {
      // Arrange
      const prefix = 'Test';
      const limit = 5;

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      await collectionRepository.findByPrefix(prefix, limit);

      // Assert
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(limit);
    });

    it('当数据库查询失败时应该抛出错误', async () => {
      // Arrange
      const prefix = 'Test';
      const error = new Error('Database error');

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockRejectedValue(error),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act & Assert
      await expect(collectionRepository.findByPrefix(prefix)).rejects.toThrow(
        'Database error',
      );
      expect(mockLogger.error).toHaveBeenCalledWith('根据前缀查找集合失败', {
        prefix,
        limit: undefined,
        error: 'Database error',
      });
    });
  });

  describe('batchUpdateStatus', () => {
    it('应该批量更新集合状态', async () => {
      // Arrange
      const collectionIds = ['collection-1', 'collection-2'] as CollectionId[];
      const status = 'inactive' as const;
      const expectedResult = { success: 2, failed: 0 };

      // Mock the updateBatch method from BaseRepository
      jest
        .spyOn(collectionRepository, 'updateBatch')
        .mockResolvedValue(expectedResult);

      // Act
      const result = await collectionRepository.batchUpdateStatus(
        collectionIds,
        status,
      );

      // Assert
      expect(result).toEqual({ updated: 2, failed: 0 });
      expect(collectionRepository.updateBatch).toHaveBeenCalledWith(
        collectionIds,
        { status },
      );
      expect(mockLogger.debug).toHaveBeenCalledWith('批量更新集合状态完成', {
        requested: 2,
        updated: 2,
        failed: 0,
        status,
      });
    });

    it('当批量更新失败时应该抛出错误', async () => {
      // Arrange
      const collectionIds = ['collection-1'] as CollectionId[];
      const status = 'active' as const;
      const error = new Error('Batch update failed');

      jest.spyOn(collectionRepository, 'updateBatch').mockRejectedValue(error);

      // Act & Assert
      await expect(
        collectionRepository.batchUpdateStatus(collectionIds, status),
      ).rejects.toThrow('Batch update failed');
      expect(mockLogger.error).toHaveBeenCalledWith('批量更新集合状态失败', {
        ids: collectionIds,
        status,
        error: 'Batch update failed',
      });
    });
  });

  describe('batchSoftDelete', () => {
    it('应该批量软删除集合', async () => {
      // Arrange
      const collectionIds = ['collection-1', 'collection-2'] as CollectionId[];
      const deletedCount = 2;

      // Mock the softDeleteBatch method from BaseRepository
      jest
        .spyOn(collectionRepository, 'softDeleteBatch')
        .mockResolvedValue(deletedCount);

      // Act
      const result = await collectionRepository.batchSoftDelete(collectionIds);

      // Assert
      expect(result).toBe(deletedCount);
      expect(collectionRepository.softDeleteBatch).toHaveBeenCalledWith(
        collectionIds,
      );
      expect(mockLogger.debug).toHaveBeenCalledWith('批量软删除集合完成', {
        requested: 2,
        deleted: deletedCount,
      });
    });

    it('当批量软删除失败时应该抛出错误', async () => {
      // Arrange
      const collectionIds = ['collection-1'] as CollectionId[];
      const error = new Error('Batch soft delete failed');

      jest
        .spyOn(collectionRepository, 'softDeleteBatch')
        .mockRejectedValue(error);

      // Act & Assert
      await expect(
        collectionRepository.batchSoftDelete(collectionIds),
      ).rejects.toThrow('Batch soft delete failed');
      expect(mockLogger.error).toHaveBeenCalledWith('批量软删除集合失败', {
        ids: collectionIds,
        error: 'Batch soft delete failed',
      });
    });
  });

  describe('updateDocumentCount', () => {
    it('应该更新集合文档数量', async () => {
      // Arrange
      const collectionId = 'collection-1' as CollectionId;
      const count = 10;
      const updatedCollection = {
        id: collectionId,
        collectionId,
        name: 'Test Collection',
        documentCount: count,
        status: 'active',
        deleted: false,
      } as Collection;

      // Mock the update method from BaseRepository
      jest
        .spyOn(collectionRepository, 'update')
        .mockResolvedValue(updatedCollection);

      // Act
      const result = await collectionRepository.updateDocumentCount(
        collectionId,
        count,
      );

      // Assert
      expect(result).toBe(true);
      expect(collectionRepository.update).toHaveBeenCalledWith(collectionId, {
        documentCount: count,
      });
      expect(mockLogger.debug).toHaveBeenCalledWith('更新集合文档数量成功', {
        id: collectionId,
        count,
      });
    });

    it('当更新失败时应该返回false', async () => {
      // Arrange
      const collectionId = 'collection-1' as CollectionId;
      const count = 10;

      // Mock the update method from BaseRepository
      jest.spyOn(collectionRepository, 'update').mockResolvedValue(null);

      // Act
      const result = await collectionRepository.updateDocumentCount(
        collectionId,
        count,
      );

      // Assert
      expect(result).toBe(false);
    });

    it('当数据库查询失败时应该抛出错误', async () => {
      // Arrange
      const collectionId = 'collection-1' as CollectionId;
      const count = 10;
      const error = new Error('Update failed');

      jest.spyOn(collectionRepository, 'update').mockRejectedValue(error);

      // Act & Assert
      await expect(
        collectionRepository.updateDocumentCount(collectionId, count),
      ).rejects.toThrow('Update failed');
      expect(mockLogger.error).toHaveBeenCalledWith('更新集合文档数量失败', {
        id: collectionId,
        count,
        error: 'Update failed',
      });
    });
  });

  describe('getStatistics', () => {
    it('应该返回集合统计信息', async () => {
      // Arrange
      const expectedStats = {
        total: 10,
        active: 7,
        inactive: 2,
        archived: 1,
        totalDocuments: 100,
        totalChunks: 500,
      };

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          total: '10',
          active: '7',
          inactive: '2',
          archived: '1',
          totalDocuments: '100',
          totalChunks: '500',
        }),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await collectionRepository.getStatistics();

      // Assert
      expect(result).toEqual(expectedStats);
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('COUNT(*)', 'total');
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith(
        'SUM(CASE WHEN status = :active THEN 1 ELSE 0 END)',
        'active',
      );
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith(
        'SUM(CASE WHEN status = :inactive THEN 1 ELSE 0 END)',
        'inactive',
      );
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith(
        'SUM(CASE WHEN status = :archived THEN 1 ELSE 0 END)',
        'archived',
      );
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith(
        'SUM(documentCount)',
        'totalDocuments',
      );
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith(
        'SUM(chunkCount)',
        'totalChunks',
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'collection.deleted = :deleted',
        { deleted: false },
      );
      expect(mockQueryBuilder.setParameters).toHaveBeenCalledWith({
        active: 'active',
        inactive: 'inactive',
        archived: 'archived',
      });
    });

    it('当数据库查询失败时应该抛出错误', async () => {
      // Arrange
      const error = new Error('Database error');

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockRejectedValue(error),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act & Assert
      await expect(collectionRepository.getStatistics()).rejects.toThrow(
        'Database error',
      );
      expect(mockLogger.error).toHaveBeenCalledWith('获取集合统计信息失败', {
        error: 'Database error',
      });
    });

    it('应该处理空结果', async () => {
      // Arrange
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(null),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await collectionRepository.getStatistics();

      // Assert
      expect(result).toEqual({
        total: 0,
        active: 0,
        inactive: 0,
        archived: 0,
        totalDocuments: 0,
        totalChunks: 0,
      });
    });
  });
});
