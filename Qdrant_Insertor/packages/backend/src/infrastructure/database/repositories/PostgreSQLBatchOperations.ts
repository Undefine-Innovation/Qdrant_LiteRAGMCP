import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { ChunkRepository } from './index.js';
import {
  DocId,
  PointId,
  CollectionId,
  DocumentChunk,
} from '@domain/entities/types.js';

/**
 * PostgreSQL批量操作管理器
 * 负责批量创建等操作
 */
export class PostgreSQLBatchOperations {
  private readonly chunkRepository: ChunkRepository;

  /**
   * 创建PostgreSQLBatchOperations实例
   * @param dataSource TypeORM数据源
   * @param logger 日志记录器
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: Logger,
  ) {
    this.chunkRepository = new ChunkRepository(dataSource, logger);
  }

  /**
   * 批量创建文档块
   * @param chunks 块数组
   * @returns 创建结果
   */
  async createBatchChunks(
    chunks: Array<{
      docId: DocId;
      chunkIndex: number;
      title?: string;
      content: string;
      pointId: PointId;
      collectionId: CollectionId;
    }>,
  ): Promise<string[]> {
    try {
      const chunkEntities = chunks.map((chunk) => ({
        docId: chunk.docId,
        chunkIndex: chunk.chunkIndex,
        title: chunk.title,
        content: chunk.content,
        pointId: chunk.pointId,
        collectionId: chunk.collectionId,
        created_at: Date.now(),
        updated_at: Date.now(),
      }));

      const createdChunks =
        await this.chunkRepository.createBatch(chunkEntities);

      const chunkIds = createdChunks.map((chunk) => chunk.id as string);
      this.logger.info(`批量创建文档块成功`, { count: chunkIds.length });

      return chunkIds;
    } catch (error) {
      this.logger.error(`批量创建文档块失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
