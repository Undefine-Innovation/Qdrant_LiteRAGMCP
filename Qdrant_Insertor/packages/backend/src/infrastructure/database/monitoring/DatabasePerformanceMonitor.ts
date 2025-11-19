import { Logger } from '@logging/logger.js';
import {
  IDatabaseRepository,
  DatabaseType,
  DatabasePerformanceMetrics,
  DatabaseHealthStatus,
} from '@domain/interfaces/IDatabaseRepository.js';

/**
 * 数据库性能指标接口
 */
export interface PerformanceMetrics {
  databaseType: DatabaseType;
  connectionTime: number;
  queryTime: number;
  transactionTime: number;
  memoryUsage: number;
  diskUsage: number;
  indexUsage: number;
  cacheHitRate: number;
  slowQueryCount: number;
  totalQueries: number;
  activeConnections: number;
  idleConnections: number;
  waitingClients: number;
}

/**
 * 性能对比结果接口
 */
export interface PerformanceComparison {
  timestamp: number;
  databases: {
    [key: string]: PerformanceMetrics;
  };
  recommendations: string[];
}

/**
 * 性能阈值配置接口
 */
export interface PerformanceThresholds {
  slowQueryThreshold: number; // 慢查询阈值（毫秒）
  connectionTimeThreshold: number; // 连接时间阈值（毫秒）
  memoryUsageThreshold: number; // 内存使用阈值（字节）
  diskUsageThreshold: number; // 磁盘使用阈值（字节）
  cacheHitRateThreshold: number; // 缓存命中率阈值（0-1）
  activeConnectionsThreshold: number; // 活跃连接数阈值
}

/**
 * 数据库性能监控器
 * 负责监控数据库性能并提供对比分析
 */
export class DatabasePerformanceMonitor {
  private metricsHistory: PerformanceComparison[] = [];
  private readonly maxHistorySize = 100; // 保留最近100次记录
  private thresholds: PerformanceThresholds;

  /**
   * 默认性能阈值
   */
  private readonly defaultThresholds: PerformanceThresholds = {
    slowQueryThreshold: 1000, // 1秒
    connectionTimeThreshold: 5000, // 5秒
    memoryUsageThreshold: 1024 * 1024 * 1024, // 1GB
    diskUsageThreshold: 1024 * 1024 * 1024 * 10, // 10GB
    cacheHitRateThreshold: 0.8, // 80%
    activeConnectionsThreshold: 80, // 80个连接
  };

  /**
   * 创建数据库性能监控器实例
   * @param repositories 数据库仓库映射
   * @param logger 日志记录器
   * @param thresholds 自定义性能阈值
   */
  constructor(
    private readonly repositories: Map<string, IDatabaseRepository>,
    private readonly logger: Logger,
    thresholds: PerformanceThresholds = {
      slowQueryThreshold: 1000,
      connectionTimeThreshold: 5000,
      memoryUsageThreshold: 100 * 1024 * 1024, // 100MB
      diskUsageThreshold: 1024 * 1024 * 1024, // 1GB
      cacheHitRateThreshold: 0.8,
      activeConnectionsThreshold: 80,
    },
  ) {
    // 合并默认阈值和自定义阈值
    this.thresholds = { ...this.defaultThresholds, ...thresholds };
  }

  /**
   * 收集所有数据库的性能指标
   * @returns 性能指标映射
   */
  async collectAllMetrics(): Promise<Map<string, PerformanceMetrics>> {
    const metrics = new Map<string, PerformanceMetrics>();

    for (const [name, repository] of this.repositories.entries()) {
      try {
        const perfMetrics = await repository.getPerformanceMetrics();
        const healthStatus = await repository.getHealthStatus();

        const performanceMetrics: PerformanceMetrics = {
          databaseType: perfMetrics.databaseType,
          connectionTime: perfMetrics.connectionTime,
          queryTime: perfMetrics.queryTime,
          transactionTime: perfMetrics.transactionTime,
          memoryUsage: perfMetrics.memoryUsage || 0,
          diskUsage: perfMetrics.diskUsage || 0,
          indexUsage: perfMetrics.indexUsage || 0,
          cacheHitRate: perfMetrics.cacheHitRate || 0,
          slowQueryCount: healthStatus.performanceMetrics?.slowQueryCount || 0,
          totalQueries: healthStatus.performanceMetrics?.totalQueries || 0,
          activeConnections:
            healthStatus.connectionPool?.activeConnections || 0,
          idleConnections: healthStatus.connectionPool?.idleConnections || 0,
          waitingClients: healthStatus.connectionPool?.waitingClients || 0,
        };

        metrics.set(name, performanceMetrics);
      } catch (error) {
        this.logger.error(`收集数据库 ${name} 性能指标失败`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return metrics;
  }

  /**
   * 分析性能并生成建议
   * @param metrics 性能指标
   * @returns 分析结果和建议
   */
  analyzePerformance(metrics: PerformanceMetrics): {
    issues: string[];
    recommendations: string[];
    score: number; // 0-100分
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // 检查查询性能
    if (metrics.queryTime > this.thresholds.slowQueryThreshold) {
      issues.push(`平均查询时间过长: ${metrics.queryTime}ms`);
      recommendations.push('优化慢查询，考虑添加索引或重写查询');
      score -= 20;
    }

    // 检查连接性能
    if (metrics.connectionTime > this.thresholds.connectionTimeThreshold) {
      issues.push(`数据库连接时间过长: ${metrics.connectionTime}ms`);
      recommendations.push('检查网络连接和数据库服务器性能');
      score -= 15;
    }

    // 检查内存使用
    if (metrics.memoryUsage > this.thresholds.memoryUsageThreshold) {
      issues.push(
        `内存使用过高: ${Math.round(metrics.memoryUsage / 1024 / 1024)}MB`,
      );
      recommendations.push('考虑增加服务器内存或优化内存使用');
      score -= 15;
    }

    // 检查磁盘使用
    if (metrics.diskUsage > this.thresholds.diskUsageThreshold) {
      issues.push(
        `磁盘使用过高: ${Math.round(metrics.diskUsage / 1024 / 1024 / 1024)}GB`,
      );
      recommendations.push('清理旧数据或增加存储空间');
      score -= 10;
    }

    // 检查缓存命中率
    if (metrics.cacheHitRate < this.thresholds.cacheHitRateThreshold) {
      issues.push(`缓存命中率过低: ${Math.round(metrics.cacheHitRate * 100)}%`);
      recommendations.push('调整缓存配置或增加缓存大小');
      score -= 10;
    }

    // 检查连接数
    if (
      metrics.activeConnections > this.thresholds.activeConnectionsThreshold
    ) {
      issues.push(`活跃连接数过多: ${metrics.activeConnections}`);
      recommendations.push('优化连接池配置或增加连接池大小');
      score -= 10;
    }

    // 检查慢查询数量
    if (metrics.slowQueryCount > 0) {
      issues.push(`存在 ${metrics.slowQueryCount} 个慢查询`);
      recommendations.push('分析并优化慢查询');
      score -= Math.min(metrics.slowQueryCount * 2, 20);
    }

    return {
      issues,
      recommendations,
      score: Math.max(0, score),
    };
  }

  /**
   * 对比不同数据库的性能
   * @returns 性能对比结果
   */
  async comparePerformance(): Promise<PerformanceComparison> {
    const metrics = await this.collectAllMetrics();
    const recommendations: string[] = [];

    // 分析每个数据库的性能
    const analysisResults = new Map<
      string,
      ReturnType<typeof this.analyzePerformance>
    >();

    for (const [name, perfMetrics] of metrics.entries()) {
      const analysis = this.analyzePerformance(perfMetrics);
      analysisResults.set(name, analysis);

      // 收集所有建议
      recommendations.push(...analysis.recommendations);
    }

    // 去重建议
    const uniqueRecommendations = [...new Set(recommendations)];

    // 创建对比结果
    const comparison: PerformanceComparison = {
      timestamp: Date.now(),
      databases: {},
      recommendations: uniqueRecommendations,
    };

    for (const [name, perfMetrics] of metrics.entries()) {
      comparison.databases[name] = perfMetrics;
    }

    // 保存到历史记录
    this.metricsHistory.push(comparison);
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift(); // 移除最旧的记录
    }

    this.logger.info('性能对比完成', {
      databases: Object.keys(metrics),
      recommendations: uniqueRecommendations.length,
    });

    return comparison;
  }

  /**
   * 获取性能历史记录
   * @param limit 限制返回数量
   * @returns 性能历史记录
   */
  getPerformanceHistory(limit: number = 10): PerformanceComparison[] {
    return this.metricsHistory.slice(-limit);
  }

  /**
   * 生成性能报告
   * @returns 性能报告
   */
  async generatePerformanceReport(): Promise<{
    timestamp: number;
    summary: {
      totalDatabases: number;
      healthyDatabases: number;
      averageScore: number;
      criticalIssues: number;
    };
    databases: {
      [key: string]: {
        metrics: PerformanceMetrics;
        analysis: ReturnType<
          typeof DatabasePerformanceMonitor.prototype.analyzePerformance
        >;
        status: 'healthy' | 'warning' | 'critical';
      };
    };
    recommendations: string[];
    trends: {
      [key: string]: {
        queryTime: 'improving' | 'stable' | 'degrading';
        memoryUsage: 'increasing' | 'stable' | 'decreasing';
        cacheHitRate: 'improving' | 'stable' | 'degrading';
      };
    };
  }> {
    const comparison = await this.comparePerformance();
    const databases = comparison.databases;

    let totalScore = 0;
    let healthyCount = 0;
    let criticalIssues = 0;
    const reportDatabases: Record<
      string,
      {
        metrics: PerformanceMetrics;
        analysis: ReturnType<
          typeof DatabasePerformanceMonitor.prototype.analyzePerformance
        >;
        status: 'healthy' | 'warning' | 'critical';
      }
    > = {};

    // 分析每个数据库
    for (const [name, metrics] of Object.entries(databases)) {
      const analysis = this.analyzePerformance(metrics);
      totalScore += analysis.score;

      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (analysis.score < 60) {
        status = 'critical';
        criticalIssues += analysis.issues.length;
      } else if (analysis.score < 80) {
        status = 'warning';
      } else {
        healthyCount++;
      }

      reportDatabases[name] = {
        metrics,
        analysis,
        status,
      };
    }

    // 计算趋势
    const trends = this.calculateTrends();

    const averageScore =
      Object.keys(databases).length > 0
        ? totalScore / Object.keys(databases).length
        : 0;

    const report = {
      timestamp: comparison.timestamp,
      summary: {
        totalDatabases: Object.keys(databases).length,
        healthyDatabases: healthyCount,
        averageScore: Math.round(averageScore),
        criticalIssues,
      },
      databases: reportDatabases,
      recommendations: comparison.recommendations,
      trends,
    };

    this.logger.info('性能报告生成完成', {
      totalDatabases: report.summary.totalDatabases,
      averageScore: report.summary.averageScore,
      criticalIssues: report.summary.criticalIssues,
    });

    return report;
  }

  /**
   * 计算性能趋势
   * @returns 趋势分析
   */
  private calculateTrends(): {
    [key: string]: {
      queryTime: 'improving' | 'stable' | 'degrading';
      memoryUsage: 'increasing' | 'stable' | 'decreasing';
      cacheHitRate: 'improving' | 'stable' | 'degrading';
    };
  } {
    const trends: {
      [key: string]: {
        queryTime: 'improving' | 'stable' | 'degrading';
        memoryUsage: 'increasing' | 'stable' | 'decreasing';
        cacheHitRate: 'improving' | 'stable' | 'degrading';
      };
    } = {};
    const minHistorySize = 5; // 需要至少5个数据点才能计算趋势

    for (const [name] of this.repositories.keys()) {
      if (this.metricsHistory.length < minHistorySize) {
        trends[name] = {
          queryTime: 'stable',
          memoryUsage: 'stable',
          cacheHitRate: 'stable',
        };
        continue;
      }

      // 获取最近的性能数据
      const recentData = this.metricsHistory
        .slice(-minHistorySize)
        .map((record) => record.databases[name])
        .filter(Boolean);

      if (recentData.length < minHistorySize) {
        trends[name] = {
          queryTime: 'stable',
          memoryUsage: 'stable',
          cacheHitRate: 'stable',
        };
        continue;
      }

      // 计算查询时间趋势
      const queryTimes = recentData.map((d) => d.queryTime);
      trends[name].queryTime = this.calculateTrend(queryTimes);

      // 计算内存使用趋势
      const memoryUsages = recentData.map((d) => d.memoryUsage);
      trends[name].memoryUsage = this.calculateMemoryTrend(memoryUsages);

      // 计算缓存命中率趋势
      const cacheHitRates = recentData.map((d) => d.cacheHitRate);
      trends[name].cacheHitRate = this.calculateTrend(cacheHitRates, true);
    }

    return trends;
  }

  /**
   * 计算单个指标的趋势
   * @param values 数值数组
   * @param reverse 是否反向计算（对于缓存命中率，越高越好）
   * @returns 趋势
   */
  private calculateTrend(
    values: number[],
    reverse: boolean = false,
  ): 'improving' | 'stable' | 'degrading' {
    if (values.length < 3) return 'stable';

    // 计算线性回归斜率
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    // 对于缓存命中率等指标，需要反转斜率
    const adjustedSlope = reverse ? -slope : slope;

    // 根据斜率判断趋势
    const threshold = 0.01; // 趋势阈值
    if (adjustedSlope > threshold) {
      return reverse ? 'degrading' : 'improving';
    } else if (adjustedSlope < -threshold) {
      return reverse ? 'improving' : 'degrading';
    } else {
      return 'stable';
    }
  }

  /**
   * 计算内存使用趋势
   * @param values 数值数组
   * @returns 趋势
   */
  private calculateMemoryTrend(
    values: number[],
  ): 'increasing' | 'stable' | 'decreasing' {
    if (values.length < 3) return 'stable';

    // 计算线性回归斜率
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    // 根据斜率判断趋势
    const threshold = 0.01; // 趋势阈值
    if (slope > threshold) {
      return 'increasing';
    } else if (slope < -threshold) {
      return 'decreasing';
    } else {
      return 'stable';
    }
  }

  /**
   * 设置性能阈值
   * @param thresholds 新的阈值配置
   */
  setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.logger.info('性能阈值已更新', {
      thresholds: { ...this.thresholds, ...thresholds },
    });
  }

  /**
   * 获取当前性能阈值
   * @returns 当前阈值配置
   */
  getThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }

  /**
   * 清除性能历史记录
   */
  clearHistory(): void {
    this.metricsHistory = [];
    this.logger.info('性能历史记录已清除');
  }

  /**
   * 导出性能数据
   * @param format 导出格式
   * @returns 导出的数据
   */
  async exportPerformanceData(
    format: 'json' | 'csv' = 'json',
  ): Promise<string> {
    const report = await this.generatePerformanceReport();

    if (format === 'json') {
      return JSON.stringify(report, null, 2);
    } else if (format === 'csv') {
      // 简化的CSV导出
      const headers = [
        'database',
        'queryTime',
        'memoryUsage',
        'cacheHitRate',
        'activeConnections',
        'score',
        'status',
      ];

      const rows = [headers.join(',')];

      for (const [name, data] of Object.entries(report.databases)) {
        const row = [
          name,
          data.metrics.queryTime,
          data.metrics.memoryUsage,
          data.metrics.cacheHitRate,
          data.metrics.activeConnections,
          data.analysis.score,
          data.status,
        ];
        rows.push(row.join(','));
      }

      return rows.join('\n');
    }

    throw new Error(`不支持的导出格式: ${format}`);
  }
}

/**
 * 单例性能监控器
 */
export class DatabasePerformanceMonitorSingleton {
  private static instance: DatabasePerformanceMonitor;

  /**
   * 获取性能监控器实例
   * @param repositories 数据库仓库映射
   * @param logger 日志记录器
   * @param thresholds 性能阈值
   * @returns 性能监控器实例
   */
  static getInstance(
    repositories: Map<string, IDatabaseRepository>,
    logger: Logger,
    thresholds?: PerformanceThresholds,
  ): DatabasePerformanceMonitor {
    if (!DatabasePerformanceMonitorSingleton.instance) {
      DatabasePerformanceMonitorSingleton.instance =
        new DatabasePerformanceMonitor(repositories, logger, thresholds);
    }
    return DatabasePerformanceMonitorSingleton.instance;
  }
}
