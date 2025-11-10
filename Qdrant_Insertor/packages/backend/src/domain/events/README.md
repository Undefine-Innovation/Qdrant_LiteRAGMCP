# 领域事件系统

本目录包含完整的领域事件系统实现，遵循DDD（领域驱动设计）模式，提供事件驱动架构支持。

## 核心组件

### 1. 基础接口和类型

- `IDomainEvent`: 领域事件接口
- `IEventPublisher`: 事件发布器接口
- `IEventBus`: 事件总线接口
- `IEventHandler`: 事件处理器接口
- `IEventStore`: 事件存储接口

### 2. 事件实现

- `DomainEvents.ts`: 包含所有具体的领域事件类
- `CollectionCreatedEvent`, `DocumentCreatedEvent`, `ChunkCreatedEvent` 等

### 3. 事件处理器

- `EventHandlerBase`: 事件处理器基类
- `SyncEventHandler`: 同步事件处理器
- `AsyncEventHandler`: 异步事件处理器
- `BatchEventHandler`: 批量事件处理器

### 4. 事件存储

- `InMemoryEventStore`: 内存事件存储（开发/测试用）
- `DatabaseEventStore`: 数据库事件存储（生产用）

### 5. 事件发布和总线

- `EventPublisher`: 事件发布器实现
- `EventBus`: 事件总线实现
- `TransactionalEventPublisher`: 事务感知事件发布器

### 6. 系统管理

- `EventSystemFactory`: 事件系统工厂
- `EventSystemManager`: 事件系统管理器
- `EventSystemService`: 事件系统服务

## 使用示例

### 1. 创建和初始化事件系统

```typescript
import { EventSystemServiceFactory } from '@domain/services/EventSystemService.js';
import { Logger } from '@infrastructure/logging/logger.js';

// 创建生产环境事件系统
const eventSystemService = EventSystemServiceFactory.createProductionService(
  logger,
  dataSource,
  transactionManager,
);

// 初始化事件系统
await eventSystemService.initialize();
```

### 2. 在聚合根中使用事件

```typescript
import { AggregateRoot } from '@domain/aggregates/AggregateRoot.js';
import { DocumentCreatedEvent } from '@domain/events/DomainEvents.js';

class DocumentAggregate extends AggregateRoot {
  public static create(
    id: DocId,
    collectionId: CollectionId,
    key: string,
    content: string,
  ): DocumentAggregate {
    const document = Doc.create(id, collectionId, key, content);
    const aggregate = new DocumentAggregate(document);

    // 添加领域事件
    aggregate.addDomainEvent(
      new DocumentCreatedEvent(id, collectionId, key, content.length),
    );

    return aggregate;
  }

  getId(): string {
    return this._document.id;
  }

  getAggregateType(): string {
    return 'Document';
  }
}
```

### 3. 注册聚合根到事件系统

```typescript
const documentAggregate = DocumentAggregate.create(/* ... */);
eventSystemService.registerAggregate(documentAggregate);
```

### 4. 发布事件

```typescript
// 自动发布聚合根中的所有事件
await eventSystemService.publishAllDomainEvents();

// 或者手动发布特定事件
await eventSystemService.getEventPublisher().publish(event);
```

### 5. 创建事件处理器

```typescript
import { AsyncEventHandler } from '@domain/events/EventHandlerBase.js';
import { DocumentCreatedEvent } from '@domain/events/DomainEvents.js';

class DocumentNotificationHandler extends AsyncEventHandler<DocumentCreatedEvent> {
  constructor(logger: Logger) {
    super(logger);
  }

  getName(): string {
    return 'DocumentNotificationHandler';
  }

  getEventType(): string {
    return 'DocumentCreated';
  }

  protected async handleInternal(event: DocumentCreatedEvent): Promise<void> {
    // 发送通知
    await this.sendNotification({
      type: 'document_created',
      docId: event.aggregateId,
      collectionId: event.collectionId,
      docKey: event.docKey,
    });
  }

  private async sendNotification(data: any): Promise<void> {
    // 实现通知逻辑
  }
}
```

### 6. 注册事件处理器

```typescript
const handler = new DocumentNotificationHandler(logger);
eventSystemService.registerEventHandler('DocumentCreated', handler);
```

## 事件流程

1. **事件创建**: 在聚合根的业务方法中创建领域事件
2. **事件收集**: 事件存储在聚合根的内部列表中
3. **事件发布**: 通过事件发布器发布事件到事件总线
4. **事件分发**: 事件总线将事件分发给注册的处理器
5. **事件处理**: 事件处理器处理事件，执行业务逻辑
6. **事件存储**: 事件被持久化到事件存储中

## 事务支持

事件系统支持事务感知的事件发布：

```typescript
// 在事务中，事件会在事务提交后发布
await transactionManager.executeInTransaction(async (context) => {
  // 执行业务操作
  const aggregate = DocumentAggregate.create(/* ... */);

  // 事件会被收集，但不会立即发布
  eventSystemService.registerAggregate(aggregate);

  // 事务提交后，事件会自动发布
});
```

## 配置选项

```typescript
const config = {
  enableEventStore: true,
  enableTransactionalPublishing: true,
  enableAuditLogging: true,
  enableEventStatistics: true,
  eventStoreType: 'database',
  batchConfig: {
    enabled: true,
    size: 100,
    timeout: 5000,
  },
  retryConfig: {
    maxRetries: 3,
    retryInterval: 1000,
    backoffFactor: 2,
    maxRetryInterval: 30000,
    enableDeadLetterQueue: true,
  },
};
```

## 最佳实践

1. **事件命名**: 使用过去时态描述发生的事情，如 `DocumentCreated` 而不是 `CreateDocument`
2. **事件不可变**: 事件创建后不应该被修改
3. **事件包含足够信息**: 事件应该包含处理所需的所有信息
4. **异步处理**: 事件处理器应该是异步的，避免阻塞主流程
5. **错误处理**: 事件处理器应该有适当的错误处理和重试机制
6. **幂等性**: 事件处理器应该是幂等的，能够安全地重试

## 监控和调试

```typescript
// 获取系统状态
const status = eventSystemService.getSystemStatus();
console.log('Event System Status:', status);

// 获取事件统计
const statistics = await eventSystemService.getEventStatistics();
console.log('Event Statistics:', statistics);

// 获取事件总线统计
const busStats = eventSystemService.getEventBus().getStatistics();
console.log('Event Bus Statistics:', busStats);
```

## 扩展点

1. **自定义事件存储**: 实现 `IEventStore` 接口
2. **自定义事件发布器**: 实现 `IEventPublisher` 接口
3. **自定义事件处理器**: 继承 `EventHandlerBase` 类
4. **自定义事件总线**: 实现 `IEventBus` 接口

## 注意事项

1. **性能考虑**: 大量事件可能影响性能，考虑使用批处理
2. **存储空间**: 事件存储会占用空间，定期清理旧事件
3. **事务边界**: 确保事件发布在正确的事务边界内
4. **错误恢复**: 实现适当的错误恢复和重试机制
