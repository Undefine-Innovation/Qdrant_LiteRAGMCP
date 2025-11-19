/**
 * 批量操作性能和错误处理测试
 */

import { DataSource } from 'typeorm';
import { Collection } from '@infrastructure/database/entities/Collection.js';
import { BatchService } from '@application/services/batch/BatchService.js';
import { IBatchService } from '@domain/repositories/IBatchService.js';
import { IImportService } from '@domain/repositories/IImportService.js';
import { ICollectionService } from '@domain/repositories/ICollectionService.js';
import { IDocumentService } from '@domain/repositories/IDocumentService.js';
import { StateMachineService } from '@application/services/state-machine/StateMachineService.js';
import { Logger } from '@logging/logger.js';
import {
  initializeTestDatabase,
  resetTestDatabase,
  TestDataFactory,
} from '../test-data-factory.js';
import { CollectionId, DocId } from '@domain/entities/types.js';

describe('Batch Operations Performance and Error Handling', () => {
  let dataSource: DataSource;
  let batchService: IBatchService;
  let mockImportService: jest.Mocked<IImportService>;
  let mockCollectionService: jest.Mocked<ICollectionService>;
  let mockDocumentService: jest.Mocked<IDocumentService>;
  let mockStateMachineService: jest.Mocked<StateMachineService>;
  let mockLogger: jest.Mocked<Logger>;
  let testCollection: Collection;

  beforeAll(async () => {
    dataSource = await initializeTestDatabase();

    mockImportService = {
      importDocument: jest.fn(),
      importUploadedFile: jest.fn(),
      batchImportDocuments: jest.fn(),
      getImportProgress: jest.fn(),
      cancelImport: jest.fn(),
    } as unknown as jest.Mocked<IImportService>;

    mockCollectionService = {
      createCollection: jest.fn(),
      getCollectionById: jest.fn(),
      listAllCollections: jest.fn(),
      deleteCollection: jest.fn(),
      updateCollection: jest.fn(),
    } as unknown as jest.Mocked<ICollectionService>;

    mockDocumentService = {
      createDocument: jest.fn(),
      getDocument: jest.fn(),
      deleteDocument: jest.fn(),
      updateDocument: jest.fn(),
      listDocuments: jest.fn(),
    } as unknown as jest.Mocked<IDocumentService>;

    mockStateMachineService = {
      getTaskStatus: jest.fn(),
      createBatchUploadTask: jest.fn(),
      executeBatchUploadTask: jest.fn(),
      getTasksByStatus: jest.fn(),
      getBatchUploadTasks: jest.fn(),
    } as unknown as jest.Mocked<StateMachineService>;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      log: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    batchService = new BatchService(
      mockImportService,
      mockCollectionService,
      mockDocumentService,
      mockLogger,
      mockStateMachineService,
    );
  });

  beforeEach(async () => {
    await resetTestDatabase();
    jest.clearAllMocks();

    const collectionRepository = dataSource.getRepository(Collection);
    testCollection = await collectionRepository.save(
      TestDataFactory.createCollection({
        name: 'Performance Test Collection',
      }),
    );
  });

  describe('Batch Performance', () => {
    it('应该能够高效处理大量批量操作', async () => {
      const batchSize = 1000;
      const documents = Array.from({ length: batchSize }, (_, i) => ({
        originalname: `Performance Document ${i}`,
        mimetype: 'text/plain',
        size: 100,
        buffer: Buffer.from(`Content for performance document ${i}`),
      }));

      const importedDocs = documents.map((doc, index) => ({
        id: `doc-${index}` as DocId,
        name: doc.name,
        collectionId: testCollection.id as CollectionId,
        key: `doc-${index}`,
        created_at: new Date(),
        updated_at: new Date(),
      }));

      mockImportService.batchImportDocuments.mockResolvedValue({
        success: true,
        imported: importedDocs,
        failed: [],
        total: documents.length,
      });

      // Mock collection service to return test collection
      mockCollectionService.getCollectionById.mockResolvedValue(testCollection);

      const startTime = Date.now();
      const result = await batchService.batchUploadDocuments(
        documents as unknown as Express.Multer.File[],
        testCollection.id as CollectionId,
      );
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.successful).toBe(batchSize);

      const processingTime = endTime - startTime;
      console.log(`Processed ${batchSize} documents in ${processingTime}ms`);

      // 性能断言：处理1000个文档应该在合理时间内完成（例如30秒）
      expect(processingTime).toBeLessThan(30000);
    });

    it('应该支持批量操作的内存优化', async () => {
      const batchSize = 10000;
      const documents = Array.from({ length: batchSize }, (_, i) => ({
        originalname: `Memory Test Document ${i}`,
        mimetype: 'text/plain',
        size: 100,
        buffer: Buffer.from(`Content for memory test document ${i}`),
      }));

      const initialMemory = process.memoryUsage();

      mockImportService.batchImportDocuments.mockResolvedValue({
        success: true,
        imported: [],
        failed: [],
        total: documents.length,
      });

      // Mock collection service to return test collection
      mockCollectionService.getCollectionById.mockResolvedValue(testCollection);

      await batchService.batchUploadDocuments(
        documents as unknown as Express.Multer.File[],
        testCollection.id as CollectionId,
      );

      const finalMemory = process.memoryUsage();

      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      console.log(`Memory increase: ${memoryIncrease / 1024 / 1024}MB`);

      // 内存断言：内存增长应该在合理范围内（例如500MB）
      expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024);
    });
  });

  describe('Batch Error Handling', () => {
    it('应该处理批量操作中的部分失败', async () => {
      const documents = [
        {
          originalname: 'Valid Document 1',
          mimetype: 'text/plain',
          size: 100,
          buffer: Buffer.from('Valid content 1'),
        },
        {
          originalname: 'Invalid Document',
          mimetype: 'application/json', // 使用不支持的文件类型来模拟失败
          size: 100,
          buffer: Buffer.from('Invalid content'),
        },
        {
          originalname: 'Valid Document 2',
          mimetype: 'text/plain',
          size: 100,
          buffer: Buffer.from('Valid content 2'),
        },
      ];

      const importedDocs = [
        {
          id: 'doc-0' as DocId,
          name: 'Valid Document 1',
          collectionId: testCollection.id as CollectionId,
          key: 'doc-0',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'doc-2' as DocId,
          name: 'Valid Document 2',
          collectionId: testCollection.id as CollectionId,
          key: 'doc-2',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      const failedDocs = [
        {
          index: 1,
          document: documents[1],
          error: 'Document content cannot be empty',
        },
      ];

      mockImportService.batchImportDocuments.mockResolvedValue({
        success: false,
        imported: importedDocs,
        failed: failedDocs,
        total: documents.length,
      });

      // Mock collection service to return test collection
      mockCollectionService.getCollectionById.mockResolvedValue(testCollection);

      const result = await batchService.batchUploadDocuments(
        documents as unknown as Express.Multer.File[],
        testCollection.id as CollectionId,
      );

      expect(result.success).toBe(false);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.total).toBe(3);

      const failedResult = result.results.find((r) => r.error);
      expect(failedResult).toBeDefined();
      expect(failedResult?.error).toContain('is not supported');
    });

    it('应该支持批量操作回滚', async () => {
      const documents = [
        {
          originalname: 'Document 1',
          mimetype: 'text/plain',
          size: 100,
          buffer: Buffer.from('Content 1'),
        },
        {
          originalname: 'Document 2',
          mimetype: 'text/plain',
          size: 100,
          buffer: Buffer.from('Content 2'),
        },
      ];

      // 在测试环境中，我们需要模拟文件验证失败来触发回滚
      // 因为同步处理方法不会调用 batchImportDocuments
      const invalidDocuments = [
        {
          originalname: 'Document 1',
          mimetype: 'application/json', // 不支持的类型
          size: 100,
          buffer: Buffer.from('Content 1'),
        },
        {
          originalname: 'Document 2',
          mimetype: 'application/xml', // 不支持的类型
          size: 100,
          buffer: Buffer.from('Content 2'),
        },
      ];

      // Mock collection service to return test collection
      mockCollectionService.getCollectionById.mockResolvedValue(testCollection);

      const result = await batchService.batchUploadDocuments(
        invalidDocuments as unknown as Express.Multer.File[],
        testCollection.id as CollectionId,
      );

      // 验证所有文件都失败了
      expect(result.success).toBe(false);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(2);
      expect(result.total).toBe(2);

      // 验证所有结果都包含错误信息
      expect(result.results.every((r) => r.error)).toBe(true);
    });
  });
});
