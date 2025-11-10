/**
 * DocRepository 单元测试
 * 测试文档相关的数据库操作
 */

import { DocRepository } from '../../../../src/infrastructure/database/repositories/DocRepository.js';
import { DataSource } from 'typeorm';
import { Doc } from '../../../../src/infrastructure/database/entities/Doc.js';
import { Logger } from '@logging/logger.js';
import { DocId, CollectionId } from '@domain/entities/types.js';

// Mock dependencies
jest.mock('@logging/logger.js');

describe('DocRepository', () => {
  let docRepository: DocRepository;
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
        new: '0',
        processing: '0',
        completed: '0',
        failed: '0',
        deleted: '0',
        totalSize: '0',
      }),
      limit: jest.fn().mockReturnThis(),
    });

    mockRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn().mockImplementation(() => createMockQueryBuilder()),
      update: jest.fn(),
      delete: jest.fn(),
      save: jest.fn(),
    };

    mockDataSource = {
      getRepository: jest.fn().mockReturnValue(mockRepository),
    } as any;

    docRepository = new DocRepository(mockDataSource, mockLogger);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    // 清理缓存定时器以防止Jest挂起
    await docRepository.destroy();
  });

  describe('findByCollectionId', () => {
    it('应该根据集合ID查找文档', async () => {
      // Arrange
      const collectionId = 'collection-1' as CollectionId;
      const expectedDocs = [
        {
          id: 'doc-1',
          docId: 'doc-1',
          collectionId,
          key: 'doc1',
          name: 'Document 1',
          status: 'completed',
          deleted: false,
        },
        {
          id: 'doc-2',
          docId: 'doc-2',
          collectionId,
          key: 'doc2',
          name: 'Document 2',
          status: 'new',
          deleted: false,
        },
      ] as Doc[];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(expectedDocs),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await docRepository.findByCollectionId(collectionId);

      // Assert
      expect(result).toEqual(expectedDocs);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('doc.collectionId = :collectionId', { collectionId });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('doc.deleted = :deleted', { deleted: false });
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith('doc.created_at', 'DESC');
      expect(mockQueryBuilder.limit).not.toHaveBeenCalled();
    });

    it('应该支持状态过滤', async () => {
      // Arrange
      const collectionId = 'collection-1' as CollectionId;
      const status = 'completed' as const;

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      await docRepository.findByCollectionId(collectionId, { status });

      // Assert
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('doc.status = :status', { status });
    });

    it('应该支持结果限制', async () => {
      // Arrange
      const collectionId = 'collection-1' as CollectionId;
      const limit = 5;

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      await docRepository.findByCollectionId(collectionId, { limit });

      // Assert
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(limit);
    });

    it('应该支持自定义排序', async () => {
      // Arrange
      const collectionId = 'collection-1' as CollectionId;
      const orderBy = { name: 'ASC' as const };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      await docRepository.findByCollectionId(collectionId, { orderBy });

      // Assert
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith('doc.name', 'ASC');
    });

    it('当数据库查询失败时应该抛出错误', async () => {
      // Arrange
      const collectionId = 'collection-1' as CollectionId;
      const error = new Error('Database error');

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockRejectedValue(error),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act & Assert
      await expect(docRepository.findByCollectionId(collectionId)).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('根据集合ID查找文档失败', {
        collectionId,
        options: {},
        error: 'Database error',
      });
    });
  });

  describe('findByCollectionAndKey', () => {
    it('应该根据集合ID和键值查找文档', async () => {
      // Arrange
      const collectionId = 'collection-1' as CollectionId;
      const key = 'test-doc';
      const expectedDoc = {
        id: 'doc-1',
        docId: 'doc-1',
        collectionId,
        key,
        name: 'Test Document',
        status: 'completed',
        deleted: false,
      } as Doc;

      mockRepository.findOne.mockResolvedValue(expectedDoc);

      // Act
      const result = await docRepository.findByCollectionAndKey(collectionId, key);

      // Assert
      expect(result).toEqual(expectedDoc);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: {
          collectionId,
          key,
          deleted: false,
        },
      });
    });

    it('当文档不存在时应该返回null', async () => {
      // Arrange
      const collectionId = 'collection-1' as CollectionId;
      const key = 'non-existent';
      mockRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await docRepository.findByCollectionAndKey(collectionId, key);

      // Assert
      expect(result).toBeNull();
    });

    it('当数据库查询失败时应该抛出错误', async () => {
      // Arrange
      const collectionId = 'collection-1' as CollectionId;
      const key = 'test-doc';
      const error = new Error('Database error');
      mockRepository.findOne.mockRejectedValue(error);

      // Act & Assert
      await expect(docRepository.findByCollectionAndKey(collectionId, key)).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('根据集合和键值查找文档失败', {
        collectionId,
        key,
        error: 'Database error',
      });
    });
  });

  describe('findAllActive', () => {
    it('应该返回所有活跃文档', async () => {
      // Arrange
      const expectedDocs = [
        {
          id: 'doc-1',
          docId: 'doc-1',
          collectionId: 'collection-1',
          key: 'doc1',
          name: 'Document 1',
          status: 'completed',
          deleted: false,
        },
        {
          id: 'doc-2',
          docId: 'doc-2',
          collectionId: 'collection-2',
          key: 'doc2',
          name: 'Document 2',
          status: 'new',
          deleted: false,
        },
      ] as Doc[];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(expectedDocs),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await docRepository.findAllActive();

      // Assert
      expect(result).toEqual(expectedDocs);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('doc.deleted = :deleted', { deleted: false });
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith('doc.created_at', 'DESC');
    });

    it('应该支持状态过滤', async () => {
      // Arrange
      const status = 'completed' as const;

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      await docRepository.findAllActive({ status });

      // Assert
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('doc.status = :status', { status });
    });

    it('当数据库查询失败时应该抛出错误', async () => {
      // Arrange
      const error = new Error('Database error');

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockRejectedValue(error),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act & Assert
      await expect(docRepository.findAllActive()).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('获取所有活跃文档失败', {
        options: {},
        error: 'Database error',
      });
    });
  });

  describe('findWithPagination', () => {
    it('应该返回分页的文档', async () => {
      // Arrange
      const paginationOptions = { page: 1, limit: 10 };
      const collectionId = 'collection-1' as CollectionId;
      const status = 'completed' as const;
      const expectedDocs = [
        {
          id: 'doc-1',
          docId: 'doc-1',
          collectionId,
          key: 'doc1',
          name: 'Document 1',
          status,
          deleted: false,
        },
      ] as Doc[];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([expectedDocs, 1]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Mock the parent class method
      jest.spyOn(docRepository, 'findWithPagination' as any).mockResolvedValue({
        data: expectedDocs,
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });

      // Act
      const result = await docRepository.findWithPagination(paginationOptions, collectionId, status);

      // Assert
      expect(result.data).toEqual(expectedDocs);
      expect(result.pagination.total).toBe(1);
    });

    it('当数据库查询失败时应该抛出错误', async () => {
      // Arrange
      const paginationOptions = { page: 1, limit: 10 };
      const error = new Error('Database error');

      // Mock the parent class's findWithPagination method instead
      const superFindWithPagination = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(docRepository)), 'findWithPagination');
      superFindWithPagination.mockRejectedValue(error);

      // Act & Assert
      await expect(docRepository.findWithPagination(paginationOptions)).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('分页获取文档失败', {
        paginationOptions,
        collectionId: undefined,
        status: undefined,
        error: 'Database error',
      });
    });
  });

  describe('softDelete', () => {
    it('应该软删除文档', async () => {
      // Arrange
      const docId = 'doc-1' as DocId;
      const updateResult = { affected: 1 };
      mockRepository.update.mockResolvedValue(updateResult);

      // Act
      const result = await docRepository.softDelete(docId);

      // Assert
      expect(result).toBe(true);
      expect(mockRepository.update).toHaveBeenCalledWith(docId, {
        deleted: true,
        deleted_at: expect.any(Number),
        updated_at: expect.any(Number),
      });
      expect(mockLogger.debug).toHaveBeenCalledWith('软删除文档成功', { id: docId });
    });

    it('当文档不存在时应该返回false', async () => {
      // Arrange
      const docId = 'non-existent' as DocId;
      const updateResult = { affected: 0 };
      mockRepository.update.mockResolvedValue(updateResult);

      // Act
      const result = await docRepository.softDelete(docId);

      // Assert
      expect(result).toBe(false);
    });

    it('当数据库操作失败时应该抛出错误', async () => {
      // Arrange
      const docId = 'doc-1' as DocId;
      const error = new Error('Database error');
      mockRepository.update.mockRejectedValue(error);

      // Act & Assert
      await expect(docRepository.softDelete(docId)).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('软删除文档失败', {
        id: docId,
        error: 'Database error',
      });
    });
  });

  describe('batchSoftDelete', () => {
    it('应该批量软删除文档', async () => {
      // Arrange
      const docIds = ['doc-1', 'doc-2'] as DocId[];
      const deletedCount = 2;

      // Mock softDeleteBatch method from BaseRepository
      jest.spyOn(docRepository, 'softDeleteBatch').mockResolvedValue(deletedCount);

      // Act
      const result = await docRepository.batchSoftDelete(docIds);

      // Assert
      expect(result).toBe(deletedCount);
      expect(docRepository.softDeleteBatch).toHaveBeenCalledWith(docIds);
      expect(mockLogger.debug).toHaveBeenCalledWith('批量软删除文档完成', {
        requested: 2,
        deleted: deletedCount,
      });
    });

    it('当批量软删除失败时应该抛出错误', async () => {
      // Arrange
      const docIds = ['doc-1'] as DocId[];
      const error = new Error('Batch soft delete failed');

      jest.spyOn(docRepository, 'softDeleteBatch').mockRejectedValue(error);

      // Act & Assert
      await expect(docRepository.batchSoftDelete(docIds)).rejects.toThrow('Batch soft delete failed');
      expect(mockLogger.error).toHaveBeenCalledWith('批量软删除文档失败', {
        ids: docIds,
        error: 'Batch soft delete failed',
      });
    });
  });

  describe('restore', () => {
    it('应该恢复已删除的文档', async () => {
      // Arrange
      const docId = 'doc-1' as DocId;
      const updateResult = { affected: 1 };
      mockRepository.update.mockResolvedValue(updateResult);

      // Act
      const result = await docRepository.restore(docId);

      // Assert
      expect(result).toBe(true);
      expect(mockRepository.update).toHaveBeenCalledWith(docId, {
        deleted: false,
        deleted_at: null,
        updated_at: expect.any(Number),
      });
      expect(mockLogger.debug).toHaveBeenCalledWith('恢复文档成功', { id: docId });
    });

    it('当文档不存在时应该返回false', async () => {
      // Arrange
      const docId = 'non-existent' as DocId;
      const updateResult = { affected: 0 };
      mockRepository.update.mockResolvedValue(updateResult);

      // Act
      const result = await docRepository.restore(docId);

      // Assert
      expect(result).toBe(false);
    });

    it('当数据库操作失败时应该抛出错误', async () => {
      // Arrange
      const docId = 'doc-1' as DocId;
      const error = new Error('Database error');
      mockRepository.update.mockRejectedValue(error);

      // Act & Assert
      await expect(docRepository.restore(docId)).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('恢复文档失败', {
        id: docId,
        error: 'Database error',
      });
    });
  });

  describe('batchRestore', () => {
    it('应该批量恢复文档', async () => {
      // Arrange
      const docIds = ['doc-1', 'doc-2'] as DocId[];
      const updateResult = { affected: 2 };

      const mockQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(updateResult),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await docRepository.batchRestore(docIds);

      // Assert
      expect(result).toBe(2);
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(Doc);
      expect(mockQueryBuilder.set).toHaveBeenCalledWith({
        deleted: false,
        deleted_at: null,
        updated_at: expect.any(Number),
      });
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('id IN (:...ids)', { ids: docIds });
      expect(mockLogger.debug).toHaveBeenCalledWith('批量恢复文档完成', {
        requested: 2,
        restored: 2,
      });
    });

    it('当批量恢复失败时应该抛出错误', async () => {
      // Arrange
      const docIds = ['doc-1'] as DocId[];
      const error = new Error('Batch restore failed');

      const mockQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockRejectedValue(error),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act & Assert
      await expect(docRepository.batchRestore(docIds)).rejects.toThrow('Batch restore failed');
      expect(mockLogger.error).toHaveBeenCalledWith('批量恢复文档失败', {
        ids: docIds,
        error: 'Batch restore failed',
      });
    });
  });

  describe('findByContentHash', () => {
    it('应该根据内容哈希查找文档', async () => {
      // Arrange
      const contentHash = 'abc123def456';
      const expectedDoc = {
        id: 'doc-1',
        docId: 'doc-1',
        collectionId: 'collection-1',
        key: 'doc1',
        name: 'Document 1',
        content_hash: contentHash,
        status: 'completed',
        deleted: false,
      } as Doc;

      mockRepository.findOne.mockResolvedValue(expectedDoc);

      // Act
      const result = await docRepository.findByContentHash(contentHash);

      // Assert
      expect(result).toEqual(expectedDoc);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: {
          content_hash: contentHash,
          deleted: false,
        },
      });
    });

    it('当内容哈希不存在时应该返回null', async () => {
      // Arrange
      const contentHash = 'nonexistent';
      mockRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await docRepository.findByContentHash(contentHash);

      // Assert
      expect(result).toBeNull();
    });

    it('当数据库查询失败时应该抛出错误', async () => {
      // Arrange
      const contentHash = 'abc123def456';
      const error = new Error('Database error');
      mockRepository.findOne.mockRejectedValue(error);

      // Act & Assert
      await expect(docRepository.findByContentHash(contentHash)).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('根据内容哈希查找文档失败', {
        contentHash,
        error: 'Database error',
      });
    });
  });

  describe('findByContentHashes', () => {
    it('应该批量查找内容哈希', async () => {
      // Arrange
      const contentHashes = ['hash1', 'hash2', 'hash3'];
      const expectedDocs = [
        {
          id: 'doc-1',
          docId: 'doc-1',
          collectionId: 'collection-1',
          key: 'doc1',
          name: 'Document 1',
          content_hash: 'hash1',
          status: 'completed',
          deleted: false,
        },
        {
          id: 'doc-2',
          docId: 'doc-2',
          collectionId: 'collection-2',
          key: 'doc2',
          name: 'Document 2',
          content_hash: 'hash2',
          status: 'completed',
          deleted: false,
        },
      ] as Doc[];

      mockRepository.find.mockResolvedValue(expectedDocs);

      // Act
      const result = await docRepository.findByContentHashes(contentHashes);

      // Assert
      expect(result).toEqual(expectedDocs);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: {
          content_hash: expect.any(Object), // In(contentHashes) creates an In object
          deleted: false,
        },
      });
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
      const contentHashes = ['hash1', 'hash2'];
      const error = new Error('Database error');
      mockRepository.find.mockRejectedValue(error);

      // Act & Assert
      await expect(docRepository.findByContentHashes(contentHashes)).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('批量查找内容哈希失败', {
        contentHashes,
        error: 'Database error',
      });
    });
  });

  describe('updateDocInfo', () => {
    it('应该更新文档基本信息', async () => {
      // Arrange
      const docId = 'doc-1' as DocId;
      const updateData = {
        name: 'Updated Document',
        mime: 'text/plain',
        size_bytes: 2048,
      };
      const updatedDoc = {
        id: docId,
        docId,
        collectionId: 'collection-1',
        key: 'doc1',
        name: 'Updated Document',
        mime: 'text/plain',
        size_bytes: 2048,
        status: 'completed',
        deleted: false,
      } as Doc;

      // Mock update method from BaseRepository
      jest.spyOn(docRepository, 'update').mockResolvedValue(updatedDoc);

      // Act
      const result = await docRepository.updateDocInfo(docId, updateData);

      // Assert
      expect(result).toEqual(updatedDoc);
      expect(docRepository.update).toHaveBeenCalledWith(docId, updateData);
      expect(mockLogger.debug).toHaveBeenCalledWith('更新文档基本信息成功', {
        id: docId,
        updatedFields: ['name', 'mime', 'size_bytes'],
      });
    });

    it('当更新失败时应该抛出错误', async () => {
      // Arrange
      const docId = 'doc-1' as DocId;
      const updateData = { name: 'Updated Document' };
      const error = new Error('Update failed');

      jest.spyOn(docRepository, 'update').mockRejectedValue(error);

      // Act & Assert
      await expect(docRepository.updateDocInfo(docId, updateData)).rejects.toThrow('Update failed');
      expect(mockLogger.error).toHaveBeenCalledWith('更新文档基本信息失败', {
        id: docId,
        data: updateData,
        error: 'Update failed',
      });
    });
  });

  describe('findByStatus', () => {
    it('应该根据状态查找文档', async () => {
      // Arrange
      const status = 'failed' as const;
      const expectedDocs = [
        {
          id: 'doc-1',
          docId: 'doc-1',
          collectionId: 'collection-1',
          key: 'doc1',
          name: 'Document 1',
          status,
          deleted: false,
        },
      ] as Doc[];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(expectedDocs),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await docRepository.findByStatus(status);

      // Assert
      expect(result).toEqual(expectedDocs);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('doc.status = :status', { status });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('doc.deleted = :deleted', { deleted: false });
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith('doc.created_at', 'DESC');
    });

    it('应该支持集合ID过滤', async () => {
      // Arrange
      const status = 'completed' as const;
      const collectionId = 'collection-1' as CollectionId;

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      await docRepository.findByStatus(status, { collectionId });

      // Assert
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('doc.collectionId = :collectionId', { collectionId });
    });

    it('当数据库查询失败时应该抛出错误', async () => {
      // Arrange
      const status = 'new' as const;
      const error = new Error('Database error');

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockRejectedValue(error),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act & Assert
      await expect(docRepository.findByStatus(status)).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('根据状态查找文档失败', {
        status,
        options: {},
        error: 'Database error',
      });
    });
  });

  describe('batchUpdateStatus', () => {
    it('应该批量更新文档状态', async () => {
      // Arrange
      const docIds = ['doc-1', 'doc-2'] as DocId[];
      const status = 'completed' as const;
      const expectedResult = { success: 2, failed: 0 };

      // Mock updateBatch method from BaseRepository
      jest.spyOn(docRepository, 'updateBatch').mockResolvedValue(expectedResult);

      // Act
      const result = await docRepository.batchUpdateStatus(docIds, status);

      // Assert
      expect(result).toEqual({ ...expectedResult, updated: 2 });
      expect(docRepository.updateBatch).toHaveBeenCalledWith(docIds, { status });
      expect(mockLogger.debug).toHaveBeenCalledWith('批量更新文档状态完成', {
        requested: 2,
        updated: 2,
        failed: 0,
        status,
      });
    });

    it('当批量更新失败时应该抛出错误', async () => {
      // Arrange
      const docIds = ['doc-1'] as DocId[];
      const status = 'failed' as const;
      const error = new Error('Batch update failed');

      jest.spyOn(docRepository, 'updateBatch').mockRejectedValue(error);

      // Act & Assert
      await expect(docRepository.batchUpdateStatus(docIds, status)).rejects.toThrow('Batch update failed');
      expect(mockLogger.error).toHaveBeenCalledWith('批量更新文档状态失败', {
        ids: docIds,
        status,
        error: 'Batch update failed',
      });
    });
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

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          total: '10',
          new: '2',
          processing: '3',
          completed: '4',
          failed: '1',
          deleted: '0',
          totalSize: '10240',
        }),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await docRepository.getStatistics(collectionId);

      // Assert
      expect(result).toEqual(expectedStats);
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('COUNT(*)', 'total');
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith('SUM(CASE WHEN status = :new THEN 1 ELSE 0 END)', 'new');
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith('SUM(CASE WHEN status = :processing THEN 1 ELSE 0 END)', 'processing');
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith('SUM(CASE WHEN status = :completed THEN 1 ELSE 0 END)', 'completed');
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith('SUM(CASE WHEN status = :failed THEN 1 ELSE 0 END)', 'failed');
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith('SUM(CASE WHEN deleted = :deleted THEN 1 ELSE 0 END)', 'deleted');
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith('SUM(size_bytes)', 'totalSize');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('doc.collectionId = :collectionId', { collectionId });
      expect(mockQueryBuilder.setParameters).toHaveBeenCalledWith({
        new: 'new',
        processing: 'processing',
        completed: 'completed',
        failed: 'failed',
        deleted: true,
      });
    });

    it('当不指定集合ID时应该返回全局统计', async () => {
      // Arrange
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          total: '5',
          new: '1',
          processing: '1',
          completed: '2',
          failed: '1',
          deleted: '0',
          totalSize: '5120',
        }),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      await docRepository.getStatistics();

      // Assert
      expect(mockQueryBuilder.where).not.toHaveBeenCalled();
    });

    it('当数据库查询失败时应该抛出错误', async () => {
      // Arrange
      const collectionId = 'collection-1' as CollectionId;
      const error = new Error('Database error');

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockRejectedValue(error),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act & Assert
      await expect(docRepository.getStatistics(collectionId)).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('获取文档统计信息失败', {
        collectionId,
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
      const result = await docRepository.getStatistics();

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

  describe('deleteWithManager', () => {
    it('应该使用事务管理器删除文档', async () => {
      // Arrange
      const docId = 'doc-1' as DocId;
      const mockManager = {
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      // Act
      const result = await docRepository.deleteWithManager(docId, mockManager);

      // Assert
      expect(result).toEqual({ affected: 1 });
      expect(mockManager.delete).toHaveBeenCalledWith(Doc, { id: docId });
    });

    it('当删除失败时应该抛出错误', async () => {
      // Arrange
      const docId = 'doc-1' as DocId;
      const mockManager = {
        delete: jest.fn().mockRejectedValue(new Error('Delete failed')),
      };

      // Act & Assert
      await expect(docRepository.deleteWithManager(docId, mockManager)).rejects.toThrow('Delete failed');
      expect(mockLogger.error).toHaveBeenCalledWith('使用事务管理器删除文档失败', {
        id: docId,
        error: 'Delete failed',
      });
    });
  });
});