// ---------------------------------------------
// 基础 & Brand ID（编译期更安全）
// ---------------------------------------------
type Brand<T, B extends string> = T & { __brand: B };

export type CollectionId = Brand<string, 'CollectionId'>;
export type VersionId    = Brand<string, 'VersionId'>;
export type DocId        = Brand<string, 'DocId'>;
export type PointId      = Brand<string, 'PointId'>;

// ---------------------------------------------
// 枚举 / 常量
// ---------------------------------------------
export type VersionStatus =
  | 'PENDING'
  | 'EDITING'
  | 'ACTIVE'
  | 'INDEXED_SQLITE'
  | 'INDEXED_QDRANT'
  | 'FAILED';

// ---------------------------------------------
// 领域实体（与数据库/存储结构一致，API 层也复用）
// 注意：布尔字段在 DB 中是 0/1，这里用 boolean 做统一抽象
// ---------------------------------------------
export interface Collection {
  collectionId: CollectionId;
  name: string;
  description?: string;
  created_at: number; // epoch ms
}

export interface Version {
  versionId: VersionId;
  collectionId: CollectionId;
  name?: string;
  description?: string;
  status: VersionStatus | string; // 保持与现有 DB 兼容，推荐尽快收敛到 VersionStatus
  is_current?: boolean;
  created_at: number;
  updated_at?: number;
}

/**
 * Doc 注意事项：
 * - 你的 docs 表并没有 content 字段；content 实际上只在“创建/更新时的输入载荷”里出现，
 *   之后被拆到 chunks 中。为避免误导，这里把 content 标为可选，并在 DTO 中单独定义。
 */
export interface Doc {
  docId: DocId;
  versionId: VersionId;
  collectionId: CollectionId; // 你在 JOIN versions 时会回带
  key: string;
  name?: string;
  size_bytes?: number;
  mime?: string;
  created_at: number;
  updated_at?: number;
  is_deleted?: boolean;

  // 非持久化字段：仅在 createDoc 返回值里你把源内容回传了
  content?: string;
}

/** chunk_meta +（非持久化）回表得到的文本 */
export interface ChunkMeta {
  pointId: PointId;
  docId: DocId;
  versionId: VersionId;
  collectionId: CollectionId;
  chunkIndex: number;
  titleChain?: string;
  contentHash?: string;
  created_at: number;
}

export interface ChunkTextRow {
  pointId: PointId;
  content: string;
  title?: string;
}

/** 聚合后的 Chunk（元数据 + 文本） */
export interface Chunk extends ChunkMeta {
  content: string;
  title?: string;
}

export interface ChunkWithVector extends Chunk {
  vector: number[]; // embedding 向量
}

// ---------------------------------------------
// 搜索相关
// ---------------------------------------------
export interface SearchFilters {
  versionId?: VersionId;
  docId?: DocId;
  collectionId?: CollectionId;
  chunkIndex?: number;
  status?: VersionStatus | string;
  // 如需扩展：时间范围、标题链匹配等都可以继续加
}

export interface SearchRequest {
  query: string;
  collectionId?: CollectionId;
  limit?: number;
  latestOnly?: boolean;
  filters?: SearchFilters;
}

export interface SearchResult {
  pointId: PointId;
  content: string;
  title?: string;
  versionId: VersionId;
  docId: DocId;
  chunkIndex: number;
  is_current?: boolean;
  collectionId?: CollectionId;
  titleChain?: string;
  score?: number; // RRF 融合后可回传
}

/** 与你前端里用的名称对齐（只是别名，保持兼容） */
export type UnifiedSearchResult = SearchResult;

// ---------------------------------------------
// 拆分策略（splitter.ts）
// ---------------------------------------------
export type SplitStrategy = 'markdown_headings' | 'fixed_window' | 'by_sentence';

export interface SplitOptions {
  strategy: SplitStrategy;
  // fixed_window 参数
  windowSize?: number;     // 例如 500
  overlap?: number;        // 例如 50
  // markdown 标题截断深度
  maxHeadingDepth?: number;
}

// ---------------------------------------------
// Qdrant 相关 payload（向量库的载荷契约）
// ---------------------------------------------
export interface QdrantPointPayload {
  pointId: PointId;
  docId: DocId;
  versionId: VersionId;
  collectionId: CollectionId;
  chunkIndex: number;
  titleChain?: string;
  contentHash?: string;

  // 为了“快速预览”常会放一点文本，但注意别放过长
  content?: string;
  title?: string;
}

export interface QdrantSearchHit {
  id: PointId;
  score: number;
  payload: QdrantPointPayload;
}

// ---------------------------------------------
// API DTO（请求/响应）
// ---------------------------------------------
// Collections
export interface CreateCollectionRequest {
  name: string;
  description?: string;
}
export type CreateCollectionResponse = Collection;
export type ListCollectionsResponse = Collection[];
export type GetCollectionResponse = Collection;

// Versions
export interface CreateVersionRequest {
  name: string;
  description?: string;
}
export type CreateVersionResponse = Version;
export type ListVersionsResponse = Version[];
export type GetVersionResponse = Version;

export interface SetCurrentVersionResponse extends Version {}
export interface UpdateVersionStatusRequest {
  status: VersionStatus | string;
}
export interface FinalizeVersionResponse {
  finalVersionId: VersionId;
  isNew: boolean;
}

// Docs
export interface CreateDocRequest {
  collectionId: CollectionId;
  versionId: VersionId;
  key: string;
  content: string | Uint8Array; // 输入载荷里才有 content
  name?: string;
  mime?: string;
  splitOptions?: SplitOptions;
  metadata?: Record<string, any>;
}
export type CreateDocResponse = Doc;

export type ListDocsResponse = Doc[];
export type GetDocResponse = Doc;

export interface UpdateDocRequest {
  content: string | Uint8Array;
  name?: string;
  mime?: string;
  splitOptions?: SplitOptions;
  metadata?: Record<string, any>;
}
export type UpdateDocResponse = Doc;

// Search
export type SearchResponse = UnifiedSearchResult[];

// ---------------------------------------------
// 分页/通用响应（如需）
// ---------------------------------------------
export interface PageQuery {
  page?: number;       // 1-based
  pageSize?: number;   // 默认 20
}
export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
}
export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

// ---------------------------------------------
// 统计与健康检查
// ---------------------------------------------
export interface Stats {
  collections: number;
  versions: number;
  docs: number;
  chunks: number;
}

export interface Health {
  ok: boolean;
}
