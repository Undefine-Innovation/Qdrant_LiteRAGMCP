import { DataSource, DeleteResult } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { ScrapeResults } from '../entities/index.js';
import { BaseRepository } from './BaseRepository.js';

/**
 * ScrapeResults Repository实现
 * 继承BaseRepository，提供ScrapeResults特定的数据库操作
 */
export class ScrapeResultsRepository extends BaseRepository<ScrapeResults> {
  /**
   * 创建ScrapeResultsRepository实例
   * @param dataSource TypeORM数据源
   * @param logger 日志记录器
   */
  constructor(dataSource: DataSource, logger: Logger) {
    super(dataSource, ScrapeResults, logger);
  }

  /**
   * 根据任务ID获取抓取结果
   * @param taskId 任务ID
   * @returns 抓取结果数组
   */
  async findByTaskId(taskId: string): Promise<ScrapeResults[]> {
    try {
      const results = await this.repository.find({
        where: {
          task_id: taskId,
        },
        order: {
          created_at: 'ASC' as const,
        },
      });
      return results;
    } catch (error) {
      this.logger.error('根据任务ID获取抓取结果失败', { error });
      throw error;
    }
  }

  /**
   * 根据状态获取抓取结果
   * @param status 状态
   * @param limit 限制数量
   * @param offset 偏移量
   * @returns 抓取结果数组
   */
  async findByStatus(
    status: 'pending' | 'completed' | 'cancelled',
    limit?: number,
    offset?: number,
  ): Promise<ScrapeResults[]> {
    try {
      const options: {
        where: { status: 'pending' | 'completed' | 'cancelled' };
        order: { created_at: 'DESC' };
        take?: number;
        skip?: number;
      } = {
        where: {
          status,
        },
        order: {
          created_at: 'DESC' as const,
        },
      };

      if (limit !== undefined) {
        options.take = limit;
      }

      if (offset !== undefined) {
        options.skip = offset;
      }

      const results = await this.repository.find(options);
      return results;
    } catch (error) {
      this.logger.error('根据状态获取抓取结果失败', { error });
      throw error;
    }
  }

  /**
   * 标记为已导入
   * @param id 记录ID
   * @param docId 文档ID
   * @returns 是否成功
   */
  async markAsImported(id: string, docId: string): Promise<boolean> {
    try {
      const result = await this.repository.update(id, {
        status: 'completed',
        updated_at: Date.now(),
      });
      return result !== null;
    } catch (error) {
      this.logger.error('标记为已导入失败', { error });
      throw error;
    }
  }

  /**
   * 标记为已导入 - 别名，兼容旧DAO接口
   * @param id 记录ID
   * @param docId 文档ID
   * @returns 是否成功
   */
  async markImported(id: string, docId: string): Promise<boolean> {
    return await this.markAsImported(id, docId);
  }

  /**
   * 列表查询 - 兼容旧DAO接口
   * @param params 查询参数
   * @returns 抓取结果数组
   */
  /**
   * 列表查询 - 兼容旧DAO接口
   * @param params 查询参数
   * @param params.status 状态筛选
   * @param params.taskId 任务ID筛选
   * @param params.limit 限制数量
   * @param params.offset 偏移量
   * @param params.includeContent 是否包含内容
   * @returns 抓取结果数组
   */
  async list(params?: {
    status?: 'pending' | 'completed' | 'cancelled';
    taskId?: string;
    limit?: number;
    offset?: number;
    includeContent?: boolean;
  }): Promise<ScrapeResults[]> {
    try {
      const where: Record<string, unknown> = {};
      if (params?.status) {
        where.status = params.status;
      }
      if (params?.taskId) {
        where.task_id = params.taskId;
      }

      const options: {
        where: Record<string, unknown>;
        order: { created_at: 'DESC' };
        take?: number;
        skip?: number;
      } = {
        where,
        order: {
          created_at: 'DESC' as const,
        },
      };

      if (params?.limit !== undefined) {
        options.take = params.limit;
      }

      if (params?.offset !== undefined) {
        options.skip = params.offset;
      }

      const results = await this.repository.find(options);

      // 如果不包含内容，则移除content字段
      if (params?.includeContent === false) {
        return results.map((r: ScrapeResults) => ({
          ...r,
          content: undefined,
        })) as ScrapeResults[];
      }

      return results;
    } catch (error) {
      this.logger.error('列表查询失败', { error });
      throw error;
    }
  }

  /**
   * 根据ID查找单个记录 - 兼容旧DAO接口
   * @param id 记录ID
   * @returns 抓取结果或null
   */
  /**
   * 根据ID查找单个记录 - 兼容旧DAO接口
   * @param id 记录ID
   * @returns 抓取结果或null
   */
  async getById(id: string): Promise<ScrapeResults | null> {
    try {
      const result = await this.repository.findOne({
        where: { id },
      });
      return result || null;
    } catch (error) {
      this.logger.error('根据ID查询记录失败', { error });
      throw error;
    }
  }

  /**
   * 根据任务分组聚合
   * @param params 参数对象
   * @param params.limit 限制数量
   * @param params.offset 偏移量
   * @returns 任务分组数组
   */
  /**
   * 根据任务分组聚合
   * @param params 参数对象
   * @param params.limit 限制数量
   * @param params.offset 偏移量
   * @returns 任务分组数组
   */
  async getTaskGroups(params?: { limit?: number; offset?: number }): Promise<
    Array<{
      taskId: string;
      total: number;
      pending: number;
      imported: number;
      deleted: number;
      first_at: number;
      last_at: number;
    }>
  > {
    try {
      // 使用原生SQL查询来获取分组数据
      const query = `
        SELECT
          task_id as taskId,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as imported,
          SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as deleted,
          MIN(created_at) as first_at,
          MAX(created_at) as last_at
        FROM scrape_results
        GROUP BY task_id
        ORDER BY last_at DESC
        ${params?.limit ? `LIMIT ${params.limit}` : ''}
        ${params?.offset ? `OFFSET ${params.offset}` : ''}
      `;

      const results = (await this.repository.query(query)) as Array<{
        taskId: string;
        total: number;
        pending: number;
        imported: number;
        deleted: number;
        first_at: number;
        last_at: number;
      }>;
      return results;
    } catch (error) {
      this.logger.error('根据任务分组聚合失败', { error });
      throw error;
    }
  }

  /**
   * 根据任务删除记录
   * @param taskId 任务ID
   * @returns 删除的记录数
   */
  async deleteByTask(taskId: string): Promise<number> {
    try {
      const result: DeleteResult = await this.repository.delete({
        task_id: taskId,
      });
      return result.affected || 0;
    } catch (error) {
      this.logger.error('根据任务删除记录失败', { error });
      throw error;
    }
  }
}
