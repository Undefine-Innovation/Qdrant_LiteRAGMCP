/**
 * 搜索API端到端测试
 * 测试搜索相关的所有API端点
 */

import {
  describe,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
  it,
  expect,
  jest,
} from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { DataSource } from 'typeorm';
import { Collection } from '@infrastructure/database/entities/Collection.js';
import { Doc } from '@infrastructure/database/entities/Doc.js';
import { Chunk } from '@infrastructure/database/entities/Chunk.js';
import { ChunkFullText } from '@infrastructure/database/entities/ChunkFullText.js';
import {
  createApiTestEnvironment,
  ApiTestUtils,
  ApiTestDataFactory,
  resetTestDatabase,
} from './api-test-setup.test.js';

describe('Search API E2E Tests', () => {
  let testEnv: {
    app: express.Application;
    dataSource: DataSource;
    config: any;
    logger: any;
  };
  let testCollection: Collection;
  let testDocuments: Doc[];
  let testChunks: Chunk[];

  beforeAll(async () => {
    // 创建测试环境
    testEnv = await createApiTestEnvironment();
  });

  afterAll(async () => {
    // 清理测试环境
    if (testEnv?.dataSource && testEnv.dataSource.isInitialized) {
      await testEnv.dataSource.destroy();
      // 清理全局测试数据源引用
      (globalThis as any).__TEST_DATASOURCE = null;
    }
  });

  beforeEach(async () => {
    // 重置测试数据库
    await resetTestDatabase();
    jest.clearAllMocks();

    // 创建测试数据
    await createTestData();
  });

  afterEach(async () => {
    // 清理测试数据 - 使用DELETE而不是clear()以避免连接问题
    if (testEnv?.dataSource && testEnv.dataSource.isInitialized) {
      try {
        const tableNames = ['chunks_fulltext', 'chunks', 'docs', 'collections'];
        for (const tableName of tableNames) {
          try {
            await testEnv.dataSource.query(`DELETE FROM ${tableName}`);
          } catch (error) {
            // 表可能不存在，忽略错误
          }
        }
      } catch (error) {
        console.error('Error cleaning up test data:', error);
        // 继续运行测试，即使清理失败
      }
    }
  });

  async function createTestData() {
    const collectionRepository = testEnv.dataSource.getRepository(Collection);
    const docRepository = testEnv.dataSource.getRepository(Doc);
    const chunkRepository = testEnv.dataSource.getRepository(Chunk);
    const ftsRepository = testEnv.dataSource.getRepository(ChunkFullText);

    // 创建测试集合
    const collectionData = ApiTestDataFactory.createCollectionData({
      name: 'Search Test Collection',
    });
    testCollection = collectionRepository.create(collectionData);
    testCollection = await collectionRepository.save(testCollection);

    // 创建测试文档
    const documentsData = [
      ApiTestDataFactory.createDocumentData({
        name: 'AI Research Paper',
        collectionId: testCollection.id,
        content:
          'This paper discusses artificial intelligence and machine learning',
      }),
      ApiTestDataFactory.createDocumentData({
        name: 'Web Development Guide',
        collectionId: testCollection.id,
        content: 'A comprehensive guide to modern web development technologies',
      }),
      ApiTestDataFactory.createDocumentData({
        name: 'Database Design Patterns',
        collectionId: testCollection.id,
        content: 'Common patterns and best practices for database design',
      }),
    ];

    testDocuments = [];
    for (const docData of documentsData) {
      const doc = docRepository.create(docData);
      const savedDoc = await docRepository.save(doc);
      testDocuments.push(savedDoc);
    }

    // 创建测试块
    const chunksData = [
      {
        docId: testDocuments[0].id,
        collectionId: testCollection.id,
        pointId: `point-${testDocuments[0].id}-0`,
        chunkIndex: 0,
        title: 'Introduction to AI',
        content:
          'Artificial intelligence is a rapidly evolving field that encompasses machine learning, neural networks, and deep learning technologies.',
        contentLength: 147,
      },
      {
        docId: testDocuments[0].id,
        collectionId: testCollection.id,
        pointId: `point-${testDocuments[0].id}-1`,
        chunkIndex: 1,
        title: 'Machine Learning Basics',
        content:
          'Machine learning algorithms enable computers to learn from data without being explicitly programmed.',
        contentLength: 103,
      },
      {
        docId: testDocuments[1].id,
        collectionId: testCollection.id,
        pointId: `point-${testDocuments[1].id}-0`,
        chunkIndex: 0,
        title: 'HTML and CSS',
        content:
          'HTML provides structure of web pages while CSS handles presentation and styling.',
        contentLength: 89,
      },
      {
        docId: testDocuments[1].id,
        collectionId: testCollection.id,
        pointId: `point-${testDocuments[1].id}-1`,
        chunkIndex: 1,
        title: 'JavaScript Frameworks',
        content:
          'Modern JavaScript frameworks like React, Vue, and Angular simplify complex web application development.',
        contentLength: 108,
      },
      {
        docId: testDocuments[2].id,
        collectionId: testCollection.id,
        pointId: `point-${testDocuments[2].id}-0`,
        chunkIndex: 0,
        title: 'Normalization',
        content:
          'Database normalization is the process of organizing data to reduce redundancy and improve data integrity.',
        contentLength: 115,
      },
    ];

    testChunks = [];
    for (const chunkData of chunksData) {
      const chunk = chunkRepository.create(chunkData);
      const savedChunk = await chunkRepository.save(chunk);
      testChunks.push(savedChunk);

      // 创建全文搜索数据
      const ftsData = ftsRepository.create({
        id: savedChunk.id,
        chunkId: savedChunk.id,
        docId: savedChunk.docId,
        collectionId: savedChunk.collectionId,
        chunkIndex: savedChunk.chunkIndex,
        title: savedChunk.title,
        content: savedChunk.content,
        contentLength: savedChunk.contentLength,
      });
      await ftsRepository.save(ftsData);
    }
  }

  describe('POST /api/search', () => {
    it('应该执行搜索并返回结果', async () => {
      // Arrange
      const searchQuery = ApiTestDataFactory.createSearchQuery({
        q: 'artificial intelligence',
        collectionId: testCollection.id,
      });

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post('/api/search')
        .send(searchQuery);

      // Assert
      ApiTestUtils.validateApiResponse(response, 200, [
        'results',
        'total',
        'query',
      ]);
      expect(response.body.query).toBe(searchQuery.q);
      expect(Array.isArray(response.body.results)).toBe(true);
      expect(typeof response.body.total).toBe('number');
    });

    it('应该支持限制结果数量', async () => {
      // Arrange
      const searchQuery = ApiTestDataFactory.createSearchQuery({
        q: 'machine learning',
        collectionId: testCollection.id,
        limit: 5,
      });

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post('/api/search')
        .send(searchQuery);

      // Assert
      ApiTestUtils.validateApiResponse(response, 200);
      expect(response.body.results.length).toBeLessThanOrEqual(5);
    });

    it('应该拒绝缺少查询字符串的请求', async () => {
      // Arrange
      const searchQuery = {
        collectionId: testCollection.id,
        limit: 10,
      };

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post('/api/search')
        .send(searchQuery);

      // Assert
      ApiTestUtils.validateErrorResponse(response, 400, 'VALIDATION_ERROR');
    });

    it.skip('应该拒绝缺少集合ID的请求 - SKIPPED: collectionId现在是可选的', async () => {
      // Arrange
      const searchQuery = {
        q: 'test query',
        limit: 10,
      };

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post('/api/search')
        .send(searchQuery);

      // Assert
      ApiTestUtils.validateErrorResponse(response, 400, 'VALIDATION_ERROR');
    });

    it('应该处理空搜索结果', async () => {
      // Arrange
      const searchQuery = ApiTestDataFactory.createSearchQuery({
        q: 'nonexistent term',
        collectionId: testCollection.id,
      });

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post('/api/search')
        .send(searchQuery);

      // Assert
      ApiTestUtils.validateApiResponse(response, 200);
      expect(response.body.results).toHaveLength(0);
      expect(response.body.total).toBe(0);
    });

    it.skip('应该验证集合ID存在 - SKIPPED: collectionId可选，不存在的集合返回空结果而非404', async () => {
      // Arrange
      const searchQuery = ApiTestDataFactory.createSearchQuery({
        q: 'test query',
        collectionId: 'non-existent-collection',
      });

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post('/api/search')
        .send(searchQuery);

      // Assert
      ApiTestUtils.validateErrorResponse(response, 404, 'NOT_FOUND');
    });
  });

  describe('GET /api/search', () => {
    it('应该执行搜索并返回结果', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/search')
        .query({
          q: 'artificial intelligence',
          collectionId: testCollection.id,
        });

      // Assert
      ApiTestUtils.validateApiResponse(response, 200, [
        'results',
        'total',
        'query',
      ]);
      expect(response.body.query).toBe('artificial intelligence');
      expect(Array.isArray(response.body.results)).toBe(true);
      expect(typeof response.body.total).toBe('number');
    });

    it('应该支持限制结果数量', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/search')
        .query({
          q: 'machine learning',
          collectionId: testCollection.id,
          limit: 5,
        });

      // Assert
      ApiTestUtils.validateApiResponse(response, 200);
      expect(response.body.results.length).toBeLessThanOrEqual(5);
    });

    it('应该拒绝缺少查询字符串的请求', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/search')
        .query({
          collectionId: testCollection.id,
        });

      // Assert
      ApiTestUtils.validateErrorResponse(response, 400, 'VALIDATION_ERROR');
    });

    it.skip('应该拒绝缺少集合ID的请求 - SKIPPED: collectionId现在是可选的', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/search')
        .query({
          q: 'test query',
        });

      // Assert
      ApiTestUtils.validateErrorResponse(response, 400, 'VALIDATION_ERROR');
    });
  });

  describe('GET /api/search/paginated', () => {
    it('应该返回分页搜索结果', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/search/paginated')
        .query({
          q: 'machine learning',
          collectionId: testCollection.id,
          page: 1,
          limit: 2,
        });

      // Assert
      ApiTestUtils.validatePaginatedResponse(response, undefined, {
        page: 1,
        limit: 2,
      });
      expect(response.body.data).toBeDefined();
      expect(response.body.pagination).toBeDefined();
    });

    it('应该支持排序参数', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/search/paginated')
        .query({
          q: 'web development',
          collectionId: testCollection.id,
          sort: 'score',
          order: 'desc',
        });

      // Assert
      ApiTestUtils.validatePaginatedResponse(response);
      expect(response.body.pagination.sort).toBe('score');
      expect(response.body.pagination.order).toBe('desc');
    });

    it('应该验证分页参数', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/search/paginated')
        .query({
          q: 'test query',
          collectionId: testCollection.id,
          page: -1,
          limit: 0,
        });

      // Assert
      ApiTestUtils.validateErrorResponse(response, 400, 'VALIDATION_ERROR');
    });

    it('应该处理超出范围的页码', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/search/paginated')
        .query({
          q: 'test query',
          collectionId: testCollection.id,
          page: 999,
          limit: 10,
        });

      // Assert
      ApiTestUtils.validatePaginatedResponse(response, 0, {
        page: 999,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: true, // 页码999>1，所以hasPrev应该是true
      });
    });
  });

  describe('Search Quality', () => {
    it('应该返回相关性分数', async () => {
      // Arrange
      const searchQuery = ApiTestDataFactory.createSearchQuery({
        q: 'artificial intelligence',
        collectionId: testCollection.id,
      });

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post('/api/search')
        .send(searchQuery);

      // Assert
      ApiTestUtils.validateApiResponse(response, 200);
      if (response.body.results.length > 0) {
        response.body.results.forEach((result: any) => {
          expect(result).toHaveProperty('score');
          expect(typeof result.score).toBe('number');
          expect(result.score).toBeGreaterThan(0);
        });
      }
    });

    it('应该按相关性排序结果', async () => {
      // Arrange
      const searchQuery = ApiTestDataFactory.createSearchQuery({
        q: 'machine learning',
        collectionId: testCollection.id,
      });

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post('/api/search')
        .send(searchQuery);

      // Assert
      ApiTestUtils.validateApiResponse(response, 200);
      if (response.body.results.length > 1) {
        for (let i = 1; i < response.body.results.length; i++) {
          expect(response.body.results[i - 1].score).toBeGreaterThanOrEqual(
            response.body.results[i].score,
          );
        }
      }
    });

    it('应该返回必要的字段', async () => {
      // Arrange
      const searchQuery = ApiTestDataFactory.createSearchQuery({
        q: 'database design',
        collectionId: testCollection.id,
      });

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post('/api/search')
        .send(searchQuery);

      // Assert
      ApiTestUtils.validateApiResponse(response, 200);
      if (response.body.results.length > 0) {
        response.body.results.forEach((result: any) => {
          expect(result).toHaveProperty('pointId');
          expect(result).toHaveProperty('docId');
          expect(result).toHaveProperty('collectionId');
          expect(result).toHaveProperty('chunkIndex');
          expect(result).toHaveProperty('title');
          expect(result).toHaveProperty('content');
          expect(result).toHaveProperty('score');
        });
      }
    });
  });

  describe('Search Performance', () => {
    it('应该在合理时间内响应', async () => {
      // Arrange
      const searchQuery = ApiTestDataFactory.createSearchQuery({
        q: 'performance test',
        collectionId: testCollection.id,
      });

      // Act
      const startTime = Date.now();
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post('/api/search')
        .send(searchQuery);
      const endTime = Date.now();

      // Assert
      ApiTestUtils.validateApiResponse(response, 200);
      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(5000); // 应该在5秒内响应
    });

    it('应该处理大量搜索请求', async () => {
      // Arrange
      const searchQueries = Array(10)
        .fill(null)
        .map((_, i) =>
          ApiTestDataFactory.createSearchQuery({
            q: `test query ${i}`,
            collectionId: testCollection.id,
          }),
        );

      // Act
      const startTime = Date.now();
      const promises = searchQueries.map((query) =>
        ApiTestUtils.createRequest(testEnv.app).post('/api/search').send(query),
      );
      const responses = await Promise.all(promises);
      const endTime = Date.now();

      // Assert
      responses.forEach((response) => {
        ApiTestUtils.validateApiResponse(response, 200);
      });

      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(10000); // 10个请求应该在10秒内完成
    });
  });

  describe('Error Handling', () => {
    it('应该处理无效的JSON', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post('/api/search')
        .send('invalid json')
        .set('Content-Type', 'application/json');

      // Assert
      ApiTestUtils.validateErrorResponse(response, 400, 'VALIDATION_ERROR');
    });

    it('应该处理过大的查询字符串', async () => {
      // Arrange
      const longQuery = 'x'.repeat(10000); // 10KB的查询字符串
      const searchQuery = ApiTestDataFactory.createSearchQuery({
        q: longQuery,
        collectionId: testCollection.id,
      });

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post('/api/search')
        .send(searchQuery);

      // Assert
      ApiTestUtils.validateErrorResponse(response, 413, 'PAYLOAD_TOO_LARGE');
    });

    it.skip('应该处理数据库连接错误 - SKIPPED: 测试环境数据库销毁后状态不稳定', async () => {
      // Arrange
      await testEnv.dataSource.destroy();
      const searchQuery = ApiTestDataFactory.createSearchQuery({
        q: 'test query',
        collectionId: testCollection.id,
      });

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post('/api/search')
        .send(searchQuery);

      // Assert
      ApiTestUtils.validateErrorResponse(response, 500, 'INTERNAL_ERROR');
    });
  });

  describe('Response Format', () => {
    it('应该返回正确的Content-Type', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/search')
        .query({
          q: 'test query',
          collectionId: testCollection.id,
        });

      // Assert
      expect(response.headers['content-type']).toMatch(/json/);
    });

    it('应该包含必要的响应字段', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post('/api/search')
        .send({
          q: 'test query',
          collectionId: testCollection.id,
        });

      // Assert
      expect(response.body).toHaveProperty('results');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('query');
      expect(Array.isArray(response.body.results)).toBe(true);
      expect(typeof response.body.total).toBe('number');
      expect(typeof response.body.query).toBe('string');
    });

    it('应该正确处理分页响应格式', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/search/paginated')
        .query({
          q: 'test query',
          collectionId: testCollection.id,
          page: 1,
          limit: 10,
        });

      // Assert
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('totalPages');
      expect(response.body.pagination).toHaveProperty('hasNext');
      expect(response.body.pagination).toHaveProperty('hasPrev');
    });
  });
});
