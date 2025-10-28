import {
  Doc,
  DocId,
  CollectionId,
  PaginationQuery,
  PaginatedResponse,
  DocumentChunk,
} from '../domain/types.js';

/**
 * 文档服务接口
 * 定义文档管理的核心操作
 */
export interface IDocumentService {
  /**
   * 获取所有文档列表
   * @returns 所有文档的数组
   */
  listAllDocuments(): Doc[];

  /**
   * 分页获取文档列表
   * @param query - 分页查询参数
   * @param collectionId - 集合ID（可选）
   * @returns 分页的文档响应
   */
  listDocumentsPaginated(
    query: PaginationQuery,
    collectionId?: CollectionId,
  ): PaginatedResponse<Doc>;

  /**
   * 根据ID获取文档
   * @param docId - 文档ID
   * @returns 文档对象，如果不存在则返回undefined
   */
  getDocumentById(docId: DocId): Doc | undefined;

  /**
   * 重新同步文档
   * @param docId - 文档ID
   * @returns 重新同步后的文档对象
   */
  resyncDocument(docId: DocId): Promise<Doc>;

  /**
   * 获取文档的块列表
   * @param docId - 文档ID
   * @returns 文档块数组
   */
  getDocumentChunks(docId: DocId): DocumentChunk[];

  /**
   * 分页获取文档的块列表
   * @param docId - 文档ID
   * @param query - 分页查询参数
   * @returns 分页的文档块响应
   */
  getDocumentChunksPaginated(
    docId: DocId,
    query: PaginationQuery,
  ): PaginatedResponse<DocumentChunk>;

  /**
   * 删除文档
   * @param docId - 要删除的文档ID
   */
  deleteDocument(docId: DocId): Promise<void>;
}
