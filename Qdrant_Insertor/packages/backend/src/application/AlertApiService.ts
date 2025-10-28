import { AlertService } from './AlertService.js';
import {
  CreateAlertRuleRequest,
  AlertRuleResponse,
  UpdateAlertRuleRequest,
  AlertHistoryRequest,
  AlertHistoryResponse,
} from '../api/contracts/monitoring.js';
import { logger } from '../logger.js';
import {
  AlertRule,
  AlertSeverity,
} from '../infrastructure/sqlite/dao/index.js';

/**
 * 告警API服务
 * 负责处理告警规则和告警历史的API请求
 */
export class AlertApiService {
  constructor(private alertService: AlertService) {}

  /**
   * 创建告警规则API
   */
  async createAlertRule(
    request: CreateAlertRuleRequest,
  ): Promise<AlertRuleResponse> {
    try {
      logger.info('Creating alert rule', { name: request.name });

      const ruleId = this.alertService.createAlertRule({
        name: request.name,
        description: request.description,
        metricName: request.metricName,
        conditionOperator: request.condition as
          | '>'
          | '<'
          | '>='
          | '<='
          | '=='
          | '!=',
        thresholdValue: request.threshold,
        severity: request.severity as AlertSeverity,
        isActive: request.enabled,
        cooldownMinutes: request.cooldownMinutes,
        notificationChannels: request.notificationChannels || [],
      });

      const rule = this.alertService.getAlertRule(ruleId);
      if (!rule) {
        throw new Error('Failed to retrieve created alert rule');
      }

      return {
        id: rule.id,
        name: rule.name,
        description: rule.description,
        metricName: rule.metricName,
        condition: rule.conditionOperator,
        threshold: rule.thresholdValue,
        severity: rule.severity,
        enabled: rule.isActive,
        cooldownMinutes: rule.cooldownMinutes,
        notificationChannels: rule.notificationChannels,
        createdAt: new Date(rule.createdAt).toISOString(),
        updatedAt: new Date(rule.updatedAt).toISOString(),
        lastTriggered: undefined, // AlertRule中没有这个字段
      };
    } catch (error) {
      logger.error('Failed to create alert rule', { error, request });
      throw error;
    }
  }

  /**
   * 获取告警规则列表API
   */
  async getAlertRules(): Promise<AlertRuleResponse[]> {
    try {
      logger.info('Getting alert rules');

      const rules = this.alertService.getAllAlertRules();

      return rules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        metricName: rule.metricName,
        condition: rule.conditionOperator,
        threshold: rule.thresholdValue,
        severity: rule.severity,
        enabled: rule.isActive,
        cooldownMinutes: rule.cooldownMinutes,
        notificationChannels: rule.notificationChannels,
        createdAt: new Date(rule.createdAt).toISOString(),
        updatedAt: new Date(rule.updatedAt).toISOString(),
        lastTriggered: undefined, // AlertRule中没有这个字段
      }));
    } catch (error) {
      logger.error('Failed to get alert rules', { error });
      throw error;
    }
  }

  /**
   * 获取告警规则总数
   */
  async getAlertRulesCount(activeOnly?: boolean): Promise<number> {
    try {
      logger.info('Getting alert rules count');
      return this.alertService.getAlertRulesCount(activeOnly);
    } catch (error) {
      logger.error('Failed to get alert rules count', { error });
      throw error;
    }
  }

  /**
   * 分页获取告警规则列表API
   */
  async getAlertRulesPaginated(
    page: number,
    limit: number,
    sort: string = 'created_at',
    order: 'asc' | 'desc' = 'desc',
    activeOnly?: boolean,
  ): Promise<{ rules: AlertRuleResponse[]; total: number }> {
    try {
      logger.info('Getting alert rules paginated', {
        page,
        limit,
        sort,
        order,
        activeOnly,
      });

      const [rules, total] = await Promise.all([
        this.alertService.getAlertRulesPaginated(
          page,
          limit,
          sort,
          order,
          activeOnly,
        ),
        this.alertService.getAlertRulesCount(activeOnly),
      ]);

      const mappedRules = rules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        metricName: rule.metricName,
        condition: rule.conditionOperator,
        threshold: rule.thresholdValue,
        severity: rule.severity,
        enabled: rule.isActive,
        cooldownMinutes: rule.cooldownMinutes,
        notificationChannels: rule.notificationChannels,
        createdAt: new Date(rule.createdAt).toISOString(),
        updatedAt: new Date(rule.updatedAt).toISOString(),
        lastTriggered: undefined, // AlertRule中没有这个字段
      }));

      return { rules: mappedRules, total };
    } catch (error) {
      logger.error('Failed to get alert rules paginated', { error });
      throw error;
    }
  }

  /**
   * 更新告警规则API
   */
  async updateAlertRule(
    ruleId: string,
    request: UpdateAlertRuleRequest,
  ): Promise<AlertRuleResponse> {
    try {
      logger.info('Updating alert rule', { ruleId, request });

      const updates: Partial<AlertRule> = {};
      if (request.name !== undefined) updates.name = request.name;
      if (request.description !== undefined)
        updates.description = request.description;
      if (request.metricName !== undefined)
        updates.metricName = request.metricName;
      if (request.condition !== undefined)
        updates.conditionOperator = request.condition as
          | '>'
          | '<'
          | '>='
          | '<='
          | '=='
          | '!=';
      if (request.threshold !== undefined)
        updates.thresholdValue = request.threshold;
      if (request.severity !== undefined)
        updates.severity = request.severity as AlertSeverity;
      if (request.enabled !== undefined) updates.isActive = request.enabled;
      if (request.cooldownMinutes !== undefined)
        updates.cooldownMinutes = request.cooldownMinutes;
      if (request.notificationChannels !== undefined)
        updates.notificationChannels = request.notificationChannels;

      const success = this.alertService.updateAlertRule(ruleId, updates);
      if (!success) {
        throw new Error('Failed to update alert rule');
      }

      const rule = this.alertService.getAlertRule(ruleId);
      if (!rule) {
        throw new Error('Failed to retrieve updated alert rule');
      }

      return {
        id: rule.id,
        name: rule.name,
        description: rule.description,
        metricName: rule.metricName,
        condition: rule.conditionOperator,
        threshold: rule.thresholdValue,
        severity: rule.severity,
        enabled: rule.isActive,
        cooldownMinutes: rule.cooldownMinutes,
        notificationChannels: rule.notificationChannels,
        createdAt: new Date(rule.createdAt).toISOString(),
        updatedAt: new Date(rule.updatedAt).toISOString(),
        lastTriggered: undefined, // AlertRule中没有这个字段
      };
    } catch (error) {
      logger.error('Failed to update alert rule', { error, ruleId, request });
      throw error;
    }
  }

  /**
   * 删除告警规则API
   */
  async deleteAlertRule(ruleId: string): Promise<void> {
    try {
      logger.info('Deleting alert rule', { ruleId });

      await this.alertService.deleteAlertRule(ruleId);
    } catch (error) {
      logger.error('Failed to delete alert rule', { error, ruleId });
      throw error;
    }
  }

  /**
   * 获取告警历史API
   */
  async getAlertHistory(
    request: AlertHistoryRequest,
  ): Promise<AlertHistoryResponse> {
    try {
      logger.info('Getting alert history', { request });

      const alerts = this.alertService.getAlertHistory(
        request.limit,
        request.offset,
        request.ruleId,
      );

      return {
        alerts: alerts.map((alert) => ({
          id: alert.id,
          ruleId: alert.ruleId,
          ruleName: (('ruleName' in alert ? alert.ruleName : undefined) as string) || 'Unknown',
          severity: alert.severity,
          status: alert.status,
          message: alert.message || 'No message',
          triggeredAt: new Date(alert.triggeredAt).toISOString(),
          resolvedAt: alert.resolvedAt
            ? new Date(alert.resolvedAt).toISOString()
            : undefined,
          acknowledgedAt: undefined, // AlertHistory中没有这个字段
          acknowledgedBy: undefined, // AlertHistory中没有这个字段
          metricValue: alert.metricValue,
          threshold: alert.thresholdValue,
        })),
        total: alerts.length,
        limit: request.limit,
        offset: request.offset,
      };
    } catch (error) {
      logger.error('Failed to get alert history', { error, request });
      throw error;
    }
  }
}
