/**
 * 文档创建API测试
 * 专门测试 POST /api/documents 和相关上传端点
 */

import {
  describe,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
  it,
  expect,
} from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { DataSource } from 'typeorm';
import { Collection } from '../../../../src/infrastructure/database/entities/Collection.js';
import {
  createApiTestEnvironment,
  ApiTestUtils,
  ApiTestDataFactory,
  resetTestDatabase,
} from '../api-test-setup.test.js';

describe('POST /api/documents - Document Creation Tests', () => {
  let testEnv: {
    app: express.Application;
    dataSource: DataSource;
    config: any;
    logger: any;
  };
  let testCollection: Collection;

  beforeAll(async () => {
    testEnv = await createApiTestEnvironment();
  });

  afterAll(async () => {
    if (testEnv?.dataSource && testEnv.dataSource.isInitialized) {
      await testEnv.dataSource.destroy();
    }
  });

  beforeEach(async () => {
    await resetTestDatabase();
    await createTestCollection();
  });

  afterEach(async () => {
    if (testEnv?.dataSource && testEnv.dataSource.isInitialized) {
      try {
        await testEnv.dataSource.query(`DELETE FROM collections`);
        await testEnv.dataSource.query(`DELETE FROM documents`);
      } catch (error) {
        // 忽略表不存在的错误
      }
    }
  });

  async function createTestCollection() {
    const collectionRepository = testEnv.dataSource.getRepository(Collection);
    const collectionData = {
      id: 'test-collection-docs',
      collectionId: 'test-collection-docs', // 添加必需的collectionId字段
      name: 'Test Collection for Documents',
      description: 'A collection for testing document endpoints',
      status: 'active' as const,
      documentCount: 0,
      chunkCount: 0,
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    testCollection = collectionRepository.create(collectionData);
    testCollection = await collectionRepository.save(testCollection);
  }

  describe('成功场景', () => {
    it('应该成功上传文档到指定集合', async () => {
      // Arrange
      const fileContent = 'Test document content';
      const file = ApiTestUtils.createTestFile('test.txt', fileContent);

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post(`/api/collections/${testCollection.collectionId}/docs`)
        .attach('file', file.buffer, file.originalname)
        .expect(201);

      // Assert
      expect(response.body).toHaveProperty('docId');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('collectionId');
      expect(response.body.name).toBe(file.originalname);
      expect(response.body.collectionId).toBe(testCollection.collectionId);
      expect(response.body.docId).toBeDefined();
    });

    it('应该成功上传文档到默认集合', async () => {
      // Arrange
      const fileContent = 'Test document content';
      const file = ApiTestUtils.createTestFile('test.txt', fileContent);

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post('/api/upload')
        .attach('file', file.buffer, file.originalname)
        .expect(201);

      // Assert
      expect(response.body).toHaveProperty('docId');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('collectionId');
      expect(response.body.name).toBe(file.originalname);
      expect(response.body.docId).toBeDefined();
      expect(response.body.collectionId).toBeDefined();
    });

    it('应该支持多种文件类型', async () => {
      const testFiles = [
        { name: 'test.txt', content: 'Text content', mimeType: 'text/plain' },
        { name: 'test.md', content: '# Markdown content', mimeType: 'text/markdown' },
        { name: 'test.html', content: '<h1>HTML content</h1>', mimeType: 'text/html' },
      ];

      for (const testFile of testFiles) {
        const file = ApiTestUtils.createTestFile(testFile.name, testFile.content, testFile.mimeType);

        const response = await ApiTestUtils.createRequest(testEnv.app)
          .post(`/api/collections/${testCollection.collectionId}/docs`)
          .attach('file', file.buffer, file.originalname)
          .expect(201);

        expect(response.status).toBe(201);
        expect(response.body.name).toBe(testFile.name);
      }
    });
  });

  describe('验证错误', () => {
    it('应该拒绝没有文件的请求', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post(`/api/collections/${testCollection.collectionId}/docs`);

      // Assert
      expect(response.status).toBe(422);
      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
        }),
      });
    });

    it('应该拒绝不支持的文件类型', async () => {
      // Arrange
      const file = ApiTestUtils.createTestFile('test.exe', 'executable content', 'application/octet-stream');

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post(`/api/collections/${testCollection.collectionId}/docs`)
        .attach('file', file.buffer, file.originalname);

      // Assert
      expect(response.status).toBe(422);
      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          code: 'UNSUPPORTED_FILE_TYPE',
        }),
      });
    });

    it('应该拒绝过大的文件', async () => {
      // Arrange
      const largeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB，超过10MB限制
      const file = ApiTestUtils.createTestFile('large.txt', largeContent);

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post(`/api/collections/${testCollection.collectionId}/docs`)
        .attach('file', file.buffer, file.originalname);

      // Assert
      expect(response.status).toBe(413);
      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          code: 'FILE_TOO_LARGE',
        }),
      });
    });

    it('应该拒绝空文件', async () => {
      // Arrange
      const file = ApiTestUtils.createTestFile('empty.txt', '');

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post(`/api/collections/${testCollection.collectionId}/docs`)
        .attach('file', file.buffer, file.originalname);

      // Assert
      expect(response.status).toBe(422);
      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
        }),
      });
    });

    it('应该处理不存在的集合', async () => {
      // Arrange
      const fileContent = 'Test document content';
      const file = ApiTestUtils.createTestFile('test.txt', fileContent);

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post('/api/collections/non-existent-id/docs')
        .attach('file', file.buffer, file.originalname);

      // Assert
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          code: 'NOT_FOUND',
        }),
      });
    });
  });

  describe('请求格式验证', () => {
    it('应该要求multipart/form-data格式', async () => {
      // Act
      const response = await request(testEnv.app)
        .post(`/api/collections/${testCollection.collectionId}/docs`)
        .send({ content: 'test content' })
        .set('Content-Type', 'application/json');

      // Assert
      expect(response.status).toBe(422);
      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
        }),
      });
    });

    it('应该处理损坏的文件上传', async () => {
      // Act
      const response = await request(testEnv.app)
        .post(`/api/collections/${testCollection.collectionId}/docs`)
        .attach('file', Buffer.from(''), 'corrupted.txt'); // 空buffer模拟损坏文件

      // Assert
      expect([400, 422]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('响应格式验证', () => {
    it('应该返回正确的Content-Type', async () => {
      const fileContent = 'Test document content';
      const file = ApiTestUtils.createTestFile('test.txt', fileContent);

      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post(`/api/collections/${testCollection.collectionId}/docs`)
        .attach('file', file.buffer, file.originalname);

      expect(response.status).toBe(201);
      expect(response.headers['content-type']).toMatch(/json/);
    });

    it('应该包含必要的响应字段', async () => {
      const fileContent = 'Test document content';
      const file = ApiTestUtils.createTestFile('test.txt', fileContent);

      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post(`/api/collections/${testCollection.collectionId}/docs`)
        .attach('file', file.buffer, file.originalname);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(
        expect.objectContaining({
          docId: expect.any(String),
          name: expect.any(String),
          collectionId: expect.any(String),
        }),
      );
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内处理文档上传', async () => {
      const fileContent = 'Test document content';
      const file = ApiTestUtils.createTestFile('test.txt', fileContent);

      const startTime = Date.now();
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post(`/api/collections/${testCollection.collectionId}/docs`)
        .attach('file', file.buffer, file.originalname);
      const endTime = Date.now();

      expect(response.status).toBe(201);
      expect(endTime - startTime).toBeLessThan(5000); // 应该在5秒内完成
    });
  });
});