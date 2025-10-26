# Qdrant MCP RAG Frontend

前端应用，提供文档管理、搜索和可视化界面。

## 功能特性

- 文档上传和管理界面
- 向量搜索功能
- 文档同步状态监控
- 响应式设计
- 实时状态更新

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

2. 预览构建结果：

```bash
npm run preview
```

## 代码质量

1. 代码检查：

```bash
npm run lint
```

2. 自动修复代码问题：

```bash
npm run lint:fix
```

3. 代码格式化：

```bash
npm run format
```

4. 类型检查：

```bash
npm run type-check
```

## 项目结构

```
src/
├── components/       # 可复用组件
├── pages/           # 页面组件
├── hooks/           # 自定义Hook
├── services/        # API服务
├── stores/          # 状态管理
├── types/           # 类型定义
└── utils/           # 工具函数
```

## 技术栈

- React 18
- TypeScript
- Vite
- React Router
- Zustand (状态管理)
- Axios (HTTP客户端)
- Lucide React (图标)

## 代码规范

- 使用TypeScript严格模式
- 遵循ESLint和Prettier配置
- 所有组件必须有JSDoc注释
- 文件长度不超过400行
- 使用camelCase命名变量和函数
- 使用PascalCase命名组件和类型
