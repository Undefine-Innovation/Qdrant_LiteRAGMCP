/**
 * 领域事件系统集成测试
 * 测试领域事件的发布、存储和处理
 */

import { DataSource } from 'typeorm';
import { Event } from '@infrastructure/database/entities/Event.js';
import { Collection } from '@infrastructure/database/entities/Collection.js';
import { Doc } from '@infrastructure/database/entities/Doc.js';
import { DomainEvent } from '@domain/events/DomainEvents.js';
import { EventPublisher } from '@domain/events/EventPublisher.js';
import { EventStore } from '@domain/events/EventStore.js';
import { EventSystemFactory } from '@domain/events/EventSystemFactory.js';
import {
  initializeTestDatabase,
  getTestDataSource,
  resetTestDatabase,
  TestDataFactory,
  TestAssertions,
} from '../utils/test-data-factory.js';
import { CollectionId } from '@domain/entities/types.js';

describe('Domain Events Integration Tests', () => {
  let dataSource: DataSource;
  let eventStore: EventStore;
  let eventPublisher: EventPublisher;

  beforeAll(async () => {
    dataSource = await initializeTestDatabase();

    // 初始化事件系统
    const eventSystem = EventSystemFactory.createTestEventSystem(getTestLogger());
    eventStore = eventSystem.eventStore;
    eventPublisher = eventSystem.eventPublisher;
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  describe('Event Storage', () => {
    it('应该能够存储领域事件', async () => {
      // Arrange
      const domainEvent: DomainEvent = {
        type: 'CollectionCreated',
        aggregateId: 'collection-123',
        aggregateType: 'Collection',
        data: {
          name: 'Test Collection',
          description: 'Test description',
        },
        version: 1,
        occurredAt: new Date().getTime(),
      };

      // Act
      await eventStore.saveEvent(domainEvent);

      // Assert
      const eventRepository = dataSource.getRepository(Event);
      const savedEvent = await eventRepository.findOne({
        where: { aggregateId: 'collection-123' },
      });

      expect(savedEvent).toBeDefined();
      expect(savedEvent.type).toBe('CollectionCreated');
      expect(savedEvent.aggregateId).toBe('collection-123');
      expect(savedEvent.aggregateType).toBe('Collection');
      expect(savedEvent.data.name).toBe('Test Collection');
      expect(savedEvent.version).toBe(1);
      expect(typeof savedEvent.occurredAt).toBe('number');
    });

    it('应该能够存储多个事件', async () => {
      // Arrange
      const events: DomainEvent[] = [
        {
          type: 'CollectionCreated',
          aggregateId: 'collection-123',
          aggregateType: 'Collection',
          data: { name: 'Test Collection' },
          version: 1,
          occurredAt: new Date().getTime(),
        },
        {
          type: 'DocumentAdded',
          aggregateId: 'collection-123',
          aggregateType: 'Collection',
          data: { documentId: 'doc-123' },
          version: 2,
          occurredAt: new Date().getTime(),
        },
        {
          type: 'ChunkAdded',
          aggregateId: 'collection-123',
          aggregateType: 'Collection',
          data: { chunkId: 'chunk-123' },
          version: 3,
          occurredAt: new Date(),
        },
      ];

      // Act
      for (const event of events) {
        await eventStore.saveEvent(event);
      }

      // Assert
      const eventRepository = dataSource.getRepository(Event);
      const savedEvents = await eventRepository.find({
        where: { aggregateId: 'collection-123' },
        order: { version: 'ASC' },
      });

      expect(savedEvents).toHaveLength(3);
      expect(savedEvents[0].type).toBe('CollectionCreated');
      expect(savedEvents[1].type).toBe('DocumentAdded');
      expect(savedEvents[2].type).toBe('ChunkAdded');
    });

    it('应该能够按聚合根ID获取事件', async () => {
      // Arrange
      const event1 = TestDataFactory.createEvent({
        type: 'CollectionCreated',
        aggregateId: 'collection-123',
        aggregateType: 'Collection',
      });
      const event2 = TestDataFactory.createEvent({
        type: 'DocumentAdded',
        aggregateId: 'collection-456',
        aggregateType: 'Collection',
      });
      const event3 = TestDataFactory.createEvent({
        type: 'ChunkAdded',
        aggregateId: 'collection-123',
        aggregateType: 'Collection',
      });

      await eventStore.saveEvent(event1);
      await eventStore.saveEvent(event2);
      await eventStore.saveEvent(event3);

      // Act
      const collection123Events =
        await eventStore.getEventsByAggregateId('collection-123');

      // Assert
      expect(collection123Events).toHaveLength(2);
      expect(collection123Events.map((e) => e.type)).toEqual(
        expect.arrayContaining(['CollectionCreated', 'ChunkAdded']),
      );
    });

    it('应该能够按事件类型获取事件', async () => {
      // Arrange
      const event1 = TestDataFactory.createEvent({
        type: 'CollectionCreated',
        aggregateId: 'collection-123',
        aggregateType: 'Collection',
      });
      const event2 = TestDataFactory.createEvent({
        type: 'CollectionCreated',
        aggregateId: 'collection-456',
        aggregateType: 'Collection',
      });
      const event3 = TestDataFactory.createEvent({
        type: 'DocumentAdded',
        aggregateId: 'collection-123',
        aggregateType: 'Collection',
      });

      await eventStore.saveEvent(event1);
      await eventStore.saveEvent(event2);
      await eventStore.saveEvent(event3);

      // Act
      const collectionCreatedEvents =
        await eventStore.getEventsByType('CollectionCreated');

      // Assert
      expect(collectionCreatedEvents).toHaveLength(2);
      expect(collectionCreatedEvents.map((e) => e.aggregateId)).toEqual(
        expect.arrayContaining(['collection-123', 'collection-456']),
      );
    });

    it('应该能够获取未处理的事件', async () => {
      // Arrange
      const processedEvent = TestDataFactory.createEvent({
        type: 'CollectionCreated',
        aggregateId: 'collection-123',
        aggregateType: 'Collection',
      });
      processedEvent.processedAt = new Date().getTime();

      const unprocessedEvent1 = TestDataFactory.createEvent({
        type: 'DocumentAdded',
        aggregateId: 'collection-123',
        aggregateType: 'Collection',
      });
      const unprocessedEvent2 = TestDataFactory.createEvent({
        type: 'ChunkAdded',
        aggregateId: 'collection-123',
        aggregateType: 'Collection',
      });

      await eventStore.saveEvent(processedEvent);
      await eventStore.saveEvent(unprocessedEvent1);
      await eventStore.saveEvent(unprocessedEvent2);

      // Act
      const unprocessedEvents = await eventStore.getUnprocessedEvents();

      // Assert
      expect(unprocessedEvents).toHaveLength(2);
      expect(unprocessedEvents.map((e) => e.type)).toEqual(
        expect.arrayContaining(['DocumentAdded', 'ChunkAdded']),
      );
    });

    it('应该能够标记事件为已处理', async () => {
      // Arrange
      const event = TestDataFactory.createEvent({
        type: 'CollectionCreated',
        aggregateId: 'collection-123',
        aggregateType: 'Collection',
      });
      await eventStore.saveEvent(event);

      // Act
      await eventStore.markEventAsProcessed(event.id as string);

      // Assert
      const eventRepository = dataSource.getRepository(Event);
      const updatedEvent = await eventRepository.findOne({
        where: { id: event.id },
      });

      expect(typeof updatedEvent.processedAt).toBe('number');
      expect(updatedEvent.processedAt).toBeGreaterThan(0);
    });
  });

  describe('Event Publishing', () => {
    it('应该能够发布单个事件', async () => {
      // Arrange
      const domainEvent: DomainEvent = {
        type: 'CollectionCreated',
        aggregateId: 'collection-123',
        aggregateType: 'Collection',
        data: {
          name: 'Test Collection',
          description: 'Test description',
        },
        version: 1,
        occurredAt: new Date().getTime(),
      };

      // Act
      await eventPublisher.publish(domainEvent);

      // Assert
      const eventRepository = dataSource.getRepository(Event);
      const publishedEvent = await eventRepository.findOne({
        where: { aggregateId: 'collection-123' },
      });

      expect(publishedEvent).toBeDefined();
      expect(publishedEvent.type).toBe('CollectionCreated');
      expect(publishedEvent.data.name).toBe('Test Collection');
    });

    it('应该能够批量发布事件', async () => {
      // Arrange
      const events: DomainEvent[] = [
        {
          type: 'CollectionCreated',
          aggregateId: 'collection-123',
          aggregateType: 'Collection',
          data: { name: 'Test Collection' },
          version: 1,
          occurredAt: new Date().getTime(),
        },
        {
          type: 'DocumentAdded',
          aggregateId: 'collection-123',
          aggregateType: 'Collection',
          data: { documentId: 'doc-123' },
          version: 2,
          occurredAt: new Date().getTime(),
        },
      ];

      // Act
      await eventPublisher.publishBatch(events);

      // Assert
      const eventRepository = dataSource.getRepository(Event);
      const publishedEvents = await eventRepository.find({
        where: { aggregateId: 'collection-123' },
        order: { version: 'ASC' },
      });

      expect(publishedEvents).toHaveLength(2);
      expect(publishedEvents[0].type).toBe('CollectionCreated');
      expect(publishedEvents[1].type).toBe('DocumentAdded');
    });

    it('应该在事务中发布事件', async () => {
      // Arrange
      const collectionRepository = dataSource.getRepository(Collection);
      const domainEvent: DomainEvent = {
        type: 'CollectionCreated',
        aggregateId: 'collection-123',
        aggregateType: 'Collection',
        data: {
          name: 'Test Collection',
          description: 'Test description',
        },
        version: 1,
        occurredAt: new Date().getTime(),
      };

      // Act
      await dataSource.transaction(async (manager) => {
        // 创建集合
        const collection = TestDataFactory.createCollection({
          name: 'Test Collection',
        });
        await manager.save(collection);

        // 发布事件
        await eventPublisher.publishInTransaction(domainEvent, manager);
      });

      // Assert
      const eventRepository = dataSource.getRepository(Event);
      const publishedEvent = await eventRepository.findOne({
        where: { aggregateId: 'collection-123' },
      });

      expect(publishedEvent).toBeDefined();
      expect(publishedEvent.type).toBe('CollectionCreated');

      const savedCollection = await collectionRepository.findOne({
        where: { name: 'Test Collection' },
      });

      expect(savedCollection).toBeDefined();
    });
  });

  describe('Event Processing', () => {
    it('应该能够处理未处理的事件', async () => {
      // Arrange
      const event1 = TestDataFactory.createEvent({
        type: 'CollectionCreated',
        aggregateId: 'collection-123',
        aggregateType: 'Collection',
        data: { name: 'Test Collection' },
      });
      const event2 = TestDataFactory.createEvent({
        type: 'DocumentAdded',
        aggregateId: 'collection-123',
        aggregateType: 'Collection',
        data: { documentId: 'doc-123' },
      });

      await eventStore.saveEvent(event1);
      await eventStore.saveEvent(event2);

      // Act
      const processedCount = await eventPublisher.processUnprocessedEvents();

      // Assert
      expect(processedCount).toBe(2);

      const eventRepository = dataSource.getRepository(Event);
      const processedEvents = await eventRepository.find({
        where: { processedAt: Not(IsNull()) },
      });

      expect(processedEvents).toHaveLength(2);
    });

    it('应该能够处理特定类型的事件', async () => {
      // Arrange
      const collectionEvent = TestDataFactory.createEvent({
        type: 'CollectionCreated',
        aggregateId: 'collection-123',
        aggregateType: 'Collection',
        data: { name: 'Test Collection' },
      });
      const documentEvent = TestDataFactory.createEvent({
        type: 'DocumentAdded',
        aggregateId: 'collection-123',
        aggregateType: 'Collection',
        data: { documentId: 'doc-123' },
      });

      await eventStore.saveEvent(collectionEvent);
      await eventStore.saveEvent(documentEvent);

      // Act
      const processedCount =
        await eventPublisher.processEventsByType('CollectionCreated');

      // Assert
      expect(processedCount).toBe(1);

      const eventRepository = dataSource.getRepository(Event);
      const processedEvents = await eventRepository.find({
        where: {
          type: 'CollectionCreated',
          processedAt: Not(IsNull()),
        },
      });

      expect(processedEvents).toHaveLength(1);
    });
  });

  describe('Event Versioning', () => {
    it('应该维护事件的版本号', async () => {
      // Arrange
      const aggregateId = 'collection-123';
      const events: DomainEvent[] = [
        {
          type: 'CollectionCreated',
          aggregateId,
          aggregateType: 'Collection',
          data: { name: 'Test Collection' },
          version: 1,
          occurredAt: new Date().getTime(),
        },
        {
          type: 'DocumentAdded',
          aggregateId,
          aggregateType: 'Collection',
          data: { documentId: 'doc-123' },
          version: 2,
          occurredAt: new Date().getTime(),
        },
        {
          type: 'ChunkAdded',
          aggregateId,
          aggregateType: 'Collection',
          data: { chunkId: 'chunk-123' },
          version: 3,
          occurredAt: new Date().getTime(),
        },
      ];

      // Act
      for (const event of events) {
        await eventStore.saveEvent(event);
      }

      // Assert
      const eventRepository = dataSource.getRepository(Event);
      const savedEvents = await eventRepository.find({
        where: { aggregateId },
        order: { version: 'ASC' },
      });

      expect(savedEvents).toHaveLength(3);
      expect(savedEvents[0].version).toBe(1);
      expect(savedEvents[1].version).toBe(2);
      expect(savedEvents[2].version).toBe(3);
    });

    it('应该拒绝重复版本号的事件', async () => {
      // Arrange
      const aggregateId = 'collection-123';
      const event1 = TestDataFactory.createEvent({
        type: 'CollectionCreated',
        aggregateId,
        aggregateType: 'Collection',
        version: 1,
      });
      const event2 = TestDataFactory.createEvent({
        type: 'DocumentAdded',
        aggregateId,
        aggregateType: 'Collection',
        version: 1, // 重复版本号
      });

      await eventStore.saveEvent(event1);

      // Act & Assert
      await expect(eventStore.saveEvent(event2)).rejects.toThrow();
    });
  });

  describe('Event Serialization', () => {
    it('应该正确序列化和反序列化事件数据', async () => {
      // Arrange
      const complexData = {
        name: 'Test Collection',
        description: 'Test description',
        metadata: {
          tags: ['tag1', 'tag2'],
          settings: {
            public: true,
            category: 'test',
          },
        },
        nested: {
          level1: {
            level2: {
              value: 'deep value',
            },
          },
        },
      };

      const domainEvent: DomainEvent = {
        type: 'CollectionCreated',
        aggregateId: 'collection-123',
        aggregateType: 'Collection',
        data: complexData,
        version: 1,
        occurredAt: new Date().getTime(),
      };

      // Act
      await eventStore.saveEvent(domainEvent);

      // Assert
      const eventRepository = dataSource.getRepository(Event);
      const savedEvent = await eventRepository.findOne({
        where: { aggregateId: 'collection-123' },
      });

      expect(savedEvent).toBeDefined();
      expect(savedEvent.data).toEqual(complexData);
      expect(savedEvent.data.metadata.tags).toEqual(['tag1', 'tag2']);
      expect(savedEvent.data.metadata.settings.public).toBe(true);
      expect(savedEvent.data.nested.level1.level2.value).toBe('deep value');
    });

    it('应该处理特殊字符和Unicode', async () => {
      // Arrange
      const specialData = {
        name: '测试集合 🚀',
        description: 'This is a test with émojis 🎉 and spëcial charactërs',
        unicode: 'Unicode test: 中文, 日本語, العربية, русский',
      };

      const domainEvent: DomainEvent = {
        type: 'CollectionCreated',
        aggregateId: 'collection-123',
        aggregateType: 'Collection',
        data: specialData,
        version: 1,
        occurredAt: new Date().getTime(),
      };

      // Act
      await eventStore.saveEvent(domainEvent);

      // Assert
      const eventRepository = dataSource.getRepository(Event);
      const savedEvent = await eventRepository.findOne({
        where: { aggregateId: 'collection-123' },
      });

      expect(savedEvent).toBeDefined();
      expect(savedEvent.data.name).toBe('测试集合 🚀');
      expect(savedEvent.data.description).toContain('émojis 🎉');
      expect(savedEvent.data.unicode).toContain('中文');
    });
  });

  describe('Event Performance', () => {
    it('应该能够高效处理大量事件', async () => {
      // Arrange
      const eventCount = 1000;
      const events: DomainEvent[] = [];

      for (let i = 0; i < eventCount; i++) {
        events.push(
          TestDataFactory.createEvent({
            type: 'TestEvent',
            aggregateId: `aggregate-${i}`,
            aggregateType: 'TestAggregate',
            data: { index: i },
          }),
        );
      }

      // Act
      const startTime = Date.now();
      await eventPublisher.publishBatch(events);
      const endTime = Date.now();

      // Assert
      const eventRepository = dataSource.getRepository(Event);
      const savedEvents = await eventRepository.find();
      expect(savedEvents).toHaveLength(eventCount);

      const processingTime = endTime - startTime;
      console.log(`Processed ${eventCount} events in ${processingTime}ms`);

      // 性能断言：处理1000个事件应该在合理时间内完成（例如5秒）
      expect(processingTime).toBeLessThan(5000);
    });

    it('应该能够高效查询事件', async () => {
      // Arrange
      const eventCount = 500;
      const targetAggregateId = 'target-aggregate';

      // 创建测试事件
      for (let i = 0; i < eventCount; i++) {
        const event = TestDataFactory.createEvent({
          type: 'TestEvent',
          aggregateId:
            i % 10 === 0 ? targetAggregateId : `other-aggregate-${i}`,
          aggregateType: 'TestAggregate',
          data: { index: i },
        });
        await eventStore.saveEvent(event);
      }

      // Act
      const startTime = Date.now();
      const targetEvents =
        await eventStore.getEventsByAggregateId(targetAggregateId);
      const endTime = Date.now();

      // Assert
      expect(targetEvents).toHaveLength(50); // 每10个事件中有1个是目标聚合

      const queryTime = endTime - startTime;
      console.log(`Queried events in ${queryTime}ms`);

      // 性能断言：查询应该在合理时间内完成（例如1秒）
      expect(queryTime).toBeLessThan(1000);
    });
  });
});
