# Qdrant Payload 字段与意义

本文档描述了存储在 Qdrant 向量数据库中的每个向量点所附带的 `payload` 字段的结构和意义。这些 `payload` 字段用于在向量搜索时进行过滤和结果聚合。

## 1. Payload 结构

每个 Qdrant 向量点都将包含以下 `payload` 字段：

```json
{
  "pointId": "string",         // 向量点 ID，对应 SQLite 中的 chunks.point_id
  "docId": "string",           // 所属文档 ID，对应 SQLite 中的 docs.id
  "collectionId": "string",    // 所属集合 ID，对应 SQLite 中的 collections.id
  "chunkIndex": "integer",     // 文本块在文档中的索引
  "titleChain": "string",      // 文本块的标题链，表示其上下文
  "content": "string",         // 文本块的原始内容（可选，用于直接返回内容，避免回表）
  "contentHash": "string",     // 文本块内容的 SHA256 哈希值
  "createdAt": "integer"       // 文本块创建时间戳
}
```

## 2. 字段语义表

| 字段名         | 类型      | 描述                                         | 备注                                                         |
| :------------- | :-------- | :------------------------------------------- | :----------------------------------------------------------- |
| `pointId`      | `string`  | **向量点 ID**。唯一标识 Qdrant 中的一个向量点，其值与 SQLite 中 `chunks` 表的 `point_id` 字段保持一致。格式为 `docId#chunkIndex`。 | 用于在 Qdrant 和 SQLite 之间进行关联。                       |
| `docId`        | `string`  | **所属文档 ID**。该向量点所属文档的唯一标识符，对应 SQLite 中 `docs` 表的 `id` 字段。 | 用于按文档过滤或聚合搜索结果。                               |
| `collectionId` | `string`  | **所属集合 ID**。该向量点所属集合的唯一标识符，对应 SQLite 中 `collections` 表的 `id` 字段。 | 用于按集合过滤搜索结果。                                     |
| `chunkIndex`   | `integer` | **文本块索引**。文本块在原始文档中的顺序索引。 | 用于在检索结果中重建文档结构或排序。                         |
| `titleChain`   | `string`  | **标题链**。表示文本块的上下文信息，例如 Markdown 文档中的章节标题路径。 | 有助于理解文本块的来源和主题。                               |
| `content`      | `string`  | **文本块原始内容**。该文本块的完整文本内容。 | **可选**。如果 Qdrant 中存储了 `content`，则在检索时可以直接返回，避免再次查询 SQLite。但会增加 Qdrant 的存储负担。 |
| `contentHash`  | `string`  | **文本块内容的哈希值**。用于快速比对文本块内容是否发生变化。 | SHA256 哈希值。                                              |
| `createdAt`    | `integer` | **创建时间戳**。文本块被创建的时间。         | Unix timestamp。                                             |

## 3. 使用场景

*   **Payload 过滤**：在 Qdrant 向量搜索时，可以使用 `payload` 字段进行精确过滤，例如只搜索特定 `docId` 或 `collectionId` 下的文本块。
*   **结果聚合**：在检索结果中，`docId` 和 `chunkIndex` 可以帮助客户端将相关的文本块聚合回原始文档的上下文。
*   **数据一致性检查**：`pointId` 和 `contentHash` 可以辅助 `AutoGC` 模块进行 Qdrant 和 SQLite 之间的数据一致性比对。