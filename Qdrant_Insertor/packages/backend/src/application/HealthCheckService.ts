import { SQLiteRepo } from '../infrastructure/SQLiteRepo.js';
import { Logger } from '../logger.js';
import {
  SystemMetric,
  HealthStatus,
} from '../infrastructure/sqlite/dao/index.js';
import { PersistentSyncStateMachine } from './PersistentSyncStateMachine.js';

/**
 * 健康检查服务
 * 负责执行系统健康检查
 */
export class HealthCheckService {
  constructor(
    private readonly sqliteRepo: SQLiteRepo,
    private readonly syncStateMachine: PersistentSyncStateMachine,
    private readonly logger: Logger,
  ) {}

  /**
   * 执行系统健康检查
   */
  public async performHealthCheck(): Promise<void> {
    const startTime = Date.now();

    // 检查数据库连接
    await this.checkDatabaseHealth();

    // 检查Qdrant连接
    await this.checkQdrantHealth();

    // 检查同步状态机健康状态
    await this.checkSyncStateMachineHealth();

    // 检查系统资源
    await this.checkSystemResources();

    const duration = Date.now() - startTime;
    this.recordMetric('health_check_duration_ms', duration, 'ms');
    this.logger.debug(`健康检查完成，耗时: ${duration}ms`);
  }

  /**
   * 检查数据库健康状态
   */
  private async checkDatabaseHealth(): Promise<void> {
    const startTime = Date.now();
    let status = HealthStatus.HEALTHY;
    let errorMessage: string | undefined;

    try {
      const isHealthy = this.sqliteRepo.collections.ping();
      if (!isHealthy) {
        status = HealthStatus.UNHEALTHY;
        errorMessage = '数据库连接失败';
      }
    } catch (error) {
      status = HealthStatus.UNHEALTHY;
      errorMessage = (error as Error).message;
    }

    const responseTime = Date.now() - startTime;

    this.sqliteRepo.systemHealth.upsert({
      component: 'database',
      status,
      lastCheck: Date.now(),
      responseTimeMs: responseTime,
      errorMessage,
      details: {
        connectionTest: status === HealthStatus.HEALTHY,
      },
    });

    this.recordMetric('database_response_time_ms', responseTime, 'ms');
    this.recordMetric(
      'database_health_status',
      status === HealthStatus.HEALTHY ? 1 : 0,
      'boolean',
    );
  }

  /**
   * 检查Qdrant健康状态
   */
  private async checkQdrantHealth(): Promise<void> {
    const startTime = Date.now();
    let status = HealthStatus.HEALTHY;
    let errorMessage: string | undefined;

    try {
      // 这里应该实现实际的Qdrant健康检查
      // 暂时模拟检查
      const isHealthy = await this.checkQdrantConnection();
      if (!isHealthy) {
        status = HealthStatus.UNHEALTHY;
        errorMessage = 'Qdrant连接失败';
      }
    } catch (error) {
      status = HealthStatus.UNHEALTHY;
      errorMessage = (error as Error).message;
    }

    const responseTime = Date.now() - startTime;

    this.sqliteRepo.systemHealth.upsert({
      component: 'qdrant',
      status,
      lastCheck: Date.now(),
      responseTimeMs: responseTime,
      errorMessage,
      details: {
        connectionTest: status === HealthStatus.HEALTHY,
      },
    });

    this.recordMetric('qdrant_response_time_ms', responseTime, 'ms');
    this.recordMetric(
      'qdrant_health_status',
      status === HealthStatus.HEALTHY ? 1 : 0,
      'boolean',
    );
  }

  /**
   * 检查Qdrant连接（模拟实现）
   */
  private async checkQdrantConnection(): Promise<boolean> {
    // 这里应该实现实际的Qdrant健康检查
    // 暂时返回true
    return true;
  }

  /**
   * 检查同步状态机健康状态
   */
  private async checkSyncStateMachineHealth(): Promise<void> {
    const startTime = Date.now();
    let status = HealthStatus.HEALTHY;
    let errorMessage: string | undefined;

    try {
      const stats = this.syncStateMachine.getSyncJobStats();
      const activeRetryCount = this.syncStateMachine.getActiveRetryTaskCount();

      // 如果失败率过高，标记为降级
      if (stats.total > 0 && stats.successRate < 0.8) {
        status = HealthStatus.DEGRADED;
        errorMessage = `同步成功率过低: ${(stats.successRate * 100).toFixed(2)}%`;
      }

      // 如果活跃重试任务过多，标记为降级
      if (activeRetryCount > 10) {
        status = HealthStatus.DEGRADED;
        errorMessage = `活跃重试任务过多: ${activeRetryCount}`;
      }

      const details = {
        totalJobs: stats.total,
        successRate: stats.successRate,
        averageDuration: stats.avgDuration,
        activeRetryTasks: activeRetryCount,
        jobsByStatus: stats.byStatus,
      };

      this.sqliteRepo.systemHealth.upsert({
        component: 'sync_state_machine',
        status,
        lastCheck: Date.now(),
        responseTimeMs: Date.now() - startTime,
        errorMessage,
        details,
      });

      // 记录相关指标
      this.recordMetric('sync_total_jobs', stats.total, 'count');
      this.recordMetric('sync_success_rate', stats.successRate, 'ratio');
      this.recordMetric('sync_average_duration_ms', stats.avgDuration, 'ms');
      this.recordMetric('sync_active_retry_tasks', activeRetryCount, 'count');
    } catch (error) {
      status = HealthStatus.UNHEALTHY;
      errorMessage = (error as Error).message;

      this.sqliteRepo.systemHealth.upsert({
        component: 'sync_state_machine',
        status,
        lastCheck: Date.now(),
        responseTimeMs: Date.now() - startTime,
        errorMessage,
      });
    }
  }

  /**
   * 检查系统资源
   */
  private async checkSystemResources(): Promise<void> {
    const startTime = Date.now();
    let status = HealthStatus.HEALTHY;
    let errorMessage: string | undefined;

    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      // 检查内存使用情况
      const totalMemory = memUsage.heapTotal;
      const usedMemory = memUsage.heapUsed;
      const memoryUsageRatio = usedMemory / totalMemory;

      if (memoryUsageRatio > 0.9) {
        status = HealthStatus.UNHEALTHY;
        errorMessage = `内存使用率过高: ${(memoryUsageRatio * 100).toFixed(2)}%`;
      } else if (memoryUsageRatio > 0.8) {
        status = HealthStatus.DEGRADED;
        errorMessage = `内存使用率较高: ${(memoryUsageRatio * 100).toFixed(2)}%`;
      }

      const details = {
        memory: {
          rss: memUsage.rss,
          heapTotal: memUsage.heapTotal,
          heapUsed: memUsage.heapUsed,
          external: memUsage.external,
          arrayBuffers: memUsage.arrayBuffers,
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
        uptime: process.uptime(),
      };

      this.sqliteRepo.systemHealth.upsert({
        component: 'system_resources',
        status,
        lastCheck: Date.now(),
        responseTimeMs: Date.now() - startTime,
        errorMessage,
        details,
      });

      // 记录资源指标
      this.recordMetric('memory_heap_used_mb', usedMemory / 1024 / 1024, 'MB');
      this.recordMetric(
        'memory_heap_total_mb',
        totalMemory / 1024 / 1024,
        'MB',
      );
      this.recordMetric('memory_usage_ratio', memoryUsageRatio, 'ratio');
      this.recordMetric('process_uptime_seconds', process.uptime(), 'seconds');
    } catch (error) {
      status = HealthStatus.UNHEALTHY;
      errorMessage = (error as Error).message;

      this.sqliteRepo.systemHealth.upsert({
        component: 'system_resources',
        status,
        lastCheck: Date.now(),
        responseTimeMs: Date.now() - startTime,
        errorMessage,
      });
    }
  }

  /**
   * 记录系统指标
   */
  private recordMetric(
    metricName: string,
    value: number,
    unit?: string,
    tags?: Record<string, string | number>,
  ): void {
    const metric: SystemMetric = {
      id: '', // 将在创建时生成
      metricName,
      metricValue: value,
      metricUnit: unit,
      tags,
      timestamp: Date.now(),
      createdAt: Date.now(),
    };

    this.sqliteRepo.systemMetrics.create(metric);
  }

  /**
   * 停止健康检查服务
   */
  public stop(): void {
    // 清理资源
    this.logger.info('HealthCheckService 已停止');
  }
}
