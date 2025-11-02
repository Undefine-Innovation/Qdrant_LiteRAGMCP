import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { Logger } from '@logging/logger.js';
import { AlertRule } from '@infrastructure/sqlite/dao/index.js';
import { NotificationChannel } from './AlertNotificationService.js';

/**
 * 告警规则管理器
 * 负责告警规则的CRUD操作
 */
export class AlertRuleManager {
  /**
   *
   * @param sqliteRepo
   * @param logger
   */
  constructor(
    private readonly sqliteRepo: ISQLiteRepo,
    private readonly logger: Logger,
  ) {}

  /**
   * 创建告警规则
   * @param rule
   */
  public createAlertRule(
    rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>,
  ): string {
    return this.sqliteRepo.alertRules.create(rule);
  }

  /**
   * 更新告警规则
   * @param id
   * @param updates
   */
  public updateAlertRule(id: string, updates: Partial<AlertRule>): boolean {
    return this.sqliteRepo.alertRules.update(id, updates);
  }

  /**
   * 删除告警规则
   * @param id
   */
  public deleteAlertRule(id: string): boolean {
    return this.sqliteRepo.alertRules.delete(id);
  }

  /**
   * 获取告警规则
   * @param id
   */
  public getAlertRule(id: string): AlertRule | null {
    return this.sqliteRepo.alertRules.getById(id);
  }

  /**
   * 获取所有告警规则
   * @param activeOnly
   */
  public getAllAlertRules(activeOnly?: boolean): AlertRule[] {
    return this.sqliteRepo.alertRules.getAll(activeOnly);
  }

  /**
   * 获取所有活跃的告警规则
   */
  public getAllActiveRules(): AlertRule[] {
    return this.sqliteRepo.alertRules.getAll(true);
  }

  /**
   * 获取告警规则总数
   * @param activeOnly
   */
  public getAlertRulesCount(activeOnly?: boolean): number {
    return this.sqliteRepo.alertRules.getCount(activeOnly);
  }

  /**
   * 分页获取告警规则
   * @param page
   * @param limit
   * @param sort
   * @param order
   * @param activeOnly
   */
  public getAlertRulesPaginated(
    page: number,
    limit: number,
    sort: string = 'created_at',
    order: 'asc' | 'desc' = 'desc',
    activeOnly?: boolean,
  ): AlertRule[] {
    return this.sqliteRepo.alertRules.listPaginated(
      page,
      limit,
      sort,
      order,
      activeOnly,
    );
  }

  /**
   * 设置告警规则为活跃状态
   * @param id
   * @param isActive
   */
  public setAlertRuleActive(id: string, isActive: boolean): boolean {
    return this.sqliteRepo.alertRules.setActive(id, isActive);
  }

  /**
   * 获取告警统计信息
   */
  public getAlertStats(): {
    total: number;
    active: number;
    inactive: number;
    bySeverity: Record<string, number>;
  } {
    const stats = this.sqliteRepo.alertRules.getStats();
    return {
      ...stats,
      inactive: stats.total - stats.active,
    };
  }

  /**
   * 创建通知渠道
   * @param channel
   */
  public async createNotificationChannel(
    channel: Omit<NotificationChannel, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<NotificationChannel> {
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
   * 更新通知渠道
   * @param channelId
   * @param updates
   */
  public async updateNotificationChannel(
    channelId: string,
    updates: Partial<NotificationChannel>,
  ): Promise<NotificationChannel> {
    // 这里应该实现实际的数据库更新操作
    // 暂时返回模拟数据
    const channel = await this.getNotificationChannel(channelId);
    if (!channel) {
      throw new Error(`通知渠道不存在: ${channelId}`);
    }

    const updatedChannel = {
      ...channel,
      ...updates,
      updatedAt: Date.now(),
    };

    this.logger.info(`更新通知渠道: ${updatedChannel.name}`);
    return updatedChannel;
  }

  /**
   * 删除通知渠道
   * @param channelId
   */
  public async deleteNotificationChannel(channelId: string): Promise<void> {
    // 这里应该实现实际的数据库删除操作
    // 暂时只记录日志
    this.logger.info(`删除通知渠道: ${channelId}`);
  }

  /**
   * 获取单个通知渠道
   * @param channelId
   */
  public async getNotificationChannel(
    channelId: string,
  ): Promise<NotificationChannel | null> {
    // 这里应该实现从数据库获取通知渠道
    // 暂时返回默认渠道
    return {
      id: 'default_channel',
      name: '默认渠道',
      type: 'log',
      config: { level: 'warn' },
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /**
   * 获取通知渠道列表
   */
  public async getNotificationChannels(): Promise<NotificationChannel[]> {
    // 这里应该实现从数据库获取通知渠道
    // 暂时返回默认渠道
    return [
      {
        id: 'default_channel',
        name: '默认渠道',
        type: 'log',
        config: { level: 'warn' },
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
  }

  /**
   * 测试通知渠道
   * @param channelId
   * @param message
   * @param severity
   */
  public async testNotificationChannel(
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
      const mockAlert = {
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

      const mockRule = {
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

      // 这里应该调用实际的通知服务
      // 暂时只记录日志
      this.logger.info(`测试通知渠道: ${channelId}`, {
        alertId: mockAlert.id,
        ruleId: mockRule.id,
        severity: mockAlert.severity,
        metricValue: mockAlert.metricValue,
        threshold: mockAlert.thresholdValue,
      });

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