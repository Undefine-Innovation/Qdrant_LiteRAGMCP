# Qdrant MCP RAG API 文档

## 📚 文档导航

### 🚀 快速开始
- [快速开始指南](./quick-start.md) - 5分钟快速上手，包含完整示例和常见场景
- [API调用示例](./api-examples.md) - 多语言API调用示例，包含JavaScript、Python和curl
- [API使用指南](./api-usage-guide.md) - 快速上手API，包含基本使用示例
- [API测试检查清单](./api-testing-checklist.md) - 完整的API测试清单和工具

### 📖 核心文档
- [OpenAPI规范](./openapi.yaml) - 完整的API规范文档
- [错误处理指南](./error-handling-guide.md) - 详细的错误处理和最佳实践

### 🔧 API参考
- [集合管理API](./paths/collections.yaml) - 集合的创建、查询、更新和删除
- [文档管理API](./paths/documents.yaml) - 文档的上传、查询、同步和删除
- [文档上传API](./paths/upload.yaml) - 文档上传到默认集合或指定集合
- [搜索API](./paths/search.yaml) - 基本搜索和分页搜索功能

### 📋 数据模型
- [文档模型](./components/schemas/document.yaml) - 文档和文本块的数据结构
- [集合模型](./components/schemas/collection.yaml) - 集合的数据结构
- [搜索模型](./components/schemas/search.yaml) - 搜索结果的数据结构
- [错误模型](./components/schemas/error.yaml) - 错误响应的数据结构

### 🔄 响应定义
- [通用响应](./components/responses/common.yaml) - 标准化的响应定义

## 🎯 API概览

Qdrant MCP RAG API 提供了完整的文档管理和语义搜索功能，主要包括：

### 核心功能
- **集合管理**: 创建、查询、更新和删除文档集合
- **文档管理**: 上传、查询、同步和删除文档
- **语义搜索**: 基于向量嵌入的智能搜索
- **文档分块**: 自动将文档分割为可搜索的文本块

### 技术特点
- **向量搜索**: 基于Qdrant向量数据库的高效语义搜索
- **自动分块**: 智能文档分割，保持上下文完整性
- **异步处理**: 文档上传后异步处理，不影响用户体验
- **RESTful API**: 标准的REST API设计，易于集成

## 🚀 快速体验

想要快速体验API功能？请参考我们的[快速开始指南](./quick-start.md)，其中包含：

- 环境设置和启动指南
- 5分钟快速上手教程
- 常见使用场景的完整示例
- 调试和故障排除方法

### 基础示例

#### 1. 创建集合
```bash
curl -X POST http://localhost:3000/api/collections \
  -H "Content-Type: application/json" \
  -d '{
    "name": "技术文档",
    "description": "技术相关的文档集合"
  }'
```

#### 2. 上传文档
```bash
curl -X POST http://localhost:3000/api/collections/技术文档/docs \
  -F "file=@技术文档.md"
```

#### 3. 搜索内容
```bash
curl "http://localhost:3000/api/search?q=安装步骤&collectionId=技术文档"
```

> 💡 **提示**: 查看更多详细示例，请访问[API调用示例](./api-examples.md)文档。

## 📊 API架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   前端应用      │    │   API网关       │    │   后端服务      │
│                │    │                │    │                │
│ - 文档上传      │───▶│ - 路由管理      │───▶│ - 文档处理      │
│ - 搜索界面      │    │ - 认证授权      │    │ - 向量嵌入      │
│ - 集合管理      │    │ - 限流控制      │    │ - 搜索服务      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                                                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   文件存储      │    │   SQLite数据库   │    │  Qdrant向量库   │
│                │    │                │    │                │
│ - 原始文档      │    │ - 文档元数据    │    │ - 向量嵌入      │
│ - 上传文件      │    │ - 集合信息      │    │ - 相似度搜索    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔧 开发环境设置

### 1. 环境要求
- Node.js 18+
- Qdrant 向量数据库
- SQLite 数据库

### 2. 安装和启动
```bash
# 安装依赖
npm install

# 启动后端服务
npm run start

# 启动前端服务（可选）
cd packages/frontend && npm run dev
```

### 3. 环境配置
参考 `.env.example` 文件配置环境变量：
```env
# 服务器配置
PORT=3000
HOST=localhost

# 数据库配置
DATABASE_PATH=./data/qdrant_mcp.db

# Qdrant配置
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION_NAME=qdrant_mcp_collection

# 嵌入模型配置
OPENAI_API_KEY=your-openai-api-key
OPENAI_API_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL_NAME=text-embedding-ada-002
```

## 📝 开发指南

### API设计原则
- **RESTful**: 遵循REST API设计原则
- **一致性**: 统一的请求/响应格式
- **可扩展性**: 支持水平扩展和负载均衡
- **安全性**: 完整的认证和授权机制

### 错误处理
- **标准化**: 统一的错误响应格式
- **详细性**: 提供详细的错误信息和上下文
- **可追踪**: 包含请求ID和时间戳
- **友好性**: 人类可读的错误信息

### 性能优化
- **异步处理**: 文档处理异步进行
- **分页支持**: 大数据量分页返回
- **缓存策略**: 合理的缓存机制
- **限流控制**: API调用频率限制

## 🧪 测试

### 单元测试
```bash
# 运行单元测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage
```

### 集成测试
```bash
# 运行集成测试
npm run test:integration
```

### API测试
参考 [API测试检查清单](./api-testing-checklist.md) 进行完整的API测试。

## 📈 监控和日志

### 应用监控
- **健康检查**: `/api/health` 端点
- **性能指标**: 响应时间、吞吐量等
- **错误率**: API错误统计和报警

### 日志记录
- **结构化日志**: JSON格式的结构化日志
- **日志级别**: DEBUG、INFO、WARN、ERROR
- **日志轮转**: 自动日志文件轮转和清理

## 🔒 安全性

### 认证和授权
- **JWT令牌**: 基于JWT的认证机制
- **权限控制**: 基于角色的访问控制
- **令牌刷新**: 自动令牌刷新机制

### 数据安全
- **输入验证**: 严格的输入参数验证
- **SQL注入防护**: 参数化查询防止SQL注入
- **文件上传安全**: 文件类型和大小限制

## 🤝 贡献指南

### 代码规范
- **ESLint**: 代码风格检查
- **Prettier**: 代码格式化
- **TypeScript**: 强类型检查

### 提交规范
- **Conventional Commits**: 标准化的提交信息格式
- **代码审查**: 所有代码变更需要审查
- **测试覆盖**: 新功能需要相应的测试

## 📞 支持和反馈

### 问题报告
- **GitHub Issues**: 使用GitHub Issues报告问题
- **Bug报告**: 提供详细的复现步骤和环境信息
- **功能请求**: 描述新功能的用途和预期行为

### 联系方式
- **技术支持**: support@example.com
- **文档反馈**: docs@example.com
- **社区讨论**: [GitHub Discussions](https://github.com/example/qdrant-mcp-rag/discussions)

---

## 📚 推荐阅读路径

### 新手入门
1. [快速开始指南](./quick-start.md) - 从零开始，5分钟上手
2. [API调用示例](./api-examples.md) - 查看多语言代码示例
3. [OpenAPI规范](./openapi.yaml) - 了解完整的API规范

### 进阶开发
1. [错误处理指南](./error-handling-guide.md) - 实现健壮的错误处理
2. [API测试检查清单](./api-testing-checklist.md) - 确保API质量
3. [数据模型文档](./components/schemas/) - 深入了解数据结构

### 生产部署
1. [监控和日志](#-监控和日志) - 监控API性能和健康状态
2. [安全性](#-安全性) - 实施安全最佳实践
3. [性能优化](#性能优化) - 优化API响应速度

**更多详细信息请参考各个专门的文档页面。**