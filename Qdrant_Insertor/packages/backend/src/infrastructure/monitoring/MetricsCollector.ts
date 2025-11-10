import { Logger } from '@logging/logger.js';

/**
 * 指标类型枚举
 */
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  TIMER = 'timer',
}

/**
 * 指标接口
 */
export interface Metric {
  name: string;
  type: MetricType;
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
  description?: string;
  unit?: string;
}

/**
 * 直方图桶配置
 */
export interface HistogramBucket {
  le: number; // 小于等于
  count: number;
}

/**
 * 直方图数据
 */
export interface HistogramData {
  buckets: HistogramBucket[];
  count: number;
  sum: number;
}

/**
 * 指标收集器配置
 */
export interface MetricsCollectorConfig {
  // 是否启用指标收集
  enabled?: boolean;

  // 指标保留时间（毫秒）
  retentionPeriod?: number;

  // 清理间隔（毫秒）
  cleanupInterval?: number;

  // 最大指标数量
  maxMetrics?: number;

  // 是否启用持久化
  enablePersistence?: boolean;

  // 持久化间隔（毫秒）
  persistenceInterval?: number;

  // 慢查询阈值（毫秒）
  slowQueryThreshold?: number;

  // 内存使用阈值（字节）
  memoryThreshold?: number;

  // CPU使用阈值（百分比）
  cpuThreshold?: number;
}

/**
 * 默认指标收集器配置
 */
export const DEFAULT_METRICS_CONFIG: MetricsCollectorConfig = {
  enabled: true,
  retentionPeriod: 3600000, // 1小时
  cleanupInterval: 300000, // 5分钟
  maxMetrics: 10000,
  enablePersistence: false,
  persistenceInterval: 60000, // 1分钟
  slowQueryThreshold: 1000, // 1秒
  memoryThreshold: 1024 * 1024 * 1024, // 1GB
  cpuThreshold: 80, // 80%
};

/**
 * 指标收集器
 */
export class MetricsCollector {
  private metrics: Map<string, Metric[]> = new Map();
  private histograms: Map<string, HistogramData> = new Map();
  private timers: Map<string, number> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private persistenceTimer: NodeJS.Timeout | null = null;

  /**
   * 构造指标采集器。
   * @param config 指标采集配置
   * @param logger 可选日志记录器
   */
  constructor(
    private readonly config: MetricsCollectorConfig = {},
    private readonly logger?: Logger,
  ) {
    const finalConfig = { ...DEFAULT_METRICS_CONFIG, ...config };
    this.config = finalConfig;

    if (finalConfig.enabled) {
      this.startCleanupTimer();
      if (finalConfig.enablePersistence) {
        this.startPersistenceTimer();
      }

      this.logger?.info('指标收集器已启动', {
        retentionPeriod: finalConfig.retentionPeriod,
        cleanupInterval: finalConfig.cleanupInterval,
        maxMetrics: finalConfig.maxMetrics,
      });
    } else {
      this.logger?.info('指标收集器已禁用');
    }
  }

  /**
   * 记录计数器指标
   * @param name 指标名称
   * @param value 增量值，默认为1
   * @param labels 标签
   * @param description 描述
   */
  incrementCounter(
    name: string,
    value: number = 1,
    labels?: Record<string, string>,
    description?: string,
  ): void {
    if (!this.config.enabled) return;

    this.recordMetric({
      name,
      type: MetricType.COUNTER,
      value,
      timestamp: Date.now(),
      labels,
      description,
    });

    this.logger?.debug('计数器指标已记录', { name, value, labels });
  }

  /**
   * 设置仪表盘指标
   * @param name 指标名称
   * @param value 指标值
   * @param labels 标签
   * @param description 描述
   * @param unit 单位
   */
  setGauge(
    name: string,
    value: number,
    labels?: Record<string, string>,
    description?: string,
    unit?: string,
  ): void {
    if (!this.config.enabled) return;

    this.recordMetric({
      name,
      type: MetricType.GAUGE,
      value,
      timestamp: Date.now(),
      labels,
      description,
      unit,
    });

    this.logger?.debug('仪表盘指标已设置', { name, value, labels, unit });
  }

  /**
   * 记录直方图指标
   * @param name 指标名称
   * @param value 观测值
   * @param buckets 桶配置，可选
   * @param labels 标签
   * @param description 描述
   * @param unit 单位
   */
  recordHistogram(
    name: string,
    value: number,
    buckets?: number[],
    labels?: Record<string, string>,
    description?: string,
    unit?: string,
  ): void {
    if (!this.config.enabled) return;

    // 获取或创建直方图数据
    let histogramData = this.histograms.get(name);
    if (!histogramData) {
      // 默认桶配置
      const defaultBuckets = buckets || [
        0.1, 0.5, 1, 2.5, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000,
      ];
      histogramData = {
        buckets: defaultBuckets.map((le) => ({ le, count: 0 })),
        count: 0,
        sum: 0,
      };
      this.histograms.set(name, histogramData);
    }

    // 更新直方图数据
    histogramData.count++;
    histogramData.sum += value;

    for (const bucket of histogramData.buckets) {
      if (value <= bucket.le) {
        bucket.count++;
      }
    }

    this.logger?.debug('直方图指标已记录', { name, value, labels });
  }

  /**
   * 开始计时器
   * @param name 计时器名称
   * @param labels 标签
   * @returns 计时器ID
   */
  startTimer(name: string, labels?: Record<string, string>): string {
    if (!this.config.enabled) return '';

    const timerId = `${name}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.timers.set(timerId, Date.now());

    this.logger?.debug('计时器已启动', { name, timerId, labels });
    return timerId;
  }

  /**
   * 结束计时器并记录时间
   * @param timerId 计时器ID
   * @param labels 标签
   * @param description 描述
   */
  endTimer(
    timerId: string,
    labels?: Record<string, string>,
    description?: string,
  ): void {
    if (!this.config.enabled) return;

    const startTime = this.timers.get(timerId);
    if (!startTime) {
      this.logger?.warn('计时器未找到', { timerId });
      return;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(timerId);

    // 从计时器ID中提取名称
    const name = timerId.split('_')[0];

    this.recordMetric({
      name,
      type: MetricType.TIMER,
      value: duration,
      timestamp: Date.now(),
      labels,
      description,
      unit: 'ms',
    });

    this.logger?.debug('计时器已结束', { name, timerId, duration, labels });
  }

  /**
   * 记录数据库查询指标
   * @param operation 操作类型
   * @param table 表名
   * @param duration 查询时间（毫秒）
   * @param success 是否成功
   * @param rowCount 影响行数
   */
  recordDatabaseQuery(
    operation: string,
    table: string,
    duration: number,
    success: boolean,
    rowCount?: number,
  ): void {
    if (!this.config.enabled) return;

    const labels = {
      operation,
      table,
      success: success.toString(),
    };

    // 记录查询时间
    this.recordHistogram(
      'database_query_duration',
      duration,
      undefined,
      labels,
      '数据库查询持续时间',
      'ms',
    );

    // 记录查询计数
    this.incrementCounter(
      'database_queries_total',
      1,
      labels,
      '数据库查询总数',
    );

    // 记录慢查询
    if (
      this.config.slowQueryThreshold &&
      duration > this.config.slowQueryThreshold
    ) {
      this.incrementCounter(
        'database_slow_queries_total',
        1,
        labels,
        '慢查询总数',
      );
      this.logger?.warn('检测到慢查询', {
        operation,
        table,
        duration,
        threshold: this.config.slowQueryThreshold,
      });
    }

    // 记录影响行数
    if (rowCount !== undefined) {
      this.recordHistogram(
        'database_query_rows',
        rowCount,
        undefined,
        labels,
        '数据库查询影响行数',
        'rows',
      );
    }

    // 记录成功/失败率
    if (!success) {
      this.incrementCounter(
        'database_query_errors_total',
        1,
        labels,
        '数据库查询错误总数',
      );
    }
  }

  /**
   * 记录缓存指标
   * @param operation 操作类型
   * @param cacheType 缓存类型
   * @param hit 是否命中
   * @param duration 操作时间（毫秒）
   */
  recordCacheOperation(
    operation: string,
    cacheType: string,
    hit: boolean,
    duration?: number,
  ): void {
    if (!this.config.enabled) return;

    const labels = {
      operation,
      cache_type: cacheType,
      hit: hit.toString(),
    };

    // 记录缓存操作计数
    this.incrementCounter('cache_operations_total', 1, labels, '缓存操作总数');

    // 记录缓存命中率
    this.incrementCounter('cache_hits_total', 1, labels, '缓存命中总数');

    // 记录缓存操作时间
    if (duration !== undefined) {
      this.recordHistogram(
        'cache_operation_duration',
        duration,
        undefined,
        labels,
        '缓存操作持续时间',
        'ms',
      );
    }
  }

  /**
   * 记录HTTP请求指标
   * @param method HTTP方法
   * @param route 路由
   * @param statusCode 状态码
   * @param duration 请求时间（毫秒）
   * @param contentLength 响应内容长度
   */
  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
    contentLength?: number,
  ): void {
    if (!this.config.enabled) return;

    const labels = {
      method,
      route,
      status_code: statusCode.toString(),
      status_class: this.getStatusClass(statusCode),
    };

    // 记录请求计数
    this.incrementCounter('http_requests_total', 1, labels, 'HTTP请求总数');

    // 记录请求时间
    this.recordHistogram(
      'http_request_duration',
      duration,
      undefined,
      labels,
      'HTTP请求持续时间',
      'ms',
    );

    // 记录响应大小
    if (contentLength !== undefined) {
      this.recordHistogram(
        'http_response_size_bytes',
        contentLength,
        undefined,
        labels,
        'HTTP响应大小',
        'bytes',
      );
    }

    // 记录错误请求
    if (statusCode >= 400) {
      this.incrementCounter('http_errors_total', 1, labels, 'HTTP错误总数');
    }
  }

  /**
   * 记录系统指标
   * @param cpuUsage CPU使用率（百分比）
   * @param memoryUsage 内存使用量（字节）
   * @param diskUsage 磁盘使用量（字节）
   * @param networkIO 网络IO（字节）
   */
  recordSystemMetrics(
    cpuUsage?: number,
    memoryUsage?: number,
    diskUsage?: number,
    networkIO?: number,
  ): void {
    if (!this.config.enabled) return;

    // 记录CPU使用率
    if (cpuUsage !== undefined) {
      this.setGauge(
        'system_cpu_usage_percent',
        cpuUsage,
        undefined,
        '系统CPU使用率',
        '%',
      );

      // 检查CPU阈值
      if (this.config.cpuThreshold && cpuUsage > this.config.cpuThreshold) {
        this.logger?.warn('CPU使用率超过阈值', {
          usage: cpuUsage,
          threshold: this.config.cpuThreshold,
        });
        this.incrementCounter(
          'system_cpu_threshold_exceeded_total',
          1,
          undefined,
          'CPU阈值超出次数',
        );
      }
    }

    // 记录内存使用量
    if (memoryUsage !== undefined) {
      this.setGauge(
        'system_memory_usage_bytes',
        memoryUsage,
        undefined,
        '系统内存使用量',
        'bytes',
      );

      // 检查内存阈值
      if (
        this.config.memoryThreshold &&
        memoryUsage > this.config.memoryThreshold
      ) {
        this.logger?.warn('内存使用量超过阈值', {
          usage: memoryUsage,
          threshold: this.config.memoryThreshold,
        });
        this.incrementCounter(
          'system_memory_threshold_exceeded_total',
          1,
          undefined,
          '内存阈值超出次数',
        );
      }
    }

    // 记录磁盘使用量
    if (diskUsage !== undefined) {
      this.setGauge(
        'system_disk_usage_bytes',
        diskUsage,
        undefined,
        '系统磁盘使用量',
        'bytes',
      );
    }

    // 记录网络IO
    if (networkIO !== undefined) {
      this.setGauge(
        'system_network_io_bytes',
        networkIO,
        undefined,
        '系统网络IO',
        'bytes',
      );
    }
  }

  /**
   * 获取指标数据
   * @param name 指标名称，可选
   * @param startTime 开始时间，可选
   * @param endTime 结束时间，可选
   * @returns 指标数据
   */
  getMetrics(name?: string, startTime?: number, endTime?: number): Metric[] {
    if (!this.config.enabled) return [];

    let metrics: Metric[] = [];

    if (name) {
      const namedMetrics = this.metrics.get(name) || [];
      metrics = namedMetrics.filter((metric) => {
        if (startTime && metric.timestamp < startTime) return false;
        if (endTime && metric.timestamp > endTime) return false;
        return true;
      });
    } else {
      for (const namedMetrics of this.metrics.values()) {
        metrics.push(
          ...namedMetrics.filter((metric) => {
            if (startTime && metric.timestamp < startTime) return false;
            if (endTime && metric.timestamp > endTime) return false;
            return true;
          }),
        );
      }
    }

    return metrics.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * 获取直方图数据
   * @param name 直方图名称
   * @returns 直方图数据
   */
  getHistogram(name: string): HistogramData | null {
    if (!this.config.enabled) return null;
    return this.histograms.get(name) || null;
  }

  /**
   * 获取所有指标名称
   * @returns 指标名称数组
   */
  getMetricNames(): string[] {
    if (!this.config.enabled) return [];
    return Array.from(this.metrics.keys());
  }

  /**
   * 清空所有指标
   */
  clearMetrics(): void {
    if (!this.config.enabled) return;

    this.metrics.clear();
    this.histograms.clear();
    this.timers.clear();

    this.logger?.debug('所有指标已清空');
  }

  /**
   * 销毁指标收集器
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
      this.persistenceTimer = null;
    }

    this.clearMetrics();
    this.logger?.debug('指标收集器已销毁');
  }

  /**
   * 记录指标
   * @param metric 指标数据
   */
  private recordMetric(metric: Metric): void {
    const namedMetrics = this.metrics.get(metric.name) || [];
    namedMetrics.push(metric);
    this.metrics.set(metric.name, namedMetrics);

    // 检查指标数量限制
    if (
      this.config.maxMetrics &&
      namedMetrics.length > this.config.maxMetrics
    ) {
      // 移除最旧的指标
      const removed = namedMetrics.splice(
        0,
        namedMetrics.length - this.config.maxMetrics,
      );
      this.logger?.debug('指标数量超限，已移除旧指标', {
        count: removed.length,
        metricName: metric.name,
      });
    }
  }

  /**
   * 获取HTTP状态码类别
   * @param statusCode 状态码
   * @returns 状态码类别
   */
  private getStatusClass(statusCode: number): string {
    if (statusCode < 200) return '1xx';
    if (statusCode < 300) return '2xx';
    if (statusCode < 400) return '3xx';
    if (statusCode < 500) return '4xx';
    return '5xx';
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    if (!this.config.cleanupInterval || this.config.cleanupInterval <= 0) {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * 启动持久化定时器
   */
  private startPersistenceTimer(): void {
    if (
      !this.config.persistenceInterval ||
      this.config.persistenceInterval <= 0
    ) {
      return;
    }

    this.persistenceTimer = setInterval(() => {
      this.persistMetrics();
    }, this.config.persistenceInterval);
  }

  /**
   * 清理过期指标
   */
  private cleanup(): void {
    if (!this.config.retentionPeriod) return;

    const now = Date.now();
    const cutoffTime = now - this.config.retentionPeriod;
    let totalRemoved = 0;

    for (const [name, metrics] of this.metrics.entries()) {
      const originalLength = metrics.length;
      const filteredMetrics = metrics.filter(
        (metric) => metric.timestamp > cutoffTime,
      );

      if (filteredMetrics.length < originalLength) {
        this.metrics.set(name, filteredMetrics);
        totalRemoved += originalLength - filteredMetrics.length;
      }
    }

    if (totalRemoved > 0) {
      this.logger?.debug('过期指标已清理', { count: totalRemoved });
    }
  }

  /**
   * 持久化指标
   */
  private async persistMetrics(): Promise<void> {
    try {
      // TODO: 实现指标持久化逻辑
      this.logger?.debug('指标持久化功能尚未实现');
    } catch (error) {
      this.logger?.error('指标持久化失败', { error });
    }
  }
}
