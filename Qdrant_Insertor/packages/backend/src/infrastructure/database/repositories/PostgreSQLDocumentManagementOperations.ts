import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import {
  DocRepository,
  ChunkRepository,
  ChunkMetaRepository,
} from './index.js';
import {
  DocId,
  CollectionId,
  PointId,
  DocumentChunk,
  Doc as DomainDoc,
} from '@domain/entities/types.js';

/**
 * PostgreSQL文档管理操作管理器
 * 负责文档管理相关操作
 */
export class PostgreSQLDocumentManagementOperations {
  private readonly docRepository: DocRepository;
  private readonly chunkRepository: ChunkRepository;
  private readonly chunkMetaRepository: ChunkMetaRepository;

  /**
   * 创建PostgreSQLDocumentManagementOperations实例
   * @param dataSource TypeORM数据源
   * @param logger 日志记录器
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: Logger,
  ) {
    this.docRepository = new DocRepository(dataSource, logger);
    this.chunkRepository = new ChunkRepository(dataSource, logger);
    this.chunkMetaRepository = new ChunkMetaRepository(dataSource, logger);
  }

  /**
   * 添加文档块
   * @param docId 文档ID
   * @param documentChunks 文档块数组
   */
  async addChunks(
    docId: DocId,
    documentChunks: DocumentChunk[],
  ): Promise<void> {
    try {
      const chunkEntities = documentChunks.map((chunk) => ({
        docId,
        chunkIndex: chunk.chunkIndex,
        title: chunk.title,
        content: chunk.content,
        pointId: chunk.pointId,
        collectionId: chunk.collectionId,
        created_at: Date.now(),
        updated_at: Date.now(),
      }));

      await this.chunkRepository.createBatch(chunkEntities);

      this.logger.info(`添加文档块成功`, {
        docId,
        count: documentChunks.length,
      });
    } catch (error) {
      this.logger.error(`添加文档块失败`, {
        docId,
        count: documentChunks.length,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 标记文档为已同步
   * @param docId 文档ID
   */
  async markDocAsSynced(docId: DocId): Promise<void> {
    try {
      await this.docRepository.update(
        { id: docId } as Record<string, unknown>,
        {
          updated_at: Date.now(),
        },
      );

      this.logger.info(`标记文档为已同步成功`, { docId });
    } catch (error) {
      this.logger.error(`标记文档为已同步失败`, {
        docId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 获取所有集合的ID
   * @returns 包含所有集合ID的数组
   */
  async getAllCollectionIds(): Promise<CollectionId[]> {
    try {
      // 假设有一个方法来获取所有集合
      // 这里需要根据实际的集合Repository实现来调整
      const collections = (await this.dataSource.query(`
        SELECT DISTINCT collectionId FROM docs WHERE deleted = false
      `)) as Array<Record<string, unknown>>;

      return collections
        .map((row) => String(row['collectionid'] ?? row['collectionId'] ?? ''))
        .filter((id) => id.length > 0) as CollectionId[];
    } catch (error) {
      this.logger.error(`获取所有集合ID失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 列出已删除的文档
   * @returns 已删除的文档数组
   */
  async listDeletedDocs(): Promise<DomainDoc[]> {
    try {
      // 假设有一个isDeleted字段来标记已删除的文档
      const docs = await this.docRepository.findAll();
      return docs.filter((doc) => {
        const rec = doc as unknown as Record<string, unknown>;
        const deletedFlag = rec['isDeleted'] ?? rec['deleted'] ?? false;
        return Boolean(deletedFlag);
      }) as unknown as DomainDoc[];
    } catch (error) {
      this.logger.error(`列出已删除的文档失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 硬删除文档
   * @param docId 文档ID
   */
  async hardDelete(docId: DocId): Promise<void> {
    try {
      await this.docRepository.delete(
        { id: docId } as Record<string, unknown>,
      );
      this.logger.info(`硬删除文档成功`, { docId });
    } catch (error) {
      this.logger.error(`硬删除文档失败`, {
        docId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 批量删除块元数据
   * @param pointIds 要删除的点ID数组
   */
  async deleteBatch(pointIds: PointId[]): Promise<void> {
    try {
      // 先删除相关的块元数据
      for (const pointId of pointIds) {
        const chunks = await this.chunkRepository.findByPointIds([pointId]);
        for (const chunk of chunks) {
          const idVal = (chunk as unknown as Record<string, unknown>)['id'];
          await this.chunkMetaRepository.delete(
            { id: idVal } as Record<string, unknown>,
          );
        }
      }

      // 然后删除块
      for (const pointId of pointIds) {
        const chunks = await this.chunkRepository.findByPointIds([pointId]);
        for (const chunk of chunks) {
          const idVal = (chunk as unknown as Record<string, unknown>)['id'];
          await this.chunkRepository.delete(
            { id: idVal } as Record<string, unknown>,
          );
        }
      }

      this.logger.info(`批量删除块元数据成功`, { count: pointIds.length });
    } catch (error) {
      this.logger.error(`批量删除块元数据失败`, {
        pointIds,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
