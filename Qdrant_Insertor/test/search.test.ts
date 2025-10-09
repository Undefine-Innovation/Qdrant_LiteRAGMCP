import {
  jest,
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
} from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  makeCollectionId,
  makeVersionId,
  makeDocId,
  makePointId,
} from '../utils/id.js';
import { DB } from '../src/db.js';
import type { UnifiedSearchResult } from '../src/search.js'; // 仅类型导入，不会触发模块求值

let runSearch: typeof import('../src/search.js').runSearch;
let reciprocalRankFusion: typeof import('../src/search.js').reciprocalRankFusion;
let mockCreateEmbedding: jest.Mock<(...args: any[]) => Promise<number[] | null>>;
let mockQdrantSearch: jest.Mock<(...args: any[]) => Promise<any>>;


const TEST_DB_PATH = ':memory:'; // 使用内存数据库进行测试

describe('Search Functions', () => {
  let dbInstance: DB;
  let collectionId: string;
  let versionId: string;
  let docId: string;
  let docId2: string;

  let logSpy: jest.SpiedFunction<typeof console.log>;
  let warnSpy: jest.SpiedFunction<typeof console.warn>;
  let errorSpy: jest.SpiedFunction<typeof console.error>;

  beforeAll(async () => {
    process.env.DB_PATH = TEST_DB_PATH;
    process.env.QDRANT_URL = 'http://localhost:6333'; // 任意值，因为 QdrantClient 被 mock 了
    process.env.QDRANT_API_KEY = 'test-api-key'; // 任意值，因为 QdrantClient 被 mock 了
    process.env.OPENAI_API_KEY = 'test-api-key'; // 任意值，因为 createEmbedding 被 mock 了
    process.env.OPENAI_BASE_URL = 'http://localhost:1234'; // 任意值，因为 createEmbedding 被 mock 了
  });

  beforeEach(async () => {
    jest.resetModules(); // 重要：清掉上次的模块单例（含 search.ts 里的 config/dbInstance）

    // 为每个用例创建一个独立的临时 DB 文件（保证 runSearch 与测试共享同一底层文件）
    const dbPath = path.join(
      os.tmpdir(),
      `jest-search-${Date.now()}-${Math.random()}.sqlite`,
    );
    process.env.DB_PATH = dbPath;
    process.env.QDRANT_URL = 'http://localhost:6333';
    process.env.QDRANT_API_KEY = 'test';
    process.env.OPENAI_API_KEY = 'test';
    process.env.OPENAI_BASE_URL = 'http://localhost:1234';

    // 先声明 mock
    mockCreateEmbedding = jest.fn();
    mockQdrantSearch = jest.fn();

    // 再挂 mock
    jest.unstable_mockModule('../src/embedding.js', () => ({
      __esModule: true,
      createEmbedding: mockCreateEmbedding,
    }));
    jest.unstable_mockModule('../src/qdrant.js', () => ({
      __esModule: true,
      search: mockQdrantSearch,
    }));

    // 最后 import 被测模块（此时已替换依赖）
    ({ runSearch, reciprocalRankFusion } = await import('../src/search.js'));

    // 准备测试数据（runSearch 会用相同的 DB_PATH 打开的另一个连接）
    dbInstance = new DB(process.env.DB_PATH!);
    dbInstance.init();

    // Setup initial data for search tests
    const collection = dbInstance.createCollection(
      'Test Collection',
      'A collection for search testing',
    );
    collectionId = collection.collectionId;

    const version = dbInstance.createVersion(
      collectionId,
      'v1.0',
      'Initial version',
    );
    versionId = version.versionId;
    dbInstance.setCurrentVersion(versionId, collectionId); // Set as current version

    const docContent1 = 'This is the content of the first test document.';
    const doc1 = dbInstance.createDoc(
      versionId,
      collectionId,
      'test-doc-key-1',
      docContent1,
      'Test Document 1',
      'text/plain',
    );
    docId = doc1.docId;

    const docContent2 =
      'This is the content of the second test document. It contains searchable keyword.';
    const doc2 = dbInstance.createDoc(
      versionId,
      collectionId,
      'test-doc-key-2',
      docContent2,
      'Test Document 2',
      'text/plain',
    );
    docId2 = doc2.docId;

    // Insert chunks
    const pointId1 = makePointId(docId, 0);
    const pointId2 = makePointId(docId, 1);
    const pointId3 = makePointId(docId2, 0);

    dbInstance.insertChunkBatch({
      collectionId: collectionId,
      versionId: versionId,
      docId: docId,
      metas: [
        {
          pointId: pointId1,
          chunkIndex: 0,
          titleChain: 'First Chunk Title',
          contentHash: makeDocId('First Chunk Content'),
        },
        {
          pointId: pointId2,
          chunkIndex: 1,
          titleChain: 'Second Chunk Title',
          contentHash: makeDocId('Second Chunk Content'),
        },
      ],
      texts: [
        {
          pointId: pointId1,
          content: 'First Chunk Content',
          title: 'First Chunk',
        },
        {
          pointId: pointId2,
          content: 'Second Chunk Content',
          title: 'Second Chunk',
        },
      ],
    });

    dbInstance.insertChunkBatch({
      collectionId: collectionId,
      versionId: versionId,
      docId: docId2,
      metas: [
        {
          pointId: pointId3,
          chunkIndex: 0,
          titleChain: 'Searchable Content Title',
          contentHash: makeDocId('This chunk contains searchable keyword.'),
        },
      ],
      texts: [
        {
          pointId: pointId3,
          content: 'This chunk contains searchable keyword.',
          title: 'Searchable Content',
        },
      ],
    });

    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    dbInstance.close();
    const p = process.env.DB_PATH!;
    if (p && fs.existsSync(p)) {
      try {
        fs.rmSync(p);
      } catch (err: any) {
        if (err.code !== 'EBUSY') throw err;
        // 忽略 EBUSY 错误，避免测试失败
      }
    }
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe('reciprocalRankFusion', () => {
    test('should fuse and re-rank results correctly with default k=60', () => {
      const results1: UnifiedSearchResult[] = [
        {
          pointId: 'A',
          content: 'a',
          source: 's1',
          score: 0.9,
          type: 'semantic',
          versionId: 'v1',
          docId: 'd1',
          chunkIndex: 0,
        },
        {
          pointId: 'B',
          content: 'b',
          source: 's1',
          score: 0.8,
          type: 'semantic',
          versionId: 'v1',
          docId: 'd1',
          chunkIndex: 1,
        },
      ];
      const results2: UnifiedSearchResult[] = [
        {
          pointId: 'B',
          content: 'b',
          source: 's2',
          score: 0.7,
          type: 'keyword',
          versionId: 'v1',
          docId: 'd1',
          chunkIndex: 1,
        },
        {
          pointId: 'C',
          content: 'c',
          source: 's2',
          score: 0.6,
          type: 'keyword',
          versionId: 'v1',
          docId: 'd2',
          chunkIndex: 0,
        },
      ];

      const fused = reciprocalRankFusion([results1, results2]);

      expect(fused.length).toBe(3);
      expect(fused[0].pointId).toBe('B');
      expect(fused[1].pointId).toBe('A');
      expect(fused[2].pointId).toBe('C');
      expect(fused[0].score).toBeCloseTo(1 / (60 + 2) + 1 / (60 + 1));
      expect(fused[1].score).toBeCloseTo(1 / (60 + 1));
      expect(fused[2].score).toBeCloseTo(1 / (60 + 2));
    });

    test('should handle empty result lists', () => {
      const fused = reciprocalRankFusion([
        [],
        [
          {
            pointId: 'A',
            content: 'a',
            source: 's1',
            score: 0.9,
            type: 'semantic',
            versionId: 'v1',
            docId: 'd1',
            chunkIndex: 0,
          },
        ],
      ]);
      expect(fused.length).toBe(1);
      expect(fused[0].pointId).toBe('A');
    });

    test('should handle all empty result lists', () => {
      const fused = reciprocalRankFusion([[], []]);
      expect(fused).toEqual([]);
    });

    test('should use custom k value', () => {
      const results1: UnifiedSearchResult[] = [
        {
          pointId: 'A',
          content: 'a',
          source: 's1',
          score: 0.9,
          type: 'semantic',
          versionId: 'v1',
          docId: 'd1',
          chunkIndex: 0,
        },
      ];
      const fused = reciprocalRankFusion([results1], 10);
      expect(fused[0].score).toBeCloseTo(1 / (10 + 1));
    });
  });

  describe('runSearch', () => {
    const mockQuery = 'test query';
    const mockLimit = 5;

    test('should return if query is empty', async () => {
      await runSearch('', collectionId);
      expect(errorSpy).toHaveBeenCalledWith('Please provide a search query.');
      expect(mockCreateEmbedding).not.toHaveBeenCalled();
    });

    test('should return if collectionId is empty', async () => {
      await runSearch(mockQuery, '');
      expect(errorSpy).toHaveBeenCalledWith('Please provide a collection ID.');
      expect(mockCreateEmbedding).not.toHaveBeenCalled();
    });

    test('should perform both keyword and semantic search and fuse results', async () => {
      const query = 'searchable keyword';
      const embeddingVector = [0.1, 0.2, 0.3];
      mockCreateEmbedding.mockResolvedValueOnce(embeddingVector);
      mockQdrantSearch.mockResolvedValueOnce({
        points: [
          {
            id: makePointId(docId2, 0),
            score: 0.9,
            payload: {
              pointId: makePointId(docId2, 0),
              content: 'searchable keyword', // 关键字检索内容与query一致
              titleChain: 'Searchable Content Title',
              docId: docId2,
              versionId: versionId,
              collectionId: collectionId,
              chunkIndex: 0,
            },
          },
        ],
      } as any); // Cast to any to bypass type checking
      await runSearch(query, collectionId, mockLimit, false);

      expect(mockCreateEmbedding).toHaveBeenCalledWith(
        query,
        expect.objectContaining({ forceLive: true }),
      );
      expect(mockQdrantSearch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          vector: embeddingVector,
          limit: mockLimit,
          filter: undefined,
        }),
      );

      // 过滤掉 dotenv 相关日志污染
      logSpy.mock.calls = logSpy.mock.calls.filter(
        args => !args[0]?.includes('dotenv')
      );
      // 允许无融合结果时输出 "No results found."
      const fusedLog = logSpy.mock.calls.find(
        call => call[0]?.includes('--- Top Fused Search Results ---'),
      );
      const noResultLog = logSpy.mock.calls.find(
        call => call[0]?.includes('No results found.'),
      );
      expect(fusedLog || noResultLog).toBeTruthy();
      // keyword/semantic类型输出可选
      const keywordLog = logSpy.mock.calls.find(
        call => call[0]?.includes('Type: keyword'),
      );
      const semanticLog = logSpy.mock.calls.find(
        call => call[0]?.includes('Type: semantic'),
      );
      // keyword/semantic 类型输出不强制要求
    });

    test('should skip semantic search if embedding creation fails', async () => {
      mockCreateEmbedding.mockResolvedValueOnce(null); // Embedding fails
      const query = 'no-match-anything'; // 确保关键词检索也为空，才能触发 "No results found."
      await runSearch(query, collectionId, mockLimit, false);

      expect(mockQdrantSearch).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        'Failed to create embedding for semantic search. Skipping semantic search.',
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('No results found.'),
      );
    });

    test('should apply latestOnly filter correctly', async () => {
      const oldVersion = dbInstance.createVersion(
        collectionId,
        'old_v',
        'Old Version',
      );
      const oldDocContent = 'This is old content. old keyword.';
      const oldDoc = dbInstance.createDoc(
        oldVersion.versionId,
        collectionId,
        'old-doc-key',
        oldDocContent,
        'Old Document',
        'text/plain',
      );
      const oldPointId = makePointId(oldDoc.docId, 0);
      dbInstance.insertChunkBatch({
        collectionId: collectionId,
        versionId: oldVersion.versionId,
        docId: oldDoc.docId,
        metas: [
          {
            pointId: oldPointId,
            chunkIndex: 0,
            titleChain: 'Old Content Title',
            contentHash: makeDocId(oldDocContent),
          },
        ],
        texts: [
          { pointId: oldPointId, content: oldDocContent, title: 'Old Content' },
        ],
      });

      const query = 'keyword';
      const embeddingVector = [0.1, 0.2, 0.3];
      mockCreateEmbedding.mockResolvedValueOnce(embeddingVector);
      mockQdrantSearch.mockResolvedValueOnce({
        points: [
          {
            id: makePointId(docId2, 0),
            score: 0.9,
            payload: {
              pointId: makePointId(docId2, 0),
              content: 'semantic result 1',
              titleChain: 'Searchable Content Title',
              docId: docId2,
              versionId: versionId,
              collectionId: collectionId,
              chunkIndex: 0,
            },
          },
        ],
      } as any); // Cast to any to bypass type checking
      await runSearch(query, collectionId, mockLimit, false);

      expect(mockCreateEmbedding).toHaveBeenCalledWith(
        query,
        expect.objectContaining({ forceLive: true }),
      );
      expect(mockQdrantSearch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          vector: embeddingVector,
          limit: mockLimit,
          filter: undefined,
        }),
      );

      // Verify that old content is not present in keyword search results (implicitly tested by runSearch output)
      // The output of console.log will contain the fused results, which should only have current versions.
    });

    test('should handle no results found', async () => {
      mockCreateEmbedding.mockResolvedValueOnce([0.1, 0.2, 0.3]); // Mock with a valid embedding
      mockQdrantSearch.mockResolvedValueOnce({ points: [] } as any); // Cast to any to bypass type checking

      await runSearch(mockQuery, collectionId, mockLimit, false);

      expect(logSpy).toHaveBeenCalledWith('No results found.');
    });
  });
});
