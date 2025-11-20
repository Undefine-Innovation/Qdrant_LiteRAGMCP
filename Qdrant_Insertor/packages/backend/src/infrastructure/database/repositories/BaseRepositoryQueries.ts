import {
  DataSource,
  EntityTarget,
  ObjectLiteral,
  Repository,
  FindOptionsWhere,
  DeepPartial,
  In,
} from 'typeorm';
import { Logger } from '@logging/logger.js';

/**
 * BaseRepository查询功能
 * 提供基础查询操作
 */
export class BaseRepositoryQueries<T extends ObjectLiteral> {
  /**
   * 创建BaseRepositoryQueries实例
   * @param dataSource TypeORM数据源
   * @param entity 实体类
   * @param logger 日志记录器
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly entity: EntityTarget<T>,
    private readonly logger: Logger,
  ) {}

  /**
   * 获取Repository实例
   * @returns {Repository<T>} Repository实例
   */
  protected getRepository(): Repository<T> {
    return this.dataSource.getRepository(this.entity);
  }

  /**
   * 根据ID查找实体
   * @param id 实体ID
   * @param {object} [options] 查询选项
   * @param {(keyof T)[]} [options.select] 选择字段
   * @returns 实体或null
   */
  async findById(
    id: string | number,
    options?: { select?: (keyof T)[] },
  ): Promise<T | null> {
    try {
      const repository = this.getRepository();
      const queryOptions: { select?: (keyof T)[]; where?: FindOptionsWhere<T> | FindOptionsWhere<T>[] } = {};
      if (options?.select) {
        queryOptions.select = options.select;
      }
      const whereCondition = {
        id,
        ...queryOptions.where,
      } as unknown as FindOptionsWhere<T>;
      const result = await repository.findOne({
        ...queryOptions,
        where: whereCondition,
      });
      return result || null;
    } catch (error) {
      this.logger.error(`根据ID查找实体失败`, {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 根据ID数组查找实体
   * @param ids 实体ID数组
   * @param options 查询选项
   * @param options.select 要选择的字段
   * @returns 找到的实体数组
   */
  async findByIds(
    ids: (string | number)[],
    options?: { select?: (keyof T)[] },
  ): Promise<T[]> {
    try {
      const repository = this.getRepository();
      const queryOptions: { select?: (keyof T)[]; where?: FindOptionsWhere<T> | FindOptionsWhere<T>[] } = {};
      if (options?.select) {
        queryOptions.select = options.select;
      }
      const whereCondition = {
        id: In(ids),
        ...queryOptions.where,
      } as unknown as FindOptionsWhere<T>;
      return repository.find({
        ...queryOptions,
        where: whereCondition,
      });
    } catch (error) {
      this.logger.error(`根据ID数组查找实体失败`, {
        ids,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 查找所有实体
   * @param options 查询选项
   * @param options.select 要选择的字段
   * @returns 所有实体数组
   */
  async findAll(options?: { select?: (keyof T)[] }): Promise<T[]> {
    try {
      const repository = this.getRepository();
      const queryOptions: { select?: (keyof T)[]; where?: FindOptionsWhere<T> | FindOptionsWhere<T>[] } = {};
      if (options?.select) {
        queryOptions.select = options.select;
      }
      return repository.find(queryOptions);
    } catch (error) {
      this.logger.error(`查找所有实体失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 根据条件查找实体
   * @param where 查询条件
   * @param options 查询选项
   * @returns 匹配的实体数组
   */
  async findBy(
    where: FindOptionsWhere<T>,
    options?: Omit<{ select?: (keyof T)[] }, 'where'>,
  ): Promise<T[]> {
    try {
      const repository = this.getRepository();
      const queryOptions: { select?: (keyof T)[]; where?: FindOptionsWhere<T> | FindOptionsWhere<T>[] } = {};
      if (options?.select) {
        queryOptions.select = options.select;
      }
      return repository.find({
        ...queryOptions,
        where,
      });
    } catch (error) {
      this.logger.error(`根据条件查找实体失败`, {
        where,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 根据条件查找单个实体
   * @param where 查询条件
   * @param options 查询选项
   * @returns 找到的实体或null
   */
  async findOneBy(
    where: FindOptionsWhere<T>,
    options?: Omit<{ select?: (keyof T)[] }, 'where'>,
  ): Promise<T | null> {
    try {
      const repository = this.getRepository();
      const queryOptions: { select?: (keyof T)[]; where?: FindOptionsWhere<T> | FindOptionsWhere<T>[] } = {};
      if (options?.select) {
        queryOptions.select = options.select;
      }
      const result = await repository.findOne({
        ...queryOptions,
        where,
      });
      return result || null;
    } catch (error) {
      this.logger.error(`根据条件查找单个实体失败`, {
        where,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 统计实体数量
   * @param where 统计条件
   * @returns 实体数量
   */
  async count(where?: FindOptionsWhere<T>): Promise<number> {
    try {
      const repository = this.getRepository();
      return repository.count({ where });
    } catch (error) {
      this.logger.error(`统计实体数量失败`, {
        where,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 更新实体
   * @param criteria 更新条件
   * @param data 更新数据
   * @returns 更新结果
   */
  async update(
    criteria: FindOptionsWhere<T>,
    data: DeepPartial<T>,
  ): Promise<unknown> {
    try {
      const repository = this.getRepository();
      // TypeORM's update expects an internal QueryDeepPartialEntity type which
      // does not align with our DeepPartial<T> generic in all TS versions.
      // Use a controlled eslint-disable here to avoid large refactors.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await repository.update(criteria, data as any);
      const updatedFields = Object.keys(data as Record<string, unknown>);
      this.logger.debug(`更新实体成功`, {
        criteria,
        updatedFields,
      });
      return result;
    } catch (error) {
      this.logger.error(`更新实体失败`, {
        criteria,
        data,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 删除实体
   * @param criteria 删除条件
   */
  async delete(criteria: FindOptionsWhere<T>): Promise<void> {
    try {
      const repository = this.getRepository();
      await repository.delete(criteria);
      this.logger.debug(`删除实体成功`, { criteria });
    } catch (error) {
      this.logger.error(`删除实体失败`, {
        criteria,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 软删除实体
   * @param criteria 删除条件
   * @returns 删除结果
   */
  async softDelete(criteria: FindOptionsWhere<T>): Promise<unknown> {
    try {
      const repository = this.getRepository();
      const updateData = { deleted: true, deleted_at: new Date() };
      // See note above regarding QueryDeepPartialEntity vs DeepPartial<T>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await repository.update(criteria, updateData as any);
      this.logger.debug(`软删除实体成功`, { criteria });
      return result;
    } catch (error) {
      this.logger.error(`软删除实体失败`, {
        criteria,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
