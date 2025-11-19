/**
 * AggregateBusinessRules 事件处理和协调器单元测试
 * 测试聚合业务规则的事件处理和协调逻辑
 */

import {
  AggregateBusinessRules,
  AggregateEventHandler,
  AggregateCoordinator,
} from '@domain/aggregates/AggregateBusinessRules.js';
import { CollectionAggregate } from '@domain/aggregates/CollectionAggregate.js';
import { DocumentAggregate } from '@domain/aggregates/DocumentAggregate.js';
import { CollectionId, DocId } from '@domain/entities/types.js';

describe('AggregateBusinessRules - 事件处理和协调器', () => {
  let collectionId1: CollectionId;
  let collectionId2: CollectionId;
  let docId: DocId;

  beforeEach(() => {
    collectionId1 = 'collection-1' as CollectionId;
    collectionId2 = 'collection-2' as CollectionId;
    docId = 'doc-1' as DocId;
  });

  describe('AggregateEventHandler', () => {
    describe('handleDocumentAdded', () => {
      it('should handle document added event', () => {
        // Arrange
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        const collectionAggregate = CollectionAggregate.create(
          collectionId1,
          'Test Collection',
        );
        const documentAggregate = DocumentAggregate.create(
          docId,
          collectionId1,
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
          `Document ${docId} added to collection ${collectionId1}`,
        );

        consoleSpy.mockRestore();
      });
    });

    describe('handleDocumentRemoved', () => {
      it('should handle document removed event', () => {
        // Arrange
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        const collectionAggregate = CollectionAggregate.create(
          collectionId1,
          'Test Collection',
        );
        const documentAggregate = DocumentAggregate.create(
          docId,
          collectionId1,
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
          `Document ${docId} removed from collection ${collectionId1}`,
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
          collectionId1,
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
          collectionId1,
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
          collectionId1,
          'test-doc',
          'Test content',
        );
        const chunk = documentAggregate.addChunk(
          'point-1' as any,
          0,
          'Chunk content',
        );
        // 设置嵌入向量，这是 markAsSynced() 的前置条件
        chunk.setEmbedding([0.1, 0.2, 0.3]);
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
        let updatedSourceCollection = sourceCollection.withDocument(
          docId,
          'test-doc',
          'Test content',
        );

        // Act
        const result = AggregateCoordinator.moveDocumentBetweenCollections(
          documentAggregate,
          updatedSourceCollection,
          targetCollection,
        );

        // Assert
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
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
        let updatedSourceCollection = sourceCollection.withDocument(
          docId,
          'duplicate-key',
          'Test content',
        );
        let updatedTargetCollection = targetCollection.withDocument(
          'doc-2' as DocId,
          'duplicate-key',
          'Other content',
        );

        // Act
        const result = AggregateCoordinator.moveDocumentBetweenCollections(
          documentAggregate,
          updatedSourceCollection,
          updatedTargetCollection,
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
});
