import {
  AggregateBusinessRules,
  AggregateEventHandler,
  AggregateCoordinator,
} from '../../../../src/domain/aggregates/AggregateBusinessRules.js';
import { CollectionAggregate } from '../../../../src/domain/aggregates/CollectionAggregate.js';
import { DocumentAggregate } from '../../../../src/domain/aggregates/DocumentAggregate.js';
import { CollectionId, DocId } from '../../../../src/domain/entities/types.js';

describe('AggregateBusinessRules', () => {
  let collectionId: CollectionId;
  let docId: DocId;

  beforeEach(() => {
    collectionId = 'collection-1' as CollectionId;
    docId = 'doc-1' as DocId;
  });

  describe('validateDocumentAddition', () => {
    it('should validate correct document addition', () => {
      // Arrange
      const collectionAggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );
      const documentAggregate = DocumentAggregate.create(
        docId,
        collectionId,
        'test-doc',
        'Test content',
      );

      // Act
      const result = AggregateBusinessRules.validateDocumentAddition(
        collectionAggregate,
        documentAggregate,
      );

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject document from different collection', () => {
      // Arrange
      const collectionAggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );
      const documentAggregate = DocumentAggregate.create(
        docId,
        'different-collection' as CollectionId,
        'test-doc',
        'Test content',
      );

      // Act
      const result = AggregateBusinessRules.validateDocumentAddition(
        collectionAggregate,
        documentAggregate,
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `Document ${docId} does not belong to collection ${collectionId}`,
      );
    });

    it('should reject document with duplicate key', () => {
      // Arrange
      const collectionAggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );
      collectionAggregate.addDocument(docId, 'duplicate-key', 'Content 1');

      const documentAggregate = DocumentAggregate.create(
        'doc-2' as DocId,
        collectionId,
        'duplicate-key',
        'Content 2',
      );

      // Act
      const result = AggregateBusinessRules.validateDocumentAddition(
        collectionAggregate,
        documentAggregate,
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Document with key 'duplicate-key' already exists in collection",
      );
    });

    it('should reject deleted document', () => {
      // Arrange
      const collectionAggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );
      const documentAggregate = DocumentAggregate.create(
        docId,
        collectionId,
        'test-doc',
        'Test content',
      );
      documentAggregate.softDelete();

      // Act
      const result = AggregateBusinessRules.validateDocumentAddition(
        collectionAggregate,
        documentAggregate,
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `Cannot add deleted document ${docId} to collection`,
      );
    });
  });

  describe('validateDocumentRemoval', () => {
    it('should validate correct document removal', () => {
      // Arrange
      const collectionAggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );
      const documentAggregate = DocumentAggregate.create(
        docId,
        collectionId,
        'test-doc',
        'Test content',
      );
      collectionAggregate.addDocument(docId, 'test-doc', 'Test content');

      // Act
      const result = AggregateBusinessRules.validateDocumentRemoval(
        collectionAggregate,
        documentAggregate,
      );

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject document from different collection', () => {
      // Arrange
      const collectionAggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );
      const documentAggregate = DocumentAggregate.create(
        docId,
        'different-collection' as CollectionId,
        'test-doc',
        'Test content',
      );

      // Act
      const result = AggregateBusinessRules.validateDocumentRemoval(
        collectionAggregate,
        documentAggregate,
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `Document ${docId} does not belong to collection ${collectionId}`,
      );
    });

    it('should reject document that cannot be deleted', () => {
      // Arrange
      const collectionAggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );
      const documentAggregate = DocumentAggregate.create(
        docId,
        collectionId,
        'test-doc',
        'Test content',
      );
      collectionAggregate.addDocument(docId, 'test-doc', 'Test content');
      documentAggregate.softDelete(); // Now it cannot be deleted again

      // Act
      const result = AggregateBusinessRules.validateDocumentRemoval(
        collectionAggregate,
        documentAggregate,
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(`Document ${docId} cannot be deleted`);
    });

    it('should reject document that is being processed', () => {
      // Arrange
      const collectionAggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );
      const documentAggregate = DocumentAggregate.create(
        docId,
        collectionId,
        'test-doc',
        'Test content',
      );
      collectionAggregate.addDocument(docId, 'test-doc', 'Test content');
      documentAggregate.startProcessing();

      // Act
      const result = AggregateBusinessRules.validateDocumentRemoval(
        collectionAggregate,
        documentAggregate,
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `Cannot remove document ${docId} while it is being processed`,
      );
    });
  });

  describe('validateCollectionDeletion', () => {
    it('should validate correct collection deletion', () => {
      // Arrange
      const collectionAggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );

      // Act
      const result =
        AggregateBusinessRules.validateCollectionDeletion(collectionAggregate);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject system collection deletion', () => {
      // Arrange
      const collectionAggregate = CollectionAggregate.create(
        collectionId,
        'system-test',
        'System Collection',
      );

      // Act
      const result =
        AggregateBusinessRules.validateCollectionDeletion(collectionAggregate);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `System collection ${collectionId} cannot be deleted`,
      );
    });

    it('should reject collection with active documents', () => {
      // Arrange
      const collectionAggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );
      collectionAggregate.addDocument(docId, 'test-doc', 'Test content');

      // Act
      const result =
        AggregateBusinessRules.validateCollectionDeletion(collectionAggregate);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `Cannot delete collection ${collectionId} with 1 active documents`,
      );
    });
  });

  describe('validateDocumentProcessingStart', () => {
    it('should validate correct document processing start', () => {
      // Arrange
      const documentAggregate = DocumentAggregate.create(
        docId,
        collectionId,
        'test-doc',
        'Test content',
        'Test Document',
        'text/plain',
      );

      // Act
      const result =
        AggregateBusinessRules.validateDocumentProcessingStart(
          documentAggregate,
        );

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject document that cannot be processed', () => {
      // Arrange
      const documentAggregate = DocumentAggregate.create(
        docId,
        collectionId,
        'test-doc',
        'Test content',
      );
      documentAggregate.startProcessing();

      // Act
      const result =
        AggregateBusinessRules.validateDocumentProcessingStart(
          documentAggregate,
        );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(`Document ${docId} cannot be processed`);
    });

    it('should reject document without content', () => {
      // Arrange
      const documentAggregate = DocumentAggregate.create(
        docId,
        collectionId,
        'test-doc',
        'Test content',
      );
      // Clear content (simulating data inconsistency)
      (documentAggregate as any)._document._content = undefined;

      // Act
      const result =
        AggregateBusinessRules.validateDocumentProcessingStart(
          documentAggregate,
        );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `Document ${docId} has no content to process`,
      );
    });

    it('should reject non-text document', () => {
      // Arrange
      const documentAggregate = DocumentAggregate.create(
        docId,
        collectionId,
        'test-doc',
        'Test content',
        'Test Document',
        'application/pdf', // Non-text MIME type
      );

      // Act
      const result =
        AggregateBusinessRules.validateDocumentProcessingStart(
          documentAggregate,
        );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `Document ${docId} is not a text document and cannot be processed`,
      );
    });
  });

  describe('validateDocumentProcessingCompletion', () => {
    it('should validate correct document processing completion', () => {
      // Arrange
      const documentAggregate = DocumentAggregate.create(
        docId,
        collectionId,
        'test-doc',
        'Test content',
      );
      documentAggregate.startProcessing();
      const chunk = documentAggregate.addChunk(
        'point-1' as any,
        0,
        'Chunk content',
      );
      chunk.markAsSynced();

      // Act
      const result =
        AggregateBusinessRules.validateDocumentProcessingCompletion(
          documentAggregate,
        );

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject document not in processing state', () => {
      // Arrange
      const documentAggregate = DocumentAggregate.create(
        docId,
        collectionId,
        'test-doc',
        'Test content',
      );

      // Act
      const result =
        AggregateBusinessRules.validateDocumentProcessingCompletion(
          documentAggregate,
        );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `Document ${docId} is not in processing state`,
      );
    });

    it('should reject document without chunks', () => {
      // Arrange
      const documentAggregate = DocumentAggregate.create(
        docId,
        collectionId,
        'test-doc',
        'Test content',
      );
      documentAggregate.startProcessing();

      // Act
      const result =
        AggregateBusinessRules.validateDocumentProcessingCompletion(
          documentAggregate,
        );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `Document ${docId} has no chunks to complete`,
      );
    });

    it('should reject document with incomplete chunks', () => {
      // Arrange
      const documentAggregate = DocumentAggregate.create(
        docId,
        collectionId,
        'test-doc',
        'Test content',
      );
      documentAggregate.startProcessing();
      documentAggregate.addChunk('point-1' as any, 0, 'Chunk content'); // Not synced

      // Act
      const result =
        AggregateBusinessRules.validateDocumentProcessingCompletion(
          documentAggregate,
        );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `Document ${docId} has 1 incomplete chunks`,
      );
    });
  });

  describe('validateCrossAggregateConsistency', () => {
    it('should validate consistent aggregates', () => {
      // Arrange
      const collectionAggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );
      const documentAggregate = DocumentAggregate.create(
        docId,
        collectionId,
        'test-doc',
        'Test content',
      );
      collectionAggregate.addDocument(docId, 'test-doc', 'Test content');

      // Act
      const result = AggregateBusinessRules.validateCrossAggregateConsistency(
        [collectionAggregate],
        [documentAggregate],
      );

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect document referencing non-existent collection', () => {
      // Arrange
      const collectionAggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );
      const documentAggregate = DocumentAggregate.create(
        docId,
        'non-existent' as CollectionId,
        'test-doc',
        'Test content',
      );

      // Act
      const result = AggregateBusinessRules.validateCrossAggregateConsistency(
        [collectionAggregate],
        [documentAggregate],
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `Document ${docId} references non-existent collection non-existent`,
      );
    });

    it('should detect document count mismatch', () => {
      // Arrange
      const collectionAggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );
      const documentAggregate = DocumentAggregate.create(
        docId,
        collectionId,
        'test-doc',
        'Test content',
      );
      // Don't add document to collection (simulating inconsistency)

      // Act
      const result = AggregateBusinessRules.validateCrossAggregateConsistency(
        [collectionAggregate],
        [documentAggregate],
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `Collection ${collectionId} document count mismatch: expected 0, actual 1`,
      );
    });
  });
});

describe('AggregateEventHandler', () => {
  let collectionId: CollectionId;
  let docId: DocId;

  beforeEach(() => {
    collectionId = 'collection-1' as CollectionId;
    docId = 'doc-1' as DocId;
  });

  describe('handleDocumentAdded', () => {
    it('should handle document added event', () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const collectionAggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );
      const documentAggregate = DocumentAggregate.create(
        docId,
        collectionId,
        'test-doc',
        'Test content',
      );

      // Act
      AggregateEventHandler.handleDocumentAdded(
        collectionAggregate,
        documentAggregate,
      );

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        `Document ${docId} added to collection ${collectionId}`,
      );

      consoleSpy.mockRestore();
    });
  });

  describe('handleDocumentRemoved', () => {
    it('should handle document removed event', () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const collectionAggregate = CollectionAggregate.create(
        collectionId,
        'Test Collection',
      );
      const documentAggregate = DocumentAggregate.create(
        docId,
        collectionId,
        'test-doc',
        'Test content',
      );

      // Act
      AggregateEventHandler.handleDocumentRemoved(
        collectionAggregate,
        documentAggregate,
      );

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        `Document ${docId} removed from collection ${collectionId}`,
      );

      consoleSpy.mockRestore();
    });
  });

  describe('handleDocumentStatusChanged', () => {
    it('should handle document status changed to completed', () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const documentAggregate = DocumentAggregate.create(
        docId,
        collectionId,
        'test-doc',
        'Test content',
      );

      // Act
      AggregateEventHandler.handleDocumentStatusChanged(
        documentAggregate,
        'processing',
        'completed',
      );

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        `Document ${docId} processing completed`,
      );

      consoleSpy.mockRestore();
    });

    it('should handle document status changed to failed', () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const documentAggregate = DocumentAggregate.create(
        docId,
        collectionId,
        'test-doc',
        'Test content',
      );

      // Act
      AggregateEventHandler.handleDocumentStatusChanged(
        documentAggregate,
        'processing',
        'failed',
      );

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        `Document ${docId} processing failed`,
      );

      consoleSpy.mockRestore();
    });
  });

  describe('handleChunkEmbeddingGenerated', () => {
    it('should handle chunk embedding generated event', () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const documentAggregate = DocumentAggregate.create(
        docId,
        collectionId,
        'test-doc',
        'Test content',
      );
      const chunk = documentAggregate.addChunk(
        'point-1' as any,
        0,
        'Chunk content',
      );
      chunk.markAsSynced();

      // Act
      AggregateEventHandler.handleChunkEmbeddingGenerated(
        documentAggregate,
        'point-1' as any,
      );

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        `All chunks for document ${docId} have embeddings`,
      );

      consoleSpy.mockRestore();
    });
  });
});

describe('AggregateCoordinator', () => {
  let collectionId1: CollectionId;
  let collectionId2: CollectionId;
  let docId: DocId;

  beforeEach(() => {
    collectionId1 = 'collection-1' as CollectionId;
    collectionId2 = 'collection-2' as CollectionId;
    docId = 'doc-1' as DocId;
  });

  describe('moveDocumentBetweenCollections', () => {
    it('should move document between collections', () => {
      // Arrange
      const sourceCollection = CollectionAggregate.create(
        collectionId1,
        'Source Collection',
      );
      const targetCollection = CollectionAggregate.create(
        collectionId2,
        'Target Collection',
      );
      const documentAggregate = DocumentAggregate.create(
        docId,
        collectionId1,
        'test-doc',
        'Test content',
      );
      sourceCollection.addDocument(docId, 'test-doc', 'Test content');

      // Act
      const result = AggregateCoordinator.moveDocumentBetweenCollections(
        documentAggregate,
        sourceCollection,
        targetCollection,
      );

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(sourceCollection.hasDocument(docId)).toBe(false);
      expect(targetCollection.hasDocument(docId)).toBe(true);
    });

    it('should reject moving document from wrong source collection', () => {
      // Arrange
      const sourceCollection = CollectionAggregate.create(
        collectionId1,
        'Source Collection',
      );
      const targetCollection = CollectionAggregate.create(
        collectionId2,
        'Target Collection',
      );
      const documentAggregate = DocumentAggregate.create(
        docId,
        collectionId2, // Document belongs to target, not source
        'test-doc',
        'Test content',
      );

      // Act
      const result = AggregateCoordinator.moveDocumentBetweenCollections(
        documentAggregate,
        sourceCollection,
        targetCollection,
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `Document ${docId} is not in source collection ${collectionId1}`,
      );
    });

    it('should reject moving document with duplicate key', () => {
      // Arrange
      const sourceCollection = CollectionAggregate.create(
        collectionId1,
        'Source Collection',
      );
      const targetCollection = CollectionAggregate.create(
        collectionId2,
        'Target Collection',
      );
      const documentAggregate = DocumentAggregate.create(
        docId,
        collectionId1,
        'duplicate-key',
        'Test content',
      );
      sourceCollection.addDocument(docId, 'duplicate-key', 'Test content');
      targetCollection.addDocument(
        'doc-2' as DocId,
        'duplicate-key',
        'Other content',
      );

      // Act
      const result = AggregateCoordinator.moveDocumentBetweenCollections(
        documentAggregate,
        sourceCollection,
        targetCollection,
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `Document with key 'duplicate-key' already exists in target collection ${collectionId2}`,
      );
    });
  });

  describe('coordinateBatchDocumentOperation', () => {
    it('should coordinate batch delete operation', () => {
      // Arrange
      const doc1 = DocumentAggregate.create(
        'doc-1' as DocId,
        collectionId1,
        'doc1',
        'Content 1',
      );
      const doc2 = DocumentAggregate.create(
        'doc-2' as DocId,
        collectionId1,
        'doc2',
        'Content 2',
      );

      // Act
      const result = AggregateCoordinator.coordinateBatchDocumentOperation(
        [doc1, doc2],
        'delete',
      );

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.successCount).toBe(2);
      expect(doc1.isDeleted).toBe(true);
      expect(doc2.isDeleted).toBe(true);
    });

    it('should coordinate batch process operation', () => {
      // Arrange
      const doc1 = DocumentAggregate.create(
        'doc-1' as DocId,
        collectionId1,
        'doc1',
        'Content 1',
      );
      const doc2 = DocumentAggregate.create(
        'doc-2' as DocId,
        collectionId1,
        'doc2',
        'Content 2',
      );

      // Act
      const result = AggregateCoordinator.coordinateBatchDocumentOperation(
        [doc1, doc2],
        'process',
      );

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.successCount).toBe(2);
      expect(doc1.status).toBe('processing');
      expect(doc2.status).toBe('processing');
    });

    it('should handle partial failures in batch operation', () => {
      // Arrange
      const doc1 = DocumentAggregate.create(
        'doc-1' as DocId,
        collectionId1,
        'doc1',
        'Content 1',
      );
      const doc2 = DocumentAggregate.create(
        'doc-2' as DocId,
        collectionId1,
        'doc2',
        'Content 2',
      );
      doc1.startProcessing(); // Cannot be processed again

      // Act
      const result = AggregateCoordinator.coordinateBatchDocumentOperation(
        [doc1, doc2],
        'process',
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.successCount).toBe(1);
      expect(doc2.status).toBe('processing');
    });
  });
});
