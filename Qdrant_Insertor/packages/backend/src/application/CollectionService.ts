import {
  Collection,
  CollectionId,
  PaginationQuery,
  PaginatedResponse,
} from '../domain/types.js';
import { ICollectionService } from '../domain/ICollectionService.js';
import { SQLiteRepo } from '../infrastructure/SQLiteRepo.js';

export class CollectionService implements ICollectionService {
  constructor(private sqliteRepo: SQLiteRepo) {}

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

  async deleteCollection(collectionId: CollectionId): Promise<void> {
    await this.sqliteRepo.collections.delete(collectionId);
    // TODO: Also delete related documents and chunks from Qdrant and SQLite
  }
}
