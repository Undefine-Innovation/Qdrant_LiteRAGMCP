/**
 * Collection ID生成和数据库保存测试
 * 诊断collectionId约束问题
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
import { DataSource } from 'typeorm';
import { Collection } from '@infrastructure/database/entities/Collection.js';
import { CollectionAggregate } from '@domain/aggregates/CollectionAggregate.js';
import { CollectionIdGenerator } from '@domain/value-objects/CollectionIdGenerator.js';
import {
  initializeTestDatabase,
  resetTestDatabase,
} from '../test-data-factory.js';

describe('Collection ID Generation and Database Tests', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = await initializeTestDatabase();
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  describe('Collection ID生成', () => {
    it('应该正确生成CollectionId', () => {
      const collectionId = CollectionIdGenerator.generate();

      expect(collectionId).toBeDefined();
      expect(typeof collectionId).toBe('string');
      expect(collectionId.length).toBeGreaterThan(0);

      console.log('Generated CollectionId:', collectionId);
    });

    it('应该生成唯一的CollectionId', () => {
      const id1 = CollectionIdGenerator.generate();
      const id2 = CollectionIdGenerator.generate();

      expect(id1).not.toBe(id2);
    });
  });

  describe('Collection Aggregate创建', () => {
    it('应该正确创建Collection Aggregate', () => {
      const collectionId = CollectionIdGenerator.generate();
      const name = 'Test Collection';
      const description = 'Test Description';

      const aggregate = CollectionAggregate.create(
        collectionId,
        name,
        description,
      );

      expect(aggregate).toBeDefined();
      expect(aggregate.id).toBe(collectionId);
      expect(aggregate.name).toBe(name);
      expect(aggregate.description).toBe(description);

      console.log('Created aggregate:', {
        id: aggregate.id,
        collectionId: (aggregate as any).collectionId,
        name: aggregate.name,
      });
    });
  });

  describe('数据库直接保存', () => {
    it('应该能够直接保存Collection实体到数据库', async () => {
      const repository = dataSource.getRepository(Collection);

      const collectionId = CollectionIdGenerator.generate();
      const collection = repository.create({
        id: `col_${Date.now()}`, // 确保id唯一
        collectionId: collectionId,
        name: 'Direct Save Test Collection',
        description: 'Testing direct save',
        status: 'active' as const,
        documentCount: 0,
        chunkCount: 0,
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      console.log('Before save - collection data:', {
        id: collection.id,
        collectionId: collection.collectionId,
        name: collection.name,
      });

      const savedCollection = await repository.save(collection);

      expect(savedCollection.id).toBe(collection.id);
      expect(savedCollection.collectionId).toBe(collectionId);
      expect(savedCollection.name).toBe('Direct Save Test Collection');

      console.log('After save - saved collection:', {
        id: savedCollection.id,
        collectionId: savedCollection.collectionId,
        name: savedCollection.name,
      });
    });

    it('应该自动为collectionId赋值（从id）', async () => {
      // 注意: setCollectionIdBeforeInsert() 钩子会自动为 collectionId 赋值
      // 这是有意的设计，确保 collectionId 总是有值
      const repository = dataSource.getRepository(Collection);

      const collection = new Collection();
      collection.id = `col_${Date.now()}`;
      // 故意不设置collectionId，让它自动生成
      collection.name = 'Auto CollectionId Test';
      collection.description = 'Testing auto collectionId assignment';
      collection.status = 'active' as const;
      collection.documentCount = 0;
      collection.chunkCount = 0;
      collection.created_at = Date.now();
      collection.updated_at = Date.now();

      const savedCollection = await repository.save(collection);

      // 验证 collectionId 被自动设置为 id 的值
      expect(savedCollection.collectionId).toBe(collection.id);
      expect(savedCollection.name).toBe('Auto CollectionId Test');
    });
  });
});
