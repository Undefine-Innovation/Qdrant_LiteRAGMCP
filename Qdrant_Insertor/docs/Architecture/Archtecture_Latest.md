## 目录

1. 项目背景与目标
2. 总体架构概览（Mermaid 图）
3. 领域模型
4. 各分层设计
   4.1 表现层（Web UI）
   4.2 API 层 ⭐
   4.3 应用层
   4.4 领域层（接口 & 策略）
   4.5 基础设施层
5. 关键第三方依赖
6. 运行时流程
7. 日志与监控
8. 向量同步状态机
9. 部署与配置
10. 未来可扩展点

---

## 1. 项目背景与目标

- 构建一个支持 **文档级 RAG 检索**，并预留 **知识图谱** 能力的服务。
- 核心目标：
  - 架构极简，模块清晰；
  - 算法可插拔，便于替换 Embedding、Splitter、Retriever 等组件；
  - 保证向量数据库（Qdrant）与元数据存储（SQLite）的一致性；
  - 提供统一、易用、可自动生成文档的 API 接口。

---

## 2. 总体架构概览

```mermaid
graph TD
  %% ==== Client ====
  UI["Web UI<br>(Vue/React/Svelte)"]
  %% ==== API ====
  Controller["Express/Koa Controller"]
  UI -->|HTTP| Controller
  %% ==== Application ====
  subgraph Application [应用层]
    ImportSvc[ImportService]
    SearchSvc[SearchService]
    GraphSvc[GraphService]
    AutoGC[Auto GC Service]
    SyncSM[Sync StateMachine]
    CollectionSvc[CollectionService]
    DocumentSvc[DocumentService]
  end
  Controller --> ImportSvc
  Controller --> SearchSvc
  Controller --> CollectionSvc
  Controller --> DocumentSvc
  ImportSvc --> SyncSM
  ImportSvc --> GraphSvc
  AutoGC --> SQLiteRepo
  AutoGC --> QdrantRepo
  CollectionSvc --> SQLiteRepo
  DocumentSvc --> SQLiteRepo
  DocumentSvc --> ImportSvc
  %% ==== Domain ====
  subgraph Domain [领域层]
    subgraph Retriever [检索器模块]
      IRetriever["IRetriever<br/>基础检索器接口"]
      ICompositeRetriever["ICompositeRetriever<br/>组合检索器接口"]
      SearchCoordinator["SearchCoordinator<br/>检索协调器"]
      SemanticRetriever["SemanticRetriever<br/>向量检索器"]
      KeywordRetriever["KeywordRetriever<br/>关键词检索器"]
      GraphRetriever["GraphRetriever<br/>图谱检索器"]
      CompositeRetriever["CompositeRetriever<br/>组合检索器"]
    end
    subgraph FusionStrategy [融合策略模块]
      IFusionStrategy["IFusionStrategy<br/>融合策略接口"]
      IDeduplicationStrategy["IDeduplicationStrategy<br/>查重策略接口"]
      RRFFusionStrategy["RRFFusionStrategy<br/>RRF融合算法"]
      WeightedFusionStrategy["WeightedAverageFusionStrategy<br/>加权平均融合"]
      FusionStrategyFactory["FusionStrategyFactory<br/>融合策略工厂"]
    end
    GraphExtractor
    GraphRepoIntf["GraphRepository Interface"]
    DTOs["DTOs & Validation (Zod)"]
  end
  SearchSvc --> SearchCoordinator
  SearchCoordinator --> CompositeRetriever
  CompositeRetriever --> SemanticRetriever
  CompositeRetriever --> KeywordRetriever
  CompositeRetriever --> GraphRetriever
  SearchCoordinator --> IFusionStrategy
  IFusionStrategy --> IDeduplicationStrategy
  GraphSvc --> GraphExtractor
  GraphSvc --> GraphRepoIntf
  %% ==== Infrastructure ====
  subgraph Infra [基础设施层]
    FileLoader
    Splitter
    Embedder["EmbeddingProvider"]
    SQLiteRepo[(SQLite)]
    QdrantRepo[(Qdrant)]
    InMemGraphRepo[(In-Mem Graph)]
    Logger["Winston Logger"]
  end
  FileLoader --> Splitter
  Splitter --> Embedder
  Splitter --> SQLiteRepo
  Splitter --> QdrantRepo
  SemanticRetriever --> QdrantRepo
  KeywordRetriever --> SQLiteRepo
  GraphRetriever --> GraphRepoIntf
  GraphExtractor --> GraphRepoIntf
  Embedder --> QdrantRepo
  ImportSvc --> Logger
  SearchSvc --> Logger
  SyncSM --> Logger
```

---

## 3. 领域模型

核心领域对象：

- `Collection` → `Doc` → `Chunk`
- `GraphFragment`：包含 `Node` 与 `Edge`
- `RetrievalResult`：统一的检索结果格式，支持 chunkResult、graphResult 等多种类型
- `RetrievalRequest`：统一的检索请求格式，包含查询参数和检索选项
- `RetrievalSource`：检索来源枚举（SEMANTIC、KEYWORD、GRAPH等）
- `UnifiedSearchResult`：融合后的最终结果格式
- `FusionOptions`：融合选项配置，包含算法参数、权重设置等
- `DeduplicationResult`：查重处理结果，包含去重统计信息

---

## 4. 各分层设计

### 4.1 表现层（Web UI）

- 技术栈：Vue / React / Svelte 单页应用（SPA）
- 功能：
  - 调用后端 RESTful 或 GraphQL API
  - 实现身份验证（JWT / Cookie）
  - 支持文件上传、搜索展示、文档管理等交互

---

### 4.2 API 层 ⭐

> **本次重构重点模块**

#### 组成结构

1. **Router & Middleware**
   - 使用 Express 或 Koa
   - 统一处理 CORS、认证（Auth）、错误捕获

2. **DTO Validator**
   - 基于 Zod 进行请求校验
   - 校验失败返回 `422 Unprocessable Entity`

3. **Controller**
   - 职责单一：解包参数 → 调用 Service → 封装响应

4. **主要端点（REST 版）**

   | 方法   | 路径              | 功能                | 状态码 | 备注                                |
   | ------ | ----------------- | ------------------- | ------ | ----------------------------------- |
   | POST   | `/upload`         | 上传文件            | 201    | `multipart/form-data`；返回 `docId` |
   | DELETE | `/doc/:id`        | 删除文档            | 204    | 触发同步状态机进行清理              |
   | GET    | `/doc/:id/chunks` | 查询文档 Chunk 列表 | 200    | 支持分页                            |
   | GET    | `/search`         | 向量检索            | 200    | 返回 `RetrievalResultDTO`           |
   | GET    | `/healthz`        | 健康检查            | 200    | 检查 Qdrant 和 SQLite 是否可达      |
   | GET    | `/metrics`        | Prometheus 指标暴露 | 200    | 可选启用                            |

5. **统一错误格式**

```jsonc
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "field 'q' is required",
    "details": {
      /* 校验字段详情 */
    },
  },
}
```

> ✅ 所有 API 可通过 `express-zod-openapi` 自动生成 OpenAPI 文档。

---

### 4.3 应用层

协调业务流程，不包含核心逻辑：

- `ImportService`：处理文件导入全流程
- `SearchService`：封装检索逻辑调用，协调 SearchCoordinator 执行多源检索与融合
- `GraphService`：构建和查询图谱信息
- `CollectionService`：管理 Collection 的 CRUD 操作
- `DocumentService`：管理 Document 的 CRUD 操作（非导入/删除）
- `SyncStateMachine`：驱动向量与元数据同步流程
- `AutoGC`：负责兜底、修补及清理历史垃圾
  - 采用 **Level-2：双端比对（推荐）**
    - 维护一张 `chunk_checksum`（或 row count）快照表
    - 定期扫描 SQLite 与 Qdrant 数据一致性
    - 删除孤儿向量与无关元数据

---

### 4.4 领域层（接口 & 策略）

核心业务规则所在层：

#### Retriever

- **职责**：
  - 统一检索接口：提供统一的检索接口，抽象不同数据源（Qdrant、SQLite、图谱等）的检索逻辑
  - 多源数据检索：支持从多个数据源并行获取检索结果，包括向量检索、关键词检索和图谱检索
  - 结果标准化：将来自不同数据源的检索结果转换为统一的 `RetrievalResult` 格式
  - 检索策略组合：通过组合模式支持多种检索策略，可灵活配置和扩展
  - 数据源抽象：为上层应用提供透明的多数据源访问能力，屏蔽底层存储差异
- **核心接口**：
  - `IRetriever`: 基础检索器接口，定义单一数据源检索能力
  - `ICompositeRetriever`: 组合检索器接口，协调多个检索器并行执行
  - `SearchCoordinator`: 检索与融合协调器，管理组件间数据流
- **检索器实现**：
  - `SemanticRetriever`: 向量检索器，基于 Qdrant，支持相似度搜索
  - `KeywordRetriever`: 关键词检索器，基于 SQLite FTS5，支持全文搜索
  - `GraphRetriever`: 图谱检索器，基于实体关系查询（预留）
  - `CompositeRetriever`: 组合检索器，协调多个检索器并行执行
- **数据结构**：
  - `RetrievalResult`: 统一的检索结果格式，支持 chunkResult、graphResult 等多种类型
  - `RetrievalRequest`: 统一的检索请求格式，包含查询参数和检索选项
  - `RetrievalSource`: 检索来源枚举（SEMANTIC、KEYWORD、GRAPH等）
  - `UnifiedSearchResult`: 融合后的最终结果格式

#### FusionStrategy

- **职责**：
  - 多源结果融合：将来自不同检索源的 `RetrievalResult` 进行智能融合，生成最终排序结果
  - 智能查重处理：识别和处理来自不同数据源的重复内容，基于内容相似度和文档位置进行精确去重
  - 策略模式实现：作为可插拔的策略组件，支持多种融合算法（RRF、加权平均、神经网络融合等）
  - 结果优化与多样性：通过融合算法优化结果的相关性、多样性和新颖性，提升用户体验
  - 多源协调：与 SearchCoordinator 紧密协作，管理多源检索结果的融合流程和状态
  - 性能优化：实现高效的融合算法，支持大规模结果集的实时处理
- **核心接口**：
  - `IFusionStrategy`: 融合策略基础接口，定义融合方法签名
  - `IDeduplicationStrategy`: 查重策略接口，支持多种查重算法
  - `IFusionContext`: 融合上下文接口，提供融合过程所需的环境信息
- **融合算法实现**：
  - `RRFFusionStrategy`: 基于 Reciprocal Rank Fusion 的融合策略，适用于多源排名融合
  - `WeightedAverageFusionStrategy`: 基于加权平均的融合策略，支持自定义权重配置
  - `NeuralFusionStrategy`: 基于神经网络的融合策略，使用机器学习模型优化结果排序
  - `HybridFusionStrategy`: 混合融合策略，结合多种算法优势
  - `FusionStrategyFactory`: 融合策略工厂，支持动态创建和策略组合
- **查重策略实现**：
  - `ContentHashDeduplication`: 基于内容哈希的精确查重策略
  - `SemanticSimilarityDeduplication`: 基于语义相似度的查重策略，使用向量余弦相似度
  - `PositionContentDeduplication`: 基于文档位置和内容的混合查重策略
  - `FuzzyMatchDeduplication`: 基于模糊匹配的查重策略，处理轻微差异的内容
- **数据结构**：
  - `FusionOptions`: 融合选项配置，包含算法参数、权重设置等
  - `DeduplicationResult`: 查重处理结果，包含去重统计信息
  - `FusionMetrics`: 融合过程指标，用于性能监控和优化

#### 其他领域组件

- `GraphExtractor`：从文本中提取实体关系
- `GraphRepository Interface`：定义图存储抽象接口
- `DTOs with Zod`：共享的数据传输对象及验证模式

> 📌 本层不依赖任何外部框架或数据库实现。

---

### 4.5 基础设施层

具体技术实现：

- `SQLiteRepo`：使用 `better-sqlite3` 实现元数据持久化，支持 FTS5 全文搜索
- `QdrantRepo`：对接 Qdrant 向量数据库，提供向量相似度检索
- `FileLoader`：支持 TXT、Markdown 等纯文本格式加载
- `Splitter`：文本切片策略（按段落/字符/语义）
- `EmbeddingProvider`：调用 OpenAI/HuggingFace 接口生成向量
- `GraphRepo Impl.`：基于内存或 Neo4j 的图存储实现，实现 GraphRepository 接口
- `Winston Logger`：结构化日志输出（控制台 + 文件）

---

## 5. 关键第三方依赖

| 类别       | 技术栈                                         |
| ---------- | ---------------------------------------------- |
| 运行环境   | Node.js 18+, TypeScript 5                      |
| Web 框架   | Express / Koa                                  |
| 数据校验   | Zod, express-zod-openapi（OpenAPI 自动生成）   |
| 向量数据库 | qdrant-client                                  |
| 元数据存储 | better-sqlite3                                 |
| 日志       | Winston                                        |
| 状态机     | xstate                                         |
| 测试       | Jest, supertest（API 测试）, Playwright（E2E） |
| 监控       | prom-client（Prometheus 指标暴露）             |
| 部署       | Docker, docker-compose                         |

---

## 6. 运行时流程

### A. 文件上传流程

```mermaid
sequenceDiagram
    participant UI
    participant API as Controller
    participant ImportService
    participant FileLoader
    participant Splitter
    participant Embedder
    participant QdrantRepo
    participant SQLiteRepo
    participant SyncStateMachine

    UI->>API: POST /upload
    API->>API: Zod 校验
    API->>ImportService: 调用 ImportService
    ImportService->>FileLoader: 加载文件
    ImportService->>Splitter: 切片文本
    Splitter->>Embedder: 生成向量
    Embedder->>QdrantRepo: 写入向量
    ImportService->>SQLiteRepo: 写入元数据
    ImportService->>SyncStateMachine: 触发同步
```

### B. 检索流程

```mermaid
sequenceDiagram
    participant UI
    participant API as Controller
    participant SearchService
    participant SearchCoordinator
    participant CompositeRetriever
    participant SemanticRetriever
    participant KeywordRetriever
    participant GraphRetriever
    participant FusionStrategy
    participant DeduplicationStrategy
    participant QdrantRepo
    participant SQLiteRepo
    participant GraphRepo

    UI->>API: GET /search?q=...
    API->>API: 参数校验
    API->>SearchService: 调用 SearchService
    SearchService->>SearchCoordinator: 执行搜索
    SearchCoordinator->>CompositeRetriever: 并行检索
    par 并行执行多源检索
        CompositeRetriever->>SemanticRetriever: 向量检索
        SemanticRetriever->>QdrantRepo: 查询向量数据库
        QdrantRepo-->>SemanticRetriever: 返回向量结果
        SemanticRetriever-->>CompositeRetriever: RetrievalResult[]
    and
        CompositeRetriever->>KeywordRetriever: 关键词检索
        KeywordRetriever->>SQLiteRepo: 查询元数据
        SQLiteRepo-->>KeywordRetriever: 返回关键词结果
        KeywordRetriever-->>CompositeRetriever: RetrievalResult[]
    and
        CompositeRetriever->>GraphRetriever: 图谱检索
        GraphRetriever->>GraphRepo: 查询图谱数据
        GraphRepo-->>GraphRetriever: 返回图谱结果
        GraphRetriever-->>CompositeRetriever: RetrievalResult[]
    end
    CompositeRetriever-->>SearchCoordinator: 返回统一格式结果(RetrievalResult[])
    SearchCoordinator->>FusionStrategy: 融合多源结果
    FusionStrategy->>DeduplicationStrategy: 执行查重
    DeduplicationStrategy-->>FusionStrategy: 返回去重结果
    FusionStrategy-->>SearchCoordinator: 返回融合结果(UnifiedSearchResult[])
    SearchCoordinator-->>SearchService: 返回最终结果
    SearchService-->>API: 返回结果
    API-->>UI: 响应
```

---

## 7. 日志与监控

- **日志系统**：
  - 使用 Winston 输出至 Console 与日志文件
  - 分级别输出（debug/info/warn/error）
  - 错误日志自动上报至 Sentry

- **监控指标**：
  - 集成 `prom-client`，暴露 `/metrics`
  - 关键指标：
    - QPS（每秒请求数）
    - 平均延迟（P95/P99）
    - SyncJob 当前状态分布（NEW/SYNCED/FAILED）

  - 可视化：Grafana + Prometheus

---

## 8. 向量同步状态机

确保向量库（Qdrant）与元数据（SQLite）最终一致。

```mermaid
stateDiagram-v2
    [*] --> NEW
    NEW --> SPLIT_OK      : chunksSaved()
    SPLIT_OK --> EMBED_OK : vectorsInserted()
    EMBED_OK --> SYNCED   : metaUpdated()
    SPLIT_OK --> FAILED   : error()
    EMBED_OK --> FAILED   : error()
    FAILED --> RETRYING   : retry()
    RETRYING --> SPLIT_OK : chunksSaved()
    RETRYING --> EMBED_OK : vectorsInserted()
    FAILED --> DEAD       : retriesExceeded()
    SYNCED --> [*]
```

> 实现方式：
>
> - 借助 `xstate` 定义状态转移逻辑
> - 持久化在 `SyncJob` 数据表中
> - 异步任务轮询驱动状态演进

---

## 9. 部署与配置

### 部署方案

- 使用 `docker-compose.yml` 编排以下服务：
  - `api`: 主服务容器
  - `qdrant`: 向量数据库
  - `nginx`: 反向代理（可选）

- 支持本地开发与生产环境一键启动

### 配置管理

- 配置项集中于 `.env` 文件：

  ```env
  DB_PATH=./data/app.db
  QDRANT_URL=http://qdrant:6333
  LOG_LEVEL=info
  OPENAI_API_KEY=sk-xxxxxx
  ```

### CI/CD 流程

```yaml
CI Pipeline: Lint → Test (单元 + 集成) → Build → Docker Push → Deploy to Staging → Manual Approve → Prod
```

工具链：GitHub Actions 或 GitLab CI

---

## 10. 未来可扩展点

| 方向              | 描述                                             |
| ----------------- | ------------------------------------------------ |
| 🔹 GraphQL / gRPC | 提供更灵活的查询能力，适用于复杂前端或高性能场景 |
| 🔹 OAuth2 / SSO   | 支持企业级身份认证集成（如 Keycloak、Auth0）     |
| 🔹 多租户隔离     | 按组织划分数据空间，支持 SaaS 化部署             |
| 🔹 OpenTelemetry  | 全链路追踪，提升调试与性能分析效率               |

> 💡 扩展原则：保持核心简洁，通过接口抽象支持插件式扩展。
