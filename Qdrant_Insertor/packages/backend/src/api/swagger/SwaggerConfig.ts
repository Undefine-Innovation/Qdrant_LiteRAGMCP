/**
 * Swagger/OpenAPI 配置
 * 用于自动生成 OpenAPI 3.0 规范
 *
 * @fileoverview 配置 swagger-jsdoc 从 JSDoc 注释生成 OpenAPI 规范
 * @author API Documentation
 * @version 1.0.0
 */

// TODO: 安装 swagger-jsdoc 依赖后重新启用
// import swaggerJsdoc from 'swagger-jsdoc';

/**
 * Swagger配置选项
 * 用于配置OpenAPI规范的生成参数
 */
export const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Qdrant MCP RAG System API',
      version: '1.0.0',
      description: `
# Qdrant MCP RAG System API

这是一个基于Qdrant向量数据库的文档级RAG（检索增强生成）系统API，支持知识图谱功能。

## 功能概述

- **文档管理**: 上传、存储、检索和管理各种格式的文档
- **向量搜索**: 基于语义相似度的高效文档检索
- **集合管理**: 组织和管理文档集合
- **知识图谱**: 提取和存储文档中的实体关系
- **分页搜索**: 支持大规模文档集的高效分页检索

## 核心概念

### 集合 (Collections)
集合是文档的逻辑分组，每个集合包含一组相关的文档。集合有助于组织和管理不同主题或项目的文档。

### 文档 (Documents)
文档是系统中的基本内容单元，可以是各种格式的文件（如PDF、Markdown、TXT等）。上传后，文档会被自动处理和分块。

### 文档块 (Chunks)
文档被自动分割成更小的文本块，每个块都会生成向量嵌入，用于语义搜索。这种分块策略提高了检索的精确度和相关性。

## 使用场景

- **企业知识库**: 构建企业内部文档检索系统
- **学术研究**: 高效检索和分析学术论文
- **技术文档**: 快速查找技术文档和API参考
- **内容管理**: 管理和检索大量内容资源
- **智能问答**: 为问答系统提供语义检索能力

## 快速开始

1. **创建集合**: 首先创建一个集合来组织您的文档
2. **上传文档**: 将文档上传到指定集合
3. **搜索内容**: 使用自然语言查询检索相关内容

## API认证

当前版本不需要认证，但在生产环境中建议配置适当的认证机制。

## 错误处理

API使用标准HTTP状态码，所有错误响应都包含详细的错误信息和错误代码，便于调试和处理。

## 限制说明

- 单个文件大小限制: 10MB
- 搜索结果最大数量: 100
- 批量操作限制: 100个项目/批次
      `,
      license: {
        name: 'Apache-2.0',
        url: 'https://www.apache.org/licenses/LICENSE-2.0',
      },
    },
    servers: [
      {
        url: '/api',
        description: '本地开发服务器',
      },
      {
        url: 'https://your-production-server.com/api',
        description: '生产环境服务器',
      },
    ],
    components: {
      schemas: {
        ApiError: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: '错误代码',
                },
                message: {
                  type: 'string',
                  description: '错误信息',
                },
                details: {
                  type: 'object',
                  description: '详细错误信息',
                },
              },
              required: ['code', 'message'],
            },
          },
        },
        Collection: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: '集合ID',
            },
            name: {
              type: 'string',
              description: '集合名称',
            },
            description: {
              type: 'string',
              description: '集合描述',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: '创建时间',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: '更新时间',
            },
          },
          required: ['id', 'name', 'createdAt', 'updatedAt'],
        },
        Document: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: '文档ID',
            },
            collectionId: {
              type: 'string',
              format: 'uuid',
              description: '所属集合ID',
            },
            name: {
              type: 'string',
              description: '文档名称',
            },
            status: {
              type: 'string',
              enum: ['NEW', 'PROCESSING', 'COMPLETED', 'FAILED'],
              description: '同步状态',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: '创建时间',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: '更新时间',
            },
          },
          required: [
            'id',
            'collectionId',
            'name',
            'status',
            'createdAt',
            'updatedAt',
          ],
        },
        Pagination: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              minimum: 1,
              description: '当前页码',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              description: '每页数量',
            },
            total: {
              type: 'integer',
              description: '总数',
            },
            hasMore: {
              type: 'boolean',
              description: '是否还有更多数据',
            },
          },
          required: ['page', 'limit', 'total'],
        },
        HealthStatus: {
          type: 'object',
          properties: {
            ok: {
              type: 'boolean',
              description: '系统是否健康',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: '检查时间',
            },
            version: {
              type: 'string',
              description: 'API版本',
            },
          },
          required: ['ok', 'timestamp'],
        },
      },
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: '使用 JWT Bearer Token 进行身份验证',
        },
      },
    },
    tags: [
      {
        name: '健康检查',
        description: '系统健康状态和监控相关端点',
      },
      {
        name: '搜索',
        description: '文档搜索和检索相关端点',
      },
      {
        name: '文档管理',
        description: '文档上传、管理和操作相关端点',
      },
      {
        name: '集合管理',
        description: '集合创建、管理和操作相关端点',
      },
      {
        name: '批量操作',
        description: '批量上传、删除等操作相关端点',
      },
      {
        name: '文档预览',
        description: '文档预览、下载和缩略图相关端点',
      },
    ],
  },
  apis: [
    'src/api/routes/**/*.ts', // 自动扫描所有路由文件
  ],
};

/**
 * 生成 OpenAPI 规范
 * 从 JSDoc 注释中扫描并生成 OpenAPI 3.0 规范
 */
// TODO: 安装 swagger-jsdoc 依赖后重新启用
// export const swaggerSpec = swaggerJsdoc(swaggerOptions);
export const swaggerSpec = {} as Record<string, unknown>;

/**
 * 获取 OpenAPI 规范
 * @returns OpenAPI 规范对象
 */
export function getOpenAPISpec() {
  return swaggerSpec;
}
