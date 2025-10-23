import { Doc, DocId, CollectionId } from '@domain/types.js';

export interface IDocumentService {
  listAllDocuments(): Doc[];
  getDocumentById(docId: DocId): Doc | undefined;
  resyncDocument(docId: DocId): Promise<Doc>;
  deleteDocument(docId: DocId): Promise<void>;
}
