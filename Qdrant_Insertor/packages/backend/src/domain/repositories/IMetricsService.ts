/**
 * 指标数据接口
 */
export interface MetricData {
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, string | number>;
}

/**
 * 指标历史查询选项
 */
export interface MetricsHistoryOptions {
  startTime: Date;
  endTime: Date;
}

/**
 * 指标聚合查询选项
 */
export interface MetricsAggregationOptions {
  startTime: Date;
  endTime: Date;
  aggregations: Array<'avg' | 'min' | 'max' | 'sum' | 'count'>;
}

/**
 * 指标聚合结果
 */
export interface MetricsAggregations {
  avg?: number;
  min?: number;
  max?: number;
  sum?: number;
  count?: number;
}

/**
 * 指标服务接口
 */
export interface IMetricsService {
  /**
   * 记录系统指标
   */
  recordMetric(metric: MetricData): Promise<void>;

  /**
   * 获取指标历史
   */
  getMetricsHistory(
    metricName: string,
    options: MetricsHistoryOptions,
  ): Promise<
    Array<{
      name: string;
      value: number;
      unit?: string;
      tags?: Record<string, string | number>;
      timestamp: Date;
    }>
  >;

  /**
   * 获取指标聚合
   */
  getMetricsAggregations(
    metricName: string,
    options: MetricsAggregationOptions,
  ): Promise<MetricsAggregations>;

  /**
   * 按标签过滤指标
   */
  getMetricsByTags(tags: Record<string, string | number>): Promise<
    Array<{
      name: string;
      value: number;
      unit?: string;
      tags?: Record<string, string | number>;
      timestamp: Date;
    }>
  >;

  /**
   * 停止指标服务
   */
  stop(): void;
}
