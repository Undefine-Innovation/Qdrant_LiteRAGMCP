import { jest } from '@jest/globals';
import { DataSource } from 'typeorm';
import { TransactionErrorHandler } from '@infrastructure/transactions/TransactionErrorHandler.js';
import { ErrorClassifier } from '@domain/sync/ErrorClassifier.js';
import { RetryScheduler } from '@domain/sync/RetryScheduler.js';
import { ErrorCategory, DEFAULT_RETRY_STRATEGY } from '@domain/sync/retry.js';
import {
  initializeTestDatabase,
  resetTestDatabase,
  getTestLogger,
} from '../test-data-factory.js';

describe('Sync Jobs & Monitoring', () => {
  let dataSource: DataSource;
  let errorHandler: TransactionErrorHandler;
  let errorClassifier: ErrorClassifier;

  beforeAll(async () => {
    dataSource = await initializeTestDatabase();
    errorHandler = new TransactionErrorHandler(getTestLogger(), dataSource);
    errorClassifier = new ErrorClassifier();
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  describe('Error classification', () => {
    it('classifies sync failures and selects retry strategies', () => {
      const timeoutError = new Error('database timeout');
      const connectionError = new Error('connection refused');

      const timeoutCategory = errorClassifier.classify(timeoutError);
      const connectionCategory = errorClassifier.classify(connectionError);

      expect(timeoutCategory).toBe(ErrorCategory.NETWORK_TIMEOUT);
      expect(connectionCategory).toBe(ErrorCategory.NETWORK_CONNECTION);

      const timeoutStrategy = errorClassifier.getRetryStrategy(timeoutError);
      const connectionStrategy =
        errorClassifier.getRetryStrategy(connectionError);

      expect(timeoutStrategy.maxRetries).toBeGreaterThan(0);
      expect(connectionStrategy.initialDelayMs).toBeGreaterThan(0);
    });
  });

  describe('Retry scheduler', () => {
    let retryScheduler: RetryScheduler;

    beforeEach(() => {
      jest.useFakeTimers();
      retryScheduler = new RetryScheduler(getTestLogger());
    });

    afterEach(async () => {
      await jest.runOnlyPendingTimersAsync();
      jest.useRealTimers();
    });

    it('schedules and executes retry callbacks', async () => {
      const callback = jest.fn().mockResolvedValue(undefined);
      retryScheduler.scheduleRetry(
        'doc-1',
        new Error('timeout'),
        ErrorCategory.DATABASE_TIMEOUT,
        1,
        DEFAULT_RETRY_STRATEGY,
        callback,
      );

      expect(retryScheduler.getActiveTaskCount()).toBe(1);

      await jest.runOnlyPendingTimersAsync();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(retryScheduler.getActiveTaskCount()).toBe(0);
    });

    it('cancels retries for a given document', () => {
      const callback = jest.fn().mockResolvedValue(undefined);
      const taskId = retryScheduler.scheduleRetry(
        'doc-cancel',
        new Error('temporary failure'),
        ErrorCategory.DATABASE_CONNECTION,
        1,
        DEFAULT_RETRY_STRATEGY,
        callback,
      );

      const cancelled = retryScheduler.cancelRetry(taskId);
      expect(cancelled).toBe(true);
      expect(retryScheduler.getActiveTaskCount()).toBe(0);
    });
  });

  describe('Recovery helpers', () => {
    it('handles partial failures in batch operations', async () => {
      const results = await errorHandler.executeBatchWithRecovery(
        [
          async () => 'ok-1',
          async () => {
            throw new Error('boom');
          },
          async () => 'ok-2',
        ],
        {
          continueOnError: true,
          maxFailures: 1,
        },
      );

      expect(results.total).toBe(3);
      expect(results.successful).toBe(2);
      expect(results.failed).toBe(1);
      expect(results.results[1]).toBeInstanceOf(Error);
    });

    it('opens the circuit breaker after repeated failures', async () => {
      const circuitBreaker = errorHandler.createCircuitBreaker({
        failureThreshold: 2,
        timeout: 1000,
      });

      const failingOperation = jest
        .fn()
        .mockRejectedValue(new Error('Service unavailable'));

      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow(
        'Circuit breaker is open',
      );
      expect(circuitBreaker.isOpen()).toBe(true);
    });

    it('falls back when primary operation fails', async () => {
      const result = await errorHandler.executeWithFallback(
        async () => {
          throw new Error('Primary unavailable');
        },
        async () => ({ source: 'fallback', success: true }),
      );

      expect(result.success).toBe(true);
      expect(result.source).toBe('fallback');
    });
  });

  describe('Logging & monitoring', () => {
    it('logs errors and generates reports', async () => {
      await errorHandler.logError(new Error('validation failed'), {
        type: 'validation',
      });
      await errorHandler.logError(new Error('database timeout'), {
        type: 'database',
      });

      const report = await errorHandler.generateErrorReport({
        startTime: new Date(Date.now() - 1000),
        endTime: new Date(Date.now() + 1000),
      });

      expect(report.totalErrors).toBe(2);
      expect(report.errorTypes.Error).toBe(2);
    });
    it('calculates error rates based on aggregated metrics', async () => {
      const metrics = [
        { metric_value: 90, tags: JSON.stringify({ status: 'success' }) },
        { metric_value: 10, tags: JSON.stringify({ status: 'error' }) },
      ];

      const fakeQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(metrics),
      };

      const fakeRepository = {
        createQueryBuilder: jest.fn().mockReturnValue(fakeQueryBuilder),
      };

      const fakeDataSource = {
        getRepository: jest.fn().mockReturnValue(fakeRepository),
      } as unknown as DataSource;

      const handler = new TransactionErrorHandler(
        getTestLogger(),
        fakeDataSource,
      );

      const errorRate = await handler.calculateErrorRate({
        timeWindow: 60 * 60 * 1000,
      });

      expect(errorRate).toBeCloseTo(0.1, 3);
    });
  });
});
