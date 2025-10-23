## 🚀 如何运行后端服务

要运行后端服务，请按照以下步骤操作：

### 1. 前提条件

- **Node.js**: 确保您的系统安装了 Node.js (推荐 18+ 版本)。
- **Docker**: Qdrant 向量数据库通常通过 Docker 运行，请确保您的系统安装了 Docker。

### 2. 配置环境变量

在项目根目录下创建一个 `.env` 文件（如果尚未存在），并根据您的环境配置以下变量：

```env
# 数据库路径
DB_PATH=./data/app.db

# Qdrant 配置
QDRANT_URL=http://localhost:6333 # 如果使用 Docker，通常是 http://localhost:6333
QDRANT_COLLECTION_NAME=my_rag_collection # Qdrant 集合名称
QDRANT_VECTOR_SIZE=1536 # 向量维度，例如 OpenAI text-embedding-ada-002 是 1536

# OpenAI API 配置 (或兼容 OpenAI API 的服务)
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-your_openai_api_key
OPENAI_EMBEDDING_MODEL=text-embedding-ada-002

# API 服务器配置
API_PORT=3000

# 自动垃圾回收配置 (小时)
GC_INTERVAL_HOURS=24
```

### 3. 安装依赖

在项目根目录（`d:/code/JS/Qdrant_MCP_RAG/Qdrant_Insertor`）下打开终端，运行以下命令安装所有 Node.js 依赖：

```bash
npm install
```

### 4. 启动 Qdrant 向量数据库 (使用 Docker)

在终端中运行以下 Docker 命令来启动 Qdrant 服务：

```bash
docker run -p 6333:6333 -p 6334:6334 \
    -v $(pwd)/qdrant_data:/qdrant/storage \
    qdrant/qdrant
```

- `-p 6333:6333`: 将容器的 gRPC 端口映射到主机的 6333 端口。
- `-p 6334:6334`: 将容器的 REST API 端口映射到主机的 6334 端口 (可选，但推荐)。
- `-v $(pwd)/qdrant_data:/qdrant/storage`: 将主机当前目录下的 `qdrant_data` 文件夹挂载到容器内部作为 Qdrant 的数据存储目录，确保数据持久化。

### 5. 启动后端服务

在 Qdrant 启动并运行后，在项目根目录下打开一个新的终端，运行以下命令启动后端服务：

```bash
npm run start
```

或者，如果您想在开发模式下启动并进行文件更改时自动重启：

```bash
npm run dev
```

成功启动后，您将在终端中看到类似以下输出：

```
[INFO] 配置已加载。
[INFO] 基础设施组件已初始化。
[INFO] 应用服务已初始化。
[INFO] Express 应用程序已配置路由和错误处理。
[INFO] API 服务器正在运行于 http://localhost:3000
[INFO] AutoGC 定时任务已设置，每 24 小时运行一次。
[INFO] 执行初始垃圾回收...
```

现在，后端服务应该已经在 `http://localhost:3000` 运行，您可以开始通过 API 接口进行交互了。
