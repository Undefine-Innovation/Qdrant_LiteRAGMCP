/**
 * ChunkRepository 查找方法单元测试
 * 测试块相关的查找操作
 */

import { ChunkRepository } from '@infrastructure/database/repositories/ChunkRepository.js';
import { DataSource } from 'typeorm';
import { Chunk } from '@infrastructure/database/entities/Chunk.js';
import { DocId, CollectionId, PointId } from '@domain/entities/types.js';
import {
  MockFactory,
  DatabaseAssertions,
  UnifiedDataFactory,
  TestEnvironmentManager,
} from '../../utils';

describe('ChunkRepository - 查找方法', () => {
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

  describe('findByDocId', () => {
    it('应该根据文档ID查找块', async () => {
      // Arrange
      const docId = 'doc-1' as DocId;
      const expectedChunks = UnifiedDataFactory.createChunks(2, { docId });

      const mockQueryBuilder = MockFactory.createQueryBuilder({
        getMany: jest.fn().mockResolvedValue(expectedChunks),
      });
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await chunkRepository.findByDocId(docId);

      // Assert
      DatabaseAssertions.assertArraysEqual(result, expectedChunks);
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

      const mockQueryBuilder = MockFactory.createQueryBuilder({
        getMany: jest.fn().mockResolvedValue([]),
      });
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

      const mockQueryBuilder = MockFactory.createQueryBuilder({
        getMany: jest.fn().mockResolvedValue([]),
      });
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

      const mockQueryBuilder = MockFactory.createQueryBuilder({
        getMany: jest.fn().mockResolvedValue([]),
      });
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

      const mockQueryBuilder = MockFactory.createQueryBuilder({
        getMany: jest.fn().mockRejectedValue(error),
      });
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
      const expectedChunks = UnifiedDataFactory.createChunks(1, {
        collectionId,
      });

      const mockQueryBuilder = MockFactory.createQueryBuilder({
        getMany: jest.fn().mockResolvedValue(expectedChunks),
      });
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await chunkRepository.findByCollectionId(collectionId);

      // Assert
      DatabaseAssertions.assertArraysEqual(result, expectedChunks);
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

      const mockQueryBuilder = MockFactory.createQueryBuilder({
        getMany: jest.fn().mockResolvedValue([]),
      });
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

      const mockQueryBuilder = MockFactory.createQueryBuilder({
        getMany: jest.fn().mockRejectedValue(error),
      });
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
      const expectedChunks = UnifiedDataFactory.createChunks(2, { pointIds });

      const mockQueryBuilder = MockFactory.createQueryBuilder({
        getMany: jest.fn().mockResolvedValue(expectedChunks),
      });
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await chunkRepository.findByPointIds(pointIds);

      // Assert
      DatabaseAssertions.assertArraysEqual(result, expectedChunks);
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
      DatabaseAssertions.assertEmptyArray(result);
      expect(mockRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('应该支持包含内容', async () => {
      // Arrange
      const pointIds = ['point-1'] as PointId[];
      const includeContent = true;

      const mockQueryBuilder = MockFactory.createQueryBuilder({
        getMany: jest.fn().mockResolvedValue([]),
      });
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

      const mockQueryBuilder = MockFactory.createQueryBuilder({
        getMany: jest.fn().mockRejectedValue(error),
      });
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
      const expectedChunk = UnifiedDataFactory.createChunk({ pointId });

      const mockQueryBuilder = MockFactory.createQueryBuilder({
        getOne: jest.fn().mockResolvedValue(expectedChunk),
      });
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await chunkRepository.findByPointId(pointId);

      // Assert
      DatabaseAssertions.assertEntitiesEqual(result, expectedChunk);
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

      const mockQueryBuilder = MockFactory.createQueryBuilder({
        getOne: jest.fn().mockResolvedValue(null),
      });
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

      const mockQueryBuilder = MockFactory.createQueryBuilder({
        getOne: jest.fn().mockResolvedValue(null),
      });
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

      const mockQueryBuilder = MockFactory.createQueryBuilder({
        getOne: jest.fn().mockRejectedValue(error),
      });
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
});
