import { CollectionAggregate } from '../../../src/domain/aggregates/CollectionAggregate.js';
import { Doc } from '../../../src/domain/entities/Doc.js';
import {
  Collection,
  CollectionId,
  DocId,
} from '../../../src/domain/entities/types.js';
import {
  CollectionCreatedEvent,
  CollectionUpdatedEvent,
  DocumentAddedToCollectionEvent,
  DocumentRemovedFromCollectionEvent,
} from '../../../src/domain/events/DomainEvents.js';

describe('CollectionAggregate Immutability Tests', () => {
  let collectionId: CollectionId;
  let docId1: DocId;
  let docId2: DocId;

  beforeEach(() => {
    collectionId = `collection_${Date.now()}` as CollectionId;
    docId1 = `doc_${Date.now()}_1` as DocId;
    docId2 = `doc_${Date.now()}_2` as DocId;
  });

  describe('Aggregate Creation', () => {
    it('should create a new collection aggregate with proper immutability', () => {
      const aggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
        'Test Description',
      );

      expect(aggregate.id).toBe(collectionId);
      expect(aggregate.name).toBe('Test Collection');
      expect(aggregate.description).toBe('Test Description');
      expect(aggregate.getDocumentCount()).toBe(0);

      // 验证领域事件
      const events = aggregate.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(CollectionCreatedEvent);
    });

    it('should reconstitute collection aggregate from existing data', () => {
      const doc = Doc.create(docId1, collectionId, 'test-key', 'test content');
      const aggregate = CollectionAggregate.reconstitute(
        {
          id: collectionId,
          name: 'Test Collection',
          description: 'Test Description',
          createdAt: Date.now() - 1000,
          updatedAt: Date.now() - 500,
          validate: () => ({ isValid: true, errors: [] }),
          updateDescription: () => {},
          updateName: () => {},
          isNameMatch: () => true,
          hasNamePrefix: () => false,
          hasNameSuffix: () => false,
          getDisplayName: () => 'Test Collection',
          getNormalizedName: () => 'test-collection',
          isSystemCollection: () => false,
          canBeDeleted: () => true,
          toObject: () => ({}) as any,
          equals: () => true,
        } as any,
        [doc],
      );

      expect(aggregate.id).toBe(collectionId);
      expect(aggregate.getDocumentCount()).toBe(1);
      expect(aggregate.hasDocument(docId1)).toBe(true);
    });
  });

  describe('Immutability - withDescription', () => {
    it('should create new aggregate instance when updating description', () => {
      const originalAggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
        'Original Description',
      );

      const updatedAggregate = originalAggregate.withDescription(
        'Updated Description',
      );

      // 验证不可变性
      expect(originalAggregate).not.toBe(updatedAggregate);
      expect(originalAggregate.description).toBe('Original Description');
      expect(updatedAggregate.description).toBe('Updated Description');

      // 验证其他属性保持不变
      expect(originalAggregate.id).toBe(updatedAggregate.id);
      expect(originalAggregate.name).toBe(updatedAggregate.name);
      expect(originalAggregate.getDocumentCount()).toBe(
        updatedAggregate.getDocumentCount(),
      );

      // 验证领域事件
      const events = updatedAggregate.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(CollectionUpdatedEvent);
    });

    it('should validate description when updating', () => {
      const aggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );

      expect(() => {
        aggregate.withDescription('a'.repeat(1001)); // 超过1000字符限制
      }).toThrow(
        'Invalid description: Collection description cannot exceed 1000 characters',
      );
    });
  });

  describe('Immutability - withName', () => {
    it('should create new aggregate instance when updating name', () => {
      const originalAggregate = CollectionAggregate.create(
        collectionId,
        'Original Name',
        'Test Description',
      );

      const updatedAggregate = originalAggregate.withName('Updated Name');

      // 验证不可变性
      expect(originalAggregate).not.toBe(updatedAggregate);
      expect(originalAggregate.name).toBe('Original Name');
      expect(updatedAggregate.name).toBe('Updated Name');

      // 验证其他属性保持不变
      expect(originalAggregate.id).toBe(updatedAggregate.id);
      expect(originalAggregate.description).toBe(updatedAggregate.description);
      expect(originalAggregate.getDocumentCount()).toBe(
        updatedAggregate.getDocumentCount(),
      );

      // 验证领域事件
      const events = updatedAggregate.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(CollectionUpdatedEvent);
    });

    it('should validate name when updating', () => {
      const aggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );

      expect(() => {
        aggregate.withName(''); // 空名称
      }).toThrow('Invalid name: Collection name cannot be empty');

      expect(() => {
        aggregate.withName('a'.repeat(101)); // 超过100字符限制
      }).toThrow('Invalid name: Collection name cannot exceed 100 characters');

      expect(() => {
        aggregate.withName('Invalid@Name'); // 包含无效字符
      }).toThrow(
        'Invalid name: Collection name can only contain letters (including Unicode), numbers, underscores, hyphens, and dots, Collection name can only contain letters, numbers, underscores, hyphens, and spaces',
      );
    });
  });

  describe('Immutability - withDocument', () => {
    it('should create new aggregate instance when adding document', () => {
      const originalAggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );
      const content = 'Test document content';

      const updatedAggregate = originalAggregate.withDocument(
        docId1,
        'test-key',
        content,
        'Test Document',
        'text/plain',
      );

      // 验证不可变性
      expect(originalAggregate).not.toBe(updatedAggregate);
      expect(originalAggregate.getDocumentCount()).toBe(0);
      expect(updatedAggregate.getDocumentCount()).toBe(1);

      // 验证文档被正确添加
      expect(updatedAggregate.hasDocument(docId1)).toBe(true);
      expect(updatedAggregate.hasDocumentWithKey('test-key')).toBe(true);

      const addedDoc = updatedAggregate.getDocument(docId1);
      expect(addedDoc).toBeDefined();
      expect(addedDoc?.key).toBe('test-key');
      expect(addedDoc?.contentValue).toBe(content);

      // 验证领域事件
      const events = updatedAggregate.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(DocumentAddedToCollectionEvent);
    });

    it('should validate document key uniqueness when adding', () => {
      const aggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      ).withDocument(docId1, 'test-key', 'content1');

      expect(() => {
        aggregate.withDocument(docId2, 'test-key', 'content2'); // 重复的key
      }).toThrow("Document with key 'test-key' already exists in collection");
    });

    it('should validate document content when adding', () => {
      const aggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );

      expect(() => {
        aggregate.withDocument(docId1, 'test-key', ''); // 空内容
      }).toThrow(
        'Invalid document content: Document content must be at least 1 character long',
      );
    });
  });

  describe('Immutability - withoutDocument', () => {
    it('should create new aggregate instance when removing document', () => {
      const originalAggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      ).withDocument(docId1, 'test-key', 'Test content');

      const updatedAggregate = originalAggregate.withoutDocument(docId1);

      // 验证不可变性
      expect(originalAggregate).not.toBe(updatedAggregate);
      expect(originalAggregate.getDocumentCount()).toBe(1);
      expect(updatedAggregate.getDocumentCount()).toBe(0);

      // 验证文档被正确移除
      expect(originalAggregate.hasDocument(docId1)).toBe(true);
      expect(updatedAggregate.hasDocument(docId1)).toBe(false);

      // 验证领域事件
      const events = updatedAggregate.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(DocumentRemovedFromCollectionEvent);
    });

    it('should throw error when removing non-existent document', () => {
      const aggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );

      expect(() => {
        aggregate.withoutDocument(docId1);
      }).toThrow(`Document ${docId1} not found in collection`);
    });

    it('should throw error when removing document that cannot be deleted', () => {
      const doc = Doc.create(docId1, collectionId, 'test-key', 'content');
      // 模拟文档不能被删除的情况
      (doc as any)._isDeleted = true;

      const aggregate = CollectionAggregate.reconstitute(
        {
          id: collectionId,
          name: 'Test Collection',
          validate: () => ({ isValid: true, errors: [] }),
          updateDescription: () => {},
          updateName: () => {},
          isNameMatch: () => true,
          hasNamePrefix: () => false,
          hasNameSuffix: () => false,
          getDisplayName: () => 'Test Collection',
          getNormalizedName: () => 'test-collection',
          isSystemCollection: () => false,
          canBeDeleted: () => true,
          toObject: () => ({}) as any,
          equals: () => true,
        } as any,
        [doc],
      );

      expect(() => {
        aggregate.withoutDocument(docId1);
      }).toThrow(`Document ${docId1} cannot be deleted`);
    });
  });

  describe('Business Invariants Validation', () => {
    it('should enforce document key uniqueness invariant', () => {
      const aggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      ).withDocument(docId1, 'unique-key', 'content1');

      const validation = aggregate.validate();
      expect(validation.isValid).toBe(true);

      // 尝试创建重复key的聚合（这应该在withDocument中被阻止）
      expect(() => {
        aggregate.withDocument(docId2, 'unique-key', 'content2');
      }).toThrow();
    });

    it('should enforce maximum documents per collection invariant', () => {
      let aggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );

      // 添加10000个文档（达到限制）
      for (let i = 0; i < 10000; i++) {
        const docId = `doc_${i}` as DocId;
        aggregate = aggregate.withDocument(docId, `key-${i}`, `content ${i}`);
      }

      const validation = aggregate.validate();
      expect(validation.isValid).toBe(true);

      // 尝试添加第10001个文档（这应该失败）
      expect(() => {
        aggregate.withDocument(
          `doc_10000` as DocId,
          'key-10000',
          'content 10000',
        );
      }).toThrow('Collection cannot contain more than 10000 documents');
    });

    it('should enforce system collection invariants', () => {
      const systemAggregate = CollectionAggregate.create(
        collectionId,
        'system-test-collection',
        'System collection',
      );

      // 系统集合不应该包含文档
      expect(() => {
        systemAggregate.withDocument(docId1, 'test-key', 'content');
      }).toThrow('System collections cannot contain documents');
    });

    it('should enforce document belongs to collection invariant', () => {
      const doc = Doc.create(
        docId1,
        'other-collection' as CollectionId,
        'test-key',
        'content',
      );

      const aggregate = CollectionAggregate.reconstitute(
        {
          id: collectionId,
          name: 'Test Collection',
          validate: () => ({ isValid: true, errors: [] }),
          updateDescription: () => {},
          updateName: () => {},
          isNameMatch: () => true,
          hasNamePrefix: () => false,
          hasNameSuffix: () => false,
          getDisplayName: () => 'Test Collection',
          getNormalizedName: () => 'test-collection',
          isSystemCollection: () => false,
          canBeDeleted: () => true,
          toObject: () => ({}),
          equals: () => true,
        } as Collection,
        [doc],
      );

      const validation = aggregate.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        `Document ${docId1} does not belong to collection ${collectionId}`,
      );
    });
  });

  describe('Aggregate State Consistency', () => {
    it('should maintain consistency across multiple operations', () => {
      let aggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
        'Original Description',
      );

      // 执行一系列不可变操作
      aggregate = aggregate.withDescription('Updated Description');
      aggregate = aggregate.withName('Updated Name');
      aggregate = aggregate.withDocument(docId1, 'key1', 'content1');
      aggregate = aggregate.withDocument(docId2, 'key2', 'content2');

      // 验证最终状态
      expect(aggregate.name).toBe('Updated Name');
      expect(aggregate.description).toBe('Updated Description');
      expect(aggregate.getDocumentCount()).toBe(2);
      expect(aggregate.hasDocument(docId1)).toBe(true);
      expect(aggregate.hasDocument(docId2)).toBe(true);

      // 验证所有领域事件都被正确记录
      const events = aggregate.getDomainEvents();
      expect(events).toHaveLength(1); // 只有最后一个操作的事件被保留
    });

    it('should preserve original aggregate when operations fail', () => {
      const originalAggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
        'Original Description',
      );

      // 尝试无效操作
      expect(() => {
        originalAggregate.withName(''); // 无效名称
      }).toThrow();

      // 验证原始聚合未被修改
      expect(originalAggregate.name).toBe('Test Collection');
      expect(originalAggregate.description).toBe('Original Description');
      expect(originalAggregate.getDocumentCount()).toBe(0);
    });
  });

  describe('Event Generation', () => {
    it('should generate correct events for all operations', () => {
      let aggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );

      // 清除创建事件
      aggregate.clearDomainEvents();

      // 更新名称
      aggregate = aggregate.withName('New Name');
      let events = aggregate.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(CollectionUpdatedEvent);

      // 更新描述
      aggregate.clearDomainEvents();
      aggregate = aggregate.withDescription('New Description');
      events = aggregate.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(CollectionUpdatedEvent);

      // 添加文档
      aggregate.clearDomainEvents();
      aggregate = aggregate.withDocument(docId1, 'test-key', 'content');
      events = aggregate.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(DocumentAddedToCollectionEvent);

      // 移除文档
      aggregate.clearDomainEvents();
      aggregate = aggregate.withoutDocument(docId1);
      events = aggregate.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(DocumentRemovedFromCollectionEvent);
    });
  });
});
