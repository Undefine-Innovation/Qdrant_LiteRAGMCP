import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { CollectionRepository } from './index.js';
import { CollectionId } from '@domain/entities/types.js';

/**
 * PostgreSQL集合操作管理器
 * 负责集合相关的CRUD操作
 */
export class PostgreSQLCollectionOperations {
  private readonly collectionRepository: CollectionRepository;

  /**
   * 创建PostgreSQLCollectionOperations实例
   * @param dataSource TypeORM数据源
   * @param logger 日志记录器
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: Logger,
  ) {
    this.collectionRepository = new CollectionRepository(dataSource, logger);
  }

  /**
   * 创建集合
   * @param name 集合名称
   * @param description 集合描述
   * @returns 创建的集合ID
   */
  async createCollection(
    name: string,
    description?: string,
  ): Promise<CollectionId> {
    try {
      const collection = await this.collectionRepository.create({
        name,
        description,
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      this.logger.info(`创建集合成功`, { collectionId: collection.id, name });

      return collection.id as CollectionId;
    } catch (error) {
      this.logger.error(`创建集合失败`, {
        name,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 获取集合
   * @param id 集合ID
   * @returns 集合对象或null
   */
  async getCollection(id: CollectionId): Promise<Record<string, unknown> | null> {
    try {
      const collection = await this.collectionRepository.findById(id);
      return collection as unknown as Record<string, unknown>;
    } catch (error) {
      this.logger.error(`获取集合失败`, {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 获取所有集合
   * @returns 集合数组
   */
  async getAllCollections(): Promise<Array<Record<string, unknown>>> {
    try {
      const collections = await this.collectionRepository.findAll();
      return collections as unknown as Array<Record<string, unknown>>;
    } catch (error) {
      this.logger.error(`获取所有集合失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 更新集合
   * @param id 集合ID
   * @param updates 更新数据
   * @returns 更新结果
   */
  async updateCollection(
    id: CollectionId,
    updates: Partial<Record<string, unknown>>,
  ): Promise<Record<string, unknown>> {
    try {
      const collection = await this.collectionRepository.update(
        id as unknown as Record<string, unknown>,
        {
          ...updates,
          updated_at: Date.now(),
        },
      );

      this.logger.info(`更新集合成功`, { collectionId: id });

      return collection as unknown as Record<string, unknown>;
    } catch (error) {
      this.logger.error(`更新集合失败`, {
        id,
        updates,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 删除集合
   * @param id 集合ID
   * @returns 删除结果
   */
  async deleteCollection(id: CollectionId): Promise<boolean> {
    try {
      await this.collectionRepository.delete(
        id as unknown as Record<string, unknown>,
      );
      this.logger.info(`删除集合成功`, { collectionId: id });
      return true;
    } catch (error) {
      this.logger.error(`删除集合失败`, {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
