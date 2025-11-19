/**
 * 统一错误日志和监控系统
 * 提供统一的错误日志记录、监控和告警功能
 */

import { Logger } from '@logging/logger.js';
import { CoreError, ErrorContext, ErrorSeverity } from './CoreError.js';

/**
 * 错误日志级别
 */
export enum ErrorLogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * 错误统计信息
 */
export interface ErrorStats {
  /** 错误总数 */
  total: number;
  /** 按严重级别分组的错误数 */
  bySeverity: Record<ErrorSeverity, number>;
  /** 按错误代码分组的错误数 */
  byErrorCode: Record<string, number>;
  /** 最近错误时间戳 */
  lastErrorAt?: number;
  /** 错误率（每分钟） */
  errorRate: number;
}

/**
 * 错误监控指标
 */
export interface ErrorMetrics {
  /** 错误计数器 */
  counter: number;
  /** 错误率 */
  rate: number;
  /** 平均恢复时间 */
  avgRecoveryTime: number;
  /** 错误分布 */
  distribution: Record<string, number>;
  /** 趋势数据 */
  trends: Array<{
    timestamp: number;
    count: number;
    rate: number;
  }>;
}

/**
 * 错误告警配置
 */
export interface ErrorAlertConfig {
  /** 是否启用告警 */
  enabled: boolean;
  /** 告警阈值（错误数量） */
  threshold: number;
  /** 告警时间窗口（分钟） */
  timeWindowMinutes: number;
  /** 告警回调函数 */
  alertCallback?: (error: CoreError, stats: ErrorStats) => void;
}

/**
 * 错误日志记录器配置
 */
export interface ErrorLoggerConfig {
  /** 日志级别 */
  logLevel: ErrorLogLevel;
  /** 是否启用统计 */
  enableStats: boolean;
  /** 是否启用监控 */
  enableMetrics: boolean;
  /** 是否启用告警 */
  enableAlerts: boolean;
  /** 告警配置 */
  alertConfig?: ErrorAlertConfig;
  /** 统计时间窗口（分钟） */
  statsTimeWindowMinutes: number;
  /** 监控时间窗口（分钟） */
  metricsTimeWindowMinutes: number;
}

/**
 * 统一错误日志记录器
 * 提供统一的错误日志记录、监控和告警功能
 */
export class ErrorLogger {
  private config: ErrorLoggerConfig;
  private stats: ErrorStats;
  private metrics: ErrorMetrics;
  private errorHistory: Array<{
    error: CoreError;
    timestamp: number;
  }>;
  private alertCooldowns: Map<string, number> = new Map();

  /**
   * 创建错误日志记录器
   * @param logger 日志记录器
   * @param config 配置选项
   */
  constructor(
    private readonly logger: Logger,
    config: Partial<ErrorLoggerConfig> = {},
  ) {
    // 默认配置
    this.config = {
      logLevel: ErrorLogLevel.INFO,
      enableStats: true,
      enableMetrics: true,
      enableAlerts: true,
      statsTimeWindowMinutes: 60,
      metricsTimeWindowMinutes: 5,
      ...config,
    };

    // 初始化统计和指标
    this.stats = {
      total: 0,
      bySeverity: {
        [ErrorSeverity.LOW]: 0,
        [ErrorSeverity.MEDIUM]: 0,
        [ErrorSeverity.HIGH]: 0,
        [ErrorSeverity.CRITICAL]: 0,
      },
      byErrorCode: {},
      errorRate: 0,
    };

    this.metrics = {
      counter: 0,
      rate: 0,
      avgRecoveryTime: 0,
      distribution: {},
      trends: [],
    };

    this.errorHistory = [];
  }

  /**
   * 记录错误
   * @param error 错误对象
   * @param additionalContext 额外的上下文信息
   */
  logError(error: CoreError, additionalContext?: ErrorContext): void {
    const timestamp = Date.now();

    // 更新错误历史
    this.errorHistory.push({
      error,
      timestamp,
    });

    // 保持历史记录在合理范围内
    if (this.errorHistory.length > 1000) {
      this.errorHistory = this.errorHistory.slice(-1000);
    }

    // 更新统计信息
    this.updateStats(error);

    // 更新监控指标
    if (this.config.enableMetrics) {
      this.updateMetrics(error);
    }

    // 记录日志
    this.writeLog(error, additionalContext);

    // 检查告警
    if (this.config.enableAlerts && this.config.alertConfig) {
      this.checkAlert(error);
    }
  }

  /**
   * 记录错误恢复
   * @param errorId 错误ID
   * @param recoveryTime 恢复时间（毫秒）
   */
  logRecovery(errorId: string, recoveryTime: number): void {
    this.logger.info('Error recovery recorded', {
      errorId,
      recoveryTime,
      recoveryTimeSeconds: recoveryTime / 1000,
    });

    // 更新平均恢复时间
    if (this.metrics.counter > 0) {
      this.metrics.avgRecoveryTime =
        (this.metrics.avgRecoveryTime * (this.metrics.counter - 1) +
          recoveryTime) /
        this.metrics.counter;
    }
  }

  /**
   * 获取错误统计信息
   * @returns 错误统计信息
   */
  getStats(): ErrorStats {
    // 计算错误率
    const now = Date.now();
    const timeWindow = this.config.statsTimeWindowMinutes * 60 * 1000; // 转换为毫秒
    const recentErrors = this.errorHistory.filter(
      (entry) => now - entry.timestamp <= timeWindow,
    );

    this.stats.errorRate =
      recentErrors.length / (this.config.statsTimeWindowMinutes || 1);

    return { ...this.stats };
  }

  /**
   * 获取错误监控指标
   * @returns 错误监控指标
   */
  getMetrics(): ErrorMetrics {
    // 计算趋势数据
    const now = Date.now();
    const timeWindow = this.config.metricsTimeWindowMinutes * 60 * 1000; // 转换为毫秒
    const recentErrors = this.errorHistory.filter(
      (entry) => now - entry.timestamp <= timeWindow,
    );

    // 按分钟分组统计
    const minuteGroups = new Map<number, number>();
    recentErrors.forEach((entry) => {
      const minute = Math.floor(entry.timestamp / (60 * 1000));
      minuteGroups.set(minute, (minuteGroups.get(minute) || 0) + 1);
    });

    // 生成趋势数据
    this.metrics.trends = Array.from(minuteGroups.entries())
      .map(([minute, count]) => ({
        timestamp: minute * 60 * 1000,
        count,
        rate: count / 60, // 每秒的错误率
      }))
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, 60); // 最近60分钟

    // 计算错误率
    const totalMinutes = this.config.metricsTimeWindowMinutes || 1;
    this.metrics.rate = recentErrors.length / totalMinutes;

    return { ...this.metrics };
  }

  /**
   * 获取错误历史
   * @param options 查询选项
   * @param options.limit 限制数量
   * @param options.severity 严重级别过滤
   * @returns 错误历史
   */
  getErrorHistory(
    options: {
      limit?: number;
      severity?: ErrorSeverity;
    } = {},
  ): Array<{
    error: CoreError;
    timestamp: number;
  }> {
    let history = [...this.errorHistory];

    // 按严重级别过滤
    if (options.severity) {
      history = history.filter(
        (entry) => entry.error.severity === options.severity,
      );
    }

    // 按时间倒序排序
    history.sort((a, b) => b.timestamp - a.timestamp);

    // 限制数量
    if (options.limit) {
      history = history.slice(0, options.limit);
    }

    return history;
  }

  /**
   * 清除统计数据
   */
  clearStats(): void {
    this.stats = {
      total: 0,
      bySeverity: {
        [ErrorSeverity.LOW]: 0,
        [ErrorSeverity.MEDIUM]: 0,
        [ErrorSeverity.HIGH]: 0,
        [ErrorSeverity.CRITICAL]: 0,
      },
      byErrorCode: {},
      errorRate: 0,
    };

    this.metrics = {
      counter: 0,
      rate: 0,
      avgRecoveryTime: 0,
      distribution: {},
      trends: [],
    };

    this.errorHistory = [];
    this.alertCooldowns.clear();
  }

  /**
   * 更新统计信息
   * @param error 错误对象
   */
  private updateStats(error: CoreError): void {
    this.stats.total++;
    this.stats.bySeverity[error.severity] =
      (this.stats.bySeverity[error.severity] || 0) + 1;
    this.stats.byErrorCode[error.code] =
      (this.stats.byErrorCode[error.code] || 0) + 1;
    this.stats.lastErrorAt = Date.now();
  }

  /**
   * 更新监控指标
   * @param error 错误对象
   */
  private updateMetrics(error: CoreError): void {
    this.metrics.counter++;
    this.metrics.distribution[error.code] =
      (this.metrics.distribution[error.code] || 0) + 1;
  }

  /**
   * 写入日志
   * @param error 错误对象
   * @param additionalContext 额外的上下文信息
   */
  private writeLog(error: CoreError, additionalContext?: ErrorContext): void {
    const logLevel = this.getLogLevel(error.severity);
    const logData: Record<string, unknown> = {
      errorId: error.errorId,
      code: error.code,
      type: error.type,
      severity: error.severity,
      recoveryStrategy: error.recoveryStrategy,
      message: error.message,
      httpStatus: error.httpStatus,
      shouldRetry: error.isTemporary(),
      shouldAlert: error.isCritical(),
      context: { ...error.context, ...additionalContext },
      details: error.details,
      timestamp: error.timestamp,
    };

    // 如果有原始错误，添加原始错误信息
    if (error.cause) {
      (logData as Record<string, unknown>)['originalError'] = {
        name: error.cause.name,
        message: error.cause.message,
        stack: error.cause.stack,
      };
    }

    switch (logLevel) {
      case ErrorLogLevel.DEBUG:
        this.logger.debug('Error occurred', logData);
        break;
      case ErrorLogLevel.INFO:
        this.logger.info('Error occurred', logData);
        break;
      case ErrorLogLevel.WARN:
        this.logger.warn('Error occurred', logData);
        break;
      case ErrorLogLevel.ERROR:
        this.logger.error('Error occurred', logData);
        break;
      case ErrorLogLevel.CRITICAL:
        this.logger.error('Critical error occurred', logData);
        break;
    }
  }

  /**
   * 获取日志级别
   * @param severity 错误严重级别
   * @returns 日志级别
   */
  private getLogLevel(severity: ErrorSeverity): ErrorLogLevel {
    switch (severity) {
      case ErrorSeverity.LOW:
        return this.config.logLevel <= ErrorLogLevel.DEBUG
          ? ErrorLogLevel.DEBUG
          : ErrorLogLevel.INFO;
      case ErrorSeverity.MEDIUM:
        return this.config.logLevel <= ErrorLogLevel.INFO
          ? ErrorLogLevel.INFO
          : ErrorLogLevel.WARN;
      case ErrorSeverity.HIGH:
        return this.config.logLevel <= ErrorLogLevel.WARN
          ? ErrorLogLevel.WARN
          : ErrorLogLevel.ERROR;
      case ErrorSeverity.CRITICAL:
        return ErrorLogLevel.ERROR; // 总是记录严重错误
      default:
        return ErrorLogLevel.INFO;
    }
  }

  /**
   * 检查告警
   * @param error 错误对象
   */
  private checkAlert(error: CoreError): void {
    if (!this.config.alertConfig || !this.config.alertConfig.enabled) {
      return;
    }

    // 检查是否应该发送告警
    if (!error.shouldAlert) {
      return;
    }

    // 检查告警冷却时间
    const cooldownKey = `${error.code}_${error.type}`;
    const now = Date.now();
    const lastAlert = this.alertCooldowns.get(cooldownKey) || 0;
    const cooldownMs = this.config.alertConfig.timeWindowMinutes * 60 * 1000; // 转换为毫秒

    if (now - lastAlert < cooldownMs) {
      return;
    }

    // 检查告警阈值
    const stats = this.getStats();
    const errorCount = stats.byErrorCode[error.code] || 0;

    if (errorCount < this.config.alertConfig.threshold) {
      return;
    }

    // 更新冷却时间
    this.alertCooldowns.set(cooldownKey, now);

    // 发送告警
    this.sendAlert(error, stats);
  }

  /**
   * 发送告警
   * @param error 错误对象
   * @param stats 统计信息
   */
  private sendAlert(error: CoreError, stats: ErrorStats): void {
    const alertData = {
      errorId: error.errorId,
      code: error.code,
      type: error.type,
      severity: error.severity,
      message: error.message,
      timestamp: error.timestamp,
      stats: {
        total: stats.total,
        errorCount: stats.byErrorCode[error.code] || 0,
        errorRate: stats.errorRate,
      },
    };

    this.logger.error('Error alert triggered', alertData);

    // 调用告警回调
    if (this.config.alertConfig?.alertCallback) {
      try {
        this.config.alertConfig.alertCallback(error, stats);
      } catch (callbackError) {
        this.logger.error('Error alert callback failed', {
          error: (callbackError as Error).message,
          originalError: error,
        });
      }
    }
  }

  /**
   * 创建错误日志记录器
   * @param logger 日志记录器
   * @param config 配置选项
   * @returns 错误日志记录器实例
   */
  static create(
    logger: Logger,
    config: Partial<ErrorLoggerConfig> = {},
  ): ErrorLogger {
    return new ErrorLogger(logger, config);
  }
}

/**
 * 全局错误日志记录器实例
 */
export let globalErrorLogger: ErrorLogger | null = null;

/**
 * 初始化全局错误日志记录器
 * @param logger 日志记录器
 * @param config 配置选项
 */
export function initializeGlobalErrorLogger(
  logger: Logger,
  config: Partial<ErrorLoggerConfig> = {},
): void {
  globalErrorLogger = ErrorLogger.create(logger, config);
}

/**
 * 便捷的错误日志记录函数
 * @param error 错误对象
 * @param additionalContext 额外的上下文信息
 */
export function logError(
  error: Error | CoreError,
  additionalContext?: ErrorContext,
): void {
  if (!globalErrorLogger) {
    console.error('Global error logger not initialized', {
      error: error.message,
    });
    return;
  }

  let coreError: CoreError;

  // 如果不是CoreError，尝试转换
  if (!(error instanceof CoreError)) {
    coreError = CoreError.fromError(error, additionalContext);
  } else {
    coreError = error;
  }

  globalErrorLogger.logError(coreError, additionalContext);
}

/**
 * 便捷的错误恢复记录函数
 * @param errorId 错误ID
 * @param recoveryTime 恢复时间（毫秒）
 */
export function logRecovery(errorId: string, recoveryTime: number): void {
  if (!globalErrorLogger) {
    console.error('Global error logger not initialized', {
      errorId,
      recoveryTime,
    });
    return;
  }

  globalErrorLogger.logRecovery(errorId, recoveryTime);
}
