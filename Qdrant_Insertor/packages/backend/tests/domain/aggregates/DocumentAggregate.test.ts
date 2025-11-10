import { DocumentAggregate } from '../../../../src/domain/aggregates/DocumentAggregate.js';
import { Chunk } from '../../../../src/domain/entities/Chunk.js';
import {
  DocId,
  CollectionId,
  PointId,
} from '../../../../src/domain/entities/types.js';

describe('DocumentAggregate', () => {
  let docId: DocId;
  let collectionId: CollectionId;
  let pointId1: PointId;
  let pointId2: PointId;

  beforeEach(() => {
    docId = 'doc-1' as DocId;
    collectionId = 'collection-1' as CollectionId;
    pointId1 = 'point-1' as PointId;
    pointId2 = 'point-2' as PointId;
  });

  describe('create', () => {
    it('should create a new document aggregate with valid data', () => {
      // Arrange & Act
      const aggregate = DocumentAggregate.create(
        docId,
        collectionId,
        'test-doc',
        'Test document content',
        'Test Document',
        'text/plain',
      );

      // Assert
      expect(aggregate.id).toBe(docId);
      expect(aggregate.collectionId).toBe(collectionId);
      expect(aggregate.key).toBe('test-doc');
      expect(aggregate.name).toBe('Test Document');
      expect(aggregate.status).toBe('new');
      expect(aggregate.getChunkCount()).toBe(0);
      expect(aggregate.getDomainEvents()).toHaveLength(1);
      expect(aggregate.getDomainEvents()[0]).toBeInstanceOf(
        aggregate.constructor.name === 'DocumentAggregate'
          ? require('../../../../src/domain/aggregates/DocumentAggregate.js')
              .DocumentCreatedEvent
          : Object,
      );
    });

    it('should create a document aggregate without optional parameters', () => {
      // Arrange & Act
      const aggregate = DocumentAggregate.create(
        docId,
        collectionId,
        'test-doc',
        'Test document content',
      );

      // Assert
      expect(aggregate.id).toBe(docId);
      expect(aggregate.collectionId).toBe(collectionId);
      expect(aggregate.key).toBe('test-doc');
      expect(aggregate.name).toBeUndefined();
      expect(aggregate.document.mime).toBeUndefined();
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute a document aggregate from existing data', () => {
      // Arrange
      const document = {
        id: docId,
        collectionId,
        key: 'test-doc',
        name: 'Test Document',
        status: 'completed',
        isDeleted: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as any;

      const chunks = [
        {
          pointId: pointId1,
          docId,
          collectionId,
          chunkIndex: 0,
          content: 'Chunk content 1',
          status: 'synced',
        } as any,
      ];

      // Act
      const aggregate = DocumentAggregate.reconstitute(document, chunks);

      // Assert
      expect(aggregate.id).toBe(docId);
      expect(aggregate.collectionId).toBe(collectionId);
      expect(aggregate.getChunkCount()).toBe(1);
      expect(aggregate.hasChunk(pointId1)).toBe(true);
    });
  });

  describe('updateContent', () => {
    let aggregate: DocumentAggregate;

    beforeEach(() => {
      aggregate = DocumentAggregate.create(
        docId,
        collectionId,
        'test-doc',
        'Original content',
      );
    });

    it('should update document content', () => {
      // Arrange & Act
      aggregate.updateContent('Updated content');

      // Assert
      expect(aggregate.contentValue).toBe('Updated content');
      expect(aggregate.getChunkCount()).toBe(0); // Chunks should be cleared
      expect(aggregate.getDomainEvents()).toHaveLength(2); // Create + ContentUpdated events
    });
  });

  describe('processing lifecycle', () => {
    let aggregate: DocumentAggregate;

    beforeEach(() => {
      aggregate = DocumentAggregate.create(
        docId,
        collectionId,
        'test-doc',
        'Test content',
      );
    });

    it('should start processing', () => {
      // Arrange & Act
      aggregate.startProcessing();

      // Assert
      expect(aggregate.status).toBe('processing');
      expect(aggregate.getDomainEvents()).toHaveLength(2); // Create + StatusChanged events
    });

    it('should complete processing when all chunks are completed', () => {
      // Arrange
      aggregate.startProcessing();
      const chunk = aggregate.addChunk(pointId1, 0, 'Chunk content');
      chunk.markAsSynced();

      // Act
      aggregate.completeProcessing();

      // Assert
      expect(aggregate.status).toBe('completed');
      expect(aggregate.getDomainEvents()).toHaveLength(4); // Create + StatusChanged + ChunkAdded + StatusChanged events
    });

    it('should throw error when completing processing with incomplete chunks', () => {
      // Arrange
      aggregate.startProcessing();
      aggregate.addChunk(pointId1, 0, 'Chunk content');

      // Act & Assert
      expect(() => {
        aggregate.completeProcessing();
      }).toThrow('Cannot complete document with 1 incomplete chunks');
    });

    it('should fail processing', () => {
      // Arrange
      aggregate.startProcessing();

      // Act
      aggregate.failProcessing();

      // Assert
      expect(aggregate.status).toBe('failed');
      expect(aggregate.getDomainEvents()).toHaveLength(3); // Create + StatusChanged + StatusChanged events
    });

    it('should throw error when starting processing on non-processable document', () => {
      // Arrange
      aggregate.startProcessing();
      aggregate.failProcessing();

      // Act & Assert
      expect(() => {
        aggregate.startProcessing();
      }).toThrow(`Document ${docId} cannot be processed`);
    });
  });

  describe('addChunk', () => {
    let aggregate: DocumentAggregate;

    beforeEach(() => {
      aggregate = DocumentAggregate.create(
        docId,
        collectionId,
        'test-doc',
        'Test content',
      );
    });

    it('should add a chunk to document', () => {
      // Arrange & Act
      const chunk = aggregate.addChunk(
        pointId1,
        0,
        'Chunk content',
        'Chunk title',
      );

      // Assert
      expect(chunk.pointId).toBe(pointId1);
      expect(chunk.docId).toBe(docId);
      expect(chunk.collectionId).toBe(collectionId);
      expect(chunk.chunkIndex).toBe(0);
      expect(aggregate.hasChunk(pointId1)).toBe(true);
      expect(aggregate.getChunkCount()).toBe(1);
      expect(aggregate.getDomainEvents()).toHaveLength(2); // Create + ChunkAdded events
    });

    it('should throw error when adding chunk with duplicate index', () => {
      // Arrange
      aggregate.addChunk(pointId1, 0, 'Chunk content 1');

      // Act & Assert
      expect(() => {
        aggregate.addChunk(pointId2, 0, 'Chunk content 2');
      }).toThrow('Chunk at index 0 already exists');
    });
  });

  describe('chunk operations', () => {
    let aggregate: DocumentAggregate;
    let chunk: Chunk;

    beforeEach(() => {
      aggregate = DocumentAggregate.create(
        docId,
        collectionId,
        'test-doc',
        'Test content',
      );
      chunk = aggregate.addChunk(pointId1, 0, 'Chunk content');
    });

    it('should set chunk embedding', () => {
      // Arrange
      const embedding = [0.1, 0.2, 0.3];

      // Act
      aggregate.setChunkEmbedding(pointId1, embedding);

      // Assert
      expect(chunk.embeddingValue).toEqual(embedding);
      expect(chunk.status).toBe('embedding_generated');
      expect(aggregate.getDomainEvents()).toHaveLength(3); // Create + ChunkAdded + EmbeddingGenerated events
    });

    it('should mark chunk as synced', () => {
      // Arrange
      const embedding = [0.1, 0.2, 0.3];
      aggregate.setChunkEmbedding(pointId1, embedding);

      // Act
      aggregate.markChunkAsSynced(pointId1);

      // Assert
      expect(chunk.status).toBe('synced');
    });

    it('should mark chunk as failed', () => {
      // Act
      aggregate.markChunkAsFailed(pointId1);

      // Assert
      expect(chunk.status).toBe('failed');
    });

    it('should throw error when operating on non-existent chunk', () => {
      // Act & Assert
      expect(() => {
        aggregate.setChunkEmbedding('non-existent' as PointId, [0.1, 0.2]);
      }).toThrow('Chunk non-existent not found in document doc-1');
    });
  });

  describe('chunk queries', () => {
    let aggregate: DocumentAggregate;
    let chunk1: Chunk;
    let chunk2: Chunk;

    beforeEach(() => {
      aggregate = DocumentAggregate.create(
        docId,
        collectionId,
        'test-doc',
        'Test content',
      );
      chunk1 = aggregate.addChunk(pointId1, 0, 'Chunk content 1');
      chunk2 = aggregate.addChunk(pointId2, 1, 'Chunk content 2');

      // Set embeddings and sync status
      aggregate.setChunkEmbedding(pointId1, [0.1, 0.2, 0.3]);
      aggregate.markChunkAsSynced(pointId1);
      aggregate.setChunkEmbedding(pointId2, [0.4, 0.5, 0.6]);
    });

    it('should get chunks needing embedding', () => {
      // Act
      const chunksNeedingEmbedding = aggregate.getChunksNeedingEmbedding();

      // Assert
      expect(chunksNeedingEmbedding).toHaveLength(1);
      expect(chunksNeedingEmbedding[0].pointId).toBe(pointId2);
    });

    it('should get chunks needing sync', () => {
      // Act
      const chunksNeedingSync = aggregate.getChunksNeedingSync();

      // Assert
      expect(chunksNeedingSync).toHaveLength(1);
      expect(chunksNeedingSync[0].pointId).toBe(pointId2);
    });

    it('should get completed chunks', () => {
      // Act
      const completedChunks = aggregate.getCompletedChunks();

      // Assert
      expect(completedChunks).toHaveLength(1);
      expect(completedChunks[0].pointId).toBe(pointId1);
    });

    it('should get sorted chunks', () => {
      // Act
      const sortedChunks = aggregate.getSortedChunks();

      // Assert
      expect(sortedChunks).toHaveLength(2);
      expect(sortedChunks[0].chunkIndex).toBe(0);
      expect(sortedChunks[1].chunkIndex).toBe(1);
    });
  });

  describe('document lifecycle', () => {
    let aggregate: DocumentAggregate;

    beforeEach(() => {
      aggregate = DocumentAggregate.create(
        docId,
        collectionId,
        'test-doc',
        'Test content',
      );
    });

    it('should soft delete document', () => {
      // Act
      aggregate.softDelete();

      // Assert
      expect(aggregate.isDeleted).toBe(true);
      expect(aggregate.status).toBe('deleted');
    });

    it('should restore deleted document', () => {
      // Arrange
      aggregate.softDelete();

      // Act
      aggregate.restore();

      // Assert
      expect(aggregate.isDeleted).toBe(false);
      expect(aggregate.status).toBe('new');
    });

    it('should throw error when restoring non-deleted document', () => {
      // Act & Assert
      expect(() => {
        aggregate.restore();
      }).toThrow('Cannot restore a document that is not deleted');
    });
  });

  describe('validation', () => {
    it('should validate a correct aggregate', () => {
      // Arrange
      const aggregate = DocumentAggregate.create(
        docId,
        collectionId,
        'test-doc',
        'Test content',
      );
      aggregate.addChunk(pointId1, 0, 'Chunk content');

      // Act
      const result = aggregate.validate();

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect duplicate chunk indexes', () => {
      // Arrange
      const aggregate = DocumentAggregate.create(
        docId,
        collectionId,
        'test-doc',
        'Test content',
      );
      aggregate.addChunk(pointId1, 0, 'Chunk content 1');

      // Manually add a chunk with duplicate index (simulating data inconsistency)
      const chunk2 = Chunk.create(
        pointId2,
        docId,
        collectionId,
        0,
        'Chunk content 2',
      );
      (aggregate as any)._chunks.set(pointId2, chunk2);

      // Act
      const result = aggregate.validate();

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Chunk indexes must be unique within document',
      );
    });
  });

  describe('domain events', () => {
    it('should clear domain events', () => {
      // Arrange
      const aggregate = DocumentAggregate.create(
        docId,
        collectionId,
        'test-doc',
        'Test content',
      );
      aggregate.addChunk(pointId1, 0, 'Chunk content');

      // Act
      aggregate.clearDomainEvents();

      // Assert
      expect(aggregate.getDomainEvents()).toHaveLength(0);
    });
  });
});
