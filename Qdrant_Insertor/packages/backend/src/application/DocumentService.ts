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
import { ImportService } from './ImportService.js'; // Assuming ImportService handles resync logic

export class DocumentService implements IDocumentService {
  constructor(
    private sqliteRepo: SQLiteRepo,
    private importService: ImportService, // Use ImportService for resync
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

  async deleteDocument(docId: DocId): Promise<void> {
    await this.sqliteRepo.docs.delete(docId);
    // TODO: Also delete related chunks from Qdrant and SQLite
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
}
