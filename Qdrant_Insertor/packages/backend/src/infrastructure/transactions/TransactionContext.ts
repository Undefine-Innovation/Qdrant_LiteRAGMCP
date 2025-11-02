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
  public readonly metadata?: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- 通用元数据字段，需要灵活的类型
  public readonly parentTransactionId?: string;
  public readonly savepoints: Map<string, Savepoint>;
  public readonly nestingLevel: number;
  public readonly isRootTransaction: boolean;

  /**
   * 创建事务上下文实例
   *
   * @param options 事务上下文选项
   */
  constructor(options: {
    transactionId?: string;
    status?: TransactionStatus;
    operations?: TransactionOperation[];
    startTime?: number;
    metadata?: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- 通用元数据字段
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
  createSavepoint(name: string, metadata?: Record<string, any>): string {
    // eslint-disable-line @typescript-eslint/no-explicit-any -- 通用元数据字段
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
  toJSON(): Record<string, any> {
    // eslint-disable-line @typescript-eslint/no-explicit-any -- JSON序列化需要灵活类型
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
  static fromJSON(json: Record<string, any>): TransactionContext {
    // eslint-disable-line @typescript-eslint/no-explicit-any -- JSON反序列化需要灵活类型
    const savepoints = new Map<string, Savepoint>(json.savepoints || []);

    return new TransactionContext({
      transactionId: json.transactionId,
      status: json.status,
      operations: json.operations || [],
      startTime: json.startTime,
      metadata: json.metadata,
      parentTransactionId: json.parentTransactionId,
      savepoints,
      nestingLevel: json.nestingLevel,
    });
  }
}
