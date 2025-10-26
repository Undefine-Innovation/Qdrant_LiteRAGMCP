# Qdrant MCP RAG Backend

后端服务，提供文档管理、向量搜索和同步功能。

## 功能特性

- 文档上传和管理
- 向量嵌入和搜索
- 文档同步状态管理
- RESTful API接口
- SQLite数据持久化
- Qdrant向量数据库集成

## 开发环境设置

1. 安装依赖：

```bash
npm install
```

2. 复制环境变量文件：

```bash
cp .env.example .env
```

3. 配置环境变量（参考.env.example）

4. 启动开发服务器：

```bash
npm run dev
```

## 构建和部署

1. 构建项目：

```bash
npm run build
```

2. 启动生产服务器：

```bash
npm start
```

## API文档

API文档位于 `../../docs/apis/openapi.yaml`，包含所有接口的详细说明。

## 项目结构

```
src/
├── api/              # API路由和契约
├── application/      # 应用服务层
├── domain/          # 领域模型和接口
├── infrastructure/  # 基础设施实现
├── middlewares/     # 中间件
└── utils/           # 工具函数
```

## 代码规范

- 使用TypeScript严格模式
- 遵循ESLint和Prettier配置
- 所有函数必须有JSDoc注释
- 文件长度不超过400行
- 使用camelCase命名变量和函数
- 使用PascalCase命名类和接口
