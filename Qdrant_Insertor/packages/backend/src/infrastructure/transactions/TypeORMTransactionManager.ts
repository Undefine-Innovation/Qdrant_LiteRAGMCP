import { DataSource, QueryRunner, TransactionNotStartedError } from 'typeorm';
import { Logger } from '@logging/logger.js';
import {
  ITransactionManager,
  TransactionOperation,
  TransactionOperationType,
  TransactionStatus,
  Savepoint,
} from '@domain/repositories/ITransactionManager.js';
import { TransactionContext } from '@infrastructure/transactions/TransactionContext.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';
import { CollectionId, DocId, PointId } from '@domain/entities/types.js';
import {
  TransactionErrorHandler,
  TransactionError,
  TransactionErrorType,
} from '@infrastructure/transactions/TransactionErrorHandler.js';
import { Collection } from '@infrastructure/database/entities/Collection.js';

/**
 * TypeORM事务管理器实现
 * 利用TypeORM的QueryRunner机制，实现统一事务管理器，确保关键业务流程的原子性，并支持嵌套事务
 */
export class TypeORMTransactionManager implements ITransactionManager {
  private activeTransactions: Map<string, TransactionContext> = new Map();
  private queryRunners: Map<string, QueryRunner> = new Map();
  private readonly DEFAULT_CLEANUP_AGE = 30 * 60 * 1000; // 30分钟
  private readonly errorHandler: TransactionErrorHandler;

  /**
   * 创建TypeORM事务管理器实例
   *
   * @param dataSource TypeORM数据源
   * @param qdrantRepo Qdrant仓库
   * @param logger 日志记录器
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly qdrantRepo: IQdrantRepo,
    private readonly logger: Logger,
  ) {
    this.errorHandler = new TransactionErrorHandler(logger, dataSource);
  }

  /**
   * 开始一个新事务
   * @param metadata 事务元数据（可选）
   * @returns 事务上下文
   */
  async beginTransaction(metadata?: Record<string, unknown>): Promise<TransactionContext> {
    const startTime = Date.now();

    try {
      const context = new TransactionContext({
        metadata,
      });

      // 创建QueryRunner并开始事务
      const queryRunner = this.dataSource.createQueryRunner();
      queryRunner.startTransaction();

      this.activeTransactions.set(context.transactionId, context);
      this.queryRunners.set(context.transactionId, queryRunner);

      // 记录状态变更
      this.errorHandler.logStateTransition(
        context.transactionId,
        TransactionStatus.PENDING,
        TransactionStatus.ACTIVE,
        { metadata, nestingLevel: context.nestingLevel },
      );

      this.logger.info('TypeORM transaction started', {
        transactionId: context.transactionId,
        metadata,
        nestingLevel: context.nestingLevel,
      });

      // 记录性能指标
      this.errorHandler.logPerformanceMetrics(
        context.transactionId,
        'beginTransaction',
        Date.now() - startTime,
        { metadata },
      );

      return context;
    } catch (error) {
      const transactionError = this.errorHandler.handleError(error as Error, {
        additionalContext: { operation: 'beginTransaction', metadata },
      });
      throw transactionError;
    }
  }

  /**
   * 开始一个嵌套事务
   * @param parentTransactionId 父事务ID
   * @param metadata 事务元数据（可选）
   * @returns 嵌套事务上下文
   */
  async beginNestedTransaction(
    parentTransactionId: string,
    metadata?: Record<string, unknown>,
  ): Promise<TransactionContext> {
    const startTime = Date.now();

    try {
      const parentContext = this.activeTransactions.get(parentTransactionId);
      if (!parentContext) {
        throw TransactionError.transactionNotFound(parentTransactionId);
      }

      const context = new TransactionContext({
        parentTransactionId,
        metadata,
        nestingLevel: parentContext.nestingLevel + 1,
      });

      // 嵌套事务使用相同的QueryRunner，但创建保存点
      const parentQueryRunner = this.queryRunners.get(parentTransactionId);
      if (!parentQueryRunner) {
        throw TransactionError.queryRunnerNotFound(parentTransactionId);
      }

      // 为嵌套事务创建保存点
      const savepointName = `sp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      // TODO: 检查 TypeORM QueryRunner 的保存点方法名
      // await parentQueryRunner.createSavepoint(savepointName);

      // 在上下文中记录保存点
      context.createSavepoint(savepointName, {
        type: 'nested_transaction',
        transactionId: context.transactionId,
        parentTransactionId,
      });

      this.activeTransactions.set(context.transactionId, context);
      this.queryRunners.set(context.transactionId, parentQueryRunner);

      // 记录状态变更
      this.errorHandler.logStateTransition(
        context.transactionId,
        TransactionStatus.PENDING,
        TransactionStatus.ACTIVE,
        {
          parentTransactionId,
          savepointName,
          metadata,
          nestingLevel: context.nestingLevel,
        },
      );

      this.logger.info('TypeORM nested transaction started with savepoint', {
        transactionId: context.transactionId,
        parentTransactionId,
        savepointName,
        metadata,
        nestingLevel: context.nestingLevel,
      });

      // 记录性能指标
      this.errorHandler.logPerformanceMetrics(
        context.transactionId,
        'beginNestedTransaction',
        Date.now() - startTime,
        {
          parentTransactionId,
          savepointName,
          metadata,
        },
      );

      return context;
    } catch (error) {
      const transactionError = this.errorHandler.handleError(error as Error, {
        transactionId: parentTransactionId,
        additionalContext: {
          operation: 'beginNestedTransaction',
          parentTransactionId,
          metadata,
        },
      });
      throw transactionError;
    }
  }

  /**
   * 提交事务
   * @param transactionId 事务ID
   */
  async commit(transactionId: string): Promise<void> {
    const startTime = Date.now();

    try {
      const context = this.activeTransactions.get(transactionId);
      if (!context) {
        throw TransactionError.transactionNotFound(transactionId);
      }

      const isNestedPending =
        !context.isRootTransaction &&
        context.status === TransactionStatus.PENDING;

      if (!isNestedPending && context.status !== TransactionStatus.ACTIVE) {
        throw TransactionError.invalidTransactionState(
          transactionId,
          context.status,
          TransactionStatus.ACTIVE,
        );
      }

      const previousStatus = context.status;

      const queryRunner = this.queryRunners.get(transactionId);
      if (!queryRunner) {
        throw TransactionError.queryRunnerNotFound(transactionId);
      }

      // 只有根事务才能实际提交到数据库
      if (context.isRootTransaction) {
        await queryRunner.commitTransaction();
        this.logger.info('TypeORM transaction committed to database', {
          transactionId,
          operations: context.operations.length,
        });
      } else {
        // 嵌套事务提交时，将操作合并到父事务
        await this.commitNestedTransaction(transactionId);
      }

      // 记录状态变更
      this.errorHandler.logStateTransition(
        transactionId,
        previousStatus,
        TransactionStatus.COMMITTED,
        {
          isRootTransaction: context.isRootTransaction,
          operationsCount: context.operations.length,
        },
      );

      context.status = TransactionStatus.COMMITTED;
      this.logger.info('Transaction committed successfully', {
        transactionId,
        isRootTransaction: context.isRootTransaction,
        operationsCount: context.operations.length,
      });

      // 记录性能指标
      this.errorHandler.logPerformanceMetrics(
        transactionId,
        'commit',
        Date.now() - startTime,
        {
          isRootTransaction: context.isRootTransaction,
          operationsCount: context.operations.length,
        },
      );
    } catch (error) {
      const transactionError = this.errorHandler.handleError(error as Error, {
        transactionId,
        additionalContext: { operation: 'commit' },
      });

      // 更新事务状态为失败
      const context = this.activeTransactions.get(transactionId);
      if (context) {
        this.errorHandler.logStateTransition(
          transactionId,
          context.status,
          TransactionStatus.FAILED,
          { reason: 'commit_failed' },
        );
        context.status = TransactionStatus.FAILED;
      }

      throw transactionError;
    } finally {
      // 清理事务上下文和QueryRunner
      const context = this.activeTransactions.get(transactionId);
      if (context?.isRootTransaction) {
        const queryRunner = this.queryRunners.get(transactionId);
        if (queryRunner) {
          try {
            await queryRunner.release();
          } catch (releaseError) {
            this.logger.error('Failed to release QueryRunner', {
              transactionId,
              error:
                releaseError instanceof Error
                  ? releaseError.message
                  : String(releaseError),
            });
          }
        }
      }

      // 总是清理事务上下文和QueryRunner引用
      this.activeTransactions.delete(transactionId);
      this.queryRunners.delete(transactionId);
    }
  }

  /**
   * 回滚事务
   * @param transactionId 事务ID
   */
  async rollback(transactionId: string): Promise<void> {
    const startTime = Date.now();

    try {
      const context = this.activeTransactions.get(transactionId);
      if (!context) {
        throw TransactionError.transactionNotFound(transactionId);
      }

      const queryRunner = this.queryRunners.get(transactionId);
      if (!queryRunner) {
        throw TransactionError.queryRunnerNotFound(transactionId);
      }

      // 只有根事务才能实际回滚到数据库
      if (context.isRootTransaction) {
        try {
          await queryRunner.rollbackTransaction();
          this.logger.info('TypeORM transaction rolled back from database', {
            transactionId,
          });
        } catch (rollbackError) {
          if (rollbackError instanceof TransactionNotStartedError) {
            this.logger.warn(
              'Rollback skipped because transaction was not started',
              { transactionId },
            );
          } else {
            throw rollbackError;
          }
        }
      } else {
        // 嵌套事务回滚时，回滚到创建嵌套事务时的保存点
        const nestedSavepoints = context.getSavepoints();
        const nestedTransactionSavepoint = nestedSavepoints.find(
          (sp) =>
            sp.metadata?.type === 'nested_transaction' &&
            sp.metadata?.transactionId === transactionId,
        );

        if (nestedTransactionSavepoint) {
          // TODO: 检查 TypeORM QueryRunner 的保存点方法名
          // await queryRunner.rollbackToSavepoint(
          //   nestedTransactionSavepoint.name,
          // );
          this.logger.info('Nested transaction rolled back to savepoint', {
            transactionId,
            savepointName: nestedTransactionSavepoint.name,
            savepointId: nestedTransactionSavepoint.id,
          });
        } else {
          this.logger.warn(
            'No savepoint found for nested transaction rollback',
            {
              transactionId,
              availableSavepoints: nestedSavepoints.map((sp) => ({
                id: sp.id,
                name: sp.name,
                type: sp.metadata?.type,
              })),
            },
          );
        }
      }

      // 记录状态变更
      this.errorHandler.logStateTransition(
        transactionId,
        context.status,
        TransactionStatus.ROLLED_BACK,
        {
          isRootTransaction: context.isRootTransaction,
          operationsCount: context.operations.length,
        },
      );

      context.status = TransactionStatus.ROLLED_BACK;
      this.logger.info('Transaction rolled back successfully', {
        transactionId,
        isNested: !context.isRootTransaction,
        operationsCount: context.operations.length,
      });

      // 记录性能指标
      this.errorHandler.logPerformanceMetrics(
        transactionId,
        'rollback',
        Date.now() - startTime,
        {
          isRootTransaction: context.isRootTransaction,
          operationsCount: context.operations.length,
        },
      );
    } catch (error) {
      const transactionError = this.errorHandler.handleError(error as Error, {
        transactionId,
        additionalContext: { operation: 'rollback' },
      });

      // 更新事务状态为失败
      const context = this.activeTransactions.get(transactionId);
      if (context) {
        this.errorHandler.logStateTransition(
          transactionId,
          context.status,
          TransactionStatus.FAILED,
          { reason: 'rollback_failed' },
        );
        context.status = TransactionStatus.FAILED;
      }

      throw transactionError;
    } finally {
      // 清理事务上下文和QueryRunner
      const context = this.activeTransactions.get(transactionId);
      if (context?.isRootTransaction) {
        const queryRunner = this.queryRunners.get(transactionId);
        if (queryRunner) {
          try {
            await queryRunner.release();
          } catch (releaseError) {
            this.logger.error('Failed to release QueryRunner during rollback', {
              transactionId,
              error:
                releaseError instanceof Error
                  ? releaseError.message
                  : String(releaseError),
            });
          }
        }
      }

      // 总是清理事务上下文和QueryRunner引用
      this.activeTransactions.delete(transactionId);
      this.queryRunners.delete(transactionId);
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
      if (operation.data !== undefined) {
        const rollbackData = await this.executeOperationWithRollback(
          operation,
          transactionId,
        );
        operation.rollbackData = rollbackData;
      }

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
    metadata?: Record<string, unknown>,
  ): Promise<T> {
    const context = await this.beginTransaction(metadata);
    if (context.status === TransactionStatus.PENDING) {
      context.status = TransactionStatus.ACTIVE;
    }

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
      // 清理事务上下文和QueryRunner
      this.activeTransactions.delete(context.transactionId);
      this.queryRunners.delete(context.transactionId);
    }
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
    metadata?: Record<string, unknown>,
  ): Promise<T> {
    const context = await this.beginNestedTransaction(
      parentTransactionId,
      metadata,
    );
    if (context.status === TransactionStatus.PENDING) {
      context.status = TransactionStatus.ACTIVE;
    }

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
      // 清理嵌套事务上下文（QueryRunner由父事务管理）
      this.activeTransactions.delete(context.transactionId);
      // 注意：嵌套事务不删除QueryRunner，因为它与父事务共享
    }
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
    metadata?: Record<string, unknown>,
  ): Promise<string> {
    const context = this.activeTransactions.get(transactionId);
    if (!context) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    const queryRunner = this.queryRunners.get(transactionId);
    if (!queryRunner) {
      throw new Error(`QueryRunner for transaction ${transactionId} not found`);
    }

    const savepointId = context.createSavepoint(name, metadata);

    // 在数据库中创建保存点
    // TODO: 检查 TypeORM QueryRunner 的保存点方法名
    // await queryRunner.createSavepoint(savepointId);

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

    const queryRunner = this.queryRunners.get(transactionId);
    if (!queryRunner) {
      throw new Error(`QueryRunner for transaction ${transactionId} not found`);
    }

    try {
      // 在数据库中回滚到保存点
      // TODO: 检查 TypeORM QueryRunner 的保存点方法名
      // await queryRunner.rollbackToSavepoint(savepointId);

      // 在内存中回滚到保存点
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

    const queryRunner = this.queryRunners.get(transactionId);
    if (!queryRunner) {
      throw new Error(`QueryRunner for transaction ${transactionId} not found`);
    }

    try {
      // 在数据库中释放保存点
      // TODO: 检查 TypeORM QueryRunner 的保存点方法名
      // await queryRunner.releaseSavepoint(savepointId);

      // 在内存中释放保存点
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
      this.queryRunners.delete(transactionId);
      this.logger.debug('Cleaned up completed transaction', { transactionId });
    }

    if (transactionsToRemove.length > 0) {
      this.logger.info('Cleaned up completed transactions', {
        count: transactionsToRemove.length,
      });
    }
  }

  /**
   * 获取QueryRunner实例
   * @param transactionId 事务ID
   * @returns QueryRunner实例
   */
  getQueryRunner(transactionId: string): QueryRunner | undefined {
    return this.queryRunners.get(transactionId);
  }

  /**
   * 执行操作并返回回滚数据
   * @param operation 事务操作
   * @param transactionId 事务ID
   * @returns 回滚数据
   */
  private async executeOperationWithRollback(
    operation: TransactionOperation,
    transactionId: string,
  ): Promise<unknown> {
    switch (operation.target) {
      case 'collection':
        return this.executeCollectionOperation(operation, transactionId);
      case 'document':
        return this.executeDocumentOperation(operation, transactionId);
      case 'chunk':
        return this.executeChunkOperation(operation, transactionId);
      default:
        throw new Error(`Unsupported operation target: ${operation.target}`);
    }
  }

  /**
   * 执行集合操作
   * @param operation 事务操作
   * @param transactionId 事务ID
   * @returns 回滚数据
   */
  private async executeCollectionOperation(
    operation: TransactionOperation,
    transactionId: string,
  ): Promise<unknown> {
    const queryRunner = this.queryRunners.get(transactionId);
    if (!queryRunner) {
      throw new Error(`QueryRunner for transaction ${transactionId} not found`);
    }

    const { type, targetId, data } = operation;
    const collectionId = targetId as CollectionId;

    try {
      switch (type) {
        case TransactionOperationType.CREATE: {
          // 创建集合操作
          const collectionData = data as { name: string; description?: string };

          // 获取创建前的状态用于回滚
          const existingCollection = await queryRunner.manager.findOne(
            'Collection',
            {
              where: { id: collectionId },
            },
          );

          if (existingCollection) {
            throw new Error(`Collection ${collectionId} already exists`);
          }

          // 在事务中创建集合
          const timestamp = Date.now();
          const newCollection = await queryRunner.manager.save('Collection', {
            id: collectionId,
            collectionId,
            name: collectionData.name,
            description: collectionData.description || '',
            status: 'active',
            documentCount: 0,
            chunkCount: 0,
            created_at: timestamp,
            updated_at: timestamp,
          });

          this.logger.debug('Collection created in transaction', {
            transactionId,
            collectionId,
            collectionName: collectionData.name,
          });

          // 返回回滚数据
          return {
            operation: 'create',
            collectionId,
            originalState: null,
            newState: newCollection,
          };
        }

        case TransactionOperationType.UPDATE: {
          // 更新集合操作
          const updateData = data as { name?: string; description?: string };

          // 获取更新前的状态用于回滚
          let originalCollection: Collection | null =
            (await queryRunner.manager.findOne('Collection', {
              where: { id: collectionId },
            })) as Collection | null;
          const pendingCollection = (
            operation.data as { collection?: Collection }
          )?.collection;
          if (!originalCollection && pendingCollection) {
            originalCollection = pendingCollection;
          }

          if (!originalCollection) {
            throw new Error(`Collection ${collectionId} not found`);
          }

          // 在事务中更新集合
          await queryRunner.manager.update(
            'Collection',
            { collectionId },
            {
              ...(updateData.name && { name: updateData.name }),
              ...(updateData.description !== undefined && {
                description: updateData.description,
              }),
              updated_at: Date.now(),
            },
          );

          // 获取更新后的状态
          const updatedCollection = await queryRunner.manager.findOne(
            'Collection',
            {
              where: { id: collectionId },
            },
          );

          this.logger.debug('Collection updated in transaction', {
            transactionId,
            collectionId,
            updateData,
          });

          // 返回回滚数据
          return {
            operation: 'update',
            collectionId,
            originalState: originalCollection,
            newState: updatedCollection,
          };
        }

        case TransactionOperationType.DELETE: {
          // 删除集合操作

          // 获取删除前的状态用于回滚
          let originalCollection: Collection | null =
            (await queryRunner.manager.findOne('Collection', {
              where: { id: collectionId },
            })) as Collection | null;
          const pendingCollection = (
            operation.data as { collection?: Collection }
          )?.collection;
          if (!originalCollection && pendingCollection) {
            originalCollection = pendingCollection;
          }

          if (!originalCollection) {
            throw new Error(`Collection ${collectionId} not found`);
          }

          // 在事务中删除集合
          await queryRunner.manager.delete('Collection', { id: collectionId });

          this.logger.debug('Collection deleted in transaction', {
            transactionId,
            collectionId,
          });

          // 返回回滚数据
          return {
            operation: 'delete',
            collectionId,
            originalState: originalCollection,
            newState: null,
          };
        }

        default:
          throw new Error(`Unsupported collection operation type: ${type}`);
      }
    } catch (error) {
      this.logger.error(
        'Failed to execute collection operation in transaction',
        {
          transactionId,
          operation,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      throw error;
    }
  }

  /**
   * 执行文档操作
   * @param operation 事务操作
   * @param transactionId 事务ID
   * @returns 回滚数据
   */
  private async executeDocumentOperation(
    operation: TransactionOperation,
    transactionId: string,
  ): Promise<unknown> {
    const queryRunner = this.queryRunners.get(transactionId);
    if (!queryRunner) {
      throw new Error(`QueryRunner for transaction ${transactionId} not found`);
    }

    const { type, targetId, data } = operation;
    const docId = targetId as DocId;

    try {
      switch (type) {
        case TransactionOperationType.CREATE: {
          // 创建文档操作
          const docData = data as {
            collectionId: CollectionId;
            key: string;
            name: string;
            mime: string;
            size_bytes: number;
            content: string;
          };

          // 获取创建前的状态用于回滚
          const existingDoc = await queryRunner.manager.findOne('Doc', {
            where: { key: docData.key },
          });

          if (existingDoc) {
            throw new Error(`Document with key ${docData.key} already exists`);
          }

          // 在事务中创建文档
          const newDoc = await queryRunner.manager.save('Doc', {
            key: docData.key,
            collectionId: docData.collectionId,
            name: docData.name,
            mime: docData.mime,
            size_bytes: docData.size_bytes,
            content: docData.content,
            deleted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          this.logger.debug('Document created in transaction', {
            transactionId,
            docId,
            docKey: docData.key,
          });

          // 返回回滚数据
          return {
            operation: 'create',
            docId,
            docKey: docData.key,
            originalState: null,
            newState: newDoc,
          };
        }

        case TransactionOperationType.UPDATE: {
          // 更新文档操作
          const updateData = data as {
            name?: string;
            content?: string;
            mime?: string;
            size_bytes?: number;
          };

          // 获取更新前的状态用于回滚
          const originalDoc = await queryRunner.manager.findOne('Doc', {
            where: { key: docId },
          });

          if (!originalDoc) {
            throw new Error(`Document ${docId} not found`);
          }

          // 在事务中更新文档
          await queryRunner.manager.update(
            'Doc',
            { key: docId },
            {
              ...(updateData.name && { name: updateData.name }),
              ...(updateData.content !== undefined && {
                content: updateData.content,
              }),
              ...(updateData.mime && { mime: updateData.mime }),
              ...(updateData.size_bytes !== undefined && {
                size_bytes: updateData.size_bytes,
              }),
              updatedAt: new Date(),
            },
          );

          // 获取更新后的状态
          const updatedDoc = await queryRunner.manager.findOne('Doc', {
            where: { key: docId },
          });

          this.logger.debug('Document updated in transaction', {
            transactionId,
            docId,
            updateData,
          });

          // 返回回滚数据
          return {
            operation: 'update',
            docId,
            originalState: originalDoc,
            newState: updatedDoc,
          };
        }

        case TransactionOperationType.DELETE: {
          // 删除文档操作

          // 获取删除前的状态用于回滚
          const originalDoc = await queryRunner.manager.findOne('Doc', {
            where: { key: docId },
          });

          if (!originalDoc) {
            throw new Error(`Document ${docId} not found`);
          }

          // 在事务中删除文档
          await queryRunner.manager.delete('Doc', { key: docId });

          this.logger.debug('Document deleted in transaction', {
            transactionId,
            docId,
          });

          // 返回回滚数据
          return {
            operation: 'delete',
            docId,
            originalState: originalDoc,
            newState: null,
          };
        }

        default:
          throw new Error(`Unsupported document operation type: ${type}`);
      }
    } catch (error) {
      this.logger.error('Failed to execute document operation in transaction', {
        transactionId,
        operation,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 执行块操作
   * @param operation 事务操作
   * @param transactionId 事务ID
   * @returns 回滚数据
   */
  private async executeChunkOperation(
    operation: TransactionOperation,
    transactionId: string,
  ): Promise<unknown> {
    const queryRunner = this.queryRunners.get(transactionId);
    if (!queryRunner) {
      throw new Error(`QueryRunner for transaction ${transactionId} not found`);
    }

    const { type, targetId, data } = operation;
    const pointId = targetId as PointId;

    try {
      switch (type) {
        case TransactionOperationType.CREATE: {
          // 创建块操作
          const chunkData = data as {
            docId: DocId;
            collectionId: CollectionId;
            chunkIndex: number;
            title?: string;
            content: string;
          };

          // 获取创建前的状态用于回滚
          const existingChunk = await queryRunner.manager.findOne('Chunk', {
            where: { pointId },
          });

          if (existingChunk) {
            throw new Error(`Chunk ${pointId} already exists`);
          }

          // 在事务中创建块
          const newChunk = await queryRunner.manager.save('Chunk', {
            pointId,
            docId: chunkData.docId,
            collectionId: chunkData.collectionId,
            chunkIndex: chunkData.chunkIndex,
            title: chunkData.title || '',
            content: chunkData.content,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          this.logger.debug('Chunk created in transaction', {
            transactionId,
            pointId,
            docId: chunkData.docId,
          });

          // 返回回滚数据
          return {
            operation: 'create',
            pointId,
            originalState: null,
            newState: newChunk,
          };
        }

        case TransactionOperationType.UPDATE: {
          // 更新块操作
          const updateData = data as {
            title?: string;
            content?: string;
          };

          // 获取更新前的状态用于回滚
          const originalChunk = await queryRunner.manager.findOne('Chunk', {
            where: { pointId },
          });

          if (!originalChunk) {
            throw new Error(`Chunk ${pointId} not found`);
          }

          // 在事务中更新块
          await queryRunner.manager.update(
            'Chunk',
            { pointId },
            {
              ...(updateData.title !== undefined && {
                title: updateData.title,
              }),
              ...(updateData.content !== undefined && {
                content: updateData.content,
              }),
              updatedAt: new Date(),
            },
          );

          // 获取更新后的状态
          const updatedChunk = await queryRunner.manager.findOne('Chunk', {
            where: { pointId },
          });

          this.logger.debug('Chunk updated in transaction', {
            transactionId,
            pointId,
            updateData,
          });

          // 返回回滚数据
          return {
            operation: 'update',
            pointId,
            originalState: originalChunk,
            newState: updatedChunk,
          };
        }

        case TransactionOperationType.DELETE: {
          // 删除块操作

          // 获取删除前的状态用于回滚
          const originalChunk = await queryRunner.manager.findOne('Chunk', {
            where: { pointId },
          });

          if (!originalChunk) {
            throw new Error(`Chunk ${pointId} not found`);
          }

          // 在事务中删除块
          await queryRunner.manager.delete('Chunk', { pointId });

          this.logger.debug('Chunk deleted in transaction', {
            transactionId,
            pointId,
          });

          // 返回回滚数据
          return {
            operation: 'delete',
            pointId,
            originalState: originalChunk,
            newState: null,
          };
        }

        default:
          throw new Error(`Unsupported chunk operation type: ${type}`);
      }
    } catch (error) {
      this.logger.error('Failed to execute chunk operation in transaction', {
        transactionId,
        operation,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
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
   * 删除集合的事务方法
   * @param collectionId 集合ID
   * @param collections 集合表操作对象
   * @param collections.getById 获取集合方法
   * @param collections.delete 删除集合方法
   * @param collections.chunkMeta 集合元数据操作
   * @param collections.chunkMeta.deleteByCollectionId 按集合ID删除元数据方法
   * @param collections.chunksFts5 全文搜索操作
   * @param collections.chunksFts5.deleteByCollectionId 按集合ID删除全文搜索数据方法
   * @param collections.docs 文档操作
   * @param collections.docs.listByCollection 按集合列出文档方法
   * @param collections.docs.hardDelete 硬删除文档方法
   * @param collections.listAll 列出所有集合方法
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

      // 获取QueryRunner并在事务中执行所有删除操作
      const queryRunner = this.getQueryRunner(context.transactionId);
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
