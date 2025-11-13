import { DataSource, QueryRunner } from 'typeorm';
import { Logger } from '@logging/logger.js';
import {
  ITransactionManager,
  TransactionOperation,
  TransactionStatus,
  Savepoint,
} from '@domain/repositories/ITransactionManager.js';
import { TransactionContext } from '@infrastructure/transactions/TransactionContext.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';
import { CollectionId } from '@domain/entities/types.js';
import {
  TransactionErrorHandler,
  TransactionError,
} from '@infrastructure/transactions/TransactionErrorHandler.js';
import { TransactionOperations } from '@infrastructure/transactions/TransactionOperations.js';
import { TransactionRollback } from '@infrastructure/transactions/TransactionRollback.js';
import { TransactionSavepoints } from '@infrastructure/transactions/TransactionSavepoints.js';
import { TransactionCleanup } from '@infrastructure/transactions/TransactionCleanup.js';
import { TransactionLifecycle } from '@infrastructure/transactions/TransactionLifecycle.js';
import { TransactionStateManager } from '@infrastructure/transactions/TransactionStateManager.js';
import { TransactionExecutor } from '@infrastructure/transactions/TransactionExecutor.js';

/**
 * TypeORM事务管理器实现（最终版）
 * 利用TypeORM的QueryRunner机制，实现统一事务管理器，确保关键业务流程的原子性，并支持嵌套事务
 */
export class TypeORMTransactionManager implements ITransactionManager {
  private activeTransactions: Map<string, TransactionContext> = new Map();
  private queryRunners: Map<string, QueryRunner> = new Map();
  private readonly lifecycle: TransactionLifecycle;
  private readonly stateManager: TransactionStateManager;
  private readonly executor: TransactionExecutor;

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
    const errorHandler = new TransactionErrorHandler(logger, dataSource);
    const operationsHandler = new TransactionOperations(
      dataSource,
      qdrantRepo,
      logger,
    );
    const rollbackHandler = new TransactionRollback(logger);
    const savepointsHandler = new TransactionSavepoints(
      logger,
      rollbackHandler,
    );
    const cleanupHandler = new TransactionCleanup(logger);

    this.lifecycle = new TransactionLifecycle(dataSource, logger, errorHandler);
    this.stateManager = new TransactionStateManager(logger, cleanupHandler);
    this.executor = new TransactionExecutor(
      logger,
      qdrantRepo,
      operationsHandler,
      savepointsHandler,
      errorHandler,
    );
  }

  /**
   * 开始一个新事务
   * @param metadata 事务元数据（可选）
   * @returns 事务上下文
   */
  async beginTransaction(
    metadata?: Record<string, unknown>,
  ): Promise<TransactionContext & { transactionId: string }> {
    const { context, queryRunner } =
      await this.lifecycle.beginTransaction(metadata);

    // 保持事务状态为PENDING，在第一个操作执行时才转换为ACTIVE
    this.activeTransactions.set(context.transactionId, context);
    this.queryRunners.set(context.transactionId, queryRunner);

    // 直接返回 context，因为事务已经真正启动了
    // 添加 transactionId 属性以保持向后兼容
    return Object.assign(context, { transactionId: context.transactionId });
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
    const parentContext = this.activeTransactions.get(parentTransactionId);
    if (!parentContext) {
      throw TransactionError.transactionNotFound(parentTransactionId);
    }

    const parentQueryRunner = this.queryRunners.get(parentTransactionId);
    if (!parentQueryRunner) {
      throw TransactionError.queryRunnerNotFound(parentTransactionId);
    }

    const context = await this.lifecycle.beginNestedTransaction(
      parentTransactionId,
      parentQueryRunner,
      metadata,
    );

    // 设置嵌套级别
    (context as unknown as Record<string, unknown>).nestingLevel =
      parentContext.nestingLevel + 1;

    this.activeTransactions.set(context.transactionId, context);
    this.queryRunners.set(context.transactionId, parentQueryRunner);

    return context;
  }

  /**
   * 提交事务
   * @param transactionId 事务ID
   */
  async commit(transactionId: string): Promise<void> {
    const context = this.activeTransactions.get(transactionId);
    if (!context) {
      throw TransactionError.transactionNotFound(transactionId);
    }

    const queryRunner = this.queryRunners.get(transactionId);
    if (!queryRunner) {
      throw TransactionError.queryRunnerNotFound(transactionId);
    }

    try {
      // 对于嵌套事务，使用 stateManager 的 commitNestedTransaction 方法
      if (context.parentTransactionId) {
        await this.stateManager.commitNestedTransaction(
          transactionId,
          this.activeTransactions,
        );
      } else {
        // 对于根事务，使用 lifecycle 的 commit 方法
        await this.lifecycle.commit(context, queryRunner);
      }
    } finally {
      await this.stateManager.cleanupTransaction(
        transactionId,
        context,
        this.activeTransactions,
        this.queryRunners,
      );
    }
  }

  /**
   * 回滚事务
   * @param transactionId 事务ID
   */
  async rollback(transactionId: string): Promise<void> {
    const context = this.activeTransactions.get(transactionId);
    if (!context) {
      throw TransactionError.transactionNotFound(transactionId);
    }

    const queryRunner = this.queryRunners.get(transactionId);
    if (!queryRunner) {
      throw TransactionError.queryRunnerNotFound(transactionId);
    }

    try {
      await this.lifecycle.rollback(context, queryRunner);
    } finally {
      await this.stateManager.cleanupTransaction(
        transactionId,
        context,
        this.activeTransactions,
        this.queryRunners,
      );
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
      throw TransactionError.transactionNotFound(transactionId);
    }

    const queryRunner = this.queryRunners.get(transactionId);
    if (!queryRunner) {
      throw TransactionError.queryRunnerNotFound(transactionId);
    }

    await this.executor.executeOperation(
      transactionId,
      operation,
      context,
      queryRunner,
    );
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
    return this.executor.executeInTransaction(
      fn,
      metadata,
      this.beginTransaction.bind(this),
      this.commit.bind(this),
      this.rollback.bind(this),
    );
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
    return this.executor.executeInNestedTransaction(
      parentTransactionId,
      fn,
      metadata,
      this.beginNestedTransaction.bind(this),
      (transactionId: string) =>
        this.stateManager.commitNestedTransaction(
          transactionId,
          this.activeTransactions,
        ),
      this.rollback.bind(this),
      (transactionId: string) =>
        this.stateManager.cleanupNestedTransaction(
          transactionId,
          this.activeTransactions,
        ),
    );
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
      throw TransactionError.transactionNotFound(transactionId);
    }

    const queryRunner = this.queryRunners.get(transactionId);
    if (!queryRunner) {
      throw TransactionError.queryRunnerNotFound(transactionId);
    }

    return await this.executor.createSavepoint(
      transactionId,
      name,
      metadata,
      context,
      queryRunner,
    );
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
      throw TransactionError.transactionNotFound(transactionId);
    }

    const queryRunner = this.queryRunners.get(transactionId);
    if (!queryRunner) {
      throw TransactionError.queryRunnerNotFound(transactionId);
    }

    await this.executor.rollbackToSavepoint(
      transactionId,
      savepointId,
      context,
      queryRunner,
    );
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
      throw TransactionError.transactionNotFound(transactionId);
    }

    const queryRunner = this.queryRunners.get(transactionId);
    if (!queryRunner) {
      throw TransactionError.queryRunnerNotFound(transactionId);
    }

    await this.executor.releaseSavepoint(
      transactionId,
      savepointId,
      context,
      queryRunner,
    );
  }

  /**
   * 获取事务状态
   * @param transactionId 事务ID
   * @returns 事务上下文
   */
  getTransactionStatus(transactionId: string): TransactionContext | undefined {
    return this.stateManager.getTransactionStatus(
      transactionId,
      this.activeTransactions,
    );
  }

  /**
   * 获取所有活跃事务
   * @returns 活跃事务列表
   */
  getActiveTransactions(): TransactionContext[] {
    return this.stateManager.getActiveTransactions(this.activeTransactions);
  }

  /**
   * 获取事务的保存点列表
   * @param transactionId 事务ID
   * @returns 保存点列表
   */
  getTransactionSavepoints(transactionId: string): Savepoint[] {
    return this.stateManager.getTransactionSavepoints(
      transactionId,
      this.activeTransactions,
    );
  }

  /**
   * 检查事务是否为嵌套事务
   * @param transactionId 事务ID
   * @returns 是否为嵌套事务
   */
  isNestedTransaction(transactionId: string): boolean {
    return this.stateManager.isNestedTransaction(
      transactionId,
      this.activeTransactions,
    );
  }

  /**
   * 获取根事务ID
   * @param transactionId 事务ID
   * @returns 根事务ID
   */
  getRootTransactionId(transactionId: string): string | undefined {
    return this.stateManager.getRootTransactionId(
      transactionId,
      this.activeTransactions,
    );
  }

  /**
   * 清理已完成的事务
   * @param maxAge 最大保留时间（毫秒）
   */
  async cleanupCompletedTransactions(maxAge?: number): Promise<void> {
    await this.stateManager.cleanupCompletedTransactions(
      this.activeTransactions,
      this.queryRunners,
      maxAge,
    );
  }

  /**
   * 获取QueryRunner实例
   * @param transactionId 事务ID
   * @returns QueryRunner实例
   */
  getQueryRunner(transactionId: string): QueryRunner | undefined {
    return this.stateManager.getQueryRunner(transactionId, this.queryRunners);
  }

  /**
   * 删除集合的事务方法
   * @param collectionId 集合ID
   * @param collections 集合表操作对象
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
    return this.executor.deleteCollectionInTransaction(
      collectionId,
      collections,
      this.executeInTransaction.bind(this),
      this.executeOperation.bind(this),
      this.getQueryRunner.bind(this),
    );
  }
}
