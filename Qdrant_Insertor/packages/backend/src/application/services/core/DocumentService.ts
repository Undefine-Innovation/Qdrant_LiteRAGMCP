import {
  CollectionId,
  Doc,
  DocId,
  PaginatedResponse,
  PaginationQuery,
  PointId,
} from '@domain/entities/types.js';
import { IDocumentService } from '@domain/repositories/IDocumentService.js';
import { IDocumentAggregateRepository } from '@domain/repositories/index.js';
import { ImportService } from '../batch/ImportService.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';
import { AppError } from '@api/contracts/error.js';
import { Logger, EnhancedLogger, LogTag } from '@logging/logger.js';
import { IEventPublisher } from '@domain/events/index.js';
import { DocumentAggregate } from '@domain/aggregates/index.js';
import { Chunk } from '@domain/entities/Chunk.js';
import { DocumentChunkView } from '@domain/repositories/IDocumentService.js';
import { FILE_CONSTANTS } from '@domain/constants/FileConstants.js';

/**
 * Default page size for document pagination
 */
const DEFAULT_PAGE_SIZE = FILE_CONSTANTS.DEFAULT_PAGE_SIZE;

/**
 * Document service implementation
 * Provides document management operations including CRUD, search, and chunk management
 */
export class DocumentService implements IDocumentService {
  /**
   * Constructor
   * @param documentRepository - Document aggregate repository instance
   * @param importService - Import service instance
   * @param qdrantRepo - Qdrant repository instance
   * @param eventPublisher - Event publisher instance
   * @param logger - Logger instance
   * @param enhancedLogger - Optional enhanced logger instance
   */
  constructor(
    private readonly documentRepository: IDocumentAggregateRepository,
    private readonly importService: ImportService,
    private readonly qdrantRepo: IQdrantRepo,
    private readonly eventPublisher: IEventPublisher,
    private readonly logger: Logger,
    private readonly enhancedLogger?: EnhancedLogger,
  ) {}

  /**
   * Lists all documents
   * @returns Promise resolving to array of all documents
   */
  async listAllDocuments(): Promise<Doc[]> {
    const documents: Doc[] = [];
    let page = 1;
    let hasNext = true;

    while (hasNext) {
      const pageResult = await this.documentRepository.findPaginated({
        page,
        limit: DEFAULT_PAGE_SIZE,
      });
      documents.push(...pageResult.data.map((aggregate) => this.mapDoc(aggregate)));
      hasNext = pageResult.pagination.hasNext;
      page += 1;
    }

    return documents;
  }

  /**
   * Lists documents with pagination
   * @param query - Pagination query parameters
   * @param collectionId - Optional collection ID to filter by
   * @returns Promise resolving to paginated document response
   */
  async listDocumentsPaginated(
    query: PaginationQuery,
    collectionId?: CollectionId,
  ): Promise<PaginatedResponse<Doc>> {
    const normalizedQuery: PaginationQuery = {
      page: query.page ?? 1,
      limit: query.limit ?? DEFAULT_PAGE_SIZE,
      sort: query.sort,
      order: query.order,
    };

    const result = collectionId
      ? await this.documentRepository.findByCollectionIdPaginated(
          collectionId,
          normalizedQuery,
        )
      : await this.documentRepository.findPaginated(normalizedQuery);

    return {
      data: result.data.map((aggregate) => this.mapDoc(aggregate)),
      pagination: result.pagination,
    };
  }

  /**
   * Gets document by ID
   * @param docId - Document ID to retrieve
   * @returns Promise resolving to document or null if not found
   */
  async getDocumentById(docId: DocId): Promise<Doc | null> {
    const aggregate = await this.documentRepository.findById(docId);
    return aggregate ? this.mapDoc(aggregate) : null;
  }

  /**
   * Resyncs document
   * @param docId - Document ID to resync
   * @returns Promise resolving to resynced document
   */
  async resyncDocument(docId: DocId): Promise<Doc> {
    return await this.importService.resyncDocument(docId);
  }

  /**
   * Gets document chunks
   * @param docId - Document ID to get chunks for
   * @returns Promise resolving to array of document chunk views
   */
  async getDocumentChunks(docId: DocId): Promise<DocumentChunkView[]> {
    const aggregate = await this.getAggregateOrThrow(docId);
    return aggregate
      .getSortedChunks()
      .map((chunk) => this.mapChunk(chunk));
  }

  /**
   * Gets document chunks with pagination
   * @param docId - Document ID to get chunks for
   * @param query - Pagination query parameters
   * @returns Promise resolving to paginated document chunk response
   */
  async getDocumentChunksPaginated(
    docId: DocId,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<DocumentChunkView>> {
    const aggregate = await this.getAggregateOrThrow(docId);
    const chunks = aggregate.getSortedChunks().map((chunk) => this.mapChunk(chunk));
    return this.paginate(chunks, query);
  }

  /**
   * Deletes document
   * @param docId - Document ID to delete
   * @returns Promise resolving when deletion is complete
   */
  async deleteDocument(docId: DocId): Promise<void> {
    const aggregate = await this.getAggregateOrThrow(docId);
    const doc = this.mapDoc(aggregate);
    const documentLogger = this.enhancedLogger?.withTag(LogTag.DOCUMENT);

    const pointIds = aggregate
      .getChunks()
      .map((chunk) => chunk.pointId)
      .filter(Boolean) as PointId[];

    this.logger.info('[DeleteAudit] Document deletion start', {
      docId,
      collectionId: doc.collectionId,
      chunkCount: pointIds.length,
    });

    documentLogger?.info('��ʼɾ���ĵ�', undefined, {
      docId,
      collectionId: doc.collectionId,
      chunkCount: pointIds.length,
    });

    if (pointIds.length > 0) {
      await this.qdrantRepo.deletePoints(doc.collectionId, pointIds);
    }

    const deleted = await this.documentRepository.delete(docId);
    if (!deleted) {
      throw AppError.createInternalServerError(
        `Failed to delete document ${docId} from repository`,
      );
    }

    await this.eventPublisher.publishBatch(aggregate.getDomainEvents());
    aggregate.clearDomainEvents();

    this.logger.info('[DeleteAudit] Document deletion completed', {
      docId,
      collectionId: doc.collectionId,
    });

    documentLogger?.info('�ĵ�ɾ�����', undefined, {
      docId,
      collectionId: doc.collectionId,
    });
  }

  /**
   * Gets document aggregate or throws error if not found
   * @param docId - Document ID to retrieve
   * @returns Promise resolving to document aggregate
   * @throws Error if document not found
   */
  private async getAggregateOrThrow(docId: DocId): Promise<DocumentAggregate> {
    const aggregate = await this.documentRepository.findById(docId);
    if (!aggregate) {
      throw AppError.createNotFoundError(
        `Document with ID ${docId as string} not found`,
      );
    }
    return aggregate;
  }

  /**
   * Maps document aggregate to document DTO
   * @param aggregate - Document aggregate to map
   * @returns Document DTO
   */
  private mapDoc(aggregate: DocumentAggregate): Doc {
    const raw = aggregate.document.toObject();
    return {
      id: raw.docId,
      docId: raw.docId,
      collectionId: raw.collectionId,
      key: raw.key,
      name: raw.name,
      size_bytes: raw.size_bytes,
      mime: raw.mime,
      content: raw.content,
      status: raw.status,
      is_deleted: raw.is_deleted,
      created_at: raw.created_at,
      updated_at: raw.updated_at,
    };
  }

  /**
   * Maps chunk entity to document chunk view
   * @param chunk - Chunk entity to map
   * @returns Document chunk view
   */
  private mapChunk(chunk: Chunk): DocumentChunkView {
    const raw = chunk.toObject();
    return {
      pointId: raw.pointId,
      docId: raw.docId,
      collectionId: raw.collectionId,
      chunkIndex: raw.chunkIndex,
      title: raw.title,
      content: raw.content,
    };
  }

  /**
   * Paginates array of items
   * @param items - Items to paginate
   * @param query - Pagination query parameters
   * @returns Paginated response
   */
  private paginate<T>(
    items: T[],
    query: PaginationQuery,
  ): PaginatedResponse<T> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const start = (page - 1) * limit;
    const end = start + limit;
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / limit) || 1);

    return {
      data: items.slice(start, end),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }
}
