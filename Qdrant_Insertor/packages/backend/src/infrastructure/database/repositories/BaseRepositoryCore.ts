import {
  DataSource,
  FindOptionsWhere,
  Repository,
  EntityTarget,
  DeepPartial,
  FindManyOptions,
  FindOneOptions,
  UpdateResult,
  ObjectLiteral,
} from 'typeorm';
import { Logger } from '@logging/logger.js';

/**
 * BaseRepository核心功能
 * 提供基础的CRUD操作
 */
export class BaseRepositoryCore<T extends ObjectLiteral> {
  /**
   * 创建BaseRepositoryCore实例
   * @param dataSource TypeORM数据源
   * @param entity 实体类
   * @param logger 日志记录器
   */
  constructor(
    protected readonly dataSource: DataSource,
    protected readonly entity: EntityTarget<T>,
    protected readonly logger: Logger,
  ) {}

  /**
   * 获取Repository实例
   * @returns {Repository<any>} Repository实例
   */
  protected getRepository(): Repository<T> {
    return this.dataSource.getRepository<T>(this.entity as EntityTarget<T>);
  }

  /**
   * 获取Repository实例
   * @returns {Repository<any>} Repository实例
   */
  protected get repository(): Repository<T> {
    return this.getRepository();
  }

  /**
   * 创建实体
   * @param data 实体数据
   * @returns 创建的实体
   */
  async create(data: Partial<T>): Promise<T> {
    try {
      const repository = this.getRepository();
      const entity = repository.create(data as DeepPartial<T>);
      const result = await repository.save(entity as DeepPartial<T>);
      const createdId = (result as unknown as { id?: unknown }).id;
      this.logger.debug(`创建实体成功`, { id: createdId });
      return result as T;
    } catch (error) {
      this.logger.error(`创建实体失败`, {
        data,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 根据ID查找实体
   * @param id 实体ID
   * @returns 实体或null
   */
  async findById(id: string | number): Promise<T | null> {
    try {
      const repository = this.getRepository();
      const whereCondition = { id } as unknown as FindOptionsWhere<T>;
      return await repository.findOne({ where: whereCondition } as FindOneOptions<T>);
    } catch (error) {
      this.logger.error(`根据ID查找实体失败`, {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 查找所有实体
   * @param options 查询选项
   * @returns 实体数组
   */
  async findAll(options?: FindManyOptions<T>): Promise<T[]> {
    try {
      const repository = this.getRepository();
      return await repository.find(options);
    } catch (error) {
      this.logger.error(`查找所有实体失败`, {
        options,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 根据条件查找实体
   * @param where 查询条件
   * @param options 查询选项
   * @returns 实体数组
   */
  async find(where: FindOptionsWhere<T>, options?: FindManyOptions<T>): Promise<T[]> {
    try {
      const repository = this.getRepository();
      return await repository.find({ where, ...(options as FindManyOptions<T>) });
    } catch (error) {
      this.logger.error(`根据条件查找实体失败`, {
        where,
        options,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 根据条件查找单个实体
   * @param where 查询条件
   * @param options 查询选项
   * @returns 实体或null
   */
  async findOne(where: FindOptionsWhere<T>, options?: FindOneOptions<T>): Promise<T | null> {
    try {
      const repository = this.getRepository();
      return await repository.findOne({ where, ...(options as FindOneOptions<T>) });
    } catch (error) {
      this.logger.error(`根据条件查找单个实体失败`, {
        where,
        options,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 更新实体
   * @param id 实体ID
   * @param data 更新数据
   * @returns 更新后的实体
   */
  async update(id: string | number, data: Partial<T>): Promise<T | null> {
    try {
      const repository = this.getRepository();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await repository.update(id, data as any); // TypeORM 的 update 方法需要特定的内部类型
      const whereCondition = { id } as unknown as FindOptionsWhere<T>;
      const result = await repository.findOne({ where: whereCondition } as FindOneOptions<T>);
      this.logger.debug(`更新实体成功`, { id });
      return result;
    } catch (error) {
      this.logger.error(`更新实体失败`, {
        id,
        data,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 根据条件更新实体
   * @param where 查询条件
   * @param data 更新数据
   * @returns 更新结果
   */
  async updateBy(where: FindOptionsWhere<T>, data: Partial<T>): Promise<UpdateResult> {
    try {
      const repository = this.getRepository();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await repository.update(where, data as any); // TypeORM 的 update 方法需要特定的内部类型
      this.logger.debug(`根据条件更新实体成功`, {
        where,
        affected: result.affected,
      });
      return result;
    } catch (error) {
      this.logger.error(`根据条件更新实体失败`, {
        where,
        data,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 删除实体
   * @param id 实体ID
   * @returns 删除结果
   */
  async delete(id: string | number): Promise<boolean> {
    try {
      const repository = this.getRepository();
      const result = await repository.delete(id);
      const success = (result.affected || 0) > 0;
      this.logger.debug(`删除实体${success ? '成功' : '失败'}`, { id });
      return success;
    } catch (error) {
      this.logger.error(`删除实体失败`, {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 根据条件删除实体
   * @param where 查询条件
   * @returns 删除结果
   */
  async deleteBy(where: FindOptionsWhere<T>): Promise<boolean> {
    try {
      const repository = this.getRepository();
      const result = await repository.delete(where);
      const success = (result.affected || 0) > 0;
      this.logger.debug(`根据条件删除实体${success ? '成功' : '失败'}`, {
        where,
      });
      return success;
    } catch (error) {
      this.logger.error(`根据条件删除实体失败`, {
        where,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 统计实体数量
   * @param where 查询条件
   * @returns 实体数量
   */
  async count(where?: FindOptionsWhere<T>): Promise<number> {
    try {
      const repository = this.getRepository();
      return await repository.count({ where });
    } catch (error) {
      this.logger.error(`统计实体数量失败`, {
        where,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 检查实体是否存在
   * @param where 查询条件
   * @returns 是否存在
   */
  async exists(where: FindOptionsWhere<T>): Promise<boolean> {
    try {
      const repository = this.getRepository();
      const count = await repository.count({ where });
      return count > 0;
    } catch (error) {
      this.logger.error(`检查实体是否存在失败`, {
        where,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

