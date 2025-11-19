import {
  DataSource,
  Repository,
  EntityTarget,
  DeepPartial,
  FindOptionsWhere,
  FindOptionsOrder,
  ObjectLiteral,
} from 'typeorm';
import { LoggerLike } from '@domain/repositories/IDatabaseRepository.js';
import {
  IRepository,
  PaginationOptions,
  PaginatedResult,
  BatchOperationResult,
  QueryOptions,
} from '@domain/repositories/IRepository.js';

/**
 * 抽象仓库基类
 * 实现基础CRUD操作，提供通用功能
 */
export abstract class AbstractRepository<T extends ObjectLiteral, ID>
  implements IRepository<T, ID>
{
  protected readonly dataSource: DataSource;
  protected readonly entityClass: EntityTarget<T>;
  protected readonly logger: LoggerLike;
  protected readonly repository: Repository<T>;

  constructor(
    dataSource: DataSource,
    entityClass: EntityTarget<T>,
    logger: LoggerLike,
  ) {
    this.dataSource = dataSource;
    this.entityClass = entityClass;
    this.logger = logger;
    this.repository = dataSource.getRepository(entityClass);
  }

  /**
   * 创建新实体
   * @param entity 要创建的实体数据
   * @returns 创建完成的实体
   */
  async create(entity: Partial<T>): Promise<T> {
    try {
      this.logger.debug(`Creating entity for ${this.getEntityName()}`, {
        entity,
      });
      const newEntity = this.repository.create(entity as DeepPartial<T>);
      const result = await this.repository.save(newEntity);
      this.logger.info(
        `Successfully created entity for ${this.getEntityName()}`,
        {
          id: this.getEntityId(result),
        },
      );
      return result as T;
    } catch (error) {
      this.handleError(
        `Failed to create entity for ${this.getEntityName()}`,
        error,
        { entity },
      );
    }
  }

  /**
   * 根据ID查找实体
   * @param id 实体ID
   * @returns 找到的实体或null
   */
  async findById(id: ID): Promise<T | null> {
    try {
      this.logger.debug(`Finding entity by ID for ${this.getEntityName()}`, {
        id,
      });
      const whereCondition: FindOptionsWhere<T> = {
        id,
      } as unknown as FindOptionsWhere<T>;
      const result = await this.repository.findOne({ where: whereCondition });
      return result || null;
    } catch (error) {
      this.handleError(
        `Failed to find entity by ID for ${this.getEntityName()}`,
        error,
        { id },
      );
    }
  }

  /**
   * 根据条件查找实体列表
   * @param criteria 查找条件
   * @returns 匹配的实体列表
   */
  async find(criteria: Partial<T>): Promise<T[]> {
    try {
      this.logger.debug(`Finding entities for ${this.getEntityName()}`, {
        criteria,
      });
      const whereCondition: FindOptionsWhere<T> =
        criteria as unknown as FindOptionsWhere<T>;
      const results = await this.repository.find({ where: whereCondition });
      return results;
    } catch (error) {
      this.handleError(
        `Failed to find entities for ${this.getEntityName()}`,
        error,
        { criteria },
      );
    }
  }

  /**
   * 根据条件查找单个实体
   * @param criteria 查找条件
   * @returns 找到的实体或null
   */
  async findOne(criteria: Partial<T>): Promise<T | null> {
    try {
      this.logger.debug(`Finding one entity for ${this.getEntityName()}`, {
        criteria,
      });
      const whereCondition: FindOptionsWhere<T> =
        criteria as unknown as FindOptionsWhere<T>;
      const result = await this.repository.findOne({ where: whereCondition });
      return result || null;
    } catch (error) {
      this.handleError(
        `Failed to find one entity for ${this.getEntityName()}`,
        error,
        { criteria },
      );
    }
  }

  /**
   * 更新实体
   * @param id 实体ID
   * @param data 要更新的数据
   * @returns 更新后的实体
   */
  async update(id: ID, data: Partial<T>): Promise<T> {
    try {
      this.logger.debug(`Updating entity for ${this.getEntityName()}`, {
        id,
        data,
      });
      const whereCondition: FindOptionsWhere<T> = {
        id,
      } as unknown as FindOptionsWhere<T>;

      await this.repository.update(whereCondition, data as DeepPartial<T>);

      const updatedEntity = await this.findById(id);
      if (!updatedEntity) {
        throw new Error(
          `Entity not found after update for ${this.getEntityName()} with ID: ${id}`,
        );
      }

      this.logger.info(
        `Successfully updated entity for ${this.getEntityName()}`,
        { id },
      );
      return updatedEntity;
    } catch (error) {
      this.handleError(
        `Failed to update entity for ${this.getEntityName()}`,
        error,
        { id, data },
      );
    }
  }

  /**
   * 删除实体
   * @param id 实体ID
   * @returns 是否成功删除
   */
  async delete(id: ID): Promise<boolean> {
    try {
      this.logger.debug(`Deleting entity for ${this.getEntityName()}`, { id });
      const whereCondition: FindOptionsWhere<T> = {
        id,
      } as unknown as FindOptionsWhere<T>;

      const result = await this.repository.delete(whereCondition);
      const success = (result.affected || 0) > 0;

      if (success) {
        this.logger.info(
          `Successfully deleted entity for ${this.getEntityName()}`,
          { id },
        );
      } else {
        this.logger.warn(
          `No entity found to delete for ${this.getEntityName()}`,
          { id },
        );
      }

      return success;
    } catch (error) {
      this.handleError(
        `Failed to delete entity for ${this.getEntityName()}`,
        error,
        { id },
      );
    }
  }

  /**
   * 统计实体数量
   * @param criteria 统计条件（可选）
   * @returns 匹配的实体数量
   */
  async count(criteria?: Partial<T>): Promise<number> {
    try {
      this.logger.debug(`Counting entities for ${this.getEntityName()}`, {
        criteria,
      });
      const whereCondition: FindOptionsWhere<T> = (criteria ||
        {}) as unknown as FindOptionsWhere<T>;
      const count = await this.repository.count({ where: whereCondition });
      return count;
    } catch (error) {
      this.handleError(
        `Failed to count entities for ${this.getEntityName()}`,
        error,
        { criteria },
      );
    }
  }

  /**
   * 检查实体是否存在
   * @param criteria 检查条件
   * @returns 是否存在匹配的实体
   */
  async exists(criteria: Partial<T>): Promise<boolean> {
    try {
      this.logger.debug(
        `Checking entity existence for ${this.getEntityName()}`,
        { criteria },
      );
      const whereCondition: FindOptionsWhere<T> =
        criteria as unknown as FindOptionsWhere<T>;
      const count = await this.repository.count({ where: whereCondition });
      return count > 0;
    } catch (error) {
      this.handleError(
        `Failed to check entity existence for ${this.getEntityName()}`,
        error,
        { criteria },
      );
    }
  }

  /**
   * 获取实体名称
   * @returns 实体名称
   */
  protected getEntityName(): string {
    if (typeof this.entityClass === 'string') return this.entityClass;
    if (typeof this.entityClass === 'function') return this.entityClass.name;
    return 'Unknown';
  }

  /**
   * 获取实体ID
   * @param entity 实体对象
   * @returns 实体ID
   */
  protected getEntityId(entity: T): ID | undefined {
    if (entity && typeof entity === 'object' && 'id' in entity) {
      return (entity as unknown as { id?: ID }).id as ID | undefined;
    }
    return undefined;
  }

  /**
   * 标准化错误处理
   * @param message 错误消息
   * @param error 错误对象
   * @param meta 元数据
   */
  protected handleError(
    message: string,
    error: unknown,
    meta?: Record<string, unknown>,
  ): never {
    try {
      this.logger.error(message, {
        ...meta,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    } catch (e) {
      // 确保不会掩盖原始错误
    }
    if (error instanceof Error) throw error;
    throw new Error(String(error));
  }

  /**
   * 创建查询构建器
   * @param alias 别名
   * @returns 查询构建器
   */
  protected createQueryBuilder(alias?: string) {
    return this.repository.createQueryBuilder(alias || this.getEntityName());
  }

  /**
   * 验证实体数据
   * @param entity 实体数据
   * @returns 验证结果
   */
  protected validateEntity(entity: Partial<T>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // 基础验证逻辑，子类可以重写
    if (!entity || typeof entity !== 'object') {
      errors.push('Entity must be a valid object');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 记录性能指标
   * @param operation 操作名称
   * @param duration 持续时间（毫秒）
   * @param metadata 元数据
   */
  protected logPerformance(
    operation: string,
    duration: number,
    metadata?: Record<string, unknown>,
  ): void {
    this.logger.debug(`Performance metric for ${this.getEntityName()}`, {
      operation,
      duration,
      entityName: this.getEntityName(),
      ...metadata,
    });
  }

  /**
   * 执行操作并记录性能
   * @param operation 操作名称
   * @param fn 要执行的函数
   * @param metadata 元数据
   * @returns 操作结果
   */
  protected async executeWithPerformance<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>,
  ): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      this.logPerformance(operation, duration, metadata);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logPerformance(operation, duration, { ...metadata, error: true });
      throw error;
    }
  }
}
