import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { DocumentChunk } from '../src/splitter.js';
import { validateConfig, AppConfig } from '../config.js';
import { Chunk } from '../src/db.js'; // Import Chunk type

// ---- 全局 mock 容器（避免重复声明） ----
const g = globalThis as any;
if (!g.__openaiMocks__) {
  g.__openaiMocks__ = { mockCreateEmbedding: jest.fn() };
}
const { mockCreateEmbedding } = g.__openaiMocks__;

// ---- mock openai ----
jest.unstable_mockModule('openai', () => {
  const m = (globalThis as any).__openaiMocks__;
  class OpenAI {
    embeddings = { create: m.mockCreateEmbedding };
  }
  return { default: OpenAI };
});

// ---- 动态导入被测模块 ----
let createEmbedding: typeof import('../src/embedding.js').createEmbedding;
let embedChunks: typeof import('../src/embedding.js').embedChunks;

beforeAll(async () => {
  process.env = {
    ...process.env,
    OPENAI_API_KEY: 'test-key',
    DB_PATH: './test.sqlite',
    QDRANT_URL: 'http://localhost:6333',
    EMBEDDING_DIM: '3',
    QDRANT_COLLECTION: 'test_collection',
    EMBEDDING_BATCH_SIZE: '100',
  };
  ({ createEmbedding, embedChunks } = await import('../src/embedding.js'));
});

beforeEach(() => {
  mockCreateEmbedding.mockReset();
});
afterEach(() => {
  jest.clearAllMocks();
});

describe('Embedding Functions', () => {
  describe('createEmbedding', () => {
    test('should return null for empty text', async () => {
      const result = await createEmbedding('');
      expect(result).toBeNull();
      expect(mockCreateEmbedding).not.toHaveBeenCalled();
    });

    test('should return an embedding for valid text', async () => {
      const mockVector = [0.1, 0.2, 0.3];
      mockCreateEmbedding.mockResolvedValueOnce({
        data: [{ embedding: mockVector }],
      });

      const text = 'test text';
      const result = await createEmbedding(text);

      expect(result).toEqual(mockVector);
      const cfg = validateConfig();
      expect(mockCreateEmbedding).toHaveBeenCalledWith({
        model: cfg.openai.model,
        input: text,
      });
    });

    test('should return null and log error on API failure', async () => {
      const errorMessage = 'API error';
      mockCreateEmbedding.mockRejectedValueOnce(new Error(errorMessage));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const text = 'test text';
      const result = await createEmbedding(text);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error creating embedding:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });
  });

  describe('embedChunks', () => {
    test('should return an empty array for empty chunks input', async () => {
      const chunks: Chunk[] = [];
      const result = await embedChunks(chunks);
      expect(result).toEqual([]);
      expect(mockCreateEmbedding).not.toHaveBeenCalled();
    });

    test('should embed all chunks successfully with batching', async () => {
      const mockVectors = [
        [0.1, 0.2],
        [0.3, 0.4],
      ];
      // Mock a single batch call for multiple chunks
      mockCreateEmbedding.mockResolvedValueOnce({
        data: [{ embedding: mockVectors[0] }, { embedding: mockVectors[1] }],
      });

      const chunks: Chunk[] = [
        { content: 'chunk 1', titleChain: 'title', pointId: 'doc1#0', docId: 'doc1', versionId: 'v1', collectionId: 'coll1', chunkIndex: 0, contentHash: 'hash1', created_at: Date.now() },
        { content: 'chunk 2', titleChain: 'title', pointId: 'doc1#1', docId: 'doc1', versionId: 'v1', collectionId: 'coll1', chunkIndex: 1, contentHash: 'hash2', created_at: Date.now() },
      ];

      const result = await embedChunks(chunks);

      expect(result.length).toBe(2);
      expect(result[0]).toEqual({ ...chunks[0], vector: mockVectors[0] });
      expect(result[1]).toEqual({ ...chunks[1], vector: mockVectors[1] });
      expect(mockCreateEmbedding).toHaveBeenCalledTimes(1); // Only one batch call
      const cfg = validateConfig();
      expect(mockCreateEmbedding).toHaveBeenCalledWith({
        model: cfg.openai.model,
        input: ['chunk 1', 'chunk 2'], // Input should be an array of texts
      });
    });

    test('should skip chunks that fail embedding', async () => {
      const mockVector1 = [0.1, 0.2];
      const mockVector2 = [0.3, 0.4];

      // Simulate a batch where the first embedding succeeds and the second fails (returns null)
      mockCreateEmbedding.mockResolvedValueOnce({
        data: [{ embedding: mockVector1 }, { embedding: null }], // Simulate partial failure
      });
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const chunks: Chunk[] = [
        { content: 'chunk 1', titleChain: 'title', pointId: 'doc1#0', docId: 'doc1', versionId: 'v1', collectionId: 'coll1', chunkIndex: 0, contentHash: 'hash1', created_at: Date.now() },
        { content: 'chunk 2', titleChain: 'title', pointId: 'doc1#1', docId: 'doc1', versionId: 'v1', collectionId: 'coll1', chunkIndex: 1, contentHash: 'hash2', created_at: Date.now() },
      ];
      // Temporarily override BATCH_SIZE for this test
      const cfg = validateConfig();
      const originalBatchSize = cfg.embedding.batchSize;
      // Temporarily override BATCH_SIZE for this test
      // For mocking purposes, we can directly set the batch size or ensure the mock reflects it.
      // Since embedChunks uses config.embedding.batchSize, we need to ensure this is mocked or set.
      // For this test, we'll assume the mock handles batching, or we adjust the test logic.
      // Given the previous change, config.embedding.batchSize is now read from validateConfig().
      // For this specific test, we need to ensure embedChunks uses a batch size of 2.
      // This might require re-importing embedChunks after setting env vars, or directly mocking the config.
      // For simplicity, let's assume the mock will be flexible, or we'll adjust the actual config.

      const result = await embedChunks(chunks);

      expect(result.length).toBe(1); // Only one chunk should be embedded
      expect(result[0]).toEqual({ ...chunks[0], vector: mockVector1 });
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping chunk in batch 0 at index 1 due to missing embedding.'));
      expect(mockCreateEmbedding).toHaveBeenCalledTimes(1);
      process.env.EMBEDDING_BATCH_SIZE = originalBatchSize.toString(); // Restore original BATCH_SIZE
      consoleWarnSpy.mockRestore();
    });

    test('should embed chunks in multiple batches if exceeding batch size', async () => {
      // Temporarily override BATCH_SIZE for this test
      const originalBatchSize = validateConfig(process.env).embedding.batchSize;
      process.env.EMBEDDING_BATCH_SIZE = '1'; // Temporarily override for this test

      const mockVectors = [
        [0.1, 0.2],
        [0.3, 0.4],
        [0.5, 0.6],
      ];
      mockCreateEmbedding
        .mockResolvedValueOnce({ data: [{ embedding: mockVectors[0] }] })
        .mockResolvedValueOnce({ data: [{ embedding: mockVectors[1] }] })
        .mockResolvedValueOnce({ data: [{ embedding: mockVectors[2] }] });

      const chunks: Chunk[] = [
        { content: 'chunk 1', titleChain: 'title', pointId: 'doc1#0', docId: 'doc1', versionId: 'v1', collectionId: 'coll1', chunkIndex: 0, contentHash: 'hash1', created_at: Date.now() },
        { content: 'chunk 2', titleChain: 'title', pointId: 'doc1#1', docId: 'doc1', versionId: 'v1', collectionId: 'coll1', chunkIndex: 1, contentHash: 'hash2', created_at: Date.now() },
        { content: 'chunk 3', titleChain: 'title', pointId: 'doc1#2', docId: 'doc1', versionId: 'v1', collectionId: 'coll1', chunkIndex: 2, contentHash: 'hash3', created_at: Date.now() },
      ];

      const result = await embedChunks(chunks);

      expect(result.length).toBe(3);
      expect(result[0]).toEqual({ ...chunks[0], vector: mockVectors[0] });
      expect(result[1]).toEqual({ ...chunks[1], vector: mockVectors[1] });
      expect(result[2]).toEqual({ ...chunks[2], vector: mockVectors[2] });
      expect(mockCreateEmbedding).toHaveBeenCalledTimes(3); // Three batch calls due to batchSize = 1
      const cfg = validateConfig();
      expect(mockCreateEmbedding).toHaveBeenCalledWith({
        model: cfg.openai.model,
        input: ['chunk 1'],
      });
      expect(mockCreateEmbedding).toHaveBeenCalledWith({
        model: cfg.openai.model,
        input: ['chunk 2'],
      });
      expect(mockCreateEmbedding).toHaveBeenCalledWith({
        model: cfg.openai.model,
        input: ['chunk 3'],
      });

      // Restore original BATCH_SIZE
      process.env.EMBEDDING_BATCH_SIZE = originalBatchSize.toString(); // Restore original BATCH_SIZE
    });
  });
});
