import { BaseRepository } from './BaseRepository.js';
import { Chunk } from '../entities/Chunk.js';
import { Logger } from '@logging/logger.js';
import { DocId, PointId } from '@domain/entities/types.js';
import type { DataSource } from 'typeorm';

interface ChunkPersistenceManager {
  save: (entities: unknown[]) => Promise<unknown>;
}

interface ChunkDeletionManager {
  delete: (entity: unknown, where: unknown) => Promise<{ affected?: number }>;
}

/**
 * 块事务管理辅助功能
 * 提供事务管理器相关的操作方法
 */
export class ChunkTransactionHelpers extends BaseRepository<Chunk> {
  constructor(dataSource: DataSource, logger: Logger) {
    super(dataSource, Chunk, logger);
  }

  /**
   * 批量创建块（带事务管理器）
   */
  async createBatchWithManager(
    chunks: Partial<Chunk>[],
    manager: ChunkPersistenceManager,
  ): Promise<Chunk[]> {
    try {
      // 预处理块数据，计算内容长度
      const processedChunks = chunks.map((chunk) => ({
        ...chunk,
        contentLength: chunk.content ? chunk.content.length : 0,
      }));

      const entities = this.repository.create(processedChunks);
      const results = (await manager.save(entities)) as Chunk[];
      this.logger.debug(`批量创建块成功`, {
        count: results.length,
      });
      return results;
    } catch (error) {
      this.logger.error(`批量创建块失败`, {
        count: chunks.length,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据文档ID删除块（带事务管理器）
   */
  async deleteByDocIdWithManager(
    docId: DocId,
    manager: ChunkDeletionManager,
  ): Promise<number> {
    try {
      const result = await manager.delete(Chunk, { docId });
      const deletedCount = result.affected || 0;
      this.logger.debug(`根据文档ID删除块成功`, {
        docId,
        count: deletedCount,
      });
      return deletedCount;
    } catch (error) {
      this.logger.error(`根据文档ID删除块失败`, {
        docId,
        error: (error as Error).message,
      });
      throw error;
    }
  }
}
