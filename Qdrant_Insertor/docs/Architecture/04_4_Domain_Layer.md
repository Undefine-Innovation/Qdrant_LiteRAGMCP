# 4.4 领域层（接口 & 策略）

## 2.1 概述

领域层是系统的核心业务规则所在层，它包含了所有与业务逻辑相关的实体、值对象、聚合、领域服务、仓储接口和领域事件。本层不依赖任何外部框架或数据库实现，保持业务逻辑的纯粹性和独立性，以便于测试和维护。

## 2.2 模块列表

- **Retriever**
- **FusionStrategy**
- **GraphExtractor**
- **GraphRepository Interface**
- **DTOs with Zod**

## 2.3 模块详情

### 2.3.1 Retriever

#### 2.3.1.1 职责

- **统一检索接口**：提供统一的检索接口，抽象不同数据源（Qdrant、SQLite、图谱等）的检索逻辑。
- **多源数据检索**：支持从多个数据源并行获取检索结果，包括向量检索、关键词检索和图谱检索。
- **结果标准化**：将来自不同数据源的检索结果转换为统一的 `RetrievalResult` 格式。
- **检索策略组合**：通过组合模式支持多种检索策略，可灵活配置和扩展。
- **数据源抽象**：为上层应用提供透明的多数据源访问能力，屏蔽底层存储差异。

#### 2.3.1.2 接口与数据流

- **核心接口**：
    - `IRetriever`: 基础检索器接口，定义单一数据源检索能力
    - `ICompositeRetriever`: 组合检索器接口，协调多个检索器并行执行
    - `SearchCoordinator`: 检索与融合协调器，管理组件间数据流
- **数据结构**：
    - `RetrievalResult`: 统一的检索结果格式，支持 chunkResult、graphResult 等多种类型
    - `RetrievalRequest`: 统一的检索请求格式，包含查询参数和检索选项
    - `RetrievalSource`: 检索来源枚举（SEMANTIC、KEYWORD、GRAPH等）
    - `UnifiedSearchResult`: 融合后的最终结果格式
- **数据流**：

    ```mermaid
    graph TD
      SearchService[SearchService] --> SearchCoordinator[SearchCoordinator]
      SearchCoordinator --> CompositeRetriever[CompositeRetriever]

      CompositeRetriever --> SemanticRetriever[SemanticRetriever]
      CompositeRetriever --> KeywordRetriever[KeywordRetriever]
      CompositeRetriever --> GraphRetriever[GraphRetriever]

      SemanticRetriever --> QdrantRepo[QdrantRepo]
      KeywordRetriever --> SQLiteRepo[SQLiteRepo]
      GraphRetriever --> GraphRepo[GraphRepo]

      QdrantRepo -->|RetrievalResult| FusionStrategy[FusionStrategy]
      SQLiteRepo -->|RetrievalResult| FusionStrategy
      GraphRepo -->|RetrievalResult| FusionStrategy

      FusionStrategy --> DeduplicationStrategy[DeduplicationStrategy]
      DeduplicationStrategy -->|UnifiedSearchResult| SearchService
    ```

- **多数据源集成**：
    - 从 Qdrant 获取向量相似度检索结果
    - 从 SQLite FTS5 获取关键词匹配结果
    - 从图数据库获取实体关系检索结果（预留）
    - 统一封装为标准化的 `RetrievalResult` 对象

#### 2.3.1.3 关键实现与技术栈

- **检索器实现**：
    - `SemanticRetriever`: 向量检索器，基于 Qdrant，支持相似度搜索
    - `KeywordRetriever`: 关键词检索器，基于 SQLite FTS5，支持全文搜索
    - `GraphRetriever`: 图谱检索器，基于实体关系查询（预留）
    - `CompositeRetriever`: 组合检索器，协调多个检索器并行执行
    - `SearchCoordinator`: 检索协调器，管理检索流程和结果融合
- **设计模式**：组合模式、策略模式、协调器模式
- **并行检索**：支持多数据源并行检索，使用 Promise.all 提高检索效率
- **统一数据结构设计**：
    - 标准化的结果格式，确保不同数据源返回结果的一致性
    - 灵活的结果类型支持，适应未来扩展需求
    - 元数据完整保留，支持结果溯源和调试

#### 2.3.1.4 开发需求与约定

- **编码规范**：
    - 检索器应专注于单一数据源的检索逻辑，保持职责单一
    - 组合检索器负责协调多个检索器，不包含具体检索实现
    - 所有检索器必须返回统一的 `RetrievalResult` 格式
    - 检索器实现应支持配置化，便于调整检索参数
    - 使用依赖注入模式，提高组件可测试性
- **错误处理**：
    - 捕获底层数据存储的异常，并转换为领域层友好的错误类型
    - 单个检索器失败不应影响其他检索器的执行，实现故障隔离
    - 提供详细的错误信息和上下文，便于问题定位
    - 实现优雅降级机制，在部分数据源不可用时仍能提供基本服务
- **测试策略**：
    - 对每个检索器进行独立单元测试，验证检索逻辑正确性
    - 使用 Mock 对象模拟底层存储，隔离测试检索逻辑
    - 测试组合检索器的并行执行和错误处理能力
    - 集成测试验证多数据源检索的端到端流程
    - 性能测试确保检索响应时间符合预期
- **性能考量**：
    - 实现并行检索，减少总体响应时间
    - 考虑缓存机制以减少重复查询，特别是热门查询
    - 支持检索超时和熔断机制，防止系统雪崩
    - 实现结果分页，避免大数据量查询导致的性能问题
    - 监控检索性能指标，持续优化检索策略

### 2.3.2 FusionStrategy

#### 2.3.2.1 职责

- **多源结果融合**：将来自不同检索源（Qdrant、SQLite、图谱等）的 `RetrievalResult` 进行智能融合，生成最终排序结果。
- **智能查重处理**：识别和处理来自不同数据源的重复内容，基于内容相似度和文档位置进行精确去重，避免结果冗余。
- **策略模式实现**：作为可插拔的策略组件，支持多种融合算法（RRF、加权平均、神经网络融合等），可根据场景动态选择。
- **结果优化与多样性**：通过融合算法优化结果的相关性、多样性和新颖性，提升用户体验。
- **多源协调**：与 SearchCoordinator 紧密协作，管理多源检索结果的融合流程和状态。
- **性能优化**：实现高效的融合算法，支持大规模结果集的实时处理。

#### 2.3.2.2 接口与数据流

- **核心接口**：
    - `IFusionStrategy`: 融合策略基础接口，定义融合方法签名
    - `IDeduplicationStrategy`: 查重策略接口，支持多种查重算法
    - `IFusionContext`: 融合上下文接口，提供融合过程所需的环境信息
- **数据结构**：
    - `FusionOptions`: 融合选项配置，包含算法参数、权重设置等
    - `RetrievalResult[]`: 输入的检索结果数组，来自不同数据源
    - `UnifiedSearchResult`: 融合后的最终结果格式
    - `DeduplicationResult`: 查重处理结果，包含去重统计信息
    - `FusionMetrics`: 融合过程指标，用于性能监控和优化
- **数据流**：
    ```
    SearchCoordinator -> FusionStrategy
                        -> [并行处理] -> DeduplicationStrategy -> [结果合并] -> UnifiedSearchResult[]
                        -> [性能监控] -> FusionMetrics -> SearchCoordinator
    ```
- **多源处理流程**：
    1. 接收来自 SearchCoordinator 的多源检索结果
    2. 根据配置选择合适的融合策略和查重策略
    3. 并行执行查重和融合算法
    4. 生成最终排序结果并返回给 SearchCoordinator
    5. 记录融合过程指标，用于性能监控

#### 2.3.2.3 关键实现与技术栈

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
- **性能优化技术**：
    - 并行计算：使用 Worker Threads 处理大规模结果集
    - 缓存机制：缓存常见查询的融合结果
    - 索引优化：为查重算法建立高效索引结构
- **设计模式**：策略模式、工厂模式、模板方法模式、观察者模式

#### 2.3.2.4 开发需求与约定

- **编码规范**：
    - 融合策略应专注于算法实现，不包含业务逻辑
    - 查重策略应支持自定义合并逻辑和阈值配置
    - 所有策略必须实现统一的接口，确保可插拔性
    - 使用依赖注入模式，提高组件可测试性
    - 策略实现应是幂等的，相同输入应产生相同输出
    - 代码应包含详细注释，说明算法原理和参数含义
- **错误处理**：
    - 处理输入结果为空或格式不正确的情况，提供友好的错误信息
    - 单个策略失败不应影响整个融合流程，实现故障隔离
    - 提供详细的错误日志和上下文信息，便于问题定位
    - 实现优雅降级机制，在策略失败时回退到默认策略
    - 对异常情况进行分类处理，区分可恢复和不可恢复错误
- **测试策略**：
    - 对每个融合策略进行独立单元测试，验证算法正确性
    - 使用 Mock 对象模拟不同数据源的检索结果
    - 测试查重策略的准确性和效率，包括边界情况
    - 验证不同融合算法在各种输入情况下的正确性和性能
    - 集成测试验证端到端的融合流程
    - 性能测试确保融合算法在大数据量下的响应时间
    - A/B 测试验证不同融合策略对用户体验的影响
- **性能考量**：
    - 优化融合算法的时间复杂度，特别是在结果列表较大时
    - 查重算法应支持高效的内容比较和合并，使用合适的数据结构
    - 实现结果分页处理，避免内存溢出
    - 考虑缓存机制以减少重复计算，特别是对于热门查询
    - 监控融合性能指标，持续优化算法参数
    - 支持异步处理，提高系统吞吐量
    - 实现资源池管理，避免频繁创建销毁对象

### 2.3.3 GraphExtractor

#### 2.3.3.1 职责

- **从文本中提取实体关系**：分析原始文本内容，识别实体（Node）和它们之间的关系（Edge），构建 `GraphFragment`。
- **知识图谱构建**：为知识图谱的构建提供基础数据。

#### 2.3.3.2 接口与数据流

- **对外接口**：由 `GraphService` 调用，接收文本内容。
- **对内接口**：无直接对内接口，可能依赖 NLP 工具库。
- **数据流**：GraphService -> GraphExtractor -> GraphService。

#### 2.3.3.3 关键实现与技术栈

- **NLP 技术**：可能使用自然语言处理 (NLP) 库或模型进行实体识别和关系抽取。
- **规则引擎**：可能通过规则或模式匹配来提取特定类型的关系。

#### 2.3.3.4 开发需求与约定

- **编码规范**：
    - 提取逻辑应可配置和扩展，以适应不同类型的文本和知识领域。
- **错误处理**：
    - 处理文本解析失败或无法提取有效关系的情况。
- **测试策略**：
    - 对 `GraphExtractor` 进行单元测试，验证其在不同文本输入下的实体关系提取准确性。
- **性能考量**：
    - 优化文本处理和关系抽取算法的效率。

### 2.3.4 GraphRepository Interface

#### 2.3.4.1 职责

- **定义图存储抽象接口**：为知识图谱的持久化操作提供抽象接口，不关心具体的存储实现。
- **解耦领域层与基础设施层**：确保领域层不直接依赖于特定的图数据库技术。

#### 2.3.4.2 接口与数据流

- **对外接口**：由 `GraphService` 调用，提供图的 CRUD 操作（如保存 `GraphFragment`、查询 `Node` 和 `Edge`）。
- **对内接口**：无直接对内接口，由基础设施层的具体实现来完成。
- **数据流**：GraphService -> GraphRepository Interface -> Infrastructure Layer (GraphRepo Impl.)。

#### 2.3.4.3 关键实现与技术栈

- **接口定义**：使用 TypeScript 接口定义图存储的契约。

#### 2.3.4.4 开发需求与约定

- **编码规范**：
    - 接口定义应清晰、稳定，反映领域模型的概念。
- **错误处理**：
    - 接口方法应定义可能抛出的异常类型。
- **测试策略**：
    - 对接口定义本身无需测试，但其实现类需要进行集成测试。
- **可扩展性**：
    - 接口应易于扩展，以支持未来可能引入的更复杂的图操作。

### 2.3.5 DTOs with Zod

#### 2.3.5.1 职责

- **共享的数据传输对象**：定义在不同层级之间传输数据的结构。
- **验证模式**：结合 Zod 提供数据校验能力，确保数据格式和内容的正确性。
- **统一数据契约**：作为 API 层、应用层和领域层之间的数据契约。

#### 2.3.5.2 接口与数据流

- **对外接口**：作为数据结构在各层之间传递。
- **对内接口**：无。
- **数据流**：API Layer <-> Application Layer <-> Domain Layer。

#### 2.3.5.3 关键实现与技术栈

- **技术栈**：Zod。
- **类型定义**：使用 TypeScript 类型定义 DTO。

#### 2.3.5.4 开发需求与约定

- **编码规范**：
    - DTO 命名应清晰，反映其用途。
    - Zod Schema 应与 DTO 类型保持一致，并包含详细的校验规则。
    - DTO 应保持扁平化，避免过度嵌套。
- **错误处理**：
    - Zod 校验失败时，应返回详细的错误信息。
- **测试策略**：
    - 对 Zod Schema 进行单元测试，验证其校验逻辑的正确性。
- **版本管理**：
    - DTO 的变更应谨慎，并考虑对上下游的影响。

### 2.3.6 🆕 算法抽象与工厂模式

#### 2.3.6.1 职责

- **算法可插拔性**：提供统一的算法接口，支持运行时切换不同的实现。
- **配置驱动**：通过配置文件动态选择和配置算法实现。
- **工厂管理**：统一管理算法实例的创建和生命周期。
- **性能优化**：支持算法实例的缓存和复用。

#### 2.3.6.2 当前实现状态

**已实现功能**：

- ✅ 基础接口抽象 ([`IEmbeddingProvider`](packages/backend/src/domain/embedding.ts:1), [`ISplitter`](packages/backend/src/domain/splitter.ts:1))
- ✅ 依赖注入模式 ([`services.ts`](packages/backend/src/services.ts:60))
- ✅ OpenAI Embedding 实现 ([`OpenAIEmbeddingProvider`](packages/backend/src/infrastructure/OpenAIEmbeddingProvider.ts:1))
- ✅ Markdown Splitter 实现 ([`MarkdownSplitter`](packages/backend/src/infrastructure/MarkdownSplitter.ts:1))

**技术债务**：

- ⚠️ 算法实现种类有限
- ⚠️ 缺乏运行时切换能力
- ⚠️ 配置系统不够灵活
- ⚠️ 没有算法性能监控

#### 2.3.6.3 🔄 计划改进 (B1. 核心算法抽象)

**目标**：实现运行时算法切换，支持多种Embedding和Splitter实现

**改进方案**：

```typescript
// 算法工厂
export class AlgorithmFactory {
    private embeddingProviders: Map<string, () => IEmbeddingProvider>;
    private splitters: Map<string, () => ISplitter>;

    registerEmbeddingProvider(
        name: string,
        factory: () => IEmbeddingProvider,
    ): void {
        this.embeddingProviders.set(name, factory);
    }

    createEmbeddingProvider(config: EmbeddingConfig): IEmbeddingProvider {
        const factory = this.embeddingProviders.get(config.provider);
        if (!factory) {
            throw new Error(`Unknown embedding provider: ${config.provider}`);
        }
        return factory();
    }

    // 运行时切换示例
    switchEmbeddingProvider(newProvider: string): void {
        const currentConfig = this.getConfig();
        currentConfig.provider = newProvider;
        this.saveConfig(currentConfig);

        // 重新创建提供者实例
        this.currentEmbeddingProvider =
            this.createEmbeddingProvider(currentConfig);
    }
}

// 配置驱动的算法选择
interface AlgorithmConfig {
    embedding: {
        provider: "openai" | "huggingface" | "local";
        model: string;
        parameters: Record<string, any>;
    };
    splitter: {
        type: "paragraph" | "semantic" | "fixed";
        chunkSize: number;
        overlap: number;
    };
}
```

**实施步骤**：

1. **工厂模式实现**：创建 `AlgorithmFactory` 和相关工厂类
2. **配置系统设计**：实现算法配置的动态加载和保存
3. **运行时切换**：实现算法的热切换机制
4. **新算法实现**：添加多种Embedding和Splitter实现
5. **性能监控**：添加算法性能指标收集

**预期收益**：

- 支持运行时算法切换，提高系统灵活性
- 便于算法性能对比和优化
- 支持不同场景的算法选择
- 降低算法切换的成本和风险

#### 2.3.6.4 开发需求与约定

- **编码规范**：
    - 算法接口应保持稳定，避免频繁变更
    - 新算法实现必须遵循统一接口
    - 配置参数应有明确的文档说明
- **错误处理**：
    - 算法切换失败时应回退到默认实现
    - 记录算法切换和错误日志
- **测试策略**：
    - 对每个算法实现进行独立测试
    - 测试算法切换的正确性和性能
    - 验证配置系统的可靠性
- **性能考量**：
    - 监控算法执行性能
    - 实现算法实例的缓存和复用
    - 优化算法切换的响应时间
