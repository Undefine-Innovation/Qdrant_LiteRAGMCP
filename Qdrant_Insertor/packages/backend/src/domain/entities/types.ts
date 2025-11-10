// ---------------------------------------------
// 基础 & Brand ID（编译期更安全）
// ---------------------------------------------
// DEPRECATED: Version concept has been removed from the architecture
/**
 *
 */
type Brand<T, B extends string> = T & { __brand: B };

/**
 *
 */
export type CollectionId = Brand<string, 'CollectionId'>;
/**
 *
 */
export type DocId = Brand<string, 'DocId'>;
/**
 *
 */
export type PointId = Brand<string, 'PointId'>;

// ---------------------------------------------
// 领域实体（与数据�?存储结构一致，API 层也复用�?
// 注意：布尔字段在 DB 中是 0/1，这里用 boolean 做统一抽象
// ---------------------------------------------
/**
 *
 */
export interface Collection {
  id?: CollectionId; // 可选，由数据库自动生成
  collectionId?: CollectionId; // 向后兼容字段
  name: string; // 在应用层使用CollectionName值对象，这里保持字符串以兼容数据库层
  description?: string;
  is_system?: boolean; // 添加is_system字段
  created_at?: number; // epoch ms
  updated_at?: number; // 添加updated_at字段
  docs?: unknown[]; // 添加docs字段
  chunkMetas?: unknown[]; // 添加chunkMetas字段
}

/**
 * Doc 注意事项�?
 * - 你的 docs 表并没有 content 字段；content 实际上只�?创建/更新时的输入载荷"里出现，
 *   之后被拆�?chunks 中。为避免误导，这里把 content 标为可选，并在 DTO 中单独定义�?
 */
export interface Doc {
  id?: DocId; // 改为可选，由数据库自动生成
  collectionId: CollectionId;
  key: string;
  name?: string;
  size_bytes?: number;
  mime?: string;
  content_hash?: string; // 添加content_hash字段
  created_at?: number;
  updated_at?: number;
  is_deleted?: boolean;
  status?: string; // 添加status字段

  // 非持久化字段：仅在createDoc 返回值里你把源内容回传了
  content?: string; // 在应用层使用DocumentContent值对象，这里保持字符串以兼容数据库层

  // 向后兼容字段
  docId?: DocId; // 向后兼容，实际使用id字段
}

/** chunk_meta +（非持久化）回表得到的文本*/
export interface ChunkMeta {
  pointId: PointId;
  id: DocId; // 改为id字段以匹配数据库实体
  docId: DocId; // 向后兼容字段
  collectionId: CollectionId;
  chunkIndex: number;
  titleChain?: string;
  contentHash?: string;
  created_at: number;
}

/**
 *
 */
export interface ChunkTextRow {
  pointId: PointId;
  content: string;
  title?: string;
}

/** 聚合后的 Chunk（元数据 + 文本�?*/
export interface Chunk extends ChunkMeta {
  content: string; // 在应用层使用ChunkContent值对象，这里保持字符串以兼容数据库层
  title?: string;
}

/**
 *
 */
export interface ChunkWithVector extends ChunkMeta {
  content: string; // The text content of the chunk. 在应用层使用ChunkContent值对象
  source?: string; // The source of the chunk, e.g., file path.
  vector: number[]; // embedding 向量. 在应用层使用EmbeddingVector值对象
}

// ---------------------------------------------
// 搜索相关
// ---------------------------------------------
/**
 *
 */
export interface SearchFilters {
  docId?: DocId;
  collectionId?: CollectionId;
  chunkIndex?: number;
  // 如需扩展：时间范围、标题链匹配等都可以继续�?
}

/**
 *
 */
export interface SearchRequest {
  query: string;
  collectionId?: CollectionId;
  limit?: number;
  filters?: SearchFilters;
}

/**
 *
 */
export interface SearchResult {
  pointId: PointId;
  content: string;
  title?: string;
  docId: DocId;
  chunkIndex: number;
  collectionId?: CollectionId;
  titleChain?: string;
  score?: number; // RRF 融合后可回传
}

/** 与你前端里用的名称对齐（只是别名，保持兼容） */
export type UnifiedSearchResult = SearchResult;

// ---------------------------------------------
// 拆分策略（splitter.ts�?
/**
 * Represents a chunk of a document produced by a splitter.
 * It's a transient object before being persisted as a Chunk.
 * 表示由分割器生成的文档块�?
 * 在作为块持久化之前，它是一个瞬态对象�?
 */
export interface DocumentChunk {
  content: string; // The text content of the chunk. / 文本块的内容�?
  titleChain?: string[]; // The hierarchy of titles leading to this chunk. / 指向此块的标题层次结构�?
}

// ---------------------------------------------
/**
 *
 */
export type SplitStrategy =
  | 'markdown_headings'
  | 'fixed_window'
  | 'by_sentence';

/**
 *
 */
export interface SplitOptions {
  strategy: SplitStrategy;
  // fixed_window 参数
  windowSize?: number; // 例如 500
  overlap?: number; // 例如 50
  // markdown 标题截断深度
  maxHeadingDepth?: number;
}

// ---------------------------------------------
// Qdrant 相关 payload（向量库的载荷契约）
// ---------------------------------------------
/**
 *
 */
export interface QdrantPointPayload {
  pointId: PointId;
  docId: DocId;
  collectionId: CollectionId;
  chunkIndex: number;
  titleChain?: string;
  contentHash?: string;

  // 为了"快速预�?常会放一点文本，但注意别放过�?
  content?: string;
  title?: string;
}

/**
 *
 */
export interface QdrantSearchHit {
  id: PointId;
  score: number;
  payload: QdrantPointPayload;
}

// ---------------------------------------------
// API DTO（请�?响应�?
// ---------------------------------------------
// Collections
/**
 *
 */
export interface CreateCollectionRequest {
  name: string; // 在应用层使用CollectionName值对象验证
  description?: string;
}
/**
 *
 */
export type CreateCollectionResponse = Collection;
/**
 *
 */
export type ListCollectionsResponse = Collection[];
/**
 *
 */
export type GetCollectionResponse = Collection;

// Docs
/**
 *
 */
export interface CreateDocRequest {
  collectionId: CollectionId;
  key: string;
  content: string | Uint8Array; // 输入载荷里才�?content，在应用层使用DocumentContent值对象验证
  name?: string;
  mime?: string;
  splitOptions?: SplitOptions;
  metadata?: Record<string, unknown>;
}
/**
 *
 */
export type CreateDocResponse = Doc;

/**
 *
 */
export type ListDocsResponse = Doc[];
/**
 *
 */
export type GetDocResponse = Doc;

/**
 *
 */
export interface UpdateDocRequest {
  content: string | Uint8Array; // 在应用层使用DocumentContent值对象验证
  name?: string;
  mime?: string;
  splitOptions?: SplitOptions;
  metadata?: Record<string, unknown>;
}
/**
 *
 */
export type UpdateDocResponse = Doc;

// Search
/**
 *
 */
export type SearchResponse = UnifiedSearchResult[];

// RetrievalResultDTO - 符合OpenAPI规范的搜索结果结�?
/**
 *
 */
export type RetrievalResultType = 'chunkResult' | 'graphResult';

/**
 *
 */
export interface RetrievalResultDTO {
  type: RetrievalResultType;
  score: number;
  content: string;
  metadata: Record<string, unknown>;
}

// ---------------------------------------------
// 分页/通用响应
// ---------------------------------------------
/**
 *
 */
export interface PaginationQuery {
  page?: number; // 1-based, 默认�?
  limit?: number; // 每页数量，默认为20，最大值为100
  sort?: string; // 排序字段（可选）
  order?: 'asc' | 'desc'; // 排序方向，asc或desc（可选）
}

/**
 *
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 *
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

// 保持向后兼容的旧接口
/**
 *
 */
export interface PageQuery {
  page?: number; // 1-based
  pageSize?: number; // 默认 20
}
/**
 *
 */
export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
}
/**
 *
 */
export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

// ---------------------------------------------
// 统计与健康检�?
// ---------------------------------------------
/**
 *
 */
export interface Stats {
  collections: number;
  docs: number;
  chunks: number;
}

/**
 *
 */
export interface Health {
  ok: boolean;
}
