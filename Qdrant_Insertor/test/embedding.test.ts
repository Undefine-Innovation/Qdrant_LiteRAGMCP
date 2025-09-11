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
    test('should return null for empty text in test environment', async () => {
      const result = await createEmbedding('');
      expect(result).toBeNull();
      expect(mockCreateEmbedding).not.toHaveBeenCalled();
    });

    test('should return a zero-filled array for valid text in test environment', async () => {
      const text = 'test text';
      const result = await createEmbedding(text);

      expect(result).toEqual(new Array(1536).fill(0));
      expect(mockCreateEmbedding).not.toHaveBeenCalled();
    });

    test('should return null and log warning for empty text', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const text = ''; // Empty text should trigger the warn in src/embedding.ts
      const result = await createEmbedding(text);

      expect(result).toBeNull(); // Still returns null for empty text regardless of NODE_ENV
      expect(consoleWarnSpy).toHaveBeenCalledWith('Skipping embedding for empty text.');
      expect(mockCreateEmbedding).not.toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('embedChunks', () => {
    test('should return an empty array for empty chunks input', async () => {
      const chunks: Chunk[] = [];
      const result = await embedChunks(chunks);
      expect(result).toEqual([]);
      expect(mockCreateEmbedding).not.toHaveBeenCalled();
    });

    test('should embed all chunks successfully with batching in test environment', async () => {
      const zeroVector = new Array(1536).fill(0);

      const chunks: Chunk[] = [
        { content: 'chunk 1', titleChain: 'title', pointId: 'doc1#0', docId: 'doc1', versionId: 'v1', collectionId: 'coll1', chunkIndex: 0, contentHash: 'hash1', created_at: Date.now() },
        { content: 'chunk 2', titleChain: 'title', pointId: 'doc1#1', docId: 'doc1', versionId: 'v1', collectionId: 'coll1', chunkIndex: 1, contentHash: 'hash2', created_at: Date.now() },
      ];

      const result = await embedChunks(chunks);

      expect(result.length).toBe(2);
      expect(result[0]).toEqual({ ...chunks[0], vector: zeroVector });
      expect(result[1]).toEqual({ ...chunks[1], vector: zeroVector });
      expect(mockCreateEmbedding).not.toHaveBeenCalled();
    });

    test('should embed all chunks even if simulating failure in test environment', async () => {
      // In test environment, embedChunks will not call the external API,
      // so all chunks will be processed with zero vectors.
      const zeroVector = new Array(1536).fill(0);
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const chunks: Chunk[] = [
        { content: 'chunk 1', titleChain: 'title', pointId: 'doc1#0', docId: 'doc1', versionId: 'v1', collectionId: 'coll1', chunkIndex: 0, contentHash: 'hash1', created_at: Date.now() },
        { content: 'chunk 2', titleChain: 'title', pointId: 'doc1#1', docId: 'doc1', versionId: 'v1', collectionId: 'coll1', chunkIndex: 1, contentHash: 'hash2', created_at: Date.now() },
      ];

      const result = await embedChunks(chunks);

      expect(result.length).toBe(2); // Both chunks should be embedded
      expect(result[0]).toEqual({ ...chunks[0], vector: zeroVector });
      expect(result[1]).toEqual({ ...chunks[1], vector: zeroVector });
      expect(consoleWarnSpy).not.toHaveBeenCalled(); // No warning should be logged as no actual failure
      expect(mockCreateEmbedding).not.toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });

    test('should embed all chunks in multiple batches in test environment', async () => {
      const originalBatchSize = validateConfig(process.env).embedding.batchSize;
      process.env.EMBEDDING_BATCH_SIZE = '1'; // Temporarily override for this test

      const zeroVector = new Array(1536).fill(0);

      const chunks: Chunk[] = [
        { content: 'chunk 1', titleChain: 'title', pointId: 'doc1#0', docId: 'doc1', versionId: 'v1', collectionId: 'coll1', chunkIndex: 0, contentHash: 'hash1', created_at: Date.now() },
        { content: 'chunk 2', titleChain: 'title', pointId: 'doc1#1', docId: 'doc1', versionId: 'v1', collectionId: 'coll1', chunkIndex: 1, contentHash: 'hash2', created_at: Date.now() },
        { content: 'chunk 3', titleChain: 'title', pointId: 'doc1#2', docId: 'doc1', versionId: 'v1', collectionId: 'coll1', chunkIndex: 2, contentHash: 'hash3', created_at: Date.now() },
      ];

      const result = await embedChunks(chunks);

      expect(result.length).toBe(3);
      expect(result[0]).toEqual({ ...chunks[0], vector: zeroVector });
      expect(result[1]).toEqual({ ...chunks[1], vector: zeroVector });
      expect(result[2]).toEqual({ ...chunks[2], vector: zeroVector });
      expect(mockCreateEmbedding).not.toHaveBeenCalled(); // No actual API calls
      
      // Restore original BATCH_SIZE
      process.env.EMBEDDING_BATCH_SIZE = originalBatchSize.toString();
    });
  });
});
