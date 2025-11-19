import { Router } from 'express';
import { MonitoringApiService } from '../../application/services/api/index.js';
import { IMonitoringApiService } from '@domain/repositories/IMonitoringApiService.js';
import { createMonitoringRoutes } from '../Monitoring.js';

/**
 * 创建监控路由的包装函数
 * @param monitoringApiService - 监控API服务实例
 * @returns 配置好的Express路由器实例
 */
export function createMonitoringApiRoutes(
  monitoringApiService: IMonitoringApiService | MonitoringApiService,
): Router {
  return createMonitoringRoutes(monitoringApiService);
}

// 重新导出监控路由创建函数以保持向后兼容性
export { createMonitoringRoutes };
