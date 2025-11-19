import { DataSource } from 'typeorm';
import { Logger } from '@logging/logger.js';
import { AlertRules } from '@infrastructure/database/entities/AlertRules.js';
import { AlertHistory } from '@infrastructure/database/entities/AlertHistory.js';
import { SystemMetrics } from '@infrastructure/database/entities/SystemMetrics.js';

import type {
  AlertRule,
  AlertHistoryItem,
  AlertHistoryOptions,
} from '@domain/repositories/IMonitoringService.js';

export class MonitoringAlerts {
  constructor(
    private readonly getDataSource: () => DataSource | undefined,
    private readonly logger: Logger,
  ) {}

  private normalizeOperator(
    operator: string,
  ): AlertRules['condition_operator'] {
    const allowed: AlertRules['condition_operator'][] = [
      '>',
      '<',
      '>=',
      '<=',
      '==',
      '!=',
      'in',
      'not_in',
    ];
    const candidate = operator.trim();
    return allowed.includes(candidate as AlertRules['condition_operator'])
      ? (candidate as AlertRules['condition_operator'])
      : '>';
  }

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

  public async createAlertRule(
    rule: Omit<AlertRule, 'id'>,
  ): Promise<AlertRule> {
    try {
      const dataSource = this.getDataSource();
      if (!dataSource) throw new Error('数据源未初始化');

      const alertRulesRepository = dataSource.getRepository(AlertRules);

      const alertRule = new AlertRules();
      alertRule.name = rule.name;
      alertRule.metric_name = rule.metricName;
      alertRule.condition_operator = this.normalizeOperator(
        rule.conditionOperator || rule.condition,
      );
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

  public async updateAlertRule(
    id: string,
    updates: Partial<AlertRule>,
  ): Promise<AlertRule> {
    try {
      const dataSource = this.getDataSource();
      if (!dataSource) throw new Error('数据源未初始化');

      const alertRulesRepository = dataSource.getRepository(AlertRules);

      const rule = await alertRulesRepository.findOne({ where: { id } });
      if (!rule) throw new Error(`告警规则不存在: ${id}`);

      if (updates.thresholdValue !== undefined)
        rule.threshold_value = updates.thresholdValue;
      if (updates.enabled !== undefined) rule.is_active = updates.enabled;
      if (updates.severity !== undefined) rule.severity = updates.severity;

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

  public async deleteAlertRule(id: string): Promise<void> {
    try {
      const dataSource = this.getDataSource();
      if (!dataSource) throw new Error('数据源未初始化');

      const alertRulesRepository = dataSource.getRepository(AlertRules);
      await alertRulesRepository.delete(id);
    } catch (error) {
      this.logger.error('删除告警规则失败', { error, id });
      throw error;
    }
  }

  public async getAllAlertRules(): Promise<AlertRule[]> {
    try {
      const dataSource = this.getDataSource();
      if (!dataSource) throw new Error('数据源未初始化');

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

  public async processAlerts(): Promise<AlertHistoryItem[]> {
    try {
      const dataSource = this.getDataSource();
      if (!dataSource) throw new Error('数据源未初始化');

      const alertRulesRepository = dataSource.getRepository(AlertRules);
      const alertHistoryRepository = dataSource.getRepository(AlertHistory);
      const systemMetricsRepository = dataSource.getRepository(SystemMetrics);

      const activeRules = await alertRulesRepository
        .createQueryBuilder('rule')
        .where('rule.is_active = :isActive', { isActive: true })
        .getMany();

      const triggeredAlerts: AlertHistoryItem[] = [];

      for (const rule of activeRules) {
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

  public async resolveAlert(
    id: string,
    options?: { message?: string },
  ): Promise<AlertHistoryItem> {
    try {
      const dataSource = this.getDataSource();
      if (!dataSource) throw new Error('数据源未初始化');

      const alertHistoryRepository = dataSource.getRepository(AlertHistory);

      const alert = await alertHistoryRepository.findOne({ where: { id } });
      if (!alert) throw new Error(`告警不存在: ${id}`);

      alert.status = 'resolved';
      alert.resolved_at = Date.now();
      if (options?.message) alert.message = options.message;

      const savedAlert = await alertHistoryRepository.save(alert);

      return {
        id: savedAlert.id,
        ruleId: savedAlert.rule_id,
        ruleName: '',
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

  public async getAlertHistory(
    options: AlertHistoryOptions,
  ): Promise<AlertHistoryItem[]> {
    try {
      const dataSource = this.getDataSource();
      if (!dataSource) throw new Error('数据源未初始化');

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
        ruleName: '',
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
}
