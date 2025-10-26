/**
 * DAO模块导出文件
 * 导出所有数据访问对象相关的类型和类
 */

// 导出系统指标相关类型和类
export type { SystemMetric } from './SystemMetricsTable.js';
export { SystemMetricsTable } from './SystemMetricsTable.js';

// 导出告警规则相关类型和类
export type { AlertRule } from './AlertRulesTable.js';
export { AlertSeverity } from './AlertRulesTable.js';
export { AlertRulesTable } from './AlertRulesTable.js';

// 导出系统健康相关类型和类
export type { SystemHealth } from './SystemHealthTable.js';
export { HealthStatus } from './SystemHealthTable.js';
export { SystemHealthTable } from './SystemHealthTable.js';

// 导出同步作业相关类型和类
export { SyncJobsTable } from './SyncJobsTable.js';

// 导出告警历史相关类型和类
export type { AlertHistory } from './AlertHistoryTable.js';
export { AlertHistoryTable } from './AlertHistoryTable.js';
