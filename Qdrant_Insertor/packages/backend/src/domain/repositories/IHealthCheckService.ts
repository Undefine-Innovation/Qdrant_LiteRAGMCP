import { Logger } from '@logging/logger.js';

/**
 * 健康状态值类型
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

/**
 * 健康状态值常量
 */
export const HealthStatusValues = {
  HEALTHY: 'healthy' as const,
  DEGRADED: 'degraded' as const,
  UNHEALTHY: 'unhealthy' as const,
  UNKNOWN: 'unknown' as const,
} as const;

/**
 * 组件健康状态
 */
export interface ComponentHealth {
  component: string;
  status: HealthStatus;
  message?: string;
  lastCheck: Date;
  responseTimeMs?: number;
  details?: Record<string, unknown>;
}

/**
 * 系统健康状态
 */
export interface SystemHealthStatus {
  overall: HealthStatus;
  components: ComponentHealth[];
}

/**
 * 健康检查服务接口
 */
export interface IHealthCheckService {
  /**
   * 执行系统健康检查
   */
  performHealthCheck(): Promise<void>;

  /**
   * 获取系统整体健康状态
   */
  getSystemHealth(): Promise<SystemHealthStatus>;

  /**
   * 更新组件健康状态
   */
  updateComponentHealth(
    component: string,
    status: {
      status: HealthStatus;
      message?: string;
      details?: Record<string, unknown>;
    },
  ): Promise<void>;

  /**
   * 检查特定组件健康状态
   */
  checkComponent(component: string): Promise<ComponentHealth | null>;

  /**
   * 停止健康检查服务
   */
  stop(): void;
}
