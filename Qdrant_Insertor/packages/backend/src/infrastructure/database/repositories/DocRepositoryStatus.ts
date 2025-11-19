import { DataSource, EntityManager } from 'typeorm';
import { BaseRepository } from './BaseRepository.js';
import { Doc } from '../entities/Doc.js';
import { Logger } from '@logging/logger.js';
import { DocId, CollectionId } from '@domain/entities/types.js';
import { BatchOperationResult } from './BaseRepository.js';

/**
 * DocRepository 文档状态管理方法
 */
export class DocRepositoryStatus {
  constructor(
    protected dataSource: DataSource,
    protected logger: Logger,
  ) {}

  protected createRepository() {
    return this.dataSource.getRepository(Doc);
  }

  /**
   * 软删除文档
   * @param id 文档ID
   * @returns 是否删除成功
   */
  async softDeleteDoc(id: DocId): Promise<boolean> {
    try {
      const repository = this.createRepository();
      const result = await repository.update(id, {
        deleted: true,
        deleted_at: Date.now(),
        updated_at: Date.now(),
      });
      const success = (result.affected || 0) > 0;
      if (success) {
        this.logger.debug(`软删除文档成功`, { id });
      }
      return success;
    } catch (error) {
      this.logger.error(`软删除文档失败`, {
        id,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 恢复已删除的文档
   * @param id 文档ID
   * @returns 是否恢复成功
   */
  async restore(id: DocId): Promise<boolean> {
    try {
      const repository = this.createRepository();
      const result = await repository.update(id, {
        deleted: false,
        deleted_at: () => 'NULL',
        updated_at: Date.now(),
      });
      const success = (result.affected || 0) > 0;
      if (success) {
        this.logger.debug(`恢复文档成功`, { id });
      }
      return success;
    } catch (error) {
      this.logger.error(`恢复文档失败`, {
        id,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 批量更新文档状态
   * @param ids 文档ID数组
   * @param status 新状态
   * @returns 批量操作结果
   */
  async batchUpdateStatus(
    ids: DocId[],
    status: 'new' | 'processing' | 'completed' | 'failed',
  ): Promise<BatchOperationResult> {
    try {
      const repository = this.createRepository();
      const updateData = { status };

      // 使用批量更新
      const result = await repository
        .createQueryBuilder()
        .update(Doc)
        .set(updateData)
        .where('id IN (:...ids)', { ids })
        .execute();

      const success = result.affected || 0;
      const failed = ids.length - success;

      const enrichedResult: BatchOperationResult = {
        success,
        failed,
        updated: success,
        errors: [],
      };

      this.logger.debug(`批量更新文档状态完成`, {
        requested: ids.length,
        updated: enrichedResult.updated,
        failed: enrichedResult.failed,
        status,
      });
      return enrichedResult;
    } catch (error) {
      this.logger.error(`批量更新文档状态失败`, {
        ids,
        status,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 更新文档基本信息
   * @param id 文档ID
   * @param data 更新数据
   * @returns 更新后的文档
   */
  async updateDocInfo(
    id: DocId,
    data: Partial<Pick<Doc, 'name' | 'mime' | 'size_bytes'>>,
  ): Promise<Doc | null> {
    try {
      const repository = this.createRepository();
      const result = await repository.update(id, {
        ...data,
        updated_at: Date.now(),
      });

      if ((result.affected || 0) > 0) {
        this.logger.debug(`更新文档基本信息成功`, {
          id,
          updatedFields: Object.keys(data),
        });
        return await repository.findOne({ where: { id } });
      }
      return null;
    } catch (error) {
      this.logger.error(`更新文档基本信息失败`, {
        id,
        data,
        error: (error as Error).message,
      });
      throw error;
    }
  }
}
