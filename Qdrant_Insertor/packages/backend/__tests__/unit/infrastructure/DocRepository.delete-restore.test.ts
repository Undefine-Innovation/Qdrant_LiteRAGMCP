/**
 * DocRepository 删除和恢复方法单元测试
 * 测试文档相关的删除和恢复操作
 */

import { DocRepository } from '@infrastructure/database/repositories/DocRepository.js';
import { DataSource } from 'typeorm';
import { DocId } from '@domain/entities/types.js';
import { MockFactory } from '../../utils/index.js';

describe.skip('DocRepository - 删除和恢复方法', () => {
  let docRepository: DocRepository;
  let mockDataSource: jest.Mocked<DataSource>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockLogger: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockRepository: any;

  beforeEach(async () => {
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

  describe('softDelete', () => {
    it('应该软删除文档', async () => {
      // Arrange
      const docId = 'doc-1' as DocId;
      const updateResult = { affected: 1 };
      mockRepository.update.mockResolvedValue(updateResult);

      // Act
      const result = await docRepository.softDeleteDoc(docId);

      // Assert
      expect(result).toBe(true);
      expect(mockRepository.update).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('软删除文档成功', {
        id: docId,
      });
    });

    it('当文档不存在时应该返回false', async () => {
      // Arrange
      const docId = 'non-existent' as DocId;
      const updateResult = { affected: 0 };
      mockRepository.update.mockResolvedValue(updateResult);

      // Act
      const result = await docRepository.softDeleteDoc(docId);

      // Assert
      expect(result).toBe(false);
    });

    it('当数据库操作失败时应该抛出错误', async () => {
      // Arrange
      const docId = 'doc-1' as DocId;
      const error = new Error('Database error');
      mockRepository.update.mockRejectedValue(error);

      // Act & Assert
      await expect(docRepository.softDeleteDoc(docId)).rejects.toThrow(
        'Database error',
      );
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

      mockRepository.update.mockResolvedValue({ affected: deletedCount });

      // Act
      const result = await docRepository.batchSoftDelete(docIds);

      // Assert
      expect(result).toBe(deletedCount);
      expect(mockRepository.update).toHaveBeenCalled();
    });

    it('当批量软删除失败时应该抛出错误', async () => {
      // Arrange
      const docIds = ['doc-1', 'doc-2'] as DocId[];
      const error = new Error('Batch delete failed');

      mockRepository.update.mockRejectedValue(error);

      // Act & Assert
      await expect(docRepository.batchSoftDelete(docIds)).rejects.toThrow(
        'Batch delete failed',
      );
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
      expect(mockRepository.update).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('恢复文档成功', {
        id: docId,
      });
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

    it('应该批量恢复文档', async () => {
      // Arrange
      const docIds = ['doc-1', 'doc-2'] as DocId[];
      const restoredCount = 2;

      mockRepository.update.mockResolvedValue({ affected: restoredCount });

      // Act
      const result = await docRepository.batchRestore(docIds);

      // Assert
      expect(result).toBe(restoredCount);
      expect(mockRepository.update).toHaveBeenCalled();
    });

    it('当批量恢复失败时应该抛出错误', async () => {
      // Arrange
      const docIds = ['doc-1', 'doc-2'] as DocId[];
      const error = new Error('Batch restore failed');

      mockRepository.update.mockRejectedValue(error);

      // Act & Assert
      await expect(docRepository.batchRestore(docIds)).rejects.toThrow(
        'Batch restore failed',
      );
    });

    it('应该使用事务管理器删除文档', async () => {
      // Arrange
      const docId = 'doc-1' as DocId;
      const mockManager = {
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      // Act
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await docRepository.deleteWithManager(
        docId,
        mockManager as any,
      );

      // Assert
      expect(result).toEqual({ affected: 1 });
      expect(mockManager.delete).toHaveBeenCalled();
    });
  });
});
