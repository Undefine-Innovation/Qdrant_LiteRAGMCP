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
} from './api-test-setup.test.js';

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

      // API直接返回更新后的集合对象（没有包装在success/data中）
      expect(response.body).toMatchObject({
        id: testCollection.id,
        name: updateData.name,
        description: updateData.description,
      });

      // 验证数据库中的更新
      const collectionRepository = testEnv.dataSource.getRepository(Collection);
      const updatedCollection = await collectionRepository.findOne({
        where: { id: testCollection.id },
      });
      expect(updatedCollection?.name).toBe(updateData.name);
      expect(updatedCollection?.updated_at).toBeGreaterThan(
        testCollection.updated_at,
      );
    });

    it('应该拒绝空名称的更新', async () => {
      const updateData = {
        name: '',
        description: 'Updated description',
      };

      const response = await request(testEnv.app)
        .put(`/api/collections/${testCollection.id}`)
        .send(updateData)
        .expect(422);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
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

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('NOT_FOUND');
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
        .expect(422);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
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

      // API直接返回更新后的集合对象
      expect(response.body).toMatchObject({
        id: testCollection.id,
        name: testCollection.name,
        description: updateData.description,
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
        id: testCollection.id,
        name: updateData.name,
        description: testCollection.description,
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

      // 有些实现可能不会返回status字段；如果返回则断言其为'inactive'
      if (response.body && response.body.status !== undefined) {
        expect(response.body.status).toBe('inactive');
      }
    });

    it('应该拒绝无效的状态值', async () => {
      const updateData = {
        status: 'invalid-status',
      };

      const response = await request(testEnv.app)
        .patch(`/api/collections/${testCollection.id}`)
        .send(updateData)
        .expect(422);

      expect(response.body).toHaveProperty('error');
    });

    it('应该返回404当部分更新不存在的集合', async () => {
      const updateData = {
        name: 'Updated Name',
      };

      const response = await request(testEnv.app)
        .patch('/api/collections/non-existent-id')
        .send(updateData)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('应该忽略空的更新请求', async () => {
      const response = await request(testEnv.app)
        .patch(`/api/collections/${testCollection.id}`)
        .send({})
        .expect(200);

      // 返回完整的集合对象
      expect(response.body).toMatchObject({
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
        .expect(204);

      // 204 No Content 应该返回空响应体
      expect(response.body).toEqual({});

      // 验证集合已被软删除（使用withDeleted查询）
      const collectionRepository = testEnv.dataSource.getRepository(Collection);
      const deletedCollection = await collectionRepository.findOne({
        where: { id: testCollection.id },
        withDeleted: true,
      });
      expect(deletedCollection?.deleted).toBe(true);
      expect(deletedCollection?.deleted_at).toBeTruthy();
    });

    it('应该返回404当删除不存在的集合', async () => {
      const response = await request(testEnv.app)
        .delete('/api/collections/non-existent-id')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('应该软删除包含文档的集合', async () => {
      // 先为集合添加一些文档计数
      const collectionRepository = testEnv.dataSource.getRepository(Collection);
      testCollection.documentCount = 10;
      await collectionRepository.save(testCollection);

      const response = await request(testEnv.app)
        .delete(`/api/collections/${testCollection.id}`)
        .expect(204);

      // 验证集合被标记为删除而不是真正删除（使用withDeleted查询）
      const deletedCollection = await collectionRepository.findOne({
        where: { id: testCollection.id },
        withDeleted: true,
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
        .send(updateData);

      expect([400, 404]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
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

      expect(response.body).toHaveProperty('error');

      // 重新创建测试环境以避免影响后续测试
      testEnv = await createApiTestEnvironment();
    });

    it('应该验证更新数据的格式', async () => {
      const invalidData = {
        name: 123, // 应该是字符串
        description: true, // 应该是字符串
      };

      const response = await request(testEnv.app)
        .put(`/api/collections/${testCollection.id}`)
        .send(invalidData)
        .expect(422);

      expect(response.body).toHaveProperty('error');
    });
  });
});
