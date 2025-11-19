import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { ChunkMetaRepository } from './index.js';
import { DocId, CollectionId } from '@domain/entities/types.js';

/**
 * PostgreSQL块元数据操作管理器
 * 负责块元数据相关的CRUD操作
 */
export class PostgreSQLChunkMetaOperations {
  private readonly chunkMetaRepository: ChunkMetaRepository;

  /**
   * 创建PostgreSQLChunkMetaOperations实例
   * @param dataSource TypeORM数据源
   * @param logger 日志记录器
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: Logger,
  ) {
    this.chunkMetaRepository = new ChunkMetaRepository(dataSource, logger);
  }

  /**
   * 创建块元数据
   * @param chunkId 块ID
   * @param tokenCount 令数量
   * @param embeddingStatus 嵌入状态
   * @param syncedAt 同步时间
   * @param error 错误信息
   * @returns 创建结果
   */
  async createChunkMeta(
    chunkId: string,
    tokenCount: number,
    embeddingStatus: 'pending' | 'processing' | 'completed' | 'failed',
    syncedAt?: number,
    error?: string,
  ): Promise<string> {
    try {
      const chunkMeta = await this.chunkMetaRepository.create({
        chunkId,
        tokenCount,
        embeddingStatus,
        syncedAt,
        error,
        created_at: Date.now(),
        updated_at: Date.now(),
      } as Record<string, unknown>)

      this.logger.info(`创建块元数据成功`, {
        chunkMetaId: chunkMeta.id,
        chunkId,
      });

      return chunkMeta.id as string;
    } catch (error) {
      this.logger.error(`创建块元数据失败`, {
        chunkId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 获取块元数据
   * @param id 块元数据ID
   * @returns 块元数据对象或null
   */
  async getChunkMeta(id: string): Promise<Record<string, unknown> | null> {
    try {
      const chunkMeta = await this.chunkMetaRepository.findById(id);
      return chunkMeta;
    } catch (error) {
      this.logger.error(`获取块元数据失败`, {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 更新块元数据
   * @param id 块元数据ID
   * @param updates 更新数据
   * @returns 更新结果
   */
  async updateChunkMeta(id: string, updates: Partial<Record<string, unknown>>): Promise<Record<string, unknown>> {
    try {
      const chunkMeta = await this.chunkMetaRepository.update(
        id as unknown as Record<string, unknown>,
        {
          ...updates,
          updated_at: Date.now(),
        },
      );

      this.logger.info(`更新块元数据成功`, { chunkMetaId: id });

      return chunkMeta;
    } catch (error) {
      this.logger.error(`更新块元数据失败`, {
        id,
        updates,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 根据文档ID获取块元数据
   * @param docId 文档ID
   * @returns 块元数据数组
   */
  async getChunkMetasByDocId(docId: DocId): Promise<Array<Record<string, unknown>>> {
    try {
      const chunkMetas = await this.chunkMetaRepository.findByDocId(docId);
      return chunkMetas;
    } catch (error) {
      this.logger.error(`根据文档ID获取块元数据失败`, {
        docId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 根据集合ID获取块元数据
   * @param collectionId 集合ID
   * @returns 块元数据数组
   */
  async getChunkMetasByCollectionId(
    collectionId: CollectionId,
  ): Promise<Array<Record<string, unknown>>> {
    try {
      const chunkMetas =
        await this.chunkMetaRepository.findByCollectionId(collectionId);
      return chunkMetas;
    } catch (error) {
      this.logger.error(`根据集合ID获取块元数据失败`, {
        collectionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
