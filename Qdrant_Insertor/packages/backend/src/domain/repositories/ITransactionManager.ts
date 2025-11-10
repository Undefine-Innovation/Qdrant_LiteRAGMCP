import { CollectionId, DocId, PointId } from '@domain/entities/types.js';

/**
 * 事务操作类型枚举
 */
export enum TransactionOperationType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

/**
 * 事务操作接口
 */
export interface TransactionOperation {
  type: TransactionOperationType;
  target: 'collection' | 'document' | 'chunk';
  targetId: CollectionId | DocId | PointId;
  data?: unknown;
  rollbackData?: unknown;
}

/**
 * 事务状态枚举
 */
export enum TransactionStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  COMMITTED = 'COMMITTED',
  ROLLED_BACK = 'ROLLED_BACK',
  FAILED = 'FAILED',
}

/**
 * 保存点接口
 */
export interface Savepoint {
  id: string;
  name: string;
  transactionId: string;
  operations: TransactionOperation[];
  createdAt: number;
  metadata?: Record<string, unknown>;
}

/**
 * 事务上下文接口
 */
export interface TransactionContext {
  transactionId: string;
  status: TransactionStatus;
  operations: TransactionOperation[];
  startTime: number;
  metadata?: Record<string, unknown>;
  parentTransactionId?: string;
  savepoints: Map<string, Savepoint>;
  nestingLevel: number;
  isRootTransaction: boolean;
}

/**
 * 事务管理器接口
 * 统一事务边界管理，支持跨多个资源的事务操作
 */
export interface ITransactionManager {
  /**
   * 开始一个新事务
   * @param metadata 事务元数据（可选）
   * @returns 事务上下文
   */
  beginTransaction(metadata?: Record<string, unknown>): Promise<TransactionContext>;

  /**
   * 开始一个嵌套事务
   * @param parentTransactionId 父事务ID
   * @param metadata 事务元数据（可选）
   * @returns 嵌套事务上下文
   */
  beginNestedTransaction(
    parentTransactionId: string,
    metadata?: Record<string, unknown>,
  ): Promise<TransactionContext>;

  /**
   * 提交事务
   * @param transactionId 事务ID
   */
  commit(transactionId: string): Promise<void>;

  /**
   * 回滚事务
   * @param transactionId 事务ID
   */
  rollback(transactionId: string): Promise<void>;

  /**
   * 在事务中执行操作
   * @param transactionId 事务ID
   * @param operation 事务操作
   */
  executeOperation(
    transactionId: string,
    operation: TransactionOperation,
  ): Promise<void>;

  /**
   * 在事务中执行函数
   * @param fn 要执行的函数
   * @param metadata 事务元数据（可选）
   * @returns 函数执行结果
   */
  executeInTransaction<T>(
    fn: (context: TransactionContext) => Promise<T>,
    metadata?: Record<string, unknown>,
  ): Promise<T>;

  /**
   * 在嵌套事务中执行函数
   * @param parentTransactionId 父事务ID
   * @param fn 要执行的函数
   * @param metadata 事务元数据（可选）
   * @returns 函数执行结果
   */
  executeInNestedTransaction<T>(
    parentTransactionId: string,
    fn: (context: TransactionContext) => Promise<T>,
    metadata?: Record<string, unknown>,
  ): Promise<T>;

  /**
   * 创建保存点
   * @param transactionId 事务ID
   * @param name 保存点名称
   * @param metadata 保存点元数据（可选）
   * @returns 保存点ID
   */
  createSavepoint(
    transactionId: string,
    name: string,
    metadata?: Record<string, unknown>,
  ): Promise<string>;

  /**
   * 回滚到保存点
   * @param transactionId 事务ID
   * @param savepointId 保存点ID
   */
  rollbackToSavepoint(
    transactionId: string,
    savepointId: string,
  ): Promise<void>;

  /**
   * 释放保存点
   * @param transactionId 事务ID
   * @param savepointId 保存点ID
   */
  releaseSavepoint(transactionId: string, savepointId: string): Promise<void>;

  /**
   * 获取事务状态
   * @param transactionId 事务ID
   * @returns 事务上下文
   */
  getTransactionStatus(transactionId: string): TransactionContext | undefined;

  /**
   * 获取所有活跃事务
   * @returns 活跃事务列表
   */
  getActiveTransactions(): TransactionContext[];

  /**
   * 获取事务的保存点列表
   * @param transactionId 事务ID
   * @returns 保存点列表
   */
  getTransactionSavepoints(transactionId: string): Savepoint[];

  /**
   * 检查事务是否为嵌套事务
   * @param transactionId 事务ID
   * @returns 是否为嵌套事务
   */
  isNestedTransaction(transactionId: string): boolean;

  /**
   * 获取根事务ID
   * @param transactionId 事务ID
   * @returns 根事务ID
   */
  getRootTransactionId(transactionId: string): string | undefined;

  /**
   * 清理已完成的事务
   * @param maxAge 最大保留时间（毫秒）
   */
  cleanupCompletedTransactions(maxAge?: number): void;
}
