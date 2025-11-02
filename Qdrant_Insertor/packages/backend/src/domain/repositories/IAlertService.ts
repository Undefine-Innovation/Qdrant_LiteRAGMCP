/**
 * 告警服务接口
 * @description 定义告警管理的核心业务接口，遵循依赖倒置原则
 */
import {
  AlertRule,
  AlertHistory,
} from '../../infrastructure/sqlite/dao/index.js';

/**
 * 告警规则配置接口
 */
export interface AlertRuleConfig {
  name: string;
  condition: string;
  threshold: number;
  enabled: boolean;
  notificationChannels: string[];
}

/**
 * 告警历史记录接口
 */
export interface AlertRecord {
  id: string;
  ruleId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  triggeredAt: Date;
  resolvedAt?: Date;
  status: 'active' | 'resolved' | 'suppressed';
}

/**
 * 通知渠道接口
 */
export interface NotificationChannel {
  id: string;
  name: string;
  type: string;
  config: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * 告警服务接口
 * @description 应用层应该依赖此接口而不是具体实现
 */
export interface IAlertService {
  /**
   * 停止告警服务
   */
  stop(): void;

  /**
   * 检查所有告警规则
   */
  checkAlerts(): Promise<void>;

  /**
   * 获取活跃告警
   */
  getActiveAlerts(): AlertHistory[];

  /**
   * 获取告警历史
   * @param limit
   * @param offset
   * @param ruleId
   */
  getAlertHistory(
    limit?: number,
    offset?: number,
    ruleId?: string,
  ): AlertHistory[];

  /**
   * 创建告警规则
   * @param rule
   */
  createAlertRule(
    rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>,
  ): string;

  /**
   * 更新告警规则
   * @param id
   * @param updates
   */
  updateAlertRule(id: string, updates: Partial<AlertRule>): boolean;

  /**
   * 删除告警规则
   * @param id
   */
  deleteAlertRule(id: string): boolean;

  /**
   * 获取告警规则
   * @param id
   */
  getAlertRule(id: string): AlertRule | null;

  /**
   * 获取所有告警规则
   * @param activeOnly
   */
  getAllAlertRules(activeOnly?: boolean): AlertRule[];

  /**
   * 获取告警规则总数
   * @param activeOnly
   */
  getAlertRulesCount(activeOnly?: boolean): number;

  /**
   * 分页获取告警规则
   * @param page
   * @param limit
   * @param sort
   * @param order
   * @param activeOnly
   */
  getAlertRulesPaginated(
    page: number,
    limit: number,
    sort?: string,
    order?: 'asc' | 'desc',
    activeOnly?: boolean,
  ): AlertRule[];

  /**
   * 激活/停用告警规则
   * @param id
   * @param isActive
   */
  setAlertRuleActive(id: string, isActive: boolean): boolean;

  /**
   * 获取告警统计信息
   */
  getAlertStats(): {
    total: number;
    active: number;
    inactive: number;
    bySeverity: Record<string, number>;
  };

  /**
   * 创建通知渠道
   * @param channel
   */
  createNotificationChannel(
    channel: Omit<NotificationChannel, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<NotificationChannel>;

  /**
   * 获取通知渠道列表
   */
  getNotificationChannels(): Promise<NotificationChannel[]>;

  /**
   * 更新通知渠道
   * @param channelId
   * @param updates
   */
  updateNotificationChannel(
    channelId: string,
    updates: Partial<NotificationChannel>,
  ): Promise<NotificationChannel>;

  /**
   * 删除通知渠道
   * @param channelId
   */
  deleteNotificationChannel(channelId: string): Promise<void>;

  /**
   * 测试通知
   * @param channelId
   * @param message
   * @param severity
   */
  testNotification(
    channelId: string,
    message: string,
    severity: string,
  ): Promise<{ success: boolean; message: string; timestamp: string }>;
}
