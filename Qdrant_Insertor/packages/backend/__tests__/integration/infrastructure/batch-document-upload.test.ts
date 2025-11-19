/**
 * 批量文档上传测试
 * 测试批量文档上传、进度跟踪等功能
 */

import { DataSource } from 'typeorm';
import { Collection } from '@infrastructure/database/entities/Collection.js';
import { Doc } from '@infrastructure/database/entities/Doc.js';
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

describe('Batch Document Upload', () => {
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
        name: 'Batch Upload Test Collection',
      }),
    );
  });

  it('应该能够批量上传文档', async () => {
    // Arrange - 模拟Multer文件
    const mockFiles: Express.Multer.File[] = [
      {
        originalname: 'test1.txt',
        mimetype: 'text/plain',
        size: 100,
        buffer: Buffer.from('test content 1'),
      } as Express.Multer.File,
      {
        originalname: 'test2.txt',
        mimetype: 'text/plain',
        size: 200,
        buffer: Buffer.from('test content 2'),
      } as Express.Multer.File,
    ];

    mockCollectionService.listAllCollections.mockResolvedValue([
      testCollection,
    ]);
    mockCollectionService.getCollectionById.mockResolvedValue(testCollection);

    const mockDoc = { id: 'test-doc-id', collectionId: testCollection.id };
    mockImportService.importUploadedFile.mockResolvedValue(
      mockDoc as unknown as Doc,
    );

    mockStateMachineService.createBatchUploadTask.mockResolvedValue(undefined);
    mockStateMachineService.executeBatchUploadTask.mockResolvedValue(undefined);

    // Act
    const result = await batchService.batchUploadDocuments(
      mockFiles,
      testCollection.id as CollectionId,
    );

    // Assert
    expect(result.success).toBe(true);
    expect(result.successful).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.total).toBe(2);

    // 在测试环境中，批量上传使用同步处理，不会调用 importUploadedFile
    // 验证返回的结果包含正确的 docId 和 collectionId
    expect(result.results).toHaveLength(2);
    expect(result.results[0].docId).toBeDefined();
    expect(result.results[0].collectionId).toBe(testCollection.id);
  });

  it('应该处理部分失败的批量上传', async () => {
    // Arrange
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

    // Act
    const result = await batchService.batchUploadDocuments(
      documents as unknown as Express.Multer.File[],
      testCollection.id as CollectionId,
    );

    // Assert
    expect(result.success).toBe(false);
    expect(result.successful).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.total).toBe(3);
    const failedResult = result.results.find((r) => r.error);
    expect(failedResult?.error).toContain('is not supported');
  });
});
