import {
  Collection,
  CollectionId,
  PaginationQuery,
  PaginatedResponse,
} from '../domain/types.js';

/**
 * 集合服务接口
 * 定义集合管理的核心操作
 */
export interface ICollectionService {
  /**
   * 创建新集合
   * @param name - 集合名称
   * @param description - 集合描述（可选）
   * @returns 创建的集合对象
   */
  createCollection(name: string, description?: string): Collection;
  
  /**
   * 获取所有集合列表
   * @returns 所有集合的数组
   */
  listAllCollections(): Collection[];
  
  /**
   * 分页获取集合列表
   * @param query - 分页查询参数
   * @returns 分页的集合响应
   */
  listCollectionsPaginated(
    query: PaginationQuery,
  ): PaginatedResponse<Collection>;
  
  /**
   * 根据ID获取集合
   * @param collectionId - 集合ID
   * @returns 集合对象，如果不存在则返回undefined
   */
  getCollectionById(collectionId: CollectionId): Collection | undefined;
  
  /**
   * 更新集合信息
   * @param collectionId - 集合ID
   * @param name - 新的集合名称（可选）
   * @param description - 新的集合描述（可选）
   * @returns 更新后的集合对象
   */
  updateCollection(
    collectionId: CollectionId,
    name?: string,
    description?: string,
  ): Collection;
  
  /**
   * 删除集合
   * @param collectionId - 要删除的集合ID
   */
  deleteCollection(collectionId: CollectionId): Promise<void>;
}
