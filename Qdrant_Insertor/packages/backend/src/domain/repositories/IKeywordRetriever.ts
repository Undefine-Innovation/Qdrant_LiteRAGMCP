import {
  CollectionId,
  DocId,
  PointId,
  SearchResult,
} from '@domain/entities/types.js';

/**
 * 关键词检索结果接口
 * 扩展自SearchResult，添加了关键词搜索特有的字段
 */
export interface KeywordSearchResult extends SearchResult {
  /**
   * 搜索相关性评分
   * 不同数据库的评分标准可能不同，需要标准化
   */
  relevanceScore: number;

  /**
   * 搜索高亮信息
   * 包含匹配关键词的高亮片段
   */
  highlights?: {
    content?: string;
    title?: string;
  };
}

/**
 * 关键词检索请求参数
 */
export interface KeywordSearchRequest {
  /**
   * 搜索查询字符串
   */
  query: string;

  /**
   * 集合ID（可选）
   */
  collectionId?: CollectionId;

  /**
   * 结果数量限制
   */
  limit?: number;

  /**
   * 偏移量（用于分页）
   */
  offset?: number;

  /**
   * 是否启用模糊搜索
   */
  fuzzy?: boolean;

  /**
   * 搜索语言（用于PostgreSQL全文搜索）
   */
  language?: string;
}

/**
 * 关键词检索器接口
 * 提供跨数据库的关键词搜索功能
 * 支持PostgreSQL全文搜索和SQLite FTS5
 */
export interface IKeywordRetriever {
  /**
   * 执行关键词搜索
   * @param request 搜索请求参数
   * @returns 搜索结果数组
   */
  search(request: KeywordSearchRequest): Promise<KeywordSearchResult[]>;

  /**
   * 在特定集合中执行关键词搜索
   * @param query 搜索查询字符串
   * @param collectionId 集合ID
   * @param limit 结果数量限制
   * @returns 搜索结果数组
   */
  searchInCollection(
    query: string,
    collectionId: CollectionId,
    limit?: number,
  ): Promise<KeywordSearchResult[]>;

  /**
   * 批量创建全文搜索索引
   * @param data 要索引的数据数组
   */
  createIndexBatch(
    data: Array<{
      pointId: PointId;
      content: string;
      title?: string;
      docId: DocId;
      collectionId: CollectionId;
      chunkIndex: number;
    }>,
  ): Promise<void>;

  /**
   * 删除特定文档的索引
   * @param docId 文档ID
   */
  deleteByDocId(docId: DocId): Promise<void>;

  /**
   * 删除特定集合的索引
   * @param collectionId 集合ID
   */
  deleteByCollectionId(collectionId: CollectionId): Promise<void>;

  /**
   * 批量删除索引
   * @param pointIds 点ID数组
   */
  deleteBatch(pointIds: PointId[]): Promise<void>;

  /**
   * 重建全文搜索索引
   */
  rebuildIndex(): Promise<void>;

  /**
   * 优化全文搜索索引
   */
  optimizeIndex(): Promise<void>;

  /**
   * 获取搜索统计信息
   */
  getSearchStats(): Promise<{
    totalDocuments: number;
    totalChunks: number;
    indexSize: number;
    lastUpdated: Date;
  }>;
}
