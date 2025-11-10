import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import {
  IAlertService,
  AlertRuleConfig,
  AlertRecord,
} from '@domain/repositories/IAlertService.js';
import { Logger } from '@logging/logger.js';
import { AlertRule, AlertHistory } from '@infrastructure/sqlite/dao/index.js';
import { AlertServiceCore } from './AlertServiceCore.js';
import { AlertRuleManager } from './AlertRuleManager.js';
import {
  AlertNotificationService,
  NotificationChannel,
} from './AlertNotificationService.js';

/**
 * 告警服务实现
 * 负责告警规则管理、告警触发和通知
 * @description 遵循 DIP：依赖 ISQLiteRepo 接口而非具体实现
 */
export class AlertService implements IAlertService {
  private readonly core: AlertServiceCore;
  private readonly ruleManager: AlertRuleManager;
  private readonly notificationService: AlertNotificationService;

  /**
   * 构造函数
   * @param sqliteRepo SQLite 仓库实例
   * @param logger 日志记录器实例
   */
  constructor(
    private readonly sqliteRepo: ISQLiteRepo,
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
   * @returns Promise<void>
   */
  public async checkAlerts(): Promise<void> {
    return this.core.checkAlerts();
  }

  /**
   * 获取活跃告警
   * @returns 活跃告警历史记录数组
   */
  public getActiveAlerts(): AlertHistory[] {
    return this.core.getActiveAlerts();
  }

  /**
   * 获取告警历史
   * @param limit 限制数量
   * @param offset 偏移量
   * @param ruleId 规则ID
   * @returns 告警历史记录数组
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
   * @param rule 告警规则对象
   * @returns 创建的告警规则ID
   */
  public async createAlertRule(
    rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<string> {
    return await this.ruleManager.createAlertRule(rule);
  }

  /**
   * 更新告警规则
   * @param id 告警规则 ID
   * @param updates 更新内容
   * @returns 是否更新成功
   */
  public async updateAlertRule(
    id: string,
    updates: Partial<AlertRule>,
  ): Promise<boolean> {
    return await this.ruleManager.updateAlertRule(id, updates);
  }

  /**
   * 删除告警规则
   * @param id 告警规则 ID
   * @returns 是否删除成功
   */
  public async deleteAlertRule(id: string): Promise<boolean> {
    return await this.ruleManager.deleteAlertRule(id);
  }

  /**
   * 获取告警规则
   * @param id 告警规则 ID
   * @returns 告警规则对象或null
   */
  public async getAlertRule(id: string): Promise<AlertRule | null> {
    return await this.ruleManager.getAlertRule(id);
  }

  /**
   * 获取所有告警规则
   * @param activeOnly 是否只获取活跃的告警规则
   * @returns 告警规则数组
   */
  public async getAllAlertRules(activeOnly?: boolean): Promise<AlertRule[]> {
    return await this.ruleManager.getAllAlertRules(activeOnly);
  }

  /**
   * 获取告警规则总数
   * @param activeOnly 是否只统计活跃的告警规则
   * @returns {number} 返回告警规则总数
   */
  public async getAlertRulesCount(activeOnly?: boolean): Promise<number> {
    return await this.ruleManager.getAlertRulesCount(activeOnly);
  }

  /**
   * 分页获取告警规则
   * @param page 页码
   * @param limit 每页数量
   * @param sort 排序字段
   * @param order 排序方向
   * @param activeOnly 是否只返回活跃的告警规则
   * @returns {AlertRule[]} 返回分页的告警规则列表
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
   * @param id 告警规则 ID
   * @param isActive 是否活跃
   * @returns 是否设置成功
   */
  public setAlertRuleActive(id: string, isActive: boolean): boolean {
    return this.ruleManager.setAlertRuleActive(id, isActive);
  }

  /**
   * 获取告警统计信息
   * @returns {Object} 返回告警统计信息
   */
  public getAlertStats() {
    return this.ruleManager.getAlertStats();
  }

  /**
   * 创建通知渠道
   * @param channel 通知渠道对象
   * @returns {Promise<NotificationChannel>} 返回创建的通知渠道
   */
  public async createNotificationChannel(
    channel: Omit<NotificationChannel, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<NotificationChannel> {
    return this.ruleManager.createNotificationChannel(channel);
  }

  /**
   * 获取通知渠道列表
   * @returns 通知渠道数组
   */
  public async getNotificationChannels(): Promise<NotificationChannel[]> {
    return this.notificationService.getNotificationChannels();
  }

  /**
   * 更新通知渠道
   * @param channelId 通知渠道 ID
   * @param updates 更新内容
   * @returns {Promise<NotificationChannel>} 返回更新后的通知渠道
   */
  public async updateNotificationChannel(
    channelId: string,
    updates: Partial<NotificationChannel>,
  ): Promise<NotificationChannel> {
    return this.ruleManager.updateNotificationChannel(channelId, updates);
  }

  /**
   * 删除通知渠道
   * @param channelId 通知渠道 ID
   * @returns Promise<void>
   */
  public async deleteNotificationChannel(channelId: string): Promise<void> {
    return this.ruleManager.deleteNotificationChannel(channelId);
  }

  /**
   * 测试通知
   * @param channelId 通知渠道 ID
   * @param message 通知消息
   * @param severity 严重程度
   * @returns {Promise<{ success: boolean; message: string; timestamp: string }>} 返回测试结果
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
/**
 * 通知渠道类型
 */
export type { NotificationChannel } from './AlertNotificationService.js';
