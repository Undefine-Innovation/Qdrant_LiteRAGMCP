import {
  CollectionId,
  RetrievalResultDTO,
  PaginationQuery,
  PaginatedResponse,
} from '@domain/entities/types.js';

/**
 * 定义搜索服务的接口
 * 搜索服务负责处理文档的语义搜索和关键词搜索
 */
export interface ISearchService {
  /**
   * 在给定集合中执行搜索查询
   * 可以结合语义搜索和关键词搜索，并进行结果融合
   *
   * @param query - 用户的搜索查询字符串
   * @param collectionId - 要搜索的集合ID
   * @param options - 搜索选项，例如返回结果的数量限制
   * @returns 符合RetrievalResultDTO规范的搜索结果数组
   */
  search(
    query: string,
    collectionId: CollectionId,
    options?: { limit?: number },
  ): Promise<RetrievalResultDTO[]>;

  /**
   * 在给定集合中执行分页搜索查询
   * 可以结合语义搜索和关键词搜索，并进行结果融合
   *
   * @param query - 用户的搜索查询字符串
   * @param collectionId - 要搜索的集合ID（可选）
   * @param paginationQuery - 分页查询参数
   * @returns 符合RetrievalResultDTO规范的分页搜索结果
   */
  searchPaginated(
    query: string,
    collectionId: CollectionId | undefined,
    paginationQuery: PaginationQuery,
  ): Promise<PaginatedResponse<RetrievalResultDTO>>;
}
