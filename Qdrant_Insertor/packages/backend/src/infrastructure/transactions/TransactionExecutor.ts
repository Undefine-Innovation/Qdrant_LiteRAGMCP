import { QueryRunner } from 'typeorm';
import { Logger } from '@logging/logger.js';
import {
  ITransactionManager,
  TransactionOperation,
  TransactionOperationType,
  TransactionStatus,
} from '@domain/repositories/ITransactionManager.js';
import { TransactionContext } from '@infrastructure/transactions/TransactionContext.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';
import { CollectionId } from '@domain/entities/types.js';
import { TransactionOperations } from '@infrastructure/transactions/TransactionOperations.js';
import { TransactionSavepoints } from '@infrastructure/transactions/TransactionSavepoints.js';
// 移除对已删除的TransactionErrorHandler的引用

/**
 * 事务执行器
 * 负责在事务中执行操作和函数
 */
export class TransactionExecutor {
  constructor(
    private readonly logger: Logger,
    private readonly qdrantRepo: IQdrantRepo,
    private readonly operationsHandler: TransactionOperations,
    private readonly savepointsHandler: TransactionSavepoints,
  ) {}

  /**
   * 在事务中执行操作
   * @param transactionId 事务ID
   * @param operation 事务操作
   * @param context 事务上下文
   * @param queryRunner QueryRunner实例
   */
  async executeOperation(
    transactionId: string,
    operation: TransactionOperation,
    context: TransactionContext,
    queryRunner: QueryRunner,
  ): Promise<void> {
    if (
      context.status !== TransactionStatus.ACTIVE &&
      context.status !== TransactionStatus.PENDING
    ) {
      throw new Error(
        `Transaction ${transactionId} is not in a valid state for operations`,
      );
    }

    try {
      // 如果是第一个操作，将事务状态设为ACTIVE
      if (context.status === TransactionStatus.PENDING) {
        context.status = TransactionStatus.ACTIVE;
      }

      // 执行操作并保存回滚数据
      // 注意：DELETE操作可能没有data字段，但仍需执行
      const rollbackData =
        await this.operationsHandler.executeOperationWithRollback(
          operation,
          transactionId,
          queryRunner,
        );
      operation.rollbackData = rollbackData as Record<string, unknown>;

      context.addOperation(operation);

      this.logger.debug('Operation executed in transaction', {
        transactionId,
        operationType: operation.type,
        target: operation.target,
        targetId: operation.targetId,
      });
    } catch (error) {
      this.logger.error('Failed to execute operation in transaction', {
        transactionId,
        operation,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * 在事务中执行函数
   * @param fn 要执行的函数
   * @param metadata 事务元数据（可选）
   * @param beginTransaction 开始事务的函数
   * @param commit 提交事务的函数
   * @param rollback 回滚事务的函数
   * @returns 函数执行结果
   */
  async executeInTransaction<T>(
    fn: (context: TransactionContext) => Promise<T>,
    metadata: Record<string, unknown> | undefined,
    beginTransaction: (
      metadata?: Record<string, unknown>,
    ) => Promise<TransactionContext & { transactionId: string }>,
    commit: (transactionId: string) => Promise<void>,
    rollback: (transactionId: string) => Promise<void>,
  ): Promise<T> {
    const context = await beginTransaction(metadata);

    try {
      const result = await fn(context);
      await commit(context.transactionId);
      return result;
    } catch (error) {
      try {
        await rollback(context.transactionId);
      } catch (rollbackError) {
        this.logger.error('Failed to rollback transaction', {
          transactionId: context.transactionId,
          error:
            rollbackError instanceof Error
              ? rollbackError.message
              : String(rollbackError),
        });
      }

      throw error;
    }
    // 注意：不在这里清理事务上下文，因为commit和rollback方法已经处理了清理
  }

  /**
   * 在嵌套事务中执行函数
   * @param parentTransactionId 父事务ID
   * @param fn 要执行的函数
   * @param metadata 事务元数据（可选）
   * @param beginNestedTransaction 开始嵌套事务的函数
   * @param commitNestedTransaction 提交嵌套事务的函数
   * @param rollback 回滚事务的函数
   * @param cleanupNestedTransaction 清理嵌套事务的函数
   * @returns 函数执行结果
   */
  async executeInNestedTransaction<T>(
    parentTransactionId: string,
    fn: (context: TransactionContext) => Promise<T>,
    metadata: Record<string, unknown> | undefined,
    beginNestedTransaction: (
      parentTransactionId: string,
      metadata?: Record<string, unknown>,
    ) => Promise<TransactionContext>,
    commitNestedTransaction: (transactionId: string) => void,
    rollback: (transactionId: string) => Promise<void>,
    cleanupNestedTransaction: (transactionId: string) => void,
  ): Promise<T> {
    const context = await beginNestedTransaction(parentTransactionId, metadata);

    try {
      const result = await fn(context);
      // 嵌套事务提交时，将操作合并到父事务
      commitNestedTransaction(context.transactionId);
      return result;
    } catch (error) {
      try {
        await rollback(context.transactionId);
      } catch (rollbackError) {
        this.logger.error('Failed to rollback nested transaction', {
          transactionId: context.transactionId,
          error:
            rollbackError instanceof Error
              ? rollbackError.message
              : String(rollbackError),
        });
      }

      throw error;
    } finally {
      // 清理嵌套事务上下文（QueryRunner由父事务管理）
      cleanupNestedTransaction(context.transactionId);
      // 注意：嵌套事务不删除QueryRunner，因为它与父事务共享
    }
  }

  /**
   * 创建保存点
   * @param transactionId 事务ID
   * @param name 保存点名称
   * @param metadata 保存点元数据（可选）
   * @param context 事务上下文
   * @param queryRunner QueryRunner实例
   * @returns 保存点ID
   */
  async createSavepoint(
    transactionId: string,
    name: string,
    metadata: Record<string, unknown> | undefined,
    context: TransactionContext,
    queryRunner: QueryRunner,
  ): Promise<string> {
    return await this.savepointsHandler.createSavepoint(
      transactionId,
      name,
      queryRunner,
      context.savepoints,
      metadata,
    );
  }

  /**
   * 回滚到保存点
   * @param transactionId 事务ID
   * @param savepointId 保存点ID
   * @param context 事务上下文
   * @param queryRunner QueryRunner实例
   */
  async rollbackToSavepoint(
    transactionId: string,
    savepointId: string,
    context: TransactionContext,
    queryRunner: QueryRunner,
  ): Promise<void> {
    await this.savepointsHandler.rollbackToSavepoint(
      transactionId,
      savepointId,
      queryRunner,
      context.savepoints,
      context.operations,
    );

    // 在内存中回滚到保存点
    context.rollbackToSavepoint(savepointId);
  }

  /**
   * 释放保存点
   * @param transactionId 事务ID
   * @param savepointId 保存点ID
   * @param context 事务上下文
   * @param queryRunner QueryRunner实例
   */
  async releaseSavepoint(
    transactionId: string,
    savepointId: string,
    context: TransactionContext,
    queryRunner: QueryRunner,
  ): Promise<void> {
    await this.savepointsHandler.releaseSavepoint(
      transactionId,
      savepointId,
      queryRunner,
      context.savepoints,
    );

    // 在内存中释放保存点
    context.releaseSavepoint(savepointId);
  }

  /**
   * 删除集合的事务方法
   * @param collectionId 集合ID
   * @param collections 集合表操作对象
   * @param collections.getById 根据ID获取集合的方法
   * @param collections.delete 删除集合的方法
   * @param collections.chunkMeta 块元数据操作对象
   * @param collections.chunkMeta.deleteByCollectionId 根据集合ID删除块元数据的方法
   * @param collections.chunksFts5 FTS5块操作对象
   * @param collections.chunksFts5.deleteByCollectionId 根据集合ID删除FTS5块的方法
   * @param collections.docs 文档操作对象
   * @param collections.docs.listByCollection 根据集合ID列出文档的方法
   * @param collections.docs.hardDelete 硬删除文档的方法
   * @param collections.listAll 列出所有集合的方法
   * @param executeInTransaction 在事务中执行函数的方法
   * @param executeOperation 执行操作的方法
   * @param getQueryRunner 获取QueryRunner的方法
   * @returns Promise<void>
   */
  async deleteCollectionInTransaction(
    collectionId: CollectionId,
    collections: {
      getById: (id: CollectionId) => { collectionId: CollectionId } | undefined;
      delete: (id: CollectionId) => void;
      chunkMeta: { deleteByCollectionId: (id: CollectionId) => void };
      chunksFts5: { deleteByCollectionId: (id: CollectionId) => void };
      docs: {
        listByCollection: (id: CollectionId) => Array<{ docId: string }>;
        hardDelete: (id: string) => void;
      };
      listAll: () => { collectionId: CollectionId }[];
    },
    executeInTransaction: <T>(
      fn: (context: TransactionContext) => Promise<T>,
      metadata?: Record<string, unknown>,
    ) => Promise<T>,
    executeOperation: (
      transactionId: string,
      operation: TransactionOperation,
    ) => Promise<void>,
    getQueryRunner: (transactionId: string) => QueryRunner | undefined,
  ): Promise<void> {
    return executeInTransaction(async (context) => {
      // 验证集合存在
      const collection = collections.getById(collectionId);
      if (!collection) {
        this.logger.warn(
          'deleteCollection: no such collectionId',
          collectionId,
        );
        return;
      }

      // 记录删除集合操作
      await executeOperation(context.transactionId, {
        type: 'DELETE' as TransactionOperationType,
        target: 'collection',
        targetId: collectionId,
        data: { collection },
      });

      // 获取QueryRunner并在事务中执行所有删除操作
      const queryRunner = getQueryRunner(context.transactionId);
      if (!queryRunner) {
        throw new Error(
          `QueryRunner for transaction ${context.transactionId} not found`,
        );
      }

      // 在TypeORM事务中执行所有删除操作
      await queryRunner.manager.transaction(async (manager) => {
        // 首先，删除与集合关联的所有块及其元数据
        collections.chunkMeta.deleteByCollectionId(collectionId);
        collections.chunksFts5.deleteByCollectionId(collectionId);

        // 然后，删除集合中的所有文档
        const docsInCollection =
          collections.docs.listByCollection(collectionId);
        for (const doc of docsInCollection) {
          collections.docs.hardDelete(doc.docId);
        }

        // 最后，删除集合本身
        collections.delete(collectionId);
      });

      // 异步删除Qdrant中的向量数据（不阻塞事务提交）
      if (this.qdrantRepo) {
        this.qdrantRepo
          .deletePointsByCollection(collectionId)
          .catch((error) => {
            this.logger.warn('Failed to delete Qdrant points for collection', {
              collectionId,
              error: error instanceof Error ? error.message : String(error),
            });
          });
      }

      this.logger.info(
        `Collection ${collectionId} and its associated data have been deleted.`,
      );
    });
  }
}
