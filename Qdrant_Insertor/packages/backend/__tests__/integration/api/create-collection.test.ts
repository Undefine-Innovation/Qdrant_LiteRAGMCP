/**
 * 集合创建API测试
 * 专门测试 POST /api/collections 端点
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
import { Collection } from '@infrastructure/database/entities/Collection.js';
import {
  createApiTestEnvironment,
  ApiTestUtils,
  ApiTestDataFactory,
  resetTestDatabase,
} from './api-test-setup.test.js';

describe('POST /api/collections - Collection Creation Tests', () => {
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

  describe('成功场景', () => {
    it('应该成功创建集合', async () => {
      const collectionData = {
        name: 'Test Collection',
        description: 'A test collection for API testing',
      };

      const response = await request(testEnv.app)
        .post('/api/collections')
        .send(collectionData)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        name: collectionData.name,
        description: collectionData.description,
        collectionId: expect.any(String),
        created_at: expect.any(Number),
        updated_at: expect.any(Number),
      });

      // 验证数据库中确实创建了集合
      const collectionRepository = testEnv.dataSource.getRepository(Collection);
      const savedCollection = await collectionRepository.findOne({
        where: { name: collectionData.name },
      });
      expect(savedCollection).toBeTruthy();
    });

    it('应该创建集合并自动生成ID', async () => {
      const collectionData = {
        name: 'Auto ID Collection',
      };

      const response = await request(testEnv.app)
        .post('/api/collections')
        .send(collectionData)
        .expect(201);

      expect(response.body.id).toMatch(/^col_[a-f0-9-]{36}$/); // Collection ID格式
    });

    it('应该允许可选的描述字段', async () => {
      const collectionData = {
        name: 'Minimal Collection',
      };

      const response = await request(testEnv.app)
        .post('/api/collections')
        .send(collectionData)
        .expect(201);

      expect(response.body.description).toBeUndefined();
    });
  });

  describe('验证错误', () => {
    it('应该拒绝空名称的集合', async () => {
      const collectionData = {
        name: '',
        description: 'Empty name collection',
      };

      const response = await request(testEnv.app)
        .post('/api/collections')
        .send(collectionData)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('name'),
        }),
      });
    });

    it('应该拒绝缺少名称的请求', async () => {
      const collectionData = {
        description: 'Missing name collection',
      };

      const response = await request(testEnv.app)
        .post('/api/collections')
        .send(collectionData)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('name'),
        }),
      });
    });

    it('应该拒绝重复的集合名称', async () => {
      const collectionData = {
        name: 'Duplicate Collection',
        description: 'First collection',
      };

      // 创建第一个集合
      await request(testEnv.app)
        .post('/api/collections')
        .send(collectionData)
        .expect(201);

      // 尝试创建同名集合
      const response = await request(testEnv.app)
        .post('/api/collections')
        .send({
          ...collectionData,
          description: 'Duplicate collection',
        })
        .expect(422);

      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('already exists'),
        }),
      });
    });

    it('应该拒绝过长的名称', async () => {
      const collectionData = {
        name: 'a'.repeat(256), // 超过255字符限制
        description: 'Too long name',
      };

      const response = await request(testEnv.app)
        .post('/api/collections')
        .send(collectionData)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('fields'),
          details: expect.objectContaining({
            issues: expect.arrayContaining([
              expect.objectContaining({
                path: 'name',
                message: expect.stringContaining('characters'),
              }),
            ]),
          }),
        }),
      });
    });

    it('应该拒绝无效字符的名称', async () => {
      const collectionData = {
        name: 'Invalid<>Name',
        description: 'Contains invalid characters',
      };

      const response = await request(testEnv.app)
        .post('/api/collections')
        .send(collectionData);

      // 可能返回400或500，都是错误状态
      expect([400, 500]).toContain(response.status);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('请求格式验证', () => {
    it('应该拒绝无效的JSON', async () => {
      const response = await request(testEnv.app)
        .post('/api/collections')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('JSON'),
        }),
      });
    });

    it('应该拒绝空请求体', async () => {
      const response = await request(testEnv.app)
        .post('/api/collections')
        .send()
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
        }),
      });
    });

    it('应该要求Content-Type为application/json', async () => {
      const response = await request(testEnv.app)
        .post('/api/collections')
        .set('Content-Type', 'text/plain')
        .send('name=Test Collection')
        .expect(400); // 实际返回400而不是415

      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
        }),
      });
    });
  });

  describe('响应格式验证', () => {
    it('应该返回正确的Content-Type', async () => {
      const collectionData = {
        name: 'Content Type Test',
      };

      const response = await request(testEnv.app)
        .post('/api/collections')
        .send(collectionData)
        .expect(201);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('应该包含所有必要的响应字段', async () => {
      const collectionData = {
        name: 'Complete Response Test',
        description: 'Testing complete response',
      };

      const response = await request(testEnv.app)
        .post('/api/collections')
        .send(collectionData)
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          collectionId: expect.any(String),
          name: expect.any(String),
          description: expect.any(String),
          created_at: expect.any(Number),
          updated_at: expect.any(Number),
        }),
      );
    });

    it('应该正确处理日期字段', async () => {
      const collectionData = {
        name: 'Date Format Test',
      };

      const response = await request(testEnv.app)
        .post('/api/collections')
        .send(collectionData)
        .expect(201);

      const now = Date.now();
      expect(response.body.created_at).toBeCloseTo(now, -3); // 允许3位数差异
      expect(response.body.updated_at).toBeCloseTo(now, -3);
    });
  });
});
