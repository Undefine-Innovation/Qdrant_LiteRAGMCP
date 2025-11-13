import { QueryRunner } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { TransactionContext } from '@infrastructure/transactions/TransactionContext.js';
import {
  Savepoint,
  TransactionStatus,
} from '@domain/repositories/ITransactionManager.js';
import { TransactionCleanup } from '@infrastructure/transactions/TransactionCleanup.js';
import { TransactionError } from '@infrastructure/transactions/TransactionErrorHandler.js';

/**
 * 事务状态管理器
 * 负责管理活跃事务的状态、查询和清理
 */
export class TransactionStateManager {
  constructor(
    private readonly logger: Logger,
    private readonly cleanupHandler: TransactionCleanup,
  ) {}

  /**
   * 提交嵌套事务（将操作合并到父事务）
   * @param transactionId 嵌套事务ID
   * @param activeTransactions 活跃事务映射
   */
  commitNestedTransaction(
    transactionId: string,
    activeTransactions: Map<string, TransactionContext>,
  ): void {
    const context = activeTransactions.get(transactionId);
    if (!context) {
      throw TransactionError.transactionNotFound(transactionId);
    }

    if (!context.parentTransactionId) {
       
      throw new TransactionError(
        'INVALID_TRANSACTION_STATE' as any,
        `Transaction ${transactionId} is not a nested transaction`,
        { transactionId },
      );
    }

    const parentContext = activeTransactions.get(context.parentTransactionId);
    if (!parentContext) {
      throw TransactionError.transactionNotFound(context.parentTransactionId);
    }

    // 将嵌套事务的操作合并到父事务
    for (const operation of context.operations) {
      parentContext.addOperation(operation);
    }

    // 将嵌套事务的保存点合并到父事务
    for (const [savepointId, savepoint] of context.savepoints) {
      parentContext.savepoints.set(savepointId, savepoint);
    }

    context.status = TransactionStatus.COMMITTED;
    // 只有嵌套事务才记录 "Nested transaction committed and merged to parent"
    if (context.parentTransactionId) {
      this.logger.info('Nested transaction committed and merged to parent', {
        transactionId,
        parentTransactionId: context.parentTransactionId,
        operationsMerged: context.operations.length,
      });
    }
  }

  /**
   * 获取事务状态
   * @param transactionId 事务ID
   * @param activeTransactions 活跃事务映射
   * @returns 事务上下文
   */
  getTransactionStatus(
    transactionId: string,
    activeTransactions: Map<string, TransactionContext>,
  ): TransactionContext | undefined {
    return activeTransactions.get(transactionId);
  }

  /**
   * 获取所有活跃事务
   * @param activeTransactions 活跃事务映射
   * @returns 活跃事务列表（只返回根事务）
   */
  getActiveTransactions(
    activeTransactions: Map<string, TransactionContext>,
  ): TransactionContext[] {
    // 返回所有非已完成状态的事务（包括根事务和嵌套事务）
    return Array.from(activeTransactions.values()).filter(
      (context) =>
        context.status !== TransactionStatus.COMMITTED &&
        context.status !== TransactionStatus.ROLLED_BACK &&
        context.status !== TransactionStatus.FAILED,
    );
  }

  /**
   * 获取事务的保存点列表
   * @param transactionId 事务ID
   * @param activeTransactions 活跃事务映射
   * @returns 保存点列表
   */
  getTransactionSavepoints(
    transactionId: string,
    activeTransactions: Map<string, TransactionContext>,
  ): Savepoint[] {
    const context = activeTransactions.get(transactionId);
    if (!context) {
      throw TransactionError.transactionNotFound(transactionId);
    }

    return context.getSavepoints();
  }

  /**
   * 检查事务是否为嵌套事务
   * @param transactionId 事务ID
   * @param activeTransactions 活跃事务映射
   * @returns 是否为嵌套事务
   */
  isNestedTransaction(
    transactionId: string,
    activeTransactions: Map<string, TransactionContext>,
  ): boolean {
    const context = activeTransactions.get(transactionId);
    if (!context) {
      throw TransactionError.transactionNotFound(transactionId);
    }

    return context.isNested();
  }

  /**
   * 获取根事务ID
   * @param transactionId 事务ID
   * @param activeTransactions 活跃事务映射
   * @returns 根事务ID
   */
  getRootTransactionId(
    transactionId: string,
    activeTransactions: Map<string, TransactionContext>,
  ): string | undefined {
    const context = activeTransactions.get(transactionId);
    if (!context) {
      throw TransactionError.transactionNotFound(transactionId);
    }

    if (context.isRootTransaction) {
      return context.transactionId;
    }

    // 递归查找根事务
    let currentContext = context;
    while (currentContext.parentTransactionId) {
      const parentContext = activeTransactions.get(
        currentContext.parentTransactionId,
      );
      if (!parentContext) {
        break;
      }

      if (parentContext.isRootTransaction) {
        return parentContext.transactionId;
      }

      currentContext = parentContext;
    }

    return undefined;
  }

  /**
   * 清理已完成的事务
   * @param activeTransactions 活跃事务映射
   * @param queryRunners QueryRunner映射
   * @param maxAge 最大保留时间（毫秒）
   */
  async cleanupCompletedTransactions(
    activeTransactions: Map<string, TransactionContext>,
    queryRunners: Map<string, QueryRunner>,
    maxAge: number = 30 * 60 * 1000, // 30分钟
  ): Promise<void> {
    await this.cleanupHandler.cleanupCompletedTransactions(
      activeTransactions as unknown as Map<string, Record<string, unknown>>,
      queryRunners,
      maxAge,
    );
  }

  /**
   * 获取QueryRunner实例
   * @param transactionId 事务ID
   * @param queryRunners QueryRunner映射
   * @returns QueryRunner实例
   */
  getQueryRunner(
    transactionId: string,
    queryRunners: Map<string, QueryRunner>,
  ): QueryRunner | undefined {
    return queryRunners.get(transactionId);
  }

  /**
   * 清理事务上下文和QueryRunner
   * @param transactionId 事务ID
   * @param context 事务上下文
   * @param activeTransactions 活跃事务映射
   * @param queryRunners QueryRunner映射
   */
  async cleanupTransaction(
    transactionId: string,
    context: TransactionContext,
    activeTransactions: Map<string, TransactionContext>,
    queryRunners: Map<string, QueryRunner>,
  ): Promise<void> {
    // 清理事务上下文和QueryRunner
    if (context?.isRootTransaction) {
      const queryRunner = queryRunners.get(transactionId);
      if (queryRunner) {
        try {
          await queryRunner.release();
        } catch (releaseError) {
          this.logger.error('Failed to release QueryRunner', {
            transactionId,
            error:
              releaseError instanceof Error
                ? releaseError.message
                : String(releaseError),
          });
        }
      }
    }

    // 总是清理事务上下文和QueryRunner引用
    activeTransactions.delete(transactionId);
    queryRunners.delete(transactionId);
  }

  /**
   * 清理嵌套事务上下文（QueryRunner由父事务管理）
   * @param transactionId 事务ID
   * @param activeTransactions 活跃事务映射
   */
  cleanupNestedTransaction(
    transactionId: string,
    activeTransactions: Map<string, TransactionContext>,
  ): void {
    // 清理嵌套事务上下文（QueryRunner由父事务管理）
    activeTransactions.delete(transactionId);
    // 注意：嵌套事务不删除QueryRunner，因为它与父事务共享
  }
}
