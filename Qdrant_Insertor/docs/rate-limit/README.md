# 请求限流系统

本文档描述了Qdrant_MCP_RAG项目中实现的请求限流系统，该系统用于保护API服务免受过量请求的影响，确保系统稳定性。

## 功能特性

### 核心功能
- **令牌桶算法**: 基于令牌桶算法实现限流，支持突发请求和平滑限流
- **多级限流策略**: 支持全局、IP、用户、路径等多维度限流
- **内存存储**: 无外部依赖，高性能内存存储
- **自动清理**: 自动清理过期的限流状态，防止内存泄漏
- **白名单机制**: 支持IP白名单，绕过限流检查
- **实时监控**: 提供详细的限流统计和监控指标

### 限流策略
1. **全局限流**: 对所有请求的全局限制
2. **IP限流**: 基于客户端IP的限制
3. **用户限流**: 基于用户ID的限制（需要认证）
4. **路径限流**: 基于请求路径的限制
5. **搜索API限流**: 对搜索接口的特殊限制
6. **上传API限流**: 对上传接口的特殊限制

### 监控功能
- **实时统计**: 请求总数、允许数、拒绝数、允许率
- **热门键分析**: 识别最活跃的请求源
- **趋势分析**: 按时间维度的限流趋势
- **详细日志**: 完整的限流事件日志

## 配置说明

### 环境变量配置

```bash
# 启用限流功能
RATE_LIMIT_ENABLED=true

# 全局限流
RATE_LIMIT_GLOBAL_MAX_TOKENS=1000      # 最大令牌数
RATE_LIMIT_GLOBAL_REFILL_RATE=100      # 每秒补充令牌数
RATE_LIMIT_GLOBAL_ENABLED=true          # 是否启用

# IP限流
RATE_LIMIT_IP_MAX_TOKENS=100          # 每个IP的最大令牌数
RATE_LIMIT_IP_REFILL_RATE=10           # 每个IP每秒补充令牌数
RATE_LIMIT_IP_ENABLED=true              # 是否启用IP限流
RATE_LIMIT_IP_WHITELIST=127.0.0.1,::1  # IP白名单

# 用户限流
RATE_LIMIT_USER_MAX_TOKENS=200         # 每个用户的最大令牌数
RATE_LIMIT_USER_REFILL_RATE=20          # 每个用户每秒补充令牌数
RATE_LIMIT_USER_ENABLED=true             # 是否启用用户限流

# 路径限流
RATE_LIMIT_PATH_MAX_TOKENS=50          # 每个路径的最大令牌数
RATE_LIMIT_PATH_REFILL_RATE=5           # 每个路径每秒补充令牌数
RATE_LIMIT_PATH_ENABLED=true             # 是否启用路径限流

# 搜索API限流
RATE_LIMIT_SEARCH_MAX_TOKENS=30        # 搜索API的最大令牌数
RATE_LIMIT_SEARCH_REFILL_RATE=3         # 搜索API每秒补充令牌数
RATE_LIMIT_SEARCH_ENABLED=true           # 是否启用搜索限流

# 上传API限流
RATE_LIMIT_UPLOAD_MAX_TOKENS=10        # 上传API的最大令牌数
RATE_LIMIT_UPLOAD_REFILL_RATE=1         # 上传API每秒补充令牌数
RATE_LIMIT_UPLOAD_ENABLED=true           # 是否启用上传限流

# 指标收集配置
RATE_LIMIT_METRICS_ENABLED=true                    # 是否启用指标收集
RATE_LIMIT_METRICS_RETENTION=86400000             # 数据保留时间（毫秒）
RATE_LIMIT_METRICS_CLEANUP_INTERVAL=3600000          # 清理间隔（毫秒）

# 中间件配置
RATE_LIMIT_INCLUDE_HEADERS=true               # 是否在响应头中包含限流信息
RATE_LIMIT_LOG_EVENTS=true                    # 是否记录限流事件
RATE_LIMIT_LOG_ONLY_BLOCKED=true             # 是否只记录被限流的请求
RATE_LIMIT_ERROR_MESSAGE=请求过于频繁，请稍后再试  # 自定义错误消息
```

### 代码配置

```typescript
import { RateLimitStrategy, RateLimiterFactory } from '@domain/services/RateLimitStrategy.js';
import { createSimpleRateLimitMiddleware } from '@middlewares/rateLimit.js';

// 创建限流策略
const limiterFactory = new RateLimiterFactory(logger);
const rateLimitStrategy = new RateLimitStrategy(limiterFactory, logger);

// 添加自定义配置
rateLimitStrategy.addConfig({
  type: 'custom-api',
  maxTokens: 100,
  refillRate: 10,
  enabled: true,
  priority: 5,
  keyGenerator: (req) => `custom:${req.method}:${req.path}`,
  skipCondition: (req) => req.path.startsWith('/admin'),
  whitelist: ['127.0.0.1', '::1'],
});

// 应用中间件
app.use('/api', createSimpleRateLimitMiddleware(rateLimitStrategy));
```

## API接口

### 限流状态查询

#### 获取限流状态概览
```http
GET /api/rate-limit/status
```

响应示例：
```json
{
  "success": true,
  "data": {
    "configs": [
      {
        "type": "global",
        "maxTokens": 1000,
        "refillRate": 100,
        "enabled": true,
        "priority": 1
      }
    ],
    "overview": {
      "totalEvents": 1500,
      "limiterTypes": ["global", "ip", "user", "path", "search", "upload"],
      "oldestEvent": "2024-01-01T00:00:00.000Z",
      "newestEvent": "2024-01-01T12:00:00.000Z"
    }
  }
}
```

#### 获取限流统计数据
```http
GET /api/rate-limit/statistics?limiterType=ip&timeRange=3600000
```

响应示例：
```json
{
  "success": true,
  "data": {
    "limiterType": "ip",
    "totalRequests": 500,
    "allowedRequests": 450,
    "rejectedRequests": 50,
    "allowRate": 0.9,
    "averageRemaining": 45.2,
    "minRemaining": 0,
    "maxRemaining": 99,
    "timeRange": 3600000,
    "startTime": "2024-01-01T11:00:00.000Z",
    "endTime": "2024-01-01T12:00:00.000Z"
  }
}
```

#### 获取热门限流键
```http
GET /api/rate-limit/hot-keys?limiterType=ip&timeRange=3600000&limit=10
```

响应示例：
```json
{
  "success": true,
  "data": [
    {
      "key": "192.168.1.100",
      "count": 150,
      "blockedCount": 15
    },
    {
      "key": "192.168.1.101",
      "count": 120,
      "blockedCount": 8
    }
  ]
}
```

#### 获取限流趋势数据
```http
GET /api/rate-limit/trend?limiterType=global&timeRange=86400000&bucketSize=3600000
```

响应示例：
```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2024-01-01T00:00:00.000Z",
      "total": 1000,
      "allowed": 950,
      "blocked": 50,
      "blockRate": 0.05
    },
    {
      "timestamp": "2024-01-01T01:00:00.000Z",
      "total": 1100,
      "allowed": 1050,
      "blocked": 50,
      "blockRate": 0.045
    }
  ]
}
```

### 配置管理

#### 获取限流配置
```http
GET /api/rate-limit/config?type=global
```

#### 更新限流配置
```http
PUT /api/rate-limit/config
Content-Type: application/json

{
  "type": "global",
  "maxTokens": 2000,
  "refillRate": 200,
  "enabled": true
}
```

#### 重置限流器
```http
POST /api/rate-limit/reset
Content-Type: application/json

{
  "limiterType": "ip",
  "key": "192.168.1.100"
}
```

#### 清理限流数据
```http
POST /api/rate-limit/clear
```

## 响应头

当请求被限流时，API会在响应头中包含以下信息：

- `X-RateLimit-Limit`: 限制的最大令牌数
- `X-RateLimit-Remaining`: 剩余令牌数
- `X-RateLimit-Reset`: 重置时间戳（Unix时间戳）
- `X-RateLimit-Retry-After`: 重试等待时间（秒）
- `X-RateLimit-Policy`: 限流策略类型
- `X-RateLimit-Key`: 限流键
- `X-RateLimit-Details`: 详细的限流信息（JSON格式）

## 使用示例

### 基本使用

```typescript
import express from 'express';
import { RateLimitStrategy, RateLimiterFactory } from '@domain/services/RateLimitStrategy.js';
import { createSimpleRateLimitMiddleware } from '@middlewares/rateLimit.js';
import { createRateLimitRoutes } from '@api/routes/RateLimit.js';

const app = express();

// 创建限流组件
const limiterFactory = new RateLimiterFactory(logger);
const rateLimitStrategy = new RateLimitStrategy(limiterFactory, logger);

// 应用限流中间件
app.use('/api', createSimpleRateLimitMiddleware(rateLimitStrategy));

// 添加限流管理API
app.use('/api/rate-limit', createRateLimitRoutes(rateLimitStrategy, logger));
```

### 自定义限流策略

```typescript
// 为特定API端点添加严格限流
rateLimitStrategy.addConfig({
  type: 'sensitive-api',
  maxTokens: 10,
  refillRate: 1,
  enabled: true,
  priority: 1, // 高优先级
  keyGenerator: (req) => `sensitive:${req.user?.id || req.ip}`,
  skipCondition: (req) => req.user?.role === 'admin', // 管理员跳过限流
});
```

### 监控和告警

```typescript
// 定期检查限流统计
setInterval(async () => {
  const stats = rateLimitMetrics.getStatistics('global', 3600000); // 1小时统计
  
  if (stats.allowRate < 0.8) { // 允许率低于80%时告警
    logger.warn('限流告警', {
      limiterType: 'global',
      allowRate: stats.allowRate,
      rejectedRequests: stats.rejectedRequests,
    });
  }
}, 300000); // 每5分钟检查一次
```

## 性能考虑

### 内存使用
- 限流状态存储在内存中，每个活跃键约占用100字节
- 自动清理过期状态，默认TTL为30分钟
- 可通过配置调整清理间隔和TTL

### 性能优化
- 使用高效的令牌桶算法，O(1)时间复杂度
- 批量操作支持，减少计算开销
- 异步清理，不影响请求处理性能

### 扩展性
- 支持水平扩展（多实例部署）
- 支持自定义限流算法
- 支持外部存储后端（Redis等）

## 故障排除

### 常见问题

1. **请求被意外限流**
   - 检查时钟同步
   - 验证配置参数
   - 查看限流日志

2. **限流不生效**
   - 确认中间件正确注册
   - 检查配置是否启用
   - 验证路由优先级

3. **内存使用过高**
   - 调整清理间隔
   - 减少TTL时间
   - 监控活跃键数量

### 调试工具

```bash
# 查看当前限流状态
curl -H "Authorization: Bearer <token>" \
     http://localhost:3000/api/rate-limit/status

# 查看IP限流统计
curl -H "Authorization: Bearer <token>" \
     "http://localhost:3000/api/rate-limit/statistics?limiterType=ip&timeRange=3600000"

# 重置特定IP的限流器
curl -X POST \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"limiterType":"ip","key":"192.168.1.100"}' \
     http://localhost:3000/api/rate-limit/reset
```

## 最佳实践

1. **分层限流**: 使用多级限流策略，从粗粒度到细粒度
2. **合理配置**: 根据业务需求和系统容量设置合适的限制
3. **监控告警**: 建立完善的监控和告警机制
4. **优雅降级**: 在限流时提供友好的错误信息和重试指导
5. **定期评估**: 根据实际使用情况调整限流参数

## 安全考虑

1. **IP伪造**: 使用可靠的IP提取方法，考虑代理和负载均衡器
2. **DoS防护**: 限流是DoS防护的第一道防线
3. **用户隐私**: 在日志中避免记录敏感的用户信息
4. **配置安全**: 限制配置修改权限，防止恶意调整

## 更新日志

### v1.0.0 (2024-01-01)
- 初始版本发布
- 实现令牌桶算法
- 支持多级限流策略
- 提供完整的监控API
- 包含全面的测试覆盖

### 后续计划
- 支持分布式限流
- 添加自适应限流算法
- 集成更多存储后端
- 提供图形化监控界面