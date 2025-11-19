import { HealthStatus } from './IHealthCheckService.js';
import { MetricData } from './IMetricsService.js';

/**
 * 告警规则接口
 */
export interface AlertRule {
  id?: string;
  name: string;
  condition: string;
  threshold: number;
  enabled: boolean;
  metricName: string;
  conditionOperator: string;
  thresholdValue: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * 告警历史接口
 */
export interface AlertHistoryItem {
  id?: string;
  ruleId: string;
  ruleName: string;
  status: 'triggered' | 'resolved' | 'suppressed';
  severity: 'low' | 'medium' | 'high' | 'critical';
  metricValue: number;
  message?: string;
  triggeredAt: Date;
  resolvedAt?: Date;
}

/**
 * 告警历史查询选项
 */
export interface AlertHistoryOptions {
  startTime: Date;
  endTime: Date;
}

/**
 * 性能统计接口
 */
export interface PerformanceStats {
  average: number;
  min: number;
  max: number;
  p95: number;
  p99: number;
}

/**
 * 性能异常检测选项
 */
export interface AnomalyDetectionOptions {
  threshold: number;
  timeWindow: number;
}

/**
 * 性能异常接口
 */
export interface PerformanceAnomaly {
  value: number;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high';
}

/**
 * 仪表板数据接口
 */
export interface DashboardData {
  overallHealth: HealthStatus;
  components: Array<{
    component: string;
    status: HealthStatus;
    message?: string;
    lastCheck: Date;
    responseTimeMs?: number;
  }>;
  metrics: Record<string, number>;
  activeAlerts: AlertHistoryItem[];
}

/**
 * 系统概览接口
 */
export interface SystemOverview {
  healthStatus: HealthStatus;
  uptime: number;
  requestRate: number;
  errorRate: number;
  componentCount: number;
  healthyComponents: number;
  unhealthyComponents: number;
}

/**
 * 监控服务接口
 */
export interface IMonitoringService {
  /**
   * 创建告警规则
   */
  createAlertRule(rule: Omit<AlertRule, 'id'>): Promise<AlertRule>;

  /**
   * 更新告警规则
   */
  updateAlertRule(id: string, updates: Partial<AlertRule>): Promise<AlertRule>;

  /**
   * 删除告警规则
   */
  deleteAlertRule(id: string): Promise<void>;

  /**
   * 获取所有告警规则
   */
  getAllAlertRules(): Promise<AlertRule[]>;

  /**
   * 处理告警
   */
  processAlerts(): Promise<AlertHistoryItem[]>;

  /**
   * 解决告警
   */
  resolveAlert(
    id: string,
    options?: { message?: string },
  ): Promise<AlertHistoryItem>;

  /**
   * 获取告警历史
   */
  getAlertHistory(options: AlertHistoryOptions): Promise<AlertHistoryItem[]>;

  /**
   * 获取仪表板数据
   */
  getDashboardData(): Promise<DashboardData>;

  /**
   * 获取系统概览
   */
  getSystemOverview(): Promise<SystemOverview>;

  /**
   * 获取性能统计
   */
  getPerformanceStats(
    metricName: string,
    tags?: Record<string, string | number>,
  ): Promise<PerformanceStats>;

  /**
   * 检测性能异常
   */
  detectPerformanceAnomalies(
    metricName: string,
    options: AnomalyDetectionOptions,
  ): Promise<PerformanceAnomaly[]>;

  /**
   * 记录指标
   */
  recordMetric(
    metricName: string,
    value: number,
    unit?: string,
    tags?: Record<string, string | number>,
  ): void;
}
