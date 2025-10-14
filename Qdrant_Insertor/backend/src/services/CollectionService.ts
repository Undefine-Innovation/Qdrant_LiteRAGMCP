import { ICollectionService, ILogger, ServiceError } from './interfaces.js';
import { DB } from '../db.js';
import { Collection, CollectionId } from 'share/type.js';

/**
 * @class CollectionService
 * @description Collection 服务的实现，负责 Collection 的业务逻辑。
 */
export class CollectionService implements ICollectionService {
  private db: DB;
  private logger: ILogger;

  constructor(db: DB, logger: ILogger) {
    this.db = db;
    this.logger = logger;
  }

  /**
   * 创建一个新的 Collection。
   * @param name Collection 的名称。
   * @param description Collection 的描述（可选）。
   * @returns 包含新创建 Collection 信息的 Promise。
   * @throws {ServiceError} 如果 Collection 名称已存在或数据库操作失败。
   */
  async createCollection(name: string, description?: string): Promise<Collection> {
    try {
      const existingCollection = this.db.getCollectionByName(name);
      if (existingCollection) {
        throw { code: 'COLLECTION_ALREADY_EXISTS', message: `Collection with name '${name}' already exists.` } as ServiceError;
      }
      const collection = this.db.createCollection(name, description);
      this.logger.info(`Collection created: ${collection.collectionId}`);
      return collection;
    } catch (error: any) {
      this.logger.error(`Failed to create collection: ${error.message}`, error);
      throw { code: error.code || 'CREATE_COLLECTION_FAILED', message: error.message } as ServiceError;
    }
  }

  /**
   * 列出所有 Collection。
   * @returns 包含所有 Collection 数组的 Promise。
   * @throws {ServiceError} 如果数据库操作失败。
   */
  async listCollections(): Promise<Collection[]> {
    try {
      const collections = this.db.listCollections();
      this.logger.debug(`Listed ${collections.length} collections.`);
      return collections;
    } catch (error: any) {
      this.logger.error(`Failed to list collections: ${error.message}`, error);
      throw { code: 'LIST_COLLECTIONS_FAILED', message: error.message } as ServiceError;
    }
  }

  /**
   * 根据 ID 获取指定 Collection。
   * @param collectionId Collection 的唯一标识符。
   * @returns 包含 Collection 信息或 null 的 Promise。
   * @throws {ServiceError} 如果数据库操作失败。
   */
  async getCollectionById(collectionId: CollectionId): Promise<Collection | null> {
    try {
      const collection = this.db.getCollectionById(collectionId);
      if (!collection) {
        this.logger.warn(`Collection not found: ${collectionId}`);
      } else {
        this.logger.debug(`Retrieved collection: ${collectionId}`);
      }
      return collection;
    } catch (error: any) {
      this.logger.error(`Failed to get collection by ID ${collectionId}: ${error.message}`, error);
      throw { code: 'GET_COLLECTION_FAILED', message: error.message } as ServiceError;
    }
  }

  /**
   * 更新指定 Collection 的信息。
   * @param collectionId Collection 的唯一标识符。
   * @param name Collection 的新名称（可选）。
   * @param description Collection 的新描述（可选）。
   * @returns 包含更新后 Collection 信息或 null 的 Promise。
   * @throws {ServiceError} 如果 Collection 不存在或数据库操作失败。
   */
  async updateCollection(collectionId: CollectionId, name?: string, description?: string): Promise<Collection | null> {
    try {
      const updatedCollection = this.db.updateCollection(collectionId, name, description);
      if (!updatedCollection) {
        throw { code: 'COLLECTION_NOT_FOUND', message: `Collection with ID '${collectionId}' not found.` } as ServiceError;
      }
      this.logger.info(`Collection updated: ${collectionId}`);
      return updatedCollection;
    } catch (error: any) {
      this.logger.error(`Failed to update collection ${collectionId}: ${error.message}`, error);
      throw { code: error.code || 'UPDATE_COLLECTION_FAILED', message: error.message } as ServiceError;
    }
  }

  /**
   * 删除指定 Collection。
   * @param collectionId Collection 的唯一标识符。
   * @returns 无返回值的 Promise。
   * @throws {ServiceError} 如果 Collection 不存在或数据库操作失败。
   */
  async deleteCollection(collectionId: CollectionId): Promise<void> {
    try {
      const existingCollection = this.db.getCollectionById(collectionId);
      if (!existingCollection) {
        throw { code: 'COLLECTION_NOT_FOUND', message: `Collection with ID '${collectionId}' not found.` } as ServiceError;
      }
      this.db.deleteCollection(collectionId);
      this.logger.info(`Collection deleted: ${collectionId}`);
    } catch (error: any) {
      this.logger.error(`Failed to delete collection ${collectionId}: ${error.message}`, error);
      throw { code: error.code || 'DELETE_COLLECTION_FAILED', message: error.message } as ServiceError;
    }
  }
}