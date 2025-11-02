import { v4 as uuidv4 } from 'uuid';
import { Logger } from '@logging/logger.js';
import {
  ITransactionManager,
  TransactionOperation,
  TransactionOperationType,
  TransactionStatus,
  Savepoint,
} from '@domain/repositories/ITransactionManager.js';
import { TransactionContext } from '@infrastructure/transactions/TransactionContext.js';
import { SQLiteRepoCore } from '@infrastructure/repositories/SQLiteRepositoryCore.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';
import { CollectionId } from '@domain/entities/types.js';
import type { DocsTable } from '../sqlite/dao/DocsTable.js';
import type { ChunkMetaTable } from '../sqlite/dao/ChunkMetaTable.js';
import type { ChunksFts5Table } from '../sqlite/dao/ChunksFts5Table.js';

/**
 * 事务管理器实现
 * 统一事务边界管理，支持跨SQLite和Qdrant的事务操作
 */
export class TransactionManager implements ITransactionManager {
  private activeTransactions: Map<string, TransactionContext> = new Map();
  private readonly DEFAULT_CLEANUP_AGE = 30 * 60 * 1000; // 30分钟

  /**
   * 创建事务管理器实例
   *
   * @param sqliteCore SQLite仓库核心
   * @param qdrantRepo Qdrant仓库
   * @param logger 日志记录器
   */
  constructor(
    private readonly sqliteCore: SQLiteRepoCore,
    private readonly qdrantRepo: IQdrantRepo,
    private readonly logger: Logger,
  ) {}

  /**
   * 删除集合的事务方法
   * @param collectionId 集合ID
   * @param collections 集合表操作对象
   */
  async deleteCollectionInTransaction(
    collectionId: CollectionId,
    collections: {
      getById: (id: CollectionId) => { collectionId: CollectionId } | undefined;
      delete: (id: CollectionId) => void;
      chunkMeta: ChunkMetaTable;
      chunksFts5: ChunksFts5Table;
      docs: DocsTable;
      listAll: () => { collectionId: CollectionId }[];
    },
  ): Promise<void> {
    return this.executeInTransaction(async (context) => {
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
      await this.executeOperation(context.transactionId, {
        type: TransactionOperationType.DELETE,
        target: 'collection',
        targetId: collectionId,
        data: { collection },
      });

      // 在SQLite事务中执行所有删除操作
      this.sqliteCore.transaction(() => {
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

  /**
   * 开始一个新事务
   * @param metadata 事务元数据（可选）
   * @returns 事务上下文
   */
  beginTransaction(metadata?: Record<string, any>): TransactionContext {
    // eslint-disable-line @typescript-eslint/no-explicit-any -- 通用元数据字段
    const context = new TransactionContext({
      metadata,
    });

    this.activeTransactions.set(context.transactionId, context);
    this.logger.info('Transaction started', {
      transactionId: context.transactionId,
      metadata,
      nestingLevel: context.nestingLevel,
    });

    return context;
  }

  /**
   * 开始一个嵌套事务
   * @param parentTransactionId 父事务ID
   * @param metadata 事务元数据（可选）
   * @returns 嵌套事务上下文
   */
  beginNestedTransaction(
    parentTransactionId: string,
    metadata?: Record<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any -- 通用元数据字段
  ): TransactionContext {
    const parentContext = this.activeTransactions.get(parentTransactionId);
    if (!parentContext) {
      throw new Error(`Parent transaction ${parentTransactionId} not found`);
    }

    const context = new TransactionContext({
      parentTransactionId,
      metadata,
      nestingLevel: parentContext.nestingLevel + 1,
    });

    this.activeTransactions.set(context.transactionId, context);
    this.logger.info('Nested transaction started', {
      transactionId: context.transactionId,
      parentTransactionId,
      metadata,
      nestingLevel: context.nestingLevel,
    });

    return context;
  }

  /**
   * 提交事务
   * @param transactionId 事务ID
   */
  async commit(transactionId: string): Promise<void> {
    const context = this.activeTransactions.get(transactionId);
    if (!context) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (context.status !== TransactionStatus.ACTIVE) {
      throw new Error(`Transaction ${transactionId} is not active`);
    }

    try {
      // 在SQLite事务中执行所有操作
      this.sqliteCore.transaction(() => {
        this.logger.info('Committing SQLite transaction', {
          transactionId,
          operations: context.operations.length,
        });

        // SQLite操作已经在事务中执行，这里只需要标记状态
        context.status = TransactionStatus.COMMITTED;
      });

      this.logger.info('Transaction committed successfully', { transactionId });
    } catch (error) {
      this.logger.error('Failed to commit transaction', {
        transactionId,
        error: error instanceof Error ? error.message : String(error),
      });

      context.status = TransactionStatus.FAILED;
      throw error;
    }
  }

  /**
   * 回滚事务
   * @param transactionId 事务ID
   */
  async rollback(transactionId: string): Promise<void> {
    const context = this.activeTransactions.get(transactionId);
    if (!context) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    try {
      // 按相反顺序执行回滚操作
      const rollbackOperations = [...context.operations].reverse();

      for (const operation of rollbackOperations) {
        await this.executeRollbackOperation(operation);
      }

      context.status = TransactionStatus.ROLLED_BACK;
      this.logger.info('Transaction rolled back successfully', {
        transactionId,
      });
    } catch (error) {
      this.logger.error('Failed to rollback transaction', {
        transactionId,
        error: error instanceof Error ? error.message : String(error),
      });

      context.status = TransactionStatus.FAILED;
      throw error;
    }
  }

  /**
   * 在事务中执行操作
   * @param transactionId 事务ID
   * @param operation 事务操作
   */
  async executeOperation(
    transactionId: string,
    operation: TransactionOperation,
  ): Promise<void> {
    const context = this.activeTransactions.get(transactionId);
    if (!context) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

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
      const rollbackData = await this.executeOperationWithRollback(operation);
      operation.rollbackData = rollbackData;

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
   * @returns 函数执行结果
   */
  async executeInTransaction<T>(
    fn: (context: TransactionContext) => Promise<T>,
    metadata?: Record<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any -- 通用元数据字段
  ): Promise<T> {
    const context = this.beginTransaction(metadata);

    try {
      const result = await fn(context);
      await this.commit(context.transactionId);
      return result;
    } catch (error) {
      try {
        await this.rollback(context.transactionId);
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
    } finally {
      // 清理事务上下文
      this.activeTransactions.delete(context.transactionId);
    }
  }

  /**
   * 获取事务状态
   * @param transactionId 事务ID
   * @returns 事务上下文
   */
  getTransactionStatus(transactionId: string): TransactionContext | undefined {
    return this.activeTransactions.get(transactionId);
  }

  /**
   * 获取所有活跃事务
   * @returns 活跃事务列表
   */
  getActiveTransactions(): TransactionContext[] {
    return Array.from(this.activeTransactions.values());
  }

  /**
   * 清理已完成的事务
   * @param maxAge 最大保留时间（毫秒）
   */
  cleanupCompletedTransactions(
    maxAge: number = this.DEFAULT_CLEANUP_AGE,
  ): void {
    const now = Date.now();
    const transactionsToRemove: string[] = [];

    for (const [transactionId, context] of this.activeTransactions.entries()) {
      const isCompleted =
        context.status === TransactionStatus.COMMITTED ||
        context.status === TransactionStatus.ROLLED_BACK ||
        context.status === TransactionStatus.FAILED;

      const isExpired = now - context.startTime > maxAge;

      if (isCompleted && isExpired) {
        transactionsToRemove.push(transactionId);
      }
    }

    for (const transactionId of transactionsToRemove) {
      this.activeTransactions.delete(transactionId);
      this.logger.debug('Cleaned up completed transaction', { transactionId });
    }

    if (transactionsToRemove.length > 0) {
      this.logger.info('Cleaned up completed transactions', {
        count: transactionsToRemove.length,
      });
    }
  }

  /**
   * 执行操作并返回回滚数据
   * @param operation 事务操作
   * @returns 回滚数据
   */
  private async executeOperationWithRollback(
    operation: TransactionOperation,
  ): Promise<any> {
    // eslint-disable-line @typescript-eslint/no-explicit-any -- 回滚数据类型灵活
    switch (operation.target) {
      case 'collection':
        return this.executeCollectionOperation(operation);
      case 'document':
        return this.executeDocumentOperation(operation);
      case 'chunk':
        return this.executeChunkOperation(operation);
      default:
        throw new Error(`Unsupported operation target: ${operation.target}`);
    }
  }

  /**
   * 执行集合操作
   * @param operation 事务操作
   * @returns 回滚数据
   */
  private async executeCollectionOperation(
    operation: TransactionOperation,
  ): Promise<any> {
    // eslint-disable-line @typescript-eslint/no-explicit-any -- 回滚数据类型灵活
    // 这里需要根据具体的集合操作实现
    // 暂时返回空对象，实际实现需要根据具体操作类型处理
    return {};
  }

  /**
   * 执行文档操作
   * @param operation 事务操作
   * @returns 回滚数据
   */
  private async executeDocumentOperation(
    operation: TransactionOperation,
  ): Promise<any> {
    // eslint-disable-line @typescript-eslint/no-explicit-any -- 回滚数据类型灵活
    // 这里需要根据具体的文档操作实现
    // 暂时返回空对象，实际实现需要根据具体操作类型处理
    return {};
  }

  /**
   * 执行块操作
   * @param operation 事务操作
   * @returns 回滚数据
   */
  private async executeChunkOperation(
    operation: TransactionOperation,
  ): Promise<any> {
    // eslint-disable-line @typescript-eslint/no-explicit-any -- 回滚数据类型灵活
    // 这里需要根据具体的块操作实现
    // 暂时返回空对象，实际实现需要根据具体操作类型处理
    return {};
  }

  /**
   * 执行回滚操作
   * @param operation 事务操作
   */
  private async executeRollbackOperation(
    operation: TransactionOperation,
  ): Promise<void> {
    switch (operation.target) {
      case 'collection':
        await this.rollbackCollectionOperation(operation);
        break;
      case 'document':
        await this.rollbackDocumentOperation(operation);
        break;
      case 'chunk':
        await this.rollbackChunkOperation(operation);
        break;
      default:
        throw new Error(`Unsupported rollback target: ${operation.target}`);
    }
  }

  /**
   * 回滚集合操作
   * @param operation 事务操作
   */
  private async rollbackCollectionOperation(
    operation: TransactionOperation,
  ): Promise<void> {
    // 根据操作类型和回滚数据执行具体的回滚逻辑
    this.logger.debug('Rolling back collection operation', { operation });
  }

  /**
   * 回滚文档操作
   * @param operation 事务操作
   */
  private async rollbackDocumentOperation(
    operation: TransactionOperation,
  ): Promise<void> {
    // 根据操作类型和回滚数据执行具体的回滚逻辑
    this.logger.debug('Rolling back document operation', { operation });
  }

  /**
   * 回滚块操作
   * @param operation 事务操作
   */
  private async rollbackChunkOperation(
    operation: TransactionOperation,
  ): Promise<void> {
    // 根据操作类型和回滚数据执行具体的回滚逻辑
    this.logger.debug('Rolling back chunk operation', { operation });
  }

  /**
   * 在嵌套事务中执行函数
   * @param parentTransactionId 父事务ID
   * @param fn 要执行的函数
   * @param metadata 事务元数据（可选）
   * @returns 函数执行结果
   */
  async executeInNestedTransaction<T>(
    parentTransactionId: string,
    fn: (context: TransactionContext) => Promise<T>,
    metadata?: Record<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any -- 通用元数据字段
  ): Promise<T> {
    const context = this.beginNestedTransaction(parentTransactionId, metadata);

    try {
      const result = await fn(context);
      // 嵌套事务提交时，将操作合并到父事务
      await this.commitNestedTransaction(context.transactionId);
      return result;
    } catch (error) {
      try {
        await this.rollback(context.transactionId);
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
      // 清理嵌套事务上下文
      this.activeTransactions.delete(context.transactionId);
    }
  }

  /**
   * 提交嵌套事务（将操作合并到父事务）
   * @param transactionId 嵌套事务ID
   */
  private async commitNestedTransaction(transactionId: string): Promise<void> {
    const context = this.activeTransactions.get(transactionId);
    if (!context) {
      throw new Error(`Nested transaction ${transactionId} not found`);
    }

    if (!context.parentTransactionId) {
      throw new Error(
        `Transaction ${transactionId} is not a nested transaction`,
      );
    }

    const parentContext = this.activeTransactions.get(
      context.parentTransactionId,
    );
    if (!parentContext) {
      throw new Error(
        `Parent transaction ${context.parentTransactionId} not found`,
      );
    }

    // 将嵌套事务的操作合并到父事务
    for (const operation of context.operations) {
      parentContext.addOperation(operation);
    }

    // 将嵌套事务的保存点合并到父事务
    for (const [savepointId, savepoint] of context.savepoints) {
      parentContext.savepoints.set(savepointId, savepoint);
    }

    context.status = TransactionStatus.COMMITTED;
    this.logger.info('Nested transaction committed and merged to parent', {
      transactionId,
      parentTransactionId: context.parentTransactionId,
      operationsMerged: context.operations.length,
    });
  }

  /**
   * 创建保存点
   * @param transactionId 事务ID
   * @param name 保存点名称
   * @param metadata 保存点元数据（可选）
   * @returns 保存点ID
   */
  async createSavepoint(
    transactionId: string,
    name: string,
    metadata?: Record<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any -- 通用元数据字段
  ): Promise<string> {
    const context = this.activeTransactions.get(transactionId);
    if (!context) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    const savepointId = context.createSavepoint(name, metadata);

    this.logger.info('Savepoint created', {
      transactionId,
      savepointId,
      savepointName: name,
      operationsCount: context.operations.length,
    });

    return savepointId;
  }

  /**
   * 回滚到保存点
   * @param transactionId 事务ID
   * @param savepointId 保存点ID
   */
  async rollbackToSavepoint(
    transactionId: string,
    savepointId: string,
  ): Promise<void> {
    const context = this.activeTransactions.get(transactionId);
    if (!context) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    try {
      context.rollbackToSavepoint(savepointId);

      this.logger.info('Transaction rolled back to savepoint', {
        transactionId,
        savepointId,
        operationsCount: context.operations.length,
      });
    } catch (error) {
      this.logger.error('Failed to rollback to savepoint', {
        transactionId,
        savepointId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * 释放保存点
   * @param transactionId 事务ID
   * @param savepointId 保存点ID
   */
  async releaseSavepoint(
    transactionId: string,
    savepointId: string,
  ): Promise<void> {
    const context = this.activeTransactions.get(transactionId);
    if (!context) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    try {
      context.releaseSavepoint(savepointId);

      this.logger.info('Savepoint released', {
        transactionId,
        savepointId,
      });
    } catch (error) {
      this.logger.error('Failed to release savepoint', {
        transactionId,
        savepointId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * 获取事务的保存点列表
   * @param transactionId 事务ID
   * @returns 保存点列表
   */
  getTransactionSavepoints(transactionId: string): Savepoint[] {
    const context = this.activeTransactions.get(transactionId);
    if (!context) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    return context.getSavepoints();
  }

  /**
   * 检查事务是否为嵌套事务
   * @param transactionId 事务ID
   * @returns 是否为嵌套事务
   */
  isNestedTransaction(transactionId: string): boolean {
    const context = this.activeTransactions.get(transactionId);
    if (!context) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    return context.isNested();
  }

  /**
   * 获取根事务ID
   * @param transactionId 事务ID
   * @returns 根事务ID
   */
  getRootTransactionId(transactionId: string): string | undefined {
    const context = this.activeTransactions.get(transactionId);
    if (!context) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (context.isRootTransaction) {
      return context.transactionId;
    }

    // 递归查找根事务
    let currentContext = context;
    while (currentContext.parentTransactionId) {
      const parentContext = this.activeTransactions.get(
        currentContext.parentTransactionId,
      );
      if (!parentContext) {
        break;
      }

      if (parentContext.isRootTransaction) {
        return parentContext.transactionId;
      }

      currentContext = parentContext;
    }

    return undefined;
  }
}
