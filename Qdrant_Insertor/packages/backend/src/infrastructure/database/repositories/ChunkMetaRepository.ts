import { DataSource, FindOptionsWhere } from 'typeorm';
import { BaseRepository } from './BaseRepository.js';
import { ChunkMeta } from '../entities/ChunkMeta.js';
import { Logger } from '@logging/logger.js';
import { CollectionId, DocId } from '@domain/entities/types.js';

/**
 * 块元数据Repository
 * 提供块元数据相关的数据库操作
 */
export class ChunkMetaRepository extends BaseRepository<ChunkMeta> {
  /**
   * 创建ChunkMetaRepository实例
   * @param dataSource TypeORM数据源
   * @param logger 日志记录器
   */
  constructor(dataSource: DataSource, logger: Logger) {
    super(dataSource, ChunkMeta, logger);
  }

  /**
   * 根据文档ID查找块元数据
   * @param docId 文档ID
   * @returns 块元数据数组
   */
  async findByDocId(docId: DocId): Promise<ChunkMeta[]> {
    try {
      const results = await this.repository!.find({
        where: {
          docId: docId as unknown as string,
        } as FindOptionsWhere<ChunkMeta>,
        order: { chunkIndex: 'ASC' },
      });
      return results;
    } catch (error) {
      this.logger.error(`根据文档ID查找块元数据失败`, {
        docId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据集合ID查找块元数据
   * @param collectionId 集合ID
   * @returns 块元数据数组
   */
  async findByCollectionId(collectionId: CollectionId): Promise<ChunkMeta[]> {
    try {
      const results = await this.repository!.find({
        where: {
          collectionId: collectionId as unknown as string,
        } as FindOptionsWhere<ChunkMeta>,
        order: { chunkIndex: 'ASC' },
      });
      return results;
    } catch (error) {
      this.logger.error(`根据集合ID查找块元数据失败`, {
        collectionId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据点ID数组删除块元数据
   * @param pointIds 点ID数组
   * @returns 删除的记录数
   */
  async deleteByPointIds(pointIds: string[]): Promise<number> {
    try {
      if (pointIds.length === 0) {
        return 0;
      }

      const result = await this.repository!.delete(pointIds);
      const deletedCount = result.affected || 0;
      this.logger.debug(`根据点ID数组删除块元数据成功`, {
        count: deletedCount,
      });
      return deletedCount;
    } catch (error) {
      this.logger.error(`根据点ID数组删除块元数据失败`, {
        pointIds,
        error: (error as Error).message,
      });
      throw error;
    }
  }
}
