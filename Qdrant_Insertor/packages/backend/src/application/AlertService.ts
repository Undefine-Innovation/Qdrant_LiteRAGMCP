import { SQLiteRepo } from '../infrastructure/SQLiteRepo.js';
import { Logger } from '../logger.js';
import { AlertRule, AlertHistory } from '../infrastructure/sqlite/dao/index.js';
import { AlertServiceCore } from './AlertServiceCore.js';
import { AlertRuleManager } from './AlertRuleManager.js';
import {
  AlertNotificationService,
  NotificationChannel,
} from './AlertNotificationService.js';

/**
 * 告警服务
 * 负责告警规则管理、告警触发和通知
 */
export class AlertService {
  private readonly core: AlertServiceCore;
  private readonly ruleManager: AlertRuleManager;
  private readonly notificationService: AlertNotificationService;

  constructor(
    private readonly sqliteRepo: SQLiteRepo,
    private readonly logger: Logger,
  ) {
    this.ruleManager = new AlertRuleManager(sqliteRepo, logger);
    this.notificationService = new AlertNotificationService(logger);
    this.core = new AlertServiceCore(
      sqliteRepo,
      logger,
      this.ruleManager,
      this.notificationService,
    );
  }

  /**
   * 停止告警服务
   */
  public stop(): void {
    this.core.stop();
  }

  /**
   * 检查所有告警规则
   */
  public async checkAlerts(): Promise<void> {
    return this.core.checkAlerts();
  }

  /**
   * 获取活跃告警
   */
  public getActiveAlerts(): AlertHistory[] {
    return this.core.getActiveAlerts();
  }

  /**
   * 获取告警历史
   */
  public getAlertHistory(
    limit?: number,
    offset?: number,
    ruleId?: string,
  ): AlertHistory[] {
    return this.core.getAlertHistory(limit, offset, ruleId);
  }

  /**
   * 创建告警规则
   */
  public createAlertRule(
    rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>,
  ): string {
    return this.ruleManager.createAlertRule(rule);
  }

  /**
   * 更新告警规则
   */
  public updateAlertRule(id: string, updates: Partial<AlertRule>): boolean {
    return this.ruleManager.updateAlertRule(id, updates);
  }

  /**
   * 删除告警规则
   */
  public deleteAlertRule(id: string): boolean {
    return this.ruleManager.deleteAlertRule(id);
  }

  /**
   * 获取告警规则
   */
  public getAlertRule(id: string): AlertRule | null {
    return this.ruleManager.getAlertRule(id);
  }

  /**
   * 获取所有告警规则
   */
  public getAllAlertRules(activeOnly?: boolean): AlertRule[] {
    return this.ruleManager.getAllAlertRules(activeOnly);
  }

  /**
   * 获取告警规则总数
   */
  public getAlertRulesCount(activeOnly?: boolean): number {
    return this.ruleManager.getAlertRulesCount(activeOnly);
  }

  /**
   * 分页获取告警规则
   */
  public getAlertRulesPaginated(
    page: number,
    limit: number,
    sort: string = 'created_at',
    order: 'asc' | 'desc' = 'desc',
    activeOnly?: boolean,
  ): AlertRule[] {
    return this.ruleManager.getAlertRulesPaginated(
      page,
      limit,
      sort,
      order,
      activeOnly,
    );
  }

  /**
   * 激活/停用告警规则
   */
  public setAlertRuleActive(id: string, isActive: boolean): boolean {
    return this.ruleManager.setAlertRuleActive(id, isActive);
  }

  /**
   * 获取告警统计信息
   */
  public getAlertStats() {
    return this.ruleManager.getAlertStats();
  }

  /**
   * 创建通知渠道
   */
  public async createNotificationChannel(
    channel: Omit<NotificationChannel, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<NotificationChannel> {
    return this.ruleManager.createNotificationChannel(channel);
  }

  /**
   * 获取通知渠道列表
   */
  public async getNotificationChannels(): Promise<NotificationChannel[]> {
    return this.notificationService.getNotificationChannels();
  }

  /**
   * 更新通知渠道
   */
  public async updateNotificationChannel(
    channelId: string,
    updates: Partial<NotificationChannel>,
  ): Promise<NotificationChannel> {
    return this.ruleManager.updateNotificationChannel(channelId, updates);
  }

  /**
   * 删除通知渠道
   */
  public async deleteNotificationChannel(channelId: string): Promise<void> {
    return this.ruleManager.deleteNotificationChannel(channelId);
  }

  /**
   * 测试通知
   */
  public async testNotification(
    channelId: string,
    message: string,
    severity: string,
  ): Promise<{ success: boolean; message: string; timestamp: string }> {
    return this.notificationService.testNotification(
      channelId,
      message,
      severity,
    );
  }
}

// 导出类型以保持向后兼容性
export type { NotificationChannel } from './AlertNotificationService.js';
