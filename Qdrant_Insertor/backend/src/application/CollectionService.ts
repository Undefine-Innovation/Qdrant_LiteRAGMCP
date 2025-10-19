import { Collection, CollectionId } from '@domain/types.js';
import { ICollectionService } from '@domain/ICollectionService.js';
import { SQLiteRepo } from '../infrastructure/SQLiteRepo.js';

export class CollectionService implements ICollectionService {
  constructor(private sqliteRepo: SQLiteRepo) {}

  createCollection(name: string, description?: string): Collection {
    const collectionId = this.sqliteRepo.collections.create({ name, description });
    return this.sqliteRepo.collections.getById(collectionId)!;
  }

  listAllCollections(): Collection[] {
    return this.sqliteRepo.collections.listAll();
  }

  getCollectionById(collectionId: CollectionId): Collection | undefined {
    return this.sqliteRepo.collections.getById(collectionId);
  }

  async deleteCollection(collectionId: CollectionId): Promise<void> {
    await this.sqliteRepo.collections.delete(collectionId);
    // TODO: Also delete related documents and chunks from Qdrant and SQLite
  }
}