/**
 * SQLite DAO 索引文件
 * 注意：此文件仅用于兼容性，所有DAO类已迁移到TypeORM
 */

/**
 * 健康状态类型
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * 健康状态值常量（用于运行时值检查）
 */
export const HealthStatusValues = {
  HEALTHY: 'healthy' as HealthStatus,
  DEGRADED: 'degraded' as HealthStatus,
  UNHEALTHY: 'unhealthy' as HealthStatus,
};

/**
 * 告警规则类型
 */
export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  enabled: boolean;
  notificationChannels: string[];
  createdAt?: number;
  updatedAt?: number;
  // 扩展属性
  description?: string;
  metricName: string;
  conditionOperator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  thresholdValue: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cooldownMinutes: number;
  isActive?: boolean;
}

/**
 * 告警历史类型
 */
export interface AlertHistory {
  id: string;
  ruleId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  triggeredAt: number;
  resolvedAt?: number;
  status: 'active' | 'resolved' | 'suppressed' | 'triggered';
  createdAt?: number;
  updatedAt?: number;
  // 扩展属性
  metricValue: number;
  thresholdValue: number;
}

/**
 * 系统指标类型
 */
export interface SystemMetric {
  id: string;
  // 主字段（新的命名方式）
  metricName?: string;
  metricValue?: number;
  metricUnit?: string;
  // 备选字段（旧的命名方式）
  name?: string;
  value?: number;
  tags?: Record<string, string | number>;
  timestamp: number;
  createdAt?: number;
  updatedAt?: number;
}

/**
 * 系统健康类型
 */
export interface SystemHealth {
  id: string;
  status: HealthStatus;
  component?: string;
  lastCheck: number;
  responseTimeMs?: number;
  errorMessage?: string;
  details?: Record<string, unknown>;
  components?: Record<string, unknown>;
  createdAt?: number;
  updatedAt?: number;
}

/**
 * 告警严重程度枚举
 */
export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}
