import { v4 as uuidv4 } from 'uuid';
import {
  TransactionContext as ITransactionContext,
  TransactionOperation,
  TransactionStatus,
  Savepoint,
} from '@domain/repositories/ITransactionManager.js';

/**
 * 事务上下文实现
 * 支持嵌套事务和保存点机制
 */
export class TransactionContext implements ITransactionContext {
  public readonly transactionId: string;
  public status: TransactionStatus;
  public operations: TransactionOperation[];
  public readonly startTime: number;
  public readonly metadata?: Record<string, unknown>;
  public readonly parentTransactionId?: string;
  public readonly savepoints: Map<string, Savepoint>;
  public readonly nestingLevel: number;
  public readonly isRootTransaction: boolean;

  /**
   * 创建事务上下文实例
   *
   * @param options 事务上下文选项
   * @param options.transactionId 事务ID（可选）
   * @param options.status 事务状态（可选）
   * @param options.operations 事务操作列表（可选）
   * @param options.startTime 开始时间（可选）
   * @param options.metadata 事务元数据（可选）
   * @param options.parentTransactionId 父事务ID（可选）
   * @param options.savepoints 保存点映射（可选）
   * @param options.nestingLevel 嵌套层级（可选）
   */
  constructor(options: {
    transactionId?: string;
    status?: TransactionStatus;
    operations?: TransactionOperation[];
    startTime?: number;
    metadata?: Record<string, unknown>;
    parentTransactionId?: string;
    savepoints?: Map<string, Savepoint>;
    nestingLevel?: number;
  }) {
    this.transactionId = options.transactionId || uuidv4();
    this.status = options.status || TransactionStatus.PENDING;
    this.operations = options.operations || [];
    this.startTime = options.startTime || Date.now();
    this.metadata = options.metadata;
    this.parentTransactionId = options.parentTransactionId;
    this.savepoints = options.savepoints || new Map<string, Savepoint>();
    this.nestingLevel =
      options.nestingLevel ?? (options.parentTransactionId ? 1 : 0);
    this.isRootTransaction = !options.parentTransactionId;
  }

  /**
   * 添加操作到事务
   *
   * @param operation 事务操作
   */
  addOperation(operation: TransactionOperation): void {
    this.operations.push(operation);
  }

  /**
   * 创建保存点
   *
   * @param name 保存点名称
   * @param metadata 保存点元数据
   * @returns 保存点ID
   */
  createSavepoint(name: string, metadata?: Record<string, unknown>): string {
    const savepointId = uuidv4();
    const savepoint: Savepoint = {
      id: savepointId,
      name,
      transactionId: this.transactionId,
      operations: [...this.operations], // 复制当前操作列表
      createdAt: Date.now(),
      metadata,
    };

    this.savepoints.set(savepointId, savepoint);
    return savepointId;
  }

  /**
   * 回滚到保存点
   *
   * @param savepointId 保存点ID
   */
  rollbackToSavepoint(savepointId: string): void {
    const savepoint = this.savepoints.get(savepointId);
    if (!savepoint) {
      throw new Error(`Savepoint ${savepointId} not found`);
    }

    // 恢复操作列表到保存点时的状态
    this.operations = [...savepoint.operations];

    // 删除该保存点之后创建的所有保存点
    const savepointIds = Array.from(this.savepoints.keys());
    for (const id of savepointIds) {
      const sp = this.savepoints.get(id)!;
      if (sp.createdAt > savepoint.createdAt) {
        this.savepoints.delete(id);
      }
    }
  }

  /**
   * 释放保存点
   *
   * @param savepointId 保存点ID
   */
  releaseSavepoint(savepointId: string): void {
    const savepoint = this.savepoints.get(savepointId);
    if (!savepoint) {
      throw new Error(`Savepoint ${savepointId} not found`);
    }

    this.savepoints.delete(savepointId);
  }

  /**
   * 获取保存点列表
   *
   * @returns 保存点列表
   */
  getSavepoints(): Savepoint[] {
    return Array.from(this.savepoints.values());
  }

  /**
   * 根据名称获取保存点
   *
   * @param name 保存点名称
   * @returns 保存点或undefined
   */
  getSavepointByName(name: string): Savepoint | undefined {
    for (const savepoint of this.savepoints.values()) {
      if (savepoint.name === name) {
        return savepoint;
      }
    }
    return undefined;
  }

  /**
   * 检查是否为嵌套事务
   *
   * @returns 是否为嵌套事务
   */
  isNested(): boolean {
    return !this.isRootTransaction;
  }

  /**
   * 获取事务的深度（嵌套层级）
   *
   * @returns 嵌套层级
   */
  getDepth(): number {
    return this.nestingLevel;
  }

  /**
   * 克隆事务上下文
   *
   * @returns 新的事务上下文实例
   */
  clone(): TransactionContext {
    return new TransactionContext({
      transactionId: this.transactionId,
      status: this.status,
      operations: [...this.operations],
      startTime: this.startTime,
      metadata: this.metadata ? { ...this.metadata } : undefined,
      parentTransactionId: this.parentTransactionId,
      savepoints: new Map(this.savepoints),
      nestingLevel: this.nestingLevel,
    });
  }

  /**
   * 转换为JSON对象
   *
   * @returns JSON对象
   */
  toJSON(): Record<string, unknown> {
    return {
      transactionId: this.transactionId,
      status: this.status,
      operations: this.operations,
      startTime: this.startTime,
      metadata: this.metadata,
      parentTransactionId: this.parentTransactionId,
      savepoints: Array.from(this.savepoints.entries()),
      nestingLevel: this.nestingLevel,
      isRootTransaction: this.isRootTransaction,
    };
  }

  /**
   * 从JSON对象创建事务上下文
   *
   * @param json JSON对象
   * @returns 事务上下文实例
   */
  static fromJSON(json: Record<string, unknown>): TransactionContext {
    // 解析并校验传入的 JSON 字段，防止 unknown 直接赋值到具体类型上
    const savepointsArray = Array.isArray(json.savepoints)
      ? (json.savepoints as unknown[])
      : [];
    const savepoints = new Map<string, Savepoint>();
    for (const entry of savepointsArray) {
      if (Array.isArray(entry) && entry.length === 2) {
        const key = typeof entry[0] === 'string' ? entry[0] : undefined;
        const val = entry[1] as Savepoint;
        if (key) savepoints.set(key, val);
      }
    }

    const transactionId =
      typeof json.transactionId === 'string' ? json.transactionId : undefined;
    const status =
      typeof json.status === 'string'
        ? (json.status as TransactionStatus)
        : undefined;
    const operations = Array.isArray(json.operations)
      ? (json.operations as TransactionOperation[])
      : [];
    const startTime =
      typeof json.startTime === 'number' ? json.startTime : undefined;
    const metadata =
      json.metadata && typeof json.metadata === 'object'
        ? (json.metadata as Record<string, unknown>)
        : undefined;
    const parentTransactionId =
      typeof json.parentTransactionId === 'string'
        ? json.parentTransactionId
        : undefined;
    const nestingLevel =
      typeof json.nestingLevel === 'number' ? json.nestingLevel : undefined;

    return new TransactionContext({
      transactionId,
      status,
      operations,
      startTime,
      metadata,
      parentTransactionId,
      savepoints,
      nestingLevel,
    });
  }
}
