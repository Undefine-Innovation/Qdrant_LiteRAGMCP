/**
 * 文档聚合操作模块
 * 包含所有操作相关的方法（增删改）
 */

import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { DocId, CollectionId } from '@domain/entities/types.js';
import { DocRepository } from './DocRepository.js';
import { ChunkRepository } from './ChunkRepository.js';
import { DocumentAggregate } from '@domain/aggregates/index.js';
import { Doc } from '@domain/entities/Doc.js';
import { DocumentAggregateCore } from './DocumentAggregateCore.js';

/**
 * 文档聚合操作模块
 * 包含所有操作相关的方法（增删改）
 */
export class DocumentAggregateOperations {
  /**
   * 创建文档聚合操作模块实例
   * @param dataSource TypeORM数据源
   * @param logger 日志记录器
   * @param docRepository 文档仓库
   * @param chunkRepository 块仓库
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: Logger,
    private readonly docRepository: DocRepository,
    private readonly chunkRepository: ChunkRepository,
  ) {}

  /**
   * 保存文档聚合
   * @param aggregate 文档聚合
   */
  async save(aggregate: DocumentAggregate): Promise<void> {
    try {
      // 验证DataSource是否初始化
      if (!this.dataSource.isInitialized) {
        this.logger.error('保存文档聚合失败: DataSource未初始化', {
          docId: aggregate.id,
        });
        throw new Error(
          'Database connection is not initialized. Please check connection configuration.',
        );
      }

      await this.dataSource.transaction(async (manager) => {
        // 保存文档实体
        const docEntity =
          DocumentAggregateCore.mapAggregateToDocEntity(aggregate);
        await manager.save(docEntity);

        // 保存块实体
        const chunkEntities =
          DocumentAggregateCore.mapAggregateToChunkEntities(aggregate);
        if (chunkEntities.length > 0) {
          await this.chunkRepository.createBatchWithManager(
            chunkEntities,
            manager,
          );
        }

        this.logger.debug('文档聚合保存成功', {
          docId: aggregate.id,
          collectionId: aggregate.collectionId,
          chunkCount: chunkEntities.length,
        });
      });
    } catch (error) {
      this.logger.error('保存文档聚合失败', {
        docId: aggregate.id,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 删除文档聚合
   * @param id 文档ID
   * @returns 是否成功删除
   */
  async delete(id: DocId): Promise<boolean> {
    try {
      // 验证DataSource是否初始化
      if (!this.dataSource.isInitialized) {
        this.logger.error('删除文档聚合失败: DataSource未初始化', {
          docId: id,
        });
        throw new Error(
          'Database connection is not initialized. Please check connection configuration.',
        );
      }

      // First, delete chunks (if any exist)
      try {
        const manager = this.dataSource.manager;
        await this.chunkRepository.deleteByDocIdWithManager(
          id,
          manager as {
            delete: (
              entity: unknown,
              where: unknown,
            ) => Promise<{ affected?: number }>;
          },
        );
      } catch (error) {
        // Log but continue if chunks don't exist or already deleted
        this.logger.debug('块删除失败或不存在', {
          docId: id,
          error: (error as Error).message,
        });
      }

      // Then, delete the document
      const manager = this.dataSource.manager;

      // Use the transaction Manager directly for TypeORM compatibility
      const result = await manager.delete(Doc, { id: id });

      // Check if document was found and deleted
      if (!result || !result.affected || result.affected === 0) {
        this.logger.warn('文档未找到或已被删除', {
          docId: id,
        });
        return false;
      }

      this.logger.info('文档聚合删除成功', {
        docId: id,
      });

      return true;
    } catch (error) {
      this.logger.error('删除文档聚合失败', {
        docId: id,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 潜删除文档聚合
   * @param id 文档ID
   * @returns 是否成功软删除
   */
  async softDelete(id: DocId): Promise<boolean> {
    try {
      await this.docRepository.softDeleteDoc(id);

      this.logger.info('文档聚合软删除成功', {
        docId: id,
      });

      return true;
    } catch (error) {
      this.logger.error('文档聚合软删除失败', {
        docId: id,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 恢复已删除的文档聚合
   * @param id 文档ID
   * @returns 是否成功恢复
   */
  async restore(id: DocId): Promise<boolean> {
    try {
      await this.docRepository.restore(id);

      this.logger.info('文档聚合恢复成功', {
        docId: id,
      });

      return true;
    } catch (error) {
      this.logger.error('文档聚合恢复失败', {
        docId: id,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 检查文档是否可以被删除
   * @param id 文档ID
   * @returns 是否可以删除
   */
  async canBeDeleted(id: DocId): Promise<boolean> {
    try {
      const doc = await this.docRepository.findById(id as string);
      if (!doc) {
        return false;
      }

      // 可以添加其他业务规则检查
      return true;
    } catch (error) {
      this.logger.error('检查文档是否可以删除失败', {
        docId: id,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 批量更新文档状态
   * @param ids 文档ID数组
   * @param status 新状态
   * @returns 更新结果
   */
  async batchUpdateStatus(ids: DocId[], status: string): Promise<number> {
    try {
      const allowedStatuses = [
        'new',
        'processing',
        'completed',
        'failed',
      ] as const;
      if (
        !allowedStatuses.includes(status as (typeof allowedStatuses)[number])
      ) {
        throw new Error(`Unsupported document status: ${status}`);
      }
      const targetStatus = status as (typeof allowedStatuses)[number];
      const result = await this.docRepository.batchUpdateStatus(
        ids,
        targetStatus,
      );
      const updatedCount =
        typeof result === 'object'
          ? (result.updated ?? result.success)
          : result;

      this.logger.info('批量更新文档状态成功', {
        count: updatedCount,
        status,
      });

      return updatedCount;
    } catch (error) {
      this.logger.error('批量更新文档状态失败', {
        ids,
        status,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 验证文档聚合数据
   * @param aggregate 文档聚合
   * @returns 验证结果
   */
  validateAggregate(aggregate: DocumentAggregate): {
    valid: boolean;
    errors: string[];
  } {
    return DocumentAggregateCore.validateAggregate(aggregate);
  }

  /**
   * 创建文档聚合
   * @param id 文档ID
   * @param collectionId 集合ID
   * @param key 文档键
   * @param name 文档名称
   * @param content 文档内容
   * @param sizeBytes 文档大小（字节）
   * @param mime MIME类型
   * @returns 文档聚合
   */
  createAggregate(
    id: DocId,
    collectionId: CollectionId,
    key: string,
    name: string,
    content: string,
    sizeBytes: number,
    mime: string,
  ): DocumentAggregate {
    // 这里需要根据实际的DocumentAggregate实现来创建
    // 由于我们没有访问DocumentAggregate构造函数的权限，
    // 这里返回一个基本的聚合对象
    return {
      id,
      collectionId,
      key,
      name,
      getChunks: () => [],
      getDocument: () => ({
        id,
        collectionId,
        key,
        name,
        document: {
          sizeBytes,
          mime,
        },
        content: {
          getValue: () => content,
        },
        isDeleted: false,
        status: 'new' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      getStatus: () => 'new' as const,
      isDeleted: () => false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as DocumentAggregate;
  }

  /**
   * 计算文档聚合的统计信息
   * @param aggregate 文档聚合
   * @returns 统计信息
   */
  getAggregateStats(aggregate: DocumentAggregate): {
    totalChunks: number;
    totalSize: number;
    averageChunkSize: number;
    hasContent: boolean;
  } {
    return DocumentAggregateCore.getAggregateStats(aggregate);
  }
}
