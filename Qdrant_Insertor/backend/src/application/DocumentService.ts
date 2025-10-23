import { Doc, DocId } from '@domain/types.js';
import { IDocumentService } from '@domain/IDocumentService.js';
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
}
