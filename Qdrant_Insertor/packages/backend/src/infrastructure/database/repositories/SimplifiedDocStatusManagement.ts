import { DataSource, FindOptionsWhere, DeepPartial } from 'typeorm';
import { BaseRepository, BatchOperationResult } from './BaseRepository.js';
import { Doc } from '../entities/Doc.js';
import { Logger } from '@logging/logger.js';
import { DocId } from '@domain/entities/types.js';

/**
 * 简化的文档状态管理功能
 * 提供状态更新和软删除功能
 */
export class SimplifiedDocStatusManagement extends BaseRepository<Doc> {
  constructor(dataSource: DataSource, logger: Logger) {
    super(dataSource, Doc, logger);
  }

  /**
   * 软删除文档
   * @param id - 文档ID
   * @returns 删除是否成功
   */
  async softDeleteDoc(id: DocId): Promise<boolean> {
    try {
      const result = await this.update(id, {
        deleted: true,
        deleted_at: Date.now(),
      });

      if (result) {
        this.logger.debug(`软删除文档成功`, { id });
      }

      return !!result;
    } catch (error) {
      this.logger.error(`软删除文档失败`, {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 恢复文档
   * @param id - 文档ID
   * @returns 恢复是否成功
   */
  async restore(id: DocId): Promise<boolean> {
    try {
      const result = await this.update(id, {
        deleted: false,
        deleted_at: undefined,
      });

      if (result) {
        this.logger.debug(`恢复文档成功`, { id });
      }

      return !!result;
    } catch (error) {
      this.logger.error(`恢复文档失败`, {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 批量更新文档状态
   * @param ids - 文档ID数组
   * @param status - 新状态
   * @returns 批量操作结果
   */
  async batchUpdateStatus(
    ids: DocId[],
    status: 'new' | 'processing' | 'completed' | 'failed',
  ): Promise<BatchOperationResult> {
    try {
      const result = await this.updateBatch(ids, {
        status,
        updated_at: Date.now(),
      });

      this.logger.debug(`批量更新文档状态完成`, {
        requested: ids.length,
        updated: result.success,
        failed: result.failed,
        status,
      });

      return result;
    } catch (error) {
      this.logger.error(`批量更新文档状态失败`, {
        ids,
        status,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 更新文档信息
   * @param id - 文档ID
   * @param data - 要更新的数据
   * @returns 更新后的文档或null
   */
  async updateDocInfo(
    id: DocId,
    data: Partial<Pick<Doc, 'name' | 'mime' | 'size_bytes'>>,
  ): Promise<Doc | null> {
    try {
      const updateData = {
        ...data,
        updated_at: Date.now(),
      };

      const result = await this.update(id, updateData);

      if (result) {
        this.logger.debug(`更新文档信息成功`, {
          id,
          updatedFields: Object.keys(data),
        });
      }

      // 返回更新后的文档
      const updatedDoc = await this.findById(id);
      if (!updatedDoc) {
        this.logger.warn(`更新文档后无法找到文档: ${id}`);
      }
      return updatedDoc;
    } catch (error) {
      this.logger.error(`更新文档信息失败`, {
        id,
        data,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 批量软删除文档
   * @param ids - 文档ID数组
   * @returns 成功删除的数量
   */
  async batchSoftDelete(ids: DocId[]): Promise<number> {
    try {
      const result = await this.updateBatch(ids, {
        deleted: true,
        deleted_at: Date.now(),
        updated_at: Date.now(),
      });

      this.logger.debug(`批量软删除文档完成`, {
        requested: ids.length,
        deleted: result.success,
        failed: result.failed,
      });

      return result.success;
    } catch (error) {
      this.logger.error(`批量软删除文档失败`, {
        ids,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 批量恢复文档
   * @param ids - 文档ID数组
   * @returns 成功恢复的数量
   */
  async batchRestore(ids: DocId[]): Promise<number> {
    try {
      const result = await this.updateBatch(ids, {
        deleted: false,
        deleted_at: undefined,
        updated_at: Date.now(),
      });

      this.logger.debug(`批量恢复文档完成`, {
        requested: ids.length,
        restored: result.success,
        failed: result.failed,
      });

      return result.success;
    } catch (error) {
      this.logger.error(`批量恢复文档失败`, {
        ids,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 标记文档为处理中
   * @param id - 文档ID
   * @returns 标记是否成功
   */
  async markAsProcessing(id: DocId): Promise<boolean> {
    try {
      const result = await this.update(id, {
        status: 'processing',
        updated_at: Date.now(),
      });

      if (result) {
        this.logger.debug(`标记文档为处理中成功`, { id });
      }

      return !!result;
    } catch (error) {
      this.logger.error(`标记文档为处理中失败`, {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 标记文档为已完成
   * @param id - 文档ID
   * @returns 标记是否成功
   */
  async markAsCompleted(id: DocId): Promise<boolean> {
    try {
      const result = await this.update(id, {
        status: 'completed',
        updated_at: Date.now(),
      });

      if (result) {
        this.logger.debug(`标记文档为已完成成功`, { id });
      }

      return !!result;
    } catch (error) {
      this.logger.error(`标记文档为已完成失败`, {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 标记文档为失败
   * @param id - 文档ID
   * @param errorMessage - 可选的错误信息
   * @returns 标记是否成功
   */
  async markAsFailed(id: DocId, errorMessage?: string): Promise<boolean> {
    try {
      const updateData: DeepPartial<Doc> = {
        status: 'failed',
        updated_at: Date.now(),
      };

      if (errorMessage) {
        updateData.processing_error = errorMessage;
      }

      const result = await this.update(id, updateData);

      if (result) {
        this.logger.debug(`标记文档为失败成功`, { id, errorMessage });
      }

      return !!result;
    } catch (error) {
      this.logger.error(`标记文档为失败失败`, {
        id,
        errorMessage,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 重置文档状态为新建
   * @param id - 文档ID
   * @returns 重置是否成功
   */
  async resetToNew(id: DocId): Promise<boolean> {
    try {
      const result = await this.update(id, {
        status: 'new',
        processing_error: undefined,
        updated_at: Date.now(),
      });

      if (result) {
        this.logger.debug(`重置文档状态为新建成功`, { id });
      }

      return !!result;
    } catch (error) {
      this.logger.error(`重置文档状态为新建失败`, {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
