# OpenAPI 文档自动生成系统

## 📋 概述

这是 Qdrant MCP RAG 系统的 **OpenAPI 文档自动生成系统**。

所有 API 文档都通过 **JSDoc 注释自动生成**，确保文档与代码始终保持同步。

## 🚀 快速开始

👉 **新用户？从这里开始**: [QUICKSTART.md](./QUICKSTART.md) (5分钟)

## 📚 完整指南

| 文档 | 说明 | 时长 |
|------|------|------|
| [QUICKSTART.md](./QUICKSTART.md) | ⭐ 5分钟快速上手 | 5分钟 |
| [../guide/openapi-auto-generation.md](../guide/openapi-auto-generation.md) | 🎓 完整实施教程 | 15分钟 |
| [../specs/openapi-best-practices.md](../specs/openapi-best-practices.md) | 📖 最佳实践指南 | 10分钟 |
| [../guide/openapi-ci-cd-integration.md](../guide/openapi-ci-cd-integration.md) | 🚀 CI/CD 配置 | 10分钟 |

## 🎯 API 基础信息

- **基础URL**: `http://localhost:3000/api`
- **文档格式**: OpenAPI 3.0
- **内容类型**: `application/json`
- **Swagger UI**: `http://localhost:3000/api-docs`
- **OpenAPI JSON**: `http://localhost:3000/api-docs.json`

## 核心功能模块

### 1. 文档管理

#### 上传文档
```http
POST /upload
Content-Type: multipart/form-data

Response:
{
  "success": true,
  "data": {
    "docId": "doc_123",
    "name": "document.pdf",
    "size": 1024000,
    "status": "processing"
  }
}
```

#### 批量上传文档
```http
POST /upload/batch
Content-Type: multipart/form-data

Response:
{
  "success": true,
  "data": {
    "operationId": "batch_op_456",
    "total": 10,
    "processed": 10,
    "successful": 8,
    "failed": 2,
    "results": [
      {
        "fileName": "doc1.pdf",
        "success": true,
        "docId": "doc_123"
      },
      {
        "fileName": "doc2.pdf",
        "success": false,
        "error": "File too large"
      }
    ]
  }
}
```

#### 获取文档列表
```http
GET /docs?page=1&limit=20&collectionId=col_123

Response:
{
  "success": true,
  "data": {
    "items": [
      {
        "docId": "doc_123",
        "name": "document.pdf",
        "size": 1024000,
        "status": "synced",
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-01T01:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

#### 文档预览
```http
GET /docs/{docId}/preview?format=html

Response:
{
  "success": true,
  "data": {
    "content": "<html>...</html>",
    "mimeType": "text/html",
    "format": "html"
  }
}
```

#### 文档下载
```http
GET /docs/{docId}/download?format=original

Response:
Content-Type: application/pdf
Content-Disposition: attachment; filename="document.pdf"
[Binary file content]
```

#### 文档缩略图
```http
GET /docs/{docId}/thumbnail?width=200&height=200

Response:
Content-Type: image/png
[Binary image content]
```

### 2. 集合管理

#### 创建集合
```http
POST /collections

Request:
{
  "name": "技术文档",
  "description": "技术相关文档集合"
}

Response:
{
  "success": true,
  "data": {
    "collectionId": "col_123",
    "name": "技术文档",
    "description": "技术相关文档集合",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

#### 获取集合列表
```http
GET /collections?page=1&limit=20

Response:
{
  "success": true,
  "data": {
    "items": [
      {
        "collectionId": "col_123",
        "name": "技术文档",
        "description": "技术相关文档集合",
        "documentCount": 25,
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "totalPages": 1
    }
  }
}
```

### 3. 搜索功能

#### 向量搜索
```http
GET /search?q=TypeScript&collectionId=col_123&limit=10

Response:
{
  "success": true,
  "data": [
    {
      "docId": "doc_123",
      "chunkId": "chunk_456",
      "content": "TypeScript是一种...",
      "score": 0.95,
      "metadata": {
        "title": "TypeScript指南",
        "tags": ["programming", "typescript"]
      }
    }
  ]
}
```

#### 分页搜索
```http
GET /search/paginated?q=TypeScript&page=1&limit=20

Response:
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

### 4. 批量操作

#### 批量删除文档
```http
DELETE /docs/batch

Request:
{
  "docIds": ["doc_123", "doc_456", "doc_789"]
}

Response:
{
  "success": true,
  "data": {
    "operationId": "batch_del_789",
    "total": 3,
    "successful": 3,
    "failed": 0,
    "results": [
      {
        "docId": "doc_123",
        "success": true
      },
      {
        "docId": "doc_456",
        "success": true
      },
      {
        "docId": "doc_789",
        "success": true
      }
    ]
  }
}
```

#### 获取批量操作进度
```http
GET /batch/progress/{operationId}

Response:
{
  "success": true,
  "data": {
    "operationId": "batch_del_789",
    "total": 3,
    "processed": 2,
    "successful": 2,
    "failed": 0,
    "percentage": 66,
    "status": "processing",
    "startedAt": "2024-01-01T12:00:00Z",
    "estimatedCompletion": "2024-01-01T12:05:00Z"
  }
}
```

### 5. 系统监控

#### 健康检查
```http
GET /health

Response:
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T12:00:00Z",
    "version": "1.0.0"
  }
}
```

#### 详细健康检查
```http
GET /healthz

Response:
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T12:00:00Z",
    "version": "1.0.0",
    "services": {
      "database": "healthy",
      "qdrant": "healthy",
      "filesystem": "healthy"
    },
    "metrics": {
      "uptime": 86400,
      "memoryUsage": "45%",
      "diskUsage": "23%"
    }
  }
}
```

## 错误处理

### 标准错误格式

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数验证失败",
    "details": {
      "field": "q",
      "issue": "required field is missing"
    }
  }
}
```

### 常见错误代码

| 错误代码 | HTTP状态码 | 描述 |
|---------|---------|------|
| `VALIDATION_ERROR` | 400 | 请求参数验证失败 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `UNAUTHORIZED` | 401 | 未授权访问 |
| `FORBIDDEN` | 403 | 禁止访问 |
| `RATE_LIMITED` | 429 | 请求频率超限 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |
| `SERVICE_UNAVAILABLE` | 503 | 服务不可用 |

## 限流和缓存

### 搜索限流

- **默认限制**: 每秒最多3个搜索请求
- **突发限制**: 每分钟最多60个搜索请求
- **去重机制**: 相同查询在300ms内只执行一次

### 缓存策略

- **文档元数据**: 缓存5分钟
- **搜索结果**: 缓存2分钟
- **集合列表**: 缓存10分钟

## SDK 和客户端库

### JavaScript/TypeScript 客户端

```typescript
import { apiClient, collectionsApi, documentsApi } from '@qdrant-mcp-rag/frontend';

// 使用示例
const collections = await collectionsApi.getCollections();
const documents = await documentsApi.getDocuments({ page: 1, limit: 20 });
```

### Python 客户端 (计划中)

```python
from qdrant_mcp_rag_client import QdrantMCPClient

client = QdrantMCPClient(base_url="http://localhost:3000/api")
collections = client.collections.list()
```

## 开发和测试

### 本地开发

1. 启动后端服务：
```bash
cd packages/backend
npm run dev
```

2. 启动前端服务：
```bash
cd packages/frontend
npm run dev
```

### API 测试

使用提供的Postman集合或OpenAPI规范进行测试：

```bash
# 运行API测试
npm run test:api

# 生成API文档
npm run docs:api
```

## 版本历史

### v1.0.0 (当前版本)
- 基础CRUD操作
- 文档上传和预览
- 向量搜索
- 批量操作
- 健康检查

### v0.9.0
- 初始版本
- 基础架构搭建

---

*本文档会随着API功能更新而持续维护。*