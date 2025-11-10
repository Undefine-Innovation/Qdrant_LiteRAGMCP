import { AggregateFactory } from '../../../../src/domain/aggregates/AggregateFactory.js';
import { Collection } from '../../../../src/domain/entities/Collection.js';
import { Doc } from '../../../../src/domain/entities/Doc.js';
import { Chunk } from '../../../../src/domain/entities/Chunk.js';
import {
  CollectionId,
  DocId,
  PointId,
} from '../../../../src/domain/entities/types.js';

describe('AggregateFactory', () => {
  let collectionId: CollectionId;
  let docId: DocId;
  let pointId: PointId;

  beforeEach(() => {
    collectionId = 'collection-1' as CollectionId;
    docId = 'doc-1' as DocId;
    pointId = 'point-1' as PointId;
  });

  describe('createCollection', () => {
    it('should create a new collection aggregate', () => {
      // Arrange & Act
      const aggregate = AggregateFactory.createCollection(
        collectionId,
        'Test Collection',
        'Test Description',
      );

      // Assert
      expect(aggregate.id).toBe(collectionId);
      expect(aggregate.name).toBe('Test Collection');
      expect(aggregate.description).toBe('Test Description');
      expect(aggregate.getDocumentCount()).toBe(0);
    });

    it('should create a collection aggregate without description', () => {
      // Arrange & Act
      const aggregate = AggregateFactory.createCollection(
        collectionId,
        'Test Collection',
      );

      // Assert
      expect(aggregate.id).toBe(collectionId);
      expect(aggregate.name).toBe('Test Collection');
      expect(aggregate.description).toBeUndefined();
    });
  });

  describe('reconstituteCollection', () => {
    it('should reconstitute a collection aggregate from existing data', () => {
      // Arrange
      const collection = Collection.create(
        collectionId,
        'Test Collection',
        'Test Description',
      );
      const docs = [
        Doc.create(
          docId,
          collectionId,
          'test-doc',
          'Test content',
          'Test Document',
        ),
      ];

      // Act
      const aggregate = AggregateFactory.reconstituteCollection(
        collection,
        docs,
      );

      // Assert
      expect(aggregate.id).toBe(collectionId);
      expect(aggregate.name).toBe('Test Collection');
      expect(aggregate.getDocumentCount()).toBe(1);
      expect(aggregate.hasDocument(docId)).toBe(true);
    });
  });

  describe('createDocument', () => {
    it('should create a new document aggregate', () => {
      // Arrange & Act
      const aggregate = AggregateFactory.createDocument(
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
    });

    it('should create a document aggregate without optional parameters', () => {
      // Arrange & Act
      const aggregate = AggregateFactory.createDocument(
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

  describe('reconstituteDocument', () => {
    it('should reconstitute a document aggregate from existing data', () => {
      // Arrange
      const document = Doc.create(
        docId,
        collectionId,
        'test-doc',
        'Test content',
        'Test Document',
      );
      const chunks = [
        Chunk.create(
          pointId,
          docId,
          collectionId,
          0,
          'Chunk content',
          'Chunk title',
        ),
      ];

      // Act
      const aggregate = AggregateFactory.reconstituteDocument(document, chunks);

      // Assert
      expect(aggregate.id).toBe(docId);
      expect(aggregate.collectionId).toBe(collectionId);
      expect(aggregate.getChunkCount()).toBe(1);
      expect(aggregate.hasChunk(pointId)).toBe(true);
    });
  });

  describe('createDocuments', () => {
    it('should create multiple document aggregates', () => {
      // Arrange
      const documentsData = [
        {
          id: docId,
          collectionId,
          key: 'doc1',
          content: 'Content 1',
          name: 'Document 1',
          mime: 'text/plain',
        },
        {
          id: 'doc-2' as DocId,
          collectionId,
          key: 'doc2',
          content: 'Content 2',
          name: 'Document 2',
        },
      ];

      // Act
      const aggregates = AggregateFactory.createDocuments(documentsData);

      // Assert
      expect(aggregates).toHaveLength(2);
      expect(aggregates[0].id).toBe(docId);
      expect(aggregates[0].key).toBe('doc1');
      expect(aggregates[1].id).toBe('doc-2' as DocId);
      expect(aggregates[1].key).toBe('doc2');
    });
  });

  describe('reconstituteDocuments', () => {
    it('should reconstitute multiple document aggregates', () => {
      // Arrange
      const document1 = Doc.create(
        docId,
        collectionId,
        'doc1',
        'Content 1',
        'Document 1',
      );
      const document2 = Doc.create(
        'doc-2' as DocId,
        collectionId,
        'doc2',
        'Content 2',
        'Document 2',
      );
      const chunk1 = Chunk.create(pointId, docId, collectionId, 0, 'Chunk 1');
      const chunk2 = Chunk.create(
        'point-2' as PointId,
        'doc-2' as DocId,
        collectionId,
        0,
        'Chunk 2',
      );

      const documentsWithChunks = [
        { document: document1, chunks: [chunk1] },
        { document: document2, chunks: [chunk2] },
      ];

      // Act
      const aggregates =
        AggregateFactory.reconstituteDocuments(documentsWithChunks);

      // Assert
      expect(aggregates).toHaveLength(2);
      expect(aggregates[0].id).toBe(docId);
      expect(aggregates[0].getChunkCount()).toBe(1);
      expect(aggregates[1].id).toBe('doc-2' as DocId);
      expect(aggregates[1].getChunkCount()).toBe(1);
    });
  });

  describe('createCompleteCollection', () => {
    it('should create a complete collection with documents and chunks', () => {
      // Arrange
      const collectionData = {
        id: collectionId,
        name: 'Test Collection',
        description: 'Test Description',
      };

      const documentsWithChunks = [
        {
          id: docId,
          key: 'doc1',
          content: 'Document content 1',
          name: 'Document 1',
          chunks: [
            {
              pointId,
              chunkIndex: 0,
              content: 'Chunk content 1',
              title: 'Chunk 1',
            },
          ],
        },
      ];

      // Act
      const aggregate = AggregateFactory.createCompleteCollection(
        collectionData,
        documentsWithChunks,
      );

      // Assert
      expect(aggregate.id).toBe(collectionId);
      expect(aggregate.name).toBe('Test Collection');
      expect(aggregate.getDocumentCount()).toBe(1);
      expect(aggregate.hasDocument(docId)).toBe(true);

      const doc = aggregate.getDocument(docId);
      expect(doc?.key).toBe('doc1');
      expect(doc?.name).toBe('Document 1');
    });

    it('should create a collection without documents', () => {
      // Arrange
      const collectionData = {
        id: collectionId,
        name: 'Test Collection',
      };

      // Act
      const aggregate =
        AggregateFactory.createCompleteCollection(collectionData);

      // Assert
      expect(aggregate.id).toBe(collectionId);
      expect(aggregate.name).toBe('Test Collection');
      expect(aggregate.getDocumentCount()).toBe(0);
    });
  });

  describe('createDocumentFromRawData', () => {
    it('should create a document from raw data with chunks', () => {
      // Arrange
      const rawData = {
        id: docId,
        collectionId,
        key: 'test-doc',
        content: 'Test document content',
        name: 'Test Document',
        mime: 'text/plain',
        chunks: [
          {
            pointId,
            chunkIndex: 0,
            content: 'Chunk content',
            title: 'Chunk title',
            embedding: [0.1, 0.2, 0.3],
            titleChain: 'Title 1 > Title 2',
          },
        ],
      };

      // Act
      const aggregate = AggregateFactory.createDocumentFromRawData(rawData);

      // Assert
      expect(aggregate.id).toBe(docId);
      expect(aggregate.collectionId).toBe(collectionId);
      expect(aggregate.key).toBe('test-doc');
      expect(aggregate.name).toBe('Test Document');
      expect(aggregate.getChunkCount()).toBe(1);

      const chunk = aggregate.getChunk(pointId);
      expect(chunk?.contentValue).toBe('Chunk content');
      expect(chunk?.title).toBe('Chunk title');
      expect(chunk?.embeddingValue).toEqual([0.1, 0.2, 0.3]);
      expect(chunk?.titleChain).toBe('Title 1 > Title 2');
    });

    it('should create a document from raw data without chunks', () => {
      // Arrange
      const rawData = {
        id: docId,
        collectionId,
        key: 'test-doc',
        content: 'Test document content',
      };

      // Act
      const aggregate = AggregateFactory.createDocumentFromRawData(rawData);

      // Assert
      expect(aggregate.id).toBe(docId);
      expect(aggregate.collectionId).toBe(collectionId);
      expect(aggregate.key).toBe('test-doc');
      expect(aggregate.getChunkCount()).toBe(0);
    });
  });

  describe('validateCollectionAggregate', () => {
    it('should validate a correct collection aggregate', () => {
      // Arrange
      const aggregate = AggregateFactory.createCollection(
        collectionId,
        'Test Collection',
      );
      aggregate.addDocument(docId, 'test-doc', 'Test content');

      // Act
      const result = AggregateFactory.validateCollectionAggregate(aggregate);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect document-collection mismatch', () => {
      // Arrange
      const aggregate = AggregateFactory.createCollection(
        collectionId,
        'Test Collection',
      );
      const wrongDoc = Doc.create(
        docId,
        'wrong-collection' as CollectionId,
        'test-doc',
        'Test content',
      );
      (aggregate as any)._documents.set(docId, wrongDoc);

      // Act
      const result = AggregateFactory.validateCollectionAggregate(aggregate);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `Document ${docId} does not belong to collection ${collectionId}`,
      );
    });
  });

  describe('validateDocumentAggregate', () => {
    it('should validate a correct document aggregate', () => {
      // Arrange
      const aggregate = AggregateFactory.createDocument(
        docId,
        collectionId,
        'test-doc',
        'Test content',
      );
      aggregate.addChunk(pointId, 0, 'Chunk content');

      // Act
      const result = AggregateFactory.validateDocumentAggregate(aggregate);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect chunk-document mismatch', () => {
      // Arrange
      const aggregate = AggregateFactory.createDocument(
        docId,
        collectionId,
        'test-doc',
        'Test content',
      );
      const wrongChunk = Chunk.create(
        pointId,
        'wrong-doc' as DocId,
        collectionId,
        0,
        'Chunk content',
      );
      (aggregate as any)._chunks.set(pointId, wrongChunk);

      // Act
      const result = AggregateFactory.validateDocumentAggregate(aggregate);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `Chunk ${pointId} does not belong to document ${docId}`,
      );
    });
  });
});
