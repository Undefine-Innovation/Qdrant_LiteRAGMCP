/**
 * DocRepository 分页和更新方法单元测试
 * 测试文档相关的分页和更新操作
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

describe('DocRepository - 分页和更新方法', () => {
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

  describe('findWithPagination', () => {
    it('Ӧ�÷��ط�ҳ���ĵ�', async () => {
      // Arrange
      const collectionId = 'collection-1' as CollectionId;
      const status = 'completed' as const;
      const expectedDocs = UnifiedDataFactory.createDocs(1, {
        collectionId,
        status,
      });
      const mockQueryBuilder = MockFactory.createQueryBuilder();
      mockQueryBuilder.getCount.mockResolvedValue(1);
      mockQueryBuilder.getMany.mockResolvedValue(expectedDocs);
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      // Act
      const result = await docRepository.findWithPagination(1, 10, {
        collectionId,
        status,
      });
      // Assert
      DatabaseAssertions.assertArraysEqual(result.data, expectedDocs);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });
    it('�����ݿ��ѯʧ��ʱӦ���׳�����', async () => {
      // Arrange
      const error = new Error('Database error');
      const mockQueryBuilder = MockFactory.createQueryBuilder();
      mockQueryBuilder.getCount.mockRejectedValue(error);
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      // Act & Assert
      await expect(docRepository.findWithPagination(1, 10)).rejects.toThrow(
        'Database error',
      );
      expect(mockLogger.error).toHaveBeenCalledWith('分页查找文档失败', {
        paginationOptions: { page: 1, pageSize: 10 },
        collectionId: undefined,
        status: undefined,
        error: 'Database error',
      });
    });
    it('应该更新文档基本信息', async () => {
      // Arrange
      const docId = 'doc-1' as DocId;
      const updateData = {
        name: 'Updated Document',
        mime: 'text/plain',
        size_bytes: 2048,
      };
      const updatedDoc = UnifiedDataFactory.createDoc({
        id: docId,
        docId,
        ...updateData,
      });

      const statusManager = (docRepository as any).statusManager;
      jest.spyOn(statusManager, 'update').mockResolvedValue({ affected: 1 });
      jest.spyOn(statusManager, 'findById').mockResolvedValue(updatedDoc);

      // Act
      const result = await docRepository.updateDocInfo(docId, updateData);

      // Assert
      DatabaseAssertions.assertEntitiesEqual(result, updatedDoc);
      expect(statusManager.update).toHaveBeenCalledWith(
        docId,
        expect.objectContaining({
          ...updateData,
          updated_at: expect.any(Number),
        }),
      );
      expect(statusManager.findById).toHaveBeenCalledWith(docId);
    });

    it('当更新失败时应该抛出错误', async () => {
      // Arrange
      const docId = 'doc-1' as DocId;
      const updateData = { name: 'Updated Document' };
      const error = new Error('Update failed');

      const statusManager = (docRepository as any).statusManager;
      jest.spyOn(statusManager, 'update').mockRejectedValue(error);

      // Act & Assert
      await expect(
        docRepository.updateDocInfo(docId, updateData),
      ).rejects.toThrow('Update failed');
    });
  });

  describe('batchUpdateStatus', () => {
    it('应该批量更新文档状态', async () => {
      // Arrange
      const docIds = ['doc-1', 'doc-2'] as DocId[];
      const status = 'completed' as const;
      const expectedResult = { success: 2, failed: 0, errors: [] };

      const statusManager = (docRepository as any).statusManager;
      const updateBatchSpy = jest
        .spyOn(statusManager, 'updateBatch')
        .mockResolvedValue(expectedResult);

      // Act
      const result = await docRepository.batchUpdateStatus(docIds, status);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(updateBatchSpy).toHaveBeenCalledWith(
        docIds,
        expect.objectContaining({
          status,
          updated_at: expect.any(Number),
        }),
      );
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

      const statusManager = (docRepository as any).statusManager;
      jest.spyOn(statusManager, 'updateBatch').mockRejectedValue(error);

      // Act & Assert
      await expect(
        docRepository.batchUpdateStatus(docIds, status),
      ).rejects.toThrow('Batch update failed');
      expect(mockLogger.error).toHaveBeenCalledWith('批量更新文档状态失败', {
        ids: docIds,
        status,
        error: 'Batch update failed',
      });
    });
  });
});
