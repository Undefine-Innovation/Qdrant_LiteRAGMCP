import { SQLiteRepo } from '../infrastructure/SQLiteRepo.js';
import { Logger } from '../logger.js';
import { AlertRule } from '../infrastructure/sqlite/dao/index.js';
import { NotificationChannel } from './AlertNotificationService.js';

/**
 * 告警规则管理器
 * 负责告警规则的CRUD操作
 */
export class AlertRuleManager {
  constructor(
    private readonly sqliteRepo: SQLiteRepo,
    private readonly logger: Logger,
  ) {}

  /**
   * 创建告警规则
   */
  public createAlertRule(
    rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>,
  ): string {
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
   * 获取所有活跃告警规则
   */
  public getAllActiveRules(): AlertRule[] {
    return this.sqliteRepo.alertRules.getAll(true);
  }

  /**
   * 激活/停用告警规则
   */
  public setAlertRuleActive(id: string, isActive: boolean): boolean {
    return this.sqliteRepo.alertRules.setActive(id, isActive);
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
   * 获取单个通知渠道
   */
  public async getNotificationChannel(
    channelId: string,
  ): Promise<NotificationChannel | null> {
    // 这里应该实现从数据库获取通知渠道
    // 暂时返回默认渠道
    const channels = await this.getNotificationChannels();
    return channels.find((c) => c.id === channelId) || null;
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
}
