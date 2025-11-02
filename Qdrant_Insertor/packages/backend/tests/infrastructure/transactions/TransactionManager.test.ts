import { TransactionManager } from '@infrastructure/transactions/TransactionManager.js';
import { 
  ITransactionManager,
  TransactionOperationType,
  TransactionStatus,
} from '@domain/repositories/ITransactionManager.js';
import { CollectionId, DocId, PointId } from '@domain/entities/types.js';
import { SQLiteRepoCore } from '@infrastructure/repositories/SQLiteRepositoryCore.js';
import { QdrantRepo } from '@infrastructure/repositories/QdrantRepository.js';
import { Logger } from '@logging/logger.js';

// Mock dependencies
jest.mock('@infrastructure/repositories/SQLiteRepositoryCore.js');
jest.mock('@infrastructure/repositories/QdrantRepository.js');
jest.mock('@logging/logger.js');

describe('TransactionManager', () => {
  let transactionManager: ITransactionManager;
  let mockSqliteCore: jest.Mocked<SQLiteRepoCore>;
  let mockQdrantRepo: jest.Mocked<QdrantRepo>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    // 创建mock对象
    mockSqliteCore = {
      transaction: jest.fn(),
    } as any;

    mockQdrantRepo = {
      deletePointsByCollection: jest.fn(),
      deletePointsByDoc: jest.fn(),
      deletePoints: jest.fn(),
      ensureCollection: jest.fn(),
      getAllPointIdsInCollection: jest.fn(),
      search: jest.fn(),
      upsertCollection: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    transactionManager = new TransactionManager(
      mockSqliteCore,
      mockQdrantRepo,
      mockLogger,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('beginTransaction', () => {
    it('应该创建一个新事务并返回事务上下文', () => {
      const metadata = { operation: 'test' };
      const context = transactionManager.beginTransaction(metadata);

      expect(context.transactionId).toBeDefined();
      expect(context.status).toBe(TransactionStatus.PENDING);
      expect(context.operations).toEqual([]);
      expect(context.metadata).toEqual(metadata);
      expect(context.startTime).toBeGreaterThan(0);
      expect(mockLogger.info).toHaveBeenCalledWith('Transaction started', {
        transactionId: context.transactionId,
        metadata,
      });
    });

    it('应该在没有元数据时创建事务', () => {
      const context = transactionManager.beginTransaction();

      expect(context.transactionId).toBeDefined();
      expect(context.status).toBe(TransactionStatus.PENDING);
      expect(context.operations).toEqual([]);
      expect(context.metadata).toBeUndefined();
    });
  });

  describe('getTransactionStatus', () => {
    it('应该返回活跃事务的状态', () => {
      const context = transactionManager.beginTransaction();
      const status = transactionManager.getTransactionStatus(context.transactionId);

      expect(status).toEqual(context);
    });

    it('应该为不存在的事务返回undefined', () => {
      const status = transactionManager.getTransactionStatus('non-existent-id');
      expect(status).toBeUndefined();
    });
  });

  describe('getActiveTransactions', () => {
    it('应该返回所有活跃事务', () => {
      const context1 = transactionManager.beginTransaction();
      const context2 = transactionManager.beginTransaction();

      const activeTransactions = transactionManager.getActiveTransactions();

      expect(activeTransactions).toHaveLength(2);
      expect(activeTransactions).toContainEqual(context1);
      expect(activeTransactions).toContainEqual(context2);
    });

    it('应该在没有活跃事务时返回空数组', () => {
      const activeTransactions = transactionManager.getActiveTransactions();
      expect(activeTransactions).toEqual([]);
    });
  });

  describe('executeInTransaction', () => {
    it('应该成功执行事务并提交', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      mockSqliteCore.transaction.mockImplementation((fn) => fn());

      const result = await transactionManager.executeInTransaction(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalled();
      expect(mockSqliteCore.transaction).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Transaction committed successfully', expect.any(Object));
    });

    it('应该在函数抛出错误时回滚事务', async () => {
      const error = new Error('Test error');
      const mockFn = jest.fn().mockRejectedValue(error);
      mockSqliteCore.transaction.mockImplementation((fn) => fn());

      await expect(transactionManager.executeInTransaction(mockFn)).rejects.toThrow('Test error');
      expect(mockFn).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to rollback transaction', expect.any(Object));
    });
  });

  describe('commit', () => {
    it('应该成功提交活跃事务', async () => {
      const context = transactionManager.beginTransaction();
      // 将事务状态设为ACTIVE
      await transactionManager.executeOperation(context.transactionId, {
        type: TransactionOperationType.CREATE,
        target: 'collection',
        targetId: 'test-collection' as CollectionId,
      });

      mockSqliteCore.transaction.mockImplementation((fn) => fn());

      await transactionManager.commit(context.transactionId);

      expect(mockSqliteCore.transaction).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Committing SQLite transaction', expect.any(Object));
      expect(mockLogger.info).toHaveBeenCalledWith('Transaction committed successfully', {
        transactionId: context.transactionId,
      });
    });

    it('应该为不存在的事务抛出错误', async () => {
      await expect(transactionManager.commit('non-existent-id')).rejects.toThrow(
        'Transaction non-existent-id not found',
      );
    });

    it('应该为非活跃事务抛出错误', async () => {
      const context = transactionManager.beginTransaction();
      await expect(transactionManager.commit(context.transactionId)).rejects.toThrow(
        `Transaction ${context.transactionId} is not active`,
      );
    });
  });

  describe('rollback', () => {
    it('应该成功回滚活跃事务', async () => {
      const context = transactionManager.beginTransaction();
      await transactionManager.executeOperation(context.transactionId, {
        type: TransactionOperationType.CREATE,
        target: 'collection',
        targetId: 'test-collection' as CollectionId,
      });

      await transactionManager.rollback(context.transactionId);

      expect(mockLogger.info).toHaveBeenCalledWith('Transaction rolled back successfully', {
        transactionId: context.transactionId,
      });
    });

    it('应该为不存在的事务抛出错误', async () => {
      await expect(transactionManager.rollback('non-existent-id')).rejects.toThrow(
        'Transaction non-existent-id not found',
      );
    });
  });

  describe('executeOperation', () => {
    it('应该在PENDING状态下执行操作并将事务设为ACTIVE', async () => {
      const context = transactionManager.beginTransaction();
      const operation = {
        type: TransactionOperationType.CREATE,
        target: 'collection' as const,
        targetId: 'test-collection' as CollectionId,
      };

      await transactionManager.executeOperation(context.transactionId, operation);

      const updatedContext = transactionManager.getTransactionStatus(context.transactionId);
      expect(updatedContext?.status).toBe(TransactionStatus.ACTIVE);
      expect(updatedContext?.operations).toHaveLength(1);
      expect(updatedContext?.operations[0]).toEqual(expect.objectContaining(operation));
    });

    it('应该在ACTIVE状态下执行操作', async () => {
      const context = transactionManager.beginTransaction();
      const operation1 = {
        type: TransactionOperationType.CREATE,
        target: 'collection' as const,
        targetId: 'test-collection' as CollectionId,
      };
      const operation2 = {
        type: TransactionOperationType.DELETE,
        target: 'document' as const,
        targetId: 'test-doc' as DocId,
      };

      await transactionManager.executeOperation(context.transactionId, operation1);
      await transactionManager.executeOperation(context.transactionId, operation2);

      const updatedContext = transactionManager.getTransactionStatus(context.transactionId);
      expect(updatedContext?.operations).toHaveLength(2);
      expect(updatedContext?.operations[1]).toEqual(expect.objectContaining(operation2));
    });

    it('应该为不存在的事务抛出错误', async () => {
      const operation = {
        type: TransactionOperationType.CREATE,
        target: 'collection' as const,
        targetId: 'test-collection' as CollectionId,
      };

      await expect(
        transactionManager.executeOperation('non-existent-id', operation),
      ).rejects.toThrow('Transaction non-existent-id not found');
    });

    it('应该为已完成的事务抛出错误', async () => {
      const context = transactionManager.beginTransaction();
      // 手动设置事务状态为COMMITTED
      (transactionManager as any).activeTransactions.get(context.transactionId).status = TransactionStatus.COMMITTED;

      const operation = {
        type: TransactionOperationType.CREATE,
        target: 'collection' as const,
        targetId: 'test-collection' as CollectionId,
      };

      await expect(
        transactionManager.executeOperation(context.transactionId, operation),
      ).rejects.toThrow(`Transaction ${context.transactionId} is not in a valid state for operations`);
    });
  });

  describe('cleanupCompletedTransactions', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('应该清理过期的已完成事务', () => {
      const context1 = transactionManager.beginTransaction();
      const context2 = transactionManager.beginTransaction();
      
      // 手动设置事务状态
      (transactionManager as any).activeTransactions.get(context1.transactionId).status = TransactionStatus.COMMITTED;
      (transactionManager as any).activeTransactions.get(context2.transactionId).status = TransactionStatus.ACTIVE;

      // 模拟时间过去31分钟
      jest.advanceTimersByTime(31 * 60 * 1000);

      transactionManager.cleanupCompletedTransactions();

      const activeTransactions = transactionManager.getActiveTransactions();
      expect(activeTransactions).toHaveLength(1);
      expect(activeTransactions[0].transactionId).toBe(context2.transactionId);
      expect(mockLogger.info).toHaveBeenCalledWith('Cleaned up completed transactions', { count: 1 });
    });

    it('应该使用自定义的最大保留时间', () => {
      const context = transactionManager.beginTransaction();
      (transactionManager as any).activeTransactions.get(context.transactionId).status = TransactionStatus.COMMITTED;

      // 模拟时间过去5分钟
      jest.advanceTimersByTime(5 * 60 * 1000);

      transactionManager.cleanupCompletedTransactions(4 * 60 * 1000); // 4分钟

      const activeTransactions = transactionManager.getActiveTransactions();
      expect(activeTransactions).toHaveLength(0);
    });
  });

  describe('deleteCollectionInTransaction', () => {
    it('应该在事务中删除集合', async () => {
      const collectionId = 'test-collection' as CollectionId;
      const mockCollections = {
        getById: jest.fn().mockReturnValue({ collectionId }),
        delete: jest.fn(),
        chunkMeta: { deleteByCollectionId: jest.fn() },
        chunksFts5: { deleteByCollectionId: jest.fn() },
        docs: { 
          listByCollection: jest.fn().mockReturnValue([
            { docId: 'doc1' as DocId },
            { docId: 'doc2' as DocId },
          ]),
          hardDelete: jest.fn(),
        },
        listAll: jest.fn(),
      };

      mockSqliteCore.transaction.mockImplementation((fn) => fn());
      mockQdrantRepo.deletePointsByCollection.mockResolvedValue(undefined);

      await (transactionManager as TransactionManager).deleteCollectionInTransaction(
        collectionId,
        mockCollections as any,
      );

      expect(mockCollections.getById).toHaveBeenCalledWith(collectionId);
      expect(mockCollections.chunkMeta.deleteByCollectionId).toHaveBeenCalledWith(collectionId);
      expect(mockCollections.chunksFts5.deleteByCollectionId).toHaveBeenCalledWith(collectionId);
      expect(mockCollections.docs.listByCollection).toHaveBeenCalledWith(collectionId);
      expect(mockCollections.docs.hardDelete).toHaveBeenCalledTimes(2);
      expect(mockCollections.delete).toHaveBeenCalledWith(collectionId);
      expect(mockQdrantRepo.deletePointsByCollection).toHaveBeenCalledWith(collectionId);
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Collection ${collectionId} and its associated data have been deleted.`,
      );
    });

    it('应该在不存在的集合时记录警告', async () => {
      const collectionId = 'non-existent-collection' as CollectionId;
      const mockCollections = {
        getById: jest.fn().mockReturnValue(undefined),
        delete: jest.fn(),
        chunkMeta: { deleteByCollectionId: jest.fn() },
        chunksFts5: { deleteByCollectionId: jest.fn() },
        docs: { listByCollection: jest.fn() },
        listAll: jest.fn(),
      };

      await (transactionManager as TransactionManager).deleteCollectionInTransaction(
        collectionId,
        mockCollections as any,
      );

      expect(mockCollections.getById).toHaveBeenCalledWith(collectionId);
      expect(mockLogger.warn).toHaveBeenCalledWith('deleteCollection: no such collectionId', collectionId);
      expect(mockCollections.delete).not.toHaveBeenCalled();
    });
  });
});