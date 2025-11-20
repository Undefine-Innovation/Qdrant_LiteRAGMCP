import { Logger } from '@logging/logger.js';
import { TypeORMRepositoryTransactions } from './TypeORMRepositoryTransactions.js';
import { CollectionId } from '@domain/entities/types.js';

/**
 * TypeORM Repository 集合相关操作方法
 */
export class TypeORMRepositoryCollections extends TypeORMRepositoryTransactions {
  /**
   * 删除一个集合及其所有关联的文档和块
   * @param collectionId 要删除的集合ID
   */
  async deleteCollection(collectionId: CollectionId): Promise<void> {
    await this.asyncTransaction(async () => {
      // 删除关联的块
      await this.chunkRepository.deleteByCollectionId(collectionId);

      // 删除关联的文档
      const docs = await this.docs.listByCollection(collectionId);
      for (const doc of docs) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await this.docs.delete((doc as any).docId);
      }

      // 删除集合
      await this.collections.delete(collectionId);

      this.logger.info(`删除集合成功`, { collectionId });
    });
  }

  /**
   * 获取所有集合的ID
   * @returns 包含所有集合ID的数组
   */
  async getAllCollectionIds(): Promise<CollectionId[]> {
    try {
      const collections = await this.collections.listAll();

      return collections.map(
        (collection: unknown) =>
          (collection as { id: string }).id as CollectionId,
      );
    } catch (error) {
      this.logger.error(`获取所有集合ID失败`, {
        error: (error as Error).message,
      });
      throw error;
    }
  }
}