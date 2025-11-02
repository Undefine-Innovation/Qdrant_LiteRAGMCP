import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { Logger } from '@logging/logger.js';
import { SystemMetric } from '@infrastructure/sqlite/dao/index.js';

/**
 * 指标服务
 * @description 负责收集和存储系统指标
 */
export class MetricsService {
  private readonly metricsBuffer: SystemMetric[] = [];
  private readonly metricsFlushInterval = 30000; // 30秒
  private metricsFlushTimer?: NodeJS.Timeout;

  /**
   * 创建MetricsService实例
   * @param {SQLiteRepo} sqliteRepo - SQLite仓库实例
   * @param {Logger} logger - 日志记录器实例
   */
  constructor(
    private readonly sqliteRepo: ISQLiteRepo,
    private readonly logger: Logger,
  ) {
    this.startMetricsFlush();
  }

  /**
   * 启动指标刷新定时器
   * @returns {void} 无返回值
   */
  private startMetricsFlush(): void {
    this.metricsFlushTimer = setInterval(() => {
      this.flushMetrics();
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
    this.flushMetrics(); // 最后一次刷新
  }

  /**
   * 记录系统指标
   * @param {string} metricName - 指标名称
   * @param {number} value - 指标值
   * @param {string} [unit] - 指标单位
   * @param {Record<string, string | number>} [tags] - 指标标签
   * @returns {void} 无返回值
   */
  public recordMetric(
    metricName: string,
    value: number,
    unit?: string,
    tags?: Record<string, string | number>,
  ): void {
    const metric: SystemMetric = {
      id: '', // 将在创建时生成
      metricName,
      metricValue: value,
      metricUnit: unit,
      tags,
      timestamp: Date.now(),
      createdAt: Date.now(),
    };

    this.metricsBuffer.push(metric);

    // 如果缓冲区太大，立即刷新
    if (this.metricsBuffer.length >= 100) {
      this.flushMetrics();
    }
  }

  /**
   * 刷新指标到数据库
   * @returns {void} 无返回值
   */
  private flushMetrics(): void {
    if (this.metricsBuffer.length === 0) return;

    try {
      this.sqliteRepo.systemMetrics.createBatch(this.metricsBuffer);
      this.logger.debug(`刷新了${this.metricsBuffer.length} 个指标到数据库`);
      this.metricsBuffer.length = 0; // 清空缓冲区
    } catch (error) {
      this.logger.error('刷新指标到数据库失败', {
        error: (error as Error).message,
        metricsCount: this.metricsBuffer.length,
      });
    }
  }
}