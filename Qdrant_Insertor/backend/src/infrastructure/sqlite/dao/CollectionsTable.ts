import type { Database } from 'better-sqlite3';
import {
  INSERT_COLLECTION,
  SELECT_COLLECTION_BY_ID,
  SELECT_COLLECTION_BY_NAME,
  SELECT_ALL_COLLECTIONS,
  UPDATE_COLLECTION,
  DELETE_COLLECTION_BY_ID,
} from '../sql/collections.sql.js';
import type { Collection, CollectionId } from '../../../../../share/type.js';
import { makeCollectionId } from '../../../../../share/utils/id.js';

/**
 * Data Access Object for the `collections` table.
 * Encapsulates all SQL interactions for collections.
 */
export class CollectionsTable {
  private db: Database;

  /**
   * @param db The database instance.
   */
  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Creates a new collection record.
   * @param data - The data for the new collection.
   * @returns The ID of the newly created collection.
   */
  create(data: Omit<Collection, 'collectionId' | 'created_at'>): CollectionId {
    const collectionId = makeCollectionId() as CollectionId;
    const createdAt = Date.now();
    const stmt = this.db.prepare(INSERT_COLLECTION);
    stmt.run(collectionId, data.name, data.description, createdAt);
    return collectionId;
  }

  /**
   * Retrieves a collection by its ID.
   * @param collectionId - The ID of the collection to retrieve.
   * @returns The collection object, or undefined if not found.
   */
  getById(collectionId: CollectionId): Collection | undefined {
    const stmt = this.db.prepare(SELECT_COLLECTION_BY_ID);
    const row = stmt.get(collectionId) as Collection | undefined;
    return row;
  }

  /**
   * Retrieves a collection by its name.
   * @param name - The name of the collection to retrieve.
   * @returns The collection object, or undefined if not found.
   */
  getByName(name: string): Collection | undefined {
    const stmt = this.db.prepare(SELECT_COLLECTION_BY_NAME);
    const row = stmt.get(name) as Collection | undefined;
    return row;
  }

  /**
   * Retrieves all collections from the database.
   * @returns An array of all collections.
   */
  listAll(): Collection[] {
    const stmt = this.db.prepare(SELECT_ALL_COLLECTIONS);
    return stmt.all() as Collection[];
  }

  /**
   * Updates an existing collection.
   * @param collectionId - The ID of the collection to update.
   * @param data - The data to update. Only provided fields will be updated.
   */
  update(collectionId: CollectionId, data: Partial<Omit<Collection, 'collectionId' | 'created_at'>>): void {
    const stmt = this.db.prepare(UPDATE_COLLECTION);
    stmt.run(data.name, data.description, collectionId);
  }

  /**
   * Deletes a collection by its ID.
   * @param collectionId - The ID of the collection to delete.
   */
  delete(collectionId: CollectionId): void {
    const stmt = this.db.prepare(DELETE_COLLECTION_BY_ID);
    stmt.run(collectionId);
  }
}