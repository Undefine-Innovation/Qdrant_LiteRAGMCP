import { jest, describe, test, expect, beforeEach, afterEach, beforeAll } from '@jest/globals';
import { validateConfig, AppConfig } from '../config.js';
import { ChunkWithVector } from '../src/db.js'; // ChunkWithVector is now from db.js

// ---- 全局 mock 容器 ----
const g = globalThis as any;
if (!g.__qdrantMocks__) {
  g.__qdrantMocks__ = {
    mockGetCollections: jest.fn(),
    mockCreateCollection: jest.fn(),
    mockUpsert: jest.fn(),
    mockSearch: jest.fn(),
  };
}
const { mockGetCollections, mockCreateCollection, mockUpsert, mockSearch } = g.__qdrantMocks__;

// ---- mock QdrantClient ----
jest.unstable_mockModule('@qdrant/js-client-rest', () => {
  const m = (globalThis as any).__qdrantMocks__;
  return {
    QdrantClient: jest.fn().mockImplementation(() => ({
      getCollections: m.mockGetCollections,
      createCollection: m.mockCreateCollection,
      upsert: m.mockUpsert,
      search: m.mockSearch,
    })),
  };
});

// ---- 动态导入被测模块 ----
const { ensureCollection, upsertChunks, http } = await import('../src/qdrant.js');
// We don't import 'search' from qdrant.js anymore, as it's a method of QdrantClient

describe('Qdrant Functions', () => {
  const collectionName = 'test_collection';
  const vectorDimension = 3;

  beforeAll(() => {
    // Mock config values
    process.env.QDRANT_COLLECTION = collectionName;
    process.env.EMBEDDING_DIM = vectorDimension.toString();
    process.env.QDRANT_URL = 'http://localhost:6333'; // Add a dummy QDRANT_URL for config validation
    process.env.OPENAI_API_KEY = 'dummy-key'; // Add dummy OpenAI key for config validation
    process.env.DB_PATH = './test.sqlite'; // Add dummy DB_PATH for config validation
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ensureCollection', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should create collection if it does not exist', async () => {
      mockGetCollections.mockResolvedValueOnce({ collections: [] }); // No collection exists
      mockCreateCollection.mockResolvedValueOnce({}); // Create succeeds

      const cfg = validateConfig();
      await ensureCollection();

      expect(mockGetCollections).toHaveBeenCalledTimes(1);
      expect(mockCreateCollection).toHaveBeenCalledTimes(1);
      expect(mockCreateCollection).toHaveBeenCalledWith(
        collectionName,
        expect.objectContaining({
          vectors: expect.objectContaining({ size: vectorDimension, distance: 'Cosine' }),
        }),
      );
    });

    test('should not create collection if it already exists', async () => {
      mockGetCollections.mockResolvedValueOnce({ collections: [{ name: collectionName }] }); // Collection exists

      const cfg = validateConfig();
      await ensureCollection();

      expect(mockGetCollections).toHaveBeenCalledTimes(1);
      expect(mockCreateCollection).not.toHaveBeenCalled();
    });

    test('should throw error if initial GET fails and PUT also fails', async () => {
      const errorMessage = 'Failed to create collection';
      mockGetCollections.mockRejectedValueOnce(new Error('Not Found')); // GET fails
      mockCreateCollection.mockRejectedValueOnce(new Error(errorMessage)); // PUT fails

      const cfg = validateConfig();
      await expect(ensureCollection()).rejects.toThrow(errorMessage);
      expect(mockGetCollections).toHaveBeenCalledTimes(1);
      expect(mockCreateCollection).toHaveBeenCalledTimes(1);
    });

    test('should throw error if final GET fails after successful PUT', async () => {
      const errorMessage = 'Failed to verify collection after creation';
      mockGetCollections.mockRejectedValueOnce(new Error('Not Found')); // First GET fails
      mockCreateCollection.mockResolvedValueOnce({}); // PUT succeeds
      mockGetCollections.mockRejectedValueOnce(new Error(errorMessage)); // Second GET fails

      const cfg = validateConfig();
      await expect(ensureCollection()).rejects.toThrow(errorMessage);
      expect(mockGetCollections).toHaveBeenCalledTimes(2);
      expect(mockCreateCollection).toHaveBeenCalledTimes(1);
    });
  });

  describe('upsertChunks', () => {
    test('should do nothing if no chunks are provided', async () => {
      await upsertChunks([]);
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    test('should upsert chunks in batches', async () => {
      const chunks: ChunkWithVector[] = Array(150).fill(0).map((_, i) => ({
        collectionId: 'col1',
        versionId: 'v1',
        docId: 'd1',
        chunkIndex: i,
        content: `content ${i}`,
        titleChain: `title ${i}`,
        vector: [i, i + 1, i + 2],
        pointId: `point-${i}`,
        created_at: Date.now(),
        contentHash: `hash-${i}`, // Add contentHash
      }));

      mockUpsert.mockResolvedValueOnce({ status: 'ok' });

      await upsertChunks(chunks);

      expect(mockUpsert).toHaveBeenCalledTimes(2);
      expect(mockUpsert).toHaveBeenCalledWith(collectionName, expect.objectContaining({
        wait: true,
        points: expect.arrayContaining([
          expect.objectContaining({
            payload: expect.objectContaining({ content: 'content 0' }),
          }),
        ]),
      }));
    });

    test('should handle upsert errors gracefully', async () => {
      const chunks: ChunkWithVector[] = [
        {
          collectionId: 'col1',
          versionId: 'v1',
          docId: 'd1',
          chunkIndex: 0,
          content: 'content 0', // Add content
          titleChain: 'title 0',
          vector: [0, 1, 2],
          pointId: 'point-0',
          created_at: Date.now(),
          contentHash: 'somehash',
        },
      ];
      const errorMessage = 'Upsert failed';
      mockUpsert.mockRejectedValueOnce(new Error(errorMessage));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await upsertChunks(chunks);

      expect(mockUpsert).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error upserting batch 1:'),
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });
  });

});
