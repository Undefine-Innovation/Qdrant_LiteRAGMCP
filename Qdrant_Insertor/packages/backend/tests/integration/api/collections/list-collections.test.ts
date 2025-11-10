/**
 * 集合列表API测试
 * 专门测试 GET /api/collections 端点
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

describe('GET /api/collections - Collection List Tests', () => {
  let testEnv: {
    app: express.Application;
    dataSource: DataSource;
    config: any;
    logger: any;
  };

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

  async function createTestCollections() {
    const collectionRepository = testEnv.dataSource.getRepository(Collection);
    const collections = [];

    for (let i = 1; i <= 5; i++) {
      const collection = collectionRepository.create({
        id: `test-collection-${i}`,
        collectionId: `test-collection-${i}`, // 添加必需的collectionId字段
        name: `Test Collection ${i}`,
        description: `Description for collection ${i}`,
        status: 'active',
        documentCount: i * 2,
        chunkCount: i * 10,
        created_at: Date.now() - i * 1000,
        updated_at: Date.now() - i * 500,
      });
      collections.push(await collectionRepository.save(collection));
    }

    return collections;
  }

  describe('基本列表功能', () => {
    it('应该返回空列表当没有集合时', async () => {
      const response = await request(testEnv.app)
        .get('/api/collections')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          items: [],
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
        },
      });
    });

    it('应该返回所有集合（无分页）', async () => {
      await createTestCollections();

      const response = await request(testEnv.app)
        .get('/api/collections')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          items: expect.arrayContaining([
            expect.objectContaining({
              name: expect.stringContaining('Test Collection'),
              status: 'active',
            }),
          ]),
          total: 5,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      });

      expect(response.body.data.items).toHaveLength(5);
    });
  });

  describe('分页功能', () => {
    beforeEach(async () => {
      await createTestCollections();
    });

    it('应该返回分页的集合', async () => {
      const response = await request(testEnv.app)
        .get('/api/collections?page=1&limit=2')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          items: expect.any(Array),
          total: 5,
          page: 1,
          limit: 2,
          totalPages: 3,
        },
      });

      expect(response.body.data.items).toHaveLength(2);
    });

    it('应该返回第二页数据', async () => {
      const response = await request(testEnv.app)
        .get('/api/collections?page=2&limit=2')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          items: expect.any(Array),
          total: 5,
          page: 2,
          limit: 2,
          totalPages: 3,
        },
      });

      expect(response.body.data.items).toHaveLength(2);
    });

    it('应该处理超出范围的页数', async () => {
      const response = await request(testEnv.app)
        .get('/api/collections?page=10&limit=2')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          items: [],
          total: 5,
          page: 10,
          limit: 2,
          totalPages: 3,
        },
      });
    });

    it('应该验证分页参数', async () => {
      const response = await request(testEnv.app)
        .get('/api/collections?page=0&limit=0')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('page'),
      });
    });

    it('应该限制每页最大数量', async () => {
      const response = await request(testEnv.app)
        .get('/api/collections?page=1&limit=1000')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('limit'),
      });
    });
  });

  describe('排序功能', () => {
    beforeEach(async () => {
      await createTestCollections();
    });

    it('应该支持按名称排序', async () => {
      const response = await request(testEnv.app)
        .get('/api/collections?sortBy=name&sortOrder=asc')
        .expect(200);

      const items = response.body.data.items;
      expect(items).toHaveLength(5);

      // 验证按名称升序排列
      for (let i = 0; i < items.length - 1; i++) {
        expect(items[i].name.localeCompare(items[i + 1].name)).toBeLessThanOrEqual(0);
      }
    });

    it('应该支持按创建时间排序', async () => {
      const response = await request(testEnv.app)
        .get('/api/collections?sortBy=created_at&sortOrder=desc')
        .expect(200);

      const items = response.body.data.items;
      expect(items).toHaveLength(5);

      // 验证按创建时间降序排列
      for (let i = 0; i < items.length - 1; i++) {
        expect(items[i].created_at).toBeGreaterThanOrEqual(items[i + 1].created_at);
      }
    });

    it('应该支持按文档数量排序', async () => {
      const response = await request(testEnv.app)
        .get('/api/collections?sortBy=documentCount&sortOrder=desc')
        .expect(200);

      const items = response.body.data.items;
      expect(items).toHaveLength(5);

      // 验证按文档数量降序排列
      for (let i = 0; i < items.length - 1; i++) {
        expect(items[i].documentCount).toBeGreaterThanOrEqual(items[i + 1].documentCount);
      }
    });

    it('应该拒绝无效的排序字段', async () => {
      const response = await request(testEnv.app)
        .get('/api/collections?sortBy=invalid_field&sortOrder=asc')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('sortBy'),
      });
    });

    it('应该拒绝无效的排序方向', async () => {
      const response = await request(testEnv.app)
        .get('/api/collections?sortBy=name&sortOrder=invalid')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('sortOrder'),
      });
    });
  });

  describe('筛选功能', () => {
    beforeEach(async () => {
      await createTestCollections();
      
      // 创建一个非活跃的集合
      const collectionRepository = testEnv.dataSource.getRepository(Collection);
      const inactiveCollection = collectionRepository.create({
        id: 'inactive-collection',
        name: 'Inactive Collection',
        description: 'An inactive collection',
        status: 'inactive',
        documentCount: 0,
        chunkCount: 0,
        created_at: Date.now(),
        updated_at: Date.now(),
      });
      await collectionRepository.save(inactiveCollection);
    });

    it('应该支持按状态筛选', async () => {
      const response = await request(testEnv.app)
        .get('/api/collections?status=active')
        .expect(200);

      expect(response.body.data.items).toHaveLength(5);
      expect(response.body.data.items.every((item: any) => item.status === 'active')).toBe(true);
    });

    it('应该支持按名称搜索', async () => {
      const response = await request(testEnv.app)
        .get('/api/collections?search=Collection 1')
        .expect(200);

      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].name).toBe('Test Collection 1');
    });

    it('应该支持模糊搜索', async () => {
      const response = await request(testEnv.app)
        .get('/api/collections?search=Inactive')
        .expect(200);

      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].name).toBe('Inactive Collection');
    });
  });

  describe('响应格式验证', () => {
    it('应该返回正确的Content-Type', async () => {
      const response = await request(testEnv.app)
        .get('/api/collections')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('应该包含完整的响应结构', async () => {
      await createTestCollections();

      const response = await request(testEnv.app)
        .get('/api/collections')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          items: expect.any(Array),
          total: expect.any(Number),
          page: expect.any(Number),
          limit: expect.any(Number),
          totalPages: expect.any(Number),
        },
      });
    });

    it('应该包含必要的集合字段', async () => {
      await createTestCollections();

      const response = await request(testEnv.app)
        .get('/api/collections')
        .expect(200);

      const firstItem = response.body.data.items[0];
      expect(firstItem).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
          description: expect.any(String),
          status: expect.any(String),
          documentCount: expect.any(Number),
          chunkCount: expect.any(Number),
          created_at: expect.any(Number),
          updated_at: expect.any(Number),
        }),
      );
    });
  });
});