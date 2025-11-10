import { randomUUID } from 'crypto';
import { CollectionId, DocId } from '@domain/entities/types.js';
import {
  ITransactionManager,
  Savepoint,
  TransactionContext,
  TransactionOperation,
  TransactionOperationType,
  TransactionStatus,
} from '@domain/repositories/ITransactionManager.js';
import { SQLiteRepoCore } from '@infrastructure/repositories/SQLiteRepositoryCore.js';
import { QdrantRepo } from '@infrastructure/repositories/QdrantRepository.js';
import { Logger } from '@logging/logger.js';

type InternalTransactionContext = TransactionContext & {
  completedAt?: number;
};

const DEFAULT_CLEANUP_MAX_AGE_MS = 30 * 60 * 1000;

export class TransactionManager implements ITransactionManager {
  private readonly activeTransactions = new Map<
    string,
    InternalTransactionContext
  >();

  constructor(
    private readonly sqliteCore: SQLiteRepoCore,
    private readonly qdrantRepo: QdrantRepo,
    private readonly logger: Logger,
  ) {}

  async beginTransaction(metadata?: Record<string, unknown>): Promise<TransactionContext> {
    const transactionId = randomUUID();
    const context: InternalTransactionContext = {
      transactionId,
      status: TransactionStatus.PENDING,
      operations: [],
      startTime: Date.now(),
      metadata,
      parentTransactionId: undefined,
      savepoints: new Map<string, Savepoint>(),
      nestingLevel: 0,
      isRootTransaction: true,
    };
    this.activeTransactions.set(transactionId, context);
    this.logger.info('Transaction started', { transactionId, metadata });
    return context;
  }

  async beginNestedTransaction(
    parentTransactionId: string,
    metadata?: Record<string, unknown>,
  ): Promise<TransactionContext> {
    const parent = this.getExistingTransaction(parentTransactionId);
    const transactionId = randomUUID();
    const context: InternalTransactionContext = {
      transactionId,
      status: TransactionStatus.PENDING,
      operations: [],
      startTime: Date.now(),
      metadata,
      parentTransactionId,
      savepoints: new Map<string, Savepoint>(),
      nestingLevel: parent.nestingLevel + 1,
      isRootTransaction: false,
    };
    this.activeTransactions.set(transactionId, context);
    this.logger.info('Nested transaction started', {
      transactionId,
      parentTransactionId,
      metadata,
    });
    return context;
  }

  async commit(transactionId: string): Promise<void> {
    const context = this.getExistingTransaction(transactionId);
    if (context.status !== TransactionStatus.ACTIVE) {
      throw new Error(`Transaction ${transactionId} is not active`);
    }

    this.logger.info('Committing SQLite transaction', { transactionId });
    await this.sqliteCore.transaction(async () => undefined);

    context.status = TransactionStatus.COMMITTED;
    context.completedAt = Date.now();
    this.logger.info('Transaction committed successfully', { transactionId });
  }

  async rollback(transactionId: string): Promise<void> {
    const context = this.getExistingTransaction(transactionId);
    if (context.status !== TransactionStatus.ACTIVE) {
      throw new Error(`Transaction ${transactionId} is not active`);
    }

    context.status = TransactionStatus.ROLLED_BACK;
    context.completedAt = Date.now();
    context.operations = [];
    context.savepoints.clear();
    this.logger.info('Transaction rolled back successfully', { transactionId });
  }

  async executeOperation(
    transactionId: string,
    operation: TransactionOperation,
  ): Promise<void> {
    const context = this.getExistingTransaction(transactionId);
    if (
      context.status !== TransactionStatus.PENDING &&
      context.status !== TransactionStatus.ACTIVE
    ) {
      throw new Error(
        `Transaction ${transactionId} is not in a valid state for operations`,
      );
    }

    if (context.status === TransactionStatus.PENDING) {
      context.status = TransactionStatus.ACTIVE;
    }

    context.operations.push({
      ...operation,
      timestamp: Date.now(),
    } as TransactionOperation & { timestamp: number });
  }

  async executeInTransaction<T>(
    fn: (context: TransactionContext) => Promise<T>,
    metadata?: Record<string, unknown>,
  ): Promise<T> {
    const context = await this.beginTransaction(metadata);
    try {
      const result = await fn(context);
      if (context.status === TransactionStatus.PENDING) {
        context.status = TransactionStatus.ACTIVE;
      }
      await this.commit(context.transactionId);
      return result;
    } catch (error) {
      try {
        await this.rollback(context.transactionId);
      } catch (rollbackError) {
        this.logger.error('Failed to rollback transaction', {
          transactionId: context.transactionId,
          error: (rollbackError as Error).message,
          originalError: (error as Error).message,
        });
      }
      throw error;
    }
  }

  async executeInNestedTransaction<T>(
    parentTransactionId: string,
    fn: (context: TransactionContext) => Promise<T>,
    metadata?: Record<string, unknown>,
  ): Promise<T> {
    const context = await this.beginNestedTransaction(parentTransactionId, metadata);
    try {
      const result = await fn(context);
      if (context.status === TransactionStatus.PENDING) {
        context.status = TransactionStatus.ACTIVE;
      }
      await this.commit(context.transactionId);
      return result;
    } catch (error) {
      try {
        await this.rollback(context.transactionId);
      } catch (rollbackError) {
        this.logger.error('Failed to rollback transaction', {
          transactionId: context.transactionId,
          error: (rollbackError as Error).message,
          originalError: (error as Error).message,
        });
      }
      throw error;
    }
  }

  getTransactionStatus(transactionId: string): TransactionContext | undefined {
    return this.activeTransactions.get(transactionId);
  }

  getActiveTransactions(): TransactionContext[] {
    return Array.from(this.activeTransactions.values());
  }

  createSavepoint(
    transactionId: string,
    name: string,
    metadata?: Record<string, unknown>,
  ): Promise<string> {
    const context = this.getExistingTransaction(transactionId);
    if (context.status !== TransactionStatus.ACTIVE) {
      throw new Error(
        `Transaction ${transactionId} is not in a valid state for savepoints`,
      );
    }

    const savepointId = randomUUID();
    const savepoint: Savepoint = {
      id: savepointId,
      name,
      transactionId,
      createdAt: Date.now(),
      operations: [...context.operations],
      metadata,
    };
    context.savepoints.set(savepointId, savepoint);
    return Promise.resolve(savepointId);
  }

  async rollbackToSavepoint(
    transactionId: string,
    savepointId: string,
  ): Promise<void> {
    const context = this.getExistingTransaction(transactionId);
    const savepoint = context.savepoints.get(savepointId);
    if (!savepoint) {
      throw new Error(`Savepoint ${savepointId} not found`);
    }
    context.operations = [...savepoint.operations];
  }

  async releaseSavepoint(
    transactionId: string,
    savepointId: string,
  ): Promise<void> {
    const context = this.getExistingTransaction(transactionId);
    context.savepoints.delete(savepointId);
  }

  getTransactionSavepoints(transactionId: string): Savepoint[] {
    const context = this.getExistingTransaction(transactionId);
    return Array.from(context.savepoints.values());
  }

  isNestedTransaction(transactionId: string): boolean {
    const context = this.getExistingTransaction(transactionId);
    return !context.isRootTransaction;
  }

  getRootTransactionId(transactionId: string): string | undefined {
    let current = this.getExistingTransaction(transactionId);
    while (current.parentTransactionId) {
      const parent = this.activeTransactions.get(current.parentTransactionId);
      if (!parent) {
        break;
      }
      current = parent;
    }
    return current.transactionId;
  }

  cleanupCompletedTransactions(
    maxAge: number = DEFAULT_CLEANUP_MAX_AGE_MS,
  ): void {
    const now = Date.now();
    let removed = 0;

    for (const [transactionId, context] of this.activeTransactions.entries()) {
      const isCompleted =
        context.status === TransactionStatus.COMMITTED ||
        context.status === TransactionStatus.ROLLED_BACK ||
        context.status === TransactionStatus.FAILED;
      if (isCompleted && context.startTime + maxAge <= now) {
        this.activeTransactions.delete(transactionId);
        removed += 1;
      }
    }

    if (removed > 0) {
      this.logger.info('Cleaned up completed transactions', { count: removed });
    }
  }

  async deleteCollectionInTransaction(
    collectionId: CollectionId,
    collectionsRepo: {
      getById: (id: CollectionId) => { collectionId: CollectionId } | undefined;
      delete: (id: CollectionId) => void;
      chunkMeta: { deleteByCollectionId: (id: CollectionId) => void };
      chunksFts5: { deleteByCollectionId: (id: CollectionId) => void };
      docs: {
        listByCollection: (id: CollectionId) => Array<{ docId: DocId }>;
        hardDelete: (id: DocId) => void;
      };
      listAll: () => unknown;
    },
  ): Promise<void> {
    const collection = collectionsRepo.getById(collectionId);
    if (!collection) {
      this.logger.warn('deleteCollection: no such collectionId', collectionId);
      return;
    }

    await this.executeInTransaction(async () => {
      collectionsRepo.chunkMeta.deleteByCollectionId(collectionId);
      collectionsRepo.chunksFts5.deleteByCollectionId(collectionId);

      const docs = collectionsRepo.docs.listByCollection(collectionId) ?? [];
      for (const doc of docs) {
        collectionsRepo.docs.hardDelete(doc.docId);
      }

      collectionsRepo.delete(collectionId);
      await this.qdrantRepo.deletePointsByCollection(collectionId);
    });

    this.logger.info(
      `Collection ${collectionId} and its associated data have been deleted.`,
    );
  }

  private getExistingTransaction(
    transactionId: string,
  ): InternalTransactionContext {
    const context = this.activeTransactions.get(transactionId);
    if (!context) {
      throw new Error(`Transaction ${transactionId} not found`);
    }
    return context;
  }
}
