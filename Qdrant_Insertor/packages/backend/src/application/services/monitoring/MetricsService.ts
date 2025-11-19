import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { Logger } from '@logging/logger.js';
import { SystemMetric } from '@infrastructure/sqlite/dao/index.js';
import {
  IMetricsService,
  MetricData,
  MetricsHistoryOptions,
  MetricsAggregationOptions,
  MetricsAggregations,
} from '@domain/repositories/IMetricsService.js';
import { DataSource } from 'typeorm';
import { SystemMetrics } from '@infrastructure/database/entities/SystemMetrics.js';

/**
 * 指标服务
 * @description 负责收集和存储系统指标
 */
export class MetricsService implements IMetricsService {
  private readonly metricsBuffer: SystemMetric[] = [];
  private readonly metricsFlushInterval = 30000; // 30秒
  private metricsFlushTimer?: NodeJS.Timeout;

  /**
   * 创建MetricsService实例
   * @param {SQLiteRepo} sqliteRepo - SQLite仓库实例
   * @param {Logger} logger - 日志记录器实例
   * @param dataSource 可选的数据源实例（用于测试环境）
   */
  constructor(
    private readonly sqliteRepo: ISQLiteRepo,
    private readonly logger: Logger,
    private readonly dataSource?: DataSource,
  ) {
    this.startMetricsFlush();
  }

  /**
   * 创建 MetricsService 实例（用于测试）
   * @param dataSource 数据源
   * @param logger 日志记录器
   * @returns MetricsService实例
   */
  static createForTesting(
    dataSource: DataSource,
    logger: Logger,
  ): MetricsService {
    const service = new MetricsService({} as ISQLiteRepo, logger, dataSource);
    return service;
  }

  /**
   * 启动指标刷新定时器
   * @returns {void} 无返回值
   */
  private startMetricsFlush(): void {
    this.metricsFlushTimer = setInterval(() => {
      this.flushMetrics().catch((err) => {
        this.logger.error('定时刷新指标失败', { error: err });
      });
    }, this.metricsFlushInterval);
  }

  /**
   * 停止指标服务
   * @returns {void} 无返回值
   */
  public stop(): void {
    if (this.metricsFlushTimer) {
      clearInterval(this.metricsFlushTimer);
    }
    // 同步刷新（在程序关闭时）
    this.flushMetrics().catch((err) => {
      this.logger.error('停止服务时刷新指标失败', { error: err });
    });
  }

  /**
   * 记录系统指标（实现接口方法）
   * @param metric 指标数据
   * @returns {Promise<void>} 无返回值
   */
  public async recordMetric(metric: MetricData): Promise<void> {
    return await this.recordMetricData(metric);
  }

  /**
   * 记录指标数据（内部方法）
   * @param metric 要记录的指标数据
   */
  private async recordMetricData(metric: MetricData): Promise<void> {
    // Build a proper SystemMetric object to satisfy typing and DB DAO contract
    const metricId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const metricRecord = {
      id: metricId,
      metricName: metric.name,
      metricValue: metric.value,
      metricUnit: metric.unit,
      tags: metric.tags,
      timestamp: Date.now(),
    } as unknown as import('@infrastructure/sqlite/dao/index.js').SystemMetric;

    this.metricsBuffer.push(metricRecord);

    // 如果缓冲区太大，立即刷新
    if (this.metricsBuffer.length >= 100) {
      await this.flushMetrics();
    }
  }

  /**
   * 刷新指标到数据库
   * @returns {Promise<void>} 无返回值
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    try {
      // 检查是否有直接数据源访问（测试环境）
      if (this.dataSource) {
        const systemMetricsRepository =
          this.dataSource.getRepository(SystemMetrics);

        // 转换缓冲区中的指标为实体对象
        const entities = this.metricsBuffer.map((metric) => {
          const entity = new SystemMetrics();
          entity.id = metric.id;
          entity.metric_name = metric.metricName || '';
          entity.metric_value = metric.metricValue || 0;
          entity.metric_unit = metric.metricUnit;
          entity.tags = metric.tags ? JSON.stringify(metric.tags) : undefined;
          entity.timestamp = metric.timestamp;
          return entity;
        });

        await systemMetricsRepository.save(entities);
      } else {
        this.sqliteRepo.systemMetrics.createBatch(this.metricsBuffer);
      }

      this.logger.debug(`刷新了${this.metricsBuffer.length} 个指标到数据库`);
      this.metricsBuffer.length = 0; // 清空缓冲区
    } catch (error) {
      this.logger.error('刷新指标到数据库失败', {
        error: (error as Error).message,
        metricsCount: this.metricsBuffer.length,
      });
    }
  }

  /**
   * 获取指标历史
   * @param metricName 指标名称
   * @param options 查询选项
   * @returns 指标历史数据数组
   */
  public async getMetricsHistory(
    metricName: string,
    options: MetricsHistoryOptions,
  ): Promise<
    Array<{
      name: string;
      value: number;
      unit?: string;
      tags?: Record<string, string | number>;
      timestamp: Date;
    }>
  > {
    try {
      if (!this.dataSource) {
        throw new Error('数据源未初始化');
      }

      const metricsRepository = this.dataSource.getRepository(SystemMetrics);

      const metrics = await metricsRepository
        .createQueryBuilder('metric')
        .where('metric.metric_name = :metricName', { metricName })
        .andWhere('metric.timestamp >= :startTime', {
          startTime: options.startTime.getTime(),
        })
        .andWhere('metric.timestamp <= :endTime', {
          endTime: options.endTime.getTime(),
        })
        .orderBy('metric.timestamp', 'ASC')
        .getMany();

      return metrics.map((metric) => ({
        name: metric.metric_name,
        value: metric.metric_value,
        unit: metric.metric_unit,
        tags: metric.tags ? JSON.parse(metric.tags) : undefined,
        timestamp: new Date(metric.timestamp),
      }));
    } catch (error) {
      this.logger.error('获取指标历史失败', { error, metricName });
      return [];
    }
  }

  /**
   * 获取指标聚合
   * @param metricName 指标名称
   * @param options 聚合选项
   * @returns 指标聚合结果
   */
  public async getMetricsAggregations(
    metricName: string,
    options: MetricsAggregationOptions,
  ): Promise<MetricsAggregations> {
    try {
      if (!this.dataSource) {
        throw new Error('数据源未初始化');
      }

      const metricsRepository = this.dataSource.getRepository(SystemMetrics);

      const metrics = await metricsRepository
        .createQueryBuilder('metric')
        .where('metric.metric_name = :metricName', { metricName })
        .andWhere('metric.timestamp >= :startTime', {
          startTime: options.startTime.getTime(),
        })
        .andWhere('metric.timestamp <= :endTime', {
          endTime: options.endTime.getTime(),
        })
        .getMany();

      if (metrics.length === 0) {
        return { avg: 0, min: 0, max: 0, sum: 0, count: 0 };
      }

      const values = metrics.map((m: SystemMetrics) => m.metric_value);
      const aggregations: MetricsAggregations = {};

      if (options.aggregations.includes('avg')) {
        aggregations.avg =
          values.reduce((sum: number, val: number) => sum + val, 0) /
          values.length;
      }
      if (options.aggregations.includes('min')) {
        aggregations.min = Math.min(...values);
      }
      if (options.aggregations.includes('max')) {
        aggregations.max = Math.max(...values);
      }
      if (options.aggregations.includes('sum')) {
        aggregations.sum = values.reduce(
          (sum: number, val: number) => sum + val,
          0,
        );
      }
      if (options.aggregations.includes('count')) {
        aggregations.count = values.length;
      }

      return aggregations;
    } catch (error) {
      this.logger.error('获取指标聚合失败', { error, metricName });
      return { avg: 0, min: 0, max: 0, sum: 0, count: 0 };
    }
  }

  /**
   * 按标签过滤指标
   * @param tags 标签过滤条件
   * @returns 过滤后的指标数据数组
   */
  public async getMetricsByTags(tags: Record<string, string | number>): Promise<
    Array<{
      name: string;
      value: number;
      unit?: string;
      tags?: Record<string, string | number>;
      timestamp: Date;
    }>
  > {
    try {
      if (!this.dataSource) {
        throw new Error('数据源未初始化');
      }

      const metricsRepository = this.dataSource.getRepository(SystemMetrics);

      // 构建标签查询条件
      const tagConditions = Object.entries(tags)
        .map(([key, value]) => {
          return `JSON_EXTRACT(tags, '$.${key}') = '${value}'`;
        })
        .join(' AND ');

      // 使用TypeORM查询构建器，避免直接使用SQL
      let queryBuilder = metricsRepository.createQueryBuilder('metric');

      // 对每个标签进行查询
      Object.entries(tags).forEach(([key, value], index) => {
        // 在SQLite中使用LIKE进行JSON匹配，更兼容
        queryBuilder = queryBuilder.andWhere(`metric.tags LIKE :tag${index}`, {
          [`tag${index}`]: `%${key}%${value}%`,
        });
      });

      queryBuilder = queryBuilder
        .orderBy('metric.timestamp', 'DESC')
        .limit(1000);

      const metrics = await queryBuilder.getMany();

      return metrics.map((metric) => ({
        name: metric.metric_name,
        value: metric.metric_value,
        unit: metric.metric_unit,
        tags: metric.tags ? JSON.parse(metric.tags) : undefined,
        timestamp: new Date(metric.timestamp),
      }));
    } catch (error) {
      this.logger.error('按标签过滤指标失败', { error, tags });
      return [];
    }
  }
}
