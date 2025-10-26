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

## 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0
- Qdrant服务器运行在 http://localhost:6333

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

### 后端部署

```bash
cd packages/backend
npm run build
npm start
```

### 前端部署

```bash
cd packages/frontend
npm run build
# 部署 dist/ 目录到静态文件服务器
```

## 贡献指南

1. Fork项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建Pull Request

## 许可证

Apache License, Version 2.0