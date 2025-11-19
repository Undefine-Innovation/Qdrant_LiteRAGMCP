import { QueryRunner } from 'typeorm';
import { Logger } from '@logging/logger.js';
import {
  TransactionOperation,
  TransactionOperationType,
} from '@domain/repositories/ITransactionManager.js';
import { CollectionId, DocId, PointId } from '@domain/entities/types.js';

/**
 * 事务回滚处理器
 * 负责处理各种操作的回滚逻辑
 */
export class TransactionRollback {
  constructor(private readonly logger: Logger) {}

  /**
   * 回滚单个操作
   * @param operation 要回滚的操作
   * @param transactionId 事务ID
   * @param queryRunner QueryRunner实例
   */
  async rollbackOperation(
    operation: TransactionOperation,
    transactionId: string,
    queryRunner: QueryRunner,
  ): Promise<void> {
    switch (operation.target) {
      case 'collection':
        await this.rollbackCollectionOperation(operation, queryRunner);
        break;
      case 'document':
        await this.rollbackDocumentOperation(operation, queryRunner);
        break;
      case 'chunk':
        await this.rollbackChunkOperation(operation, queryRunner);
        break;
      default:
        this.logger.warn('Unknown operation target for rollback', {
          transactionId,
          target: operation.target,
        });
    }
  }

  /**
   * 回滚集合操作
   * @param operation 事务操作
   * @param queryRunner QueryRunner实例
   */
  private async rollbackCollectionOperation(
    operation: TransactionOperation,
    queryRunner: QueryRunner,
  ): Promise<void> {
    const { type, targetId, rollbackData } = operation;
    const collectionId = targetId as CollectionId;

    try {
      switch (type) {
        case TransactionOperationType.CREATE:
          // 回滚创建操作：删除集合
          if (rollbackData) {
            await queryRunner.manager.delete('Collection', {
              id: collectionId,
            });
          }
          break;
        case TransactionOperationType.UPDATE:
          // 回滚更新操作：恢复原始数据
          if (
            rollbackData &&
            (rollbackData as Record<string, unknown>).originalState
          ) {
            const originalState = (rollbackData as Record<string, unknown>)
              .originalState;
            await queryRunner.manager.update(
              'Collection',
              { id: collectionId },
              originalState as Record<string, unknown>,
            );
          }
          break;
        case TransactionOperationType.DELETE:
          // 回滚删除操作：恢复集合
          if (
            rollbackData &&
            (rollbackData as Record<string, unknown>).originalState
          ) {
            const originalState = (rollbackData as Record<string, unknown>)
              .originalState;
            await queryRunner.manager.save(
              'Collection',
              originalState as Record<string, unknown>,
            );
          }
          break;
      }
    } catch (error) {
      this.logger.error('Failed to rollback collection operation', {
        collectionId,
        operation: type,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 回滚文档操作
   * @param operation 事务操作
   * @param queryRunner QueryRunner实例
   */
  private async rollbackDocumentOperation(
    operation: TransactionOperation,
    queryRunner: QueryRunner,
  ): Promise<void> {
    const { type, targetId, rollbackData } = operation;
    const docId = targetId as DocId;

    try {
      switch (type) {
        case TransactionOperationType.CREATE:
          // 回滚创建操作：删除文档
          if (rollbackData) {
            await queryRunner.manager.delete('Doc', { key: docId });
          }
          break;
        case TransactionOperationType.UPDATE:
          // 回滚更新操作：恢复原始数据
          if (
            rollbackData &&
            (rollbackData as Record<string, unknown>).originalState
          ) {
            const originalState = (rollbackData as Record<string, unknown>)
              .originalState;
            await queryRunner.manager.update(
              'Doc',
              { key: docId },
              originalState as Record<string, unknown>,
            );
          }
          break;
        case TransactionOperationType.DELETE:
          // 回滚删除操作：恢复文档
          if (
            rollbackData &&
            (rollbackData as Record<string, unknown>).originalState
          ) {
            const originalState = (rollbackData as Record<string, unknown>)
              .originalState;
            await queryRunner.manager.save(
              'Doc',
              originalState as Record<string, unknown>,
            );
          }
          break;
      }
    } catch (error) {
      this.logger.error('Failed to rollback document operation', {
        docId,
        operation: type,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 回滚块操作
   * @param operation 事务操作
   * @param queryRunner QueryRunner实例
   */
  private async rollbackChunkOperation(
    operation: TransactionOperation,
    queryRunner: QueryRunner,
  ): Promise<void> {
    const { type, targetId, rollbackData } = operation;
    const pointId = targetId as PointId;

    try {
      switch (type) {
        case TransactionOperationType.CREATE:
          // 回滚创建操作：删除块
          if (rollbackData) {
            await queryRunner.manager.delete('Chunk', { pointId });
          }
          break;
        case TransactionOperationType.UPDATE:
          // 回滚更新操作：恢复原始数据
          if (
            rollbackData &&
            (rollbackData as Record<string, unknown>).originalState
          ) {
            const originalState = (rollbackData as Record<string, unknown>)
              .originalState;
            await queryRunner.manager.update(
              'Chunk',
              { pointId },
              originalState as Record<string, unknown>,
            );
          }
          break;
        case TransactionOperationType.DELETE:
          // 回滚删除操作：恢复块
          if (
            rollbackData &&
            (rollbackData as Record<string, unknown>).originalState
          ) {
            const originalState = (rollbackData as Record<string, unknown>)
              .originalState;
            await queryRunner.manager.save(
              'Chunk',
              originalState as Record<string, unknown>,
            );
          }
          break;
      }
    } catch (error) {
      this.logger.error('Failed to rollback chunk operation', {
        pointId,
        operation: type,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
