/**
 * 事务管理器接口
 * 用于管理数据库事务的创建、提交、回滚等操作
 */

import { EntityManager, QueryRunner } from 'typeorm';

/**
 * 事务管理器接口
 * 提供统一的事务管理功能，支持不同的事务策略
 */
export interface ITransactionManager {
  /**
   * 开始事务
   * @returns 事务管理器实例
   */
  startTransaction(): Promise<EntityManager | QueryRunner>;

  /**
   * 提交事务
   * @param transaction 事务管理器实例
   */
  commitTransaction(transaction: EntityManager | QueryRunner): Promise<void>;

  /**
   * 回滚事务
   * @param transaction 事务管理器实例
   */
  rollbackTransaction(transaction: EntityManager | QueryRunner): Promise<void>;

  /**
   * 结束事务
   * @param transaction 事务管理器实例
   */
  endTransaction(transaction: EntityManager | QueryRunner): Promise<void>;

  /**
   * 执行事务性操作
   * @param operation 要执行的操作函数
   * @returns 操作结果
   */
  executeInTransaction<T>(
    operation: (transaction: EntityManager | QueryRunner) => Promise<T>,
  ): Promise<T>;
}
