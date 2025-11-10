/**
 * 事务管理集成测试
 * 测试TypeORM事务管理器的功能
 */

import { DataSource } from 'typeorm';
import { Collection } from '@infrastructure/database/entities/Collection.js';
import { Doc } from '@infrastructure/database/entities/Doc.js';
import { Chunk } from '@infrastructure/database/entities/Chunk.js';
import { TypeORMTransactionManager } from '@infrastructure/transactions/TypeORMTransactionManager.js';
import {
  TransactionOperationType,
  TransactionStatus,
} from '@domain/repositories/ITransactionManager.js';
import { QdrantRepo } from '@infrastructure/repositories/QdrantRepository.js';
import {
  initializeTestDatabase,
  getTestDataSource,
  resetTestDatabase,
  TestDataFactory,
  TestAssertions,
} from '../utils/test-data-factory.js';
import { CollectionId, DocId, PointId } from '@domain/entities/types.js';

describe('Transaction Management Integration Tests', () => {
  let dataSource: DataSource;
  let transactionManager: TypeORMTransactionManager;
  let mockQdrantRepo: jest.Mocked<QdrantRepo>;

  beforeAll(async () => {
    dataSource = await initializeTestDatabase();

    // 创建模拟的Qdrant仓库
    mockQdrantRepo = {
      deletePointsByCollection: () => Promise.resolve(),
      deletePointsByDoc: () => Promise.resolve(),
      deletePoints: () => Promise.resolve(),
      ensureCollection: () => Promise.resolve(),
      getAllPointIdsInCollection: () => Promise.resolve([]),
      search: () => Promise.resolve([]),
      upsertCollection: () => Promise.resolve(),
    } as any;

    transactionManager = new TypeORMTransactionManager(
      dataSource,
      mockQdrantRepo,
      getTestLogger(),
    );
  });

  beforeEach(async () => {
    await resetTestDatabase();
    // Reset mock functions (jest.clearAllMocks replacement)
    Object.values(mockQdrantRepo).forEach((fn) => {
      if (typeof fn === 'function' && 'mockReset' in fn) {
        (fn as any).mockReset?.();
      }
    });
  });

  describe('Basic Transaction Operations', () => {
    it('应该能够开始和提交事务', async () => {
      // Arrange
      const context = transactionManager.beginTransaction({
        operation: 'test-transaction',
      });

      // Act
      await transactionManager.commit(context.transactionId);

      // Assert
      const activeTransactions = transactionManager.getActiveTransactions();
      expect(activeTransactions).toHaveLength(0);
    });

    it('应该能够开始和回滚事务', async () => {
      // Arrange
      const context = transactionManager.beginTransaction({
        operation: 'test-rollback',
      });

      // Act
      await transactionManager.rollback(context.transactionId);

      // Assert
      const activeTransactions = transactionManager.getActiveTransactions();
      expect(activeTransactions).toHaveLength(0);
    });

    it('应该能够执行简单事务', async () => {
      // Arrange
      const collectionData = TestDataFactory.createCollection({
        name: 'Transaction Test Collection',
      });

      // Act
      const result = await transactionManager.executeInTransaction(async () => {
        const repository = dataSource.getRepository(Collection);
        return await repository.save(collectionData);
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe('Transaction Test Collection');

      // 验证数据已提交
      const savedCollection = await TestAssertions.assertCollectionExists(
        dataSource,
        result.id as CollectionId,
      );
      expect(savedCollection.name).toBe('Transaction Test Collection');
    });

    it('应该在错误时回滚事务', async () => {
      // Arrange
      const collectionData = TestDataFactory.createCollection({
        name: 'Should Not Exist',
      });

      // Act & Assert
      await expect(
        transactionManager.executeInTransaction(async () => {
          const repository = dataSource.getRepository(Collection);
          await repository.save(collectionData);

          // 故意抛出错误
          throw new Error('Intentional error for rollback test');
        }),
      ).rejects.toThrow('Intentional error for rollback test');

      // 验证数据已回滚
      const repository = dataSource.getRepository(Collection);
      const savedCollection = await repository.findOne({
        where: { name: 'Should Not Exist' },
      });
      expect(savedCollection).toBeNull();
    });
  });

  describe('Nested Transactions', () => {
    it('应该支持嵌套事务', async () => {
      // Arrange
      const parentContext = transactionManager.beginTransaction({
        operation: 'parent-transaction',
      });

      // Act
      const childContext = await transactionManager.beginNestedTransaction(
        parentContext.transactionId,
        {
          operation: 'child-transaction',
        },
      );

      // Assert
      expect(childContext.parentTransactionId).toBe(
        parentContext.transactionId,
      );
      expect(childContext.nestingLevel).toBe(1);
      expect(childContext.status).toBe(TransactionStatus.PENDING);
    });

    it('应该能够提交嵌套事务', async () => {
      // Arrange
      const parentContext = transactionManager.beginTransaction({
        operation: 'parent-transaction',
      });
      const childContext = await transactionManager.beginNestedTransaction(
        parentContext.transactionId,
        {
          operation: 'child-transaction',
        },
      );

      // Act
      await transactionManager.commit(childContext.transactionId);
      await transactionManager.commit(parentContext.transactionId);

      // Assert
      const activeTransactions = transactionManager.getActiveTransactions();
      expect(activeTransactions).toHaveLength(0);
    });

    it('应该能够回滚嵌套事务', async () => {
      // Arrange
      const parentContext = transactionManager.beginTransaction({
        operation: 'parent-transaction',
      });
      const childContext = await transactionManager.beginNestedTransaction(
        parentContext.transactionId,
        {
          operation: 'child-transaction',
        },
      );

      // Act
      await transactionManager.rollback(childContext.transactionId);
      await transactionManager.commit(parentContext.transactionId);

      // Assert
      const activeTransactions = transactionManager.getActiveTransactions();
      expect(activeTransactions).toHaveLength(0);
    });

    it('应该在嵌套事务中执行操作', async () => {
      // Arrange
      const collectionData = TestDataFactory.createCollection({
        name: 'Nested Transaction Collection',
      });

      // Act
      const result = await transactionManager.executeInNestedTransaction(
        'parent-transaction-id',
        async () => {
          const repository = dataSource.getRepository(Collection);
          return await repository.save(collectionData);
        },
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe('Nested Transaction Collection');
    });
  });

  describe('Savepoints', () => {
    it('应该能够创建保存点', async () => {
      // Arrange
      const context = transactionManager.beginTransaction({
        operation: 'savepoint-test',
      });

      // Act
      const savepointId = await transactionManager.createSavepoint(
        context.transactionId,
        'test-savepoint',
      );

      // Assert
      expect(savepointId).toBeDefined();
      expect(typeof savepointId).toBe('string');
    });

    it('应该能够回滚到保存点', async () => {
      // Arrange
      const context = transactionManager.beginTransaction({
        operation: 'savepoint-rollback-test',
      });
      const repository = dataSource.getRepository(Collection);

      // 创建初始数据
      const collection1 = TestDataFactory.createCollection({
        name: 'Collection 1',
      });
      await repository.save(collection1);

      // 创建保存点
      const savepointId = await transactionManager.createSavepoint(
        context.transactionId,
        'test-savepoint',
      );

      // 添加更多数据
      const collection2 = TestDataFactory.createCollection({
        name: 'Collection 2',
      });
      await repository.save(collection2);

      // Act - 回滚到保存点
      await transactionManager.rollbackToSavepoint(
        context.transactionId,
        savepointId,
      );

      // 提交事务
      await transactionManager.commit(context.transactionId);

      // Assert
      const allCollections = await repository.find();
      expect(allCollections).toHaveLength(1);
      expect(allCollections[0].name).toBe('Collection 1');
    });

    it('应该能够释放保存点', async () => {
      // Arrange
      const context = transactionManager.beginTransaction({
        operation: 'savepoint-release-test',
      });

      // 创建保存点
      const savepointId = await transactionManager.createSavepoint(
        context.transactionId,
        'test-savepoint',
      );

      // Act
      await transactionManager.releaseSavepoint(
        context.transactionId,
        savepointId,
      );

      // 提交事务
      await transactionManager.commit(context.transactionId);

      // Assert
      // 如果没有错误，说明保存点释放成功
      expect(true).toBe(true);
    });
  });

  describe('Transaction Operations', () => {
    it('应该能够执行集合创建操作', async () => {
      // Arrange
      const context = transactionManager.beginTransaction({
        operation: 'create-collection',
      });
      const collectionData = {
        name: 'Transaction Collection',
        description: 'Created in transaction',
      };

      // Act
      await transactionManager.executeOperation(context.transactionId, {
        type: TransactionOperationType.CREATE,
        target: 'collection',
        targetId: 'test-collection' as CollectionId,
        data: collectionData,
      });

      await transactionManager.commit(context.transactionId);

      // Assert
      const repository = dataSource.getRepository(Collection);
      const savedCollection = await repository.findOne({
        where: { name: 'Transaction Collection' },
      });
      expect(savedCollection).toBeDefined();
      expect(savedCollection.description).toBe('Created in transaction');
    });

    it('应该能够执行文档创建操作', async () => {
      // Arrange
      const context = transactionManager.beginTransaction({
        operation: 'create-document',
      });
      const docData = {
        collectionId: 'test-collection' as CollectionId,
        key: 'test-doc',
        name: 'Transaction Document',
        mime: 'text/plain',
        size_bytes: 1000,
        content: 'Transaction document content',
      };

      // Act
      await transactionManager.executeOperation(context.transactionId, {
        type: TransactionOperationType.CREATE,
        target: 'document',
        targetId: 'test-doc' as DocId,
        data: docData,
      });

      await transactionManager.commit(context.transactionId);

      // Assert
      const repository = dataSource.getRepository(Doc);
      const savedDoc = await repository.findOne({
        where: { key: 'test-doc' },
      });
      expect(savedDoc).toBeDefined();
      expect(savedDoc.name).toBe('Transaction Document');
    });

    it('应该能够执行块创建操作', async () => {
      // Arrange
      const context = transactionManager.beginTransaction({
        operation: 'create-chunk',
      });
      const chunkData = {
        docId: 'test-doc' as DocId,
        collectionId: 'test-collection' as CollectionId,
        chunkIndex: 0,
        title: 'Transaction Chunk',
        content: 'Transaction chunk content',
      };

      // Act
      await transactionManager.executeOperation(context.transactionId, {
        type: TransactionOperationType.CREATE,
        target: 'chunk',
        targetId: 'test-point' as PointId,
        data: chunkData,
      });

      await transactionManager.commit(context.transactionId);

      // Assert
      const repository = dataSource.getRepository(Chunk);
      const savedChunk = await repository.findOne({
        where: { pointId: 'test-point' },
      });
      expect(savedChunk).toBeDefined();
      expect(savedChunk.title).toBe('Transaction Chunk');
    });

    it('应该能够执行更新操作', async () => {
      // Arrange
      const repository = dataSource.getRepository(Collection);
      const collection = await repository.save(
        TestDataFactory.createCollection({
          name: 'Original Name',
        }),
      );

      const context = transactionManager.beginTransaction({
        operation: 'update-collection',
      });

      // Act
      await transactionManager.executeOperation(context.transactionId, {
        type: TransactionOperationType.UPDATE,
        target: 'collection',
        targetId: collection.id as CollectionId,
        data: { name: 'Updated Name' },
      });

      await transactionManager.commit(context.transactionId);

      // Assert
      const updatedCollection = await repository.findOne({
        where: { id: collection.id },
      });
      expect(updatedCollection.name).toBe('Updated Name');
    });

    it('应该能够执行删除操作', async () => {
      // Arrange
      const repository = dataSource.getRepository(Collection);
      const collection = await repository.save(
        TestDataFactory.createCollection({
          name: 'To Delete',
        }),
      );

      const context = transactionManager.beginTransaction({
        operation: 'delete-collection',
      });

      // Act
      await transactionManager.executeOperation(context.transactionId, {
        type: TransactionOperationType.DELETE,
        target: 'collection',
        targetId: collection.id as CollectionId,
      });

      await transactionManager.commit(context.transactionId);

      // Assert
      const deletedCollection = await repository.findOne({
        where: { id: collection.id },
      });
      expect(deletedCollection).toBeNull();
    });
  });

  describe('Complex Transaction Scenarios', () => {
    it('应该能够处理多实体事务', async () => {
      // Arrange
      const context = transactionManager.beginTransaction({
        operation: 'multi-entity-transaction',
      });

      // Act
      await transactionManager.executeInTransaction(async () => {
        const collectionRepository = dataSource.getRepository(Collection);
        const docRepository = dataSource.getRepository(Doc);
        const chunkRepository = dataSource.getRepository(Chunk);

        // 创建集合
        const collection = await collectionRepository.save(
          TestDataFactory.createCollection({
            name: 'Multi Entity Collection',
          }),
        );

        // 创建文档
        const doc = await docRepository.save(
          TestDataFactory.createDoc({
            collectionId: collection.id as CollectionId,
            name: 'Multi Entity Document',
          }),
        );

        // 创建块
        await chunkRepository.save(
          TestDataFactory.createChunk({
            docId: doc.key as DocId,
            collectionId: collection.id as CollectionId,
            title: 'Multi Entity Chunk',
          }),
        );

        return { collection, doc };
      });

      // Assert
      const collectionRepository = dataSource.getRepository(Collection);
      const docRepository = dataSource.getRepository(Doc);
      const chunkRepository = dataSource.getRepository(Chunk);

      const collections = await collectionRepository.find();
      const docs = await docRepository.find();
      const chunks = await chunkRepository.find();

      expect(collections).toHaveLength(1);
      expect(docs).toHaveLength(1);
      expect(chunks).toHaveLength(1);

      expect(collections[0].name).toBe('Multi Entity Collection');
      expect(docs[0].name).toBe('Multi Entity Document');
      expect(chunks[0].title).toBe('Multi Entity Chunk');
    });

    it('应该能够处理级联删除事务', async () => {
      // Arrange
      const collectionRepository = dataSource.getRepository(Collection);
      const docRepository = dataSource.getRepository(Doc);
      const chunkRepository = dataSource.getRepository(Chunk);

      // 创建测试数据
      const collection = await collectionRepository.save(
        TestDataFactory.createCollection({
          name: 'Cascade Delete Collection',
        }),
      );

      const doc = await docRepository.save(
        TestDataFactory.createDoc({
          collectionId: collection.id as CollectionId,
          name: 'Cascade Delete Document',
        }),
      );

      await chunkRepository.save(
        TestDataFactory.createChunk({
          docId: doc.key as DocId,
          collectionId: collection.id as CollectionId,
          title: 'Cascade Delete Chunk',
        }),
      );

      // Act
      await transactionManager.executeInTransaction(async () => {
        // 删除集合（应该级联删除文档和块）
        await collectionRepository.delete(collection.id);
      });

      // Assert
      const remainingCollections = await collectionRepository.find();
      const remainingDocs = await docRepository.find();
      const remainingChunks = await chunkRepository.find();

      expect(remainingCollections).toHaveLength(0);
      expect(remainingDocs).toHaveLength(0);
      expect(remainingChunks).toHaveLength(0);
    });

    it('应该能够处理事务中的错误恢复', async () => {
      // Arrange
      const collectionRepository = dataSource.getRepository(Collection);
      const docRepository = dataSource.getRepository(Doc);

      // Act & Assert
      await expect(
        transactionManager.executeInTransaction(async () => {
          // 创建第一个集合（应该成功）
          await collectionRepository.save(
            TestDataFactory.createCollection({
              name: 'Success Collection',
            }),
          );

          // 尝试创建重复名称的集合（应该失败）
          await collectionRepository.save(
            TestDataFactory.createCollection({
              name: 'Success Collection', // 重复名称
            }),
          );

          // 这个代码不应该执行
          await docRepository.save(
            TestDataFactory.createDoc({
              collectionId: 'any-collection' as CollectionId,
              name: 'Should Not Exist',
            }),
          );
        }),
      ).rejects.toThrow();

      // 验证只有第一个集合被创建
      const collections = await collectionRepository.find();
      const docs = await docRepository.find();

      expect(collections).toHaveLength(1);
      expect(collections[0].name).toBe('Success Collection');
      expect(docs).toHaveLength(0);
    });
  });

  describe('Transaction Cleanup', () => {
    it('应该能够清理已完成的事务', async () => {
      // Arrange
      const context1 = transactionManager.beginTransaction({
        operation: 'cleanup-test-1',
      });
      const context2 = transactionManager.beginTransaction({
        operation: 'cleanup-test-2',
      });

      // 提交一个事务，保留一个活跃
      await transactionManager.commit(context1.transactionId);

      // Act
      transactionManager.cleanupCompletedTransactions();

      // Assert
      const activeTransactions = transactionManager.getActiveTransactions();
      expect(activeTransactions).toHaveLength(1);
      expect(activeTransactions[0].transactionId).toBe(context2.transactionId);
    });

    it('应该能够清理过期的事务', async () => {
      // Arrange
      const context = transactionManager.beginTransaction({
        operation: 'expiry-test',
      });

      // 手动设置事务为已完成状态并设置过期时间
      (transactionManager as any).activeTransactions.get(
        context.transactionId,
      ).status = TransactionStatus.COMMITTED;
      (transactionManager as any).activeTransactions.get(
        context.transactionId,
      ).completedAt = new Date(Date.now() - 31 * 60 * 1000); // 31分钟前

      // Act
      transactionManager.cleanupCompletedTransactions();

      // Assert
      const activeTransactions = transactionManager.getActiveTransactions();
      expect(activeTransactions).toHaveLength(0);
    });
  });

  describe('Transaction Performance', () => {
    it('应该能够高效处理大量操作', async () => {
      // Arrange
      const operationCount = 100;
      const context = transactionManager.beginTransaction({
        operation: 'performance-test',
      });

      // Act
      const startTime = Date.now();

      await transactionManager.executeInTransaction(async () => {
        const repository = dataSource.getRepository(Collection);

        for (let i = 0; i < operationCount; i++) {
          await repository.save(
            TestDataFactory.createCollection({
              name: `Performance Collection ${i}`,
            }),
          );
        }
      });

      const endTime = Date.now();

      // Assert
      const collectionRepository = dataSource.getRepository(Collection);
      const collections = await collectionRepository.find();

      expect(collections).toHaveLength(operationCount);

      const processingTime = endTime - startTime;
      console.log(
        `Processed ${operationCount} operations in ${processingTime}ms`,
      );

      // 性能断言：处理100个操作应该在合理时间内完成（例如5秒）
      expect(processingTime).toBeLessThan(5000);
    });

    it('应该能够高效处理嵌套事务', async () => {
      // Arrange
      const nestingLevel = 5;
      let contextId: string | undefined;

      // Act
      const startTime = Date.now();

      for (let i = 0; i < nestingLevel; i++) {
        if (i === 0) {
          const context = transactionManager.beginTransaction({
            operation: `nested-level-${i}`,
          });
          contextId = context.transactionId;
        } else {
          contextId = await transactionManager.beginNestedTransaction(
            contextId!,
            {
              operation: `nested-level-${i}`,
            },
          );
        }
      }

      const endTime = Date.now();

      // Assert
      const activeTransactions = transactionManager.getActiveTransactions();
      expect(activeTransactions).toHaveLength(1);
      expect(activeTransactions[0].nestingLevel).toBe(nestingLevel - 1);

      const nestingTime = endTime - startTime;
      console.log(`Created ${nestingLevel} nested levels in ${nestingTime}ms`);

      // 性能断言：创建嵌套事务应该在合理时间内完成（例如1秒）
      expect(nestingTime).toBeLessThan(1000);
    });
  });
});
