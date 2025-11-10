import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { AlertRules } from '../entities/index.js';
import { BaseRepository } from './BaseRepository.js';

/**
 * AlertRules Repository实现
 * 继承BaseRepository，提供AlertRules特定的数据库操作
 */
export class AlertRulesRepository extends BaseRepository<AlertRules> {
  /**
   * 创建AlertRulesRepository实例
   * @param dataSource TypeORM数据源
   * @param logger 日志记录器
   */
  constructor(dataSource: DataSource, logger: Logger) {
    super(dataSource, AlertRules, logger);
  }

  /**
   * 根据状态获取告警规则
   * @param active 是否只返回活跃的规则
   * @returns 告警规则数组
   */
  async findByActive(active: boolean = true): Promise<AlertRules[]> {
    try {
      const results = await this.repository.find({
        where: {
          is_active: active,
        },
      });
      return results;
    } catch (error) {
      this.logger.error('根据状态获取告警规则失败', { error });
      throw error;
    }
  }

  /**
   * 分页获取告警规则
   * @param page 页码
   * @param limit 每页数量
   * @param sort 排序字段
   * @param order 排序方向
   * @returns 分页的告警规则
   */
  async findPaginated(
    page: number,
    limit: number,
    sort: string = 'created_at',
    order: 'asc' | 'desc' = 'desc',
  ): Promise<{ rules: AlertRules[]; total: number }> {
    try {
      const skip = (page - 1) * limit;
      const [results, total] = await this.repository.findAndCount({
        where: {},
        order: {
          [sort]: order.toUpperCase(),
        },
        skip,
        take: limit,
      });

      return {
        rules: results,
        total,
      };
    } catch (error) {
      this.logger.error('分页获取告警规则失败', { error });
      throw error;
    }
  }

  /**
   * 根据ID列表获取规则 - 兼容旧DAO接口
   * @param ids 规则ID列表
   * @returns 告警规则数组
   */
  async findByIds(ids: string[]): Promise<AlertRules[]> {
    try {
      if (ids.length === 0) {
        return [];
      }
      const results = await this.repository.findByIds(ids);
      return results;
    } catch (error) {
      this.logger.error('根据ID列表获取规则失败', { error });
      throw error;
    }
  }

  /**
   * 获取活跃规则总数
   * @returns 活跃规则数量
   */
  async countActive(): Promise<number> {
    try {
      const count = await this.repository.count({
        where: {
          is_active: true,
        },
      });
      return count;
    } catch (error) {
      this.logger.error('统计活跃规则数量失败', { error });
      throw error;
    }
  }

  /**
   * 批量更新规则状态
   * @param ids 规则ID列表
   * @param isActive 是否活跃
   * @returns 更新的数量
   */
  async updateStatusBatch(ids: string[], isActive: boolean): Promise<number> {
    try {
      const result = await this.repository
        .createQueryBuilder()
        .update(AlertRules)
        .set({ is_active: isActive })
        .whereInIds(ids)
        .execute();

      return result.affected || 0;
    } catch (error) {
      this.logger.error('批量更新规则状态失败', { error });
      throw error;
    }
  }
}
