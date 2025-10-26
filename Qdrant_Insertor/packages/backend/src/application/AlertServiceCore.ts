import { SQLiteRepo } from '../infrastructure/SQLiteRepo.js';
import { Logger } from '../logger.js';
import {
  AlertRule,
  AlertSeverity,
  SystemMetric,
  AlertHistory,
} from '../infrastructure/sqlite/dao/index.js';
import { AlertRuleManager } from './AlertRuleManager.js';
import { AlertNotificationService } from './AlertNotificationService.js';

/**
 * 扩展的告警历史记录接口
 */
export interface ExtendedAlertHistory extends AlertHistory {
  ruleName: string;
}

/**
 * 告警服务核心
 * 负责告警检查、评估和触发逻辑
 */
export class AlertServiceCore {
  private readonly activeAlerts: Map<string, ExtendedAlertHistory> = new Map();
  private readonly alertCooldowns: Map<string, number> = new Map();
  private readonly alertCheckInterval = 60000; // 1分钟检查一次
  private alertCheckTimer?: NodeJS.Timeout;

  constructor(
    private readonly sqliteRepo: SQLiteRepo,
    private readonly logger: Logger,
    private readonly ruleManager: AlertRuleManager,
    private readonly notificationService: AlertNotificationService,
  ) {
    this.startAlertChecking();
  }

  /**
   * 启动告警检查
   */
  private startAlertChecking(): void {
    this.alertCheckTimer = setInterval(() => {
      this.checkAlerts();
    }, this.alertCheckInterval);
  }

  /**
   * 停止告警服务
   */
  public stop(): void {
    if (this.alertCheckTimer) {
      clearInterval(this.alertCheckTimer);
    }
  }

  /**
   * 检查所有告警规则
   */
  public async checkAlerts(): Promise<void> {
    try {
      const activeRules = this.ruleManager.getAllActiveRules();

      for (const rule of activeRules) {
        await this.evaluateAlertRule(rule);
      }
    } catch (error) {
      this.logger.error('检查告警规则失败', {
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
    }
  }

  /**
   * 评估单个告警规则
   */
  private async evaluateAlertRule(rule: AlertRule): Promise<void> {
    try {
      // 检查冷却时间
      if (this.isInCooldown(rule.id)) {
        return;
      }

      // 获取最新指标值
      const latestMetric = this.sqliteRepo.systemMetrics.getLatestByName(
        rule.metricName,
      );
      if (!latestMetric) {
        this.logger.debug(`指标 ${rule.metricName} 没有数据，跳过告警检查`);
        return;
      }

      // 评估告警条件
      const isTriggered = this.evaluateCondition(
        latestMetric.metricValue,
        rule.conditionOperator,
        rule.thresholdValue,
      );

      const existingAlert = this.activeAlerts.get(rule.id);

      if (isTriggered && !existingAlert) {
        // 触发新告警
        await this.triggerAlert(rule, latestMetric);
      } else if (!isTriggered && existingAlert) {
        // 解决告警
        await this.resolveAlert(rule.id);
      }
    } catch (error) {
      this.logger.error(`评估告警规则 ${rule.name} 失败`, {
        error: (error as Error).message,
        ruleId: rule.id,
      });
    }
  }

  /**
   * 评估告警条件
   */
  private evaluateCondition(
    metricValue: number,
    operator: AlertRule['conditionOperator'],
    threshold: number,
  ): boolean {
    switch (operator) {
      case '>':
        return metricValue > threshold;
      case '<':
        return metricValue < threshold;
      case '>=':
        return metricValue >= threshold;
      case '<=':
        return metricValue <= threshold;
      case '==':
        return metricValue === threshold;
      case '!=':
        return metricValue !== threshold;
      default:
        return false;
    }
  }

  /**
   * 触发告警
   */
  private async triggerAlert(
    rule: AlertRule,
    metric: SystemMetric,
  ): Promise<void> {
    const alertId = `alert_${rule.id}_${Date.now()}`;
    const now = Date.now();

    const alert: ExtendedAlertHistory = {
      id: alertId,
      ruleId: rule.id,
      ruleName: rule.name,
      metricValue: metric.metricValue,
      thresholdValue: rule.thresholdValue,
      severity: rule.severity,
      status: 'triggered',
      message: this.generateAlertMessage(rule, metric),
      triggeredAt: now,
      createdAt: now,
    };

    // 保存告警历史
    this.sqliteRepo.alertHistory.create({
      ruleId: rule.id,
      metricValue: metric.metricValue,
      thresholdValue: rule.thresholdValue,
      severity: rule.severity,
      status: 'triggered',
      message: alert.message,
      triggeredAt: now,
    });

    // 添加到活跃告警
    this.activeAlerts.set(rule.id, alert);

    // 设置冷却时间
    this.alertCooldowns.set(rule.id, now + rule.cooldownMinutes * 60 * 1000);

    // 发送通知
    await this.notificationService.sendNotifications(rule, alert);

    this.logger.warn(`告警触发: ${rule.name}`, {
      ruleId: rule.id,
      metricName: rule.metricName,
      metricValue: metric.metricValue,
      threshold: rule.thresholdValue,
      severity: rule.severity,
    });
  }

  /**
   * 解决告警
   */
  private async resolveAlert(ruleId: string): Promise<void> {
    const alert = this.activeAlerts.get(ruleId);
    if (!alert) return;

    const now = Date.now();

    // 更新告警历史
    this.sqliteRepo.alertHistory.update(alert.id, {
      status: 'resolved',
      resolvedAt: now,
    });

    // 从活跃告警中移除
    this.activeAlerts.delete(ruleId);

    // 清除冷却时间
    this.alertCooldowns.delete(ruleId);

    this.logger.info(`告警已解决: ${alert.ruleName}`, {
      alertId: alert.id,
      ruleId,
      duration: now - alert.triggeredAt,
    });
  }

  /**
   * 生成告警消息
   */
  private generateAlertMessage(rule: AlertRule, metric: SystemMetric): string {
    const operatorText = {
      '>': '超过',
      '<': '低于',
      '>=': '达到或超过',
      '<=': '达到或低于',
      '==': '等于',
      '!=': '不等于',
    }[rule.conditionOperator];

    const severityText = {
      low: '低',
      medium: '中',
      high: '高',
      critical: '严重',
    }[rule.severity];

    let message = `告警: ${rule.name} (${severityText}严重程度)\n`;
    message += `指标 ${rule.metricName} 的值 ${metric.metricValue} ${operatorText} 阈值 ${rule.thresholdValue}`;

    if (rule.description) {
      message += `\n描述: ${rule.description}`;
    }

    if (metric.tags) {
      message += `\n标签: ${JSON.stringify(metric.tags)}`;
    }

    return message;
  }

  /**
   * 检查是否在冷却时间内
   */
  private isInCooldown(ruleId: string): boolean {
    const cooldownEnd = this.alertCooldowns.get(ruleId);
    if (!cooldownEnd) return false;

    return Date.now() < cooldownEnd;
  }

  /**
   * 获取活跃告警
   */
  public getActiveAlerts(): AlertHistory[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * 获取告警历史
   */
  public getAlertHistory(
    limit?: number,
    offset?: number,
    ruleId?: string,
  ): AlertHistory[] {
    // 这里应该实现从数据库获取告警历史
    // 暂时返回活跃告警
    return this.getActiveAlerts();
  }
}
