/**
 * 集合更新API测试
 * 测试 PUT /api/collections/:id 和 PATCH /api/collections/:id 端点
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
} from '../api-test-setup.test.js';

describe('Collection Update API Tests', () => {
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
      id: 'test-collection-id',
      collectionId: 'test-collection-id', // 添加必需的collectionId字段
      name: 'Original Collection Name',
      description: 'Original description',
      status: 'active' as const,
      documentCount: 5,
      chunkCount: 25,
      created_at: Date.now() - 10000,
      updated_at: Date.now() - 5000,
    };

    testCollection = collectionRepository.create(collectionData);
    testCollection = await collectionRepository.save(testCollection);
  }

  describe('PUT /api/collections/:id - 完整更新', () => {
    it('应该成功更新集合', async () => {
      const updateData = {
        name: 'Updated Collection Name',
        description: 'Updated description',
      };

      const response = await request(testEnv.app)
        .put(`/api/collections/${testCollection.id}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: testCollection.id,
          name: updateData.name,
          description: updateData.description,
          status: 'active',
        }),
      });

      // 验证数据库中的更新
      const collectionRepository = testEnv.dataSource.getRepository(Collection);
      const updatedCollection = await collectionRepository.findOne({
        where: { id: testCollection.id },
      });
      expect(updatedCollection?.name).toBe(updateData.name);
      expect(updatedCollection?.updated_at).toBeGreaterThan(testCollection.updated_at);
    });

    it('应该拒绝空名称的更新', async () => {
      const updateData = {
        name: '',
        description: 'Updated description',
      };

      const response = await request(testEnv.app)
        .put(`/api/collections/${testCollection.id}`)
        .send(updateData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('name'),
      });
    });

    it('应该返回404当更新不存在的集合', async () => {
      const updateData = {
        name: 'Updated Name',
        description: 'Updated description',
      };

      const response = await request(testEnv.app)
        .put('/api/collections/non-existent-id')
        .send(updateData)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('not found'),
      });
    });

    it('应该返回422当名称已存在', async () => {
      // 创建另一个集合
      const collectionRepository = testEnv.dataSource.getRepository(Collection);
      const anotherCollection = collectionRepository.create({
        id: 'another-collection-id',
        collectionId: 'another-collection-id', // 添加必需的collectionId字段
        name: 'Another Collection',
        description: 'Another description',
        status: 'active',
        documentCount: 0,
        chunkCount: 0,
        created_at: Date.now(),
        updated_at: Date.now(),
      });
      await collectionRepository.save(anotherCollection);

      const updateData = {
        name: 'Another Collection', // 尝试使用已存在的名称
        description: 'Updated description',
      };

      const response = await request(testEnv.app)
        .put(`/api/collections/${testCollection.id}`)
        .send(updateData)
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('already exists'),
      });
    });
  });

  describe('PATCH /api/collections/:id - 部分更新', () => {
    it('应该成功部分更新集合', async () => {
      const updateData = {
        description: 'Only description updated',
      };

      const response = await request(testEnv.app)
        .patch(`/api/collections/${testCollection.id}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: testCollection.id,
          name: testCollection.name, // 名称应该保持不变
          description: updateData.description,
          status: 'active',
        }),
      });
    });

    it('应该支持只更新名称', async () => {
      const updateData = {
        name: 'Only Name Updated',
      };

      const response = await request(testEnv.app)
        .patch(`/api/collections/${testCollection.id}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: testCollection.id,
          name: updateData.name,
          description: testCollection.description, // 描述应该保持不变
        }),
      });
    });

    it('应该支持更新状态', async () => {
      const updateData = {
        status: 'inactive',
      };

      const response = await request(testEnv.app)
        .patch(`/api/collections/${testCollection.id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.status).toBe('inactive');
    });

    it('应该拒绝无效的状态值', async () => {
      const updateData = {
        status: 'invalid-status',
      };

      const response = await request(testEnv.app)
        .patch(`/api/collections/${testCollection.id}`)
        .send(updateData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('status'),
      });
    });

    it('应该返回404当部分更新不存在的集合', async () => {
      const updateData = {
        name: 'Updated Name',
      };

      const response = await request(testEnv.app)
        .patch('/api/collections/non-existent-id')
        .send(updateData)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('not found'),
      });
    });

    it('应该忽略空的更新请求', async () => {
      const response = await request(testEnv.app)
        .patch(`/api/collections/${testCollection.id}`)
        .send({})
        .expect(200);

      // 应该返回原始数据
      expect(response.body.data).toMatchObject({
        id: testCollection.id,
        name: testCollection.name,
        description: testCollection.description,
      });
    });
  });

  describe('DELETE /api/collections/:id - 删除集合', () => {
    it('应该成功删除集合', async () => {
      const response = await request(testEnv.app)
        .delete(`/api/collections/${testCollection.id}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          message: expect.stringContaining('deleted'),
        },
      });

      // 验证集合已被删除
      const collectionRepository = testEnv.dataSource.getRepository(Collection);
      const deletedCollection = await collectionRepository.findOne({
        where: { id: testCollection.id },
      });
      expect(deletedCollection).toBeNull();
    });

    it('应该返回404当删除不存在的集合', async () => {
      const response = await request(testEnv.app)
        .delete('/api/collections/non-existent-id')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('not found'),
      });
    });

    it('应该软删除包含文档的集合', async () => {
      // 先为集合添加一些文档计数
      const collectionRepository = testEnv.dataSource.getRepository(Collection);
      testCollection.documentCount = 10;
      await collectionRepository.save(testCollection);

      const response = await request(testEnv.app)
        .delete(`/api/collections/${testCollection.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // 验证集合被标记为删除而不是真正删除
      const deletedCollection = await collectionRepository.findOne({
        where: { id: testCollection.id },
        withDeleted: true, // 包括软删除的记录
      });
      expect(deletedCollection?.deleted).toBe(true);
      expect(deletedCollection?.deleted_at).toBeTruthy();
    });
  });

  describe('错误处理', () => {
    it('应该处理无效的集合ID格式', async () => {
      const updateData = {
        name: 'Updated Name',
      };

      const response = await request(testEnv.app)
        .put('/api/collections/invalid-id-format')
        .send(updateData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String),
      });
    });

    it('应该处理数据库错误', async () => {
      // 模拟数据库错误 - 关闭数据源
      await testEnv.dataSource.destroy();

      const updateData = {
        name: 'Updated Name',
      };

      const response = await request(testEnv.app)
        .put(`/api/collections/${testCollection.id}`)
        .send(updateData)
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String),
      });
    });

    it('应该验证更新数据的格式', async () => {
      const invalidData = {
        name: 123, // 应该是字符串
        description: true, // 应该是字符串
      };

      const response = await request(testEnv.app)
        .put(`/api/collections/${testCollection.id}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String),
      });
    });
  });
});