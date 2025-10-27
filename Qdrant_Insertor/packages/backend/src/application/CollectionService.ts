import {
  Collection,
  CollectionId,
  PaginationQuery,
  PaginatedResponse,
  DocId,
  PointId,
} from '../domain/types.js';
import { ICollectionService } from '../domain/ICollectionService.js';
import { SQLiteRepo } from '../infrastructure/SQLiteRepo.js';
import { IQdrantRepo } from '../domain/IQdrantRepo.js';

export class CollectionService implements ICollectionService {
  constructor(
    private sqliteRepo: SQLiteRepo,
    private qdrantRepo: IQdrantRepo, // Add QdrantRepo for cascade deletion
  ) {}

  createCollection(name: string, description?: string): Collection {
    const collectionId = this.sqliteRepo.collections.create({
      name,
      description,
    });
    return this.sqliteRepo.collections.getById(collectionId)!;
  }

  listAllCollections(): Collection[] {
    return this.sqliteRepo.collections.listAll();
  }

  listCollectionsPaginated(
    query: PaginationQuery,
  ): PaginatedResponse<Collection> {
    return this.sqliteRepo.collections.listPaginated(query);
  }

  getCollectionById(collectionId: CollectionId): Collection | undefined {
    return this.sqliteRepo.collections.getById(collectionId);
  }

  updateCollection(
    collectionId: CollectionId,
    name?: string,
    description?: string,
  ): Collection {
    // 检查集合是否存在
    const existingCollection =
      this.sqliteRepo.collections.getById(collectionId);
    if (!existingCollection) {
      throw new Error(`Collection with ID ${collectionId} not found`);
    }

    // 如果提供了新名称，检查名称是否已被其他集合使用
    if (name && name !== existingCollection.name) {
      const existingByName = this.sqliteRepo.collections.getByName(name);
      if (existingByName) {
        throw new Error(`Collection with name '${name}' already exists`);
      }
    }

    // 更新集合
    this.sqliteRepo.collections.update(collectionId, {
      name: name || existingCollection.name,
      description:
        description !== undefined
          ? description
          : existingCollection.description,
    });

    // 返回更新后的集合
    return this.sqliteRepo.collections.getById(collectionId)!;
  }

  /**
   * 删除集合及其所有关联的文档和块（级联删除）
   * 此操作会同时从SQLite数据库和Qdrant向量数据库中删除相关数据
   * @param {CollectionId} collectionId - 要删除的集合ID
   * @returns {Promise<void>}
   * @throws {Error} 当集合不存在或删除失败时抛出错误
   */
  async deleteCollection(collectionId: CollectionId): Promise<void> {
    // 获取集合信息用于日志记录
    const collection = this.sqliteRepo.collections.getById(collectionId);
    if (!collection) {
      throw new Error(`Collection with ID ${collectionId} not found`);
    }

    // 获取集合中的所有文档
    const docs = this.sqliteRepo.docs.listByCollection(collectionId);
    const docIds = docs.map((doc) => doc.docId);

    // 收集所有文档的所有块ID，用于从Qdrant删除
    const allPointIds: PointId[] = [];
    for (const doc of docs) {
      const chunks = this.sqliteRepo.chunks.getByDocId(doc.docId);
      allPointIds.push(...chunks.map((chunk) => chunk.pointId));
    }

    // 使用事务确保删除操作的原子性
    await this.sqliteRepo.transaction(async () => {
      try {
        // 1. 从Qdrant向量数据库删除所有相关向量点
        if (allPointIds.length > 0) {
          await this.qdrantRepo.deletePoints(collectionId, allPointIds);
          console.log(
            `Deleted ${allPointIds.length} vector points from Qdrant for collection ${collectionId}`,
          );
        }

        // 2. 从SQLite数据库删除集合及其所有相关文档和块
        // CollectionManager的deleteCollection方法已经处理了级联删除
        this.sqliteRepo.deleteCollection(collectionId);

        console.log(
          `Successfully deleted collection ${collectionId}, its ${docs.length} documents, and ${allPointIds.length} chunks`,
        );
      } catch (error) {
        console.error(
          `Error during cascade deletion of collection ${collectionId}:`,
          error,
        );
        throw error;
      }
    });
  }
}
