/**
 * 监控服务接口
 * @description 定义系统监控的核心业务接口，遵循依赖倒置原则
 */

/**
 * 系统健康状态
 */
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    database: 'up' | 'down';
    qdrant: 'up' | 'down';
    embedding: 'up' | 'down';
  };
  lastCheck: Date;
  uptime: number;
}

/**
 * 系统指标
 */
export interface SystemMetrics {
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
  qdrant: {
    collections: number;
    points: number;
    responseTime: number;
  };
  timestamp: Date;
}

/**
 * 性能统计
 */
export interface PerformanceStats {
  requestCount: number;
  averageResponseTime: number;
  errorRate: number;
  throughput: number;
  period: {
    start: Date;
    end: Date;
  };
}

/**
 * 监控服务接口
 * @description 应用层应该依赖此接口而不是具体实现
 */
export interface IMonitoringService {
  /**
   * 获取系统健康状态
   * @returns 系统健康状态
   */
  getHealth(): Promise<SystemHealth>;

  /**
   * 获取系统指标
   * @param timeRange 时间范围（分钟）
   * @returns 系统指标数据
   */
  getMetrics(timeRange?: number): Promise<SystemMetrics[]>;

  /**
   * 获取性能统计
   * @param timeRange 时间范围（分钟）
   * @returns 性能统计数据
   */
  getPerformanceStats(timeRange?: number): Promise<PerformanceStats>;

  /**
   * 记录指标数据
   * @param metrics 指标数据
   */
  recordMetrics(metrics: Partial<SystemMetrics>): Promise<void>;

  /**
   * 启动监控
   */
  start(): Promise<void>;

  /**
   * 停止监控
   */
  stop(): Promise<void>;

  /**
   * 执行健康检查
   * @returns 健康检查结果
   */
  performHealthCheck(): Promise<SystemHealth>;

  /**
   * 获取服务状态
   * @param serviceName 服务名称
   * @returns 服务状态
   */
  getServiceStatus(serviceName: string): Promise<'up' | 'down'>;
}