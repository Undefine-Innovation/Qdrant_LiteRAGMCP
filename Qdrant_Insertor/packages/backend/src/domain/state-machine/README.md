# 状态机框架

## 概述

本状态机框架是基于策略模式设计的通用状态管理框架，支持灵活的状态转换规则定义和持久化存储。框架遵循项目的分层架构原则，提供了可扩展的基础设施。

## 核心组件

### 1. 基础类型定义 (`types.ts`)

定义了状态机的核心接口和类型：

- `BaseState`: 基础状态枚举
- `BaseEvent`: 基础事件枚举
- `StateMachineTask`: 状态机任务接口
- `StateMachineContext`: 状态机上下文接口
- `StateTransition`: 状态转换规则接口
- `StateMachineConfig`: 状态机配置接口
- `StatePersistence`: 状态持久化接口
- `StateMachineStrategy`: 状态机策略接口
- `IStateMachineEngine`: 状态机引擎接口

### 2. 状态持久化 (`StatePersistence.ts`)

提供了两种持久化实现：

- `InMemoryStatePersistence`: 内存实现，适用于开发和测试
- `SQLiteStatePersistence`: SQLite实现，适用于生产环境

### 3. 基础策略类 (`BaseStateMachineStrategy.ts`)

提供了状态机策略的基础实现：

- 状态转换规则管理
- 任务生命周期管理
- 错误处理和重试机制
- 进度跟踪

### 4. 状态机引擎 (`BaseStateMachineEngine.ts`)

提供了状态机的核心功能：

- 策略注册和管理
- 任务创建和执行
- 状态转换控制
- 批量操作支持

### 5. 批量上传策略 (`BatchUploadStrategy.ts`)

实现了批量上传任务的具体策略：

- 文件验证、处理、上传、索引流程
- 详细的进度跟踪
- 错误处理和结果统计

## 使用示例

### 1. 创建状态机服务

```typescript
import { StateMachineService } from '@application/services/StateMachineService.js';
import { Logger } from '@logging/logger.js';

const logger = new Logger();
const stateMachineService = new StateMachineService(logger);
```

### 2. 创建批量上传任务

```typescript
const task = await stateMachineService.createBatchUploadTask(
  'batch-123',
  [
    {
      id: 'file-1',
      name: 'document.pdf',
      size: 1024000,
      type: 'application/pdf',
    },
    {
      id: 'file-2',
      name: 'report.docx',
      size: 512000,
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
  ],
  'collection-456',
  {
    skipDuplicates: true,
    generateThumbnails: true,
  }
);
```

### 3. 执行任务

```typescript
await stateMachineService.executeBatchUploadTask('batch-123');
```

### 4. 查询任务状态

```typescript
const taskStatus = await stateMachineService.getTaskStatus('batch-123');
console.log(`任务状态: ${taskStatus?.status}, 进度: ${taskStatus?.progress}%`);
```

### 5. 获取任务列表

```typescript
const batchTasks = await stateMachineService.getBatchUploadTasks();
const failedTasks = await stateMachineService.getTasksByStatus('FAILED');
```

## 扩展新策略

### 1. 定义状态和事件

```typescript
export enum MyTaskState {
  NEW = 'NEW',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum MyTaskEvent {
  START = 'start',
  PROCESS = 'process',
  COMPLETE = 'complete',
  FAIL = 'fail',
}
```

### 2. 实现策略类

```typescript
import { BaseStateMachineStrategy } from '@domain/state-machine/BaseStateMachineStrategy.js';

export class MyTaskStrategy extends BaseStateMachineStrategy {
  constructor(persistence: StatePersistence, logger: Logger) {
    const config: StateMachineConfig = {
      taskType: 'my_task',
      initialState: MyTaskState.NEW,
      finalStates: [MyTaskState.COMPLETED, MyTaskState.FAILED],
      transitions: [
        {
          from: MyTaskState.NEW,
          to: MyTaskState.PROCESSING,
          event: MyTaskEvent.START,
        },
        {
          from: MyTaskState.PROCESSING,
          to: MyTaskState.COMPLETED,
          event: MyTaskEvent.COMPLETE,
        },
        // ... 更多转换规则
      ],
    };

    super('my_task', config, persistence, logger);
  }

  async executeTask(taskId: string): Promise<void> {
    // 实现具体的任务执行逻辑
  }
}
```

### 3. 注册策略

```typescript
const myStrategy = new MyTaskStrategy(persistence, logger);
stateMachineService.getEngine().registerStrategy(myStrategy);
```

## 架构优势

### 1. 策略模式
- 不同类型的任务可以有不同的状态转换逻辑
- 易于扩展新的任务类型
- 策略之间相互独立

### 2. 分层架构
- 领域层定义接口和核心逻辑
- 基础设施层提供具体实现
- 应用层提供统一的服务接口

### 3. 持久化抽象
- 支持多种存储后端
- 易于测试和开发
- 生产环境可使用SQLite持久化

### 4. 错误处理
- 统一的错误处理机制
- 自动重试功能
- 详细的错误日志

## 性能考虑

### 1. 批量操作
- 支持批量创建和执行任务
- 可配置并发数量
- 减少数据库访问次数

### 2. 内存管理
- 定期清理过期任务
- 避免内存泄漏
- 合理的数据结构设计

### 3. 异步处理
- 所有操作都是异步的
- 不阻塞主线程
- 支持并发执行

## 监控和调试

### 1. 日志记录
- 详细的状态转换日志
- 错误信息和堆栈跟踪
- 性能指标记录

### 2. 统计信息
- 任务状态分布
- 成功率和失败率
- 执行时间统计

### 3. 健康检查
- 任务队列状态
- 系统资源使用
- 错误率监控

## 最佳实践

1. **状态设计**: 保持状态简单明确，避免状态过多
2. **转换规则**: 确保转换规则完整且无冲突
3. **错误处理**: 实现完善的错误处理和重试机制
4. **日志记录**: 记录关键操作和错误信息
5. **测试覆盖**: 为每个策略编写单元测试
6. **性能优化**: 合理使用批量操作和并发控制
7. **资源清理**: 定期清理过期任务和临时数据

## 注意事项

1. **事务一致性**: 确保状态转换和业务操作的事务一致性
2. **并发安全**: 在高并发环境下注意线程安全
3. **数据备份**: 定期备份重要的状态数据
4. **版本兼容**: 考虑状态数据的版本兼容性
5. **监控告警**: 设置合适的监控和告警机制