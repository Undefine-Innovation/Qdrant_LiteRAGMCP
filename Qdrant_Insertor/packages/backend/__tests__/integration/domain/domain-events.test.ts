/**
 * 领域事件系统集成测试
 * 测试领域事件的发布、存储和处理
 */

import { DataSource } from 'typeorm';
import { Event } from '@infrastructure/database/entities/Event.js';
import { IDomainEvent } from '@domain/events/IDomainEventInterface.js';
import {
  IEventPublisher,
  IEventStore,
} from '@domain/events/IEventPublisher.js';
import { EventSystemFactory } from '@domain/events/EventSystemFactory.js';
import {
  initializeTestDatabase,
  resetTestDatabase,
  getTestLogger,
} from '../test-data-factory.js';

describe('Domain Events Integration Tests', () => {
  let dataSource: DataSource;
  let eventStore: IEventStore;
  let eventPublisher: IEventPublisher;

  beforeAll(async () => {
    dataSource = await initializeTestDatabase();

    // 初始化事件系统，传入dataSource以使用数据库存储
    const eventSystem = EventSystemFactory.createTestEventSystem(
      getTestLogger(),
      dataSource,
    );
    eventStore = eventSystem.eventStore;
    eventPublisher = eventSystem.eventPublisher;
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  describe('Event Storage', () => {
    it('应该能够存储领域事件', async () => {
      // Arrange
      const domainEvent = createTestEventWithData(
        'CollectionCreated',
        'collection-123',
        'test-event-1',
        {
          name: 'Test Collection',
          description: 'Test description',
        },
      );

      // Act
      await eventStore.saveEvent(domainEvent);

      // Assert
      const eventRepository = dataSource.getRepository(Event);
      const savedEvent = await eventRepository.findOne({
        where: { aggregateId: 'collection-123' },
      });

      expect(savedEvent).toBeDefined();
      expect(savedEvent!.eventType).toBe('CollectionCreated');
      expect(savedEvent!.aggregateId).toBe('collection-123');
      const eventData = savedEvent!.getEventDataObject() as Record<
        string,
        unknown
      >;
      expect((eventData as Record<string, unknown>).name).toBe(
        'Test Collection',
      );
      expect(savedEvent!.version).toBe(1);
      expect(typeof savedEvent!.occurredOn).toBe('number');
    });

    it('应该能够存储多个事件', async () => {
      // Arrange
      const events: IDomainEvent[] = [
        createTestEventWithData(
          'CollectionCreated',
          'collection-123',
          'test-event-1',
          { name: 'Test Collection' },
          1,
        ),
        createTestEventWithData(
          'DocumentAdded',
          'collection-123',
          'test-event-2',
          { documentId: 'doc-123' },
          2,
        ),
        createTestEventWithData(
          'ChunkAdded',
          'collection-123',
          'test-event-3',
          { chunkId: 'chunk-123' },
          3,
        ),
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
      expect(savedEvents[0].eventType).toBe('CollectionCreated');
      expect(savedEvents[1].eventType).toBe('DocumentAdded');
      expect(savedEvents[2].eventType).toBe('ChunkAdded');
    });

    it('应该能够按聚合根ID获取事件', async () => {
      // Arrange
      const event1 = createTestDomainEvent({
        eventType: 'CollectionCreated',
        aggregateId: 'collection-123',
        aggregateType: 'Collection',
      });
      const event2 = createTestDomainEvent({
        eventType: 'DocumentAdded',
        aggregateId: 'collection-456',
        aggregateType: 'Collection',
      });
      const event3 = createTestDomainEvent({
        eventType: 'ChunkAdded',
        aggregateId: 'collection-123',
        aggregateType: 'Collection',
      });

      await eventStore.saveEvent(event1);
      await eventStore.saveEvent(event2);
      await eventStore.saveEvent(event3);

      // Act
      const collection123Events =
        await eventStore.getEventsByAggregate('collection-123');

      // Assert
      expect(collection123Events).toHaveLength(2);
      expect(collection123Events.map((e: IDomainEvent) => e.eventType)).toEqual(
        expect.arrayContaining(['CollectionCreated', 'ChunkAdded']),
      );
    });

    it('应该能够按事件类型获取事件', async () => {
      // Arrange
      const event1 = createTestDomainEvent({
        eventType: 'CollectionCreated',
        aggregateId: 'collection-123',
        aggregateType: 'Collection',
      });
      const event2 = createTestDomainEvent({
        eventType: 'CollectionCreated',
        aggregateId: 'collection-456',
        aggregateType: 'Collection',
      });
      const event3 = createTestDomainEvent({
        eventType: 'DocumentAdded',
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
      expect(
        collectionCreatedEvents.map((e: IDomainEvent) => e.aggregateId),
      ).toEqual(expect.arrayContaining(['collection-123', 'collection-456']));
    });
  });

  describe('Event Publishing', () => {
    it('应该能够发布单个事件', async () => {
      // Arrange
      const domainEvent = createTestEventWithData(
        'CollectionCreated',
        'collection-123',
        'test-event-1',
        {
          name: 'Test Collection',
          description: 'Test description',
        },
      );

      // Act
      await eventPublisher.publish(domainEvent);

      // Assert
      const eventRepository = dataSource.getRepository(Event);
      const publishedEvent = await eventRepository.findOne({
        where: { aggregateId: 'collection-123' },
      });

      expect(publishedEvent).toBeDefined();
      expect(publishedEvent!.eventType).toBe('CollectionCreated');
      const eventData = publishedEvent!.getEventDataObject() as Record<
        string,
        unknown
      >;
      expect((eventData as { name: string }).name).toBe('Test Collection');
    });

    it('应该能够批量发布事件', async () => {
      // Arrange
      const events: IDomainEvent[] = [
        createTestEventWithData(
          'CollectionCreated',
          'collection-123',
          'test-event-1',
          { name: 'Test Collection' },
          1,
        ),
        createTestEventWithData(
          'DocumentAdded',
          'collection-123',
          'test-event-2',
          { documentId: 'doc-123' },
          2,
        ),
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
      expect(publishedEvents[0].eventType).toBe('CollectionCreated');
      expect(publishedEvents[1].eventType).toBe('DocumentAdded');
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

      const domainEvent = createTestEventWithData(
        'CollectionCreated',
        'collection-123',
        'test-event-1',
        complexData,
      );

      // Act
      await eventStore.saveEvent(domainEvent);

      // Assert
      const eventRepository = dataSource.getRepository(Event);
      const savedEvent = await eventRepository.findOne({
        where: { aggregateId: 'collection-123' },
      });

      expect(savedEvent).toBeDefined();
      const eventData = savedEvent!.getEventDataObject() as Record<
        string,
        unknown
      >;
      expect(eventData).toEqual(complexData);
      const metadata = (eventData as Record<string, unknown>)
        .metadata as Record<string, unknown>;
      expect((metadata as Record<string, unknown>).tags).toEqual([
        'tag1',
        'tag2',
      ]);
      const settings = (metadata as Record<string, unknown>).settings as Record<
        string,
        unknown
      >;
      expect(settings.public).toBe(true);
      const nested = (eventData as Record<string, unknown>).nested as Record<
        string,
        unknown
      >;
      const level1 = nested.level1 as Record<string, unknown>;
      const level2 = level1.level2 as Record<string, unknown>;
      expect(level2.value).toBe('deep value');
    });

    it('应该处理特殊字符和Unicode', async () => {
      // Arrange
      const specialData = {
        name: '测试集合 🚀',
        description: 'This is a test with émojis 🎉 and spëcial charactërs',
        unicode: 'Unicode test: 中文, 日本語, العربية, русский',
      };

      const domainEvent = createTestEventWithData(
        'CollectionCreated',
        'collection-123',
        'test-event-1',
        specialData,
      );

      // Act
      await eventStore.saveEvent(domainEvent);

      // Assert
      const eventRepository = dataSource.getRepository(Event);
      const savedEvent = await eventRepository.findOne({
        where: { aggregateId: 'collection-123' },
      });

      expect(savedEvent).toBeDefined();
      const eventData = savedEvent!.getEventDataObject() as Record<
        string,
        unknown
      >;
      expect(eventData.name).toBe('测试集合 🚀');
      expect(String(eventData.description)).toContain('émojis 🎉');
      expect(String(eventData.unicode)).toContain('中文');
    });
  });

  describe('Event Performance', () => {
    it('应该能够高效处理大量事件', async () => {
      // Arrange
      const eventCount = 100; // 减少事件数量以提高测试速度
      const events: IDomainEvent[] = [];

      for (let i = 0; i < eventCount; i++) {
        events.push(
          createTestDomainEvent({
            eventType: 'TestEvent',
            aggregateId: `aggregate-${i}`,
            aggregateType: 'TestAggregate',
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

      // 性能断言：处理100个事件应该在合理时间内完成（例如5秒）
      expect(processingTime).toBeLessThan(5000);
    });

    it('应该能够高效查询事件', async () => {
      // Arrange
      const eventCount = 50; // 减少事件数量以提高测试速度
      const targetAggregateId = 'target-aggregate';

      // 创建测试事件
      for (let i = 0; i < eventCount; i++) {
        const event = createTestDomainEvent({
          eventType: 'TestEvent',
          aggregateId:
            i % 10 === 0 ? targetAggregateId : `other-aggregate-${i}`,
          aggregateType: 'TestAggregate',
        });
        await eventStore.saveEvent(event);
      }

      // Act
      const startTime = Date.now();
      const targetEvents =
        await eventStore.getEventsByAggregate(targetAggregateId);
      const endTime = Date.now();

      // Assert
      expect(targetEvents).toHaveLength(5); // 每10个事件中有1个是目标聚合

      const queryTime = endTime - startTime;
      console.log(`Queried events in ${queryTime}ms`);

      // 性能断言：查询应该在合理时间内完成（例如1秒）
      expect(queryTime).toBeLessThan(1000);
    });
  });
});

/**
 * 创建测试领域事件的辅助函数
 */
function createTestDomainEvent(overrides: {
  eventType: string;
  aggregateId: string;
  aggregateType: string;
}): IDomainEvent {
  const eventId = `event-${Math.random().toString(36).substring(2, 15)}`;
  const occurredOn = new Date().getTime();
  const data = { test: 'data' };

  return {
    eventType: overrides.eventType,
    aggregateId: overrides.aggregateId,
    version: 1,
    eventId,
    occurredOn,
    serialize: () => JSON.stringify(data),
    getData: () => data,
  };
}

/**
 * 创建带自定义数据的测试事件
 */
function createTestEventWithData(
  eventType: string,
  aggregateId: string,
  eventId: string,
  data: Record<string, unknown>,
  version = 1,
): IDomainEvent {
  return {
    eventType,
    aggregateId,
    version,
    eventId,
    occurredOn: new Date().getTime(),
    serialize: () => JSON.stringify(data),
    getData: () => data,
  };
}
