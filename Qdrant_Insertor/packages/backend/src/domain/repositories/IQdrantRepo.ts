import { Schemas } from '@qdrant/js-client-rest';
import { SearchResult, CollectionId, PointId, DocId } from '@domain/entities/types.js';

/**
 * Qdrant向量点接�?
 * 定义向量数据库中的点结构
 */
export interface Point {
  /** 点的唯一标识�?*/
  id: PointId;
  /** 向量数据 */
  vector: number[];
  /** 点的元数据载�?*/
  payload: {
    /** 关联的文档ID */
    docId: DocId;
    /** 关联的集合ID */
    collectionId: CollectionId;
    /** 块在文档中的索引 */
    chunkIndex: number;
    /** 块的内容 */
    content: string;
    /** 内容哈希值（可选） */
    contentHash?: string;
    /** 标题链（可选） */
    titleChain?: string;
  };
}

/**
 * Qdrant仓库接口
 * 定义向量数据库操作的核心方法
 */
export interface IQdrantRepo {
  /**
   * 确保集合存在，如果不存在则创�?
   * @param collectionId - 集合ID
   */
  ensureCollection(collectionId: CollectionId): Promise<void>;

  /**
   * 向集合中插入或更新向量点
   * @param collectionId - 集合ID
   * @param points - 要插入的向量点数�?
   */
  upsertCollection(collectionId: CollectionId, points: Point[]): Promise<void>;

  /**
   * 在集合中搜索相似的向�?
   * @param collectionId - 集合ID
   * @param opts - 搜索选项，包含向量、限制条件和过滤�?
   * @returns 搜索结果数组
   */
  search(
    collectionId: CollectionId,
    opts: {
      vector: number[];
      limit?: number;
      filter?: Schemas['Filter'];
    },
  ): Promise<SearchResult[]>;

  /**
   * 删除指定文档的所有向量点
   * @param docId - 文档ID
   */
  deletePointsByDoc(docId: DocId): Promise<void>;

  /**
   * 删除指定集合的所有向量点
   * @param collectionId - 集合ID
   */
  deletePointsByCollection(collectionId: CollectionId): Promise<void>;

  /**
   * 获取集合中所有向量点的ID
   * @param collectionId - 集合ID
   * @returns 向量点ID数组
   */
  getAllPointIdsInCollection(collectionId: CollectionId): Promise<PointId[]>;

  /**
   * 删除指定的向量点
   * @param collectionId - 集合ID
   * @param pointIds - 要删除的向量点ID数组
   */
  deletePoints(collectionId: CollectionId, pointIds: PointId[]): Promise<void>;
}
