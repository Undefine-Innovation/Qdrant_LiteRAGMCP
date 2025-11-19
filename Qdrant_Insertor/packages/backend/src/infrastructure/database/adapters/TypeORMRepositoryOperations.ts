/**
 * TypeORM仓库操作模块
 * 包含CRUD操作方法和查询功能
 */

import { Repository, DeepPartial, ObjectLiteral, FindOptionsWhere, EntityManager, UpdateResult, DeleteResult } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { PaginationQuery, PaginatedResponse } from '@domain/entities/types.js';
import {
  IRepositoryAdapter,
  AdapterEventType,
  AdapterEvent,
} from './IRepositoryAdapter.js';
import { TypeORMRepositoryCore } from './TypeORMRepositoryCore.js';

/**
 * TypeORM仓库操作模块
 * 包含CRUD操作方法和查询功能
 * @template T 实体类型
 */
export abstract class TypeORMRepositoryOperations<
  T extends ObjectLiteral,
> extends TypeORMRepositoryCore<T> {
  /**
   * 创建实体
   * @param entity 要创建的实体
   * @returns 创建的实体
   */
  async create(entity: Partial<T>): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await this.repository.save(entity as DeepPartial<T>);
      const queryTime = Date.now() - startTime;
      this.recordQueryTime(queryTime);

      this.emitEvent({
        type: AdapterEventType.QUERY_EXECUTED,
        timestamp: new Date(),
        entityType: this.getEntityName(),
        databaseType: this.databaseType,
        data: { operation: 'create', id: (result as unknown as Record<string, unknown>)['id'] },
        duration: queryTime,
      });

      return result as T;
    } catch (error) {
      this.logger.error(`创建实体失败`, {
        entity,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 批量创建实体
   * @param entities 要创建的实体数组
   * @returns 创建的实体数组
   */
  async createBatch(entities: Partial<T>[]): Promise<T[]> {
    const startTime = Date.now();
    try {
      const batchSize = this.adapterConfig.batchSize || 100;
      const results: T[] = [];

      // 分批处理大量数据
      for (let i = 0; i < entities.length; i += batchSize) {
        const batch = entities.slice(i, i + batchSize);
        const batchResults = await this.repository.save(
          batch as DeepPartial<T>[],
        );
        results.push(...batchResults);
      }

      const queryTime = Date.now() - startTime;
      this.recordQueryTime(queryTime);

      this.emitEvent({
        type: AdapterEventType.QUERY_EXECUTED,
        timestamp: new Date(),
        entityType: this.getEntityName(),
        databaseType: this.databaseType,
        data: { operation: 'createBatch', count: entities.length },
        duration: queryTime,
      });

      return results;
    } catch (error) {
      this.logger.error(`批量创建实体失败`, {
        count: entities.length,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 根据ID查找实体
   * @param id 实体ID
   * @returns 找到的实体或undefined
   */
  async findById(id: string | number): Promise<T | undefined> {
    const startTime = Date.now();
    try {
      const result = await this.repository.findOne({ where: { id } as unknown as FindOptionsWhere<T> });
      const queryTime = Date.now() - startTime;
      this.recordQueryTime(queryTime);

      this.emitEvent({
        type: AdapterEventType.QUERY_EXECUTED,
        timestamp: new Date(),
        entityType: this.getEntityName(),
        databaseType: this.databaseType,
        data: { operation: 'findById', id },
        duration: queryTime,
      });

      return result || undefined;
    } catch (error) {
      this.logger.error(`根据ID查找实体失败`, {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 根据条件查找实体
   * @param conditions 查询条件
   * @returns 找到的实体数组
   */
  async find(conditions: Partial<T>): Promise<T[]> {
    const startTime = Date.now();
    try {
      const result = await this.repository.find({ where: conditions as unknown as FindOptionsWhere<T> });
      const queryTime = Date.now() - startTime;
      this.recordQueryTime(queryTime);

      this.emitEvent({
        type: AdapterEventType.QUERY_EXECUTED,
        timestamp: new Date(),
        entityType: this.getEntityName(),
        databaseType: this.databaseType,
        data: { operation: 'find', conditions },
        duration: queryTime,
      });

      return result;
    } catch (error) {
      this.logger.error(`根据条件查找实体失败`, {
        conditions,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 查找单个实体
   * @param conditions 查询条件
   * @returns 找到的实体或undefined
   */
  async findOne(conditions: Partial<T>): Promise<T | undefined> {
    const startTime = Date.now();
    try {
      const result = await this.repository.findOne({
        where: conditions as unknown as FindOptionsWhere<T>,
      });
      const queryTime = Date.now() - startTime;
      this.recordQueryTime(queryTime);

      this.emitEvent({
        type: AdapterEventType.QUERY_EXECUTED,
        timestamp: new Date(),
        entityType: this.getEntityName(),
        databaseType: this.databaseType,
        data: { operation: 'findOne', conditions },
        duration: queryTime,
      });

      return result || undefined;
    } catch (error) {
      this.logger.error(`查找单个实体失败`, {
        conditions,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 更新实体
   * @param conditions 查询条件
   * @param updates 更新数据
   * @returns 更新结果
   */
  async update(
    conditions: Partial<T>,
    updates: Partial<T>,
  ): Promise<{ affected: number }> {
    const startTime = Date.now();
    try {
      const result: UpdateResult = await this.repository.update(conditions as unknown as FindOptionsWhere<T>, updates as DeepPartial<T>);
      const queryTime = Date.now() - startTime;
      this.recordQueryTime(queryTime);

      this.emitEvent({
        type: AdapterEventType.QUERY_EXECUTED,
        timestamp: new Date(),
        entityType: this.getEntityName(),
        databaseType: this.databaseType,
        data: { operation: 'update', conditions, updates },
        duration: queryTime,
      });

      return { affected: result.affected || 0 };
    } catch (error) {
      this.logger.error(`更新实体失败`, {
        conditions,
        updates,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 删除实体
   * @param conditions 查询条件
   * @returns 删除结果
   */
  async delete(conditions: Partial<T>): Promise<{ affected: number }> {
    const startTime = Date.now();
    try {
      const result: DeleteResult = await this.repository.delete(conditions as unknown as FindOptionsWhere<T>);
      const queryTime = Date.now() - startTime;
      this.recordQueryTime(queryTime);

      this.emitEvent({
        type: AdapterEventType.QUERY_EXECUTED,
        timestamp: new Date(),
        entityType: this.getEntityName(),
        databaseType: this.databaseType,
        data: { operation: 'delete', conditions },
        duration: queryTime,
      });

      return { affected: result.affected || 0 };
    } catch (error) {
      this.logger.error(`删除实体失败`, {
        conditions,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 计算实体数量
   * @param conditions 查询条件
   * @returns 实体数量
   */
  async count(conditions?: Partial<T>): Promise<number> {
    const startTime = Date.now();
    try {
      const result = await this.repository.count({ where: conditions as unknown as FindOptionsWhere<T> });
      const queryTime = Date.now() - startTime;
      this.recordQueryTime(queryTime);

      this.emitEvent({
        type: AdapterEventType.QUERY_EXECUTED,
        timestamp: new Date(),
        entityType: this.getEntityName(),
        databaseType: this.databaseType,
        data: { operation: 'count', conditions },
        duration: queryTime,
      });

      return result;
    } catch (error) {
      this.logger.error(`计算实体数量失败`, {
        conditions,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 分页查询实体
   * @param conditions 查询条件
   * @param pagination 分页参数
   * @param {number} pagination.page 页码
   * @param {number} pagination.limit 每页数量
   * @returns 分页结果
   */
  async findWithPagination(
    conditions: Partial<T>,
    pagination: { page: number; limit: number },
  ): Promise<PaginatedResponse<T>> {
    const startTime = Date.now();
    try {
      const { page, limit } = pagination;
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        this.repository.find({
          where: conditions as unknown as FindOptionsWhere<T>,
          skip,
          take: limit,
        }),
        this.repository.count({ where: conditions as unknown as FindOptionsWhere<T> }),
      ]);

      const queryTime = Date.now() - startTime;
      this.recordQueryTime(queryTime);

      const totalPages = Math.ceil(total / limit);

      const result: PaginatedResponse<T> = {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };

      this.emitEvent({
        type: AdapterEventType.QUERY_EXECUTED,
        timestamp: new Date(),
        entityType: this.getEntityName(),
        databaseType: this.databaseType,
        data: { operation: 'findWithPagination', conditions, pagination },
        duration: queryTime,
      });

      return result;
    } catch (error) {
      this.logger.error(`分页查询实体失败`, {
        conditions,
        pagination,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 执行原生SQL查询
   * @param query SQL查询语句
   * @param parameters 查询参数
   * @returns 查询结果
   */
  async query(query: string, parameters?: unknown[]): Promise<Record<string, unknown>[]> {
    const startTime = Date.now();
    try {
      const result = (await this.dataSource.query(query, parameters)) as Record<string, unknown>[];
      const queryTime = Date.now() - startTime;
      this.recordQueryTime(queryTime);

      this.emitEvent({
        type: AdapterEventType.QUERY_EXECUTED,
        timestamp: new Date(),
        entityType: this.getEntityName(),
        databaseType: this.databaseType,
        data: { operation: 'query', sql: query, parameters },
        duration: queryTime,
      });

      return result;
    } catch (error) {
      this.logger.error(`执行原生SQL查询失败`, {
        query,
        parameters,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 执行原生SQL查询并返回单个结果
   * @param query SQL查询语句
   * @param parameters 查询参数
   * @returns 查询结果
   */
  async queryOne(query: string, parameters?: unknown[]): Promise<Record<string, unknown> | undefined> {
    const startTime = Date.now();
    try {
      const result = (await this.dataSource.query(query, parameters)) as Record<string, unknown>[];
      const queryTime = Date.now() - startTime;
      this.recordQueryTime(queryTime);

      this.emitEvent({
        type: AdapterEventType.QUERY_EXECUTED,
        timestamp: new Date(),
        entityType: this.getEntityName(),
        databaseType: this.databaseType,
        data: { operation: 'queryOne', sql: query, parameters },
        duration: queryTime,
      });

      return Array.isArray(result) && result.length > 0 ? result[0] : undefined;
    } catch (error) {
      this.logger.error(`执行原生SQL查询失败`, {
        query,
        parameters,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 执行事务
   * @param fn 事务函数
   * @returns 事务结果
   */
  async executeTransaction<T>(fn: (manager: EntityManager) => Promise<T>): Promise<T> {
    return await this.dataSource.transaction(fn as (entityManager: EntityManager) => Promise<T>);
  }
}
