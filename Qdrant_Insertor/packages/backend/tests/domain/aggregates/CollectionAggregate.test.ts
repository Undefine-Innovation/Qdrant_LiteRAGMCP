import { CollectionAggregate } from '../../../../src/domain/aggregates/CollectionAggregate.js';
import { Doc } from '../../../../src/domain/entities/Doc.js';
import { CollectionId, DocId } from '../../../../src/domain/entities/types.js';

describe('CollectionAggregate', () => {
  let collectionId: CollectionId;
  let docId1: DocId;
  let docId2: DocId;

  beforeEach(() => {
    collectionId = 'collection-1' as CollectionId;
    docId1 = 'doc-1' as DocId;
    docId2 = 'doc-2' as DocId;
  });

  describe('create', () => {
    it('should create a new collection aggregate with valid data', () => {
      // Arrange & Act
      const aggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
        'Test Description',
      );

      // Assert
      expect(aggregate.id).toBe(collectionId);
      expect(aggregate.name).toBe('Test Collection');
      expect(aggregate.description).toBe('Test Description');
      expect(aggregate.getDocumentCount()).toBe(0);
      expect(aggregate.getDomainEvents()).toHaveLength(1);
      expect(aggregate.getDomainEvents()[0]).toBeInstanceOf(
        aggregate.constructor.name === 'CollectionAggregate'
          ? require('../../../../src/domain/aggregates/CollectionAggregate.js')
              .CollectionCreatedEvent
          : Object,
      );
    });

    it('should create a collection aggregate without description', () => {
      // Arrange & Act
      const aggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );

      // Assert
      expect(aggregate.id).toBe(collectionId);
      expect(aggregate.name).toBe('Test Collection');
      expect(aggregate.description).toBeUndefined();
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute a collection aggregate from existing data', () => {
      // Arrange
      const collection = {
        id: collectionId,
        name: 'Test Collection',
        description: 'Test Description',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as any;

      const docs = [
        {
          id: docId1,
          collectionId,
          key: 'doc1',
          name: 'Document 1',
          isDeleted: false,
          canBeDeleted: () => true,
          softDelete: jest.fn(),
        } as any,
      ];

      // Act
      const aggregate = CollectionAggregate.reconstitute(collection, docs);

      // Assert
      expect(aggregate.id).toBe(collectionId);
      expect(aggregate.name).toBe('Test Collection');
      expect(aggregate.getDocumentCount()).toBe(1);
      expect(aggregate.hasDocument(docId1)).toBe(true);
    });
  });

  describe('updateDescription', () => {
    it('should update collection description', () => {
      // Arrange
      const aggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
        'Original Description',
      );

      // Act
      aggregate.updateDescription('Updated Description');

      // Assert
      expect(aggregate.description).toBe('Updated Description');
      expect(aggregate.getDomainEvents()).toHaveLength(2); // Create + Update events
    });
  });

  describe('addDocument', () => {
    let aggregate: CollectionAggregate;

    beforeEach(() => {
      aggregate = CollectionAggregate.create(collectionId, 'Test Collection');
    });

    it('should add a document to the collection', () => {
      // Arrange & Act
      const doc = aggregate.addDocument(
        docId1,
        'test-doc',
        'Test content',
        'Test Document',
        'text/plain',
      );

      // Assert
      expect(doc.id).toBe(docId1);
      expect(doc.collectionId).toBe(collectionId);
      expect(aggregate.hasDocument(docId1)).toBe(true);
      expect(aggregate.getDocumentCount()).toBe(1);
      expect(aggregate.getDomainEvents()).toHaveLength(2); // Create + DocumentAdded events
    });

    it('should throw error when adding document with duplicate key', () => {
      // Arrange
      aggregate.addDocument(docId1, 'duplicate-key', 'Content 1');

      // Act & Assert
      expect(() => {
        aggregate.addDocument(docId2, 'duplicate-key', 'Content 2');
      }).toThrow(
        "Document with key 'duplicate-key' already exists in collection",
      );
    });
  });

  describe('removeDocument', () => {
    let aggregate: CollectionAggregate;
    let doc: Doc;

    beforeEach(() => {
      aggregate = CollectionAggregate.create(collectionId, 'Test Collection');
      doc = aggregate.addDocument(docId1, 'test-doc', 'Test content');
    });

    it('should remove a document from the collection', () => {
      // Arrange & Act
      const result = aggregate.removeDocument(docId1);

      // Assert
      expect(result).toBe(true);
      expect(aggregate.hasDocument(docId1)).toBe(false);
      expect(aggregate.getDocumentCount()).toBe(0);
      expect(doc.isDeleted).toBe(true);
      expect(aggregate.getDomainEvents()).toHaveLength(3); // Create + DocumentAdded + DocumentRemoved events
    });

    it('should return false when removing non-existent document', () => {
      // Arrange & Act
      const result = aggregate.removeDocument('non-existent' as DocId);

      // Assert
      expect(result).toBe(false);
    });

    it('should throw error when removing document that cannot be deleted', () => {
      // Arrange
      (doc as any).canBeDeleted = jest.fn().mockReturnValue(false);

      // Act & Assert
      expect(() => {
        aggregate.removeDocument(docId1);
      }).toThrow(`Document ${docId1} cannot be deleted`);
    });
  });

  describe('getActiveDocuments', () => {
    it('should return only non-deleted documents', () => {
      // Arrange
      const aggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );
      const doc1 = aggregate.addDocument(docId1, 'doc1', 'Content 1');
      const doc2 = aggregate.addDocument(docId2, 'doc2', 'Content 2');

      // Soft delete one document
      aggregate.removeDocument(docId1);

      // Act
      const activeDocs = aggregate.getActiveDocuments();

      // Assert
      expect(activeDocs).toHaveLength(1);
      expect(activeDocs[0].id).toBe(docId2);
    });
  });

  describe('canBeDeleted', () => {
    it('should return true for non-system collection with no documents', () => {
      // Arrange
      const aggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );

      // Act & Assert
      expect(aggregate.canBeDeleted()).toBe(true);
    });

    it('should return false for system collection', () => {
      // Arrange
      const aggregate = CollectionAggregate.create(
        collectionId,
        'system-test',
        'System Collection',
      );

      // Act & Assert
      expect(aggregate.canBeDeleted()).toBe(false);
    });

    it('should return false for collection with active documents', () => {
      // Arrange
      const aggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );
      aggregate.addDocument(docId1, 'doc1', 'Content 1');

      // Act & Assert
      expect(aggregate.canBeDeleted()).toBe(false);
    });
  });

  describe('validate', () => {
    it('should validate a correct aggregate', () => {
      // Arrange
      const aggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
        'Description',
      );
      aggregate.addDocument(docId1, 'doc1', 'Content 1');

      // Act
      const result = aggregate.validate();

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect duplicate document keys', () => {
      // Arrange
      const aggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );
      aggregate.addDocument(docId1, 'duplicate-key', 'Content 1');

      // Manually add a document with duplicate key (simulating data inconsistency)
      const doc2 = Doc.create(
        docId2,
        collectionId,
        'duplicate-key',
        'Content 2',
      );
      (aggregate as any)._documents.set(docId2, doc2);

      // Act
      const result = aggregate.validate();

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Document keys must be unique within collection',
      );
    });
  });

  describe('domain events', () => {
    it('should clear domain events', () => {
      // Arrange
      const aggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );
      aggregate.addDocument(docId1, 'doc1', 'Content 1');

      // Act
      aggregate.clearDomainEvents();

      // Assert
      expect(aggregate.getDomainEvents()).toHaveLength(0);
    });
  });
});
