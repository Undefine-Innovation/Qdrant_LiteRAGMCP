import { CollectionId, DocId, PointId } from '../entities/types.js';

/**
 * 搜索结果接口
 * 扩展自 Chunk 接口，添加了搜索相关的字段
 */
export interface SearchResult {
  pointId: PointId;
  docId: DocId;
  collectionId: CollectionId;
  chunkIndex: number;
  title?: string;
  content: string;
  score: number;
  type?: 'keyword' | 'semantic' | 'fused';
}

/**
 * 融合候选接口
 * 用于在结果融合过程中表示候选结果
 */
export interface FusionCandidate {
  pointId: PointId;
  score: number; // Original score for semantic, 0 for keyword
  type: 'keyword' | 'semantic';
}

/**
 * 融合结果接口
 * 表示经过融合算法处理后的搜索结果
 */
export interface FusedResult {
  pointId: PointId;
  score: number; // RRF score
}

/**
 * 搜索选项接口
 */
export interface SearchOptions {
  /**
   * 结果数量限制
   */
  limit?: number;

  /**
   * 是否启用语义搜索
   */
  enableSemantic?: boolean;

  /**
   * 是否启用关键词搜索
   */
  enableKeyword?: boolean;

  /**
   * 结果融合权重
   */
  fusionWeights?: {
    semantic: number;
    keyword: number;
  };

  /**
   * RRF算法参数
   */
  rrfK?: number;

  /**
   * 最小相似度阈值
   */
  minSimilarity?: number;

  /**
   * 是否包含元数据
   */
  includeMetadata?: boolean;
}

/**
 * 搜索统计信息接口
 */
export interface SearchStatistics {
  /**
   * 总搜索时间（毫秒）
   */
  totalTime: number;

  /**
   * 语义搜索时间（毫秒）
   */
  semanticTime: number;

  /**
   * 关键词搜索时间（毫秒）
   */
  keywordTime: number;

  /**
   * 融合时间（毫秒）
   */
  fusionTime: number;

  /**
   * 语义搜索结果数量
   */
  semanticResultCount: number;

  /**
   * 关键词搜索结果数量
   */
  keywordResultCount: number;

  /**
   * 最终结果数量
   */
  finalResultCount: number;

  /**
   * 搜索的块数量
   */
  chunksSearched: number;
}

/**
 * 搜索上下文接口
 */
export interface SearchContext {
  /**
   * 搜索ID
   */
  searchId: string;

  /**
   * 用户ID（如果有）
   */
  userId?: string;

  /**
   * 会话ID（如果有）
   */
  sessionId?: string;

  /**
   * 搜索时间戳
   */
  timestamp: number;

  /**
   * 搜索来源
   */
  source?: 'api' | 'web' | 'cli' | 'test';

  /**
   * 额外的上下文信息
   */
  metadata?: Record<string, unknown>;
}

/**
 * 搜索建议接口
 */
export interface SearchSuggestion {
  /**
   * 建议文本
   */
  text: string;

  /**
   * 建议类型
   */
  type: 'correction' | 'completion' | 'expansion' | 'related';

  /**
   * 建议分数
   */
  score: number;

  /**
   * 建议来源
   */
  source?: string;
}

/**
 * 搜索过滤器接口
 */
export interface SearchFilter {
  /**
   * 集合ID过滤器
   */
  collectionIds?: CollectionId[];

  /**
   * 文档ID过滤器
   */
  docIds?: DocId[];

  /**
   * 块索引范围过滤器
   */
  chunkIndexRange?: {
    min: number;
    max: number;
  };

  /**
   * 内容长度范围过滤器
   */
  contentLengthRange?: {
    min: number;
    max: number;
  };

  /**
   * 标题过滤器
   */
  titlePattern?: string;

  /**
   * 内容模式过滤器
   */
  contentPattern?: string;

  /**
   * 自定义过滤器函数
   */
  customFilter?: (result: SearchResult) => boolean;
}

/**
 * 搜索排序选项接口
 */
export interface SearchSortOptions {
  /**
   * 排序字段
   */
  field: 'score' | 'chunkIndex' | 'contentLength' | 'timestamp';

  /**
   * 排序方向
   */
  direction: 'asc' | 'desc';

  /**
   * 自定义排序函数
   */
  customSort?: (a: SearchResult, b: SearchResult) => number;
}

/**
 * 搜索高亮选项接口
 */
export interface SearchHighlightOptions {
  /**
   * 是否启用高亮
   */
  enabled: boolean;

  /**
   * 高亮标签
   */
  tags?: {
    open: string;
    close: string;
  };

  /**
   * 最大片段长度
   */
  maxFragmentLength?: number;

  /**
   * 最大片段数量
   */
  maxFragments?: number;

  /**
   * 高亮关键词
   */
  keywords?: string[];
}
