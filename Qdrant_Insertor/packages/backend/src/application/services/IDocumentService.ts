import {
  Doc,
  DocId,
  CollectionId,
  PaginationQuery,
  PaginatedResponse,
} from '@domain/entities/types.js';
import { PointId } from '@domain/entities/types.js';

/**
 * 文档块视图接口
 * 表示文档分块后的单个块信息
 */
export interface DocumentChunkView {
  /** 向量点ID */
  pointId: PointId;
  /** 文档ID */
  docId: DocId;
  /** 集合ID */
  collectionId: CollectionId;
  /** 块索引 */
  chunkIndex: number;
  /** 块标题（可选） */
  title?: string;
  /** 块内容 */
  content: string;
}

/**
 * 文档服务接口
 * 定义文档管理的核心操�?
 */
export interface IDocumentService {
  /**
   * 获取所有文档列�?
   * @returns 所有文档的数组
   */
  listAllDocuments(): Promise<Doc[]>;

  /**
   * 分页获取文档列表
   * @param query - 分页查询参数
   * @param collectionId - 集合ID（可选）
   * @returns 分页的文档响�?
   */
  listDocumentsPaginated(
    query: PaginationQuery,
    collectionId?: CollectionId,
  ): Promise<PaginatedResponse<Doc>>;

  /**
   * 根据ID获取文档
   * @param docId - 文档ID
   * @returns 文档对象，如果不存在则返回undefined
   */
  getDocumentById(docId: DocId): Promise<Doc | null>;

  /**
   * 重新同步文档
   * @param docId - 文档ID
   * @returns 重新同步后的文档对象
   */
  resyncDocument(docId: DocId): Promise<Doc>;

  /**
   * 获取文档的块列表
   * @param docId - 文档ID
   * @returns 文档块数�?
   */
  getDocumentChunks(docId: DocId): Promise<DocumentChunkView[]>;

  /**
   * 分页获取文档的块列表
   * @param docId - 文档ID
   * @param query - 分页查询参数
   * @returns 分页的文档块响应
   */
  getDocumentChunksPaginated(
    docId: DocId,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<DocumentChunkView>>;

  /**
   * 删除文档
   * @param docId - 要删除的文档ID
   */
  deleteDocument(docId: DocId): Promise<void>;
}
