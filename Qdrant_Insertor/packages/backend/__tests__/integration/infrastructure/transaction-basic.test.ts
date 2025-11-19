/**
 * 基础事务管理集成测试
 * 测试TypeORM事务管理器的基本功能
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
} from '../test-data-factory.js';
import { CollectionId, DocId, PointId } from '@domain/entities/types.js';

describe('Basic Transaction Operations', () => {
  let dataSource: DataSource;
  let transactionManager: TypeORMTransactionManager;
  let mockQdrantRepo: jest.Mocked<QdrantRepo>;

  const cleanupActiveTransactions = async () => {
    if (!transactionManager) {
      return;
    }

    const activeContexts = transactionManager
      .getActiveTransactions()
      .sort((a, b) => b.nestingLevel - a.nestingLevel);

    for (const context of activeContexts) {
      try {
        if (
          context.status === TransactionStatus.ACTIVE ||
          context.status === TransactionStatus.PENDING
        ) {
          await transactionManager.rollback(context.transactionId);
        }
      } catch (error) {
        const queryRunner = transactionManager.getQueryRunner(
          context.transactionId,
        );
        await queryRunner?.release().catch(() => undefined);
      }
    }
  };

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

    const testLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };

    transactionManager = new TypeORMTransactionManager(
      dataSource,
      mockQdrantRepo,
      testLogger,
    );
  });

  beforeEach(async () => {
    await cleanupActiveTransactions();
    await resetTestDatabase();
    // Reset mock functions (jest.clearAllMocks replacement)
    Object.values(mockQdrantRepo).forEach((fn) => {
      if (typeof fn === 'function' && 'mockReset' in fn) {
        (fn as jest.Mock).mockReset?.();
      }
    });
  });

  afterEach(async () => {
    await cleanupActiveTransactions();
  });

  it('应该能够开始和提交事务', async () => {
    // Arrange
    const context = await transactionManager.beginTransaction({
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
    const context = await transactionManager.beginTransaction({
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
    expect(savedCollection?.name).toBe('Transaction Test Collection');
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
