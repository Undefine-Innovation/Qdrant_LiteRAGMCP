# 关键词检索系统

本文档介绍了新的关键词检索系统，该系统支持PostgreSQL全文搜索和SQLite FTS5，提供了统一的接口和兼容性方案。

## 概述

关键词检索系统包含以下组件：

1. **IKeywordRetriever接口** - 定义了统一的关键词检索接口
2. **PostgreSQLKeywordRetriever** - PostgreSQL全文搜索实现
3. **SQLiteKeywordRetriever** - SQLite FTS5实现
4. **KeywordRetrieverFactory** - 工厂类，根据数据库类型创建相应的检索器
5. **ChunkFullText实体** - PostgreSQL全文搜索专用实体
6. **ChunkFullTextRepository** - PostgreSQL全文搜索Repository

## 功能特性

### PostgreSQL全文搜索

- 原生tsvector支持
- 多语言全文搜索
- 相关性评分
- 模糊搜索支持
- 搜索高亮
- 索引优化

### SQLite FTS5兼容

- 完全兼容现有SQLite FTS5实现
- 保持原有API接口
- 自动回退机制

### 统一接口

- 跨数据库兼容
- 一致的API调用
- 自动数据库类型检测
- 错误处理和日志记录

## 使用方法

### 1. 创建关键词检索器

```typescript
import {
  KeywordRetrieverFactory,
  DatabaseType,
} from './KeywordRetrieverFactory.js';

// 自动检测数据库类型
const keywordRetriever = KeywordRetrieverFactory.createAuto(
  dataSource, // TypeORM数据源
  sqliteDb, // SQLite数据库实例
  logger,
);

// 或者明确指定数据库类型
const pgKeywordRetriever = KeywordRetrieverFactory.createPostgreSQL(
  dataSource,
  logger,
);
const sqliteKeywordRetriever = KeywordRetrieverFactory.createSQLite(
  sqliteDb,
  logger,
);
```

### 2. 执行关键词搜索

```typescript
import {
  IKeywordRetriever,
  KeywordSearchRequest,
} from '@domain/repositories/IKeywordRetriever.js';

const searchRequest: KeywordSearchRequest = {
  query: 'TypeScript编程',
  collectionId: 'collection_123',
  limit: 10,
  fuzzy: true,
  language: 'chinese',
};

const results = await keywordRetriever.search(searchRequest);
```

### 3. 在特定集合中搜索

```typescript
const results = await keywordRetriever.searchInCollection(
  'TypeScript编程',
  'collection_123',
  10,
);
```

### 4. 批量创建索引

```typescript
await keywordRetriever.createIndexBatch([
  {
    pointId: 'doc_123_0',
    content: 'TypeScript是一种编程语言',
    title: 'TypeScript介绍',
    docId: 'doc_123',
    collectionId: 'collection_123',
    chunkIndex: 0,
  },
]);
```

### 5. 索引维护

```typescript
// 重建索引
await keywordRetriever.rebuildIndex();

// 优化索引
await keywordRetriever.optimizeIndex();

// 获取统计信息
const stats = await keywordRetriever.getSearchStats();
console.log(`总文档数: ${stats.totalDocuments}`);
console.log(`总块数: ${stats.totalChunks}`);
```

## 集成到SearchService

SearchService已经更新为支持新的KeywordRetriever：

```typescript
const searchService = new SearchService(
  embeddingProvider,
  sqliteRepo,
  qdrantRepo,
  keywordRetriever, // 新增参数
  logger,
);
```

SearchService会自动使用KeywordRetriever进行关键词搜索，如果不可用则回退到原有的SQLite FTS5实现。

## 数据库迁移

### PostgreSQL

运行迁移脚本创建全文搜索表和索引：

```typescript
import { createFullTextSearch1641234567890 } from './migrations/create-fulltext-search.js';

// 在应用启动时运行迁移
await queryRunner.runMigrations([createFullTextSearch1641234567890]);
```

### SQLite

SQLite FTS5表通过现有的触发器自动维护，无需额外迁移。

## 配置选项

### PostgreSQL配置

```typescript
// 在TypeORM配置中启用全文搜索
{
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'user',
  password: 'password',
  database: 'dbname',
  entities: ['dist/**/*.entity.js'],
  synchronize: false,
  migrations: ['dist/**/*.migration.js'],
  // 全文搜索配置
  extra: {
    // 设置默认全文搜索配置
    defaultTextSearchConfig: 'english',
    // 启用中文搜索
    chineseTextSearchConfig: 'chinese'
  }
}
```

### SQLite配置

```typescript
// SQLite FTS5配置
{
  type: 'better-sqlite3',
  database: 'data.db',
  entities: ['dist/**/*.entity.js'],
  synchronize: false,
  // FTS5配置
  extra: {
    // 启用FTS5扩展
    enableFts5: true,
    // FTS5分词器
    fts5Tokenizer: 'porter'
  }
}
```

## 性能优化

### PostgreSQL优化

1. **索引优化**
   - 定期运行`optimizeIndex()`
   - 使用GIN索引提高搜索性能
   - 考虑分区大表

2. **查询优化**
   - 使用适当的语言配置
   - 限制结果集大小
   - 使用分页避免大结果集

3. **内存优化**
   - 调整shared_buffers
   - 优化work_mem
   - 使用连接池

### SQLite优化

1. **索引优化**
   - 定期运行`optimizeIndex()`
   - 使用FTS5触发器自动维护索引
   - 考虑WAL模式

2. **查询优化**
   - 使用MATCH语法
   - 避免LIKE查询
   - 使用适当的分词器

## 错误处理

所有关键词检索操作都包含完整的错误处理：

```typescript
try {
  const results = await keywordRetriever.search(request);
  // 处理结果
} catch (error) {
  // 错误已自动记录到日志
  // 可以根据错误类型进行特定处理
  if (error instanceof FullTextSearchError) {
    // 处理全文搜索特定错误
  }
}
```

## 日志记录

关键词检索系统使用结构化日志记录：

- **INFO**: 搜索操作开始和完成
- **DEBUG**: 详细的搜索参数和结果统计
- **WARN**: 回退操作和性能警告
- **ERROR**: 搜索失败和错误详情

## 向后兼容性

新系统完全向后兼容：

1. **API兼容**: 保持原有SearchService接口不变
2. **数据兼容**: 现有SQLite数据库无需迁移
3. **功能兼容**: 所有原有功能继续工作
4. **性能兼容**: 不影响现有查询性能

## 故障排除

### 常见问题

1. **PostgreSQL全文搜索不工作**
   - 检查是否启用了pg_trgm扩展
   - 确认tsvector索引已创建
   - 验证语言配置正确

2. **SQLite FTS5性能问题**
   - 检查FTS5表是否正确创建
   - 确认触发器正常工作
   - 考虑重建索引

3. **搜索结果不准确**
   - 检查分词器配置
   - 验证搜索查询语法
   - 考虑使用模糊搜索

### 调试工具

```typescript
// 检查全文搜索能力
const capabilities = KeywordRetrieverFactory.getFullTextSearchCapabilities(
  dataSource,
  sqliteDb,
);
console.log('支持的特性:', capabilities.features);
console.log('数据库类型:', capabilities.databaseType);

// 检查是否支持全文搜索
const isSupported = KeywordRetrieverFactory.isFullTextSearchSupported(
  dataSource,
  sqliteDb,
);
console.log('全文搜索支持:', isSupported);
```

## 未来扩展

1. **多语言支持**: 扩展更多语言的全文搜索配置
2. **语义搜索集成**: 与向量搜索更紧密集成
3. **搜索分析**: 添加搜索分析和统计功能
4. **缓存优化**: 实现搜索结果缓存
5. **分布式搜索**: 支持多节点搜索集群
