import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { Collection } from '../entities/Collection.js';
import { Doc } from '../entities/Doc.js';
import { CollectionRepository } from './CollectionRepository.js';
import { DocRepository } from './DocRepository.js';
import {
  CollectionId,
  PaginationQuery,
  PaginatedResponse,
} from '@domain/entities/types.js';
import { CollectionAggregate } from '@domain/aggregates/index.js';
import { ICollectionAggregateRepository } from '@domain/repositories/index.js';
import { Collection as DomainCollection } from '@domain/entities/Collection.js';

/**
 * 集合聚合仓储实现
 * 基于TypeORM实现集合聚合的持久化操作
 */
export class CollectionAggregateRepository
  implements ICollectionAggregateRepository
{
  private collectionRepository: CollectionRepository;
  private docRepository: DocRepository;

  /**
   * 获取集合仓储实例
   * @returns 集合仓储实例
   */
  private getCollectionRepository(): CollectionRepository {
    return this.collectionRepository;
  }

  /**
   * 构造函数
   * @param dataSource TypeORM数据源
   * @param logger 日志记录器
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: Logger,
  ) {
    // 验证数据源是否已初始化
    if (!dataSource.isInitialized) {
      this.logger.warn('CollectionAggregateRepository: DataSource未初始化');
    }
    this.collectionRepository = new CollectionRepository(dataSource, logger);
    this.docRepository = new DocRepository(dataSource, logger);
  }

  /**
   * 保存集合聚合
   * @param aggregate 集合聚合
   */
  async save(aggregate: CollectionAggregate): Promise<void> {
    try {
      // 验证DataSource是否初始化
      if (!this.dataSource.isInitialized) {
        this.logger.error('保存集合聚合失败: DataSource未初始化', {
          collectionId: aggregate.id,
        });
        throw new Error(
          'Database connection is not initialized. Please check connection configuration.',
        );
      }

      await this.dataSource.transaction(async (manager) => {
        // 保存集合实体
        const collectionEntity = this.mapAggregateToEntity(aggregate);
        await manager.save(Collection, collectionEntity);

        this.logger.debug('集合聚合保存成功', {
          collectionId: aggregate.id,
          name: aggregate.name,
        });
      });
    } catch (error) {
      this.logger.error('保存集合聚合失败', {
        collectionId: aggregate.id,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据ID查找集合聚合
   * 支持使用UUID或collectionId查找
   * @param id 集合ID (可以是UUID或业务ID)
   * @returns 集合聚合或null
   */
  async findById(id: CollectionId): Promise<CollectionAggregate | null> {
    try {
      // 先尝试通过UUID查找
      let collectionEntity = await this.collectionRepository.findById(
        id as string,
      );

      // 如果UUID查找失败，尝试通过业务collectionId查找
      if (!collectionEntity) {
        collectionEntity =
          await this.collectionRepository.findByCollectionId(id);
      }

      if (!collectionEntity) {
        return null;
      }

      // 获取集合中的文档数量
      const docCount = await this.docRepository.countByCollectionId(id);

      // 创建聚合
      return this.mapEntityToAggregate(collectionEntity, docCount);
    } catch (error) {
      this.logger.error('查找集合聚合失败', {
        collectionId: id,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据名称查找集合聚合
   * @param name 集合名称
   * @returns 集合聚合或null
   */
  async findByName(name: string): Promise<CollectionAggregate | null> {
    try {
      const collectionEntity = await this.collectionRepository.findByName(name);
      if (!collectionEntity) {
        return null;
      }

      // 获取集合中的文档数量
      const docCount = await this.docRepository.countByCollectionId(
        collectionEntity.id as CollectionId,
      );

      // 创建聚合
      return this.mapEntityToAggregate(collectionEntity, docCount);
    } catch (error) {
      this.logger.error('根据名称查找集合聚合失败', {
        name,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 检查集合名称是否已存在
   * @param name 集合名称
   * @param excludeId 排除的集合ID（用于更新时检查）
   * @returns 是否存在
   */
  async existsByName(name: string, excludeId?: CollectionId): Promise<boolean> {
    try {
      const collection = await this.collectionRepository.findByName(name);
      return collection !== null && collection.id !== excludeId;
    } catch (error) {
      this.logger.error('检查集合名称是否存在失败', {
        name,
        excludeId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 获取所有集合聚合
   * @returns 集合聚合数组
   */
  async findAll(): Promise<CollectionAggregate[]> {
    try {
      const collectionEntities = await this.collectionRepository.findAll();

      // 为每个集合获取文档数量
      const aggregates: CollectionAggregate[] = [];
      for (const entity of collectionEntities) {
        const docCount = await this.docRepository.countByCollectionId(
          entity.id as CollectionId,
        );
        aggregates.push(this.mapEntityToAggregate(entity, docCount));
      }

      return aggregates;
    } catch (error) {
      this.logger.error('获取所有集合聚合失败', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 分页获取集合聚合
   * @param query 分页查询参数
   * @returns 分页的集合聚合响应
   */
  async findPaginated(
    query: PaginationQuery,
  ): Promise<PaginatedResponse<CollectionAggregate>> {
    try {
      const { page = 1, limit = 20 } = query;

      // 获取分页的集合实体
      const result = await this.collectionRepository.findPaginated(page, limit);
      const entities = result.data ?? result.items ?? [];
      const total = result.pagination.total;

      // 为每个集合获取文档数量
      const aggregates: CollectionAggregate[] = [];
      for (const entity of entities) {
        const docCount = await this.docRepository.countByCollectionId(
          entity.id as CollectionId,
        );
        aggregates.push(this.mapEntityToAggregate(entity, docCount));
      }

      const totalPages = Math.ceil(total / limit);

      return {
        data: aggregates,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      this.logger.error('分页获取集合聚合失败', {
        query,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据名称前缀查找集合聚合
   * @param prefix 名称前缀
   * @returns 集合聚合数组
   */
  async findByPrefix(prefix: string): Promise<CollectionAggregate[]> {
    try {
      const collectionEntities =
        await this.collectionRepository.findByPrefix(prefix);

      // 为每个集合获取文档数量
      const aggregates: CollectionAggregate[] = [];
      for (const entity of collectionEntities) {
        const docCount = await this.docRepository.countByCollectionId(
          entity.id as CollectionId,
        );
        aggregates.push(this.mapEntityToAggregate(entity, docCount));
      }

      return aggregates;
    } catch (error) {
      this.logger.error('根据前缀查找集合聚合失败', {
        prefix,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 根据名称后缀查找集合聚合
   * @param suffix 名称后缀
   * @returns 集合聚合数组
   */
  async findBySuffix(suffix: string): Promise<CollectionAggregate[]> {
    try {
      const collectionEntities =
        await this.collectionRepository.findBySuffix(suffix);

      // 为每个集合获取文档数量
      const aggregates: CollectionAggregate[] = [];
      for (const entity of collectionEntities) {
        const docCount = await this.docRepository.countByCollectionId(
          entity.id as CollectionId,
        );
        aggregates.push(this.mapEntityToAggregate(entity, docCount));
      }

      return aggregates;
    } catch (error) {
      this.logger.error('根据后缀查找集合聚合失败', {
        suffix,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 查找系统集合聚合
   * @returns 系统集合聚合数组
   */
  async findSystemCollections(): Promise<CollectionAggregate[]> {
    try {
      const collectionEntities =
        await this.collectionRepository.findSystemCollections();

      // 为每个集合获取文档数量
      const aggregates: CollectionAggregate[] = [];
      for (const entity of collectionEntities) {
        const docCount = await this.docRepository.countByCollectionId(
          entity.id as CollectionId,
        );
        aggregates.push(this.mapEntityToAggregate(entity, docCount));
      }

      return aggregates;
    } catch (error) {
      this.logger.error('查找系统集合聚合失败', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 查找非系统集合聚合
   * @returns 非系统集合聚合数组
   */
  async findNonSystemCollections(): Promise<CollectionAggregate[]> {
    try {
      const collectionEntities =
        await this.collectionRepository.findNonSystemCollections();

      // 为每个集合获取文档数量
      const aggregates: CollectionAggregate[] = [];
      for (const entity of collectionEntities) {
        const docCount = await this.docRepository.countByCollectionId(
          entity.id as CollectionId,
        );
        aggregates.push(this.mapEntityToAggregate(entity, docCount));
      }

      return aggregates;
    } catch (error) {
      this.logger.error('查找非系统集合聚合失败', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 删除集合聚合
   * @param id 集合ID
   * @returns 是否成功删除
   */
  async delete(id: CollectionId): Promise<boolean> {
    try {
      // 验证DataSource是否初始化
      if (!this.dataSource.isInitialized) {
        this.logger.error('删除集合聚合失败: DataSource未初始化', {
          collectionId: id,
        });
        throw new Error(
          'Database connection is not initialized. Please check connection configuration.',
        );
      }

      await this.dataSource.transaction(async (manager) => {
        // 获取集合实体
        const collection = await manager.findOne(Collection, { where: { id } });
        if (!collection) {
          throw new Error(`Collection with ID ${id} not found`);
        }

        // 软删除集合
        collection.softDelete();
        await manager.save(collection);

        this.logger.info('集合聚合软删除成功', {
          collectionId: id,
        });
      });

      return true;
    } catch (error) {
      this.logger.error('删除集合聚合失败', {
        collectionId: id,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 检查集合是否可以被删除
   * @param id 集合ID
   * @returns 是否可以删除
   */
  async canBeDeleted(id: CollectionId): Promise<boolean> {
    try {
      const collection = await this.collectionRepository.findById(id as string);
      if (!collection) {
        return false;
      }

      // 检查是否是系统集合
      if ((collection as Collection & { is_system?: boolean }).is_system) {
        return false;
      }

      // 可以添加其他业务规则检查
      return true;
    } catch (error) {
      this.logger.error('检查集合是否可以删除失败', {
        collectionId: id,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 获取集合的文档数量
   * @param id 集合ID
   * @returns 文档数量
   */
  async getDocumentCount(id: CollectionId): Promise<number> {
    try {
      return await this.docRepository.countByCollectionId(id);
    } catch (error) {
      this.logger.error('获取集合文档数量失败', {
        collectionId: id,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 获取集合的已完成文档数量
   * @param id 集合ID
   * @returns 已完成文档数量
   */
  async getCompletedDocumentCount(id: CollectionId): Promise<number> {
    try {
      return await this.docRepository.countCompletedByCollectionId(id);
    } catch (error) {
      this.logger.error('获取集合已完成文档数量失败', {
        collectionId: id,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 更新集合的部分字段
   * @param id 集合ID
   * @param data 更新数据（包括status等字段）
   * @param data.status 集合状态
   * @returns 更新后的集合聚合或null
   */
  async updateCollection(
    id: CollectionId,
    data: { status?: 'active' | 'inactive' | 'archived' },
  ): Promise<CollectionAggregate | null> {
    try {
      // 验证DataSource是否初始化
      if (!this.dataSource.isInitialized) {
        this.logger.error('更新集合失败: DataSource未初始化', {
          collectionId: id,
        });
        throw new Error(
          'Database connection is not initialized. Please check connection configuration.',
        );
      }

      // 调用底层Repository的updateCollection方法
      const updatedEntity = await this.collectionRepository.updateCollection(
        id,
        data,
      );

      if (!updatedEntity) {
        return null;
      }

      // 获取集合中的文档数量
      const docCount = await this.docRepository.countByCollectionId(id);

      // 返回更新后的聚合
      return this.mapEntityToAggregate(updatedEntity, docCount);
    } catch (error) {
      this.logger.error('更新集合失败', {
        collectionId: id,
        data,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 将聚合映射为实体
   * @param aggregate 集合聚合
   * @returns 集合实体
   */
  private mapAggregateToEntity(aggregate: CollectionAggregate): Collection {
    const entity = new Collection();
    entity.id = aggregate.id;
    entity.collectionId = aggregate.id; // 设置collectionId字段
    entity.name = aggregate.name;
    entity.description = aggregate.description;
    entity.created_at = aggregate.createdAt;
    entity.updated_at = aggregate.updatedAt;
    return entity;
  }

  /**
   * 将实体映射为聚合
   * @param entity 集合实体
   * @param docCount 文档数量
   * @returns 集合聚合
   */
  private mapEntityToAggregate(
    entity: Collection,
    docCount: number,
  ): CollectionAggregate {
    // 首先将基础设施实体转换为领域实体
    // 使用collectionId作为业务标识符而不是数据库主键id
    const domainCollection = DomainCollection.reconstitute(
      entity.collectionId as CollectionId,
      entity.name,
      entity.description,
      typeof entity.created_at === 'number' ? entity.created_at : Date.now(),
      typeof entity.updated_at === 'number' ? entity.updated_at : Date.now(),
    );

    // 然后使用领域实体创建聚合
    return CollectionAggregate.reconstitute(domainCollection, []);
  }
}
