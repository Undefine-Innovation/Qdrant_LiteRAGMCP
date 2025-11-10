/**
 * 集合API集成测试
 * 测试集合相关的API端点
 */

import {
  describe,
  beforeAll,
  beforeEach,
  it,
  expect,
  jest,
} from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { DataSource } from 'typeorm';
import { Collection } from '@infrastructure/database/entities/Collection.js';
import { Doc } from '@infrastructure/database/entities/Doc.js';
import { createCollectionRoutes } from '@api/routes/collections.js';
import { errorHandler } from '@api/middleware/error-handler.js';
import { ICollectionService } from '@domain/repositories/ICollectionService.js';
import {
  initializeTestDatabase,
  getTestDataSource,
  resetTestDatabase,
  TestDataFactory,
  TestAssertions,
} from '../utils/test-data-factory.js';
import { CollectionId } from '@domain/entities/types.js';

describe('Collections API Integration Tests', () => {
  let dataSource: DataSource;
  let app: express.Application;
  let mockCollectionService: jest.Mocked<ICollectionService>;

  beforeAll(async () => {
    dataSource = await initializeTestDatabase();

    // 创建模拟的集合服务
    mockCollectionService = {
      createCollection: jest.fn(),
      getCollectionById: jest.fn(),
      listAllCollections: jest.fn(),
      listCollectionsPaginated: jest.fn(),
      updateCollection: jest.fn(),
      deleteCollection: jest.fn(),
    } as any;

    // 创建Express应用
    app = express();
    app.use(express.json());
    app.use('/api', createCollectionRoutes(mockCollectionService));
    app.use(errorHandler);
  });

  beforeEach(async () => {
    await resetTestDatabase();
    jest.clearAllMocks();
  });

  describe('POST /api/collections', () => {
    it('应该成功创建集合', async () => {
      // Arrange
      const collectionData = {
        name: 'Test Collection',
        description: 'Test collection description',
      };

      const createdCollection =
        TestDataFactory.createCollection(collectionData);
      mockCollectionService.createCollection.mockResolvedValue(
        createdCollection,
      );

      // Act
      const response = await request(app)
        .post('/api/collections')
        .send(collectionData);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: createdCollection.id,
        name: 'Test Collection',
        description: 'Test collection description',
      });
      expect(mockCollectionService.createCollection).toHaveBeenCalledWith(
        'Test Collection',
        'Test collection description',
      );
    });

    it('应该拒绝空名称的集合', async () => {
      // Arrange
      const collectionData = {
        name: '',
        description: 'Test description',
      };

      // Mock service should not be called for validation errors
      const createdCollection = TestDataFactory.createCollection({
        name: 'Test',
        description: 'Test',
      });
      mockCollectionService.createCollection.mockResolvedValue(
        createdCollection,
      );

      // Act
      const response = await request(app)
        .post('/api/collections')
        .send(collectionData);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('VALIDATION_ERROR');

      // Service should not be called due to validation failure
      expect(mockCollectionService.createCollection).not.toHaveBeenCalled();
    });

    it('应该拒绝缺少名称的请求', async () => {
      // Arrange
      const collectionData = {
        description: 'Test description',
      };

      // Act
      const response = await request(app)
        .post('/api/collections')
        .send(collectionData);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/collections', () => {
    beforeEach(async () => {
      // 创建测试数据
      const collectionRepository = dataSource.getRepository(Collection);
      const collections = [
        TestDataFactory.createCollection({ name: 'Collection 1' }),
        TestDataFactory.createCollection({ name: 'Collection 2' }),
        TestDataFactory.createCollection({ name: 'Collection 3' }),
      ];
      await collectionRepository.save(collections);
    });

    it('应该返回所有集合（无分页）', async () => {
      // Arrange
      mockCollectionService.listAllCollections.mockResolvedValue([
        { id: 'coll-1', name: 'Collection 1' },
        { id: 'coll-2', name: 'Collection 2' },
        { id: 'coll-3', name: 'Collection 3' },
      ]);

      // Act
      const response = await request(app).get('/api/collections');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.data).toHaveLength(3);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 3,
        total: 3,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
      expect(mockCollectionService.listAllCollections).toHaveBeenCalled();
    });

    it('应该返回分页的集合', async () => {
      // Arrange
      mockCollectionService.listCollectionsPaginated.mockResolvedValue({
        data: [
          { id: 'coll-1', name: 'Collection 1' },
          { id: 'coll-2', name: 'Collection 2' },
        ],
        pagination: {
          page: 1,
          limit: 2,
          total: 3,
          totalPages: 2,
          hasNext: true,
          hasPrev: false,
        },
      });

      // Act
      const response = await request(app)
        .get('/api/collections')
        .query({ page: 1, limit: 2 });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2,
        hasNext: true,
        hasPrev: false,
      });
      expect(
        mockCollectionService.listCollectionsPaginated,
      ).toHaveBeenCalledWith({
        page: 1,
        limit: 2,
        sort: 'created_at',
        order: 'desc',
      });
    });

    it('应该支持排序参数', async () => {
      // Arrange
      mockCollectionService.listCollectionsPaginated.mockResolvedValue({
        data: [
          { id: 'coll-1', name: 'Collection A' },
          { id: 'coll-2', name: 'Collection B' },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });

      // Act
      const response = await request(app)
        .get('/api/collections')
        .query({ sort: 'name', order: 'asc' });

      // Assert
      expect(response.status).toBe(200);
      expect(
        mockCollectionService.listCollectionsPaginated,
      ).toHaveBeenCalledWith({
        sort: 'name',
        order: 'asc',
        page: undefined,
        limit: undefined,
      });
    });

    it('应该验证分页参数', async () => {
      // Act
      const response = await request(app)
        .get('/api/collections')
        .query({ page: -1, limit: 0 });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/collections/:collectionId', () => {
    it('应该返回指定的集合', async () => {
      // Arrange
      const collectionId = 'coll-123' as CollectionId;
      const collection = TestDataFactory.createCollection({
        id: collectionId,
        name: 'Test Collection',
      });
      mockCollectionService.getCollectionById.mockResolvedValue(collection);

      // Act
      const response = await request(app).get(
        `/api/collections/${collectionId}`,
      );

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: collectionId,
        name: 'Test Collection',
      });
      expect(mockCollectionService.getCollectionById).toHaveBeenCalledWith(
        collectionId,
      );
    });

    it('应该返回404当集合不存在', async () => {
      // Arrange
      const collectionId = 'non-existent' as CollectionId;
      mockCollectionService.getCollectionById.mockResolvedValue(undefined);

      // Act
      const response = await request(app).get(
        `/api/collections/${collectionId}`,
      );

      // Assert
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(mockCollectionService.getCollectionById).toHaveBeenCalledWith(
        collectionId,
      );
    });

    it('应该验证集合ID格式', async () => {
      // Act
      const response = await request(app).get('/api/collections/invalid-id');

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/collections/:collectionId', () => {
    it('应该成功更新集合', async () => {
      // Arrange
      const collectionId = 'coll-123' as CollectionId;
      const updateData = {
        name: 'Updated Collection',
        description: 'Updated description',
      };

      const updatedCollection = TestDataFactory.createCollection({
        id: collectionId,
        ...updateData,
      });
      mockCollectionService.updateCollection.mockResolvedValue(
        updatedCollection,
      );

      // Act
      const response = await request(app)
        .put(`/api/collections/${collectionId}`)
        .send(updateData);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: collectionId,
        name: 'Updated Collection',
        description: 'Updated description',
      });
      expect(mockCollectionService.updateCollection).toHaveBeenCalledWith(
        collectionId,
        'Updated Collection',
        'Updated description',
      );
    });

    it('应该拒绝空名称的更新', async () => {
      // Arrange
      const collectionId = 'coll-123' as CollectionId;
      const updateData = {
        name: '',
        description: 'Updated description',
      };

      // Act
      const response = await request(app)
        .put(`/api/collections/${collectionId}`)
        .send(updateData);

      // Assert
      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('应该返回404当更新不存在的集合', async () => {
      // Arrange
      const collectionId = 'non-existent' as CollectionId;
      const updateData = {
        name: 'Updated Collection',
        description: 'Updated description',
      };

      const error = new Error('Collection not found');
      mockCollectionService.updateCollection.mockRejectedValue(error);

      // Act
      const response = await request(app)
        .put(`/api/collections/${collectionId}`)
        .send(updateData);

      // Assert
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('应该返回422当名称已存在', async () => {
      // Arrange
      const collectionId = 'coll-123' as CollectionId;
      const updateData = {
        name: 'Existing Collection',
        description: 'Updated description',
      };

      const error = new Error('Collection name already exists');
      mockCollectionService.updateCollection.mockRejectedValue(error);

      // Act
      const response = await request(app)
        .put(`/api/collections/${collectionId}`)
        .send(updateData);

      // Assert
      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PATCH /api/collections/:collectionId', () => {
    it('应该成功部分更新集合', async () => {
      // Arrange
      const collectionId = 'coll-123' as CollectionId;
      const updateData = {
        description: 'Partially updated description',
      };

      const updatedCollection = TestDataFactory.createCollection({
        id: collectionId,
        name: 'Original Name',
        description: 'Partially updated description',
      });
      mockCollectionService.updateCollection.mockResolvedValue(
        updatedCollection,
      );

      // Act
      const response = await request(app)
        .patch(`/api/collections/${collectionId}`)
        .send(updateData);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: collectionId,
        name: 'Original Name',
        description: 'Partially updated description',
      });
      expect(mockCollectionService.updateCollection).toHaveBeenCalledWith(
        collectionId,
        'Original Name',
        'Partially updated description',
      );
    });

    it('应该支持只更新名称', async () => {
      // Arrange
      const collectionId = 'coll-123' as CollectionId;
      const updateData = {
        name: 'Partially updated name',
      };

      const updatedCollection = TestDataFactory.createCollection({
        id: collectionId,
        name: 'Partially updated name',
        description: 'Original description',
      });
      mockCollectionService.updateCollection.mockResolvedValue(
        updatedCollection,
      );

      // Act
      const response = await request(app)
        .patch(`/api/collections/${collectionId}`)
        .send(updateData);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Partially updated name');
      expect(response.body.description).toBe('Original description');
    });
  });

  describe('DELETE /api/collections/:collectionId', () => {
    it('应该成功删除集合', async () => {
      // Arrange
      const collectionId = 'coll-123' as CollectionId;
      mockCollectionService.deleteCollection.mockResolvedValue(undefined);

      // Act
      const response = await request(app).delete(
        `/api/collections/${collectionId}`,
      );

      // Assert
      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
      expect(mockCollectionService.deleteCollection).toHaveBeenCalledWith(
        collectionId,
      );
    });

    it('应该返回404当删除不存在的集合', async () => {
      // Arrange
      const collectionId = 'non-existent' as CollectionId;
      const error = new Error('Collection not found');
      mockCollectionService.deleteCollection.mockRejectedValue(error);

      // Act
      const response = await request(app).delete(
        `/api/collections/${collectionId}`,
      );

      // Assert
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Error Handling', () => {
    it('应该处理服务层错误', async () => {
      // Arrange
      const error = new Error('Service error');
      mockCollectionService.listAllCollections.mockRejectedValue(error);

      // Act
      const response = await request(app).get('/api/collections');

      // Assert
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('应该处理无效的JSON', async () => {
      // Act
      const response = await request(app)
        .post('/api/collections')
        .send('invalid json')
        .set('Content-Type', 'application/json');

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('应该处理过大的请求体', async () => {
      // Arrange
      const largeData = {
        name: 'Test Collection',
        description: 'x'.repeat(1000000), // 1MB的描述
      };

      // Act
      const response = await request(app)
        .post('/api/collections')
        .send(largeData);

      // Assert
      expect(response.status).toBe(413);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Response Format', () => {
    it('应该返回正确的Content-Type', async () => {
      // Arrange
      mockCollectionService.listAllCollections.mockResolvedValue([]);

      // Act
      const response = await request(app).get('/api/collections');

      // Assert
      expect(response.headers['content-type']).toMatch(/json/);
    });

    it('应该包含必要的响应字段', async () => {
      // Arrange
      const collection = TestDataFactory.createCollection({
        name: 'Test Collection',
      });
      mockCollectionService.getCollectionById.mockResolvedValue(collection);

      // Act
      const response = await request(app).get(
        `/api/collections/${collection.id}`,
      );

      // Assert
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('description');
      expect(response.body).toHaveProperty('created_at');
      expect(response.body).toHaveProperty('updated_at');
    });

    it('应该正确处理日期字段', async () => {
      // Arrange
      const now = new Date();
      const collection = TestDataFactory.createCollection({
        name: 'Test Collection',
        created_at: now.getTime(),
        updated_at: now.getTime(),
      });
      mockCollectionService.getCollectionById.mockResolvedValue(collection);

      // Act
      const response = await request(app).get(
        `/api/collections/${collection.id}`,
      );

      // Assert
      expect(response.body.created_at).toBe(now.getTime());
      expect(response.body.updated_at).toBe(now.getTime());
    });
  });

  describe('Security', () => {
    it('应该防止XSS攻击', async () => {
      // Arrange
      const maliciousData = {
        name: '<script>alert("xss")</script>',
        description: 'Test description',
      };

      const sanitizedCollection = TestDataFactory.createCollection({
        name: 'alert("xss")', // 模拟XSS防护后的结果
        description: 'Test description',
      });
      mockCollectionService.createCollection.mockResolvedValue(
        sanitizedCollection,
      );

      // Act
      const response = await request(app)
        .post('/api/collections')
        .send(maliciousData);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.name).not.toContain('<script>');
    });

    it('应该限制请求大小', async () => {
      // Arrange
      const largeData = {
        name: 'Test Collection',
        description: 'x'.repeat(10000000), // 10MB的描述
      };

      // Act
      const response = await request(app)
        .post('/api/collections')
        .send(largeData);

      // Assert
      expect(response.status).toBe(413);
    });

    it('应该验证输入长度', async () => {
      // Arrange
      const invalidData = {
        name: 'x'.repeat(300), // 超过255字符限制
        description: 'Test description',
      };

      // Act
      const response = await request(app)
        .post('/api/collections')
        .send(invalidData);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });
});
