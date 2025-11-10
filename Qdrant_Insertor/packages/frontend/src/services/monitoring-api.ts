import { apiClient, PaginationQueryParams } from './api-client.js';

// 监控相关类型定义
export interface HealthCheckResponse {
  success: boolean;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: number;
  components: Record<
    string,
    {
      status: 'healthy' | 'degraded' | 'unhealthy';
      lastCheck: string;
      message?: string;
      responseTime?: number;
    }
  >;
  uptime: number;
}

export interface SystemMetricsResponse {
  success: boolean;
  metrics: {
    cpu: {
      usage: number;
      loadAverage: number[];
    };
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    disk: {
      used: number;
      total: number;
      percentage: number;
    };
    database: {
      connections: number;
      size: number;
      queryTime: number;
    };
  };
  timestamp: number;
}

export interface SyncJobStatsResponse {
  success: boolean;
  stats: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    successRate: number;
    avgDuration: number;
    byStatus: Record<string, number>;
  };
}

export interface DashboardDataResponse {
  success: boolean;
  data: {
    health: HealthCheckResponse;
    metrics: SystemMetricsResponse['metrics'];
    syncStats: SyncJobStatsResponse['stats'];
    recentAlerts: Array<{
      id: string;
      ruleId: string;
      severity: string;
      message: string;
      triggeredAt: number;
      status: string;
    }>;
    systemOverview: {
      documentsCount: number;
      collectionsCount: number;
      chunksCount: number;
      vectorsCount: number;
    };
  };
}

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  metricName: string;
  conditionOperator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  thresholdValue: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  isActive: boolean;
  cooldownMinutes: number;
  notificationChannels: string[];
  createdAt: number;
  updatedAt: number;
}

export interface NotificationChannel {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * 监控相关API
 */
export const monitoringApi = {
  /**
   * 获取系统健康状态
   */
  getHealthCheck: async (): Promise<HealthCheckResponse> => {
    return apiClient.get('/monitoring/health');
  },

  /**
   * 获取系统指标
   */
  getSystemMetrics: async (params?: {
    metricNames?: string[];
    timeRange?: string;
    interval?: string;
  }): Promise<SystemMetricsResponse> => {
    return apiClient.get('/monitoring/metrics', { params });
  },

  /**
   * 获取同步任务统计
   */
  getSyncJobStats: async (params?: {
    timeRange?: string;
    status?: string;
  }): Promise<SyncJobStatsResponse> => {
    return apiClient.get('/monitoring/sync-jobs/stats', { params });
  },

  /**
   * 获取仪表板数据
   */
  getDashboardData: async (params?: {
    timeRange?: string;
    includeSyncStats?: boolean;
    includeAlerts?: boolean;
  }): Promise<DashboardDataResponse> => {
    return apiClient.get('/monitoring/dashboard', { params });
  },

  /**
   * 获取告警规则列表
   */
  getAlertRules: async (): Promise<{ data: AlertRule[] }> => {
    return apiClient.get('/monitoring/alert-rules');
  },

  /**
   * 获取告警规则列表（支持分页）
   */
  getAlertRulesPaginated: async (
    params?: PaginationQueryParams & {
      activeOnly?: boolean;
      sort?: string;
      order?: 'asc' | 'desc';
    },
  ) => {
    return apiClient.get('/monitoring/alert-rules', { params });
  },

  /**
   * 获取告警历史
   */
  getAlertHistory: async (params?: {
    limit?: number;
    offset?: number;
    page?: number;
    ruleId?: string;
    timeRange?: string;
    severity?: string;
    status?: string;
  }) => {
    return apiClient.get('/monitoring/alerts/history', { params });
  },

  /**
   * 创建告警规则
   */
  createAlertRule: async (data: Partial<AlertRule>) => {
    return apiClient.post('/monitoring/alert-rules', data);
  },

  /**
   * 更新告警规则
   */
  updateAlertRule: async (id: string, data: Partial<AlertRule>) => {
    return apiClient.put(`/monitoring/alert-rules/${id}`, data);
  },

  /**
   * 删除告警规则
   */
  deleteAlertRule: async (id: string) => {
    return apiClient.delete(`/monitoring/alert-rules/${id}`);
  },

  /**
   * 获取通知渠道列表
   */
  getNotificationChannels: async (): Promise<{
    data: NotificationChannel[];
  }> => {
    return apiClient.get('/monitoring/notification-channels');
  },

  /**
   * 创建通知渠道
   */
  createNotificationChannel: async (data: Partial<NotificationChannel>) => {
    return apiClient.post('/monitoring/notification-channels', data);
  },

  /**
   * 更新通知渠道
   */
  updateNotificationChannel: async (
    id: string,
    data: Partial<NotificationChannel>,
  ) => {
    return apiClient.put(`/monitoring/notification-channels/${id}`, data);
  },

  /**
   * 删除通知渠道
   */
  deleteNotificationChannel: async (id: string) => {
    return apiClient.delete(`/monitoring/notification-channels/${id}`);
  },

  /**
   * 测试通知
   */
  testNotification: async (
    id: string,
    data: {
      message?: string;
      severity?: string;
    },
  ) => {
    return apiClient.post(`/monitoring/notification-channels/${id}/test`, data);
  },
};
