/**
 * 调试DELETE文档API测试 - 检查数据持久化
 */

import {
  describe,
  beforeAll,
  beforeEach,
  afterAll,
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

describe('调试 DELETE /api/docs/:docId - 数据持久化检查', () => {
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

  it('应该成功创建并查询文档', async () => {
    const collectionRepo = testEnv.dataSource.getRepository(Collection);
    const docRepo = testEnv.dataSource.getRepository(Doc);

    // 1. 创建集合
    const collectionData = {
      id: 'test-collection-debug',
      collectionId: 'test-collection-debug',
      name: 'Debug Collection',
      description: 'Test',
      status: 'active' as const,
      documentCount: 0,
      chunkCount: 0,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    const collection = collectionRepo.create(collectionData);
    const savedCollection = await collectionRepo.save(collection);

    console.log('✓ 集合已保存:', savedCollection.collectionId);

    // 2. 创建文档
    const docData = {
      docId: 'test-doc-debug',
      collectionId: savedCollection.collectionId,
      name: 'Debug Doc',
      key: 'test-key',
      content: 'Test content',
      size_bytes: 100,
      status: 'completed' as const,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    const doc = docRepo.create(docData);
    const savedDoc = await docRepo.save(doc);

    console.log('✓ 文档已保存:', savedDoc.docId);

    // 3. 验证文档存在于数据库
    const foundDoc = await docRepo.findOne({
      where: { docId: 'test-doc-debug' },
    });

    console.log('✓ 查询结果:', foundDoc ? foundDoc.docId : 'NULL');
    expect(foundDoc).not.toBeNull();
    expect(foundDoc?.docId).toBe('test-doc-debug');

    // 4. 尝试通过API删除
    console.log('→ 尝试 DELETE /api/docs/test-doc-debug');
    const response = await request(testEnv.app).delete(
      '/api/docs/test-doc-debug',
    );

    console.log('← 响应状态:', response.status);
    console.log('← 响应体:', JSON.stringify(response.body, null, 2));

    // 验证状态码
    if (response.status === 404) {
      console.error('❌ API返回404,但数据库中确实存在该文档!');
      console.error('可能的原因:');
      console.error('1. 路由未正确匹配');
      console.error('2. Service层查询逻辑问题');
      console.error('3. 数据源不一致');
    }

    expect(response.status).toBe(204);
  });

  it('应该列出所有表中的数据', async () => {
    const collectionRepo = testEnv.dataSource.getRepository(Collection);
    const docRepo = testEnv.dataSource.getRepository(Doc);

    // 创建测试数据
    const collection = collectionRepo.create({
      id: 'col-1',
      collectionId: 'col-1',
      name: 'Collection 1',
      status: 'active',
      documentCount: 0,
      chunkCount: 0,
      created_at: Date.now(),
      updated_at: Date.now(),
    });
    await collectionRepo.save(collection);

    const doc = docRepo.create({
      docId: 'doc-1',
      collectionId: 'col-1',
      name: 'Doc 1',
      key: 'key-1',
      content: 'content',
      size_bytes: 50,
      status: 'completed',
      created_at: Date.now(),
      updated_at: Date.now(),
    });
    await docRepo.save(doc);

    // 查询所有集合
    const allCollections = await collectionRepo.find();
    console.log('集合总数:', allCollections.length);
    console.log(
      '集合列表:',
      allCollections.map((c: Collection) => c.collectionId),
    );

    // 查询所有文档
    const allDocs = await docRepo.find();
    console.log('文档总数:', allDocs.length);
    console.log(
      '文档列表:',
      allDocs.map((d: Doc) => d.docId),
    );

    expect(allCollections.length).toBeGreaterThan(0);
    expect(allDocs.length).toBeGreaterThan(0);
  });
});
