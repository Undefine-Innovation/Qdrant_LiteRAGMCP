import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { SystemMetrics } from '../entities/index.js';
import { BaseRepository } from './BaseRepository.js';

/**
 * SystemMetrics Repository实现
 * 继承BaseRepository，提供SystemMetrics特定的数据库操作
 */
export class SystemMetricsRepository extends BaseRepository<SystemMetrics> {
  /**
   * 创建SystemMetricsRepository实例
   * @param dataSource TypeORM数据源
   * @param logger 日志记录器
   */
  constructor(dataSource: DataSource, logger: Logger) {
    super(dataSource, SystemMetrics, logger);
  }

  /**
   * 根据时间范围获取系统指标
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @returns 系统指标数组
   */
  async findByTimeRange(
    startTime: number,
    endTime: number,
  ): Promise<SystemMetrics[]> {
    try {
      const results = await this.repository
        .createQueryBuilder('metric')
        .where('metric.timestamp >= :startTime', { startTime })
        .andWhere('metric.timestamp <= :endTime', { endTime })
        .orderBy('metric.timestamp', 'DESC')
        .getMany();
      return results;
    } catch (error) {
      this.logger.error('根据时间范围获取系统指标失败', { error });
      throw error;
    }
  }

  /**
   * 获取最新的系统指标
   * @param limit 限制数量
   * @returns 系统指标数组
   */
  async findLatest(limit: number = 10): Promise<SystemMetrics[]> {
    try {
      const results = await this.repository.find({
        order: {
          created_at: 'DESC',
        },
        take: limit,
      });
      return results;
    } catch (error) {
      this.logger.error('获取最新系统指标失败', { error });
      throw error;
    }
  }

  /**
   * 根据指标名称和时间范围获取系统指标
   * @param metricName 指标名称
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @param limit 限制数量
   * @returns 系统指标数组
   */
  async getByNameAndTimeRange(
    metricName: string,
    startTime: number,
    endTime: number,
    limit: number = 100,
  ): Promise<SystemMetrics[]> {
    try {
      const results = await this.repository
        .createQueryBuilder('metric')
        .where('metric.metric_name = :metricName', { metricName })
        .andWhere('metric.timestamp >= :startTime', { startTime })
        .andWhere('metric.timestamp <= :endTime', { endTime })
        .orderBy('metric.timestamp', 'DESC')
        .limit(limit)
        .getMany();
      return results;
    } catch (error) {
      this.logger.error('根据指标名称和时间范围获取系统指标失败', { error });
      return [];
    }
  }

  /**
   * 获取最新的指定指标值
   * @param metricName 指标名称
   * @returns 最新的系统指标或null
   */
  async getLatestByName(metricName: string): Promise<SystemMetrics | null> {
    try {
      const result = await this.repository
        .createQueryBuilder('metric')
        .where('metric.metric_name = :metricName', { metricName })
        .orderBy('metric.timestamp', 'DESC')
        .limit(1)
        .getOne();
      return result || null;
    } catch (error) {
      this.logger.error('获取最新指标失败', { metricName, error });
      return null;
    }
  }

  /**
   * 获取多个指标的最新值
   * @param metricNames 指标名称数组
   * @returns 多个指标的最新值的记录
   */
  async getLatestByNames(
    metricNames: string[],
  ): Promise<Record<string, SystemMetrics | null>> {
    try {
      const result: Record<string, SystemMetrics | null> = {};

      for (const metricName of metricNames) {
        const metric = await this.getLatestByName(metricName);
        result[metricName] = metric;
      }

      return result;
    } catch (error) {
      this.logger.error('获取多个指标失败', {
        metricCount: metricNames.length,
        error,
      });
      return {};
    }
  }

  /**
   * 获取聚合指标数据
   * @param metricName 指标名称
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @returns 聚合指标数据
   */
  async getAggregatedMetrics(
    metricName: string,
    startTime: number,
    endTime: number,
  ): Promise<{
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
  }> {
    try {
      const results = await this.getByNameAndTimeRange(
        metricName,
        startTime,
        endTime,
        10000,
      );

      if (results.length === 0) {
        return { count: 0, sum: 0, avg: 0, min: 0, max: 0 };
      }

      const values = results.map((m) => m.metric_value || 0);
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);

      return {
        count: results.length,
        sum,
        avg,
        min,
        max,
      };
    } catch (error) {
      this.logger.error('获取聚合指标失败', { metricName, error });
      return { count: 0, sum: 0, avg: 0, min: 0, max: 0 };
    }
  }

  /**
   * 获取所有指标名称
   * @returns 指标名称数组
   */
  async getAllMetricNames(): Promise<string[]> {
    try {
      const results = await this.repository
        .createQueryBuilder('metric')
        .select('DISTINCT metric.metric_name', 'metric_name')
        .getRawMany();

      /**
       * 原始查询结果类型
       */
      interface RawMetricResult {
        metric_name: string;
      }

      return results
        .map((r: RawMetricResult) => r.metric_name)
        .filter((n: string) => n);
    } catch (error) {
      this.logger.error('获取所有指标名称失败', { error });
      return [];
    }
  }

  /**
   * 获取指标统计信息
   * @param metricName 指标名称
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @returns 指标统计信息
   */
  async getMetricStats(
    metricName: string,
    startTime: number,
    endTime: number,
  ): Promise<{
    metricName: string;
    startTime: number;
    endTime: number;
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
    stdDev: number;
  }> {
    try {
      const aggregated = await this.getAggregatedMetrics(
        metricName,
        startTime,
        endTime,
      );
      const results = await this.getByNameAndTimeRange(
        metricName,
        startTime,
        endTime,
        10000,
      );

      let stdDev = 0;
      if (results.length > 1 && aggregated.avg > 0) {
        const values = results.map((m) => m.metric_value || 0);
        const meanSquareDiff = values.reduce(
          (sum, val) => sum + Math.pow(val - aggregated.avg, 2),
          0,
        );
        stdDev = Math.sqrt(meanSquareDiff / values.length);
      }

      return {
        metricName,
        startTime,
        endTime,
        ...aggregated,
        stdDev,
      };
    } catch (error) {
      this.logger.error('获取指标统计信息失败', { metricName, error });
      return {
        metricName,
        startTime,
        endTime,
        count: 0,
        sum: 0,
        avg: 0,
        min: 0,
        max: 0,
        stdDev: 0,
      };
    }
  }

  /**
   * 清理旧的指标数据
   * @param olderThanDays 多少天之前的数据
   * @returns 删除的记录数
   */
  async cleanup(olderThanDays: number): Promise<number> {
    try {
      const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
      const result = await this.repository
        .createQueryBuilder('metric')
        .delete()
        .where('metric.created_at < :cutoffTime', { cutoffTime })
        .execute();

      return result.affected || 0;
    } catch (error) {
      this.logger.error('清理旧指标数据失败', { olderThanDays, error });
      return 0;
    }
  }
}
