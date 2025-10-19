import { CollectionId, SearchResult as UniversalSearchResult } from '@domain/types.js';

/**
 * 定义搜索服务的接口。
 * 搜索服务负责处理文档的语义搜索和关键词搜索。
 */
export interface ISearchService {
  /**
   * 在给定集合中执行搜索查询。
   * 可以结合语义搜索和关键词搜索，并进行结果融合。
   *
   * @param query - 用户的搜索查询字符串。
   * @param collectionId - 要搜索的集合的 ID。
   * @param options - 搜索选项，例如返回结果的数量限制。
   * @returns 匹配文档块的搜索结果数组。
   */
  search(
    query: string,
    collectionId: CollectionId,
    options?: { limit?: number },
  ): Promise<UniversalSearchResult[]>;
}