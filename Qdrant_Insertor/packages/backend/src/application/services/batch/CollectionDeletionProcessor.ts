import { CollectionId } from '@domain/entities/types.js';
import { Logger } from '@logging/logger.js';
import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';

/**
 * 集合删除处理器
 * 负责处理集合的删除操作
 */
export class CollectionDeletionProcessor {
  constructor(
    private readonly qdrantRepo: IQdrantRepo,
    private readonly sqliteRepo: ISQLiteRepo,
    private readonly logger: Logger,
  ) {}

  /**
   * 删除集合
   * @param collectionId 集合ID
   * @returns {Promise<void>}
   */
  public async deleteCollection(collectionId: CollectionId): Promise<void> {
    this.logger.info(`正在删除集合: ${collectionId}`);
    const collection = this.sqliteRepo.collections.getById(collectionId);
    if (!collection) {
      this.logger.warn(`未找到集合${collectionId}。无需删除。`);
      return; // 幂等删除
    }

    await this.qdrantRepo.deletePointsByCollection(collectionId);
    this.sqliteRepo.deleteCollection(collectionId); // 使用协调deleteCollection 方法
    this.logger.info(`成功删除集合 ${collectionId} 及其关联的向量点。`);
  }
}
