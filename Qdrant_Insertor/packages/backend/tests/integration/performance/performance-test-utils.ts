import { DataSource } from 'typeorm';
import { Collection } from '@infrastructure/database/entities/Collection.js';
import { TypeORMTransactionManager } from '@infrastructure/transactions/TypeORMTransactionManager.js';
import { SearchService } from '@application/services/core/SearchService.js';
import { BatchService } from '@application/services/batch/BatchService.js';
import {
  initializeTestDatabase,
  resetTestDatabase,
  TestDataFactory,
} from '../utils/test-data-factory.js';
import { getTestLogger } from '../setup.js';

export interface PerformanceSuiteContext {
  dataSource: DataSource;
  transactionManager: TypeORMTransactionManager;
  searchService: SearchService;
  batchService: BatchService;
  testCollection: Collection;
}

export const describePerformance: typeof describe =
  process.env.RUN_PERFORMANCE_TESTS === 'true' ? describe : describe.skip;

export function setupPerformanceSuite(): PerformanceSuiteContext {
  const context = {} as PerformanceSuiteContext;

  beforeAll(async () => {
    context.dataSource = await initializeTestDatabase();

    context.transactionManager = new TypeORMTransactionManager(
      context.dataSource,
      {} as any,
      getTestLogger(),
    );

    context.searchService = new SearchService(
      context.dataSource,
      {} as any,
      {} as any,
      getTestLogger(),
    );

    context.batchService = new BatchService(
      context.dataSource,
      {} as any,
      {} as any,
      getTestLogger(),
    );
  });

  beforeEach(async () => {
    await resetTestDatabase();

    const collectionRepository = context.dataSource.getRepository(Collection);
    context.testCollection = await collectionRepository.save(
      TestDataFactory.createCollection({
        name: 'Performance Test Collection',
      }),
    );
  });

  afterAll(async () => {
    await context.dataSource.destroy();
  });

  return context;
}
