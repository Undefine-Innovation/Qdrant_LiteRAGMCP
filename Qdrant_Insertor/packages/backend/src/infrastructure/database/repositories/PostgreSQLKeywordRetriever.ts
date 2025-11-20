import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import {
  IKeywordRetriever,
  KeywordSearchRequest,
  KeywordSearchResult,
} from '@domain/repositories/IKeywordRetriever.js';
import {
  CollectionId,
  DocId,
  PointId,
  SearchResult,
} from '@domain/entities/types.js';
import { ChunkFullTextRepository } from './ChunkFullTextRepository.js';
import { ChunkRepository } from './ChunkRepository.js';

/**
 * PostgreSQL关键词检索器实现
 * 使用PostgreSQL的全文搜索功能提供关键词检索
 */
export class PostgreSQLKeywordRetriever implements IKeywordRetriever {
  private readonly chunkFullTextRepository: ChunkFullTextRepository;
  private readonly chunkRepository: ChunkRepository;

  /**
   * 创建PostgreSQLKeywordRetriever实例
   * @param dataSource TypeORM数据源
   * @param logger 日志记录器
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: Logger,
  ) {
    this.chunkFullTextRepository = new ChunkFullTextRepository(
      dataSource,
      logger,
    );
    this.chunkRepository = new ChunkRepository(dataSource, logger);
  }

  /**
   * 执行关键词搜索
   * @param request 搜索请求参数
   * @returns 搜索结果数组
   */
  async search(request: KeywordSearchRequest): Promise<KeywordSearchResult[]> {
    const {
      query,
      collectionId,
      limit = 10,
      offset = 0,
      fuzzy = false,
      language = 'english',
    } = request;

    this.logger.info(`开始PostgreSQL关键词搜索`, {
      query,
      collectionId,
      limit,
      offset,
      fuzzy,
      language,
    });

    try {
      // 执行全文搜索
      const searchResults = fuzzy
        ? await this.chunkFullTextRepository.searchFuzzyFullText(
            query,
            collectionId,
            limit + offset,
            language,
          )
        : await this.chunkFullTextRepository.searchFullText(
            query,
            collectionId,
            limit + offset,
            language,
          );

      // 应用偏移量
      const paginatedResults = searchResults.slice(offset);

      // 获取关联的块详细信息
      const chunkIds = paginatedResults.map(
        (result) => result.chunkId as PointId,
      );
      const chunks = await this.chunkRepository.findByPointIds(chunkIds);
      const chunkMap = new Map(chunks.map((chunk) => [chunk.pointId, chunk]));

      // 转换为KeywordSearchResult格式
      const results: KeywordSearchResult[] = [];
      for (const searchResult of paginatedResults) {
        const chunk = chunkMap.get(searchResult.chunkId as PointId);
        if (!chunk) continue;

        // 生成高亮信息
        const highlights = this.generateHighlights(
          query,
          searchResult.title,
          searchResult.content,
          fuzzy,
        );

        results.push({
          pointId: chunk.pointId as PointId,
          docId: chunk.docId as DocId,
          collectionId: chunk.collectionId as CollectionId,
          chunkIndex: chunk.chunkIndex,
          title: chunk.title,
          content: chunk.content,
          titleChain: chunk.title, // PostgreSQL中titleChain使用title字段
          relevanceScore: searchResult.relevanceScore,
          highlights,
        });
      }

      this.logger.info(`PostgreSQL关键词搜索完成`, {
        query,
        collectionId,
        resultCount: results.length,
        totalFound: searchResults.length,
      });

      return results;
    } catch (error) {
      this.logger.error(`PostgreSQL关键词搜索失败`, {
        query,
        collectionId,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error;
    }
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
    collectionId: CollectionId,
    limit: number = 10,
  ): Promise<KeywordSearchResult[]> {
    return this.search({
      query,
      collectionId,
      limit,
    });
  }

  /**
   * 批量创建全文搜索索引
   * @param data 要索引的数据数组
   */
  async createIndexBatch(
    data: Array<{
      pointId: PointId;
      content: string;
      title?: string;
      docId: DocId;
      collectionId: CollectionId;
      chunkIndex: number;
    }>,
  ): Promise<void> {
    this.logger.info(`开始批量创建全文搜索索引`, {
      count: data.length,
    });

    try {
      await this.chunkFullTextRepository.createIndexBatch(data);

      this.logger.info(`批量创建全文搜索索引完成`, {
        count: data.length,
      });
    } catch (error) {
      this.logger.error(`批量创建全文搜索索引失败`, {
        count: data.length,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 删除特定文档的索引
   * @param docId 文档ID
   */
  async deleteByDocId(docId: DocId): Promise<void> {
    this.logger.debug(`删除文档的全文搜索索引`, { docId });

    try {
      await this.chunkFullTextRepository.deleteByDocId(docId);

      this.logger.debug(`删除文档的全文搜索索引成功`, { docId });
    } catch (error) {
      this.logger.error(`删除文档的全文搜索索引失败`, {
        docId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 删除特定集合的索引
   * @param collectionId 集合ID
   */
  async deleteByCollectionId(collectionId: CollectionId): Promise<void> {
    this.logger.debug(`删除集合的全文搜索索引`, { collectionId });

    try {
      await this.chunkFullTextRepository.deleteByCollectionId(collectionId);

      this.logger.debug(`删除集合的全文搜索索引成功`, { collectionId });
    } catch (error) {
      this.logger.error(`删除集合的全文搜索索引失败`, {
        collectionId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 批量删除索引
   * @param pointIds 点ID数组
   */
  async deleteBatch(pointIds: PointId[]): Promise<void> {
    this.logger.debug(`批量删除全文搜索索引`, {
      count: pointIds.length,
    });

    try {
      await this.chunkFullTextRepository.deleteBatch(pointIds);

      this.logger.debug(`批量删除全文搜索索引成功`, {
        count: pointIds.length,
      });
    } catch (error) {
      this.logger.error(`批量删除全文搜索索引失败`, {
        count: pointIds.length,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 重建全文搜索索引
   */
  async rebuildIndex(): Promise<void> {
    this.logger.info(`开始重建全文搜索索引`);

    try {
      await this.chunkFullTextRepository.rebuildIndex();

      this.logger.info(`重建全文搜索索引完成`);
    } catch (error) {
      this.logger.error(`重建全文搜索索引失败`, {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 优化全文搜索索引
   */
  async optimizeIndex(): Promise<void> {
    this.logger.info(`开始优化全文搜索索引`);

    try {
      await this.chunkFullTextRepository.optimizeIndex();

      this.logger.info(`优化全文搜索索引完成`);
    } catch (error) {
      this.logger.error(`优化全文搜索索引失败`, {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 获取搜索统计信息
   * @returns 搜索统计信息对象
   */
  async getSearchStats(): Promise<{
    totalDocuments: number;
    totalChunks: number;
    indexSize: number;
    lastUpdated: Date;
  }> {
    try {
      return await this.chunkFullTextRepository.getSearchStats();
    } catch (error) {
      this.logger.error(`获取搜索统计信息失败`, {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 生成搜索高亮信息
   * @param query 搜索查询
   * @param title 标题
   * @param content 内容
   * @param fuzzy 是否为模糊搜索
   * @returns 高亮信息
   */
  private generateHighlights(
    query: string,
    title: string | undefined,
    content: string,
    fuzzy: boolean,
  ): { content?: string; title?: string } {
    const highlights: { content?: string; title?: string } = {};

    try {
      // 简单的高亮实现，实际项目中可以使用更复杂的算法
      const highlightTerms = query
        .split(/\s+/)
        .filter((term) => term.length > 0);

      if (title) {
        highlights.title = this.highlightText(title, highlightTerms, fuzzy);
      }

      // 只高亮内容的前200个字符
      const contentSnippet =
        content.length > 200 ? content.substring(0, 200) + '...' : content;
      highlights.content = this.highlightText(
        contentSnippet,
        highlightTerms,
        fuzzy,
      );
    } catch (error) {
      this.logger.warn(`生成搜索高亮失败`, {
        query,
        error: (error as Error).message,
      });
    }

    return highlights;
  }

  /**
   * 高亮文本中的关键词
   * @param text 原始文本
   * @param terms 关键词数组
   * @param fuzzy 是否为模糊搜索
   * @returns 高亮后的文本
   */
  private highlightText(text: string, terms: string[], fuzzy: boolean): string {
    let highlightedText = text;

    for (const term of terms) {
      if (fuzzy) {
        // 模糊搜索使用更宽松的匹配
        const regex = new RegExp(`(${this.escapeRegex(term)})`, 'gi');
        highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
      } else {
        // 精确搜索
        const regex = new RegExp(`(${this.escapeRegex(term)})`, 'g');
        highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
      }
    }

    return highlightedText;
  }

  /**
   * 转义正则表达式特殊字符
   * @param text 原始文本
   * @returns 转义后的文本
   */
  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
