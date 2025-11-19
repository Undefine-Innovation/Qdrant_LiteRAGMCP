import {
  IRateLimitMetrics,
  RateLimitStatistics,
  RateLimitResult,
} from '@domain/interfaces/IRateLimiter.js';
import { Logger } from '@infrastructure/logging/logger.js';

/**
 * 限流事件记录接口
 */
interface RateLimitEvent {
  /** 限流器类型 */
  limiterType: string;
  /** 限流键 */
  key: string;
  /** 是否允许 */
  allowed: boolean;
  /** 剩余次数 */
  remaining: number;
  /** 时间戳 */
  timestamp: number;
  /** 最大令牌数 */
  maxTokens?: number;
  /** 令牌补充速率 */
  refillRate?: number;
}

/**
 * 限流指标收集器实现
 *
 * 提供限流事件的记录、统计和分析功能：
 * - 内存存储限流事件
 * - 自动清理过期数据
 * - 提供多维度统计
 * - 支持时间范围查询
 */
export class RateLimitMetrics implements IRateLimitMetrics {
  /** 限流事件存储 */
  private readonly events = new Map<string, RateLimitEvent[]>();

  /** 清理定时器 */
  private cleanupTimer: NodeJS.Timeout | null = null;

  /** 默认数据保留时间（毫秒） */
  private readonly DEFAULT_RETENTION_PERIOD = 24 * 60 * 60 * 1000; // 24小时

  /** 默认清理间隔（毫秒） */
  private readonly DEFAULT_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1小时

  /**
   * 构造函数
   * @param logger 日志记录器
   * @param retentionPeriod 数据保留时间（毫秒）
   * @param cleanupInterval 清理间隔（毫秒）
   */
  constructor(
    private readonly logger?: Logger,
    private readonly retentionPeriod: number = this.DEFAULT_RETENTION_PERIOD,
    private readonly cleanupInterval: number = this.DEFAULT_CLEANUP_INTERVAL,
  ) {
    this.startCleanupTimer();
    this.logger?.info('限流指标收集器已初始化', {
      retentionPeriod,
      cleanupInterval,
    });
  }

  /**
   * 记录限流事件
   * @param limiterType 限流器类型
   * @param key 限流键
   * @param allowed 是否允许
   * @param remaining 剩余次数
   */
  public recordLimitEvent(
    limiterType: string,
    key: string,
    allowed: boolean,
    remaining: number,
  ): void {
    const event: RateLimitEvent = {
      limiterType,
      key,
      allowed,
      remaining,
      timestamp: Date.now(),
    };

    // 获取或创建事件数组
    let events = this.events.get(limiterType);
    if (!events) {
      events = [];
      this.events.set(limiterType, events);
    }

    events.push(event);

    // 限制事件数量（防止内存溢出）
    const maxEvents = 10000;
    if (events.length > maxEvents) {
      events.splice(0, events.length - maxEvents);
    }

    this.logger?.debug('记录限流事件', {
      limiterType,
      key,
      allowed,
      remaining,
      eventCount: events.length,
    });
  }

  /**
   * 记录限流结果（批量记录多个限流器的结果）
   * @param results 限流结果数组
   */
  public recordLimitResults(results: RateLimitResult[]): void {
    for (const result of results) {
      this.recordLimitEvent(
        result.limiterType,
        result.key,
        result.allowed,
        result.remaining,
      );
    }
  }

  /**
   * 获取限流统计
   * @param limiterType 限流器类型
   * @param timeRange 时间范围（毫秒）
   * @returns 限流统计数据
   */
  public getStatistics(
    limiterType: string,
    timeRange: number,
  ): RateLimitStatistics {
    const now = Date.now();
    const startTime = now - timeRange;
    const events = this.events.get(limiterType) || [];

    // 过滤时间范围内的事件
    const filteredEvents = events.filter(
      (event) => event.timestamp >= startTime,
    );

    if (filteredEvents.length === 0) {
      return this.createEmptyStatistics(limiterType, timeRange, startTime, now);
    }

    // 计算统计数据
    const totalRequests = filteredEvents.length;
    const allowedRequests = filteredEvents.filter((e) => e.allowed).length;
    const rejectedRequests = totalRequests - allowedRequests;
    const allowRate = totalRequests > 0 ? allowedRequests / totalRequests : 0;

    const remainingValues = filteredEvents.map((e) => e.remaining);
    const averageRemaining =
      remainingValues.reduce((sum, val) => sum + val, 0) /
      remainingValues.length;
    const minRemaining = Math.min(...remainingValues);
    const maxRemaining = Math.max(...remainingValues);

    return {
      limiterType,
      totalRequests,
      allowedRequests,
      rejectedRequests,
      allowRate,
      averageRemaining,
      minRemaining,
      maxRemaining,
      timeRange,
      startTime,
      endTime: now,
    };
  }

  /**
   * 获取所有限流器类型的统计
   * @param timeRange 时间范围（毫秒）
   * @returns 限流统计数据映射
   */
  public getAllStatistics(timeRange: number): Map<string, RateLimitStatistics> {
    const statistics = new Map<string, RateLimitStatistics>();

    for (const limiterType of this.events.keys()) {
      const stats = this.getStatistics(limiterType, timeRange);
      statistics.set(limiterType, stats);
    }

    return statistics;
  }

  /**
   * 获取热门限流键（按请求次数排序）
   * @param limiterType 限流器类型
   * @param timeRange 时间范围（毫秒）
   * @param limit 返回数量限制
   * @returns 热门限流键数组
   */
  public getHotKeys(
    limiterType: string,
    timeRange: number,
    limit: number = 10,
  ): Array<{ key: string; count: number; blockedCount: number }> {
    const now = Date.now();
    const startTime = now - timeRange;
    const events = this.events.get(limiterType) || [];

    // 过滤时间范围内的事件
    const filteredEvents = events.filter(
      (event) => event.timestamp >= startTime,
    );

    // 统计每个键的请求次数和被限流次数
    const keyStats = new Map<string, { count: number; blockedCount: number }>();

    for (const event of filteredEvents) {
      const stats = keyStats.get(event.key) || { count: 0, blockedCount: 0 };
      stats.count++;
      if (!event.allowed) {
        stats.blockedCount++;
      }
      keyStats.set(event.key, stats);
    }

    // 按请求次数排序并返回前N个
    return Array.from(keyStats.entries())
      .map(([key, stats]) => ({ key, ...stats }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * 获取限流趋势数据
   * @param limiterType 限流器类型
   * @param timeRange 时间范围（毫秒）
   * @param bucketSize 时间桶大小（毫秒）
   * @returns 趋势数据数组
   */
  public getTrendData(
    limiterType: string,
    timeRange: number,
    bucketSize: number = 60 * 60 * 1000, // 默认1小时
  ): Array<{
    timestamp: number;
    total: number;
    allowed: number;
    blocked: number;
    blockRate: number;
  }> {
    const now = Date.now();
    const startTime = now - timeRange;
    const events = this.events.get(limiterType) || [];

    // 创建时间桶
    const buckets = new Map<
      number,
      { total: number; allowed: number; blocked: number }
    >();

    for (let timestamp = startTime; timestamp <= now; timestamp += bucketSize) {
      buckets.set(timestamp, { total: 0, allowed: 0, blocked: 0 });
    }

    // 将事件分配到时间桶
    for (const event of events) {
      if (event.timestamp >= startTime) {
        const bucketTimestamp =
          Math.floor((event.timestamp - startTime) / bucketSize) * bucketSize +
          startTime;
        const bucket = buckets.get(bucketTimestamp);
        if (bucket) {
          bucket.total++;
          if (event.allowed) {
            bucket.allowed++;
          } else {
            bucket.blocked++;
          }
        }
      }
    }

    // 转换为数组格式
    return Array.from(buckets.entries()).map(([timestamp, data]) => ({
      timestamp,
      total: data.total,
      allowed: data.allowed,
      blocked: data.blocked,
      blockRate: data.total > 0 ? data.blocked / data.total : 0,
    }));
  }

  /**
   * 清理过期数据
   */
  public cleanup(): void {
    const now = Date.now();
    const cutoffTime = now - this.retentionPeriod;
    let totalRemoved = 0;

    for (const [limiterType, events] of this.events.entries()) {
      const originalLength = events.length;
      const filteredEvents = events.filter(
        (event) => event.timestamp >= cutoffTime,
      );

      if (filteredEvents.length < originalLength) {
        this.events.set(limiterType, filteredEvents);
        totalRemoved += originalLength - filteredEvents.length;
      }
    }

    if (totalRemoved > 0) {
      this.logger?.debug('清理过期的限流事件', {
        totalRemoved,
        remainingEvents: Array.from(this.events.values()).reduce(
          (sum, events) => sum + events.length,
          0,
        ),
      });
    }
  }

  /**
   * 清空所有数据
   */
  public clearAll(): void {
    this.events.clear();
    this.logger?.debug('清空所有限流事件数据');
  }

  /**
   * 获取数据概览
   * @returns 数据概览信息
   */
  public getOverview(): {
    totalEvents: number;
    limiterTypes: string[];
    oldestEvent: number | null;
    newestEvent: number | null;
  } {
    const totalEvents = Array.from(this.events.values()).reduce(
      (sum, events) => sum + events.length,
      0,
    );
    const limiterTypes = Array.from(this.events.keys());

    let oldestEvent: number | null = null;
    let newestEvent: number | null = null;

    for (const events of this.events.values()) {
      for (const event of events) {
        if (oldestEvent === null || event.timestamp < oldestEvent) {
          oldestEvent = event.timestamp;
        }
        if (newestEvent === null || event.timestamp > newestEvent) {
          newestEvent = event.timestamp;
        }
      }
    }

    return {
      totalEvents,
      limiterTypes,
      oldestEvent,
      newestEvent,
    };
  }

  /**
   * 销毁指标收集器
   */
  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.clearAll();
    this.logger?.debug('限流指标收集器已销毁');
  }

  /**
   * 创建空的统计数据
   * @param limiterType 限流器类型
   * @param timeRange 时间范围
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @returns 空的统计数据
   */
  private createEmptyStatistics(
    limiterType: string,
    timeRange: number,
    startTime: number,
    endTime: number,
  ): RateLimitStatistics {
    return {
      limiterType,
      totalRequests: 0,
      allowedRequests: 0,
      rejectedRequests: 0,
      allowRate: 0,
      averageRemaining: 0,
      minRemaining: 0,
      maxRemaining: 0,
      timeRange,
      startTime,
      endTime,
    };
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    if (this.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanup();
      }, this.cleanupInterval);
    }
  }
}
