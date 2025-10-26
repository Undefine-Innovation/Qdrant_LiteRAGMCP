import { SQLiteRepoCore } from './SQLiteRepoCore.js';
import { Logger } from '../logger.js';
import { CollectionId } from '../domain/types.js';

/**
 * 集合管理器
 * 负责集合相关的数据库操作
 */
export class CollectionManager {
  constructor(
    private readonly collections: any, // CollectionsTable
    private readonly core: SQLiteRepoCore,
    private readonly logger: Logger,
  ) {}

  /**
   * 删除一个集合及其所有关联的文档和块。
   * 这是一个事务性操作。
   * @param collectionId 要删除的集合 ID。
   */
  deleteCollection(collectionId: CollectionId): void {
    const collection = this.collections.getById(collectionId);
    if (!collection) {
      this.logger.warn('deleteCollection: no such collectionId', collectionId);
      return;
    }

    this.core.transaction(() => {
      // 首先，删除与集合关联的所有块及其元数据。
      this.collections.chunkMeta.deleteByCollectionId(collectionId);
      this.collections.chunksFts5.deleteByCollectionId(collectionId);

      // 然后，删除集合中的所有文档。
      const docsInCollection =
        this.collections.docs.listByCollection(collectionId);
      for (const doc of docsInCollection) {
        this.collections.docs.hardDelete(doc.docId);
      }

      // 最后，删除集合本身。
      this.collections.delete(collectionId);
    });

    this.logger.info(
      `Collection ${collectionId} and its associated data have been deleted.`,
    );
  }

  /**
   * 获取所有集合的 ID。
   * @returns 包含所有集合 ID 的数组。
   */
  async getAllCollectionIds(): Promise<CollectionId[]> {
    const collections = this.collections.listAll();
    return collections.map((c: any) => c.collectionId);
  }
}
