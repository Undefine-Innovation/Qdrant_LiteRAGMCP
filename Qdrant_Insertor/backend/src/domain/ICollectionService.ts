import { Collection, CollectionId } from '@domain/types.js';

export interface ICollectionService {
  createCollection(name: string, description?: string): Collection;
  listAllCollections(): Collection[];
  getCollectionById(collectionId: CollectionId): Collection | undefined;
  deleteCollection(collectionId: CollectionId): Promise<void>;
}