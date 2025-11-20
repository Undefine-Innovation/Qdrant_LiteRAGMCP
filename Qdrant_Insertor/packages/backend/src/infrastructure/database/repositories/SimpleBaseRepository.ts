import {
  DataSource,
  Repository,
  ObjectLiteral,
  FindOptionsWhere,
} from 'typeorm';
import { Logger } from '@logging/logger.js';

/**
 * 简单的BaseRepository实现
 * 用于替代抽象的BaseRepository类
 */
export class SimpleBaseRepository<T extends ObjectLiteral> {
  protected readonly repository: Repository<T>;
  protected readonly logger: Logger;

  /**
   * 创建SimpleBaseRepository实例
   * @param dataSource TypeORM数据源
   * @param entity 实体类
   * @param logger 日志记录器
   */
  constructor(dataSource: DataSource, entity: new () => T, logger: Logger) {
    this.repository = dataSource.getRepository(entity);
    this.logger = logger;
  }

  /**
   * 创建实体
   * @param data 实体数据
   * @returns 创建的实体
   */
  async create(data: Partial<T>): Promise<T> {
    try {
      const entity = this.repository.create(data as unknown as T);
      const result = await this.repository.save(entity);
      this.logger.debug(`创建实体成功`, { entity: result });
      return result;
    } catch (error) {
      this.logger.error(`创建实体失败`, { error });
      throw error;
    }
  }

  /**
   * 批量创建实体
   * @param dataList 实体数据数组
   * @returns 创建的实体数组
   */
  async createBatch(dataList: Partial<T>[]): Promise<T[]> {
    try {
      const entities = this.repository.create(dataList as unknown as T[]);
      const results = await this.repository.save(entities);
      this.logger.debug(`批量创建实体成功`, { count: results.length });
      return results;
    } catch (error) {
      this.logger.error(`批量创建实体失败`, { error });
      throw error;
    }
  }

  /**
   * 根据ID查找实体
   * @param id 实体ID
   * @returns 找到的实体或null
   */
  async findById(id: string): Promise<T | null> {
    try {
      /** 查询条件 */
      const where: FindOptionsWhere<T> = { id: id as unknown as T[keyof T] };
      const result = await this.repository.findOne({
        where,
      });
      this.logger.debug(`根据ID查找实体成功`, { id });
      return result || null;
    } catch (error) {
      this.logger.error(`根据ID查找实体失败`, { id, error });
      throw error;
    }
  }

  /**
   * 查找所有实体
   * @param options 查询选项
   * @returns 实体数组
   */
  async findAll(options?: Record<string, unknown>): Promise<T[]> {
    try {
      const results = await this.repository.find(options || {});
      this.logger.debug(`查找所有实体成功`, { count: results.length });
      return results;
    } catch (error) {
      this.logger.error(`查找所有实体失败`, { error });
      throw error;
    }
  }

  /**
   * 获取所有实体 - findAll的别名，用于向后兼容
   * @param options 查询选项或布尔值（activeOnly参数）
   * @returns 实体数组
   */
  async getAll(options?: Record<string, unknown> | boolean): Promise<T[]> {
    // 如果传入的是布尔值（activeOnly参数），尝试构建过滤条件
    if (typeof options === 'boolean') {
      try {
        const where: FindOptionsWhere<T> = {
          is_active: options,
        } as unknown as FindOptionsWhere<T>;
        const results = await this.repository.find({
          where,
        });
        return results;
      } catch (error) {
        // 如果实体没有is_active字段，就直接返回所有
        return this.findAll();
      }
    }
    return this.findAll(options as Record<string, unknown>);
  }

  /**
   * Upsert操作 - 如果记录存在则更新，不存在则创建
   * @param data 实体数据
   * @returns 创建或更新后的实体
   */
  async upsert(data: Partial<T>): Promise<T> {
    try {
      // 如果数据中有id字段，先检查是否存在
      if ('id' in data && data.id) {
        const existing = await this.findById(data.id as string);
        if (existing) {
          return (await this.update(data.id as string, data)) as T;
        }
      }
      // 如果没有id或不存在，创建新记录
      return await this.create(data);
    } catch (error) {
      this.logger.error(`Upsert实体失败`, { data, error });
      throw error;
    }
  }

  /**
   * 更新实体
   * @param id 实体ID
   * @param data 更新数据
   * @returns 更新后的实体或null
   */
  async update(id: string, data: Partial<T>): Promise<T | null> {
    try {
      await this.repository.update(id, data as unknown as T);
      /** 查询条件 */
      const where: FindOptionsWhere<T> = { id: id as unknown as T[keyof T] };
      const result = await this.repository.findOne({
        where,
      });
      this.logger.debug(`更新实体成功`, { id });
      return result || null;
    } catch (error) {
      this.logger.error(`更新实体失败`, { id, error });
      throw error;
    }
  }

  /**
   * 删除实体
   * @param id 实体ID
   * @returns 是否删除成功
   */
  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.repository.delete(id);
      this.logger.debug(`删除实体成功`, { id });
      return (result.affected || 0) > 0;
    } catch (error) {
      this.logger.error(`删除实体失败`, { id, error });
      throw error;
    }
  }

  /**
   * 统计实体数量
   * @param options 查询选项
   * @returns 实体数量
   */
  async count(options?: Record<string, unknown>): Promise<number> {
    try {
      const result = await this.repository.count(options || {});
      this.logger.debug(`统计实体数量成功`, { count: result });
      return result;
    } catch (error) {
      this.logger.error(`统计实体数量失败`, { error });
      throw error;
    }
  }

  /**
   * 执行原始查询
   * @param query SQL查询语句
   * @param parameters 查询参数
   * @returns 查询结果
   */
  async query(query: string, parameters: unknown[] = []): Promise<unknown> {
    try {
      const result = await this.repository.query(query, parameters);
      this.logger.debug(`执行查询成功`, { query });
      return result;
    } catch (error) {
      this.logger.error(`执行查询失败`, { query, error });
      throw error;
    }
  }

  /**
   * 获取Repository实例
   * @returns TypeORM Repository实例
   */
  getRepository(): Repository<T> {
    return this.repository;
  }
}
