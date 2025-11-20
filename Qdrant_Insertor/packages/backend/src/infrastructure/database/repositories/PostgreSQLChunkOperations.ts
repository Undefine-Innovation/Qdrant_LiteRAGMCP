import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { ChunkRepository } from './index.js';
import { DocId, PointId, CollectionId } from '@domain/entities/types.js';

/**
 * PostgreSQL块操作管理器
 * 负责块相关的CRUD操作
 */
export class PostgreSQLChunkOperations {
  private readonly chunkRepository: ChunkRepository;

  /**
   * 创建PostgreSQLChunkOperations实例
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
   * 创建文档块
   * @param docId 文档ID
   * @param chunkIndex 块索引
   * @param title 块标题
   * @param content 块内容
   * @param pointId 点ID
   * @param collectionId 集合ID
   * @returns 创建的块ID
   */
  async createChunk(
    docId: DocId,
    chunkIndex: number,
    pointId: PointId,
    collectionId: CollectionId,
    title?: string,
    content?: string,
  ): Promise<string> {
    try {
      const chunk = await this.chunkRepository.create({
        docId,
        chunkIndex,
        pointId,
        collectionId,
        title,
        content,
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      this.logger.info(`创建文档块成功`, {
        chunkId: chunk.id,
        docId,
        chunkIndex,
      });

      return chunk.id as string;
    } catch (error) {
      this.logger.error(`创建文档块失败`, {
        docId,
        chunkIndex,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 获取文档块
   * @param id 块ID
   * @returns 块对象或null
   */
  async getChunk(id: string): Promise<Record<string, unknown> | null> {
    try {
      const chunk = await this.chunkRepository.findById(id);
      return chunk as unknown as Record<string, unknown>;
    } catch (error) {
      this.logger.error(`获取文档块失败`, {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 根据文档ID获取块列表
   * @param docId 文档ID
   * @returns 块数组
   */
  async getChunksByDocId(docId: DocId): Promise<Array<Record<string, unknown>>> {
    try {
      const chunks = await this.chunkRepository.findByDocId(docId);
      return chunks as unknown as Array<Record<string, unknown>>;
    } catch (error) {
      this.logger.error(`根据文档ID获取块列表失败`, {
        docId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 更新文档块
   * @param id 块ID
   * @param updates 更新数据
   * @returns 更新结果
   */
  async updateChunk(id: string, updates: Partial<Record<string, unknown>>): Promise<Record<string, unknown>> {
    try {
      const chunk = await this.chunkRepository.update(
        id as unknown as Record<string, unknown>,
        {
          ...updates,
          updated_at: Date.now(),
        },
      );

      this.logger.info(`更新文档块成功`, { chunkId: id });

      return chunk as unknown as Record<string, unknown>;
    } catch (error) {
      this.logger.error(`更新文档块失败`, {
        id,
        updates,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 删除文档块
   * @param id 块ID
   * @returns 删除结果
   */
  async deleteChunk(id: string): Promise<boolean> {
    try {
      await this.chunkRepository.delete(
        id as unknown as Record<string, unknown>,
      );
      this.logger.info(`删除文档块成功`, { chunkId: id });
      return true;
    } catch (error) {
      this.logger.error(`删除文档块失败`, {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
