import { Chunk } from '../entities/Chunk.js';
import { EmbeddingVector } from '../value-objects/EmbeddingVector.js';
import {
  CollectionId,
  DocId,
  PointId,
  RetrievalResultDTO,
  PaginationQuery,
  PaginatedResponse,
} from '../entities/types.js';
import { IEventPublisher } from '../events/IEventPublisher.js';
import { IEmbeddingProvider } from '../entities/embedding.js';
import { SearchResult, FusionCandidate, FusedResult } from './SearchTypes.js';
import { Logger } from '../../infrastructure/logging/logger.js';

/**
 * 搜索领域服务接口
 */
export interface ISearchDomainService {
  /**
   * 执行语义搜索
   * @param query 搜索查询
   * @param collectionId 集合ID
   * @param chunks 可搜索的块数组
   * @param limit 结果限制
   * @returns 搜索结果
   */
  semanticSearch(
    query: string,
    collectionId: CollectionId,
    chunks: Chunk[],
    limit?: number,
  ): Promise<SearchResult[]>;

  /**
   * 执行关键词搜索
   * @param query 搜索查询
   * @param collectionId 集合ID
   * @param chunks 可搜索的块数组
   * @param limit 结果限制
   * @returns 搜索结果
   */
  keywordSearch(
    query: string,
    collectionId: CollectionId,
    chunks: Chunk[],
    limit?: number,
  ): SearchResult[];

  /**
   * 融合语义搜索和关键词搜索结果
   * @param semanticResults 语义搜索结果
   * @param keywordResults 关键词搜索结果
   * @param k RRF参数
   * @returns 融合后的结果
   */
  fuseResults(
    semanticResults: SearchResult[],
    keywordResults: SearchResult[],
    k?: number,
  ): SearchResult[];

  /**
   * 计算查询与块的相似度
   * @param query 查询文本
   * @param chunk 块实体
   * @returns 相似度分数
   */
  calculateSimilarity(query: string, chunk: Chunk): Promise<number>;

  /**
   * 验证搜索查询
   * @param query 搜索查询
   * @returns 验证结果
   */
  validateSearchQuery(query: string): { isValid: boolean; errors: string[] };

  /**
   * 提取搜索关键词
   * @param query 搜索查询
   * @param maxKeywords 最大关键词数量
   * @returns 关键词数组
   */
  extractKeywords(query: string, maxKeywords?: number): string[];

  /**
   * 转换搜索结果为RetrievalResultDTO格式
   * @param searchResults 搜索结果数组
   * @returns RetrievalResultDTO数组
   */
  convertToRetrievalResults(
    searchResults: SearchResult[],
  ): RetrievalResultDTO[];
}

/**
 * 搜索领域服务实现
 * 负责语义搜索、关键词搜索和结果融合
 */
export class SearchDomainService implements ISearchDomainService {
  /**
   * 默认搜索结果限制
   */
  private static readonly DEFAULT_LIMIT = 10;

  /**
   * RRF算法默认k值
   */
  private static readonly DEFAULT_RRF_K = 60;

  /**
   * 最小查询长度
   */
  private static readonly MIN_QUERY_LENGTH = 2;

  /**
   * 最大查询长度
   */
  private static readonly MAX_QUERY_LENGTH = 1000;

  /**
   * 构造函数
   * @param embeddingProvider 嵌入向量提供者
   * @param eventPublisher 事件发布器
   * @param logger 日志记录器
   */
  constructor(
    private readonly embeddingProvider: IEmbeddingProvider,
    private readonly eventPublisher: IEventPublisher,
    private readonly logger?: Logger,
  ) {}

  /**
   * 执行语义搜索
   * @param query 搜索查询
   * @param collectionId 集合ID
   * @param chunks 可搜索的块数组
   * @param limit 结果限制
   * @returns 搜索结果
   */
  public async semanticSearch(
    query: string,
    collectionId: CollectionId,
    chunks: Chunk[],
    limit: number = SearchDomainService.DEFAULT_LIMIT,
  ): Promise<SearchResult[]> {
    // 验证查询
    const validation = this.validateSearchQuery(query);
    if (!validation.isValid) {
      throw new Error(`Invalid search query: ${validation.errors.join(', ')}`);
    }

    // 过滤有嵌入向量的块
    const chunksWithEmbeddings = chunks.filter((chunk) => chunk.hasEmbedding());

    if (chunksWithEmbeddings.length === 0) {
      return [];
    }

    try {
      // 生成查询嵌入向量
      const [queryEmbedding] = await this.embeddingProvider.generate([query]);

      if (!queryEmbedding) {
        throw new Error('Failed to generate query embedding');
      }

      const queryVector = EmbeddingVector.create(queryEmbedding);
      const results: SearchResult[] = [];

      // 计算相似度
      for (const chunk of chunksWithEmbeddings) {
        if (chunk.embedding) {
          const similarity = queryVector.cosineSimilarity(chunk.embedding);
          results.push({
            pointId: chunk.pointId,
            docId: chunk.docId,
            collectionId: chunk.collectionId,
            chunkIndex: chunk.chunkIndex,
            title: chunk.title,
            content: chunk.contentValue,
            score: similarity,
            type: 'semantic',
          });
        }
      }

      // 按相似度排序并限制结果数量
      return results.sort((a, b) => b.score - a.score).slice(0, limit);
    } catch (error) {
      throw new Error(
        `Semantic search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * 执行关键词搜索
   * @param query 搜索查询
   * @param collectionId 集合ID
   * @param chunks 可搜索的块数组
   * @param limit 结果限制
   * @returns 搜索结果
   */
  public keywordSearch(
    query: string,
    collectionId: CollectionId,
    chunks: Chunk[],
    limit: number = SearchDomainService.DEFAULT_LIMIT,
  ): SearchResult[] {
    // 验证查询
    const validation = this.validateSearchQuery(query);
    if (!validation.isValid) {
      throw new Error(`Invalid search query: ${validation.errors.join(', ')}`);
    }

    // 提取关键词
    const keywords = this.extractKeywords(query);
    const results: SearchResult[] = [];

    // 计算关键词匹配分数
    for (const chunk of chunks) {
      const score = this.calculateKeywordScore(query, keywords, chunk);
      if (score > 0) {
        results.push({
          pointId: chunk.pointId,
          docId: chunk.docId,
          collectionId: chunk.collectionId,
          chunkIndex: chunk.chunkIndex,
          title: chunk.title,
          content: chunk.contentValue,
          score,
          type: 'keyword',
        });
      }
    }

    // 按分数排序并限制结果数量
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * 融合语义搜索和关键词搜索结果
   * @param semanticResults 语义搜索结果
   * @param keywordResults 关键词搜索结果
   * @param k RRF参数
   * @returns 融合后的结果
   */
  public fuseResults(
    semanticResults: SearchResult[],
    keywordResults: SearchResult[],
    k: number = SearchDomainService.DEFAULT_RRF_K,
  ): SearchResult[] {
    // 转换为融合候选
    const semanticCandidates: FusionCandidate[] = semanticResults.map(
      (result) => ({
        pointId: result.pointId,
        score: result.score,
        type: 'semantic',
      }),
    );

    const keywordCandidates: FusionCandidate[] = keywordResults.map(
      (result) => ({
        pointId: result.pointId,
        score: result.score,
        type: 'keyword',
      }),
    );

    // 执行RRF算法
    const fusedResults = this.reciprocalRankFusion(
      [semanticCandidates, keywordCandidates],
      k,
    );

    // 构建结果映射
    const resultMap = new Map<string, SearchResult>();

    // 添加语义搜索结果
    for (const result of semanticResults) {
      resultMap.set(result.pointId, result);
    }

    // 添加关键词搜索结果（如果不存在）
    for (const result of keywordResults) {
      if (!resultMap.has(result.pointId)) {
        resultMap.set(result.pointId, result);
      }
    }

    // 构建最终结果
    const finalResults: SearchResult[] = [];
    for (const fused of fusedResults) {
      const result = resultMap.get(fused.pointId);
      if (result) {
        finalResults.push({
          ...result,
          score: fused.score,
          type: 'fused',
        });
      }
    }

    return finalResults;
  }

  /**
   * 计算查询与块的相似度
   * @param query 查询文本
   * @param chunk 块实体
   * @returns 相似度分数
   */
  public async calculateSimilarity(
    query: string,
    chunk: Chunk,
  ): Promise<number> {
    if (!chunk.hasEmbedding()) {
      return 0;
    }

    try {
      const [queryEmbedding] = await this.embeddingProvider.generate([query]);
      if (!queryEmbedding) {
        return 0;
      }

      const queryVector = EmbeddingVector.create(queryEmbedding);
      return queryVector.cosineSimilarity(chunk.embedding!);
    } catch (error) {
      return 0;
    }
  }

  /**
   * 验证搜索查询
   * @param query 搜索查询
   * @returns 验证结果
   */
  public validateSearchQuery(query: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // 检查查询长度
    if (!query || query.trim().length === 0) {
      errors.push('Search query cannot be empty');
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery.length < SearchDomainService.MIN_QUERY_LENGTH) {
      errors.push(
        `Search query must be at least ${SearchDomainService.MIN_QUERY_LENGTH} characters long`,
      );
    }

    if (trimmedQuery.length > SearchDomainService.MAX_QUERY_LENGTH) {
      errors.push(
        `Search query cannot exceed ${SearchDomainService.MAX_QUERY_LENGTH} characters`,
      );
    }

    // 检查是否包含有效字符
    if (!/[a-zA-Z0-9\u4e00-\u9fff]/.test(trimmedQuery)) {
      errors.push('Search query must contain valid characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 提取搜索关键词
   * @param query 搜索查询
   * @param maxKeywords 最大关键词数量
   * @returns 关键词数组
   */
  public extractKeywords(query: string, maxKeywords: number = 10): string[] {
    // 简单的关键词提取实现
    // 在实际应用中，可以使用更复杂的NLP技术

    // 移除特殊字符并分割
    const words = query
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 1);

    // 移除停用词（简化版）
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      '是',
      '的',
      '了',
      '在',
      '有',
      '和',
      '就',
      '不',
      '人',
      '都',
      '一',
      '一个',
      '上',
      '也',
      '很',
      '到',
      '说',
      '要',
      '去',
      '你',
      '会',
      '着',
      '没有',
      '看',
      '好',
      '自己',
      '这',
    ]);

    const filteredWords = words.filter((word) => !stopWords.has(word));

    // 计算词频并排序
    const wordFreq = new Map<string, number>();
    for (const word of filteredWords) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }

    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxKeywords)
      .map((entry) => entry[0]);
  }

  /**
   * 转换搜索结果为RetrievalResultDTO格式
   * @param searchResults 搜索结果数组
   * @returns RetrievalResultDTO数组
   */
  public convertToRetrievalResults(
    searchResults: SearchResult[],
  ): RetrievalResultDTO[] {
    return searchResults.map((result) => ({
      type: 'chunkResult' as const,
      score: result.score,
      content: result.content,
      metadata: {
        pointId: result.pointId,
        docId: result.docId,
        collectionId: result.collectionId,
        chunkIndex: result.chunkIndex,
        titleChain: result.title,
        title: result.title,
        searchType: result.type,
      },
    }));
  }

  /**
   * 计算关键词匹配分数
   * @param query 搜索查询
   * @param keywords 关键词数组
   * @param chunk 块实体
   * @returns 匹配分数
   */
  private calculateKeywordScore(
    query: string,
    keywords: string[],
    chunk: Chunk,
  ): number {
    const content = chunk.contentValue.toLowerCase();
    const title = chunk.title?.toLowerCase() || '';

    let score = 0;
    const queryLower = query.toLowerCase();

    // 完整查询匹配（权重最高）
    if (content.includes(queryLower)) {
      score += 10;
    }
    if (title.includes(queryLower)) {
      score += 15; // 标题匹配权重更高
    }

    // 关键词匹配
    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase();

      // 内容中的关键词匹配
      const contentMatches = (
        content.match(new RegExp(keywordLower, 'g')) || []
      ).length;
      score += contentMatches * 2;

      // 标题中的关键词匹配
      const titleMatches = (title.match(new RegExp(keywordLower, 'g')) || [])
        .length;
      score += titleMatches * 5; // 标题关键词权重更高
    }

    // 考虑内容长度进行归一化
    const contentLength = content.length;
    if (contentLength > 0) {
      score = score / Math.log(contentLength + 1);
    }

    return score;
  }

  /**
   * 倒数排名融合（RRF）算法
   * @param results 搜索结果数组
   * @param k RRF参数
   * @returns 融合后的结果
   */
  private reciprocalRankFusion(
    results: FusionCandidate[][],
    k: number = SearchDomainService.DEFAULT_RRF_K,
  ): FusedResult[] {
    const fused: Record<string, { score: number }> = {};

    results.forEach((list) => {
      list.forEach((candidate, idx) => {
        const rank = idx + 1;
        const inc = 1 / (k + rank);

        if (!fused[candidate.pointId]) {
          fused[candidate.pointId] = { score: 0 };
        }
        fused[candidate.pointId].score += inc;
      });
    });

    return Object.entries(fused)
      .map(([pointId, { score }]) => ({
        pointId: pointId as PointId,
        score,
      }))
      .sort((a, b) => b.score - a.score);
  }
}
