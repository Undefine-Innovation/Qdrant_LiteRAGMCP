/**
 * 批量操作集成测试
 * 测试批量文档上传、删除等操作
 */

import { DataSource } from 'typeorm';
import { Collection } from '@infrastructure/database/entities/Collection.js';
import { Doc } from '@infrastructure/database/entities/Doc.js';
import { Chunk } from '@infrastructure/database/entities/Chunk.js';
import { ChunkMeta } from '@infrastructure/database/entities/ChunkMeta.js';
import { SyncJobEntity } from '@infrastructure/database/entities/SyncJob.js';
import { BatchService } from '@application/services/batch/BatchService.js';
import { IBatchService } from '@domain/repositories/IBatchService.js';
import { IImportService } from '@domain/repositories/IImportService.js';
import { ICollectionService } from '@domain/repositories/ICollectionService.js';
import { IDocumentService } from '@domain/repositories/IDocumentService.js';
import { StateMachineService } from '@application/services/state-machine/StateMachineService.js';
import { Logger } from '@logging/logger.js';
import {
  initializeTestDatabase,
  getTestDataSource,
  resetTestDatabase,
  TestDataFactory,
  TestAssertions,
} from '../utils/test-data-factory.js';
import { CollectionId, DocId, PointId } from '@domain/entities/types.js';

describe('Batch Operations Integration Tests', () => {
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

    // 创建模拟的导入服务
    mockImportService = {
      importDocument: jest.fn(),
      importUploadedFile: jest.fn(),
      batchImportDocuments: jest.fn(),
      getImportProgress: jest.fn(),
      cancelImport: jest.fn(),
    } as any;

    // 创建模拟的集合服务
    mockCollectionService = {
      createCollection: jest.fn(),
      getCollectionById: jest.fn(),
      listAllCollections: jest.fn(),
      deleteCollection: jest.fn(),
      updateCollection: jest.fn(),
    } as any;

    // 创建模拟的文档服务
    mockDocumentService = {
      createDocument: jest.fn(),
      getDocument: jest.fn(),
      deleteDocument: jest.fn(),
      updateDocument: jest.fn(),
      listDocuments: jest.fn(),
    } as any;

    // 创建模拟的状态机服务
    mockStateMachineService = {
      getTaskStatus: jest.fn(),
      createBatchUploadTask: jest.fn(),
      executeBatchUploadTask: jest.fn(),
      getTasksByStatus: jest.fn(),
      getBatchUploadTasks: jest.fn(),
    } as any;

    // 创建模拟的日志器
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      log: jest.fn(),
    } as any;

    // 创建批量服务
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

    // 创建测试集合
    const collectionRepository = dataSource.getRepository(Collection);
    testCollection = await collectionRepository.save(
      TestDataFactory.createCollection({
        name: 'Batch Test Collection',
      }),
    );
  });

  describe('Batch Document Upload', () => {
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

      // 设置集合服务mock
      mockCollectionService.listAllCollections.mockResolvedValue([testCollection]);
      mockCollectionService.getCollectionById.mockResolvedValue(testCollection);

      // 设置导入服务mock
      const mockDoc = { id: 'test-doc-id', collectionId: testCollection.id };
      mockImportService.importUploadedFile.mockResolvedValue(mockDoc as any);

      // 设置状态机服务mock
      mockStateMachineService.createBatchUploadTask.mockResolvedValue(undefined);
      mockStateMachineService.executeBatchUploadTask.mockResolvedValue(undefined);

      // Act
      const result = await batchService.batchUploadDocuments(
        mockFiles,
        testCollection.id as CollectionId,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.imported).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
      expect(result.total).toBe(3);

      // 验证数据库中的文档
      const docRepository = dataSource.getRepository(Doc);
      const savedDocs = await docRepository.find({
        where: { collectionId: testCollection.id as CollectionId },
      });
      expect(savedDocs).toHaveLength(3);

      expect(mockImportService.batchImportDocuments).toHaveBeenCalledWith(
        testCollection.id as CollectionId,
        documents,
      );
    });

    it('应该处理部分失败的批量上传', async () => {
      // Arrange
      const documents = [
        {
          name: 'Valid Document 1',
          content: 'Valid content 1',
          mime: 'text/plain',
        },
        {
          name: 'Invalid Document',
          content: '', // 无效内容
          mime: 'text/plain',
        },
        {
          name: 'Valid Document 2',
          content: 'Valid content 2',
          mime: 'text/plain',
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

      // Act
      const result = await batchService.batchUploadDocuments(
        testCollection.id as CollectionId,
        documents,
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.imported).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.total).toBe(3);
      expect(result.failed[0].error).toBe('Document content cannot be empty');
    });

    it('应该支持批量上传进度跟踪', async () => {
      // Arrange
      const documents = Array.from({ length: 100 }, (_, i) => ({
        name: `Document ${i}`,
        content: `Content for document ${i}`,
        mime: 'text/plain',
      }));

      const batchId = 'batch-123';

      // 模拟进度跟踪
      mockImportService.batchImportDocuments.mockImplementation(async () => {
        // 模拟长时间运行的批量操作
        for (let i = 0; i < 10; i++) {
          await new Promise((resolve) => setTimeout(resolve, 10));
          // 更新进度
          mockImportService.getImportProgress.mockResolvedValue({
            batchId,
            total: documents.length,
            processed: (i + 1) * 10,
            percentage: (i + 1) * 10,
            status: 'processing',
          });
        }

        return {
          success: true,
          imported: [],
          failed: [],
          total: documents.length,
        };
      });

      // Act
      const progressUpdates = [];
      const batchPromise = batchService.batchUploadDocuments(
        testCollection.id as CollectionId,
        documents,
        { batchId },
      );

      // 收集进度更新
      const progressInterval = setInterval(async () => {
        const progress = await batchService.getBatchProgress(batchId);
        if (progress) {
          progressUpdates.push(progress);
        }
      }, 5);

      try {
        await batchPromise;
      } finally {
        // 确保无论如何都会清理定时器
        clearInterval(progressInterval);
      }

      // Assert
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1].percentage).toBe(100);
      expect(progressUpdates[progressUpdates.length - 1].status).toBe(
        'completed',
      );
    });
  });

  describe('Batch Document Deletion', () => {
    beforeEach(async () => {
      // 创建测试文档
      const docRepository = dataSource.getRepository(Doc);
      const chunkRepository = dataSource.getRepository(Chunk);

      const docs = [
        TestDataFactory.createDoc({
          collectionId: testCollection.id as CollectionId,
          name: 'Document to Delete 1',
        }),
        TestDataFactory.createDoc({
          collectionId: testCollection.id as CollectionId,
          name: 'Document to Delete 2',
        }),
        TestDataFactory.createDoc({
          collectionId: testCollection.id as CollectionId,
          name: 'Document to Delete 3',
        }),
      ];

      const savedDocs = await docRepository.save(docs);

      // 为每个文档创建块
      for (const doc of savedDocs) {
        const chunk = TestDataFactory.createChunk({
          docId: doc.key as DocId,
          collectionId: testCollection.id as CollectionId,
        });
        await chunkRepository.save(chunk);
      }
    });

    it('应该能够批量删除文档', async () => {
      // Arrange
      const docRepository = dataSource.getRepository(Doc);
      const chunkRepository = dataSource.getRepository(Chunk);

      const docsToDelete = await docRepository.find({
        where: { collectionId: testCollection.id as CollectionId },
      });
      const docIds = docsToDelete.map((doc) => doc.key as DocId);

      mockQdrantRepo.deletePointsByDoc.mockResolvedValue(undefined);

      // Act
      const result = await batchService.batchDeleteDocuments(docIds);

      // Assert
      expect(result.success).toBe(true);
      expect(result.deleted).toHaveLength(3);
      expect(result.failed).toHaveLength(0);

      // 验证文档已删除
      const remainingDocs = await docRepository.find({
        where: { collectionId: testCollection.id as CollectionId },
      });
      expect(remainingDocs).toHaveLength(0);

      // 验证块已删除
      const remainingChunks = await chunkRepository.find({
        where: { collectionId: testCollection.id as CollectionId },
      });
      expect(remainingChunks).toHaveLength(0);

      // 验证Qdrant中的点已删除
      expect(mockQdrantRepo.deletePointsByDoc).toHaveBeenCalledTimes(3);
    });

    it('应该处理部分失败的批量删除', async () => {
      // Arrange
      const docRepository = dataSource.getRepository(Doc);

      const docsToDelete = await docRepository.find({
        where: { collectionId: testCollection.id as CollectionId },
      });
      const docIds = docsToDelete.map((doc) => doc.key as DocId);

      // 模拟第二个文档删除失败
      mockQdrantRepo.deletePointsByDoc
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Failed to delete points'))
        .mockResolvedValueOnce(undefined);

      // Act
      const result = await batchService.batchDeleteDocuments(docIds);

      // Assert
      expect(result.success).toBe(false);
      expect(result.deleted).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].docId).toBe(docIds[1]);
      expect(result.failed[0].error).toContain('Failed to delete points');
    });
  });

  describe('Batch Collection Operations', () => {
    let testCollections: Collection[];

    beforeEach(async () => {
      // 创建多个测试集合
      const collectionRepository = dataSource.getRepository(Collection);
      testCollections = await collectionRepository.save([
        TestDataFactory.createCollection({ name: 'Collection 1' }),
        TestDataFactory.createCollection({ name: 'Collection 2' }),
        TestDataFactory.createCollection({ name: 'Collection 3' }),
      ]);
    });

    it('应该能够批量删除集合', async () => {
      // Arrange
      const collectionRepository = dataSource.getRepository(Collection);
      const docRepository = dataSource.getRepository(Doc);
      const chunkRepository = dataSource.getRepository(Chunk);

      // 为每个集合创建文档和块
      for (const collection of testCollections) {
        const doc = TestDataFactory.createDoc({
          collectionId: collection.id as CollectionId,
          name: 'Test Document',
        });
        const savedDoc = await docRepository.save(doc);

        const chunk = TestDataFactory.createChunk({
          docId: savedDoc.key as DocId,
          collectionId: collection.id as CollectionId,
        });
        await chunkRepository.save(chunk);
      }

      const collectionIds = testCollections.map((c) => c.id as CollectionId);
      mockQdrantRepo.deletePointsByCollection.mockResolvedValue(undefined);

      // Act
      const result = await batchService.batchDeleteCollections(collectionIds);

      // Assert
      expect(result.success).toBe(true);
      expect(result.deleted).toHaveLength(3);
      expect(result.failed).toHaveLength(0);

      // 验证集合已删除
      const remainingCollections = await collectionRepository.find();
      expect(remainingCollections).toHaveLength(0);

      // 验证文档已删除
      const remainingDocs = await docRepository.find();
      expect(remainingDocs).toHaveLength(0);

      // 验证块已删除
      const remainingChunks = await chunkRepository.find();
      expect(remainingChunks).toHaveLength(0);

      // 验证Qdrant中的点已删除
      expect(mockQdrantRepo.deletePointsByCollection).toHaveBeenCalledTimes(3);
    });

    it('应该能够批量更新集合', async () => {
      // Arrange
      const collectionRepository = dataSource.getRepository(Collection);
      const collectionIds = testCollections.map((c) => c.id as CollectionId);
      const updateData = {
        description: 'Updated batch description',
      };

      // Act
      const result = await batchService.batchUpdateCollections(
        collectionIds,
        updateData,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.updated).toHaveLength(3);
      expect(result.failed).toHaveLength(0);

      // 验证集合已更新
      const updatedCollections = await collectionRepository.find({
        where: { id: collectionIds as any },
      });

      for (const collection of updatedCollections) {
        expect(collection.description).toBe('Updated batch description');
      }
    });
  });

  describe('Batch Chunk Operations', () => {
    beforeEach(async () => {
      // 创建测试文档和块
      const docRepository = dataSource.getRepository(Doc);
      const chunkRepository = dataSource.getRepository(Chunk);

      const doc = TestDataFactory.createDoc({
        collectionId: testCollection.id as CollectionId,
        name: 'Test Document',
      });
      const savedDoc = await docRepository.save(doc);

      const chunks = Array.from({ length: 10 }, (_, i) =>
        TestDataFactory.createChunk({
          docId: savedDoc.key as DocId,
          collectionId: testCollection.id as CollectionId,
          chunkIndex: i,
          title: `Chunk ${i}`,
          content: `Content for chunk ${i}`,
        }),
      );

      await chunkRepository.save(chunks);
    });

    it('应该能够批量创建块', async () => {
      // Arrange
      const chunkRepository = dataSource.getRepository(Chunk);
      const newChunks = Array.from({ length: 5 }, (_, i) => ({
        docId: 'new-doc' as DocId,
        collectionId: testCollection.id as CollectionId,
        chunkIndex: i,
        title: `New Chunk ${i}`,
        content: `Content for new chunk ${i}`,
      }));

      // Act
      const result = await batchService.batchCreateChunks(newChunks);

      // Assert
      expect(result.success).toBe(true);
      expect(result.created).toHaveLength(5);
      expect(result.failed).toHaveLength(0);

      // 验证块已创建
      const allChunks = await chunkRepository.find({
        where: { collectionId: testCollection.id as CollectionId },
      });
      expect(allChunks).toHaveLength(15); // 10个现有 + 5个新创建
    });

    it('应该能够批量更新块', async () => {
      // Arrange
      const chunkRepository = dataSource.getRepository(Chunk);
      const existingChunks = await chunkRepository.find({
        where: { collectionId: testCollection.id as CollectionId },
      });

      const chunkIds = existingChunks
        .slice(0, 5)
        .map((c) => c.pointId as PointId);
      const updateData = {
        title: 'Updated Chunk Title',
      };

      // Act
      const result = await batchService.batchUpdateChunks(chunkIds, updateData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.updated).toHaveLength(5);
      expect(result.failed).toHaveLength(0);

      // 验证块已更新
      const updatedChunks = await chunkRepository.find({
        where: { pointId: chunkIds as any },
      });

      for (const chunk of updatedChunks) {
        expect(chunk.title).toBe('Updated Chunk Title');
      }
    });

    it('应该能够批量删除块', async () => {
      // Arrange
      const chunkRepository = dataSource.getRepository(Chunk);
      const existingChunks = await chunkRepository.find({
        where: { collectionId: testCollection.id as CollectionId },
      });

      const chunkIds = existingChunks
        .slice(0, 5)
        .map((c) => c.pointId as PointId);
      mockQdrantRepo.deletePoints.mockResolvedValue(undefined);

      // Act
      const result = await batchService.batchDeleteChunks(chunkIds);

      // Assert
      expect(result.success).toBe(true);
      expect(result.deleted).toHaveLength(5);
      expect(result.failed).toHaveLength(0);

      // 验证块已删除
      const remainingChunks = await chunkRepository.find({
        where: { collectionId: testCollection.id as CollectionId },
      });
      expect(remainingChunks).toHaveLength(5); // 10个现有 - 5个删除

      // 验证Qdrant中的点已删除
      expect(mockQdrantRepo.deletePoints).toHaveBeenCalledWith(chunkIds);
    });
  });

  describe('Batch Sync Operations', () => {
    beforeEach(async () => {
      // 创建测试文档
      const docRepository = dataSource.getRepository(Doc);
      const syncJobRepository = dataSource.getRepository(SyncJobEntity);

      const docs = [
        TestDataFactory.createDoc({
          collectionId: testCollection.id as CollectionId,
          name: 'Document to Sync 1',
          status: 'new',
        }),
        TestDataFactory.createDoc({
          collectionId: testCollection.id as CollectionId,
          name: 'Document to Sync 2',
          status: 'new',
        }),
        TestDataFactory.createDoc({
          collectionId: testCollection.id as CollectionId,
          name: 'Document to Sync 3',
          status: 'new',
        }),
      ];

      const savedDocs = await docRepository.save(docs);

      // 为每个文档创建同步作业
      for (const doc of savedDocs) {
        const syncJob = TestDataFactory.createSyncJob({
          docId: doc.key as DocId,
          collectionId: testCollection.id as CollectionId,
          status: 'pending',
        });
        await syncJobRepository.save(syncJob);
      }
    });

    it('应该能够批量同步文档', async () => {
      // Arrange
      const syncJobRepository = dataSource.getRepository(SyncJobEntity);
      const pendingJobs = await syncJobRepository.find({
        where: { status: 'pending' },
      });

      const docIds = pendingJobs.map((job) => job.docId as DocId);

      // Act
      const result = await batchService.batchSyncDocuments(docIds);

      // Assert
      expect(result.success).toBe(true);
      expect(result.synced).toHaveLength(3);
      expect(result.failed).toHaveLength(0);

      // 验证同步作业状态已更新
      const updatedJobs = await syncJobRepository.find({
        where: { docId: docIds as any },
      });

      for (const job of updatedJobs) {
        expect(job.status).toBe('completed');
        expect(job.completedAt).toBeInstanceOf(Date);
      }
    });

    it('应该处理部分失败的同步', async () => {
      // Arrange
      const syncJobRepository = dataSource.getRepository(SyncJobEntity);
      const pendingJobs = await syncJobRepository.find({
        where: { status: 'pending' },
      });

      const docIds = pendingJobs.map((job) => job.docId as DocId);

      // 模拟第二个文档同步失败
      const syncError = new Error('Sync failed for document');

      // Act
      const result = await batchService.batchSyncDocuments(docIds, {
        simulateFailure: true,
        failureIndex: 1,
        error: syncError,
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.synced).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].docId).toBe(docIds[1]);
      expect(result.failed[0].error).toBe(syncError.message);

      // 验证同步作业状态
      const updatedJobs = await syncJobRepository.find({
        where: { docId: docIds as any },
      });

      expect(updatedJobs[0].status).toBe('completed');
      expect(updatedJobs[1].status).toBe('failed');
      expect(updatedJobs[1].error).toBe(syncError.message);
      expect(updatedJobs[2].status).toBe('completed');
    });
  });

  describe('Batch Performance', () => {
    it('应该能够高效处理大量批量操作', async () => {
      // Arrange
      const batchSize = 1000;
      const documents = Array.from({ length: batchSize }, (_, i) => ({
        name: `Performance Document ${i}`,
        content: `Content for performance document ${i}`,
        mime: 'text/plain',
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

      // Act
      const startTime = Date.now();
      const result = await batchService.batchUploadDocuments(
        testCollection.id as CollectionId,
        documents,
      );
      const endTime = Date.now();

      // Assert
      expect(result.success).toBe(true);
      expect(result.imported).toHaveLength(batchSize);

      const processingTime = endTime - startTime;
      console.log(`Processed ${batchSize} documents in ${processingTime}ms`);

      // 性能断言：处理1000个文档应该在合理时间内完成（例如30秒）
      expect(processingTime).toBeLessThan(30000);
    });

    it('应该支持批量操作的内存优化', async () => {
      // Arrange
      const batchSize = 10000;
      const documents = Array.from({ length: batchSize }, (_, i) => ({
        name: `Memory Test Document ${i}`,
        content: `Content for memory test document ${i}`,
        mime: 'text/plain',
      }));

      // 监控内存使用
      const initialMemory = process.memoryUsage();

      mockImportService.batchImportDocuments.mockResolvedValue({
        success: true,
        imported: [],
        failed: [],
        total: documents.length,
      });

      // Act
      await batchService.batchUploadDocuments(
        testCollection.id as CollectionId,
        documents,
        { batchSize: 1000 }, // 分批处理
      );

      const finalMemory = process.memoryUsage();

      // Assert
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      console.log(`Memory increase: ${memoryIncrease / 1024 / 1024}MB`);

      // 内存断言：内存增长应该在合理范围内（例如500MB）
      expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024);
    });
  });

  describe('Batch Error Handling', () => {
    it('应该处理批量操作中的部分失败', async () => {
      // Arrange
      const documents = [
        {
          name: 'Valid Document 1',
          content: 'Valid content 1',
          mime: 'text/plain',
        },
        {
          name: 'Invalid Document',
          content: '', // 无效内容
          mime: 'text/plain',
        },
        {
          name: 'Valid Document 2',
          content: 'Valid content 2',
          mime: 'text/plain',
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

      // Act
      const result = await batchService.batchUploadDocuments(
        testCollection.id as CollectionId,
        documents,
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.imported).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.total).toBe(3);

      // 验证错误信息
      expect(result.failed[0].index).toBe(1);
      expect(result.failed[0].error).toBe('Document content cannot be empty');
    });

    it('应该支持批量操作回滚', async () => {
      // Arrange
      const documents = [
        {
          name: 'Document 1',
          content: 'Content 1',
          mime: 'text/plain',
        },
        {
          name: 'Document 2',
          content: 'Content 2',
          mime: 'text/plain',
        },
      ];

      // 模拟第二个文档导入失败，需要回滚
      mockImportService.batchImportDocuments.mockImplementation(async () => {
        throw new Error('Batch operation failed, rolling back');
      });

      // Act & Assert
      await expect(
        batchService.batchUploadDocuments(
          testCollection.id as CollectionId,
          documents,
          { transactional: true },
        ),
      ).rejects.toThrow('Batch operation failed, rolling back');

      // 验证没有文档被保存
      const docRepository = dataSource.getRepository(Doc);
      const savedDocs = await docRepository.find({
        where: { collectionId: testCollection.id as CollectionId },
      });
      expect(savedDocs).toHaveLength(0);
    });
  });
});
