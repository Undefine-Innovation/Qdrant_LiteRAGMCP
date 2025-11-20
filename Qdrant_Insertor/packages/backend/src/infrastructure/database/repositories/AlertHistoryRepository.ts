import { DataSource, FindManyOptions } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { AlertHistory } from '../entities/index.js';
import { BaseRepository } from './BaseRepository.js';

/**
 * AlertHistory 仓库实现
 *
 * 继承 BaseRepository，提供 AlertHistory 的数据库操作方法
 */
export class AlertHistoryRepository extends BaseRepository<AlertHistory> {
  /**
   * 创建 AlertHistoryRepository 实例
   * @param dataSource TypeORM 数据源
   * @param logger 日志记录器
   */
  constructor(dataSource: DataSource, logger: Logger) {
    super(dataSource, AlertHistory, logger);
  }

  /**
   * 根据规则 ID 获取告警历史
   * @param ruleId 规则 ID
   * @param limit 返回条数上限
   * @returns 告警历史列表
   */
  async findByRuleId(
    ruleId: string,
    limit: number = 100,
  ): Promise<AlertHistory[]> {
    try {
      const repository = this.getRepository();
      return await repository.find({
        where: { rule_id: ruleId },
        order: { created_at: 'DESC' },
        take: limit,
      });
    } catch (error) {
      this.logger.error('根据规则 ID 获取告警历史失败', { error });
      throw error;
    }
  }

  /**
   * 按时间范围获取告警历史
   * @param fieldName 时间字段名
   * @param startTime 开始时间（时间戳）
   * @param endTime 结束时间（时间戳）
   * @param options 可选查询参数
   * @returns AlertHistory[]
   */
  async findByTimeRange(
    fieldName: string,
    startTime: number,
    endTime: number,
    options: FindManyOptions<AlertHistory> = {},
  ): Promise<AlertHistory[]> {
    const mergedOptions: FindManyOptions<AlertHistory> = {
      ...options,
      order: options.order ?? { triggered_at: 'DESC' },
    };
    return super.findByTimeRange(fieldName, startTime, endTime, mergedOptions);
  }

  /**
   * 基于 `triggered_at` 字段查询告警历史
   * @param startTime 开始时间（时间戳）
   * @param endTime 结束时间（时间戳）
   * @param limit 返回条数上限
   * @returns AlertHistory[]
   */
  async findByTriggeredAtRange(
    startTime: number,
    endTime: number,
    limit: number = 100,
  ): Promise<AlertHistory[]> {
    return this.findByTimeRange('triggered_at', startTime, endTime, {
      take: limit,
      order: { triggered_at: 'DESC' },
    });
  }

  /**
   * 按严重级别获取告警
   * @param severity 严重级别
   * @param limit 返回条数上限
   * @returns AlertHistory[]
   */
  async findBySeverity(
    severity: 'low' | 'medium' | 'high' | 'critical',
    limit: number = 100,
  ): Promise<AlertHistory[]> {
    try {
      const repository = this.getRepository();
      return await repository.find({
        where: { severity },
        order: { triggered_at: 'DESC' },
        take: limit,
      });
    } catch (error) {
      this.logger.error('按严重级别获取告警失败', { error });
      throw error;
    }
  }

  /**
   * 按状态获取告警
   * @param status 状态
   * @param limit 返回条数上限
   * @returns AlertHistory[]
   */
  async findByStatus(
    status: 'triggered' | 'resolved' | 'suppressed',
    limit: number = 100,
  ): Promise<AlertHistory[]> {
    try {
      const repository = this.getRepository();
      return await repository.find({
        where: { status },
        order: { triggered_at: 'DESC' },
        take: limit,
      });
    } catch (error) {
      this.logger.error('按状态获取告警失败', { error });
      throw error;
    }
  }

  /**
   * 更新单条告警状态
   * @param id 告警 ID
   * @param status 状态
   * @param resolvedAt 解决时间（可选，时间戳）
   * @returns 是否更新成功
   */
  async updateStatus(
    id: string,
    status: 'triggered' | 'resolved' | 'suppressed',
    resolvedAt?: number,
  ): Promise<boolean> {
    try {
      const updateData: { status: typeof status; resolved_at?: number } = {
        status,
      };
      if (resolvedAt) {
        updateData.resolved_at = resolvedAt;
      }
      const repository = this.getRepository();
      const result = await repository.update({ id }, updateData);
      return (result.affected || 0) > 0;
    } catch (error) {
      this.logger.error('更新告警状态失败', { error, id });
      throw error;
    }
  }

  /**
   * 批量更新告警状态
   * @param ids 告警 ID 列表
   * @param status 状态
   * @returns 受影响的记录数
   */
  async updateStatusBatch(
    ids: string[],
    status: 'triggered' | 'resolved' | 'suppressed',
  ): Promise<number> {
    try {
      if (ids.length === 0) {
        return 0;
      }
      const repository = this.getRepository();
      const result = await repository
        .createQueryBuilder()
        .update(AlertHistory)
        .set({ status })
        .whereInIds(ids)
        .execute();
      return result.affected || 0;
    } catch (error) {
      this.logger.error('批量更新告警状态失败', { error });
      throw error;
    }
  }

  /**
   * 获取告警统计信息
   * @returns 统计信息对象
   */
  async getAlertStats(): Promise<{
    total: number;
    triggered: number;
    resolved: number;
    suppressed: number;
  }> {
    try {
      const repository = this.getRepository();
      const total = await repository.count();
      const triggered = await repository.count({
        where: { status: 'triggered' },
      });
      const resolved = await repository.count({
        where: { status: 'resolved' },
      });
      const suppressed = await repository.count({
        where: { status: 'suppressed' },
      });
      return { total, triggered, resolved, suppressed };
    } catch (error) {
      this.logger.error('获取告警统计失败', { error });
      throw error;
    }
  }

  /**
   * 清理已解决且早于指定天数的告警历史
   * @param daysOld 天数，默认 30 天
   * @returns 删除的记录数
   */
  async cleanupResolvedAlerts(daysOld: number = 30): Promise<number> {
    try {
      const beforeTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;
      const repository = this.getRepository();
      const result = await repository
        .createQueryBuilder()
        .delete()
        .from(AlertHistory)
        .where('status = :status AND triggered_at < :beforeTime', {
          status: 'resolved',
          beforeTime,
        })
        .execute();
      return result.affected || 0;
    } catch (error) {
      this.logger.error('清理已解决告警失败', { error });
      throw error;
    }
  }
}

