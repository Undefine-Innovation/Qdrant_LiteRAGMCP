/**
 * AggregateBusinessRules 处理方法单元测试
 * 测试聚合业务规则的处理逻辑
 */

import { AggregateBusinessRules } from '@domain/aggregates/AggregateBusinessRules.js';
import { CollectionAggregate } from '@domain/aggregates/CollectionAggregate.js';
import { DocumentAggregate } from '@domain/aggregates/DocumentAggregate.js';
import { CollectionId, DocId } from '@domain/entities/types.js';

describe('AggregateBusinessRules - 处理方法', () => {
  let collectionId: CollectionId;
  let docId: DocId;

  beforeEach(() => {
    collectionId = 'collection-1' as CollectionId;
    docId = 'doc-1' as DocId;
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
      // 设置嵌入向量，这是 markAsSynced() 的前置条件
      chunk.setEmbedding([0.1, 0.2, 0.3]);
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
      let updatedCollection = collectionAggregate.withDocument(
        docId,
        'test-doc',
        'Test content',
      );

      // Act
      const result = AggregateBusinessRules.validateCrossAggregateConsistency(
        [updatedCollection],
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
