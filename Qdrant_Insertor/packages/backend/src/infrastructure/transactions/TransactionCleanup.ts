import { QueryRunner } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { TransactionStatus } from '@domain/repositories/ITransactionManager.js';

/**
 * 事务清理处理器
 * 负责清理已完成和过期的事务
 */
export class TransactionCleanup {
  private readonly DEFAULT_CLEANUP_AGE = 30 * 60 * 1000; // 30分钟

  constructor(private readonly logger: Logger) {}

  /**
   * 清理已完成的事务
   * @param activeTransactions 活跃事务映射
   * @param queryRunners QueryRunner映射
   * @param maxAge 最大保留时间（毫秒）
   */
  async cleanupCompletedTransactions(
    activeTransactions: Map<string, Record<string, unknown>>,
    queryRunners: Map<string, QueryRunner>,
    maxAge: number = this.DEFAULT_CLEANUP_AGE,
  ): Promise<void> {
    const now = Date.now();
    const transactionsToRemove: string[] = [];

    for (const [transactionId, context] of activeTransactions.entries()) {
      const isCompleted =
        context.status === TransactionStatus.COMMITTED ||
        context.status === TransactionStatus.ROLLED_BACK ||
        context.status === TransactionStatus.FAILED;

      // 使用 completedAt 字段如果存在，否则使用 startTime
      const completionRaw =
        (context as Record<string, unknown>).completedAt ??
        (context as Record<string, unknown>).startTime;
      const completionTime = Number(completionRaw) || 0;
      const isExpired = completionTime > 0 && now - completionTime > maxAge;

      if (isCompleted && isExpired) {
        transactionsToRemove.push(transactionId);
      }
    }

    for (const transactionId of transactionsToRemove) {
      // 清理QueryRunner
      const queryRunner = queryRunners.get(transactionId);
      if (queryRunner) {
        try {
          await queryRunner.release();
        } catch (error) {
          this.logger.warn('Failed to release QueryRunner during cleanup', {
            transactionId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      activeTransactions.delete(transactionId);
      queryRunners.delete(transactionId);
      this.logger.debug('Cleaned up completed transaction', { transactionId });
    }

    if (transactionsToRemove.length > 0) {
      this.logger.info('Cleaned up completed transactions', {
        count: transactionsToRemove.length,
      });
    }
  }
}
