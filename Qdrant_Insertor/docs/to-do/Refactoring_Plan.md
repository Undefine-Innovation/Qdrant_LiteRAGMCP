# 重构计划：分层架构迁移

本重构计划旨在将现有项目从紧耦合的 API 层重构为遵循分层架构（API 层、应用层、领域层、基础设施层）的模块化系统。

## 目标：

*   提高代码的可维护性、可测试性和可扩展性。
*   明确各层职责，降低模块耦合度。
*   引入统一的 DTO 验证和错误处理机制。

## 重构步骤：

### 1. 定义 DTOs 和 Zod Schemas

为所有 API 请求和响应定义 Zod Schema，并将其放置在 `backend/contracts/` 目录下。

**子任务：**

*   [ ] 为 Collection 相关的请求和响应定义 Zod Schema。
*   [ ] 为 Version 相关的请求和响应定义 Zod Schema。
*   [ ] 为 Document 相关的请求和响应定义 Zod Schema。
*   [ ] 为 Search 相关的请求和响应定义 Zod Schema。

### 2. 实现 DTO 验证中间件

创建一个通用的 Express 中间件，用于接收 Zod Schema 并对 `req.body`, `req.query`, `req.params` 进行验证。

**子任务：**

*   [ ] 创建 `backend/src/middlewares/validate.ts` 文件。
*   [ ] 实现 `validate` 中间件，接收 Zod Schema 作为参数。
*   [ ] 验证失败时，使用 `AppError` 抛出 `VALIDATION_ERROR`，并设置 `422 Unprocessable Entity` 状态码。

### 3. 重构错误处理机制

统一错误响应格式，并确保所有错误都通过全局错误处理中间件进行处理。

**子任务：**

*   [ ] 完善 [`backend/contracts/error.ts`](backend/contracts/error.ts) 中的 `AppError` 和 `ErrorCode` 定义。
*   [ ] 修改全局错误处理中间件，使其能够识别 `AppError` 并返回结构化的错误响应。
*   [ ] 确保所有路由处理函数中的 `catch` 块都使用 `next(e)` 将错误传递给全局错误处理中间件。

### 4. 抽象基础设施层 (Infrastructure Layer)

将 `db.ts`, `qdrant.ts`, `embedding.ts`, `splitter.ts` 封装为遵循新架构原则的 Repository 或 Provider。

**子任务：**

*   [ ] **`SQLiteRepo`**: 将 [`backend/src/db.ts`](backend/src/db.ts) 重构为 `backend/src/infrastructure/SQLiteRepo.ts`，并提供统一的接口。
*   [ ] **`QdrantRepo`**: 将 [`backend/src/qdrant.ts`](backend/src/qdrant.ts) 重构为 `backend/src/infrastructure/QdrantRepo.ts`，并提供统一的接口。
*   [ ] **`EmbeddingProvider`**: 将 [`backend/src/embedding.ts`](backend/src/embedding.ts) 重构为 `backend/src/infrastructure/EmbeddingProvider.ts`，并提供统一的接口。
*   [ ] **`Splitter`**: 将 [`backend/src/splitter.ts`](backend/src/splitter.ts) 重构为 `backend/src/infrastructure/Splitter.ts`，并提供统一的接口。
*   [ ] **`FileLoader`**: 创建 `backend/src/infrastructure/FileLoader.ts`，用于加载不同格式的文档。

### 5. 创建领域层组件 (Domain Layer)

将核心业务规则和策略抽象为独立的组件。

**子任务：**

*   [ ] **`Retriever`**: 从 [`search.ts`](backend/src/search.ts) 中提取检索逻辑，创建 `backend/src/domain/Retriever.ts`。
*   [ ] **`FusionStrategy`**: 从 [`search.ts`](backend/src/search.ts) 中提取结果融合逻辑，创建 `backend/src/domain/FusionStrategy.ts`。
*   [ ] **`GraphExtractor`**: (可选，根据需求) 创建 `backend/src/domain/GraphExtractor.ts`。

### 6. 创建应用层服务 (Application Layer)

将复杂的业务流程封装到 Application Layer 的 Service 类中，作为协调者。

**子任务：**

*   [ ] **`ImportService`**: 创建 `backend/src/application/ImportService.ts`，封装文档导入（创建/更新）的完整流程。
*   [ ] **`SearchService`**: 创建 `backend/src/application/SearchService.ts`，封装检索逻辑调用。
*   [ ] **`CollectionService`**: 完善 [`backend/src/services/CollectionService.ts`](backend/src/services/CollectionService.ts)，使其调用 `SQLiteRepo`。
*   [ ] **`VersionService`**: 完善 [`backend/src/services/VersionService.ts`](backend/src/services/VersionService.ts)，使其调用 `SQLiteRepo`。
*   [ ] **`DocumentService`**: 创建 `backend/src/application/DocumentService.ts`，封装文档的简单 CRUD 操作。
*   [ ] **`SyncStateMachine`**: 创建 `backend/src/application/SyncStateMachine.ts`，驱动向量与元数据同步流程。
*   [ ] **`AutoGC`**: 创建 `backend/src/application/AutoGC.ts`，负责兜底、修补及清理历史垃圾。

### 7. 重构 `api.ts` (Controllers)

更新 [`backend/src/api.ts`](backend/src/api.ts)，使其使用新的 DTO 验证中间件、统一错误处理，并只调用应用层服务。

**子任务：**

*   [ ] 移除 [`api.ts`](backend/src/api.ts) 中所有直接对基础设施层模块的导入和调用。
*   [ ] 将所有路由处理函数精简为只负责解包参数、调用应用层服务、封装响应。
*   [ ] 引入 DTO 验证中间件到相应的路由。