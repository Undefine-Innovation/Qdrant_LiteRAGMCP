# 增强日志系统

这是一个功能完善的日志系统，支持日志分级、分模块TAG、traceID追踪和性能监控。

## 功能特性

### 1. 日志分级
- **DEBUG**: 详细调试信息，用于开发和故障排查
- **INFO**: 一般信息，记录系统正常运行状态
- **WARN**: 警告信息，表示潜在问题但不影响系统运行
- **ERROR**: 错误信息，表示系统异常或错误

### 2. 分模块TAG系统
支持以下模块TAG，便于按模块过滤和分析日志：
- `API`: API接口相关日志
- `DATABASE`: 数据库操作相关日志
- `QDRANT`: Qdrant向量数据库相关日志
- `EMBEDDING`: 嵌入生成相关日志
- `COLLECTION`: 集合管理相关日志
- `DOCUMENT`: 文档管理相关日志
- `SEARCH`: 搜索功能相关日志
- `IMPORT`: 导入功能相关日志
- `BATCH`: 批量操作相关日志
- `SCRAPE`: 爬虫功能相关日志
- `SYSTEM`: 系统级别日志
- `MONITORING`: 监控相关日志
- `GC`: 垃圾回收相关日志
- `SCHEDULER`: 定时任务相关日志
- `ERROR`: 错误处理相关日志
- `UTILS`: 工具函数相关日志

### 3. TraceID机制
- 为每个请求生成唯一的traceID
- 在整个请求链路中传递traceID
- 支持跨服务的请求追踪
- 便于问题定位和性能分析

### 4. 性能监控
- 自动记录请求处理时间
- 支持慢请求检测和告警
- 提供详细的性能指标

### 5. 结构化日志
- 统一的JSON格式日志输出
- 包含时间戳、级别、TAG、traceID等信息
- 支持日志轮转和压缩
- 支持控制台彩色输出

## 使用方法

### 基本使用

```typescript
import { EnhancedLogger, LogTag, createEnhancedLogger } from '@infrastructure/logging/enhanced-logger.js';

// 创建增强日志器
const logger = createEnhancedLogger(config);

// 记录不同级别的日志
logger.debug(LogTag.SYSTEM, '调试信息', { key: 'value' });
logger.info(LogTag.API, '信息日志', { endpoint: '/api/test' });
logger.warn(LogTag.DATABASE, '警告日志', { query: 'slow query' });
logger.error(LogTag.ERROR, '错误日志', { error: error.message });
```

### 使用上下文

```typescript
// 创建带有上下文的日志器
const contextLogger = logger.withContext({ 
  userId: 'user-123',
  requestId: 'req-456'
});

contextLogger.info(LogTag.API, '用户操作', { action: 'login' });
```

### 使用TAG

```typescript
// 创建带有TAG的日志器
const apiLogger = logger.withTag(LogTag.API);
const dbLogger = logger.withTag(LogTag.DATABASE);

apiLogger.info('API请求开始', { method: 'POST', url: '/api/users' });
dbLogger.info('数据库查询', { table: 'users', operation: 'SELECT' });
```

### 在Express中间件中使用

```typescript
import { loggingMiddleware, LoggedRequest } from '@middleware/logging.js';

// 应用日志中间件
app.use(loggingMiddleware(logger));

// 在路由中使用
router.get('/test', (req: LoggedRequest, res) => {
  req.logger?.info(LogTag.API, '处理请求', { 
    path: req.path,
    method: req.method 
  });
  res.json({ message: 'success' });
});
```

## 配置选项

### 环境变量配置

```bash
# 日志级别
LOG_LEVEL=info

# 启用traceID
LOG_ENABLE_TRACE_ID=true

# 启用模块TAG
LOG_ENABLE_MODULE_TAG=true

# 启用性能日志
LOG_ENABLE_PERFORMANCE=true

# 慢查询阈值（毫秒）
LOG_SLOW_QUERIES_THRESHOLD=1000

# 日志轮转配置
LOG_DIRNAME=logs
LOG_MAX_SIZE=20m
LOG_MAX_FILES=14d
LOG_DATE_PATTERN=YYYY-MM-DD
LOG_ZIP=true
```

### 配置对象

```typescript
const config: AppConfig = {
  log: {
    level: 'info',
    enableTraceId: true,
    enableModuleTag: true,
    enablePerformanceLogging: true,
    logSlowQueriesThreshold: 1000,
    dirname: 'logs',
    maxSize: '20m',
    maxFiles: '14d',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
  },
  // ... 其他配置
};
```

## 日志格式

### 控制台输出
```
2024-01-01T12:00:00.000Z INFO [API][trace-123] 处理请求 { method: "POST", url: "/api/users" }
```

### 文件输出（JSON格式）
```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "INFO",
  "tag": "API",
  "traceId": "trace-123",
  "message": "处理请求",
  "method": "POST",
  "url": "/api/users"
}
```

## 性能考虑

### 异步日志写入
- 使用Winston的异步传输机制
- 避免日志记录阻塞主线程
- 支持批量写入优化

### 日志轮转
- 按日期自动轮转日志文件
- 支持压缩归档，节省磁盘空间
- 可配置保留策略

### 内存优化
- 避免在日志中记录大对象
- 合理控制日志详细程度
- 使用对象池减少GC压力

## 最佳实践

### 1. 日志级别使用
- 生产环境使用INFO级别
- 开发环境可以使用DEBUG级别
- 错误日志必须包含足够的上下文信息

### 2. TAG使用规范
- 选择最相关的TAG
- 避免过度细分TAG
- 保持TAG的一致性

### 3. 上下文信息
- 包含关键业务标识（如用户ID、订单ID）
- 避免记录敏感信息
- 提供足够的上下文用于问题排查

### 4. 性能日志
- 记录关键操作的开始和结束时间
- 标记慢操作供后续优化
- 定期分析性能日志找出瓶颈

## 故障排查

### 1. 使用traceID追踪
通过traceID可以追踪一个完整的请求链路：
```bash
# 查找特定traceID的所有日志
grep "trace-123" logs/app-2024-01-01.log
```

### 2. 按模块过滤
```bash
# 查找API相关的所有错误
grep "ERROR.*API" logs/app-2024-01-01.log

# 查找数据库相关的慢查询
grep "DATABASE.*slow" logs/app-2024-01-01.log
```

### 3. 性能分析
```bash
# 查找慢请求
grep "slow.*true" logs/app-2024-01-01.log
```

## 测试

运行日志系统测试：
```bash
# 运行测试
node packages/backend/src/infrastructure/logging/logger-test.ts

# 或者在代码中调用
import { runAllLoggerTests } from '@infrastructure/logging/logger-test.js';
await runAllLoggerTests(config);
```

## 扩展

### 添加新的TAG
```typescript
// 在LogTag枚举中添加新TAG
export enum LogTag {
  // 现有TAG...
  NEW_MODULE = 'NEW_MODULE',
}
```

### 自定义日志格式
```typescript
// 创建自定义格式化器
const customFormat = printf(({ level, message, tag, traceId, timestamp, ...meta }) => {
  return `${timestamp} [${tag}] ${level}: ${message}`;
});
```

### 集成外部系统
可以轻松集成Sentry、Loggly等外部日志系统：
```typescript
// 添加Winston传输
const sentryTransport = new SentryTransport({
  dsn: process.env.SENTRY_DSN,
});
logger.add(sentryTransport);