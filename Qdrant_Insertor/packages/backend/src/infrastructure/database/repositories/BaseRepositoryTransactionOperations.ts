import {
  DataSource,
  EntityManager,
  EntityTarget,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { Logger } from '@logging/logger.js';

/**
 * BaseRepository事务操作功能
 * 提供事务相关操作
 */
export class BaseRepositoryTransactionOperations<T extends ObjectLiteral> {
  /**
   * 创建BaseRepositoryTransactionOperations实例
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
   * @returns {any} Repository实例
   */
  protected getRepository(): Repository<T> {
    return this.dataSource.getRepository(this.entity) as Repository<T>;
  }

  /**
   * 使用事务管理器删除文档
   * @param id 文档ID
   * @param manager 事务管理器
   * @returns 删除结果
   */
  async deleteWithManager(
    id: string,
    manager: EntityManager,
  ): Promise<{ affected?: number }> {
    try {
      const result = await manager.delete(this.entity, { docId: id });
      return { affected: result.affected || undefined };
    } catch (error) {
      this.logger.error(`使用事务管理器删除文档失败`, {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 在事务中执行操作
   * @param operation 包含数据库操作的函数
   * @returns 操作结果
   */
  async executeInTransaction<T>(
    operation: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    try {
      if (!this.dataSource) throw new Error('DataSource not initialized');
      return await this.dataSource.transaction(operation);
    } catch (error) {
      this.logger.error(`执行事务操作失败`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
