/**
 * 文档管理API端到端测试
 * 测试文档相关的所有API端点
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
import {
  createApiTestEnvironment,
  ApiTestUtils,
  ApiTestDataFactory,
  resetTestDatabase,
} from './api-test-setup.test.js';

describe('Documents API E2E Tests', () => {
  let testEnv: {
    app: express.Application;
    dataSource: DataSource;
    config: any;
    logger: any;
  };
  let testCollection: Collection;
  let testDocuments: Doc[];

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

    await createTestData();
  });

  afterEach(async () => {
    // 清理测试数据 - 使用DELETE而不是clear()以避免连接问题
    if (testEnv?.dataSource && testEnv.dataSource.isInitialized) {
      try {
        const tableNames = ['chunks', 'docs', 'collections'];
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
    try {
      // 确保数据源已初始化
      if (!testEnv?.dataSource || !testEnv.dataSource.isInitialized) {
        console.warn('[createTestData] DataSource未初始化，重新创建测试环境');
        testEnv = await createApiTestEnvironment();
      }

      console.log('[createTestData] DataSource状态:', {
        isInitialized: testEnv.dataSource.isInitialized,
        type: testEnv.dataSource.options.type,
        database: testEnv.dataSource.options.database,
      });

      const now = Date.now();
      const collectionId =
        'test-collection-' + Math.random().toString(36).substring(2, 8);
      const collectionName = 'Test Collection';

      console.log('[createTestData] 尝试执行SQL查询');

      // 使用SQL INSERT创建测试集合
      await testEnv.dataSource.query(
        `INSERT INTO collections (id, collectionId, name, description, status, created_at, updated_at, deleted, version) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          collectionId,
          collectionId,
          collectionName,
          'Test collection',
          'active',
          now,
          now,
          false,
          1,
        ],
      );

      testCollection = {
        id: collectionId,
        collectionId: collectionId,
        name: collectionName,
        description: 'Test collection',
      } as Collection;

      // 创建测试文档
      testDocuments = [];
      for (let i = 1; i <= 3; i++) {
        const docId = `test-doc-${i}-${Math.random().toString(36).substring(2, 8)}`;
        const docName = `Document ${i}`;
        const docContent = `Content for document ${i}`;

        await testEnv.dataSource.query(
          `INSERT INTO docs (id, docId, collectionId, key, name, content, size_bytes, status, created_at, updated_at, deleted, version) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            docId,
            docId,
            collectionId,
            `key-${i}`,
            docName,
            docContent,
            docContent.length,
            'new',
            now,
            now,
            false,
            1,
          ],
        );

        testDocuments.push({
          id: docId,
          docId: docId,
          collectionId: collectionId,
          name: docName,
          content: docContent,
        } as Doc);
      }
    } catch (error) {
      console.error('Error creating test data:', error);
      // 继续运行测试
    }
  }

  describe('POST /api/documents', () => {
    it.skip('应该成功上传文档到指定集合', async () => {
      // Arrange
      const fileContent = 'Test document content';
      const file = ApiTestUtils.createTestFile('test.txt', fileContent);

      // Act
      console.log(
        '[Test] 发送POST请求到:',
        `/api/collections/${testCollection.id}/docs`,
      );

      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post(`/api/collections/${testCollection.id}/docs`)
        .attach('file', file.buffer, file.originalname)
        .field('collectionId', testCollection.id);

      // Debug response
      console.log('[Test] 响应状态:', response.status);
      console.log('[Test] 响应体:', response.body);
      console.log('[Test] 响应头:', response.headers);

      // Assert
      ApiTestUtils.validateApiResponse(response, 201, [
        'docId',
        'name',
        'collectionId',
      ]);
      expect(response.body.name).toBe(file.originalname);
      expect(response.body.collectionId).toBe(testCollection.id);
      expect(response.body.docId).toBeDefined();
    });

    it.skip('应该成功上传文档到默认集合', async () => {
      // Arrange
      const fileContent = 'Test document content';
      const file = ApiTestUtils.createTestFile('test.txt', fileContent);

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post('/api/upload')
        .attach('file', file.buffer, file.originalname);

      // Assert
      ApiTestUtils.validateApiResponse(response, 201, [
        'docId',
        'name',
        'collectionId',
      ]);
      expect(response.body.name).toBe(file.originalname);
      expect(response.body.docId).toBeDefined();
      expect(response.body.collectionId).toBeDefined();
    });

    it.skip('应该拒绝没有文件的请求', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app).post(
        `/api/collections/${testCollection.id}/docs`,
      );

      // Assert
      ApiTestUtils.validateErrorResponse(response, 422, 'VALIDATION_ERROR');
    });

    it.skip('应该拒绝不支持的文件类型', async () => {
      // Arrange
      const file = ApiTestUtils.createTestFile(
        'test.exe',
        'executable content',
        'application/octet-stream',
      );

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post(`/api/collections/${testCollection.id}/docs`)
        .attach('file', file.buffer, file.originalname);

      // Assert
      ApiTestUtils.validateErrorResponse(
        response,
        422,
        'UNSUPPORTED_FILE_TYPE',
      );
    });

    it.skip('应该拒绝过大的文件', async () => {
      // Arrange
      const largeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB，超过10MB限制
      const file = ApiTestUtils.createTestFile('large.txt', largeContent);

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post(`/api/collections/${testCollection.id}/docs`)
        .attach('file', file.buffer, file.originalname);

      // Assert
      ApiTestUtils.validateErrorResponse(response, 413, 'FILE_TOO_LARGE');
    });

    it.skip('应该处理不存在的集合', async () => {
      // Arrange
      const fileContent = 'Test document content';
      const file = ApiTestUtils.createTestFile('test.txt', fileContent);

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post('/api/collections/non-existent-id/docs')
        .attach('file', file.buffer, file.originalname);

      // Assert
      ApiTestUtils.validateErrorResponse(response, 404, 'NOT_FOUND');
    });
  });

  describe('GET /api/documents', () => {
    it.skip('应该返回所有文档（无分页）', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app).get(
        '/api/docs',
      );

      // Assert
      ApiTestUtils.validatePaginatedResponse(response, 3, {
        page: 1,
        limit: 3,
        total: 3,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    it.skip('应该返回分页的文档', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/docs')
        .query({ page: 1, limit: 2 });

      // Assert
      ApiTestUtils.validatePaginatedResponse(response, 2, {
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2,
        hasNext: true,
        hasPrev: false,
      });
    });

    it.skip('应该支持按集合过滤', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/docs')
        .query({ collectionId: testCollection.id });

      // Assert
      ApiTestUtils.validatePaginatedResponse(response, 3);
      expect(
        response.body.data.every(
          (doc: any) => doc.collectionId === testCollection.id,
        ),
      ).toBe(true);
    });

    it.skip('应该支持排序参数', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/docs')
        .query({ sort: 'name', order: 'asc' });

      // Assert
      ApiTestUtils.validateApiResponse(response, 200, ['data', 'pagination']);
      expect(response.body.data).toHaveLength(3);
      // 验证排序
      for (let i = 1; i < response.body.data.length; i++) {
        expect(
          response.body.data[i - 1].name.localeCompare(
            response.body.data[i].name,
          ),
        ).toBeLessThanOrEqual(0);
      }
    });

    it.skip('应该验证分页参数', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/docs')
        .query({ page: -1, limit: 0 });

      // Assert
      ApiTestUtils.validateErrorResponse(response, 400, 'VALIDATION_ERROR');
    });

    it.skip('应该处理空文档列表', async () => {
      // Arrange
      const docRepository = testEnv.dataSource.getRepository(Doc);
      await docRepository.clear();

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app).get(
        '/api/docs',
      );

      // Assert
      ApiTestUtils.validatePaginatedResponse(response, 0, {
        page: 1,
        limit: 0,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      });
    });
  });

  describe('GET /api/documents/:docId', () => {
    it.skip('应该返回指定的文档', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app).get(
        `/api/docs/${testDocuments[0].id}`,
      );

      // Assert
      ApiTestUtils.validateApiResponse(response, 200, [
        'id',
        'name',
        'content',
        'collectionId',
      ]);
      expect(response.body.id).toBe(testDocuments[0].id);
      expect(response.body.name).toBe(testDocuments[0].name);
      expect(response.body.collectionId).toBe(testDocuments[0].collectionId);
    });

    it.skip('应该返回404当文档不存在', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app).get(
        '/api/docs/non-existent-id',
      );

      // Assert
      ApiTestUtils.validateErrorResponse(response, 404, 'NOT_FOUND');
    });

    it.skip('应该验证文档ID格式', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app).get(
        '/api/docs/invalid-id',
      );

      // Assert
      ApiTestUtils.validateErrorResponse(response, 400, 'VALIDATION_ERROR');
    });
  });

  describe('PUT /api/documents/:docId/resync', () => {
    it.skip('应该成功重新同步文档', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app).put(
        `/api/docs/${testDocuments[0].id}/resync`,
      );

      // Assert
      ApiTestUtils.validateApiResponse(response, 200, [
        'id',
        'name',
        'content',
        'collectionId',
      ]);
      expect(response.body.id).toBe(testDocuments[0].id);
      expect(response.body.name).toBe(testDocuments[0].name);
    });

    it.skip('应该返回404当重新同步不存在的文档', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app).put(
        '/api/docs/non-existent-id/resync',
      );

      // Assert
      ApiTestUtils.validateErrorResponse(response, 404, 'NOT_FOUND');
    });
  });

  describe('DELETE /api/documents/:docId', () => {
    it.skip('应该成功删除文档', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app).delete(
        `/api/docs/${testDocuments[0].id}`,
      );

      // Assert
      expect(response.status).toBe(204);
      expect(response.body).toEqual({});

      // 验证文档已删除
      const docRepository = testEnv.dataSource.getRepository(Doc);
      const deletedDoc = await docRepository.findOne({
        where: { id: testDocuments[0].id },
      });
      expect(deletedDoc).toBeNull();
    });

    it.skip('应该返回404当删除不存在的文档', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app).delete(
        '/api/docs/non-existent-id',
      );

      // Assert
      ApiTestUtils.validateErrorResponse(response, 404, 'NOT_FOUND');
    });

    it.skip('应该级联删除文档的块', async () => {
      // Arrange
      const chunkRepository = testEnv.dataSource.getRepository(Chunk);
      const chunk = chunkRepository.create({
        docId: testDocuments[0].id,
        collectionId: testCollection.id,
        pointId: `point-${testDocuments[0].id}`,
        chunkIndex: 0,
        content: 'Test chunk content',
        contentLength: 18,
      });
      await chunkRepository.save(chunk);

      // Act
      await ApiTestUtils.createRequest(testEnv.app).delete(
        `/api/docs/${testDocuments[0].id}`,
      );

      // Assert
      const remainingChunks = await chunkRepository.find({
        where: { docId: testDocuments[0].id },
      });
      expect(remainingChunks).toHaveLength(0);
    });
  });

  describe('GET /api/documents/:docId/chunks', () => {
    beforeEach(async () => {
      // 创建测试块
      const chunkRepository = testEnv.dataSource.getRepository(Chunk);
      const chunks = [
        {
          docId: testDocuments[0].id,
          collectionId: testCollection.id,
          pointId: `point-${testDocuments[0].id}-0`,
          chunkIndex: 0,
          title: 'Chunk 1',
          content: 'Content for chunk 1',
          contentLength: 18,
        },
        {
          docId: testDocuments[0].id,
          collectionId: testCollection.id,
          pointId: `point-${testDocuments[0].id}-1`,
          chunkIndex: 1,
          title: 'Chunk 2',
          content: 'Content for chunk 2',
          contentLength: 18,
        },
      ];

      for (const chunkData of chunks) {
        const chunk = chunkRepository.create(chunkData);
        await chunkRepository.save(chunk);
      }
    });

    it.skip('应该返回文档的所有块（无分页）', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app).get(
        `/api/docs/${testDocuments[0].id}/chunks`,
      );

      // Assert
      ApiTestUtils.validateApiResponse(response, 200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].docId).toBe(testDocuments[0].id);
      expect(response.body[0].chunkIndex).toBe(0);
      expect(response.body[1].chunkIndex).toBe(1);
    });

    it.skip('应该返回分页的文档块', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get(`/api/docs/${testDocuments[0].id}/chunks`)
        .query({ page: 1, limit: 1 });

      // Assert
      ApiTestUtils.validatePaginatedResponse(response, 1, {
        page: 1,
        limit: 1,
        total: 2,
        totalPages: 2,
        hasNext: true,
        hasPrev: false,
      });
    });

    it.skip('应该支持排序参数', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get(`/api/docs/${testDocuments[0].id}/chunks`)
        .query({ sort: 'chunkIndex', order: 'desc' });

      // Assert
      ApiTestUtils.validateApiResponse(response, 200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].chunkIndex).toBe(1);
      expect(response.body[1].chunkIndex).toBe(0);
    });

    it.skip('应该返回404当文档不存在', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app).get(
        '/api/docs/non-existent-id/chunks',
      );

      // Assert
      ApiTestUtils.validateErrorResponse(response, 404, 'NOT_FOUND');
    });

    it.skip('应该处理空块列表', async () => {
      // Arrange
      const chunkRepository = testEnv.dataSource.getRepository(Chunk);
      await chunkRepository.clear();

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app).get(
        `/api/docs/${testDocuments[0].id}/chunks`,
      );

      // Assert
      ApiTestUtils.validateApiResponse(response, 200);
      expect(response.body).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it.skip('应该处理无效的JSON', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post('/api/docs')
        .send('invalid json')
        .set('Content-Type', 'application/json');

      // Assert
      ApiTestUtils.validateErrorResponse(response, 400, 'VALIDATION_ERROR');
    });

    it.skip('应该处理数据库连接错误', async () => {
      // Arrange
      await testEnv.dataSource.destroy();

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app).get(
        '/api/docs',
      );

      // Assert
      ApiTestUtils.validateErrorResponse(response, 500, 'INTERNAL_ERROR');
    });
  });

  describe('Response Format', () => {
    it.skip('应该返回正确的Content-Type', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app).get(
        '/api/docs',
      );

      // Assert
      expect(response.headers['content-type']).toMatch(/json/);
    });

    it.skip('应该包含必要的响应字段', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app).get(
        `/api/docs/${testDocuments[0].id}`,
      );

      // Assert
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('content');
      expect(response.body).toHaveProperty('collectionId');
      expect(response.body).toHaveProperty('created_at');
      expect(response.body).toHaveProperty('updated_at');
    });

    it.skip('应该正确处理日期字段', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app).get(
        `/api/docs/${testDocuments[0].id}`,
      );

      // Assert
      expect(response.body.created_at).toBeDefined();
      expect(response.body.updated_at).toBeDefined();
      expect(typeof response.body.created_at).toBe('number');
      expect(typeof response.body.updated_at).toBe('number');
    });
  });
});
