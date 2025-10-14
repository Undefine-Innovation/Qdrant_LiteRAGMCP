import { IVersionService, ILogger, ServiceError } from './interfaces.js';
import { DB } from '../db.js';
import { Version, VersionId, CollectionId } from 'share/type.js';

/**
 * @class VersionService
 * @description Version 服务的实现，负责 Version 的业务逻辑。
 */
export class VersionService implements IVersionService {
  private db: DB;
  private logger: ILogger;

  constructor(db: DB, logger: ILogger) {
    this.db = db;
    this.logger = logger;
  }

  /**
   * 为指定 Collection 创建一个新的 Version。
   * @param collectionId 所属 Collection 的 ID。
   * @param name Version 的名称。
   * @param description Version 的描述（可选）。
   * @returns 包含新创建 Version 信息的 Promise。
   * @throws {ServiceError} 如果 Collection 不存在或数据库操作失败。
   */
  async createVersion(collectionId: CollectionId, name: string, description?: string): Promise<Version> {
    try {
      const collection = this.db.getCollectionById(collectionId);
      if (!collection) {
        throw { code: 'COLLECTION_NOT_FOUND', message: `Collection with ID '${collectionId}' not found.` } as ServiceError;
      }
      const version = this.db.createVersion(collectionId, name, description);
      this.logger.info(`Version created: ${version.versionId} for collection ${collectionId}`);
      return version;
    } catch (error: any) {
      this.logger.error(`Failed to create version for collection ${collectionId}: ${error.message}`, error);
      throw { code: error.code || 'CREATE_VERSION_FAILED', message: error.message } as ServiceError;
    }
  }

  /**
   * 列出指定 Collection 下的所有 Version。
   * @param collectionId 所属 Collection 的 ID。
   * @returns 包含所有 Version 数组的 Promise。
   * @throws {ServiceError} 如果数据库操作失败。
   */
  async listVersions(collectionId: CollectionId): Promise<Version[]> {
    try {
      const versions = this.db.listVersions(collectionId);
      this.logger.debug(`Listed ${versions.length} versions for collection ${collectionId}.`);
      return versions;
    } catch (error: any) {
      this.logger.error(`Failed to list versions for collection ${collectionId}: ${error.message}`, error);
      throw { code: 'LIST_VERSIONS_FAILED', message: error.message } as ServiceError;
    }
  }

  /**
   * 根据 ID 获取指定 Version。
   * @param versionId Version 的唯一标识符。
   * @returns 包含 Version 信息或 null 的 Promise。
   * @throws {ServiceError} 如果数据库操作失败。
   */
  async getVersion(versionId: VersionId): Promise<Version | null> {
    try {
      const version = this.db.getVersion(versionId);
      if (!version) {
        this.logger.warn(`Version not found: ${versionId}`);
      } else {
        this.logger.debug(`Retrieved version: ${versionId}`);
      }
      return version;
    } catch (error: any) {
      this.logger.error(`Failed to get version by ID ${versionId}: ${error.message}`, error);
      throw { code: 'GET_VERSION_FAILED', message: error.message } as ServiceError;
    }
  }

  /**
   * 更新指定 Version 的状态。
   * @param versionId Version 的唯一标识符。
   * @param status Version 的新状态。
   * @returns 无返回值的 Promise。
   * @throws {ServiceError} 如果 Version 不存在或数据库操作失败。
   */
  async setVersionStatus(versionId: VersionId, status: Version['status']): Promise<void> {
    try {
      const existingVersion = await this.getVersion(versionId);
      if (!existingVersion) {
        throw { code: 'VERSION_NOT_FOUND', message: `Version with ID '${versionId}' not found.` } as ServiceError;
      }
      this.db.setVersionStatus(versionId, status);
      this.logger.info(`Version ${versionId} status updated to ${status}.`);
    } catch (error: any) {
      this.logger.error(`Failed to set version ${versionId} status: ${error.message}`, error);
      throw { code: error.code || 'SET_VERSION_STATUS_FAILED', message: error.message } as ServiceError;
    }
  }

  /**
   * 将指定 Version 设为当前版本。
   * @param versionId Version 的唯一标识符。
   * @param collectionId 所属 Collection 的 ID。
   * @returns 无返回值的 Promise。
   * @throws {ServiceError} 如果 Version 或 Collection 不存在或数据库操作失败。
   */
  async setCurrentVersion(versionId: VersionId, collectionId: CollectionId): Promise<void> {
    try {
      const existingVersion = await this.getVersion(versionId);
      if (!existingVersion) {
        throw { code: 'VERSION_NOT_FOUND', message: `Version with ID '${versionId}' not found.` } as ServiceError;
      }
      const collection = this.db.getCollectionById(collectionId);
      if (!collection) {
        throw { code: 'COLLECTION_NOT_FOUND', message: `Collection with ID '${collectionId}' not found.` } as ServiceError;
      }
      this.db.setCurrentVersion(versionId, collectionId);
      this.logger.info(`Version ${versionId} set as current for collection ${collectionId}.`);
    } catch (error: any) {
      this.logger.error(`Failed to set version ${versionId} as current: ${error.message}`, error);
      throw { code: error.code || 'SET_CURRENT_VERSION_FAILED', message: error.message } as ServiceError;
    }
  }

  /**
   * 最终确定一个临时版本，并可能合并到现有版本。
   * @param temporaryVersionId 临时版本的 ID。
   * @returns 包含最终版本 ID 和是否为新版本信息的 Promise。
   * @throws {ServiceError} 如果临时版本不存在或数据库操作失败。
   */
  async finalizeVersion(temporaryVersionId: VersionId): Promise<{ finalVersionId: VersionId; isNew: boolean }> {
    try {
      const tempVersion = await this.getVersion(temporaryVersionId);
      if (!tempVersion) {
        throw { code: 'VERSION_NOT_FOUND', message: `Temporary version with ID '${temporaryVersionId}' not found.` } as ServiceError;
      }
      if (tempVersion.status !== 'EDITING') {
        throw { code: 'INVALID_VERSION_STATUS', message: `Only versions in "EDITING" status can be finalized.` } as ServiceError;
      }
      const result = this.db.finalizeVersion(temporaryVersionId);
      this.logger.info(`Version ${temporaryVersionId} finalized to ${result.finalVersionId}. Is new: ${result.isNew}`);
      return {
        finalVersionId: result.finalVersionId as VersionId,
        isNew: result.isNew,
      };
    } catch (error: any) {
      this.logger.error(`Failed to finalize version ${temporaryVersionId}: ${error.message}`, error);
      throw { code: error.code || 'FINALIZE_VERSION_FAILED', message: error.message } as ServiceError;
    }
  }

  /**
   * 删除指定 Version。
   * @param versionId Version 的唯一标识符。
   * @returns 表示删除是否成功的 Promise。
   * @throws {ServiceError} 如果 Version 不存在或数据库操作失败。
   */
  async deleteVersion(versionId: VersionId): Promise<boolean> {
    try {
      const existingVersion = await this.getVersion(versionId);
      if (!existingVersion) {
        throw { code: 'VERSION_NOT_FOUND', message: `Version with ID '${versionId}' not found.` } as ServiceError;
      }
      const success = this.db.deleteVersion(versionId);
      if (success) {
        this.logger.info(`Version deleted: ${versionId}`);
      } else {
        this.logger.warn(`Failed to delete version: ${versionId} (DB operation returned false)`);
      }
      return success;
    } catch (error: any) {
      this.logger.error(`Failed to delete version ${versionId}: ${error.message}`, error);
      throw { code: error.code || 'DELETE_VERSION_FAILED', message: error.message } as ServiceError;
    }
  }
}