/**
 * 嵌套事务管理集成测试
 * 测试TypeORM事务管理器的嵌套事务功能
 */

import { DataSource } from 'typeorm';
import { Collection } from '@infrastructure/database/entities/Collection.js';
import { TypeORMTransactionManager } from '@infrastructure/transactions/TypeORMTransactionManager.js';
import { TransactionStatus } from '@domain/repositories/ITransactionManager.js';
import { QdrantRepo } from '@infrastructure/repositories/QdrantRepository.js';
import {
  initializeTestDatabase,
  resetTestDatabase,
  TestDataFactory,
} from '../test-data-factory.js';
import { CollectionId } from '@domain/entities/types.js';

describe('Nested Transactions', () => {
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

  it('应该支持嵌套事务', async () => {
    // Arrange
    const parentContext = await transactionManager.beginTransaction({
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
    expect(childContext.parentTransactionId).toBe(parentContext.transactionId);
    expect(childContext.nestingLevel).toBe(1);
    expect(childContext.status).toBe(TransactionStatus.PENDING);
  });

  it('应该能够提交嵌套事务', async () => {
    // Arrange
    const parentContext = await transactionManager.beginTransaction({
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
    const parentContext = await transactionManager.beginTransaction({
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
    const parentContext = await transactionManager.beginTransaction({
      operation: 'parent-transaction',
    });
    const collectionData = TestDataFactory.createCollection({
      name: 'Nested Transaction Collection',
    });

    // Act
    const result = await transactionManager.executeInNestedTransaction(
      parentContext.transactionId,
      async () => {
        const repository = dataSource.getRepository(Collection);
        return await repository.save(collectionData);
      },
    );

    // 提交嵌套事务和父事务
    await transactionManager.commit(parentContext.transactionId);

    // Assert
    expect(result).toBeDefined();
    expect(result.name).toBe('Nested Transaction Collection');
  });
});
