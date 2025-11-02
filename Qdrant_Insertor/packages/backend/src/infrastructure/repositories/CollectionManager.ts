import { SQLiteRepoCore } from './SQLiteRepositoryCore.js';
import { Logger } from '@logging/logger.js';
import { CollectionId } from '@domain/entities/types.js';
import { CollectionsTable } from '@infrastructure/sqlite/dao/CollectionsTable.js';
import { ChunkMetaTable } from '@infrastructure/sqlite/dao/ChunkMetaTable.js';
import { ChunksFts5Table } from '@infrastructure/sqlite/dao/ChunksFts5Table.js';
import { DocsTable } from '@infrastructure/sqlite/dao/DocsTable.js';
import { TransactionManager } from '@infrastructure/transactions/TransactionManager.js';

/**
 * 集合管理器
 * 负责集合相关的数据库操作
 */
export class CollectionManager {
  /**
   * 创建集合管理器实例
   *
   * @param collections - 集合表操作对象
   * @param core - SQLite仓库核心
   * @param transactionManager - 事务管理器（可选）
   * @param logger - 日志记录器
   */
  constructor(
    private readonly collections: {
      getById: (id: CollectionId) => { collectionId: CollectionId } | undefined;
      delete: (id: CollectionId) => void;
      chunkMeta: ChunkMetaTable;
      chunksFts5: ChunksFts5Table;
      docs: DocsTable;
      listAll: () => { collectionId: CollectionId }[];
    },
    private readonly core: SQLiteRepoCore,
    private readonly logger: Logger,
    private readonly transactionManager?: TransactionManager,
  ) {}

  /**
   * 删除一个集合及其所有关联的文档和块
   * 这是一个事务性操作
   *
   * @param collectionId 要删除的集合 ID
   */
  async deleteCollection(collectionId: CollectionId): Promise<void> {
    // 如果有事务管理器，使用事务管理器
    if (this.transactionManager) {
      // 需要导入QdrantRepo，这里暂时使用null
      // 在实际使用中，需要通过依赖注入提供QdrantRepo
      return this.transactionManager.deleteCollectionInTransaction(
        collectionId,
        this.collections,
      );
    }

    // 回退到原始实现
    const collection = this.collections.getById(collectionId);
    if (!collection) {
      this.logger.warn('deleteCollection: no such collectionId', collectionId);
      return;
    }

    this.core.transaction(() => {
      // 首先，删除与集合关联的所有块及其元数据
      this.collections.chunkMeta.deleteByCollectionId(collectionId);
      this.collections.chunksFts5.deleteByCollectionId(collectionId);

      // 然后，删除集合中的所有文档
      const docsInCollection =
        this.collections.docs.listByCollection(collectionId);
      for (const doc of docsInCollection) {
        this.collections.docs.hardDelete(doc.docId);
      }

      // 最后，删除集合本身
      this.collections.delete(collectionId);
    });

    this.logger.info(
      `Collection ${collectionId} and its associated data have been deleted.`,
    );
  }

  /**
   * 获取所有集合的 ID
   * 
   * @returns 包含所有集合ID 的数组
   */
  async getAllCollectionIds(): Promise<CollectionId[]> {
    const collections = this.collections.listAll();
    return collections.map((c: { collectionId: CollectionId }) => c.collectionId);
  }
}