import {
  DataSource,
  Between,
  EntityTarget,
  ILike,
  ObjectLiteral,
  QueryDeepPartialEntity,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  DeepPartial,
} from 'typeorm';
import { Logger } from '@logging/logger.js';

/**
 * BaseRepository高级查询功能
 * 提供高级查询相关操作
 */
export class BaseRepositoryAdvancedQueries<T extends ObjectLiteral> {
  /**
   * 创建BaseRepositoryAdvancedQueries实例
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
  protected getRepository() {
    return this.dataSource.getRepository(this.entity);
  }

  /**
   * 根据时间范围查找实体
   * @param {any[]} args 参数数组
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @param options 查询选项
   * @returns 实体数组
   */
  async findByTimeRange(
    timeRange: { startTime: number | Date; endTime: number | Date; fieldName?: string },
    options?: FindManyOptions<T>,
  ): Promise<T[]>;
  async findByTimeRange(
    startTime: number | Date,
    endTime: number | Date,
    options?: FindManyOptions<T>,
  ): Promise<T[]>;
  async findByTimeRange(
    fieldName: string,
    startTime: number | Date,
    endTime: number | Date,
    options?: FindManyOptions<T>,
  ): Promise<T[]>;
  async findByTimeRange(...args: unknown[]): Promise<T[]> {
    try {
      // 支持多种调用方式（已通过重载列出）
      const repository = this.getRepository();

      // 解析参数并标准化到 (fieldName, startTime, endTime, options)
      let fieldName = 'timestamp';
      let startTime: number | Date | undefined;
      let endTime: number | Date | undefined;
      let options: FindManyOptions<T> | undefined;

      if (args.length === 1 && typeof args[0] === 'object') {
        const timeRange = args[0] as { startTime: number | Date; endTime: number | Date; fieldName?: string };
        startTime = timeRange.startTime;
        endTime = timeRange.endTime;
        fieldName = timeRange.fieldName ?? 'timestamp';
      } else if (args.length === 2) {
        startTime = args[0] as number | Date;
        endTime = args[1] as number | Date;
      } else if (args.length >= 3) {
        if (typeof args[0] === 'string') {
          fieldName = args[0] as string;
          startTime = args[1] as number | Date;
          endTime = args[2] as number | Date;
          options = args[3] as FindManyOptions<T> | undefined;
        }
      }

      if (args.length >= 2 && !startTime) {
        return [];
      }

      const queryOptions: FindManyOptions<T> = options ?? {};
      const whereCondition: FindOptionsWhere<T> = {
        ...(queryOptions.where as FindOptionsWhere<T> | undefined),
        [fieldName]: Between(startTime as number | Date, endTime as number | Date),
      } as unknown as FindOptionsWhere<T>;

      const results = (await repository.find({
        ...queryOptions,
        where: whereCondition,
      })) as T[];
      return results;
    } catch (error) {
      this.logger.error(`根据时间范围查询实体失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 模糊搜索实体
   * @param fieldName 字段名
   * @param searchText 搜索文本
   * @param options 查询选项
   * @returns 实体数组
   */
  async findByFuzzySearch(
    fieldName: string,
    searchText: string,
    options?: FindManyOptions<T>,
  ): Promise<T[]> {
    try {
      const repository = this.getRepository();
      const queryOptions: FindManyOptions<T> = options ?? {};
      const whereCondition: FindOptionsWhere<T> = {
        ...(queryOptions.where as FindOptionsWhere<T> | undefined),
        [fieldName]: ILike(`%${searchText}%`),
      } as unknown as FindOptionsWhere<T>;

      const results = (await repository.find({
        ...queryOptions,
        where: whereCondition,
      })) as T[];
      return results;
    } catch (error) {
      this.logger.error(`模糊搜索实体失败`, {
        fieldName,
        searchText,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Upsert实体
   * @param data 部分数据
   * @param identifierFields 标识字段
   * @returns 实体
   */
  async upsert(
    data: Partial<T>,
    identifierFields: string[] = ['id'],
  ): Promise<T> {
    try {
      const repository = this.getRepository();
      const whereObj: Partial<Record<string, unknown>> = {};
      for (const field of identifierFields) {
        if (field in (data as Record<string, unknown>)) {
          whereObj[field] = (data as Record<string, unknown>)[field];
        }
      }

      const whereCondition = whereObj as FindOptionsWhere<T>;
      const existing = await repository.findOne({ where: whereCondition } as FindOneOptions<T>);
      if (existing) {
        // TypeORM 的 update 使用内部的 QueryDeepPartialEntity 类型，库导出与本项目 TypeScript 版本
        // 可能存在不兼容。使用受控的 any 折衷以保持行为一致并避免大范围重构。
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await repository.update(whereCondition as FindOptionsWhere<T>, data as any);
        const result = await repository.findOne({ where: whereCondition } as FindOneOptions<T>);
        return result as T;
      }
      return repository.create(data as DeepPartial<T>) as unknown as T;
    } catch (error) {
      this.logger.error(`Upsert实体失败`, {
        data,
        identifierFields,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
