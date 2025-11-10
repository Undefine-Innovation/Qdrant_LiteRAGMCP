import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { Logger } from '@logging/logger.js';
import {
  SystemMetric,
  HealthStatus,
  HealthStatusValues,
} from '@infrastructure/sqlite/dao/index.js';
import { SyncJobStatus } from '@domain/sync/types.js';
import { PersistentSyncStateMachine } from '../sync/index.js';

/**
 * 健康检查服务
 * 负责执行系统健康检查
 */
export class HealthCheckService {
  /**
   * 创建健康检查服务实例
   * @param sqliteRepo SQLite 仓库实例
   * @param syncStateMachine 持久化同步状态机实例
   * @param logger 日志记录器
   */
  constructor(
    private readonly sqliteRepo: ISQLiteRepo,
    private readonly syncStateMachine: PersistentSyncStateMachine,
    private readonly logger: Logger,
  ) {}

  /**
   * 执行系统健康检查
   */
  public async performHealthCheck(): Promise<void> {
    const startTime = Date.now();

    try {
      // 检查数据库连接
      await this.checkDatabaseHealth();

      // 检查Qdrant连接
      await this.checkQdrantHealth();

      // 检查同步状态机健康状况
      await this.checkSyncStateMachineHealth();

      // 检查系统资源
      await this.checkSystemResources();

      const duration = Date.now() - startTime;
      await this.recordMetric('health_check_duration_ms', duration, 'ms');
      this.logger.debug(`健康检查完成，耗时: ${duration}ms`);
    } catch (error) {
      this.logger.error(`健康检查失败: ${(error as Error).message}`, { error });
    }
  }

  /**
   * 检查数据库健康状况
   */
  private async checkDatabaseHealth(): Promise<void> {
    const startTime = Date.now();
    let status = HealthStatusValues.HEALTHY;
    let errorMessage: string | undefined;

    try {
      const isHealthy = this.sqliteRepo.collections.ping();
      if (!isHealthy) {
        status = HealthStatusValues.UNHEALTHY;
        errorMessage = '数据库连接失败';
      }
    } catch (error) {
      status = HealthStatusValues.UNHEALTHY;
      errorMessage = (error as Error).message;
    }

    const responseTime = Date.now() - startTime;

    await this.sqliteRepo.systemHealth.upsert({
      component: 'database',
      status,
      lastCheck: Date.now(),
      responseTimeMs: responseTime,
      errorMessage,
      details: {
        connectionTest: status === HealthStatusValues.HEALTHY,
      },
    });

    await this.recordMetric('database_response_time_ms', responseTime, 'ms');
    await this.recordMetric(
      'database_health_status',
      status === HealthStatusValues.HEALTHY ? 1 : 0,
      'boolean',
    );
  }

  /**
   * 检查Qdrant健康状况
   */
  private async checkQdrantHealth(): Promise<void> {
    const startTime = Date.now();
    let status = HealthStatusValues.HEALTHY;
    let errorMessage: string | undefined;

    try {
      // 这里应该实现实际的Qdrant健康检查
      // 暂时模拟检查
      const isHealthy = await this.checkQdrantConnection();
      if (!isHealthy) {
        status = HealthStatusValues.UNHEALTHY;
        errorMessage = 'Qdrant连接失败';
      }
    } catch (error) {
      status = HealthStatusValues.UNHEALTHY;
      errorMessage = (error as Error).message;
    }

    const responseTime = Date.now() - startTime;

    await this.sqliteRepo.systemHealth.upsert({
      component: 'qdrant',
      status,
      lastCheck: Date.now(),
      responseTimeMs: responseTime,
      errorMessage,
      details: {
        connectionTest: status === HealthStatusValues.HEALTHY,
      },
    });

    await this.recordMetric('qdrant_response_time_ms', responseTime, 'ms');
    await this.recordMetric(
      'qdrant_health_status',
      status === HealthStatusValues.HEALTHY ? 1 : 0,
      'boolean',
    );
  }

  /**
   * 检查Qdrant连接（模拟实现）
   * @returns Qdrant连接状态
   */
  private async checkQdrantConnection(): Promise<boolean> {
    // 这里应该实现实际的Qdrant健康检查
    // 暂时返回true
    return true;
  }

  /**
   * 检查同步状态机健康状况
   */
  private async checkSyncStateMachineHealth(): Promise<void> {
    const startTime = Date.now();
    let status = HealthStatusValues.HEALTHY;
    let errorMessage: string | undefined;

    try {
      // 使用现有的方法获取统计信息
      const allJobs = this.syncStateMachine.getAllSyncJobs();
      const stats = {
        total: allJobs.length,
        successRate:
          allJobs.filter((job) => job.status === SyncJobStatus.SYNCED).length /
          Math.max(allJobs.length, 1),
        avgDuration: 0, // SyncJob接口没有durationMs字段，暂时设为0
        byStatus: allJobs.reduce(
          (acc, job) => {
            acc[job.status] = (acc[job.status] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ),
      };
      const activeRetryCount = this.syncStateMachine.getSyncJobCountByStatus(
        SyncJobStatus.RETRYING,
      );

      // 如果失败率过高，标记为降级
      if (stats.total > 0 && stats.successRate < 0.8) {
        status = HealthStatusValues.DEGRADED;
        errorMessage = `同步成功率过低: ${(stats.successRate * 100).toFixed(2)}%`;
      }

      // 如果活跃重试任务过多，标记为降级
      if (activeRetryCount > 10) {
        status = HealthStatusValues.DEGRADED;
        errorMessage = `活跃重试任务过多: ${activeRetryCount}`;
      }

      const details = {
        totalJobs: stats.total,
        successRate: stats.successRate,
        averageDuration: stats.avgDuration,
        activeRetryTasks: activeRetryCount,
        jobsByStatus: stats.byStatus,
      };

      await this.sqliteRepo.systemHealth.upsert({
        component: 'sync_state_machine',
        status,
        lastCheck: Date.now(),
        responseTimeMs: Date.now() - startTime,
        errorMessage,
        details,
      });

      // 记录相关指标
      await this.recordMetric('sync_total_jobs', stats.total, 'count');
      await this.recordMetric('sync_success_rate', stats.successRate, 'ratio');
      await this.recordMetric(
        'sync_average_duration_ms',
        stats.avgDuration,
        'ms',
      );
      await this.recordMetric(
        'sync_active_retry_tasks',
        activeRetryCount,
        'count',
      );
    } catch (error) {
      status = HealthStatusValues.UNHEALTHY;
      errorMessage = (error as Error).message;

      await this.sqliteRepo.systemHealth.upsert({
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
    let status = HealthStatusValues.HEALTHY;
    let errorMessage: string | undefined;

    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      // 检查内存使用情况
      const totalMemory = memUsage.heapTotal;
      const usedMemory = memUsage.heapUsed;
      const memoryUsageRatio = usedMemory / totalMemory;

      if (memoryUsageRatio > 0.9) {
        status = HealthStatusValues.UNHEALTHY;
        errorMessage = `内存使用率过高: ${(memoryUsageRatio * 100).toFixed(2)}%`;
      } else if (memoryUsageRatio > 0.8) {
        status = HealthStatusValues.DEGRADED;
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

      await this.sqliteRepo.systemHealth.upsert({
        component: 'system_resources',
        status,
        lastCheck: Date.now(),
        responseTimeMs: Date.now() - startTime,
        errorMessage,
        details,
      });

      // 记录资源指标
      await this.recordMetric(
        'memory_heap_used_mb',
        usedMemory / 1024 / 1024,
        'MB',
      );
      await this.recordMetric(
        'memory_heap_total_mb',
        totalMemory / 1024 / 1024,
        'MB',
      );
      await this.recordMetric('memory_usage_ratio', memoryUsageRatio, 'ratio');
      await this.recordMetric(
        'process_uptime_seconds',
        process.uptime(),
        'seconds',
      );
    } catch (error) {
      status = HealthStatusValues.UNHEALTHY;
      errorMessage = (error as Error).message;

      await this.sqliteRepo.systemHealth.upsert({
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
   * @param metricName
   * @param value
   * @param unit
   * @param tags
   */
  private async recordMetric(
    metricName: string,
    value: number,
    unit?: string,
    tags?: Record<string, string | number>,
  ): Promise<void> {
    try {
      const metric: SystemMetric = {
        id: '', // 将在创建时生成
        metricName,
        metricValue: value,
        metricUnit: unit,
        tags,
        timestamp: Date.now(),
        createdAt: Date.now(),
      };

      await this.sqliteRepo.systemMetrics.create(metric);
    } catch (error) {
      this.logger.error(`记录指标失败: ${metricName}`, { error });
      // 不抛出异常，以避免健康检查因指标记录失败而中断
    }
  }

  /**
   * 停止健康检查服务
   */
  public stop(): void {
    // 清理资源
    this.logger.info('HealthCheckService 已停止');
  }
}
