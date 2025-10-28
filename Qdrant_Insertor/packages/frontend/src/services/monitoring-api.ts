import { apiClient, PaginationQueryParams } from './api-client.js';

/**
 * 监控相关API
 */
export const monitoringApi = {
  /**
   * 获取告警规则列表
   */
  getAlertRules: async () => {
    return apiClient.get('/alert-rules');
  },

  /**
   * 获取告警规则列表（支持分页）
   */
  getAlertRulesPaginated: async (params?: PaginationQueryParams) => {
    return apiClient.get('/alert-rules', { params });
  },

  /**
   * 获取告警历史
   */
  getAlertHistory: async (params?: {
    limit?: number;
    offset?: number;
    ruleId?: string;
    timeRange?: string;
  }) => {
    return apiClient.get('/alerts/history', { params });
  },

  /**
   * 创建告警规则
   */
  createAlertRule: async (data: Record<string, unknown>) => {
    return apiClient.post('/alert-rules', data);
  },

  /**
   * 更新告警规则
   */
  updateAlertRule: async (id: string, data: Record<string, unknown>) => {
    return apiClient.put(`/alert-rules/${id}`, data);
  },

  /**
   * 删除告警规则
   */
  deleteAlertRule: async (id: string) => {
    return apiClient.delete(`/alert-rules/${id}`);
  },

  /**
   * 获取通知渠道列表
   */
  getNotificationChannels: async () => {
    return apiClient.get('/notification-channels');
  },

  /**
   * 创建通知渠道
   */
  createNotificationChannel: async (data: Record<string, unknown>) => {
    return apiClient.post('/notification-channels', data);
  },

  /**
   * 更新通知渠道
   */
  updateNotificationChannel: async (id: string, data: Record<string, unknown>) => {
    return apiClient.put(`/notification-channels/${id}`, data);
  },

  /**
   * 删除通知渠道
   */
  deleteNotificationChannel: async (id: string) => {
    return apiClient.delete(`/notification-channels/${id}`);
  },

  /**
   * 测试通知
   */
  testNotification: async (id: string, data: Record<string, unknown>) => {
    return apiClient.post(`/notification-channels/${id}/test`, data);
  },
};