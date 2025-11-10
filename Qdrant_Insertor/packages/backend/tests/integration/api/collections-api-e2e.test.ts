/**
 * 集合管理API端到端测试
 * 测试集合相关的所有API端点
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
import {
  createApiTestEnvironment,
  ApiTestUtils,
  ApiTestDataFactory,
  resetTestDatabase,
} from './api-test-setup.test.js';

describe('Collections API E2E Tests', () => {
  let testEnv: {
    app: express.Application;
    dataSource: DataSource;
    config: any;
    logger: any;
  };
  let testCollection: Collection;

  beforeAll(async () => {
    // 创建测试环境
    testEnv = await createApiTestEnvironment();
  });

  afterAll(async () => {
    // 清理测试环境
    if (testEnv?.dataSource && testEnv.dataSource.isInitialized) {
      await testEnv.dataSource.destroy();
    }
  });

  beforeEach(async () => {
    // 重置测试数据库
    await resetTestDatabase();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // 清理测试数据
    if (testEnv?.dataSource && testEnv.dataSource.isInitialized) {
      const collectionRepository = testEnv.dataSource.getRepository(Collection);
      await collectionRepository.clear();
    }
  });

  describe('POST /api/collections', () => {
    it('应该成功创建集合', async () => {
      // Arrange
      const collectionData = ApiTestDataFactory.createCollectionData();

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post('/api/collections')
        .send(collectionData);

      // Assert
      ApiTestUtils.validateApiResponse(response, 201, ['id', 'name', 'description']);
      expect(response.body.name).toBe(collectionData.name);
      expect(response.body.description).toBe(collectionData.description);
      expect(response.body.id).toBeDefined();
      expect(response.body.created_at).toBeDefined();
      expect(response.body.updated_at).toBeDefined();
    });

    it('应该拒绝空名称的集合', async () => {
      // Arrange
      const collectionData = ApiTestDataFactory.createCollectionData({ name: '' });

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post('/api/collections')
        .send(collectionData);

      // Assert
      ApiTestUtils.validateErrorResponse(response, 400, 'VALIDATION_ERROR');
    });

    it('应该拒绝缺少名称的请求', async () => {
      // Arrange
      const collectionData = { description: 'Test description' };

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post('/api/collections')
        .send(collectionData);

      // Assert
      ApiTestUtils.validateErrorResponse(response, 400);
    });

    it('应该拒绝过长的名称', async () => {
      // Arrange
      const collectionData = ApiTestDataFactory.createCollectionData({
        name: 'x'.repeat(300), // 超过255字符限制
      });

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post('/api/collections')
        .send(collectionData);

      // Assert
      ApiTestUtils.validateErrorResponse(response, 400);
    });

    it('应该防止XSS攻击', async () => {
      // Arrange
      const collectionData = ApiTestDataFactory.createCollectionData({
        name: '<script>alert("xss")</script>',
        description: 'Test description',
      });

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post('/api/collections')
        .send(collectionData);

      // Assert
      ApiTestUtils.validateApiResponse(response, 201);
      expect(response.body.name).not.toContain('<script>');
    });
  });

  describe('GET /api/collections', () => {
    beforeEach(async () => {
      // 创建测试数据
      const collectionRepository = testEnv.dataSource.getRepository(Collection);
      const collections = [
        ApiTestDataFactory.createCollectionData({ name: 'Collection 1' }),
        ApiTestDataFactory.createCollectionData({ name: 'Collection 2' }),
        ApiTestDataFactory.createCollectionData({ name: 'Collection 3' }),
      ];

      for (const data of collections) {
        const collection = collectionRepository.create(data);
        await collectionRepository.save(collection);
      }
    });

    it('应该返回所有集合（无分页）', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/collections');

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

    it('应该返回分页的集合', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/collections')
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

    it('应该支持排序参数', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/collections')
        .query({ sort: 'name', order: 'asc' });

      // Assert
      ApiTestUtils.validateApiResponse(response, 200, ['data', 'pagination']);
      expect(response.body.data).toHaveLength(3);
      // 验证排序
      for (let i = 1; i < response.body.data.length; i++) {
        expect(response.body.data[i-1].name.localeCompare(response.body.data[i].name)).toBeLessThanOrEqual(0);
      }
    });

    it('应该验证分页参数', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/collections')
        .query({ page: -1, limit: 0 });

      // Assert
      ApiTestUtils.validateErrorResponse(response, 400, 'VALIDATION_ERROR');
    });

    it('应该处理空集合列表', async () => {
      // Arrange
      const collectionRepository = testEnv.dataSource.getRepository(Collection);
      await collectionRepository.clear();

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/collections');

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

  describe('GET /api/collections/:collectionId', () => {
    beforeEach(async () => {
      // 创建测试集合
      const collectionRepository = testEnv.dataSource.getRepository(Collection);
      const collectionData = ApiTestDataFactory.createCollectionData({
        name: 'Test Collection',
      });
      testCollection = collectionRepository.create(collectionData);
      testCollection = await collectionRepository.save(testCollection);
    });

    it('应该返回指定的集合', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get(`/api/collections/${testCollection.id}`);

      // Assert
      ApiTestUtils.validateApiResponse(response, 200, ['id', 'name', 'description']);
      expect(response.body.id).toBe(testCollection.id);
      expect(response.body.name).toBe(testCollection.name);
      expect(response.body.description).toBe(testCollection.description);
    });

    it('应该返回404当集合不存在', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/collections/non-existent-id');

      // Assert
      ApiTestUtils.validateErrorResponse(response, 404, 'NOT_FOUND');
    });

    it('应该验证集合ID格式', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/collections/invalid-id');

      // Assert
      ApiTestUtils.validateErrorResponse(response, 400, 'VALIDATION_ERROR');
    });
  });

  describe('PUT /api/collections/:collectionId', () => {
    beforeEach(async () => {
      // 创建测试集合
      const collectionRepository = testEnv.dataSource.getRepository(Collection);
      const collectionData = ApiTestDataFactory.createCollectionData({
        name: 'Original Collection',
        description: 'Original description',
      });
      testCollection = collectionRepository.create(collectionData);
      testCollection = await collectionRepository.save(testCollection);
    });

    it('应该成功更新集合', async () => {
      // Arrange
      const updateData = {
        name: 'Updated Collection',
        description: 'Updated description',
      };

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .put(`/api/collections/${testCollection.id}`)
        .send(updateData);

      // Assert
      ApiTestUtils.validateApiResponse(response, 200, ['id', 'name', 'description']);
      expect(response.body.id).toBe(testCollection.id);
      expect(response.body.name).toBe(updateData.name);
      expect(response.body.description).toBe(updateData.description);
    });

    it('应该拒绝空名称的更新', async () => {
      // Arrange
      const updateData = {
        name: '',
        description: 'Updated description',
      };

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .put(`/api/collections/${testCollection.id}`)
        .send(updateData);

      // Assert
      ApiTestUtils.validateErrorResponse(response, 422, 'VALIDATION_ERROR');
    });

    it('应该返回404当更新不存在的集合', async () => {
      // Arrange
      const updateData = {
        name: 'Updated Collection',
        description: 'Updated description',
      };

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .put('/api/collections/non-existent-id')
        .send(updateData);

      // Assert
      ApiTestUtils.validateErrorResponse(response, 404, 'NOT_FOUND');
    });
  });

  describe('PATCH /api/collections/:collectionId', () => {
    beforeEach(async () => {
      // 创建测试集合
      const collectionRepository = testEnv.dataSource.getRepository(Collection);
      const collectionData = ApiTestDataFactory.createCollectionData({
        name: 'Original Collection',
        description: 'Original description',
      });
      testCollection = collectionRepository.create(collectionData);
      testCollection = await collectionRepository.save(testCollection);
    });

    it('应该成功部分更新集合', async () => {
      // Arrange
      const updateData = {
        description: 'Partially updated description',
      };

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .patch(`/api/collections/${testCollection.id}`)
        .send(updateData);

      // Assert
      ApiTestUtils.validateApiResponse(response, 200, ['id', 'name', 'description']);
      expect(response.body.id).toBe(testCollection.id);
      expect(response.body.name).toBe(testCollection.name); // 名称未更改
      expect(response.body.description).toBe(updateData.description);
    });

    it('应该支持只更新名称', async () => {
      // Arrange
      const updateData = {
        name: 'Partially updated name',
      };

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .patch(`/api/collections/${testCollection.id}`)
        .send(updateData);

      // Assert
      ApiTestUtils.validateApiResponse(response, 200);
      expect(response.body.name).toBe(updateData.name);
      expect(response.body.description).toBe(testCollection.description); // 描述未更改
    });
  });

  describe('DELETE /api/collections/:collectionId', () => {
    beforeEach(async () => {
      // 创建测试集合
      const collectionRepository = testEnv.dataSource.getRepository(Collection);
      const collectionData = ApiTestDataFactory.createCollectionData({
        name: 'Collection to Delete',
      });
      testCollection = collectionRepository.create(collectionData);
      testCollection = await collectionRepository.save(testCollection);
    });

    it('应该成功删除集合', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .delete(`/api/collections/${testCollection.id}`);

      // Assert
      expect(response.status).toBe(204);
      expect(response.body).toEqual({});

      // 验证集合已删除
      const collectionRepository = testEnv.dataSource.getRepository(Collection);
      const deletedCollection = await collectionRepository.findOne({
        where: { id: testCollection.id },
      });
      expect(deletedCollection).toBeNull();
    });

    it('应该返回404当删除不存在的集合', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .delete('/api/collections/non-existent-id');

      // Assert
      ApiTestUtils.validateErrorResponse(response, 404, 'NOT_FOUND');
    });

    it('应该级联删除集合中的文档', async () => {
      // Arrange
      const docRepository = testEnv.dataSource.getRepository(Doc);
      const docData = ApiTestDataFactory.createDocumentData({
        collectionId: testCollection.id,
      });
      const doc = docRepository.create(docData);
      await docRepository.save(doc);

      // Act
      await ApiTestUtils.createRequest(testEnv.app)
        .delete(`/api/collections/${testCollection.id}`);

      // Assert
      const remainingDocs = await docRepository.find({
        where: { collectionId: testCollection.id },
      });
      expect(remainingDocs).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('应该处理无效的JSON', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post('/api/collections')
        .send('invalid json')
        .set('Content-Type', 'application/json');

      // Assert
      ApiTestUtils.validateErrorResponse(response, 400, 'VALIDATION_ERROR');
    });

    it('应该处理过大的请求体', async () => {
      // Arrange
      const largeData = {
        name: 'Test Collection',
        description: 'x'.repeat(1000000), // 1MB的描述
      };

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post('/api/collections')
        .send(largeData);

      // Assert
      ApiTestUtils.validateErrorResponse(response, 413, 'PAYLOAD_TOO_LARGE');
    });

    it('应该处理数据库连接错误', async () => {
      // Arrange
      const collectionData = ApiTestDataFactory.createCollectionData();
      
      // 关闭数据库连接模拟错误
      await testEnv.dataSource.destroy();

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .post('/api/collections')
        .send(collectionData);

      // Assert
      ApiTestUtils.validateErrorResponse(response, 500, 'INTERNAL_ERROR');
    });
  });

  describe('Response Format', () => {
    it('应该返回正确的Content-Type', async () => {
      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get('/api/collections');

      // Assert
      expect(response.headers['content-type']).toMatch(/json/);
    });

    it('应该包含必要的响应字段', async () => {
      // Arrange
      const collectionRepository = testEnv.dataSource.getRepository(Collection);
      const collectionData = ApiTestDataFactory.createCollectionData();
      const collection = collectionRepository.create(collectionData);
      const savedCollection = await collectionRepository.save(collection);

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get(`/api/collections/${savedCollection.id}`);

      // Assert
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('description');
      expect(response.body).toHaveProperty('created_at');
      expect(response.body).toHaveProperty('updated_at');
    });

    it('应该正确处理日期字段', async () => {
      // Arrange
      const collectionRepository = testEnv.dataSource.getRepository(Collection);
      const collectionData = ApiTestDataFactory.createCollectionData();
      const collection = collectionRepository.create(collectionData);
      const savedCollection = await collectionRepository.save(collection);

      // Act
      const response = await ApiTestUtils.createRequest(testEnv.app)
        .get(`/api/collections/${savedCollection.id}`);

      // Assert
      expect(response.body.created_at).toBeDefined();
      expect(response.body.updated_at).toBeDefined();
      expect(typeof response.body.created_at).toBe('number');
      expect(typeof response.body.updated_at).toBe('number');
    });
  });
});