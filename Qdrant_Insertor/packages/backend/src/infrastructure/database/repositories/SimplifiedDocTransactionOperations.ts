import { DataSource, EntityManager } from 'typeorm';
import { BaseRepository } from './BaseRepository.js';
import { Doc } from '../entities/Doc.js';
import { Logger } from '@logging/logger.js';
import { DocId } from '@domain/entities/types.js';

/**
 * 简化的文档事务操作功能
 * 提供事务相关的数据库操作
 */
export class SimplifiedDocTransactionOperations extends BaseRepository<Doc> {
  constructor(dataSource: DataSource, logger: Logger) {
    super(dataSource, Doc, logger);
  }

  /**
   * 使用事务管理器删除文档
   * @param id 文档ID
   * @param manager 事务管理器
   * @returns 删除结果
   */
  async deleteWithManager(
    id: DocId,
    manager: EntityManager,
  ): Promise<{ affected?: number }> {
    try {
      const result = await manager.delete(Doc, {
        docId: id,
      });

      this.logger.debug(`使用事务管理器删除文档成功`, {
        id,
        affected: result.affected,
      });

      return { affected: result.affected ?? undefined };
    } catch (error) {
      this.logger.error(`使用事务管理器删除文档失败`, {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 使用事务管理器创建文档
   * @param docData 文档数据
   * @param manager 事务管理器
   * @returns 创建的文档
   */
  async createWithManager(
    docData: Partial<Doc>,
    manager: EntityManager,
  ): Promise<Doc> {
    try {
      const doc = manager.create(Doc, {
        ...docData,
        created_at: docData.created_at || Date.now(),
        updated_at: docData.updated_at || Date.now(),
      });

      const result = await manager.save(doc);

      this.logger.debug(`使用事务管理器创建文档成功`, {
        docId: result.docId,
      });

      return result;
    } catch (error) {
      this.logger.error(`使用事务管理器创建文档失败`, {
        docData,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 使用事务管理器更新文档
   * @param id 文档ID
   * @param updateData 更新数据
   * @param manager 事务管理器
   * @returns 更新后的文档或null
   */
  async updateWithManager(
    id: DocId,
    updateData: Partial<Doc>,
    manager: EntityManager,
  ): Promise<Doc | null> {
    try {
      const data = {
        ...updateData,
        updated_at: Date.now(),
      };

      await manager.update(Doc, { docId: id }, data);

      const result = await manager.findOne(Doc, {
        where: { docId: id },
      });

      if (result) {
        this.logger.debug(`使用事务管理器更新文档成功`, {
          id,
          updatedFields: Object.keys(updateData),
        });
      }

      return result;
    } catch (error) {
      this.logger.error(`使用事务管理器更新文档失败`, {
        id,
        updateData,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 使用事务管理器批量创建文档
   * @param docs 文档数据数组
   * @param manager 事务管理器
   * @returns 创建的文档数组
   */
  async createBatchWithManager(
    docs: Partial<Doc>[],
    manager: EntityManager,
  ): Promise<Doc[]> {
    try {
      const processedDocs = docs.map((doc) => ({
        ...doc,
        created_at: doc.created_at || Date.now(),
        updated_at: doc.updated_at || Date.now(),
      }));

      const results = await manager.save(Doc, processedDocs);

      this.logger.debug(`使用事务管理器批量创建文档成功`, {
        requested: docs.length,
        created: results.length,
      });

      return results;
    } catch (error) {
      this.logger.error(`使用事务管理器批量创建文档失败`, {
        count: docs.length,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 使用事务管理器批量更新文档状态
   * @param ids 文档ID数组
   * @param status 新状态
   * @param manager 事务管理器
   * @returns 更新结果
   */
  async batchUpdateStatusWithManager(
    ids: DocId[],
    status: 'new' | 'processing' | 'completed' | 'failed',
    manager: EntityManager,
  ): Promise<{ affected?: number }> {
    try {
      const result = await manager.update(Doc, ids, {
        status,
        updated_at: Date.now(),
      });

      this.logger.debug(`使用事务管理器批量更新文档状态成功`, {
        requested: ids.length,
        affected: result.affected,
        status,
      });

      return result;
    } catch (error) {
      this.logger.error(`使用事务管理器批量更新文档状态失败`, {
        ids,
        status,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 使用事务管理器批量软删除文档
   * @param ids 文档ID数组
   * @param manager 事务管理器
   * @returns 删除结果
   */
  async batchSoftDeleteWithManager(
    ids: DocId[],
    manager: EntityManager,
  ): Promise<{ affected?: number }> {
    try {
      const result = await manager.update(Doc, ids, {
        deleted: true,
        deleted_at: Date.now(),
        updated_at: Date.now(),
      });

      this.logger.debug(`使用事务管理器批量软删除文档成功`, {
        requested: ids.length,
        affected: result.affected,
      });

      return result;
    } catch (error) {
      this.logger.error(`使用事务管理器批量软删除文档失败`, {
        ids,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 使用事务管理器批量恢复文档
   * @param ids 文档ID数组
   * @param manager 事务管理器
   * @returns 恢复结果
   */
  async batchRestoreWithManager(
    ids: DocId[],
    manager: EntityManager,
  ): Promise<{ affected?: number }> {
    try {
      const result = await manager.update(Doc, ids, {
        deleted: false,
        deleted_at: undefined,
        updated_at: Date.now(),
      });

      this.logger.debug(`使用事务管理器批量恢复文档成功`, {
        requested: ids.length,
        affected: result.affected,
      });

      return { affected: result.affected ?? undefined };
    } catch (error) {
      this.logger.error(`使用事务管理器批量恢复文档失败`, {
        ids,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 使用事务管理器查找文档
   * @param id 文档ID
   * @param manager 事务管理器
   * @returns 找到的文档或null
   */
  async findByIdWithManager(
    id: DocId,
    manager: EntityManager,
  ): Promise<Doc | null> {
    try {
      const result = await manager.findOne(Doc, {
        where: { docId: id },
      });

      this.logger.debug(`使用事务管理器查找文档成功`, {
        id,
        found: !!result,
      });

      return result;
    } catch (error) {
      this.logger.error(`使用事务管理器查找文档失败`, {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 使用事务管理器根据条件查找文档
   * @param condition 查询条件
   * @param manager 事务管理器
   * @returns 找到的文档数组
   */
  async findByConditionWithManager(
    condition: Record<string, unknown>,
    manager: EntityManager,
  ): Promise<Doc[]> {
    try {
      const results = await manager.find(Doc, {
        where: condition,
      });

      this.logger.debug(`使用事务管理器根据条件查找文档成功`, {
        condition,
        found: results.length,
      });

      return results;
    } catch (error) {
      this.logger.error(`使用事务管理器根据条件查找文档失败`, {
        condition,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 使用事务管理器统计文档数量
   * @param condition 查询条件
   * @param manager 事务管理器
   * @returns 文档数量
   */
  async countWithManager(
    condition: Record<string, unknown>,
    manager: EntityManager,
  ): Promise<number> {
    try {
      const count = await manager.count(Doc, {
        where: condition,
      });

      this.logger.debug(`使用事务管理器统计文档数量成功`, {
        condition,
        count,
      });

      return count;
    } catch (error) {
      this.logger.error(`使用事务管理器统计文档数量失败`, {
        condition,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
