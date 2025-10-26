import { SQLiteRepo } from '../infrastructure/SQLiteRepo.js';
import { Logger } from '../logger.js';
import { PersistentSyncStateMachine } from './PersistentSyncStateMachine.js';

/**
 * 监控服务核心
 * 负责监控系统的核心功能
 */
export class MonitoringServiceCore {
  constructor(
    private readonly sqliteRepo: SQLiteRepo,
    private readonly syncStateMachine: PersistentSyncStateMachine,
    private readonly logger: Logger,
  ) {}

  /**
   * 获取系统整体健康状态
   */
  public getSystemHealth() {
    return this.sqliteRepo.systemHealth.getOverallHealth();
  }

  /**
   * 获取组件健康状态
   */
  public getComponentHealth(component: string) {
    return this.sqliteRepo.systemHealth.getByComponent(component);
  }

  /**
   * 获取所有组件健康状态
   */
  public getAllComponentHealth() {
    return this.sqliteRepo.systemHealth.getAll();
  }

  /**
   * 获取不健康的组件
   */
  public getUnhealthyComponents() {
    return this.sqliteRepo.systemHealth.getUnhealthyComponents();
  }

  /**
   * 获取指标数据
   */
  public getMetrics(
    metricName: string,
    startTime?: number,
    endTime?: number,
    limit?: number,
  ) {
    const now = Date.now();
    const defaultStartTime = startTime || now - 24 * 60 * 60 * 1000; // 默认24小时
    const defaultEndTime = endTime || now;

    return this.sqliteRepo.systemMetrics.getByNameAndTimeRange(
      metricName,
      defaultStartTime,
      defaultEndTime,
      limit,
    );
  }

  /**
   * 获取最新指标值
   */
  public getLatestMetric(metricName: string) {
    return this.sqliteRepo.systemMetrics.getLatestByName(metricName);
  }

  /**
   * 获取多个指标的最新值
   */
  public getLatestMetrics(metricNames: string[]) {
    return this.sqliteRepo.systemMetrics.getLatestByNames(metricNames);
  }

  /**
   * 获取指标聚合数据
   */
  public getAggregatedMetrics(
    metricName: string,
    startTime?: number,
    endTime?: number,
    aggregationType: 'avg' | 'min' | 'max' | 'sum' = 'avg',
  ) {
    const now = Date.now();
    const defaultStartTime = startTime || now - 24 * 60 * 60 * 1000; // 默认24小时
    const defaultEndTime = endTime || now;

    return this.sqliteRepo.systemMetrics.getAggregatedMetrics(
      metricName,
      defaultStartTime,
      defaultEndTime,
      aggregationType,
    );
  }

  /**
   * 获取所有指标名称
   */
  public getAllMetricNames() {
    return this.sqliteRepo.systemMetrics.getAllMetricNames();
  }

  /**
   * 获取指标统计信息
   */
  public getMetricStats(
    metricName: string,
    startTime?: number,
    endTime?: number,
  ) {
    return this.sqliteRepo.systemMetrics.getMetricStats(
      metricName,
      startTime,
      endTime,
    );
  }

  /**
   * 清理过期的监控数据
   */
  public cleanup(olderThanDays: number = 30): void {
    const metricsCleaned = this.sqliteRepo.systemMetrics.cleanup(olderThanDays);
    const healthCleaned = this.sqliteRepo.systemHealth.cleanup(olderThanDays);

    this.logger.info(
      `清理监控数据完成: 指标 ${metricsCleaned} 条, 健康状态 ${healthCleaned} 条`,
    );
  }
}
