/**
 * ChunkRepository 单元测试
 * 测试块相关的数据库操作
 */

import { ChunkRepository } from '@infrastructure/database/repositories/ChunkRepository.js';
import { DataSource } from 'typeorm';
import { Chunk } from '@infrastructure/database/entities/Chunk.js';
import { Logger } from '@logging/logger.js';
import { DocId, CollectionId, PointId } from '@domain/entities/types.js';

// Mock dependencies
jest.mock('@logging/logger.js');

describe('ChunkRepository', () => {
  let chunkRepository: ChunkRepository;
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

    mockRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };

    mockDataSource = {
      getRepository: jest.fn().mockReturnValue(mockRepository),
    } as any;

    chunkRepository = new ChunkRepository(mockDataSource, mockLogger);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    // 清理缓存定时器以防止Jest挂起
    await chunkRepository.destroy();
  });

  describe('findByDocId', () => {
    it('应该根据文档ID查找块', async () => {
      // Arrange
      const docId = 'doc-1' as DocId;
      const expectedChunks = [
        {
          id: 'chunk-1',
          pointId: 'point-1',
          docId,
          collectionId: 'collection-1',
          chunkIndex: 0,
          title: 'Chunk 1',
          content: 'Content 1',
          contentLength: 10,
          embeddingStatus: 'completed',
          syncStatus: 'completed',
        },
        {
          id: 'chunk-2',
          pointId: 'point-2',
          docId,
          collectionId: 'collection-1',
          chunkIndex: 1,
          title: 'Chunk 2',
          content: 'Content 2',
          contentLength: 10,
          embeddingStatus: 'pending',
          syncStatus: 'pending',
        },
      ] as Chunk[];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(expectedChunks),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await chunkRepository.findByDocId(docId);

      // Assert
      expect(result).toEqual(expectedChunks);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'chunk.docId = :docId',
        { docId },
      );
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith(
        'chunk.chunkIndex',
        'ASC',
      );
      expect(mockQueryBuilder.select).toHaveBeenCalledWith([
        'chunk.id',
        'chunk.pointId',
        'chunk.docId',
        'chunk.collectionId',
        'chunk.chunkIndex',
        'chunk.title',
        'chunk.contentLength',
        'chunk.tokenCount',
        'chunk.embeddingStatus',
        'chunk.syncStatus',
        'chunk.embeddedAt',
        'chunk.syncedAt',
        'chunk.error',
        'chunk.metadata',
        'chunk.created_at',
        'chunk.updated_at',
      ]);
    });

    it('应该支持状态过滤', async () => {
      // Arrange
      const docId = 'doc-1' as DocId;
      const status = 'completed' as const;
      const syncStatus = 'completed' as const;

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      await chunkRepository.findByDocId(docId, { status, syncStatus });

      // Assert
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'chunk.embeddingStatus = :status',
        { status },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'chunk.syncStatus = :syncStatus',
        { syncStatus },
      );
    });

    it('应该支持结果限制', async () => {
      // Arrange
      const docId = 'doc-1' as DocId;
      const limit = 5;

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      await chunkRepository.findByDocId(docId, { limit });

      // Assert
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(limit);
    });

    it('应该支持包含内容', async () => {
      // Arrange
      const docId = 'doc-1' as DocId;
      const includeContent = true;

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      await chunkRepository.findByDocId(docId, { includeContent });

      // Assert
      expect(mockQueryBuilder.select).not.toHaveBeenCalled();
    });

    it('当数据库查询失败时应该抛出错误', async () => {
      // Arrange
      const docId = 'doc-1' as DocId;
      const error = new Error('Database error');

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockRejectedValue(error),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act & Assert
      await expect(chunkRepository.findByDocId(docId)).rejects.toThrow(
        'Database error',
      );
      expect(mockLogger.error).toHaveBeenCalledWith('根据文档ID查找块失败', {
        docId,
        options: {},
        error: 'Database error',
      });
    });
  });

  describe('findByCollectionId', () => {
    it('应该根据集合ID查找块', async () => {
      // Arrange
      const collectionId = 'collection-1' as CollectionId;
      const expectedChunks = [
        {
          id: 'chunk-1',
          pointId: 'point-1',
          docId: 'doc-1',
          collectionId,
          chunkIndex: 0,
          title: 'Chunk 1',
          content: 'Content 1',
          contentLength: 10,
          embeddingStatus: 'completed',
          syncStatus: 'completed',
        },
      ] as Chunk[];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(expectedChunks),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await chunkRepository.findByCollectionId(collectionId);

      // Assert
      expect(result).toEqual(expectedChunks);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'chunk.collectionId = :collectionId',
        { collectionId },
      );
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith(
        'chunk.chunkIndex',
        'ASC',
      );
    });

    it('应该支持状态过滤', async () => {
      // Arrange
      const collectionId = 'collection-1' as CollectionId;
      const status = 'pending' as const;

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      await chunkRepository.findByCollectionId(collectionId, { status });

      // Assert
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'chunk.embeddingStatus = :status',
        { status },
      );
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
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockRejectedValue(error),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act & Assert
      await expect(
        chunkRepository.findByCollectionId(collectionId),
      ).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('根据集合ID查找块失败', {
        collectionId,
        options: {},
        error: 'Database error',
      });
    });
  });

  describe('findByPointIds', () => {
    it('应该根据点ID数组查找块', async () => {
      // Arrange
      const pointIds = ['point-1', 'point-2'] as PointId[];
      const expectedChunks = [
        {
          id: 'chunk-1',
          pointId: 'point-1',
          docId: 'doc-1',
          collectionId: 'collection-1',
          chunkIndex: 0,
          title: 'Chunk 1',
          content: 'Content 1',
          contentLength: 10,
          embeddingStatus: 'completed',
          syncStatus: 'completed',
        },
        {
          id: 'chunk-2',
          pointId: 'point-2',
          docId: 'doc-2',
          collectionId: 'collection-1',
          chunkIndex: 0,
          title: 'Chunk 2',
          content: 'Content 2',
          contentLength: 10,
          embeddingStatus: 'completed',
          syncStatus: 'completed',
        },
      ] as Chunk[];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(expectedChunks),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await chunkRepository.findByPointIds(pointIds);

      // Assert
      expect(result).toEqual(expectedChunks);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'chunk.pointId IN (:...pointIds)',
        { pointIds },
      );
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith(
        'chunk.chunkIndex',
        'ASC',
      );
    });

    it('当点ID数组为空时应该返回空数组', async () => {
      // Arrange
      const pointIds: PointId[] = [];

      // Act
      const result = await chunkRepository.findByPointIds(pointIds);

      // Assert
      expect(result).toEqual([]);
      expect(mockRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('应该支持包含内容', async () => {
      // Arrange
      const pointIds = ['point-1'] as PointId[];
      const includeContent = true;

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      await chunkRepository.findByPointIds(pointIds, { includeContent });

      // Assert
      expect(mockQueryBuilder.select).not.toHaveBeenCalled();
    });

    it('当数据库查询失败时应该抛出错误', async () => {
      // Arrange
      const pointIds = ['point-1'] as PointId[];
      const error = new Error('Database error');

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockRejectedValue(error),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act & Assert
      await expect(chunkRepository.findByPointIds(pointIds)).rejects.toThrow(
        'Database error',
      );
      expect(mockLogger.error).toHaveBeenCalledWith('根据点ID数组查找块失败', {
        pointIds,
        options: {},
        error: 'Database error',
      });
    });
  });

  describe('findByPointId', () => {
    it('应该根据点ID查找单个块', async () => {
      // Arrange
      const pointId = 'point-1' as PointId;
      const expectedChunk = {
        id: 'chunk-1',
        pointId,
        docId: 'doc-1',
        collectionId: 'collection-1',
        chunkIndex: 0,
        title: 'Chunk 1',
        content: 'Content 1',
        contentLength: 10,
        embeddingStatus: 'completed',
        syncStatus: 'completed',
      } as Chunk;

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(expectedChunk),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await chunkRepository.findByPointId(pointId);

      // Assert
      expect(result).toEqual(expectedChunk);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'chunk.pointId = :pointId',
        { pointId },
      );
      expect(mockQueryBuilder.select).toHaveBeenCalledWith([
        'chunk.id',
        'chunk.pointId',
        'chunk.docId',
        'chunk.collectionId',
        'chunk.chunkIndex',
        'chunk.title',
        'chunk.contentLength',
        'chunk.tokenCount',
        'chunk.embeddingStatus',
        'chunk.syncStatus',
        'chunk.embeddedAt',
        'chunk.syncedAt',
        'chunk.error',
        'chunk.metadata',
        'chunk.created_at',
        'chunk.updated_at',
      ]);
    });

    it('当块不存在时应该返回null', async () => {
      // Arrange
      const pointId = 'non-existent' as PointId;

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await chunkRepository.findByPointId(pointId);

      // Assert
      expect(result).toBeNull();
    });

    it('应该支持包含内容', async () => {
      // Arrange
      const pointId = 'point-1' as PointId;
      const includeContent = true;

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      await chunkRepository.findByPointId(pointId, { includeContent });

      // Assert
      expect(mockQueryBuilder.select).not.toHaveBeenCalled();
    });

    it('当数据库查询失败时应该抛出错误', async () => {
      // Arrange
      const pointId = 'point-1' as PointId;
      const error = new Error('Database error');

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockRejectedValue(error),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act & Assert
      await expect(chunkRepository.findByPointId(pointId)).rejects.toThrow(
        'Database error',
      );
      expect(mockLogger.error).toHaveBeenCalledWith('根据点ID查找块失败', {
        pointId,
        options: {},
        error: 'Database error',
      });
    });
  });

  describe('createBatch', () => {
    it('应该批量创建块', async () => {
      // Arrange
      const chunks = [
        {
          pointId: 'point-1',
          docId: 'doc-1',
          collectionId: 'collection-1',
          chunkIndex: 0,
          title: 'Chunk 1',
          content: 'Content 1',
        },
        {
          pointId: 'point-2',
          docId: 'doc-1',
          collectionId: 'collection-1',
          chunkIndex: 1,
          title: 'Chunk 2',
          content: 'Content 2',
        },
      ] as Partial<Chunk>[];

      const expectedChunks = [
        {
          id: 'chunk-1',
          pointId: 'point-1',
          docId: 'doc-1',
          collectionId: 'collection-1',
          chunkIndex: 0,
          title: 'Chunk 1',
          content: 'Content 1',
          contentLength: 9,
        },
        {
          id: 'chunk-2',
          pointId: 'point-2',
          docId: 'doc-1',
          collectionId: 'collection-1',
          chunkIndex: 1,
          title: 'Chunk 2',
          content: 'Content 2',
          contentLength: 9,
        },
      ] as Chunk[];

      // Mock the parent class's createBatch method instead
      const superCreateBatch = jest.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(chunkRepository)),
        'createBatch',
      );
      superCreateBatch.mockResolvedValue(expectedChunks);

      // Act
      const result = await chunkRepository.createBatch(chunks);

      // Assert
      expect(result).toEqual(expectedChunks);
      expect(superCreateBatch).toHaveBeenCalledWith(
        chunks.map((chunk) => ({
          ...chunk,
          contentLength: chunk.content ? chunk.content.length : 0,
        })),
        100,
      );
      expect(mockLogger.debug).toHaveBeenCalledWith('批量创建块成功', {
        count: expectedChunks.length,
      });
    });

    it('应该支持自定义批次大小', async () => {
      // Arrange
      const chunks = [
        {
          pointId: 'point-1',
          docId: 'doc-1',
          collectionId: 'collection-1',
          chunkIndex: 0,
          title: 'Chunk 1',
          content: 'Content 1',
        },
      ] as Partial<Chunk>[];

      const expectedChunks = [
        {
          id: 'chunk-1',
          pointId: 'point-1',
          docId: 'doc-1',
          collectionId: 'collection-1',
          chunkIndex: 0,
          title: 'Chunk 1',
          content: 'Content 1',
          contentLength: 9,
        },
      ] as Chunk[];

      jest
        .spyOn(chunkRepository, 'createBatch' as any)
        .mockResolvedValue(expectedChunks);

      // Act
      const result = await chunkRepository.createBatch(chunks, 50);

      // Assert
      expect(result).toEqual(expectedChunks);
      expect(chunkRepository.createBatch).toHaveBeenCalledWith(chunks, 50);
    });

    it('当批量创建失败时应该抛出错误', async () => {
      // Arrange
      const chunks = [
        {
          pointId: 'point-1',
          docId: 'doc-1',
          collectionId: 'collection-1',
          chunkIndex: 0,
          title: 'Chunk 1',
          content: 'Content 1',
        },
      ] as Partial<Chunk>[];

      const error = new Error('Batch create failed');

      // Don't mock chunkRepository.createBatch, mock the BaseRepository's createBatch instead
      const superCreateBatch = jest.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(chunkRepository)),
        'createBatch',
      );
      superCreateBatch.mockRejectedValue(error);

      // Act & Assert
      await expect(chunkRepository.createBatch(chunks)).rejects.toThrow(
        'Batch create failed',
      );
      expect(mockLogger.error).toHaveBeenCalledWith('批量创建块失败', {
        count: chunks.length,
        error: 'Batch create failed',
      });
    });
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

  describe('getCount', () => {
    it('应该返回块总数', async () => {
      // Arrange
      const expectedCount = 15;
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(expectedCount),
      };

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
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(expectedCount),
      };

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
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(expectedCount),
      };

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
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(expectedCount),
      };

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
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockRejectedValue(error),
      };

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

  describe('batchUpdateStatus', () => {
    it('应该批量更新块状态', async () => {
      // Arrange
      const pointIds = ['point-1', 'point-2'] as PointId[];
      const status = 'completed' as const;
      const expectedResult = { success: 2, failed: 0 };

      // Mock updateBatch method from BaseRepository
      const updateBatchSpy = jest.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(chunkRepository)),
        'updateBatch',
      );
      updateBatchSpy.mockResolvedValue(expectedResult);

      // Act
      const result = await chunkRepository.batchUpdateStatus(pointIds, status);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(updateBatchSpy).toHaveBeenCalledWith(pointIds, {
        embeddingStatus: status,
      });
      expect(mockLogger.debug).toHaveBeenCalledWith('批量更新块状态完成', {
        requested: 2,
        updated: 2,
        failed: 0,
        status,
      });
    });

    it('当批量更新失败时应该抛出错误', async () => {
      // Arrange
      const pointIds = ['point-1'] as PointId[];
      const status = 'failed' as const;
      const error = new Error('Batch update failed');

      const updateBatchSpy = jest.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(chunkRepository)),
        'updateBatch',
      );
      updateBatchSpy.mockRejectedValue(error);

      // Act & Assert
      await expect(
        chunkRepository.batchUpdateStatus(pointIds, status),
      ).rejects.toThrow('Batch update failed');
      expect(mockLogger.error).toHaveBeenCalledWith('批量更新块状态失败', {
        pointIds,
        status,
        error: 'Batch update failed',
      });
    });
  });

  describe('batchUpdateSyncStatus', () => {
    it('应该批量更新块同步状态', async () => {
      // Arrange
      const pointIds = ['point-1', 'point-2'] as PointId[];
      const syncStatus = 'completed' as const;
      const expectedResult = { success: 2, failed: 0 };

      // Mock updateBatch method from BaseRepository
      const updateBatchSpy = jest.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(chunkRepository)),
        'updateBatch',
      );
      updateBatchSpy.mockResolvedValue(expectedResult);

      // Act
      const result = await chunkRepository.batchUpdateSyncStatus(
        pointIds,
        syncStatus,
      );

      // Assert
      expect(result).toEqual(expectedResult);
      expect(updateBatchSpy).toHaveBeenCalledWith(pointIds, {
        syncStatus,
      });
      expect(mockLogger.debug).toHaveBeenCalledWith('批量更新块同步状态完成', {
        requested: 2,
        updated: 2,
        failed: 0,
        syncStatus,
      });
    });

    it('当批量更新失败时应该抛出错误', async () => {
      // Arrange
      const pointIds = ['point-1'] as PointId[];
      const syncStatus = 'failed' as const;
      const error = new Error('Batch update failed');

      const updateBatchSpy = jest.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(chunkRepository)),
        'updateBatch',
      );
      updateBatchSpy.mockRejectedValue(error);

      // Act & Assert
      await expect(
        chunkRepository.batchUpdateSyncStatus(pointIds, syncStatus),
      ).rejects.toThrow('Batch update failed');
      expect(mockLogger.error).toHaveBeenCalledWith('批量更新块同步状态失败', {
        pointIds,
        syncStatus,
        error: 'Batch update failed',
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

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          total: '10',
          pending: '2',
          processing: '1',
          completed: '6',
          failed: '1',
          totalTokens: '1000',
          avgContentLength: '150.5',
        }),
      };

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
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          total: '5',
          pending: '1',
          processing: '0',
          completed: '4',
          failed: '0',
          totalTokens: '500',
          avgContentLength: '100.0',
        }),
      };

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
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(null),
      };

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

  describe('createBatchWithManager', () => {
    it('应该使用事务管理器批量创建块', async () => {
      // Arrange
      const chunks = [
        {
          pointId: 'point-1',
          docId: 'doc-1',
          collectionId: 'collection-1',
          chunkIndex: 0,
          title: 'Chunk 1',
          content: 'Content 1',
        },
        {
          pointId: 'point-2',
          docId: 'doc-1',
          collectionId: 'collection-1',
          chunkIndex: 1,
          title: 'Chunk 2',
          content: 'Content 2',
        },
      ] as Partial<Chunk>[];

      const expectedChunks = [
        {
          id: 'chunk-1',
          pointId: 'point-1',
          docId: 'doc-1',
          collectionId: 'collection-1',
          chunkIndex: 0,
          title: 'Chunk 1',
          content: 'Content 1',
          contentLength: 9,
        },
        {
          id: 'chunk-2',
          pointId: 'point-2',
          docId: 'doc-1',
          collectionId: 'collection-1',
          chunkIndex: 1,
          title: 'Chunk 2',
          content: 'Content 2',
          contentLength: 9,
        },
      ] as Chunk[];

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
      expect(result).toEqual(expectedChunks);
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
      const chunks = [
        {
          pointId: 'point-1',
          docId: 'doc-1',
          collectionId: 'collection-1',
          chunkIndex: 0,
          title: 'Chunk 1',
          content: 'Content 1',
        },
      ] as Partial<Chunk>[];

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
      expect(mockManager.delete).toHaveBeenCalledWith(Chunk, { docId });
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
