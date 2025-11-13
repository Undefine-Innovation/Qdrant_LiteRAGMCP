# Qdrant MCP RAG System

基于Qdrant向量数据库的MCP（Model Context Protocol）RAG（Retrieval-Augmented Generation）系统。

## 项目结构

这是一个monorepo项目，包含以下子项目：

```
qdrant-mcp-rag/
├── packages/
│   ├── backend/          # 后端服务
│   └── frontend/         # 前端应用
├── shared/              # 共享类型和工具
├── docs/                # 项目文档
└── scripts/             # 构建脚本
```

## 环境配置

### 环境变量文件结构

项目使用统一的环境配置结构，包含以下文件：

- `.env.example` - 主要配置示例文件，包含所有环境变量的说明
- `.env.development.example` - 开发环境配置示例
- `.env.production.example` - 生产环境配置示例
- `.env.test.example` - 测试环境配置示例

### 配置步骤

1. **复制配置文件**
   ```bash
   # 复制主要配置文件
   cp .env.example .env
   
   # 或者根据环境复制特定配置文件
   cp .env.development.example .env.development
   cp .env.production.example .env.production
   cp .env.test.example .env.test
   ```

2. **修改配置值**
   编辑 `.env` 文件，设置以下关键配置：
   - `OPENAI_API_KEY` - 设置您的 OpenAI API 密钥
   - `QDRANT_URL` - 设置 Qdrant 服务器地址
   - `DATABASE_PATH` - 设置数据库文件路径

3. **环境特定配置**
   根据您的运行环境，可以使用不同的配置文件：
   - 开发环境：使用 `.env.development`
   - 生产环境：使用 `.env.production`
   - 测试环境：使用 `.env.test`

### 主要环境变量说明

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `NODE_ENV` | 运行环境 | `development` |
| `PORT` | 服务器端口 | `3000` |
| `DATABASE_PATH` | SQLite数据库路径 | `./data/app.db` |
| `QDRANT_URL` | Qdrant服务地址 | `http://localhost:6333` |
| `QDRANT_COLLECTION_NAME` | Qdrant集合名称 | `qdrant_rag` |
| `OPENAI_API_KEY` | OpenAI API密钥 | 必需设置 |
| `OPENAI_MODEL` | OpenAI模型 | `gpt-3.5-turbo` |
| `EMBEDDING_MODEL` | 嵌入模型 | `text-embedding-ada-002` |
| `EMBEDDING_BATCH_SIZE` | 嵌入批次大小 | `200` |
| `LOG_LEVEL` | 日志级别 | `info` |

### 日志配置

项目支持详细的日志配置，包括：
- 文件日志和控制台日志
- 结构化日志（JSON格式）
- 日志轮转和压缩
- 性能监控日志

详细配置选项请参考 `.env.example` 文件中的日志配置部分。

## 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0
- Qdrant服务器运行在 http://localhost:6333
- OpenAI API密钥

### 安装依赖

```bash
npm run install:all
```

### 开发环境

1. 启动所有服务（前端+后端）：
```bash
npm run dev
```

2. 单独启动后端：
```bash
npm run dev:backend
```

3. 单独启动前端：
```bash
npm run dev:frontend
```

### 构建项目

```bash
# 构建所有项目
npm run build

# 单独构建
npm run build:backend
npm run build:frontend
npm run build:shared
```

## 代码质量

```bash
# 代码检查
npm run lint

# 自动修复
npm run lint:fix

# 代码格式化
npm run format

# 类型检查
npm run type-check
```

## 项目文档

- [API文档](./docs/apis/openapi.yaml)
- [架构设计](./docs/Architecture/)
- [代码规范](./docs/notes/coding_style.md)
- [重构计划](./project-restructure-plan.md)

## 开发指南

### 后端开发

后端使用Node.js + TypeScript + Express，提供RESTful API接口。

```bash
cd packages/backend
npm run dev
```

### 前端开发

前端使用React + TypeScript + Vite，提供用户界面。

```bash
cd packages/frontend
npm run dev
```

### 共享代码

共享代码位于`shared/`目录，包含类型定义和工具函数。

```bash
cd shared
npm run dev
```

## 部署

### 环境配置准备

在部署前，请确保已正确配置环境变量：

1. **生产环境配置**
   ```bash
   # 复制生产环境配置模板
   cp .env.production.example .env.production
   
   # 编辑配置文件，设置生产环境特定的值
   nano .env.production
   ```

2. **关键配置项检查**
   - `OPENAI_API_KEY` - 确保使用生产环境的API密钥
   - `QDRANT_API_KEY` - 如果Qdrant需要认证，设置正确的密钥
   - `JWT_SECRET` - 使用强密码作为JWT密钥
   - `DATABASE_PATH` - 设置生产环境的数据库路径
   - `LOG_LEVEL` - 生产环境建议设置为 `info` 或 `warn`

### 后端部署

```bash
cd packages/backend

# 安装生产依赖
npm ci --production

# 构建项目
npm run build

# 使用生产环境配置启动
NODE_ENV=production npm start
```

### 前端部署

```bash
cd packages/frontend

# 安装依赖
npm ci

# 构建生产版本
npm run build

# 部署 dist/ 目录到静态文件服务器
# 确保服务器配置了正确的API地址（VITE_API_BASE_URL）
```

### Docker 部署

项目支持 Docker 部署，使用以下命令：

```bash
# 构建镜像
docker build -t qdrant-mcp-rag .

# 运行容器
docker run -d \
  --name qdrant-mcp-rag \
  -p 3000:3000 \
  --env-file .env.production \
  qdrant-mcp-rag
```

### 环境变量优先级

应用按以下优先级加载环境变量：

1. 命令行参数
2. `.env.{NODE_ENV}` 文件
3. `.env` 文件
4. 系统环境变量
5. 默认值

## 贡献指南

1. Fork项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建Pull Request

## 许可证

Apache License, Version 2.0