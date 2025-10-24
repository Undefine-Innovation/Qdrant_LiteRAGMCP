import { SQLiteRepo } from '../infrastructure/SQLiteRepo.js';
import { Logger } from '../logger.js';
import { AlertRule, AlertSeverity, SystemMetric, AlertHistory } from '../infrastructure/sqlite/dao/index.js';

/**
 * 扩展的告警历史记录接口
 */
export interface ExtendedAlertHistory extends AlertHistory {
  ruleName: string;
}

/**
 * 告警通知渠道接口
 */
export interface NotificationChannel {
  id: string;
  name: string;
  type: 'webhook' | 'email' | 'slack' | 'log';
  config: Record<string, unknown>;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * 告警服务
 * 负责告警规则管理、告警触发和通知
 */
export class AlertService {
  private readonly activeAlerts: Map<string, ExtendedAlertHistory> = new Map();
  private readonly alertCooldowns: Map<string, number> = new Map();
  private readonly alertCheckInterval = 60000; // 1分钟检查一次
  private alertCheckTimer?: NodeJS.Timeout;

  constructor(
    private readonly sqliteRepo: SQLiteRepo,
    private readonly logger: Logger,
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
      const activeRules = this.sqliteRepo.alertRules.getAll(true); // 只获取活跃规则
      
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
      const latestMetric = this.sqliteRepo.systemMetrics.getLatestByName(rule.metricName);
      if (!latestMetric) {
        this.logger.debug(`指标 ${rule.metricName} 没有数据，跳过告警检查`);
        return;
      }

      // 评估告警条件
      const isTriggered = this.evaluateCondition(
        latestMetric.metricValue,
        rule.conditionOperator,
        rule.thresholdValue
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
    threshold: number
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
  private async triggerAlert(rule: AlertRule, metric: SystemMetric): Promise<void> {
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
    this.alertCooldowns.set(rule.id, now + (rule.cooldownMinutes * 60 * 1000));

    // 发送通知
    await this.sendNotifications(rule, alert);

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
   * 发送通知
   */
  private async sendNotifications(rule: AlertRule, alert: AlertHistory): Promise<void> {
    for (const channelId of rule.notificationChannels) {
      try {
        const channel = await this.getNotificationChannel(channelId);
        if (!channel || !channel.isActive) {
          continue;
        }

        await this.sendNotification(channel, rule, alert);
      } catch (error) {
        this.logger.error(`发送通知失败`, {
          channelId,
          error: (error as Error).message,
          alertId: alert.id,
        });
      }
    }
  }

  /**
   * 发送单个通知
   */
  private async sendNotification(
    channel: NotificationChannel,
    rule: AlertRule,
    alert: AlertHistory
  ): Promise<void> {
    switch (channel.type) {
      case 'log':
        this.sendLogNotification(rule, alert);
        break;
      case 'webhook':
        await this.sendWebhookNotification(channel, rule, alert);
        break;
      case 'email':
        await this.sendEmailNotification(channel, rule, alert);
        break;
      case 'slack':
        await this.sendSlackNotification(channel, rule, alert);
        break;
      default:
        this.logger.warn(`未知的通知渠道类型: ${channel.type}`);
    }
  }

  /**
   * 发送日志通知
   */
  private sendLogNotification(rule: AlertRule, alert: AlertHistory): void {
    const logLevel = {
      low: 'info',
      medium: 'warn',
      high: 'error',
      critical: 'error',
    }[alert.severity];

    if (logLevel === 'info') {
      this.logger.info(`[告警] ${alert.message}`, {
      alertId: alert.id,
      ruleId: rule.id,
      severity: alert.severity,
      metricValue: alert.metricValue,
      threshold: alert.thresholdValue,
      });
    } else if (logLevel === 'warn') {
      this.logger.warn(`[告警] ${alert.message}`, {
        alertId: alert.id,
        ruleId: rule.id,
        severity: alert.severity,
        metricValue: alert.metricValue,
        threshold: alert.thresholdValue,
      });
    } else {
      this.logger.error(`[告警] ${alert.message}`, {
        alertId: alert.id,
        ruleId: rule.id,
        severity: alert.severity,
        metricValue: alert.metricValue,
        threshold: alert.thresholdValue,
      });
    }
  }

  /**
   * 发送Webhook通知
   */
  private async sendWebhookNotification(
    channel: NotificationChannel,
    rule: AlertRule,
    alert: AlertHistory
  ): Promise<void> {
    const config = channel.config as { url: string; headers?: Record<string, string> };
    
    if (!config.url) {
      throw new Error('Webhook URL未配置');
    }

    const payload = {
      alert: {
        id: alert.id,
        ruleName: rule.name,
        severity: alert.severity,
        status: alert.status,
        message: alert.message,
        metricValue: alert.metricValue,
        thresholdValue: alert.thresholdValue,
        triggeredAt: alert.triggeredAt,
        resolvedAt: alert.resolvedAt,
      },
      rule: {
        id: rule.id,
        name: rule.name,
        description: rule.description,
        metricName: rule.metricName,
        conditionOperator: rule.conditionOperator,
        thresholdValue: rule.thresholdValue,
      },
      timestamp: Date.now(),
    };

    // 这里应该实现实际的HTTP请求
    // 暂时只记录日志
    this.logger.info(`[Webhook] 发送告警通知到 ${config.url}`, {
      payload,
    });
  }

  /**
   * 发送邮件通知
   */
  private async sendEmailNotification(
    channel: NotificationChannel,
    rule: AlertRule,
    alert: AlertHistory
  ): Promise<void> {
    const config = channel.config as { 
      to: string[]; 
      subject?: string; 
      from?: string; 
      smtp?: Record<string, unknown>;
    };

    if (!config.to || config.to.length === 0) {
      throw new Error('邮件收件人未配置');
    }

    // 这里应该实现实际的邮件发送
    // 暂时只记录日志
    this.logger.info(`[邮件] 发送告警通知`, {
      to: config.to,
      subject: config.subject || `告警: ${rule.name}`,
      alertId: alert.id,
    });
  }

  /**
   * 发送Slack通知
   */
  private async sendSlackNotification(
    channel: NotificationChannel,
    rule: AlertRule,
    alert: AlertHistory
  ): Promise<void> {
    const config = channel.config as { 
      webhookUrl: string; 
      channel?: string; 
      username?: string; 
    };

    if (!config.webhookUrl) {
      throw new Error('Slack Webhook URL未配置');
    }

    const payload = {
      text: alert.message,
      attachments: [
        {
          color: this.getSeverityColor(alert.severity as string),
          fields: [
            {
              title: '规则',
              value: rule.name,
              short: true,
            },
            {
              title: '严重程度',
              value: alert.severity,
              short: true,
            },
            {
              title: '指标值',
              value: alert.metricValue.toString(),
              short: true,
            },
            {
              title: '阈值',
              value: alert.thresholdValue.toString(),
              short: true,
            },
          ],
          ts: Math.floor(alert.triggeredAt / 1000),
        },
      ],
      username: config.username || 'Qdrant Monitor',
      channel: config.channel,
    };

    // 这里应该实现实际的Slack API调用
    // 暂时只记录日志
    this.logger.info(`[Slack] 发送告警通知`, {
      webhookUrl: config.webhookUrl,
      channel: config.channel,
      alertId: alert.id,
    });
  }

  /**
   * 获取严重程度对应的颜色
   */
  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'low':
        return 'good';
      case 'medium':
        return 'warning';
      case 'high':
        return 'danger';
      case 'critical':
        return '#ff0000';
      default:
        return 'warning';
    }
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
   * 创建告警规则
   */
  public createAlertRule(rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>): string {
    return this.sqliteRepo.alertRules.create(rule);
  }

  /**
   * 更新告警规则
   */
  public updateAlertRule(id: string, updates: Partial<AlertRule>): boolean {
    return this.sqliteRepo.alertRules.update(id, updates);
  }

  /**
   * 删除告警规则
   */
  public deleteAlertRule(id: string): boolean {
    return this.sqliteRepo.alertRules.delete(id);
  }

  /**
   * 获取告警规则
   */
  public getAlertRule(id: string): AlertRule | null {
    return this.sqliteRepo.alertRules.getById(id);
  }

  /**
   * 获取所有告警规则
   */
  public getAllAlertRules(activeOnly?: boolean): AlertRule[] {
    return this.sqliteRepo.alertRules.getAll(activeOnly);
  }

  /**
   * 激活/停用告警规则
   */
  public setAlertRuleActive(id: string, isActive: boolean): boolean {
    return this.sqliteRepo.alertRules.setActive(id, isActive);
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
    ruleId?: string
  ): AlertHistory[] {
    // 这里应该实现从数据库获取告警历史
    // 暂时返回活跃告警
    return this.getActiveAlerts();
  }

  /**
   * 获取告警统计信息
   */
  public getAlertStats() {
    return this.sqliteRepo.alertRules.getStats();
  }

  /**
   * 创建通知渠道
   */
  public async createNotificationChannel(channel: Omit<NotificationChannel, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationChannel> {
    // 这里应该实现实际的数据库操作
    // 暂时返回模拟数据
    const newChannel: NotificationChannel = {
      id: `channel_${Date.now()}`,
      ...channel,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    this.logger.info(`创建通知渠道: ${newChannel.name}`);
    return newChannel;
  }

  /**
   * 获取通知渠道列表
   */
  public async getNotificationChannels(): Promise<NotificationChannel[]> {
    // 这里应该实现从数据库获取通知渠道
    // 暂时返回默认渠道
    return [{
      id: 'channel_log',
      name: '日志通知',
      type: 'log',
      config: { level: 'warn' },
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }];
  }

  /**
   * 更新通知渠道
   */
  public async updateNotificationChannel(channelId: string, updates: Partial<NotificationChannel>): Promise<NotificationChannel> {
    // 这里应该实现实际的数据库更新操作
    // 暂时返回模拟数据
    const channel = await this.getNotificationChannel(channelId);
    if (!channel) {
      throw new Error(`通知渠道不存在: ${channelId}`);
    }
    
    const updatedChannel: NotificationChannel = {
      ...channel,
      ...updates,
      updatedAt: Date.now(),
    };
    
    this.logger.info(`更新通知渠道: ${updatedChannel.name}`);
    return updatedChannel;
  }

  /**
   * 删除通知渠道
   */
  public async deleteNotificationChannel(channelId: string): Promise<void> {
    // 这里应该实现实际的数据库删除操作
    this.logger.info(`删除通知渠道: ${channelId}`);
  }

  /**
   * 测试通知
   */
  public async testNotification(channelId: string, message: string, severity: string): Promise<{ success: boolean; message: string; timestamp: string }> {
    try {
      const channel = await this.getNotificationChannel(channelId);
      if (!channel) {
        throw new Error(`通知渠道不存在: ${channelId}`);
      }

      // 创建模拟告警用于测试
      const mockAlert: AlertHistory = {
        id: `test_alert_${Date.now()}`,
        ruleId: 'test_rule',
        metricValue: 100,
        thresholdValue: 80,
        severity: severity as any,
        status: 'triggered',
        message,
        triggeredAt: Date.now(),
        createdAt: Date.now(),
      };

      const mockRule: AlertRule = {
        id: 'test_rule',
        name: '测试规则',
        metricName: 'test_metric',
        conditionOperator: '>',
        thresholdValue: 80,
        severity: severity as AlertSeverity,
        isActive: true,
        cooldownMinutes: 5,
        notificationChannels: [channelId],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await this.sendNotification(channel, mockRule, mockAlert);

      return {
        success: true,
        message: '测试通知发送成功',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: `测试通知发送失败: ${(error as Error).message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 获取单个通知渠道
   */
  private async getNotificationChannel(channelId: string): Promise<NotificationChannel | null> {
    const channels = await this.getNotificationChannels();
    return channels.find(c => c.id === channelId) || null;
  }
}