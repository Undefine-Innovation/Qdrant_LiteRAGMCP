import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { Logger } from '@logging/logger.js';
import { PersistentSyncStateMachine } from '../sync/index.js';
import { MonitoringServiceCore } from './MonitoringServiceCore.js';
import { HealthCheckService } from './HealthCheckService.js';
import { MetricsService } from './MetricsService.js';
import {
  IMonitoringService,
  AlertRule,
  AlertHistoryItem,
  AlertHistoryOptions,
  PerformanceStats,
  AnomalyDetectionOptions,
  PerformanceAnomaly,
  DashboardData,
  SystemOverview,
} from '@domain/repositories/IMonitoringService.js';
import { DataSource } from 'typeorm';
import { AlertRules } from '@infrastructure/database/entities/AlertRules.js';
import { AlertHistory } from '@infrastructure/database/entities/AlertHistory.js';
import { SystemHealth } from '@infrastructure/database/entities/SystemHealth.js';
import { SystemMetrics } from '@infrastructure/database/entities/SystemMetrics.js';

/**
 * 监控服务
 * 负责收集系统指标、健康检查和告警管理
 */
export class MonitoringService implements IMonitoringService {
  private readonly core: MonitoringServiceCore;
  private readonly healthCheck: HealthCheckService;
  private readonly metrics: MetricsService;

  /**
   * 创建监控服务实例
   * @param sqliteRepo SQLite 仓库实例
   * @param syncStateMachine 持久化同步状态机实例
   * @param logger 日志记录器
   */
  constructor(
    private readonly sqliteRepo: ISQLiteRepo,
    private readonly syncStateMachine: PersistentSyncStateMachine,
    private readonly logger: Logger,
  ) {
    this.core = new MonitoringServiceCore(sqliteRepo, syncStateMachine, logger);
    this.healthCheck = new HealthCheckService(
      sqliteRepo,
      syncStateMachine,
      logger,
    );
    // 注意：MetricsService 需要具体的 SQLiteRepo 实例，这里需要类型适配
    this.metrics = new MetricsService(sqliteRepo, logger);
  }

  /**
   * 创建 MonitoringService 实例（用于测试）
   * @param dataSource 数据源
   * @param syncStateMachine 同步状态机
   * @param logger 日志记录器
   */
  static createForTesting(
    dataSource: DataSource,
    syncStateMachine: PersistentSyncStateMachine,
    logger: Logger,
  ): MonitoringService {
    const service = new MonitoringService(
      {} as ISQLiteRepo,
      syncStateMachine,
      logger,
    );
    // 为测试环境添加直接数据库访问
    (service as unknown as { dataSource?: DataSource }).dataSource = dataSource;
    (service as unknown as { metrics?: MetricsService }).metrics = MetricsService.createForTesting(
      dataSource,
      logger,
    );
    (service as unknown as { healthCheck?: HealthCheckService }).healthCheck = new HealthCheckService(
      {} as ISQLiteRepo,
      syncStateMachine,
      logger,
    );
    ((service as unknown as { healthCheck?: HealthCheckService }).healthCheck as unknown as { dataSource?: DataSource }).dataSource = dataSource;
    return service;
  }

  /**
   * 停止监控服务
   */
  public stop(): void {
    this.healthCheck.stop();
    this.metrics.stop();
  }

  /**
   * 执行系统健康检查
   * @returns {Promise<void>} 返回健康检查结果
   */
  public async performHealthCheck(): Promise<void> {
    return this.healthCheck.performHealthCheck();
  }

  /**
   * 记录系统指标
   * @param metricName 指标名称
   * @param value 指标值
   * @param unit 指标单位
   * @param tags 指标标签
   * @returns {void} 返回记录结果
   */
  public recordMetric(
    metricName: string,
    value: number,
    unit?: string,
    tags?: Record<string, string | number>,
  ): void {
    const metricData = {
      name: metricName,
      value,
      unit,
      tags,
    };
    this.metrics.recordMetric(metricData);
  }

  /**
   * 获取系统整体健康状态
   * @returns {系统健康状态对象} 返回系统整体健康状态
   */
  public async getSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck: number;
    components: Record<
      string,
      {
        status: 'healthy' | 'degraded' | 'unhealthy';
        lastCheck: string;
        message?: string;
        responseTime?: number;
      }
    >;
  }> {
    return await this.core.getSystemHealth();
  }

  /**
   * 获取组件健康状态
   * @param component 组件名称
   * @returns {组件健康状态对象 | null} 返回组件健康状态
   */
  public async getComponentHealth(component: string): Promise<{
    component: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck: number;
    responseTimeMs?: number;
    errorMessage?: string;
    details?: Record<string, string | number | boolean>;
  } | null> {
    return await this.core.getComponentHealth(component);
  }

  /**
   * 获取所有组件健康状态
   * @returns {组件健康状态对象数组} 返回所有组件健康状态
   */
  public async getAllComponentHealth(): Promise<
    Array<{
      component: string;
      status: 'healthy' | 'degraded' | 'unhealthy';
      lastCheck: number;
      responseTimeMs?: number;
      errorMessage?: string;
      details?: Record<string, string | number | boolean>;
    }>
  > {
    return await this.core.getAllComponentHealth();
  }

  /**
   * 获取不健康的组件
   * @returns {组件健康状态对象数组} 返回不健康的组件列表
   */
  public async getUnhealthyComponents(): Promise<
    Array<{
      component: string;
      status: 'healthy' | 'degraded' | 'unhealthy';
      lastCheck: number;
      responseTimeMs?: number;
      errorMessage?: string;
      details?: Record<string, string | number | boolean>;
    }>
  > {
    return this.core.getUnhealthyComponents();
  }

  /**
   * 获取指标数据
   * @param metricName 指标名称
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @param limit 限制数量
   * @returns {指标数据数组} 返回指标数据
   */
  public async getMetrics(
    metricName: string,
    startTime?: number,
    endTime?: number,
    limit?: number,
  ): Promise<
    Array<{
      id: string;
      metricName: string;
      metricValue: number;
      metricUnit?: string;
      tags?: Record<string, string | number>;
      timestamp: number;
      createdAt: number;
    }>
  > {
    return this.core.getMetrics(metricName, startTime, endTime, limit);
  }

  /**
   * 获取最新指标值
   * @param metricName 指标名称
   * @returns {指标对象 | null} 返回最新指标值
   */
  public async getLatestMetric(metricName: string): Promise<{
    id: string;
    metricName: string;
    metricValue: number;
    metricUnit?: string;
    tags?: Record<string, string | number>;
    timestamp: number;
    createdAt: number;
  } | null> {
    return this.core.getLatestMetric(metricName);
  }

  /**
   * 获取多个指标的最新值
   * @param metricNames 指标名称数组
   * @returns {指标对象记录} 返回多个指标的最新值
   */
  public async getLatestMetrics(metricNames: string[]): Promise<
    Record<
      string,
      {
        id: string;
        metricName: string;
        metricValue: number;
        metricUnit?: string;
        tags?: Record<string, string | number>;
        timestamp: number;
        createdAt: number;
      } | null
    >
  > {
    return this.core.getLatestMetrics(metricNames);
  }

  /**
   * 获取指标聚合数据
   * @param metricName 指标名称
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @param aggregationType 聚合类型
   * @returns {聚合数据对象} 返回指标聚合数据
   */
  public async getAggregatedMetrics(
    metricName: string,
    startTime?: number,
    endTime?: number,
    aggregationType: 'avg' | 'min' | 'max' | 'sum' = 'avg',
  ): Promise<{
    min: number;
    max: number;
    avg: number;
    sum: number;
    count: number;
  }> {
    return this.core.getAggregatedMetrics(
      metricName,
      startTime,
      endTime,
      aggregationType,
    );
  }

  /**
   * 获取所有指标名称
   * @returns {string[]} 返回所有指标名称
   */
  public async getAllMetricNames(): Promise<string[]> {
    return this.core.getAllMetricNames();
  }

  /**
   * 获取指标统计信息
   * @param metricName 指标名称
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @returns {统计信息对象} 返回指标统计信息
   */
  public async getMetricStats(
    metricName: string,
    startTime?: number,
    endTime?: number,
  ): Promise<{
    min: number;
    max: number;
    avg: number;
    sum: number;
    count: number;
  }> {
    return this.core.getMetricStats(metricName, startTime, endTime);
  }

  /**
   * 清理过期的监控数据
   * @param olderThanDays 天数阈值
   * @returns {void} 返回清理结果
   */
  public async cleanup(olderThanDays: number = 30): Promise<void> {
    return this.core.cleanup(olderThanDays);
  }

  /**
   * 创建告警规则
   */
  public async createAlertRule(
    rule: Omit<AlertRule, 'id'>,
  ): Promise<AlertRule> {
    try {
      const dataSource = (this as { dataSource?: DataSource }).dataSource as DataSource;
      if (!dataSource) {
        throw new Error('数据源未初始化');
      }

      const alertRulesRepository = dataSource.getRepository(AlertRules);

      const alertRule = new AlertRules();
      alertRule.name = rule.name;
      alertRule.metric_name = rule.metricName;
      alertRule.condition_operator = rule.conditionOperator as
        | '>'
        | '<'
        | '>='
        | '<='
        | '=='
        | '!='
        | 'in'
        | 'not_in';
      alertRule.threshold_value = rule.thresholdValue;
      alertRule.severity = rule.severity;
      alertRule.is_active = rule.enabled;

      const savedRule = await alertRulesRepository.save(alertRule);

      return {
        id: savedRule.id,
        name: savedRule.name,
        condition: rule.condition || rule.conditionOperator,
        threshold: rule.thresholdValue || rule.threshold,
        enabled: savedRule.is_active,
        metricName: savedRule.metric_name,
        conditionOperator: savedRule.condition_operator,
        thresholdValue: savedRule.threshold_value,
        severity: savedRule.severity,
      };
    } catch (error) {
      this.logger.error('创建告警规则失败', { error, rule });
      throw error;
    }
  }

  /**
   * 更新告警规则
   */
  public async updateAlertRule(
    id: string,
    updates: Partial<AlertRule>,
  ): Promise<AlertRule> {
    try {
      const dataSource = (this as { dataSource?: DataSource }).dataSource as DataSource;
      if (!dataSource) {
        throw new Error('数据源未初始化');
      }

      const alertRulesRepository = dataSource.getRepository(AlertRules);

      const rule = await alertRulesRepository.findOne({ where: { id } });
      if (!rule) {
        throw new Error(`告警规则不存在: ${id}`);
      }

      if (updates.thresholdValue !== undefined) {
        rule.threshold_value = updates.thresholdValue;
      }
      if (updates.enabled !== undefined) {
        rule.is_active = updates.enabled;
      }
      if (updates.severity !== undefined) {
        rule.severity = updates.severity;
      }

      const savedRule = await alertRulesRepository.save(rule);

      return {
        id: savedRule.id,
        name: savedRule.name,
        condition: updates.condition || rule.condition_operator,
        threshold: updates.thresholdValue || rule.threshold_value,
        enabled: savedRule.is_active,
        metricName: savedRule.metric_name,
        conditionOperator: savedRule.condition_operator,
        thresholdValue: savedRule.threshold_value,
        severity: savedRule.severity,
      };
    } catch (error) {
      this.logger.error('更新告警规则失败', { error, id, updates });
      throw error;
    }
  }

  /**
   * 删除告警规则
   */
  public async deleteAlertRule(id: string): Promise<void> {
    try {
      const dataSource = (this as { dataSource?: DataSource }).dataSource as DataSource;
      if (!dataSource) {
        throw new Error('数据源未初始化');
      }

      const alertRulesRepository = dataSource.getRepository(AlertRules);
      await alertRulesRepository.delete(id);
    } catch (error) {
      this.logger.error('删除告警规则失败', { error, id });
      throw error;
    }
  }

  /**
   * 获取所有告警规则
   */
  public async getAllAlertRules(): Promise<AlertRule[]> {
    try {
      const dataSource = (this as { dataSource?: DataSource }).dataSource as DataSource;
      if (!dataSource) {
        throw new Error('数据源未初始化');
      }

      const alertRulesRepository = dataSource.getRepository(AlertRules);
      const rules = await alertRulesRepository.find();

      return rules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        condition: rule.condition_operator,
        threshold: rule.threshold_value,
        enabled: rule.is_active,
        metricName: rule.metric_name,
        conditionOperator: rule.condition_operator,
        thresholdValue: rule.threshold_value,
        severity: rule.severity,
      }));
    } catch (error) {
      this.logger.error('获取告警规则失败', { error });
      return [];
    }
  }

  /**
   * 处理告警
   */
  public async processAlerts(): Promise<AlertHistoryItem[]> {
    try {
      const dataSource = (this as { dataSource?: DataSource }).dataSource as DataSource;
      if (!dataSource) {
        throw new Error('数据源未初始化');
      }

      const alertRulesRepository = dataSource.getRepository(AlertRules);
      const alertHistoryRepository = dataSource.getRepository(AlertHistory);
      const systemMetricsRepository = dataSource.getRepository(SystemMetrics);

      const activeRules = await alertRulesRepository
        .createQueryBuilder('rule')
        .where('rule.is_active = :isActive', { isActive: true })
        .getMany();

      const triggeredAlerts: AlertHistoryItem[] = [];

      for (const rule of activeRules) {
        // 获取最新的指标值
        const latestMetric = await systemMetricsRepository
          .createQueryBuilder('metric')
          .where('metric.metric_name = :metricName', {
            metricName: rule.metric_name,
          })
          .orderBy('metric.timestamp', 'DESC')
          .getOne();

        if (latestMetric) {
          const shouldTrigger = this.evaluateCondition(
            latestMetric.metric_value,
            rule.condition_operator,
            rule.threshold_value,
          );

          if (shouldTrigger) {
            const alertHistory = new AlertHistory();
            alertHistory.rule_id = rule.id;
            alertHistory.metric_value = latestMetric.metric_value;
            alertHistory.threshold_value = rule.threshold_value;
            alertHistory.severity = rule.severity;
            alertHistory.status = 'triggered';
            alertHistory.message = `${rule.name}: ${rule.metric_name} is ${latestMetric.metric_value} (threshold: ${rule.threshold_value})`;
            alertHistory.triggered_at = Date.now();

            const savedAlert = await alertHistoryRepository.save(alertHistory);

            triggeredAlerts.push({
              id: savedAlert.id,
              ruleId: rule.id,
              ruleName: rule.name,
              status: 'triggered',
              severity: rule.severity,
              metricValue: latestMetric.metric_value,
              message: alertHistory.message,
              triggeredAt: new Date(savedAlert.triggered_at),
            });
          }
        }
      }

      return triggeredAlerts;
    } catch (error) {
      this.logger.error('处理告警失败', { error });
      return [];
    }
  }

  /**
   * 解决告警
   */
  public async resolveAlert(
    id: string,
    options?: { message?: string },
  ): Promise<AlertHistoryItem> {
    try {
      const dataSource = (this as { dataSource?: DataSource }).dataSource as DataSource;
      if (!dataSource) {
        throw new Error('数据源未初始化');
      }

      const alertHistoryRepository = dataSource.getRepository(AlertHistory);

      const alert = await alertHistoryRepository.findOne({ where: { id } });
      if (!alert) {
        throw new Error(`告警不存在: ${id}`);
      }

      alert.status = 'resolved';
      alert.resolved_at = Date.now();
      if (options?.message) {
        alert.message = options.message;
      }

      const savedAlert = await alertHistoryRepository.save(alert);

      return {
        id: savedAlert.id,
        ruleId: savedAlert.rule_id,
        ruleName: '', // 需要关联查询
        status: 'resolved',
        severity: savedAlert.severity,
        metricValue: savedAlert.metric_value,
        message: savedAlert.message,
        triggeredAt: new Date(savedAlert.triggered_at),
        resolvedAt: savedAlert.resolved_at
          ? new Date(savedAlert.resolved_at)
          : undefined,
      };
    } catch (error) {
      this.logger.error('解决告警失败', { error, id });
      throw error;
    }
  }

  /**
   * 获取告警历史
   */
  public async getAlertHistory(
    options: AlertHistoryOptions,
  ): Promise<AlertHistoryItem[]> {
    try {
      const dataSource = (this as { dataSource?: DataSource }).dataSource as DataSource;
      if (!dataSource) {
        throw new Error('数据源未初始化');
      }

      const alertHistoryRepository = dataSource.getRepository(AlertHistory);

      const alerts = await alertHistoryRepository
        .createQueryBuilder('alert')
        .where('alert.triggered_at >= :startTime', {
          startTime: options.startTime.getTime(),
        })
        .andWhere('alert.triggered_at <= :endTime', {
          endTime: options.endTime.getTime(),
        })
        .orderBy('alert.triggered_at', 'DESC')
        .getMany();

      return alerts.map((alert) => ({
        id: alert.id,
        ruleId: alert.rule_id,
        ruleName: '', // 需要关联查询
        status: alert.status,
        severity: alert.severity,
        metricValue: alert.metric_value,
        message: alert.message,
        triggeredAt: new Date(alert.triggered_at),
        resolvedAt: alert.resolved_at ? new Date(alert.resolved_at) : undefined,
      }));
    } catch (error) {
      this.logger.error('获取告警历史失败', { error });
      return [];
    }
  }

  /**
   * 获取仪表板数据
   */
  public async getDashboardData(): Promise<DashboardData> {
    try {
      const dataSource = (this as { dataSource?: DataSource }).dataSource as DataSource;
      if (!dataSource) {
        throw new Error('数据源未初始化');
      }

      const systemHealthRepository = dataSource.getRepository(SystemHealth);
      const systemMetricsRepository = dataSource.getRepository(SystemMetrics);
      const alertHistoryRepository = dataSource.getRepository(AlertHistory);

      // 获取健康状态
      const healthRecords = await systemHealthRepository
        .createQueryBuilder('health')
        .getMany();
      const overallHealth = this.calculateOverallHealth(healthRecords);

      // 获取最新指标
      const latestMetrics = await this.getLatestMetricsData(
        systemMetricsRepository,
      );

      // 获取活跃告警
      const activeAlerts = await alertHistoryRepository.find({
        where: { status: 'triggered' },
        order: { triggered_at: 'DESC' },
        take: 10,
      });

      return {
        overallHealth,
        components: healthRecords.map((record) => ({
          component: record.component,
          status: record.status,
          message: record.errorMessage,
          lastCheck: new Date(record.lastCheck),
          responseTimeMs: record.responseTimeMs,
        })),
        metrics: latestMetrics,
        activeAlerts: activeAlerts.map((alert) => ({
          id: alert.id,
          ruleId: alert.rule_id,
          ruleName: '', // 需要关联查询
          status: alert.status,
          severity: alert.severity,
          metricValue: alert.metric_value,
          message: alert.message,
          triggeredAt: new Date(alert.triggered_at),
        })),
      };
    } catch (error) {
      this.logger.error('获取仪表板数据失败', { error });
      return {
        overallHealth: 'unhealthy',
        components: [],
        metrics: {},
        activeAlerts: [],
      };
    }
  }

  /**
   * 获取系统概览
   */
  public async getSystemOverview(): Promise<SystemOverview> {
    try {
      const dataSource = (this as { dataSource?: DataSource }).dataSource as DataSource;
      if (!dataSource) {
        throw new Error('数据源未初始化');
      }

      const systemHealthRepository = dataSource.getRepository(SystemHealth);
      const systemMetricsRepository = dataSource.getRepository(SystemMetrics);

      // 获取健康状态
      const healthRecords = await systemHealthRepository.find();
      const healthStatus = this.calculateOverallHealth(healthRecords);

      // 获取系统指标
      const uptimeMetric = await systemMetricsRepository.findOne({
        where: { metric_name: 'uptime' },
        order: { timestamp: 'DESC' },
      });

      const requestRateMetric = await systemMetricsRepository.findOne({
        where: { metric_name: 'request_rate' },
        order: { timestamp: 'DESC' },
      });

      const errorRateMetric = await systemMetricsRepository.findOne({
        where: { metric_name: 'error_rate' },
        order: { timestamp: 'DESC' },
      });

      return {
        healthStatus,
        uptime: uptimeMetric?.metric_value || 0,
        requestRate: requestRateMetric?.metric_value || 0,
        errorRate: errorRateMetric?.metric_value || 0,
        componentCount: healthRecords.length,
        healthyComponents: healthRecords.filter((r) => r.status === 'healthy')
          .length,
        unhealthyComponents: healthRecords.filter(
          (r) => r.status === 'unhealthy',
        ).length,
      };
    } catch (error) {
      this.logger.error('获取系统概览失败', { error });
      return {
        healthStatus: 'unhealthy',
        uptime: 0,
        requestRate: 0,
        errorRate: 0,
        componentCount: 0,
        healthyComponents: 0,
        unhealthyComponents: 0,
      };
    }
  }

  /**
   * 获取性能统计
   */
  public async getPerformanceStats(
    metricName: string,
    tags?: Record<string, string | number>,
  ): Promise<PerformanceStats> {
    try {
      const dataSource = (this as { dataSource?: DataSource }).dataSource as DataSource;
      if (!dataSource) {
        throw new Error('数据源未初始化');
      }

      const systemMetricsRepository = dataSource.getRepository(SystemMetrics);

      const metrics = await systemMetricsRepository.find({
        where: { metric_name: metricName },
        order: { timestamp: 'DESC' },
        take: 1000,
      });

      if (metrics.length === 0) {
        return { average: 0, min: 0, max: 0, p95: 0, p99: 0 };
      }

      const values = metrics.map((m) => m.metric_value);
      values.sort((a, b) => a - b);

      const average = values.reduce((sum, val) => sum + val, 0) / values.length;
      const min = values[0];
      const max = values[values.length - 1];

      // 计算百分位数的辅助函数
      const getPercentile = (percentile: number): number => {
        if (values.length === 0) return 0;
        if (values.length === 1) return values[0];

        const index = (percentile / 100) * (values.length - 1);
        const lowerIndex = Math.floor(index);
        const upperIndex = Math.ceil(index);
        const weight = index - lowerIndex;

        if (lowerIndex === upperIndex) {
          return values[lowerIndex];
        }

        // 线性插值
        const lowerValue = values[lowerIndex];
        const upperValue = values[upperIndex];
        return lowerValue + (upperValue - lowerValue) * weight;
      };

      const p95 = getPercentile(95);
      const p99 = getPercentile(99);

      return { average, min, max, p95, p99 };
    } catch (error) {
      this.logger.error('获取性能统计失败', { error, metricName });
      return { average: 0, min: 0, max: 0, p95: 0, p99: 0 };
    }
  }

  /**
   * 检测性能异常
   */
  public async detectPerformanceAnomalies(
    metricName: string,
    options: AnomalyDetectionOptions,
  ): Promise<PerformanceAnomaly[]> {
    try {
      const dataSource = (this as { dataSource?: DataSource }).dataSource as DataSource;
      if (!dataSource) {
        throw new Error('数据源未初始化');
      }

      const systemMetricsRepository = dataSource.getRepository(SystemMetrics);

      const timeWindowStart = Date.now() - options.timeWindow;

      const metrics = await systemMetricsRepository
        .createQueryBuilder('metric')
        .where('metric.metric_name = :metricName', { metricName })
        .andWhere('metric.timestamp >= :timeWindowStart', { timeWindowStart })
        .orderBy('metric.timestamp', 'ASC')
        .getMany();

      if (metrics.length < 10) {
        return [];
      }

      const anomalies: PerformanceAnomaly[] = [];

      // 使用更智能的方法来检测异常
      // 尝试使用时间分段方法：使用早期数据作为基准，检测后期数据是否异常
      if (metrics.length >= 10) {
        // 将数据分为前后两部分，用前一部分作为基准
        const splitIndex = Math.floor(metrics.length / 2);
        const baselineMetrics = metrics.slice(0, splitIndex);
        const checkMetrics = metrics.slice(splitIndex);

        if (baselineMetrics.length > 0) {
          const baselineValues = baselineMetrics.map((m) => m.metric_value);
          const baselineMean =
            baselineValues.reduce((sum, val) => sum + val, 0) /
            baselineValues.length;
          const baselineStdDev = Math.sqrt(
            baselineValues.reduce(
              (sum, val) => sum + Math.pow(val - baselineMean, 2),
              0,
            ) / baselineValues.length,
          );

          // 使用基准数据的统计量来检测所有数据中的异常
          const baselineThreshold =
            baselineMean + options.threshold * baselineStdDev;

          for (const metric of metrics) {
            // 检测是否显著偏离基准
            if (metric.metric_value > baselineThreshold) {
              const severity =
                metric.metric_value > baselineThreshold * 1.5
                  ? 'high'
                  : metric.metric_value > baselineThreshold * 1.2
                    ? 'medium'
                    : 'low';

              anomalies.push({
                value: metric.metric_value,
                timestamp: new Date(metric.timestamp),
                severity,
              });
            }
          }
        }
      } else {
        // 如果数据点不足，使用原始方法
        const values = metrics.map((m) => m.metric_value);
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance =
          values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
          values.length;
        const stdDev = Math.sqrt(variance);
        const threshold = mean + options.threshold * stdDev;

        for (const metric of metrics) {
          if (metric.metric_value > threshold) {
            const severity =
              metric.metric_value > threshold * 1.5
                ? 'high'
                : metric.metric_value > threshold * 1.2
                  ? 'medium'
                  : 'low';

            anomalies.push({
              value: metric.metric_value,
              timestamp: new Date(metric.timestamp),
              severity,
            });
          }
        }
      }

      return anomalies;
    } catch (error) {
      this.logger.error('检测性能异常失败', { error, metricName });
      return [];
    }
  }

  /**
   * 评估条件
   */
  private evaluateCondition(
    value: number,
    operator: string,
    threshold: number,
  ): boolean {
    switch (operator) {
      case '>':
        return value > threshold;
      case '<':
        return value < threshold;
      case '>=':
        return value >= threshold;
      case '<=':
        return value <= threshold;
      case '==':
        return value === threshold;
      case '!=':
        return value !== threshold;
      default:
        return false;
    }
  }

  /**
   * 计算整体健康状态
   */
  private calculateOverallHealth(
    healthRecords: SystemHealth[],
  ): 'healthy' | 'degraded' | 'unhealthy' {
    if (healthRecords.length === 0) {
      return 'unhealthy';
    }

    const statuses = healthRecords.map((r) => r.status);

    if (statuses.includes('unhealthy')) {
      return 'unhealthy';
    }

    if (statuses.includes('degraded')) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * 获取最新指标数据
   */
  private async getLatestMetricsData(
    systemMetricsRepository: { findOne: (options: { where: { metric_name: string }; order: { timestamp: 'DESC' } }) => Promise<{ metric_value: number } | null> },
  ): Promise<Record<string, number>> {
    const metrics: Record<string, number> = {};

    const metricNames = ['cpu_usage', 'memory_usage', 'request_count'];

    for (const name of metricNames) {
      const metric = await systemMetricsRepository.findOne({
        where: { metric_name: name },
        order: { timestamp: 'DESC' },
      });

      if (metric) {
        metrics[name] = metric.metric_value;
      }
    }

    return metrics;
  }
}
