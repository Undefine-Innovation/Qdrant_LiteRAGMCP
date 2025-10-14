import {
  hashContent,
  makeCollectionId,
  makeVersionId,
  makeDocId,
  makePointId,
  parsePointId,
} from '../share/utils/id.js';

describe('ID Generation and Hashing Functions', () => {
  describe('hashContent', () => {
    test('should generate a consistent SHA256 hash for a given string content', () => {
      const content1 = 'test content';
      const hash1 = hashContent(content1);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/); // SHA256 hash is 64 hex characters
      expect(hash1).toBe(hashContent(content1)); // Should be consistent

      const content2 = 'another test content';
      const hash2 = hashContent(content2);
      expect(hash2).not.toBe(hash1); // Different content, different hash
    });

    test('should generate a consistent SHA256 hash for Uint8Array content', () => {
      const content1 = Buffer.from('test content', 'utf8');
      const hash1 = hashContent(content1);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
      expect(hash1).toBe(hashContent(content1));

      const content2 = Buffer.from('another test content', 'utf8');
      const hash2 = hashContent(content2);
      expect(hash2).not.toBe(hash1);
    });

    test('should handle empty content', () => {
      const hash = hashContent('');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      expect(hash).toBe(hashContent(''));
    });
  });

  describe('makeCollectionId', () => {
    test('should generate a valid UUID', () => {
      const id = makeCollectionId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    test('should generate unique IDs', () => {
      const id1 = makeCollectionId();
      const id2 = makeCollectionId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('makeVersionId', () => {
    test('should generate a valid UUID', () => {
      const id = makeVersionId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    test('should generate unique IDs', () => {
      const id1 = makeVersionId();
      const id2 = makeVersionId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('makeDocId', () => {
    test('should generate a SHA256 hash from content', () => {
      const content = 'document content';
      const docId = makeDocId(content);
      expect(docId).toMatch(/^[0-9a-f]{64}$/);
      expect(docId).toBe(hashContent(content)); // Should delegate to hashContent
    });
  });

  describe('makePointId and parsePointId', () => {
    const mockDocId = hashContent('test-doc-content'); // Generate a valid SHA256 hash
    const chunkIndex = 5;

    test('makePointId should generate a valid point ID', () => {
      const pointId = makePointId(mockDocId, chunkIndex);
      expect(pointId).toBe(`${mockDocId}#${chunkIndex}`);
    });

    test('parsePointId should correctly parse a valid point ID', () => {
      const pointId = makePointId(mockDocId, chunkIndex);
      const parsed = parsePointId(pointId);
      expect(parsed).toEqual({ docId: mockDocId, chunkIndex: chunkIndex });
    });

    test('makePointId should throw error for invalid docId', () => {
      expect(() => makePointId('invalid-doc-id', chunkIndex)).toThrow('makePointId: invalid docId');
    });

    test('makePointId should throw error for invalid chunkIndex', () => {
      expect(() => makePointId(mockDocId, -1)).toThrow('makePointId: invalid chunkIndex');
      expect(() => makePointId(mockDocId, 1.5)).toThrow('makePointId: invalid chunkIndex');
    });

    test('parsePointId should throw error for invalid pointId format', () => {
      expect(() => parsePointId('invalid-point-id')).toThrow('parsePointId: invalid pointId');
      expect(() => parsePointId('docId#abc')).toThrow('parsePointId: invalid pointId');
      expect(() => parsePointId('invalid-doc-id#1')).toThrow('parsePointId: invalid pointId');
    });
  });
});