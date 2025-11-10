import { DataSource } from 'typeorm';

/**
 * Lightweight wrapper around the primary SQLite TypeORM DataSource so higher
 * level services can execute functions inside a DB transaction without
 * depending directly on TypeORM APIs.
 */
export class SQLiteRepoCore {
  /**
   * @param dataSource 主 SQLite 数据源
   */
  constructor(private readonly dataSource: DataSource) {}

  /**
   * 在数据库事务里执行提供的函数。
   * @param fn 需要执行的回调
   * @returns 回调执行结果
   */
  async transaction<T>(fn: () => Promise<T> | T): Promise<T> {
    return this.dataSource.transaction(async () => fn());
  }
}
