# 当前工程进度与已实现功能

## 1. 核心架构组件与模块

本项目已初步搭建起基于 Qdrant 和 SQLite 的 RAG 系统，并实现了以下核心组件：

*   **REST API 服务 (`backend/src/api.ts`)**:
    *   已实现 Collection、Version、Document 的 CRUD 接口。
    *   已实现混合搜索接口。
    *   作为系统的对外接口，处理外部客户端的请求。
*   **文档加载与分割 (`backend/src/loader.ts`, `backend/src/splitter.ts`)**:
    *   `loader.ts` 负责从文件系统加载 `.md` 和 `.txt` 文档。
    *   `splitter.ts` 支持按 Markdown 标题、固定大小和句子进行文档分割，并保留 `titleChain` 等上下文元数据。
*   **向量化服务 (`backend/src/embedding.ts`)**:
    *   封装了 OpenAI 兼容的 API，用于将文本块转换为高维向量。
    *   支持批量文本的向量化请求。
*   **Qdrant 向量数据库 (`backend/src/qdrant.ts`)**:
    *   负责与 Qdrant 向量数据库的交互，包括集合的创建、向量的 upsert (插入/更新) 和搜索。
    *   支持 `payload` 过滤。
*   **SQLite 元数据数据库 (`backend/src/db.ts`)**:
    *   作为核心元数据存储，管理 Collection、Version、Doc、ChunkMeta 的结构化信息。
    *   提供 FTS5 全文索引以支持关键词搜索。
    *   实现了 Collection、Version、Doc、ChunkMeta 的 CRUD 操作。
*   **搜索服务 (`backend/src/search.ts`)**:
    *   实现了混合搜索功能，结合 SQLite FTS5 的关键词搜索和 Qdrant 的语义搜索。
    *   通过 RRF (Reciprocal Rank Fusion) 算法融合搜索结果。
*   **配置管理 (`backend/src/config.ts`)**:
    *   集中管理系统运行所需的各项配置参数，如 Qdrant 地址、OpenAI API Key 等。

## 2. 核心概念与实体关系

系统围绕 **Collection → Version → Doc → Chunk** 的层次结构组织数据，并通过统一的 ID 方案进行关联。

*   **Collection**: 文档的逻辑分组。
*   **Version**: Collection 的一个版本，包含一组文档。
*   **Doc**: 单个文档，包含原始内容和元数据。
*   **Chunk**: 文档分割后的文本块，带有向量和元数据。

## 3. 文档处理流程

已实现从用户提供原始文档到最终入库的完整流程：

1.  **文档加载**: 通过 `loader.ts` 从指定目录加载文档。
2.  **文档分割**: 通过 `splitter.ts` 将文档内容分割成多个 `DocumentChunk`。
3.  **向量化**: 通过 `embedding.ts` 将每个 `DocumentChunk` 的内容转换为高维向量。
4.  **数据入库**: 将 `CHUNK_META` 和 `CHUNKS_FTS5` 数据插入 SQLite，并将向量数据和 `payload` 插入 Qdrant。
5.  **版本管理**: 支持创建临时 Version、生成最终 VersionId 并进行去重。

## 4. 搜索机制

已实现双通道混合搜索机制：

*   **关键词搜索 (FTS5)**: 利用 SQLite 的 FTS5 扩展进行全文检索。
*   **语义搜索 (Qdrant)**: 将用户查询向量化后，在 Qdrant 向量数据库中进行向量相似度搜索。
*   **RRF (Reciprocal Rank Fusion) 融合**: 融合关键词搜索和语义搜索的结果。
*   **条件查询**: 支持通过 `filters` 参数进行条件过滤。

## 5. ID 生成与管理策略

系统采用统一的 ID 方案 (`collectionId`, `docId`, `versionId`, `pointId`) 来确保数据的一致性和可追溯性。

## 6. 当前工程进度总结

*   **核心功能已实现**: 文档的摄取、存储、搜索等核心功能已基本实现。
*   **模块化初步**: 各个功能模块（loader, splitter, embedding, qdrant, db, search）已独立实现。
*   **API 接口**: 提供了基本的 REST API 接口供前端和外部系统调用。
*   **后台处理**: `index.ts` 中包含了文档的周期性后台处理逻辑。
