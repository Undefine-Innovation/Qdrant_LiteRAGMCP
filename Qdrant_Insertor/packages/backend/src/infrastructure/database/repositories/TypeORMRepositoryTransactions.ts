import { Logger } from '@logging/logger.js';
import { TypeORMRepositoryCore } from './TypeORMRepositoryCore.js';
import { CollectionId, DocId } from '@domain/entities/types.js';

/**
 * TypeORM Repository 事务相关方法
 */
export class TypeORMRepositoryTransactions extends TypeORMRepositoryCore {
  /**
   * 在数据库事务中执行一个函数
   * @param fn 包含数据库操作的函数
   * @returns 事务函数的返回值
   */
  transaction<T>(fn: () => T): T {
    // 为了保持接口兼容性，这里需要同步返回
    // 但TypeORM是异步的，所以我们需要抛出错误提示需要异步调用
    throw new Error(
      'TypeORMRepository.transaction需要异步调用，请使用asyncTransaction方法',
    );
  }

  /**
   * 异步事务方法
   * @param fn 包含数据库操作的函数
   * @returns 事务函数的返回值
   */
  async asyncTransaction<T>(fn: () => Promise<T>): Promise<T> {
    return await this.dataSource.transaction(async (manager) => {
      // 在事务中执行函数
      return await fn();
    });
  }
}