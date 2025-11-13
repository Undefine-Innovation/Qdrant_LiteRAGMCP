/**
 * 批量文档和集合删除测试
 * 测试批量删除文档、集合等功能
 */

import { DataSource } from 'typeorm';
import { Collection } from '@infrastructure/database/entities/Collection.js';
import { Doc } from '@infrastructure/database/entities/Doc.js';
import { Chunk } from '@infrastructure/database/entities/Chunk.js';
import { BatchService } from '@application/services/batch/BatchService.js';
import { IBatchService } from '@application/services/IBatchService.js';
import { IImportService } from '@application/services/IImportService.js';
import { ICollectionService } from '@application/services/ICollectionService.js';
import { IDocumentService } from '@application/services/IDocumentService.js';
import { StateMachineService } from '@application/services/state-machine/StateMachineService.js';
import { Logger } from '@logging/logger.js';
import {
  initializeTestDatabase,
  resetTestDatabase,
  TestDataFactory,
} from '../test-data-factory.js';
import { CollectionId, DocId, PointId } from '@domain/entities/types.js';

describe('Batch Document and Collection Deletion', () => {
  let dataSource: DataSource;
  let batchService: IBatchService;
  let mockImportService: jest.Mocked<IImportService>;
  let mockCollectionService: jest.Mocked<ICollectionService>;
  let mockDocumentService: jest.Mocked<IDocumentService>;
  let mockStateMachineService: jest.Mocked<StateMachineService>;
  let mockQdrantRepo: jest.Mocked<unknown>;
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

    mockQdrantRepo = {
      deletePointsByDoc: jest.fn(),
      deletePointsByCollection: jest.fn(),
      deletePoints: jest.fn(),
    };

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

    // 将mockQdrantRepo注入到全局作用域，以便BatchDeleteService可以访问
    (globalThis as any).__TEST_QDRANT_REPO = mockQdrantRepo;
  });

  beforeEach(async () => {
    await resetTestDatabase();
    jest.clearAllMocks();

    const collectionRepository = dataSource.getRepository(Collection);
    testCollection = await collectionRepository.save(
      TestDataFactory.createCollection({
        name: 'Batch Deletion Test Collection',
      }),
    );
  });

  describe('Batch Document Deletion', () => {
    beforeEach(async () => {
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

      for (const doc of savedDocs) {
        const chunk = TestDataFactory.createChunk({
          docId: doc.key as DocId,
          collectionId: testCollection.id as CollectionId,
        });
        await chunkRepository.save(chunk);
      }
    });

    it('应该能够批量删除文档', async () => {
      const docRepository = dataSource.getRepository(Doc);
      const chunkRepository = dataSource.getRepository(Chunk);

      const docsToDelete = await docRepository.find({
        where: { collectionId: testCollection.id as CollectionId },
      });
      const docIds = docsToDelete.map((doc) => doc.key as DocId);

      (mockQdrantRepo as unknown as any).deletePointsByDoc = jest
        .fn()
        .mockResolvedValue(undefined);

      // Act
      const result = await batchService.batchDeleteDocuments(docIds);

      // Assert
      expect(result.success).toBe(true);
      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);

      const remainingDocs = await docRepository.find({
        where: { collectionId: testCollection.id as CollectionId },
      });
      expect(remainingDocs).toHaveLength(0);

      const remainingChunks = await chunkRepository.find({
        where: { collectionId: testCollection.id as CollectionId },
      });
      expect(remainingChunks).toHaveLength(0);
    });

    it('应该处理部分失败的批量删除', async () => {
      const docRepository = dataSource.getRepository(Doc);

      const docsToDelete = await docRepository.find({
        where: { collectionId: testCollection.id as CollectionId },
      });
      const docIds = docsToDelete.map((doc) => doc.key as DocId);

      // 设置mockQdrantRepo的行为，模拟第二次调用失败
      (mockQdrantRepo as unknown as any).deletePointsByDoc = jest
        .fn()
        .mockImplementation((docId: string) => {
          // 根据docId决定成功或失败
          if (docId === docIds[1]) {
            return Promise.reject(new Error('Failed to delete points'));
          }
          return Promise.resolve(undefined);
        });

      // Act
      const result = await batchService.batchDeleteDocuments(docIds);

      // Assert
      expect(result.success).toBe(false);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(1);
      const failedResult = result.results.find((r) => r.error);
      expect(failedResult?.docId).toBe(docIds[1]);
      expect(failedResult?.error).toContain('Failed to delete points');
    });
  });

  describe('Batch Collection Deletion', () => {
    let testCollections: Collection[];

    beforeEach(async () => {
      const collectionRepository = dataSource.getRepository(Collection);
      testCollections = await collectionRepository.save([
        TestDataFactory.createCollection({ name: 'Collection 1' }),
        TestDataFactory.createCollection({ name: 'Collection 2' }),
        TestDataFactory.createCollection({ name: 'Collection 3' }),
      ]);
    });

    it('应该能够批量删除集合', async () => {
      const collectionRepository = dataSource.getRepository(Collection);
      const docRepository = dataSource.getRepository(Doc);
      const chunkRepository = dataSource.getRepository(Chunk);

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

      const collectionIds = [
        ...testCollections.map((c) => c.id as CollectionId),
        testCollection.id as CollectionId,
      ];
      (mockQdrantRepo as unknown as any).deletePointsByCollection = jest
        .fn()
        .mockResolvedValue(undefined);

      // Act
      const result = await batchService.batchDeleteCollections(collectionIds);

      // Assert
      expect(result.success).toBe(true);
      expect(result.successful).toBe(4);
      expect(result.failed).toBe(0);

      const remainingCollections = await collectionRepository.find();
      expect(remainingCollections).toHaveLength(0);

      const remainingDocs = await docRepository.find();
      expect(remainingDocs).toHaveLength(0);

      const remainingChunks = await chunkRepository.find();
      expect(remainingChunks).toHaveLength(0);
    });
  });

  describe('Batch Chunk Deletion', () => {
    beforeEach(async () => {
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

    it('应该能够批量删除块', async () => {
      const chunkRepository = dataSource.getRepository(Chunk);
      const existingChunks = await chunkRepository.find({
        where: { collectionId: testCollection.id as CollectionId },
      });

      const chunkIds = existingChunks
        .slice(0, 5)
        .map((c) => c.pointId as PointId);

      (mockQdrantRepo as unknown as any).deletePoints = jest
        .fn()
        .mockResolvedValue(undefined);

      // Act
      const result = await batchService.batchDeleteChunks(chunkIds);

      // Assert
      expect(result.success).toBe(true);
      expect(result.successful).toBe(5);
      expect(result.failed).toBe(0);

      const remainingChunks = await chunkRepository.find({
        where: { collectionId: testCollection.id as CollectionId },
      });
      expect(remainingChunks).toHaveLength(5);
    });
  });
});
