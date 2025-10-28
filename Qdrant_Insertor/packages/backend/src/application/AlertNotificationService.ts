import { Logger } from '../logger.js';
import { AlertRule, AlertHistory } from '../infrastructure/sqlite/dao/index.js';

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
 * 告警通知服务
 * 负责处理各种通知渠道的告警发送
 */
export class AlertNotificationService {
  constructor(private readonly logger: Logger) {}

  /**
   * 发送通知
   */
  public async sendNotifications(
    rule: AlertRule,
    alert: AlertHistory,
  ): Promise<void> {
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
    alert: AlertHistory,
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
    alert: AlertHistory,
  ): Promise<void> {
    const config = channel.config as {
      url: string;
      headers?: Record<string, string>;
    };

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
    alert: AlertHistory,
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
    alert: AlertHistory,
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
   * 获取通知渠道列表
   */
  public async getNotificationChannels(): Promise<NotificationChannel[]> {
    // 这里应该实现从数据库获取通知渠道
    // 暂时返回默认渠道
    return [
      {
        id: 'channel_log',
        name: '日志通知',
        type: 'log',
        config: { level: 'warn' },
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
  }

  /**
   * 获取单个通知渠道
   */
  public async getNotificationChannel(
    channelId: string,
  ): Promise<NotificationChannel | null> {
    const channels = await this.getNotificationChannels();
    return channels.find((c) => c.id === channelId) || null;
  }

  /**
   * 测试通知
   */
  public async testNotification(
    channelId: string,
    message: string,
    severity: string,
  ): Promise<{ success: boolean; message: string; timestamp: string }> {
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
        severity: severity as 'low' | 'medium' | 'high' | 'critical',
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
        severity: severity as 'low' | 'medium' | 'high' | 'critical',
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
}
