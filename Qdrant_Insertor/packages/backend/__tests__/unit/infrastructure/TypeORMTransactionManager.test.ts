import { TypeORMTransactionManager } from '@infrastructure/transactions/TypeORMTransactionManager.js';
import {
  TransactionOperationType,
  TransactionStatus,
} from '@domain/repositories/ITransactionManager.js';
import { CollectionId, DocId, PointId } from '@domain/entities/types.js';
import { DataSource, QueryRunner } from 'typeorm';
import { QdrantRepo } from '@infrastructure/repositories/QdrantRepository.js';
import { Logger } from '@logging/logger.js';
import { TransactionError } from '@infrastructure/transactions/TransactionErrorHandler.js';

// Mock dependencies
jest.mock('typeorm');
jest.mock('@infrastructure/repositories/QdrantRepository.js');
jest.mock('@logging/logger.js');

describe('TypeORMTransactionManager', () => {
  let transactionManager: TypeORMTransactionManager;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockQueryRunner: jest.Mocked<QueryRunner>;
  let mockQdrantRepo: jest.Mocked<QdrantRepo>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    // 创建mock对象
    mockQueryRunner = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      createSavepoint: jest.fn(),
      rollbackToSavepoint: jest.fn(),
      releaseSavepoint: jest.fn(),
      release: jest.fn(),
      manager: {
        findOne: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        transaction: jest.fn(),
      },
    } as unknown as jest.Mocked<QueryRunner>;

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    } as unknown as jest.Mocked<DataSource>;

    mockQdrantRepo = {
      deletePointsByCollection: jest.fn(),
      deletePointsByDoc: jest.fn(),
      deletePoints: jest.fn(),
      ensureCollection: jest.fn(),
      getAllPointIdsInCollection: jest.fn(),
      search: jest.fn(),
      upsertCollection: jest.fn(),
    } as unknown as jest.Mocked<QdrantRepo>;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    transactionManager = new TypeORMTransactionManager(
      mockDataSource,
      mockQdrantRepo,
      mockLogger,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('beginTransaction', () => {
    it('应该创建一个新事务并启动QueryRunner', async () => {
      const metadata = { operation: 'test' };
      const context = await transactionManager.beginTransaction(metadata);

      expect(context.transactionId).toBeDefined();
      expect(context.status).toBe(TransactionStatus.PENDING);
      expect(context.operations).toEqual([]);
      expect(context.metadata).toEqual(metadata);
      expect(context.startTime).toBeGreaterThan(0);
      expect(mockDataSource.createQueryRunner).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'TypeORM transaction started',
        expect.any(Object),
      );
    });

    it('应该在没有元数据时创建事务', async () => {
      const context = await transactionManager.beginTransaction();

      expect(context.transactionId).toBeDefined();
      expect(context.status).toBe(TransactionStatus.PENDING);
      expect(context.operations).toEqual([]);
      expect(context.metadata).toBeUndefined();
    });
  });

  describe('beginNestedTransaction', () => {
    it('应该创建嵌套事务并创建保存点', async () => {
      const parentContext = await transactionManager.beginTransaction();
      const metadata = { operation: 'nested-test' };

      const nestedContext = await transactionManager.beginNestedTransaction(
        parentContext.transactionId,
        metadata,
      );

      expect(nestedContext.transactionId).toBeDefined();
      expect(nestedContext.status).toBe(TransactionStatus.PENDING);
      expect(nestedContext.parentTransactionId).toBe(
        parentContext.transactionId,
      );
      expect(nestedContext.nestingLevel).toBe(1);
      expect(
        (mockQueryRunner as unknown as Record<string, jest.Mock>)
          .createSavepoint,
      ).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'TypeORM nested transaction started with savepoint',
        expect.any(Object),
      );
    });

    it('应该为不存在的父事务抛出错误', async () => {
      await expect(
        transactionManager.beginNestedTransaction('non-existent-id'),
      ).rejects.toThrow(TransactionError);
    });
  });

  describe('commit', () => {
    it('应该成功提交根事务', async () => {
      const context = await transactionManager.beginTransaction();
      // 将事务状态设为ACTIVE
      await transactionManager.executeOperation(context.transactionId, {
        type: TransactionOperationType.CREATE,
        target: 'collection',
        targetId: 'test-collection' as CollectionId,
        data: {
          name: 'Test Collection',
          description: 'Test Description',
        },
      });

      await transactionManager.commit(context.transactionId);

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'TypeORM transaction committed to database',
        expect.any(Object),
      );
    });

    it('应该成功提交嵌套事务', async () => {
      const parentContext = await transactionManager.beginTransaction();
      const nestedContext = await transactionManager.beginNestedTransaction(
        parentContext.transactionId,
      );

      await transactionManager.commit(nestedContext.transactionId);

      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.release).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Nested transaction committed and merged to parent',
        expect.any(Object),
      );
    });

    it('应该为不存在的事务抛出错误', async () => {
      await expect(
        transactionManager.commit('non-existent-id'),
      ).rejects.toThrow(TransactionError);
    });

    it('应该为非活跃事务抛出错误', async () => {
      const context = await transactionManager.beginTransaction();
      // 将事务状态设为FAILED（非活跃状态）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const activeTransactions = (transactionManager as any).activeTransactions;
      activeTransactions.get(context.transactionId).status =
        TransactionStatus.FAILED;
      await expect(
        transactionManager.commit(context.transactionId),
      ).rejects.toThrow(TransactionError);
    });
  });

  describe('rollback', () => {
    it('应该成功回滚根事务', async () => {
      const context = await transactionManager.beginTransaction();
      await transactionManager.executeOperation(context.transactionId, {
        type: TransactionOperationType.CREATE,
        target: 'collection',
        targetId: 'test-collection' as CollectionId,
        data: {
          name: 'Test Collection',
          description: 'Test Description',
        },
      });

      await transactionManager.rollback(context.transactionId);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'TypeORM transaction rolled back from database',
        expect.any(Object),
      );
    });

    it('应该成功回滚嵌套事务到保存点', async () => {
      const parentContext = await transactionManager.beginTransaction();
      const nestedContext = await transactionManager.beginNestedTransaction(
        parentContext.transactionId,
      );

      await transactionManager.rollback(nestedContext.transactionId);

      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(
        (mockQueryRunner as unknown as Record<string, jest.Mock>)
          .rollbackToSavepoint,
      ).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Nested transaction rolled back to savepoint',
        expect.any(Object),
      );
    });

    it('应该为不存在的事务抛出错误', async () => {
      await expect(
        transactionManager.rollback('non-existent-id'),
      ).rejects.toThrow(TransactionError);
    });
  });

  describe('executeInTransaction', () => {
    it('应该成功执行事务并提交', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      const result = await transactionManager.executeInTransaction(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('应该在函数抛出错误时回滚事务', async () => {
      const error = new Error('Test error');
      const mockFn = jest.fn().mockRejectedValue(error);

      await expect(
        transactionManager.executeInTransaction(mockFn),
      ).rejects.toThrow('Test error');
      expect(mockFn).toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe('executeInNestedTransaction', () => {
    it('应该成功执行嵌套事务', async () => {
      const parentContext = await transactionManager.beginTransaction();
      const mockFn = jest.fn().mockResolvedValue('success');

      const result = await transactionManager.executeInNestedTransaction(
        parentContext.transactionId,
        mockFn,
      );

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalled();
      expect(
        (mockQueryRunner as unknown as Record<string, jest.Mock>)
          .createSavepoint,
      ).toHaveBeenCalled();
    });

    it('应该在嵌套事务失败时回滚', async () => {
      const parentContext = await transactionManager.beginTransaction();
      const error = new Error('Nested test error');
      const mockFn = jest.fn().mockRejectedValue(error);

      await expect(
        transactionManager.executeInNestedTransaction(
          parentContext.transactionId,
          mockFn,
        ),
      ).rejects.toThrow('Nested test error');
      expect(
        (mockQueryRunner as unknown as Record<string, jest.Mock>)
          .rollbackToSavepoint,
      ).toHaveBeenCalled();
    });
  });

  describe('savepoints', () => {
    it('应该创建保存点', async () => {
      const context = await transactionManager.beginTransaction();
      const savepointName = 'test-savepoint';

      const savepointId = await transactionManager.createSavepoint(
        context.transactionId,
        savepointName,
      );

      expect(savepointId).toBeDefined();
      expect(
        (mockQueryRunner as unknown as Record<string, jest.Mock>)
          .createSavepoint,
      ).toHaveBeenCalledWith(savepointId);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Savepoint created',
        expect.any(Object),
      );
    });

    it('应该回滚到保存点', async () => {
      const context = await transactionManager.beginTransaction();
      const savepointId = await transactionManager.createSavepoint(
        context.transactionId,
        'test-savepoint',
      );

      await transactionManager.rollbackToSavepoint(
        context.transactionId,
        savepointId,
      );

      expect(
        (mockQueryRunner as unknown as Record<string, jest.Mock>)
          .rollbackToSavepoint,
      ).toHaveBeenCalledWith(savepointId);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Transaction rolled back to savepoint',
        expect.any(Object),
      );
    });

    it('应该释放保存点', async () => {
      const context = await transactionManager.beginTransaction();
      const savepointId = await transactionManager.createSavepoint(
        context.transactionId,
        'test-savepoint',
      );

      await transactionManager.releaseSavepoint(
        context.transactionId,
        savepointId,
      );

      expect(
        (mockQueryRunner as unknown as Record<string, jest.Mock>)
          .releaseSavepoint,
      ).toHaveBeenCalledWith(savepointId);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Savepoint released',
        expect.any(Object),
      );
    });
  });

  describe('executeOperation', () => {
    it('应该执行集合创建操作', async () => {
      const context = await transactionManager.beginTransaction();
      const collectionId = 'test-collection' as CollectionId;
      const collectionData = {
        name: 'Test Collection',
        description: 'Test Description',
      };

      (mockQueryRunner.manager.findOne as jest.Mock).mockResolvedValue(null);
      (mockQueryRunner.manager.save as jest.Mock).mockResolvedValue({
        collectionId,
        ...collectionData,
      });

      await transactionManager.executeOperation(context.transactionId, {
        type: TransactionOperationType.CREATE,
        target: 'collection',
        targetId: collectionId,
        data: collectionData,
      });

      expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(
        'Collection',
        expect.objectContaining({
          collectionId,
          name: collectionData.name,
          description: collectionData.description,
        }),
      );
    });

    it('应该执行文档创建操作', async () => {
      const context = await transactionManager.beginTransaction();
      const docId = 'test-doc' as DocId;
      const docData = {
        collectionId: 'test-collection' as CollectionId,
        key: 'test-key',
        name: 'Test Document',
        mime: 'text/plain',
        size_bytes: 100,
        content: 'Test content',
      };

      (mockQueryRunner.manager.findOne as jest.Mock).mockResolvedValue(null);
      (mockQueryRunner.manager.save as jest.Mock).mockResolvedValue({
        ...docData,
      });

      await transactionManager.executeOperation(context.transactionId, {
        type: TransactionOperationType.CREATE,
        target: 'document',
        targetId: docId,
        data: docData,
      });

      expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(
        'Doc',
        expect.objectContaining({
          key: docData.key,
          collectionId: docData.collectionId,
          name: docData.name,
          mime: docData.mime,
          size_bytes: docData.size_bytes,
          content: docData.content,
        }),
      );
    });

    it('应该执行块创建操作', async () => {
      const context = await transactionManager.beginTransaction();
      const pointId = 'test-point' as PointId;
      const chunkData = {
        docId: 'test-doc' as DocId,
        collectionId: 'test-collection' as CollectionId,
        chunkIndex: 0,
        title: 'Test Chunk',
        content: 'Test chunk content',
      };

      (mockQueryRunner.manager.findOne as jest.Mock).mockResolvedValue(null);
      (mockQueryRunner.manager.save as jest.Mock).mockResolvedValue({
        pointId,
        ...chunkData,
      });

      await transactionManager.executeOperation(context.transactionId, {
        type: TransactionOperationType.CREATE,
        target: 'chunk',
        targetId: pointId,
        data: chunkData,
      });

      expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(
        'Chunk',
        expect.objectContaining({
          pointId,
          docId: chunkData.docId,
          collectionId: chunkData.collectionId,
          chunkIndex: chunkData.chunkIndex,
          title: chunkData.title,
          content: chunkData.content,
        }),
      );
    });
  });

  describe('getQueryRunner', () => {
    it('应该返回正确的事务QueryRunner', async () => {
      const context = await transactionManager.beginTransaction();
      const queryRunner = transactionManager.getQueryRunner(
        context.transactionId,
      );

      expect(queryRunner).toBe(mockQueryRunner);
    });

    it('应该为不存在的事务返回undefined', () => {
      const queryRunner = transactionManager.getQueryRunner('non-existent-id');
      expect(queryRunner).toBeUndefined();
    });
  });

  describe('cleanupCompletedTransactions', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('应该清理过期的已完成事务', async () => {
      const context1 = await transactionManager.beginTransaction();
      const context2 = await transactionManager.beginTransaction();

      // 手动设置事务状态
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transactionsMap = (transactionManager as any).activeTransactions;
      transactionsMap.get(context1.transactionId).status =
        TransactionStatus.COMMITTED;
      transactionsMap.get(context2.transactionId).status =
        TransactionStatus.ACTIVE;

      // 模拟时间过去31分钟
      jest.advanceTimersByTime(31 * 60 * 1000);

      await transactionManager.cleanupCompletedTransactions();

      const activeTransactions = transactionManager.getActiveTransactions();
      expect(activeTransactions).toHaveLength(1);
      expect(activeTransactions[0].transactionId).toBe(context2.transactionId);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cleaned up completed transactions',
        { count: 1 },
      );
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
          listByCollection: jest
            .fn()
            .mockReturnValue([
              { docId: 'doc1' as DocId },
              { docId: 'doc2' as DocId },
            ]),
          hardDelete: jest.fn(),
        },
        listAll: jest.fn(),
      };

      (mockQueryRunner.manager.transaction as jest.Mock).mockImplementation(
        (fn) => fn(),
      );
      mockQdrantRepo.deletePointsByCollection.mockResolvedValue(undefined);

      await transactionManager.deleteCollectionInTransaction(
        collectionId,
        mockCollections as unknown as Parameters<
          typeof transactionManager.deleteCollectionInTransaction
        >[1],
      );

      expect(mockCollections.getById).toHaveBeenCalledWith(collectionId);
      expect(mockQueryRunner.manager.transaction).toHaveBeenCalled();
      expect(mockQdrantRepo.deletePointsByCollection).toHaveBeenCalledWith(
        collectionId,
      );
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

      await transactionManager.deleteCollectionInTransaction(
        collectionId,
        mockCollections as unknown as Parameters<
          typeof transactionManager.deleteCollectionInTransaction
        >[1],
      );

      expect(mockCollections.getById).toHaveBeenCalledWith(collectionId);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'deleteCollection: no such collectionId',
        collectionId,
      );
      expect(mockCollections.delete).not.toHaveBeenCalled();
    });
  });
});
