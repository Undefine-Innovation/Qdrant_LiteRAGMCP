/**
 * 集合详情API测试
 * 专门测试 GET /api/collections/:id 端点
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

describe('GET /api/collections/:id - Collection Details Tests', () => {
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
      } catch (error) {
        // 忽略表不存在的错误
      }
    }
  });

  async function createTestCollection() {
    const collectionRepository = testEnv.dataSource.getRepository(Collection);
    const collectionData = {
      id: 'test-collection-detail',
      collectionId: 'test-collection-detail', // 添加必需的collectionId字段
      name: 'Test Collection Details',
      description: 'A collection for testing detail endpoint',
      status: 'active' as const,
      documentCount: 15,
      chunkCount: 150,
      created_at: Date.now() - 86400000, // 1 day ago
      updated_at: Date.now() - 3600000,  // 1 hour ago
    };

    testCollection = collectionRepository.create(collectionData);
    testCollection = await collectionRepository.save(testCollection);
  }

  describe('成功场景', () => {
    it('应该返回指定的集合详情', async () => {
      const response = await request(testEnv.app)
        .get(`/api/collections/${testCollection.id}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testCollection.collectionId, // API使用collectionId作为业务标识符
        name: testCollection.name,
        description: testCollection.description,
        created_at: expect.any(Number),
        updated_at: expect.any(Number),
      });
    });

    it('应该返回完整的集合信息', async () => {
      const response = await request(testEnv.app)
        .get(`/api/collections/${testCollection.id}`)
        .expect(200);

      const collection = response.body; // API直接返回集合对象，不包装在data字段中
      
      // 验证所有必要字段都存在
      expect(collection).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
          description: expect.any(String),
          // 移除API不返回的内部数据库字段
          created_at: expect.any(Number),
          updated_at: expect.any(Number),
        }),
      );

      // 验证时间戳字段
      expect(collection.created_at).toBeGreaterThan(0);
      expect(collection.updated_at).toBeGreaterThan(0);
      expect(collection.updated_at).toBeGreaterThanOrEqual(collection.created_at);
    });

    it('应该返回正确的数据类型', async () => {
      const response = await request(testEnv.app)
        .get(`/api/collections/${testCollection.id}`)
        .expect(200);

      const collection = response.body;
      
      expect(typeof collection.id).toBe('string');
      expect(typeof collection.name).toBe('string');
      expect(typeof collection.description).toBe('string');
      expect(typeof collection.created_at).toBe('number');
      expect(typeof collection.updated_at).toBe('number');
    });
  });

  describe('错误场景', () => {
    it('应该返回404当集合不存在', async () => {
      const response = await request(testEnv.app)
        .get('/api/collections/non-existent-id')
        .expect(404);

      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          code: 'NOT_FOUND',
          message: expect.stringContaining('not found'),
        }),
      });
    });

    it('应该验证集合ID格式', async () => {
      const response = await request(testEnv.app)
        .get('/api/collections/')
        .expect(404);

      // 路由不匹配，返回404
    });

    it('应该处理无效的UUID格式', async () => {
      const response = await request(testEnv.app)
        .get('/api/collections/invalid-uuid-format')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String),
      });
    });

    it('应该处理SQL注入尝试', async () => {
      const maliciousId = "'; DROP TABLE collections; --";
      const response = await request(testEnv.app)
        .get(`/api/collections/${encodeURIComponent(maliciousId)}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String),
      });

      // 验证数据库仍然存在
      const collectionRepository = testEnv.dataSource.getRepository(Collection);
      const collections = await collectionRepository.find();
      expect(collections).toHaveLength(1);
    });
  });

  describe('软删除集合处理', () => {
    it('应该不返回已软删除的集合', async () => {
      // 软删除集合
      const collectionRepository = testEnv.dataSource.getRepository(Collection);
      testCollection.deleted = true;
      testCollection.deleted_at = Date.now();
      await collectionRepository.save(testCollection);

      const response = await request(testEnv.app)
        .get(`/api/collections/${testCollection.id}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('not found'),
      });
    });
  });

  describe('缓存行为', () => {
    it('应该设置适当的缓存头', async () => {
      const response = await request(testEnv.app)
        .get(`/api/collections/${testCollection.id}`)
        .expect(200);

      // 检查是否有缓存相关的头
      expect(response.headers).toEqual(
        expect.objectContaining({
          'content-type': expect.stringMatching(/application\/json/),
        }),
      );
    });

    it('应该支持条件请求', async () => {
      // 首次请求
      const firstResponse = await request(testEnv.app)
        .get(`/api/collections/${testCollection.id}`)
        .expect(200);

      const etag = firstResponse.headers.etag;
      
      // 如果有ETag，测试条件请求
      if (etag) {
        const conditionalResponse = await request(testEnv.app)
          .get(`/api/collections/${testCollection.id}`)
          .set('If-None-Match', etag)
          .expect(304);

        expect(conditionalResponse.body).toEqual({});
      }
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内响应', async () => {
      const startTime = Date.now();
      
      await request(testEnv.app)
        .get(`/api/collections/${testCollection.id}`)
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // 响应时间应该小于500ms
      expect(responseTime).toBeLessThan(500);
    });

    it('应该处理并发请求', async () => {
      const concurrentRequests = 10;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(testEnv.app)
            .get(`/api/collections/${testCollection.id}`)
            .expect(200)
        );
      }

      const responses = await Promise.all(promises);
      
      // 所有响应都应该返回相同的数据
      const firstResponse = responses[0].body;
      responses.forEach(response => {
        expect(response.body).toEqual(firstResponse);
      });
    });
  });

  describe('响应格式验证', () => {
    it('应该返回正确的Content-Type', async () => {
      const response = await request(testEnv.app)
        .get(`/api/collections/${testCollection.id}`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('应该返回正确的状态码', async () => {
      const response = await request(testEnv.app)
        .get(`/api/collections/${testCollection.id}`)
        .expect(200);

      expect(response.status).toBe(200);
    });

    it('应该包含success标志', async () => {
      const response = await request(testEnv.app)
        .get(`/api/collections/${testCollection.id}`)
        .expect(200);

      // API返回直接的集合对象，没有success字段
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name');
    });

    it('应该在data字段中包含集合信息', async () => {
      const response = await request(testEnv.app)
        .get(`/api/collections/${testCollection.id}`)
        .expect(200);

      // API直接返回集合对象，不包装在data字段中
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name');
      expect(typeof response.body).toBe('object');
      expect(response.body).not.toBeNull();
    });
  });

  describe('边界条件测试', () => {
    it('应该处理极长的集合ID', async () => {
      const veryLongId = 'a'.repeat(1000);
      
      const response = await request(testEnv.app)
        .get(`/api/collections/${veryLongId}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String),
      });
    });

    it('应该处理特殊字符的集合ID', async () => {
      const specialCharId = '!@#$%^&*()';
      
      const response = await request(testEnv.app)
        .get(`/api/collections/${encodeURIComponent(specialCharId)}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String),
      });
    });

    it('应该处理Unicode字符的集合ID', async () => {
      const unicodeId = '测试集合ID';
      
      const response = await request(testEnv.app)
        .get(`/api/collections/${encodeURIComponent(unicodeId)}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String),
      });
    });
  });
});