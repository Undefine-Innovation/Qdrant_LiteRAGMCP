import { z } from 'zod';

// 健康检查相关
export const HealthCheckRequestSchema = z.object({
  component: z.string().optional(),
});

export const HealthCheckResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.string(),
  components: z.record(
    z.object({
      status: z.enum(['healthy', 'degraded', 'unhealthy']),
      lastCheck: z.string(),
      message: z.string().optional(),
      responseTime: z.number().optional(),
    }),
  ),
  overallHealth: z.enum(['healthy', 'degraded', 'unhealthy']),
});

// 同步作业统计相关
export const SyncJobStatsRequestSchema = z.object({
  timeRange: z.enum(['1h', '6h', '24h', '7d', '30d']).optional().default('24h'),
  status: z
    .enum([
      'new',
      'split_ok',
      'embed_ok',
      'synced',
      'failed',
      'retrying',
      'dead',
    ])
    .optional(),
  collectionId: z.string().optional(),
});

export const SyncJobStatsResponseSchema = z.object({
  timeRange: z.string(),
  totalJobs: z.number(),
  statusBreakdown: z.record(z.number()),
  successRate: z.number(),
  averageProcessingTime: z.number(),
  recentJobs: z.array(
    z.object({
      id: z.string(),
      docId: z.string(),
      status: z.string(),
      createdAt: z.string(),
      updatedAt: z.string(),
      processingTime: z.number().optional(),
    }),
  ),
});

// 系统指标相关
export const SystemMetricsRequestSchema = z.object({
  metricName: z.string().optional(),
  timeRange: z.enum(['1h', '6h', '24h', '7d', '30d']).optional().default('24h'),
  aggregation: z
    .enum(['avg', 'min', 'max', 'sum', 'count'])
    .optional()
    .default('avg'),
  component: z.string().optional(),
});

export const SystemMetricsResponseSchema = z.object({
  timeRange: z.string(),
  metrics: z.array(
    z.object({
      name: z.string(),
      value: z.number(),
      unit: z.string(),
      timestamp: z.string(),
      component: z.string(),
    }),
  ),
  aggregations: z.record(z.number()),
});

// 告警规则相关
export const CreateAlertRuleRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  metricName: z.string().min(1),
  condition: z.enum(['gt', 'lt', 'eq', 'gte', 'lte', 'ne']),
  threshold: z.number(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  enabled: z.boolean().default(true),
  cooldownMinutes: z.number().min(1).default(5),
  notificationChannels: z.array(z.string()).optional(),
});

export const AlertRuleResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  metricName: z.string(),
  condition: z.string(),
  threshold: z.number(),
  severity: z.string(),
  enabled: z.boolean(),
  cooldownMinutes: z.number(),
  notificationChannels: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastTriggered: z.string().optional(),
});

export const UpdateAlertRuleRequestSchema =
  CreateAlertRuleRequestSchema.partial();

// 告警历史相关
export const AlertHistoryRequestSchema = z.object({
  timeRange: z.enum(['1h', '6h', '24h', '7d', '30d']).optional().default('24h'),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['active', 'resolved', 'suppressed']).optional(),
  ruleId: z.string().optional(),
  limit: z.number().min(1).max(1000).optional().default(100),
  offset: z.number().min(0).optional().default(0),
});

export const AlertHistoryResponseSchema = z.object({
  alerts: z.array(
    z.object({
      id: z.string(),
      ruleId: z.string(),
      ruleName: z.string(),
      severity: z.string(),
      status: z.string(),
      message: z.string(),
      triggeredAt: z.string(),
      resolvedAt: z.string().optional(),
      acknowledgedAt: z.string().optional(),
      acknowledgedBy: z.string().optional(),
      metricValue: z.number(),
      threshold: z.number(),
    }),
  ),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

// 仪表板数据相关
export const DashboardDataRequestSchema = z.object({
  timeRange: z.enum(['1h', '6h', '24h', '7d', '30d']).optional().default('24h'),
});

export const DashboardDataResponseSchema = z.object({
  overview: z.object({
    totalSyncJobs: z.number(),
    activeSyncJobs: z.number(),
    successRate: z.number(),
    averageProcessingTime: z.number(),
    totalAlerts: z.number(),
    activeAlerts: z.number(),
  }),
  systemHealth: z.object({
    status: z.string(),
    components: z.record(
      z.object({
        status: z.string(),
        lastCheck: z.string(),
      }),
    ),
  }),
  recentAlerts: z.array(
    z.object({
      id: z.string(),
      severity: z.string(),
      message: z.string(),
      triggeredAt: z.string(),
    }),
  ),
  syncJobTrends: z.array(
    z.object({
      timestamp: z.string(),
      count: z.number(),
      successRate: z.number(),
    }),
  ),
  topMetrics: z.array(
    z.object({
      name: z.string(),
      value: z.number(),
      unit: z.string(),
      trend: z.enum(['up', 'down', 'stable']),
    }),
  ),
});

// 通知渠道相关
export const CreateNotificationChannelRequestSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['log', 'webhook', 'email', 'slack']),
  config: z.record(z.any()),
  enabled: z.boolean().default(true),
});

export const NotificationChannelResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  config: z.record(z.any()),
  enabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastUsed: z.string().optional(),
});

export const UpdateNotificationChannelRequestSchema =
  CreateNotificationChannelRequestSchema.partial();

// 测试通知相关
export const TestNotificationRequestSchema = z.object({
  channelId: z.string(),
  message: z
    .string()
    .optional()
    .default('Test notification from monitoring system'),
  severity: z
    .enum(['low', 'medium', 'high', 'critical'])
    .optional()
    .default('medium'),
});

export const TestNotificationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  timestamp: z.string(),
});

// 导出类型
export type HealthCheckRequest = z.infer<typeof HealthCheckRequestSchema>;
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;
export type SyncJobStatsRequest = z.infer<typeof SyncJobStatsRequestSchema>;
export type SyncJobStatsResponse = z.infer<typeof SyncJobStatsResponseSchema>;
export type SystemMetricsRequest = z.infer<typeof SystemMetricsRequestSchema>;
export type SystemMetricsResponse = z.infer<typeof SystemMetricsResponseSchema>;
export type CreateAlertRuleRequest = z.infer<
  typeof CreateAlertRuleRequestSchema
>;
export type AlertRuleResponse = z.infer<typeof AlertRuleResponseSchema>;
export type UpdateAlertRuleRequest = z.infer<
  typeof UpdateAlertRuleRequestSchema
>;
export type AlertHistoryRequest = z.infer<typeof AlertHistoryRequestSchema>;
export type AlertHistoryResponse = z.infer<typeof AlertHistoryResponseSchema>;
export type DashboardDataRequest = z.infer<typeof DashboardDataRequestSchema>;
export type DashboardDataResponse = z.infer<typeof DashboardDataResponseSchema>;
export type CreateNotificationChannelRequest = z.infer<
  typeof CreateNotificationChannelRequestSchema
>;
export type NotificationChannelResponse = z.infer<
  typeof NotificationChannelResponseSchema
>;
export type UpdateNotificationChannelRequest = z.infer<
  typeof UpdateNotificationChannelRequestSchema
>;
export type TestNotificationRequest = z.infer<
  typeof TestNotificationRequestSchema
>;
export type TestNotificationResponse = z.infer<
  typeof TestNotificationResponseSchema
>;
