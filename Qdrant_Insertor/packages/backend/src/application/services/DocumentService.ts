import {
  Doc,
  DocId,
  CollectionId,
  PaginationQuery,
  PaginatedResponse,
  PointId,
} from '@domain/entities/types.js';
import { IDocumentService } from '@domain/repositories/IDocumentService.js';
import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';
import { ImportService } from './ImportService.js'; // Assuming ImportService handles resync logic
import { Logger } from '@logging/logger.js';
import { AppError } from '@api/contracts/error.js';

/**
 * 块数据的类型定义
 *
 * 表示从数据库返回的块数据格式，包含块的基本信息和内容。
 * 用于在文档服务中处理文档块的映射和删除操作。
 */
interface ChunkData {
  pointId: PointId;
  docId: DocId;
  collectionId: CollectionId;
  chunkIndex: number;
  title?: string;
  content: string;
}

/**
 * 文档服务实现类
 *
 * 负责管理文档的创建、查询、更新和删除操作。
 * 提供文档级别的业务逻辑，包括文档与向量数据的同步管理。
 * 支持文档的重新同步和级联删除功能。
 *
 * @example
 * ```typescript
 * const documentService = new DocumentService(sqliteRepo, importService, qdrantRepo);
 * await documentService.deleteDocument('doc-123');
 * const documents = await documentService.listDocuments('collection-456', { page: 1, limit: 10 });
 * ```
 */
export class DocumentService implements IDocumentService {
  /**
   * 构造函数
   *
   * @param sqliteRepo - SQLite 数据库仓储实例，用于本地数据持久化
   * @param importService - 导入服务实例，用于文档重新同步操作
   * @param qdrantRepo - Qdrant 向量数据库仓储实例，用于级联删除向量数据
   */
  constructor(
    private sqliteRepo: ISQLiteRepo,
    private importService: ImportService, // Use ImportService for resync
    private qdrantRepo: IQdrantRepo, // Add QdrantRepo for cascade deletion
    private readonly logger: Logger,
  ) {}

  /**
   *
   */
  listAllDocuments(): Doc[] {
    return this.sqliteRepo.docs.listAll();
  }

  /**
   *
   * @param query
   * @param collectionId
   */
  listDocumentsPaginated(
    query: PaginationQuery,
    collectionId?: CollectionId,
  ): PaginatedResponse<Doc> {
    return this.sqliteRepo.docs.listPaginated(query, collectionId);
  }

  /**
   *
   * @param docId
   */
  getDocumentById(docId: DocId): Doc | undefined {
    return this.sqliteRepo.docs.getById(docId);
  }

  /**
   *
   * @param docId
   */
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
      // 幂等删除：目标不存在视为已删除
      this.logger.info('[DeleteAudit] Document not found, no-op', { docId });
      return;
    }

    // 获取文档的所有块ID，用于从Qdrant删除
    const chunks = this.sqliteRepo.chunks.getByDocId(docId);
    const pointIds = chunks.map((chunk: ChunkData) => chunk.pointId);


    const t0 = Date.now();
    this.logger.info('[DeleteAudit] Document deletion start', {
      docId,
      collectionId: doc.collectionId,
      chunkCount: chunks.length,
    });

    try {
      // 外部向量删除
      const tq0 = Date.now();
      if (pointIds.length > 0) {
        await this.qdrantRepo.deletePoints(doc.collectionId, pointIds);
        this.logger.info('[DeleteAudit] Qdrant points deleted', {
          docId,
          collectionId: doc.collectionId,
          points: pointIds.length,
          elapsedMs: Date.now() - tq0,
        });
      } else {
        this.logger.info('[DeleteAudit] No Qdrant points to delete', {
          docId,
          collectionId: doc.collectionId,
        });
      }

      // 本地事务删除
      const ts0 = Date.now();
      this.sqliteRepo.transaction(() => {
        const deleted = this.sqliteRepo.deleteDoc(docId);
        if (!deleted) {
          throw new Error(
            `Failed to delete document ${docId} from database`,
          );
        }
      });
      this.logger.info('[DeleteAudit] SQLite doc deleted', {
        docId,
        elapsedMs: Date.now() - ts0,
      });

      this.logger.info('[DeleteAudit] Document deletion completed', {
        docId,
        totalElapsedMs: Date.now() - t0,
      });
    } catch (error) {
      this.logger.error('[DeleteAudit] Document deletion failed', {
        docId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 获取文档的块列表
   * @param docId - 文档ID
   * @returns 文档块数量
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
