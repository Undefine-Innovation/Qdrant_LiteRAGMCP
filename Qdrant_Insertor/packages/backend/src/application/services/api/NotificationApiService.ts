import { AlertService } from '../alerting/index.js';
import {
  CreateNotificationChannelRequest,
  NotificationChannelResponse,
  UpdateNotificationChannelRequest,
  TestNotificationRequest,
  TestNotificationResponse,
} from '@api/contracts/Monitoring.js';
import { logger } from '@logging/logger.js';

/**
 * 通知API服务
 * 负责处理通知渠道的API请求
 */
export class NotificationApiService {
  /**
   * 创建通知API服务实例
   * @param alertService 告警服务实例
   */
  constructor(private alertService: AlertService) {}

  /**
   * 创建通知渠道API
   * @param request 创建通知渠道请求
   * @returns 通知渠道响应
   */
  async createNotificationChannel(
    request: CreateNotificationChannelRequest,
  ): Promise<NotificationChannelResponse> {
    try {
      logger.info('Creating notification channel', { name: request.name });

      const channel = await this.alertService.createNotificationChannel({
        name: request.name,
        type: request.type,
        config: request.config,
        isActive: request.enabled,
      });

      return {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        config: channel.config,
        enabled: channel.isActive,
        createdAt: new Date(channel.createdAt).toISOString(),
        updatedAt: new Date(channel.updatedAt).toISOString(),
        lastUsed: undefined, // NotificationChannel中没有这个字段
      };
    } catch (error) {
      logger.error('Failed to create notification channel', { error, request });
      throw error;
    }
  }

  /**
   * 获取通知渠道列表API
   * @returns 通知渠道列表响应
   */
  async getNotificationChannels(): Promise<NotificationChannelResponse[]> {
    try {
      logger.info('Getting notification channels');

      const channels = await this.alertService.getNotificationChannels();

      return channels.map((channel) => ({
        id: channel.id,
        name: channel.name,
        type: channel.type,
        config: channel.config,
        enabled: channel.isActive,
        createdAt: new Date(channel.createdAt).toISOString(),
        updatedAt: new Date(channel.updatedAt).toISOString(),
        lastUsed: undefined, // NotificationChannel中没有这个字段
      }));
    } catch (error) {
      logger.error('Failed to get notification channels', { error });
      throw error;
    }
  }

  /**
   * 更新通知渠道API
   * @param channelId 通知渠道ID
   * @param request 更新通知渠道请求
   * @returns 通知渠道响应
   */
  async updateNotificationChannel(
    channelId: string,
    request: UpdateNotificationChannelRequest,
  ): Promise<NotificationChannelResponse> {
    try {
      logger.info('Updating notification channel', { channelId, request });

      const channel = await this.alertService.updateNotificationChannel(
        channelId,
        request,
      );

      return {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        config: channel.config,
        enabled: channel.isActive,
        createdAt: new Date(channel.createdAt).toISOString(),
        updatedAt: new Date(channel.updatedAt).toISOString(),
        lastUsed: undefined, // NotificationChannel中没有这个字段
      };
    } catch (error) {
      logger.error('Failed to update notification channel', {
        error,
        channelId,
        request,
      });
      throw error;
    }
  }

  /**
   * 删除通知渠道API
   * @param channelId 通知渠道ID
   * @returns 无返回值
   */
  async deleteNotificationChannel(channelId: string): Promise<void> {
    try {
      logger.info('Deleting notification channel', { channelId });

      await this.alertService.deleteNotificationChannel(channelId);
    } catch (error) {
      logger.error('Failed to delete notification channel', {
        error,
        channelId,
      });
      throw error;
    }
  }

  /**
   * 测试通知API
   * @param request 测试通知请求
   * @returns 测试通知响应
   */
  async testNotification(
    request: TestNotificationRequest,
  ): Promise<TestNotificationResponse> {
    try {
      logger.info('Testing notification', { channelId: request.channelId });

      const result = await this.alertService.testNotification(
        request.channelId,
        request.message,
        request.severity,
      );

      return {
        success: result.success,
        message: result.message,
        timestamp: result.timestamp,
      };
    } catch (error) {
      logger.error('Failed to test notification', { error, request });
      throw error;
    }
  }
}
