import { DataSource } from 'typeorm';

/**
 * SQLiteRepoCore
 *
 * 轻量级 SQLite 仓库核心包装器，封装 `DataSource` 的事务执行等常用操作，
 * 为上层服务提供事务执行的安全抽象，避免直接依赖 TypeORM API。
 */
export class SQLiteRepoCore {
  /**
   * 构造 SQLite 仓库核心包装器
   * @param dataSource 主 SQLite 数据源，用于执行事务和数据访问
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
