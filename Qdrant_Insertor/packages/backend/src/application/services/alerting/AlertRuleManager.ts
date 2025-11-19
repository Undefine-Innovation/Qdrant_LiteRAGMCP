import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { Logger } from '@logging/logger.js';
import { AlertRule } from '@infrastructure/sqlite/dao/index.js';
import { NotificationChannel } from './AlertNotificationService.js';

/**
 * 告警规则管理器
 * 负责告警规则的 CRUD 操作
 */
export class AlertRuleManager {
  /**
   * 告警规则管理器
   * @description 负责告警规则的 CRUD 操作
   * @param sqliteRepo - SQLite 仓库实例
   * @param logger - 日志记录器实例
   */
  constructor(
    private readonly sqliteRepo: ISQLiteRepo,
    private readonly logger: Logger,
  ) {}

  /**
   * 创建告警规则
   * @param rule - 告警规则对象
   * @returns string - 返回创建的告警规则 ID
   */
  public async createAlertRule(
    rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<string> {
    try {
      return (await this.sqliteRepo.alertRules.create(rule)) as string;
    } catch (error) {
      this.logger.error('创建告警规则失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 更新告警规则
   * @param id - 告警规则 ID
   * @param updates - 更新内容
   * @returns boolean - 返回是否更新成功
   */
  public async updateAlertRule(
    id: string,
    updates: Partial<AlertRule>,
  ): Promise<boolean> {
    try {
      return (await this.sqliteRepo.alertRules.update(id, updates)) as boolean;
    } catch (error) {
      this.logger.error('更新告警规则失败', {
        error: error instanceof Error ? error.message : String(error),
        id,
      });
      throw error;
    }
  }

  /**
   * 删除告警规则
   * @param id - 告警规则 ID
   * @returns boolean - 返回是否删除成功
   */
  public async deleteAlertRule(id: string): Promise<boolean> {
    try {
      return await this.sqliteRepo.alertRules.delete(id);
    } catch (error) {
      this.logger.error('删除告警规则失败', {
        error: error instanceof Error ? error.message : String(error),
        id,
      });
      throw error;
    }
  }

  /**
   * 获取告警规则
   * @param id - 告警规则 ID
   * @returns AlertRule | null - 返回告警规则对象或 null
   */
  public async getAlertRule(id: string): Promise<AlertRule | null> {
    try {
      return (await this.sqliteRepo.alertRules.getById(id)) as AlertRule | null;
    } catch (error) {
      this.logger.warn('获取告警规则失败', {
        error: error instanceof Error ? error.message : String(error),
        id,
      });
      return null;
    }
  }

  /**
   * 获取所有告警规则
   * @param activeOnly - 是否只获取活跃的告警规则
   * @returns AlertRule[] - 返回告警规则数组
   */
  public async getAllAlertRules(activeOnly?: boolean): Promise<AlertRule[]> {
    try {
      return (await this.sqliteRepo.alertRules.getAll(
        activeOnly ? { activeOnly: true } : undefined,
      )) as AlertRule[];
    } catch (error) {
      this.logger.warn('获取告警规则失败，返回空列表', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * 获取所有活跃的告警规则
   * @returns AlertRule[] - 返回活跃的告警规则列表
   */
  public async getAllActiveRules(): Promise<AlertRule[]> {
    try {
      return (await this.sqliteRepo.alertRules.getAll({})) as AlertRule[];
    } catch (error) {
      this.logger.warn('获取活跃告警规则失败，返回空列表', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * 获取告警规则总数
   * @param activeOnly - 是否只统计活跃的告警规则
   * @returns number - 返回告警规则总数
   */
  public async getAlertRulesCount(activeOnly?: boolean): Promise<number> {
    try {
      return (await this.sqliteRepo.alertRules.getCount(
        activeOnly ? { active: true } : undefined,
      )) as number;
    } catch (error) {
      this.logger.warn('获取告警规则总数失败，返回 0', {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * 分页获取告警规则
   * @param page - 页码
   * @param limit - 每页数量
   * @param sort - 排序字段
   * @param order - 排序方向
   * @param activeOnly - 是否只返回活跃的告警规则
   * @returns AlertRule[] - 返回分页的告警规则列表
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
    ) as AlertRule[];
  }

  /**
   * 设置告警规则为活跃状态
   * @param id - 告警规则 ID
   * @param isActive - 是否活跃
   * @returns boolean - 返回是否设置成功
   */
  public setAlertRuleActive(id: string, isActive: boolean): boolean {
    return this.sqliteRepo.alertRules.setActive(id, isActive);
  }

  /**
   * 获取告警统计信息
   * @returns Object - 返回告警统计信息
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
   * @param channel 通知渠道对象
   * @returns {Promise<NotificationChannel>} 返回创建的通知渠道
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
   * @param channelId 通知渠道 ID
   * @param updates 更新内容
   * @returns {Promise<NotificationChannel>} 返回更新后的通知渠道
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
   * @param channelId 通知渠道 ID
   * @returns {Promise<NotificationChannel | null>} 返回通知渠道或 null
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
   * @returns {Promise<NotificationChannel[]>} 返回通知渠道列表
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
   * @param channelId 通知渠道 ID
   * @param message 通知消息
   * @param severity 严重程度
   * @returns {Promise<{ success: boolean; message: string; timestamp: string }>} 返回测试结果
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
