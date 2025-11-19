import { DataSource } from 'typeorm';
import { Collection } from '@infrastructure/database/entities/Collection.js';
import { TypeORMTransactionManager } from '@infrastructure/transactions/TypeORMTransactionManager.js';
import {
  TransactionErrorHandler,
  TransactionError,
  TransactionErrorType,
} from '@infrastructure/transactions/TransactionErrorHandler.js';
import {
  initializeTestDatabase,
  resetTestDatabase,
  TestDataFactory,
  getTestLogger,
} from '../test-data-factory.js';

describe('Database & Transaction Error Handling', () => {
  let dataSource: DataSource;
  let transactionManager: TypeORMTransactionManager;
  let errorHandler: TransactionErrorHandler;

  beforeAll(async () => {
    dataSource = await initializeTestDatabase();

    transactionManager = new TypeORMTransactionManager(
      dataSource,
      {} as unknown as Record<string, never>,
      getTestLogger(),
    );

    errorHandler = new TransactionErrorHandler(getTestLogger(), dataSource);
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  describe('Database failure propagation', () => {
    it('classifies database connection loss', () => {
      const transactionError = errorHandler.handleError(
        new Error('Connection lost'),
        { transactionId: 'tx-connection' },
      );

      expect(transactionError.type).toBe(
        TransactionErrorType.DATABASE_CONNECTION_ERROR,
      );
    });

    it('classifies query timeouts', () => {
      const transactionError = errorHandler.handleError(
        new Error('Query timeout'),
        { transactionId: 'tx-timeout' },
      );

      expect(transactionError.type).toBe(TransactionErrorType.TIMEOUT_ERROR);
    });

    it('retries transient operations before succeeding', async () => {
      let attemptCount = 0;

      const result = await errorHandler.executeWithRetry(
        async () => {
          attemptCount++;
          if (attemptCount < 3) {
            throw new Error('Temporary failure');
          }
          return 'ok';
        },
        {
          maxRetries: 3,
          retryDelay: 10,
        },
      );

      expect(result).toBe('ok');
      expect(attemptCount).toBe(3);
    });
  });

  describe('Transaction safeguards', () => {
    it('rolls back state when a transactional operation fails', async () => {
      const repository = dataSource.getRepository(Collection);
      const name = 'Should Rollback';

      await expect(
        transactionManager.executeInTransaction(async () => {
          await repository.save(
            TestDataFactory.createCollection({
              name,
            }),
          );
          throw new Error('Intentional error for rollback test');
        }),
      ).rejects.toThrow('Intentional error for rollback test');

      const saved = await repository.findOne({
        where: { name },
      });
      expect(saved).toBeNull();
    });

    it('retries transactional operations via recovery helper', async () => {
      let attemptCount = 0;

      await errorHandler.executeWithTransactionRecovery(
        async () => {
          attemptCount++;
          if (attemptCount < 2) {
            throw new Error('Temporary transaction error');
          }
        },
        {
          maxRetries: 3,
          retryDelay: 5,
        },
      );

      expect(attemptCount).toBe(2);
    });

    it('classifies deadlock-like errors as operation failures', () => {
      const transactionError = errorHandler.handleError(
        new Error('Deadlock detected while locking rows'),
        {
          transactionId: 'tx-deadlock',
          operation: {
            type: 'CREATE',
            target: 'collection',
            targetId: 'deadlock-collection',
          },
        },
      );

      expect(transactionError).toBeInstanceOf(TransactionError);
      expect(transactionError.type).toBe(
        TransactionErrorType.OPERATION_EXECUTION_FAILED,
      );
    });
  });
});
