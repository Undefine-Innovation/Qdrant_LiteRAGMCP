# TypeORM 集成测试

本目录包含了针对 TypeORM 迁移后系统的全面集成测试，验证数据库连接、实体操作、事务管理、API 端点等核心功能。

## 测试结构

```
tests/integration/
├── setup.ts                    # 测试环境设置和数据库初始化
├── index.ts                     # 测试主入口和配置
├── utils/                       # 测试工具和辅助函数
│   ├── test-data-factory.ts     # 测试数据生成器
│   └── test-assertions.ts      # 测试断言工具
├── entities/                    # 实体CRUD测试
│   ├── collection.test.ts        # 集合实体测试
│   ├── document.test.ts         # 文档实体测试
│   └── chunk.test.ts           # 块实体测试
├── aggregates/                  # 聚合根测试
│   └── collection-aggregate.test.ts # 集合聚合根测试
├── events/                      # 领域事件系统测试
│   └── domain-events.test.ts     # 领域事件测试
├── transactions/                 # 事务管理测试
│   └── transaction-management.test.ts # 事务管理测试
├── api/                         # API端点集成测试
│   └── collections-api.test.ts   # 集合API测试
├── search/                      # 搜索功能测试
│   └── search-functionality.test.ts # 搜索功能测试
├── batch/                       # 批量操作测试
│   └── batch-operations.test.ts  # 批量操作测试
├── monitoring/                   # 监控和健康检查测试
│   └── health-check.test.ts      # 健康检查测试
├── error-handling/               # 错误处理测试
│   └── error-scenarios.test.ts   # 错误场景测试
└── performance/                  # 性能基准测试
    └── performance-benchmarks.test.ts # 性能基准测试
```

## 运行测试

### 前置条件

1. 确保已安装所有依赖：

```bash
cd packages/backend
npm install
```

2. 确保数据库配置正确：

```bash
cp .env.example .env
# 编辑 .env 文件，配置数据库连接信息
```

### 运行所有集成测试

```bash
# 运行所有集成测试
npm run test:integration

# 或者使用 Jest 直接运行
node --experimental-vm-modules ./node_modules/jest/bin/jest.js tests/integration
```

### 运行特定测试套件

```bash
# 运行实体测试
npm run test:integration -- entities

# 运行事务管理测试
npm run test:integration -- transactions

# 运行API测试
npm run test:integration -- api

# 运行性能测试
npm run test:integration -- performance
```

### 运行单个测试文件

```bash
# 运行集合实体测试
node --experimental-vm-modules ./node_modules/jest/bin/jest.js tests/integration/entities/collection.test.ts

# 运行事务管理测试
node --experimental-vm-modules ./node_modules/jest/bin/jest.js tests/integration/transactions/transaction-management.test.ts
```

## 测试覆盖范围

### 1. 数据库连接和初始化

- ✅ 数据库连接测试
- ✅ 数据库初始化验证
- ✅ 表结构同步验证
- ✅ 连接池管理测试

### 2. TypeORM 实体 CRUD 操作

- ✅ 集合 (Collection) 实体测试
- ✅ 文档 (Doc) 实体测试
- ✅ 块 (Chunk) 实体测试
- ✅ 实体关系映射测试
- ✅ 实体约束验证测试
- ✅ 时间戳行为测试

### 3. 聚合根功能

- ✅ 集合聚合根业务规则测试
- ✅ 文档管理功能测试
- ✅ 块管理功能测试
- ✅ 领域事件发布测试
- ✅ 聚合根状态管理测试

### 4. 领域事件系统

- ✅ 事件存储和检索测试
- ✅ 事件发布机制测试
- ✅ 事件处理测试
- ✅ 事件版本控制测试
- ✅ 事件序列化测试
- ✅ 事件性能测试

### 5. 事务管理

- ✅ 基本事务操作测试
- ✅ 嵌套事务测试
- ✅ 保存点管理测试
- ✅ 事务回滚测试
- ✅ 复杂事务场景测试
- ✅ 事务清理测试

### 6. API 端点完整性

- ✅ 集合 API 测试 (POST, GET, PUT, PATCH, DELETE)
- ✅ 请求验证测试
- ✅ 响应格式测试
- ✅ 错误处理测试
- ✅ 安全性测试

### 7. 搜索功能

- ✅ 关键词搜索测试
- ✅ 语义搜索测试
- ✅ 混合搜索测试
- ✅ 搜索性能测试
- ✅ 搜索结果排序测试
- ✅ 搜索缓存测试

### 8. 批量操作

- ✅ 批量文档上传测试
- ✅ 批量删除测试
- ✅ 批量集合操作测试
- ✅ 批量块操作测试
- ✅ 批量同步操作测试
- ✅ 批量操作性能测试

### 9. 监控和健康检查

- ✅ 系统健康状态检查测试
- ✅ 指标收集测试
- ✅ 告警规则测试
- ✅ 告警处理测试
- ✅ 监控仪表板测试
- ✅ 性能监控测试

### 10. 错误处理机制

- ✅ 数据库连接错误处理
- ✅ 事务错误处理
- ✅ 数据验证错误处理
- ✅ 同步作业错误处理
- ✅ API 错误处理
- ✅ 错误恢复机制测试

### 11. 性能基准

- ✅ 数据库操作性能测试
- ✅ 搜索性能基准测试
- ✅ 批量操作性能测试
- ✅ 事务性能测试
- ✅ 内存和资源使用测试
- ✅ 性能回归检测

## 测试配置

### 环境变量

测试使用以下环境变量：

```bash
NODE_ENV=test                    # 测试环境标识
JEST_WORKER_ID=1               # Jest 工作进程ID
DATABASE_URL=:memory:            # 内存数据库
LOG_LEVEL=error                 # 日志级别
```

### Jest 配置

测试使用专门的 Jest 配置：

```javascript
{
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/integration/setup.ts'],
  testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
  collectCoverageFrom: [
    '<rootDir>/src/**/*.ts'
  ],
  coverageDirectory: '<rootDir>/coverage/integration',
  coverageReporters: ['text', 'lcov', 'html'],
  maxWorkers: 1, // 集成测试使用单线程
  testTimeout: 30000, // 30秒超时
}
```

## 测试数据管理

### 数据工厂

使用 `TestDataFactory` 类生成测试数据：

```typescript
// 创建测试集合
const collection = TestDataFactory.createCollection({
  name: 'Test Collection',
  description: 'Test description',
});

// 创建完整数据集
const dataSet = TestDataFactory.createCompleteDataSet({
  collectionCount: 2,
  docsPerCollection: 3,
  chunksPerDoc: 5,
});
```

### 数据库清理

每个测试前都会自动清理数据库：

```typescript
beforeEach(async () => {
  await resetTestDatabase();
});
```

## 性能基准

### 基准指标

测试会收集以下性能指标：

- 数据库操作时间（创建、读取、更新、删除）
- 搜索响应时间
- 批量操作吞吐量
- 内存使用情况
- 事务处理时间

### 性能阈值

```typescript
const PERFORMANCE_THRESHOLDS = {
  collectionCreation: 10, // ms per collection
  documentCreation: 5, // ms per document
  chunkCreation: 2, // ms per chunk
  searchTime: 100, // ms per search
  transactionTime: 5, // ms per transaction
};
```

## 故障排除

### 常见问题

1. **测试数据库连接失败**
   - 检查环境变量配置
   - 确保测试数据库权限正确

2. **测试超时**
   - 增加测试超时时间
   - 检查数据库性能

3. **内存不足**
   - 减少测试数据量
   - 启用垃圾回收

4. **端口冲突**
   - 检查测试端口占用
   - 使用不同端口

### 调试技巧

1. **启用详细日志**

   ```bash
   LOG_LEVEL=debug npm run test:integration
   ```

2. **运行单个测试**

   ```bash
   npm run test:integration -- --testNamePattern="Collection Creation"
   ```

3. **保留测试数据**
   ```bash
   PRESERVE_TEST_DATA=true npm run test:integration
   ```

## 持续集成

### CI/CD 集成

```yaml
# .github/workflows/integration-tests.yml
name: Integration Tests
on: [push, pull_request]
jobs:
  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:integration
      - uses: actions/upload-artifact@v2
        with:
          name: integration-test-results
          path: coverage/integration/
```

### 测试报告

测试完成后会生成以下报告：

1. **覆盖率报告**：`coverage/integration/`
2. **性能基准报告**：`reports/performance-benchmarks.json`
3. **测试结果报告**：`reports/integration-test-results.json`

## 贡献指南

### 添加新测试

1. 在相应的测试文件中添加测试用例
2. 使用 `TestDataFactory` 生成测试数据
3. 使用 `TestAssertions` 进行断言
4. 确保测试具有适当的描述和断言

### 测试命名约定

```typescript
describe('Feature Being Tested', () => {
  describe('Specific Scenario', () => {
    it('should do something specific', async () => {
      // 测试实现
    });
  });
});
```

### 断言约定

```typescript
// 使用 TestAssertions 进行断言
await TestAssertions.assertCollectionExists(dataSource, collectionId);
await TestAssertions.assertRecordCount(dataSource, Collection, expectedCount);
```

## 相关文档

- [TypeORM 迁移完成报告](../../docs/report/typeorm-migration-completion-report.md)
- [API 文档](../../docs/apis/)
- [开发指南](../../README.md)

## 支持

如果在运行测试时遇到问题，请：

1. 检查现有的 GitHub Issues
2. 创建新的 Issue 并提供详细的错误信息
3. 包含测试环境信息和复现步骤
