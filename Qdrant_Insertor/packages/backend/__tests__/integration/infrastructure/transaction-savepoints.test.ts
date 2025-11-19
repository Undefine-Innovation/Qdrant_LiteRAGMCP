/**
 * 事务保存点集成测试
 * 测试TypeORM事务管理器的保存点功能
 */

import { DataSource } from 'typeorm';
import { Collection } from '@infrastructure/database/entities/Collection.js';
import { TypeORMTransactionManager } from '@infrastructure/transactions/TypeORMTransactionManager.js';
import {
  TransactionOperationType,
  TransactionStatus,
} from '@domain/repositories/ITransactionManager.js';
import { QdrantRepo } from '@infrastructure/repositories/QdrantRepository.js';
import {
  initializeTestDatabase,
  resetTestDatabase,
  TestDataFactory,
} from '../test-data-factory.js';
import { CollectionId } from '@domain/entities/types.js';

describe('Savepoints', () => {
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

  it('应该能够创建保存点', async () => {
    // Arrange
    const context = await transactionManager.beginTransaction({
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
    const context = await transactionManager.beginTransaction({
      operation: 'savepoint-rollback-test',
    });
    const repository = dataSource.getRepository(Collection);

    // 创建初始数据
    const collection1 = TestDataFactory.createCollection({
      name: 'Collection 1',
    });
    await transactionManager.executeOperation(context.transactionId, {
      type: TransactionOperationType.CREATE,
      target: 'collection',
      targetId: 'collection-1' as CollectionId,
      data: collection1,
    });

    // 创建保存点
    const savepointId = await transactionManager.createSavepoint(
      context.transactionId,
      'test-savepoint',
    );

    // 添加更多数据
    const collection2 = TestDataFactory.createCollection({
      name: 'Collection 2',
    });
    await transactionManager.executeOperation(context.transactionId, {
      type: TransactionOperationType.CREATE,
      target: 'collection',
      targetId: 'collection-2' as CollectionId,
      data: collection2,
    });

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
    const context = await transactionManager.beginTransaction({
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
