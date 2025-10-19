# 后端重构完成总结：当前架构与已实现功能

## 1. 核心架构概览与分层设计

本项目已成功完成后端重构，全面采纳了清晰、可维护、可扩展的**分层架构**。系统现在严格遵循 API 层、应用层、领域层和基础设施层的职责划分。

### 1.1 总体架构目标与实现

*   **架构极简，模块清晰**：通过严格的分层和依赖注入，消除了模块间的高耦合，每个模块职责单一。
*   **算法可插拔**：`EmbeddingProvider`、`Splitter` 等核心算法组件现在通过领域接口抽象，易于替换和扩展。
*   **数据一致性**：引入 `SyncStateMachine` 和 `AutoGCService`，确保 Qdrant 向量数据库与 SQLite 元数据存储的最终一致性。
*   **统一、易用 API**：API 层作为纯粹的控制器，结合 Zod 进行请求校验和统一错误处理，并支持自动生成 OpenAPI 文档。

### 1.2 各分层核心组件与职责

#### 1.2.1 API 层 (Controller)

*   **职责**：作为系统的对外接口，接收 HTTP 请求，进行参数校验，调用应用服务，并封装响应。
*   **主要功能**：
    *   基于 Express 框架，提供 Collection、Document 的 CRUD 接口，以及混合搜索接口。
    *   集成 Zod 进行请求体和查询参数的严格校验。
    *   通过全局错误处理中间件统一捕获和响应错误，无业务逻辑和 `try...catch` 块。
    *   通过依赖注入接收所有必要的应用服务实例。

#### 1.2.2 应用层 (Application Services)

*   **职责**：协调业务流程，封装高层业务逻辑，不包含核心领域规则。
*   **主要服务**：
    *   **`ImportService`**：处理文档导入的全流程，包括文件加载、分割、向量化、元数据和向量入库。
    *   **`SearchService`**：封装混合搜索逻辑，协调 `EmbeddingProvider`、`SQLiteRepo` 和 `QdrantRepo` 进行关键词和语义搜索，并使用 RRF 算法融合结果。
    *   **`CollectionService`**：管理 Collection 的 CRUD 操作。
    *   **`DocumentService`**：管理 Document 的 CRUD 操作，并协调 `ImportService` 进行文档内容的更新。
    *   **`GraphService`**：作为知识图谱能力的预留接口，目前提供基础实现。
    *   **`SyncStateMachine`**：驱动向量与元数据同步流程，确保 Qdrant 和 SQLite 之间的数据一致性。
    *   **`AutoGCService`**：负责自动垃圾回收，定期扫描并清理孤儿向量和废弃元数据，维护数据健康。

#### 1.2.3 领域层 (Domain Layer)

*   **职责**：定义核心业务规则、实体、值对象和接口，不依赖任何外部框架或数据库实现。
*   **核心组件**：
    *   **接口定义**：`IFileLoader`, `ISplitter`, `IEmbeddingProvider`, `IQdrantRepo`, `ICollectionService`, `IDocumentService`, `ISearchService`, `IGraphService` 等，为基础设施层提供抽象契约。
    *   **DTOs (Data Transfer Objects)**：使用 Zod 定义数据传输对象，确保数据结构的一致性和验证。
    *   **核心实体**：`Collection`, `Doc`, `Chunk` 等领域模型。

#### 1.2.4 基础设施层 (Infrastructure Layer)

*   **职责**：提供具体的技术实现，对接外部系统和持久化存储。
*   **主要实现**：
    *   **`SQLiteRepo`**：基于 `better-sqlite3` 实现，作为元数据持久化仓库。内部包含 `CollectionsTable`, `DocsTable`, `ChunkMetaTable`, `ChunksFts5Table` 等 DAO (Data Access Object) 类，并集中管理 SQL 语句。
    *   **`QdrantRepo`**：对接 Qdrant 向量数据库，负责向量的 upsert 和搜索。
    *   **`OpenAIEmbeddingProvider`**：封装 OpenAI 兼容的 Embedding API 调用，实现文本向量化。
    *   **`MarkdownSplitter`**：实现文档分割策略。
    *   **`LocalFileLoader`**：从本地文件系统加载文档。
    *   **`Logger`**：基于 Winston 实现结构化、分级别的日志输出。

## 2. 核心概念与实体关系

系统围绕 **Collection → Doc → Chunk** 的层次结构组织数据，并通过统一的 ID 方案进行关联。**原有的 `Version` 概念已被移除**，以简化文档更新流程和用户体验。

*   **Collection**: 文档的逻辑分组。
*   **Doc**: 单个文档，包含原始内容和元数据。
*   **Chunk**: 文档分割后的文本块，带有向量和元数据。

## 3. 文档处理流程 (重构后)

从用户提供原始文档到最终入库的完整流程现在由 `ImportService` 协调：

1.  **文件上传/提供原始文档**：API 层接收请求。
2.  **`ImportService` 协调**：
    *   调用 `LocalFileLoader` 加载文档内容。
    *   调用 `MarkdownSplitter` 将文档内容分割成多个 `DocumentChunk`。
    *   调用 `OpenAIEmbeddingProvider` 将每个 `DocumentChunk` 的内容转换为高维向量。
    *   调用 `SQLiteRepo` 将 `CHUNK_META` 和 `CHUNKS_FTS5` 数据插入 SQLite。
    *   调用 `QdrantRepo` 将向量数据和 `payload` 插入 Qdrant。
    *   触发 `SyncStateMachine` 确保数据一致性。

## 4. 搜索机制 (重构后)

双通道混合搜索机制现在由 `SearchService` 封装和协调：

1.  **用户查询**：API 层接收查询请求。
2.  **`SearchService` 协调**：
    *   调用 `OpenAIEmbeddingProvider` 将用户查询向量化。
    *   并行调用 `SQLiteRepo` (FTS5) 进行关键词搜索。
    *   调用 `QdrantRepo` 进行语义搜索。
    *   使用 RRF (Reciprocal Rank Fusion) 算法融合关键词和语义搜索结果。
    *   应用额外的过滤条件。
    *   返回 `UnifiedSearchResult`。

## 5. ID 生成与管理策略

系统采用统一的 ID 方案 (`collectionId`, `docId`, `pointId`) 来确保数据的一致性和可追溯性。`versionId` 概念已移除。

## 6. 后端重构总结

本次后端重构取得了显著成果：

*   **清晰的分层架构**：项目现在拥有明确的 API、应用、领域和基础设施层，大大提高了代码的可读性、可维护性和可测试性。
*   **高内聚低耦合**：通过依赖注入和接口抽象，模块间的耦合度显著降低，易于替换和扩展。
*   **服务化**：核心业务逻辑被封装在独立的、职责单一的应用服务中。
*   **数据一致性保障**：`SyncStateMachine` 和 `AutoGCService` 的引入，有效解决了向量数据库与元数据存储之间的数据一致性问题。
*   **规范化**：统一的 DTOs、错误处理机制、JSDoc 和中文注释规范，提升了代码质量和团队协作效率。
*   **`Version` 概念的移除**：简化了文档管理流程，提升了用户体验。

至此，后端重构已全面完成，项目已具备一个健壮、灵活且易于扩展的基础架构。
