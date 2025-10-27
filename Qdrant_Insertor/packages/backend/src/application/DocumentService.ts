import {
  Doc,
  DocId,
  CollectionId,
  PaginationQuery,
  PaginatedResponse,
  PointId,
} from '../domain/types.js';
import { IDocumentService } from '../domain/IDocumentService.js';
import { SQLiteRepo } from '../infrastructure/SQLiteRepo.js';
import { IQdrantRepo } from '../domain/IQdrantRepo.js';
import { ImportService } from './ImportService.js'; // Assuming ImportService handles resync logic

export class DocumentService implements IDocumentService {
  constructor(
    private sqliteRepo: SQLiteRepo,
    private importService: ImportService, // Use ImportService for resync
    private qdrantRepo: IQdrantRepo, // Add QdrantRepo for cascade deletion
  ) {}

  listAllDocuments(): Doc[] {
    return this.sqliteRepo.docs.listAll();
  }

  listDocumentsPaginated(
    query: PaginationQuery,
    collectionId?: CollectionId,
  ): PaginatedResponse<Doc> {
    return this.sqliteRepo.docs.listPaginated(query, collectionId);
  }

  getDocumentById(docId: DocId): Doc | undefined {
    return this.sqliteRepo.docs.getById(docId);
  }

  async resyncDocument(docId: DocId): Promise<Doc> {
    // Leverage ImportService's resync functionality
    return this.importService.resyncDocument(docId);
  }

  /**
   * 删除文档及其所有关联的块（级联删除）
   * 此操作会同时从SQLite数据库和Qdrant向量数据库中删除相关数据
   * @param {DocId} docId - 要删除的文档ID
   * @returns {Promise<void>}
   * @throws {Error} 当文档不存在或删除失败时抛出错误
   */
  async deleteDocument(docId: DocId): Promise<void> {
    // 获取文档信息用于日志记录
    const doc = this.sqliteRepo.docs.getById(docId);
    if (!doc) {
      throw new Error(`Document with ID ${docId} not found`);
    }

    // 获取文档的所有块ID，用于从Qdrant删除
    const chunks = this.sqliteRepo.chunks.getByDocId(docId);
    const pointIds = chunks.map((chunk) => chunk.pointId);

    // 使用事务确保删除操作的原子性
    await this.sqliteRepo.transaction(async () => {
      try {
        // 1. 从Qdrant向量数据库删除相关向量点
        if (pointIds.length > 0) {
          await this.qdrantRepo.deletePoints(doc.collectionId, pointIds);
          console.log(
            `Deleted ${pointIds.length} vector points from Qdrant for document ${docId}`,
          );
        }

        // 2. 从SQLite数据库删除文档及其所有相关块
        // DocumentManager的deleteDoc方法已经处理了级联删除
        const deleted = this.sqliteRepo.deleteDoc(docId);

        if (!deleted) {
          throw new Error(`Failed to delete document ${docId} from database`);
        }

        console.log(
          `Successfully deleted document ${docId} and its ${chunks.length} chunks`,
        );
      } catch (error) {
        console.error(
          `Error during cascade deletion of document ${docId}:`,
          error,
        );
        throw error;
      }
    });
  }

  /**
   * 获取文档的块列表
   * @param docId - 文档ID
   * @returns 文档块数组
   */
  getDocumentChunks(docId: DocId): Array<{
    pointId: PointId;
    docId: DocId;
    collectionId: CollectionId;
    chunkIndex: number;
    title?: string;
    content: string;
  }> {
    return this.sqliteRepo.chunks.getByDocId(docId);
  }

  /**
   * 分页获取文档的块列表
   * @param docId - 文档ID
   * @param query - 分页查询参数
   * @returns 分页的文档块响应
   */
  getDocumentChunksPaginated(
    docId: DocId,
    query: PaginationQuery,
  ): PaginatedResponse<{
    pointId: PointId;
    docId: DocId;
    collectionId: CollectionId;
    chunkIndex: number;
    title?: string;
    content: string;
  }> {
    return this.sqliteRepo.chunks.listPaginatedByDocId(docId, query);
  }
}
