import { CollectionManagementService } from '../../../src/domain/services/CollectionManagementService.js';
import { CollectionAggregate } from '../../../src/domain/aggregates/CollectionAggregate.js';
import { DocumentAggregate } from '../../../src/domain/aggregates/DocumentAggregate.js';
import { IEventPublisher } from '../../../src/domain/events/IEventPublisher.js';
import { CollectionId, DocId } from '../../../src/domain/entities/types.js';

describe.skip('CollectionManagementService Immutability Tests', () => {
  let collectionId: CollectionId;
  let docId: DocId;
  let mockEventPublisher: jest.Mocked<IEventPublisher>;

  beforeEach(() => {
    collectionId = `collection_${Date.now()}` as CollectionId;
    docId = `doc_${Date.now()}` as DocId;

    mockEventPublisher = {
      publish: jest.fn(),
      publishBatch: jest.fn(),
    };
  });

  describe('Collection Creation', () => {
    it('should create collection with proper validation', async () => {
      const service = new CollectionManagementService(mockEventPublisher);

      const aggregate = await service.createCollection(
        'Test Collection',
        'Test Description',
      );

      expect(aggregate.name).toBe('Test Collection');
      expect(aggregate.description).toBe('Test Description');
      expect(aggregate.getDocumentCount()).toBe(0);

      // 验证事件发布
      expect(mockEventPublisher.publishBatch).toHaveBeenCalledTimes(1);
    });

    it('should validate collection name during creation', async () => {
      const service = new CollectionManagementService(mockEventPublisher);

      await expect(
        service.createCollection(''), // 空名称
      ).rejects.toThrow(
        'Invalid collection name: Collection name cannot be empty',
      );

      await expect(
        service.createCollection('a'.repeat(101)), // 超过长度限制
      ).rejects.toThrow(
        'Invalid collection name: Collection name cannot exceed 100 characters',
      );
    });

    it('should validate collection description during creation', async () => {
      const service = new CollectionManagementService(mockEventPublisher);

      await expect(
        service.createCollection('Valid Name', 'a'.repeat(1001)), // 超过描述长度限制
      ).rejects.toThrow('Collection description cannot exceed 1000 characters');
    });
  });

  describe('Collection Updates', () => {
    it('should update collection using immutable operations', async () => {
      const service = new CollectionManagementService(mockEventPublisher);
      const originalAggregate = CollectionAggregate.create(
        collectionId,
        'Original Name',
        'Original Description',
      );

      const updatedAggregate = await service.updateCollection(
        originalAggregate,
        'Updated Name',
        'Updated Description',
      );

      // 验证不可变性
      expect(originalAggregate).not.toBe(updatedAggregate);
      expect(originalAggregate.name).toBe('Original Name');
      expect(originalAggregate.description).toBe('Original Description');

      expect(updatedAggregate.name).toBe('Updated Name');
      expect(updatedAggregate.description).toBe('Updated Description');

      // 验证事件发布
      expect(mockEventPublisher.publishBatch).toHaveBeenCalledTimes(1);
    });

    it('should validate name during update', async () => {
      const service = new CollectionManagementService(mockEventPublisher);
      const aggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );

      await expect(
        service.updateCollection(aggregate, 'Invalid@Name'),
      ).rejects.toThrow(
        'Invalid collection name: Collection name can only contain letters, numbers, underscores, hyphens, and spaces',
      );
    });

    it('should only update changed properties', async () => {
      const service = new CollectionManagementService(mockEventPublisher);
      const originalAggregate = CollectionAggregate.create(
        collectionId,
        'Test Name',
        'Test Description',
      );

      // 只更新名称
      const nameUpdatedAggregate = await service.updateCollection(
        originalAggregate,
        'Updated Name',
      );

      expect(nameUpdatedAggregate.name).toBe('Updated Name');
      expect(nameUpdatedAggregate.description).toBe('Test Description');

      // 只更新描述
      const descUpdatedAggregate = await service.updateCollection(
        originalAggregate,
        undefined,
        'Updated Description',
      );

      expect(descUpdatedAggregate.name).toBe('Test Name');
      expect(descUpdatedAggregate.description).toBe('Updated Description');
    });
  });

  describe('Document Management', () => {
    it('should add document using immutable operations', async () => {
      const service = new CollectionManagementService(mockEventPublisher);
      const originalAggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );

      const documentAggregate = await service.addDocumentToCollection(
        originalAggregate,
        docId,
        'test-key',
        'Test document content',
        'Test Document',
        'text/plain',
      );

      // 验证文档聚合
      expect(documentAggregate.id).toBe(docId);
      expect(documentAggregate.key).toBe('test-key');
      expect(documentAggregate.contentValue).toBe('Test document content');

      // 验证事件发布
      expect(mockEventPublisher.publishBatch).toHaveBeenCalledTimes(2); // 集合事件 + 文档事件
    });

    it('should validate document key uniqueness', async () => {
      const service = new CollectionManagementService(mockEventPublisher);
      const aggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      ).withDocument(docId, 'test-key', 'content1');

      await expect(
        service.addDocumentToCollection(
          aggregate,
          `doc_${Date.now()}` as DocId,
          'test-key', // 重复的key
          'content2',
        ),
      ).rejects.toThrow(
        "Document with key 'test-key' already exists in collection",
      );
    });

    it('should validate document content', async () => {
      const service = new CollectionManagementService(mockEventPublisher);
      const aggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );

      await expect(
        service.addDocumentToCollection(
          aggregate,
          docId,
          'test-key',
          '', // 空内容
        ),
      ).rejects.toThrow(
        'Invalid document content: Document content cannot be empty',
      );
    });

    it('should remove document using immutable operations', async () => {
      const service = new CollectionManagementService(mockEventPublisher);
      const originalAggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      ).withDocument(docId, 'test-key', 'Test content');

      const result = await service.removeDocumentFromCollection(
        originalAggregate,
        docId,
      );

      expect(result).toBe(true);

      // 验证事件发布
      expect(mockEventPublisher.publishBatch).toHaveBeenCalledTimes(1);
    });

    it('should handle non-existent document removal', async () => {
      const service = new CollectionManagementService(mockEventPublisher);
      const aggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );

      const result = await service.removeDocumentFromCollection(
        aggregate,
        docId,
      );

      expect(result).toBe(false);
    });
  });

  describe('Collection Statistics', () => {
    it('should calculate correct statistics', () => {
      const service = new CollectionManagementService(mockEventPublisher);
      const aggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      ).withDocument(docId, 'test-key', 'Test content with some length');

      const stats = service.getCollectionStatistics(aggregate);

      expect(stats.documentCount).toBe(1);
      expect(stats.activeDocumentCount).toBe(1);
      expect(stats.completedDocumentCount).toBe(0);
      expect(stats.totalContentLength).toBeGreaterThan(0);
      expect(stats.averageDocumentSize).toBeGreaterThan(0);
    });

    it('should handle empty collection statistics', () => {
      const service = new CollectionManagementService(mockEventPublisher);
      const aggregate = CollectionAggregate.create(
        collectionId,
        'Empty Collection',
      );

      const stats = service.getCollectionStatistics(aggregate);

      expect(stats.documentCount).toBe(0);
      expect(stats.activeDocumentCount).toBe(0);
      expect(stats.completedDocumentCount).toBe(0);
      expect(stats.totalContentLength).toBe(0);
      expect(stats.averageDocumentSize).toBe(0);
    });
  });

  describe('Collection Deletion Validation', () => {
    it('should validate collection deletion rules', () => {
      const service = new CollectionManagementService(mockEventPublisher);

      // 空集合可以删除
      const emptyAggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );
      expect(service.canDeleteCollection(emptyAggregate)).toBe(true);

      // 有文档的集合不能删除
      const nonEmptyAggregate = emptyAggregate.withDocument(
        docId,
        'test-key',
        'content',
      );
      expect(service.canDeleteCollection(nonEmptyAggregate)).toBe(false);

      // 系统集合不能删除
      const systemAggregate = CollectionAggregate.create(
        collectionId,
        'system-test',
      );
      expect(service.canDeleteCollection(systemAggregate)).toBe(false);
    });
  });

  describe('Document Key Uniqueness', () => {
    it('should check document key uniqueness correctly', () => {
      const service = new CollectionManagementService(mockEventPublisher);
      const aggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      ).withDocument(docId, 'existing-key', 'content');

      // 检查存在的key
      expect(service.isDocumentKeyUnique(aggregate, 'existing-key')).toBe(
        false,
      );

      // 检查不存在的key
      expect(service.isDocumentKeyUnique(aggregate, 'new-key')).toBe(true);

      // 检查排除特定文档的情况
      expect(
        service.isDocumentKeyUnique(aggregate, 'existing-key', docId),
      ).toBe(true);
    });
  });

  describe('Error Handling and Event Publishing', () => {
    it('should not publish events when validation fails', async () => {
      const service = new CollectionManagementService(mockEventPublisher);
      const aggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );

      try {
        await service.addDocumentToCollection(
          aggregate,
          docId,
          'test-key',
          '', // 无效内容
        );
      } catch (error) {
        // 预期的错误
      }

      // 验证没有发布事件
      expect(mockEventPublisher.publishBatch).not.toHaveBeenCalled();
    });

    it('should publish events for successful operations', async () => {
      const service = new CollectionManagementService(mockEventPublisher);
      const aggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );

      // 成功的操作应该发布事件
      await service.createCollection('New Collection');
      expect(mockEventPublisher.publishBatch).toHaveBeenCalledTimes(1);

      mockEventPublisher.publishBatch.mockClear();

      const updatedAggregate = await service.updateCollection(
        aggregate,
        'Updated Name',
      );
      expect(mockEventPublisher.publishBatch).toHaveBeenCalledTimes(1);
    });
  });
});
