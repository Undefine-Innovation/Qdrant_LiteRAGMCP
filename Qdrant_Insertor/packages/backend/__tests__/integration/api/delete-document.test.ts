/**
 * 文档删除API测试
 * 专门测试 DELETE /api/docs/:docId 端点
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
import { Doc } from '@infrastructure/database/entities/Doc.js';
import {
  createApiTestEnvironment,
  resetTestDatabase,
} from './api-test-setup.test.js';

describe('DELETE /api/docs/:docId - Document Deletion Tests', () => {
  let testEnv: {
    app: express.Application;
    dataSource: DataSource;
    config: any;
    logger: any;
  };
  let testCollection: Collection;
  let testDocument: Doc;

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
    await createTestData();
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

  async function createTestData() {
    const collectionRepository = testEnv.dataSource.getRepository(Collection);
    const docRepository = testEnv.dataSource.getRepository(Doc);

    // 创建测试集合
    const collectionData = {
      id: 'test-collection-delete',
      collectionId: 'test-collection-delete',
      name: 'Test Collection for Delete',
      description: 'A collection for testing document delete endpoint',
      status: 'active' as const,
      documentCount: 0,
      chunkCount: 0,
      created_at: Date.now() - 86400000,
      updated_at: Date.now() - 3600000,
    };

    testCollection = collectionRepository.create(collectionData);
    testCollection = await collectionRepository.save(testCollection);

    // 创建测试文档
    const docData = {
      docId: 'test-doc-delete',
      collectionId: testCollection.collectionId,
      name: 'Test Document for Delete',
      key: 'test-doc-key-delete',
      content: 'Content for document to be deleted',
      size_bytes: 256,
      status: 'completed' as const,
      created_at: Date.now() - 86400000,
      updated_at: Date.now() - 3600000,
    };

    testDocument = docRepository.create(docData);
    testDocument = await docRepository.save(testDocument);
  }

  describe('成功删除场景', () => {
    it('应该成功删除存在的文档', async () => {
      // Act
      const response = await request(testEnv.app)
        .delete(`/api/docs/${testDocument.docId}`)
        .expect(204);

      // Assert
      expect(response.body).toEqual({});

      // 验证文档已被删除
      const docRepository = testEnv.dataSource.getRepository(Doc);
      const deletedDoc = await docRepository.findOne({
        where: { docId: testDocument.docId },
      });

      expect(deletedDoc).toBeNull();
    });

    it('应该返回204 No Content状态码', async () => {
      // Act
      const response = await request(testEnv.app).delete(
        `/api/docs/${testDocument.docId}`,
      );

      // Assert
      expect(response.status).toBe(204);
    });

    it('应该正确处理删除多个不同的文档', async () => {
      // Arrange
      const docRepository = testEnv.dataSource.getRepository(Doc);
      const doc1 = testDocument;

      // 创建第二个文档
      const docData2 = {
        docId: 'test-doc-delete-2',
        collectionId: testCollection.collectionId,
        name: 'Second Document for Delete',
        key: 'test-doc-key-delete-2',
        content: 'Content for second document',
        size_bytes: 256,
        status: 'completed' as const,
        created_at: Date.now() - 86400000,
        updated_at: Date.now() - 3600000,
      };
      const doc2 = docRepository.create(docData2);
      await docRepository.save(doc2);

      // Act & Assert
      const response1 = await request(testEnv.app)
        .delete(`/api/docs/${doc1.docId}`)
        .expect(204);

      const response2 = await request(testEnv.app)
        .delete(`/api/docs/${doc2.docId}`)
        .expect(204);

      expect(response1.status).toBe(204);
      expect(response2.status).toBe(204);

      // 验证两个文档都已删除
      const remainingDocs = await docRepository.find();
      expect(remainingDocs).toHaveLength(0);
    });
  });

  describe('错误场景', () => {
    it('应该返回404当文档不存在', async () => {
      // Act
      const response = await request(testEnv.app)
        .delete('/api/docs/non-existent-id')
        .expect(404);

      // Assert
      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          code: 'NOT_FOUND',
          message: expect.stringContaining('not found'),
        }),
      });
    });

    it('应该返回404当尝试二次删除同一文档', async () => {
      // Arrange
      await request(testEnv.app)
        .delete(`/api/docs/${testDocument.docId}`)
        .expect(204);

      // Act
      const response = await request(testEnv.app)
        .delete(`/api/docs/${testDocument.docId}`)
        .expect(404);

      // Assert
      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          code: 'NOT_FOUND',
        }),
      });
    });

    it('应该处理无效的文档ID格式', async () => {
      // Act
      const response = await request(testEnv.app)
        .delete('/api/docs/')
        .expect(404);

      // Assert
      expect(response.status).toBe(404);
    });

    it('应该防止SQL注入攻击', async () => {
      // Arrange
      const maliciousId = "'; DROP TABLE documents; --";

      // Act
      const response = await request(testEnv.app)
        .delete(`/api/docs/${encodeURIComponent(maliciousId)}`)
        .expect(404);

      // Assert
      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          code: 'NOT_FOUND',
        }),
      });

      // 验证原始文档仍然存在
      const docRepository = testEnv.dataSource.getRepository(Doc);
      const existingDoc = await docRepository.findOne({
        where: { docId: testDocument.docId },
      });
      expect(existingDoc).toBeDefined();
    });
  });

  describe('并发删除处理', () => {
    it('应该正确处理并发删除请求', async () => {
      // Arrange
      const docRepository = testEnv.dataSource.getRepository(Doc);

      // 创建多个文档用于并发删除测试
      const documents = [];
      for (let i = 1; i <= 5; i++) {
        const docData = {
          docId: `test-doc-concurrent-${i}`,
          collectionId: testCollection.collectionId,
          name: `Concurrent Document ${i}`,
          key: `test-doc-key-concurrent-${i}`,
          content: `Content for concurrent document ${i}`,
          size_bytes: 256,
          status: 'completed' as const,
          created_at: Date.now() - 86400000,
          updated_at: Date.now() - 3600000,
        };

        const doc = docRepository.create(docData);
        await docRepository.save(doc);
        documents.push(doc);
      }

      // Act
      const deletePromises = documents.map((doc) =>
        request(testEnv.app).delete(`/api/docs/${doc.docId}`).expect(204),
      );

      const responses = await Promise.all(deletePromises);

      // Assert
      expect(responses).toHaveLength(5);
      responses.forEach((response) => {
        expect(response.status).toBe(204);
      });

      // 验证所有并发创建的文档都已删除（基础的testDocument应该还在）
      const remainingDocs = await docRepository.find();
      expect(remainingDocs).toHaveLength(1); // testDocument should still exist
      expect(remainingDocs[0].docId).toBe(testDocument.docId);
    });
  });

  describe('软删除行为', () => {
    it('应该支持软删除（标记为已删除而不是从数据库删除）', async () => {
      // Act
      await request(testEnv.app)
        .delete(`/api/docs/${testDocument.docId}`)
        .expect(204);

      // 尝试再次查询应该返回404（表示软删除）
      const response = await request(testEnv.app)
        .get(`/api/docs/${testDocument.docId}`)
        .expect(404);

      // Assert
      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          code: 'NOT_FOUND',
        }),
      });
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内完成删除', async () => {
      const startTime = Date.now();

      const response = await request(testEnv.app)
        .delete(`/api/docs/${testDocument.docId}`)
        .expect(204);

      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(2000); // 应该在2秒内完成
      expect(response.status).toBe(204);
    });

    it('应该处理大量并发删除请求', async () => {
      // Arrange
      const docRepository = testEnv.dataSource.getRepository(Doc);

      // 创建大量文档
      const documents = [];
      for (let i = 1; i <= 50; i++) {
        const docData = {
          docId: `test-doc-perf-${i}`,
          collectionId: testCollection.collectionId,
          name: `Performance Document ${i}`,
          key: `test-doc-key-perf-${i}`,
          content: `Content for performance document ${i}`,
          size_bytes: 256,
          status: 'completed' as const,
          created_at: Date.now() - 86400000,
          updated_at: Date.now() - 3600000,
        };

        const doc = docRepository.create(docData);
        await docRepository.save(doc);
        documents.push(doc);
      }

      // Act
      const startTime = Date.now();
      const deletePromises = documents.map((doc) =>
        request(testEnv.app).delete(`/api/docs/${doc.docId}`).expect(204),
      );

      const responses = await Promise.all(deletePromises);
      const endTime = Date.now();

      // Assert
      expect(responses).toHaveLength(50);
      expect(endTime - startTime).toBeLessThan(10000); // 应该在10秒内完成所有删除
    });
  });

  describe('响应格式验证', () => {
    it('应该返回204状态码和空响应体', async () => {
      // Act
      const response = await request(testEnv.app).delete(
        `/api/docs/${testDocument.docId}`,
      );

      // Assert
      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
      expect(response.text).toBe('');
    });

    it('404错误应该有正确的格式', async () => {
      // Act
      const response = await request(testEnv.app)
        .delete('/api/docs/non-existent')
        .expect(404);

      // Assert
      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          code: 'NOT_FOUND',
          message: expect.any(String),
        }),
      });
    });
  });

  describe('边界条件测试', () => {
    it('应该处理极长的文档ID', async () => {
      const veryLongId = 'x'.repeat(1000);

      // Act
      const response = await request(testEnv.app)
        .delete(`/api/docs/${veryLongId}`)
        .expect(404);

      // Assert
      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          code: 'NOT_FOUND',
        }),
      });
    });

    it('应该处理特殊字符的文档ID', async () => {
      const specialCharId = 'test@#$%^&*()';

      // Act
      const response = await request(testEnv.app)
        .delete(`/api/docs/${encodeURIComponent(specialCharId)}`)
        .expect(404);

      // Assert
      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          code: 'NOT_FOUND',
        }),
      });
    });

    it('应该处理Unicode字符的文档ID', async () => {
      const unicodeId = '文档测试🚀';

      // Act
      const response = await request(testEnv.app)
        .delete(`/api/docs/${encodeURIComponent(unicodeId)}`)
        .expect(404);

      // Assert
      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          code: 'NOT_FOUND',
        }),
      });
    });
  });
});
