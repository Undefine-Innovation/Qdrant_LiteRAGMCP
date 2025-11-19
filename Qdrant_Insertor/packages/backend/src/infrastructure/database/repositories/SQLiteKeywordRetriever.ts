/**
 * SQLite关键词检索器实现（TypeScript版本）
 * 使用SQLite FTS5功能提供关键词检索
 */

// 定义接口以替代any类型
interface ChunkData {
  pointId: string;
  docId: string;
  collectionId: string;
  chunkIndex: number;
  title?: string;
  content: string;
}

interface FtsResult {
  pointId: string;
  docId: string;
  collectionId: string;
  chunkIndex: number;
  title?: string;
  content: string;
}

interface SearchRequest {
  query: string;
  collectionId?: string;
  limit?: number;
  offset?: number;
}

interface FtsTableInterface {
  search(query: string, collectionId: string, limit: number): FtsResult[];
  search(query: string, collectionId: string, limit: number): FtsResult[];
  createBatch(data: FtsResult[]): void;
  deleteByDocId(docId: string): void;
  deleteByCollectionId(collectionId: string): void;
  deleteBatch(pointIds: string[]): void;
}

interface ChunkTableInterface {
  getByPointIds(pointIds: string[]): ChunkData[];
  getCount?(): number;
}

interface LoggerInterface {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

export class SQLiteKeywordRetriever {
  private readonly logger: LoggerInterface;
  private readonly chunksFts5Table: FtsTableInterface;
  private readonly chunksTable: ChunkTableInterface;

  /**
   * 创建SQLiteKeywordRetriever实例
   * @param chunksFts5Table FTS5表访问器
   * @param chunksTable 块表访问器
   * @param logger 日志记录器
   */
  constructor(
    chunksFts5Table: FtsTableInterface,
    chunksTable: ChunkTableInterface,
    logger: LoggerInterface,
  ) {
    this.logger = logger;
    this.chunksFts5Table = chunksFts5Table;
    this.chunksTable = chunksTable;
  }

  /**
   * 执行关键词搜索
   * @param request 搜索请求参数
   * @returns 搜索结果数组
   */
  async search(request: SearchRequest): Promise<ChunkData[]> {
    const { query, collectionId, limit = 10, offset = 0 } = request;

    const ftsResults = collectionId
      ? this.chunksFts5Table.search(query, collectionId, limit + offset)
      : this.chunksFts5Table.search(query, '', limit + offset);

    const paginatedResults = ftsResults.slice(offset);
    const pointIds = paginatedResults.map((result) => result.pointId);
    const chunks = this.chunksTable.getByPointIds(pointIds);
    const chunkMap = new Map(chunks.map((chunk) => [chunk.pointId, chunk]));

    const results: ChunkData[] = [];
    for (const ftsResult of paginatedResults) {
      const chunk = chunkMap.get(ftsResult.pointId);
      if (!chunk) continue;
      results.push({
        pointId: ftsResult.pointId,
        docId: ftsResult.docId,
        collectionId: ftsResult.collectionId,
        chunkIndex: ftsResult.chunkIndex,
        title: ftsResult.title,
        content: ftsResult.content,
      });
    }

    return results;
  }

  /**
   * 在特定集合中执行关键词搜索
   * @param query 搜索查询字符串
   * @param collectionId 集合ID
   * @param limit 结果数量限制
   * @returns 搜索结果数组
   */
  async searchInCollection(
    query: string,
    collectionId: string,
    limit = 10,
  ): Promise<ChunkData[]> {
    return this.search({ query, collectionId, limit });
  }

  /**
   * 批量创建全文搜索索引
   * @param data 要索引的数据数组
   */
  async createIndexBatch(data: ChunkData[]): Promise<void> {
    const ftsData: FtsResult[] = data.map((item) => ({
      pointId: item.pointId,
      docId: item.docId,
      collectionId: item.collectionId,
      chunkIndex: item.chunkIndex,
      content: item.content,
      title: item.title,
    }));
    this.chunksFts5Table.createBatch(ftsData);
  }

  /**
   * 删除特定文档的索引
   * @param docId 文档ID
   */
  async deleteByDocId(docId: string): Promise<void> {
    this.chunksFts5Table.deleteByDocId(docId);
  }

  /**
   * 删除特定集合的索引
   * @param collectionId 集合ID
   */
  async deleteByCollectionId(collectionId: string): Promise<void> {
    this.chunksFts5Table.deleteByCollectionId(collectionId);
  }

  /**
   * 批量删除索引
   * @param pointIds 点ID数组
   */
  async deleteBatch(pointIds: string[]): Promise<void> {
    this.chunksFts5Table.deleteBatch(pointIds);
  }

  /**
   * 重建全文搜索索引
   */
  async rebuildIndex(): Promise<void> {
    // Implementation deferred
  }

  /**
   * 优化全文搜索索引
   */
  async optimizeIndex(): Promise<void> {
    // Implementation deferred
  }

  /**
   * 获取搜索统计信息
   * @returns 搜索统计信息对象
   */
  async getSearchStats(): Promise<Record<string, unknown>> {
    const totalChunks = this.chunksTable.getCount?.() || 0;
    return {
      totalDocuments: 0,
      totalChunks,
      indexSize: 0,
      lastUpdated: new Date(),
    };
  }
}
