# AutoGC 模块设计

本文档详细描述了 `AutoGC`（自动垃圾回收）模块的设计，包括其职责、工作机制、配置参数以及幂等性保证。`AutoGC` 模块旨在作为兜底机制，定期扫描并清理 Qdrant 向量数据库与 SQLite 元数据存储之间可能存在的不一致数据，确保系统的最终一致性。

## 1. 职责与目标

- **数据一致性维护**：核心目标是确保 Qdrant 和 SQLite 之间的数据最终一致。
- **清理孤儿数据**：识别并删除在 Qdrant 中存在但 SQLite 中已不存在的向量，或在 SQLite 中存在但 Qdrant 中已不存在的元数据。
- **修补不一致**：在发现数据不一致时，尝试进行修补，例如重新同步缺失的数据。
- **兜底机制**：作为 `SyncStateMachine` 的补充，处理因各种异常情况导致的数据不一致。

## 2. 工作机制：双端比对 (Level-2)

`AutoGC` 采用 **Level-2：双端比对** 策略，通过以下步骤实现数据一致性检查和清理：

1.  **快照维护**：
    - `AutoGC` 模块会维护一张 `chunk_checksums` 快照表（存储在 SQLite 中）。
    - 这张表记录了每个 `Chunk` 的 `pointId`、`docId`、`collectionId` 和 `checksum`（通常是 `contentHash`）。
    - 在 `ImportService` 成功处理 `Chunk` 并写入 SQLite 和 Qdrant 后，会更新或插入对应的 `chunk_checksums` 记录。
2.  **定期扫描**：
    - `AutoGC` 会按照预设的 Cron 表达式定时启动。
    - 它会从 `chunk_checksums` 表中读取所有有效的 `pointId` 列表。
    - 同时，它会查询 Qdrant 数据库，获取所有存在的向量点的 `pointId` 列表。
3.  **数据比对与清理**：
    - **清理 Qdrant 中的孤儿向量**：比对 Qdrant 中存在的 `pointId` 列表与 `chunk_checksums` 表中的 `pointId` 列表。如果某个 `pointId` 存在于 Qdrant 但不存在于 `chunk_checksums` 表（或对应的 `doc` 已被软删除），则认为该向量是孤儿向量，将其从 Qdrant 中删除。
    - **清理 SQLite 中的无关元数据**：比对 `chunk_checksums` 表中的 `pointId` 列表与 Qdrant 中存在的 `pointId` 列表。如果某个 `pointId` 存在于 `chunk_checksums` 表但不存在于 Qdrant，则认为对应的元数据是无关元数据，将其从 `chunks` 表和 `chunk_checksums` 表中删除。
    - **修补缺失数据**：如果发现 `chunk_checksums` 表中的 `checksum` 与 `chunks` 表中的 `contentHash` 不一致，或者 Qdrant 中的 `payload` 与 SQLite 中的元数据不一致，`AutoGC` 可以尝试重新触发该 `Chunk` 的同步流程（例如，通过创建一个新的 `SyncJob`）。

## 3. 配置参数

`AutoGC` 模块的配置项通常通过环境变量或配置文件进行管理：

- **`AUTO_GC_CRON_EXPRESSION`**：Cron 表达式，定义 `AutoGC` 任务的执行频率。
  - 示例：`0 0 * * *` (每天凌晨 0 点执行)
- **`AUTO_GC_BATCH_SIZE`**：每次比对和清理操作的批量大小。
  - 示例：`1000` (每次处理 1000 个 `Chunk`)
- **`AUTO_GC_ENABLE`**：是否启用 `AutoGC` 模块。
  - 示例：`true` / `false`

## 4. 幂等性保证

`AutoGC` 模块的设计应确保其操作是幂等的，即多次执行相同操作产生的结果与执行一次相同操作的结果相同。

- **删除操作的幂等性**：删除孤儿向量或无关元数据时，即使重复执行删除命令，也不会导致错误或意外结果，因为目标数据要么已被删除，要么不存在。
- **比对操作的幂等性**：数据比对操作本身是只读的，不会改变系统状态。
- **修补操作的幂等性**：如果修补操作涉及到重新触发同步任务，需要确保 `SyncStateMachine` 能够处理重复触发的情况，例如通过检查 `SyncJob` 的现有状态来避免重复处理。
- **日志记录**：详细的日志记录有助于追踪 `AutoGC` 的执行过程，并在出现问题时进行排查。
