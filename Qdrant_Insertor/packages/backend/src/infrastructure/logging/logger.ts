/**
 * 日志模块，基于 Winston 实现结构化、分级别的日志输出
 * 兼容性模块，推荐使用增强的日志系统
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import fs from 'node:fs';
import path from 'node:path';
import { AppConfig } from '@config/config.js';
import {
  createEnhancedLogger,
  LoggerAdapter,
  LogTag,
} from './EnhancedLogger.js';

/**
 * 定义日志器接口，支持不同级别的日志输出
 */
export interface Logger {
  /**
   * 输出调试级别日志
   * @param message - 日志消息
   * @param args - 额外参数
   * @returns {void}
   */
  debug(message: string, ...args: unknown[]): void;
  /**
   * 输出信息级别日志
   * @param message - 日志消息
   * @param args - 额外参数
   * @returns {void}
   */
  info(message: string, ...args: unknown[]): void;
  /**
   * 输出警告级别日志
   * @param message - 日志消息
   * @param args - 额外参数
   * @returns {void}
   */
  warn(message: string, ...args: unknown[]): void;
  /**
   * 输出错误级别日志
   * @param message - 日志消息
   * @param args - 额外参数
   * @returns {void}
   */
  error(message: string, ...args: unknown[]): void;
}

/**
 * 创建一个 Winston Logger 实例
 * @param config - 应用程序配置，用于获取日志级别
 * @returns {Logger} 配置好的日志器实例
 */
export function createLogger(config: AppConfig): Logger {
  const { combine, timestamp, json, colorize, simple } = winston.format;

  // 确保日志目录存在
  const logsDir = path.resolve(process.cwd(), 'logs');
  try {
    fs.mkdirSync(logsDir, { recursive: true });
  } catch {
    // 目录创建失败不应阻断应用启动，继续使用控制台输出
  }

  const logger = winston.createLogger({
    level: config.log.level, // 从配置中获取日志级别
    format: combine(timestamp(), json()), // 结合时间戳和 JSON 格式进行结构化日志输出
    transports: [
      // 配置控制台传输器
      new winston.transports.Console({
        format: combine(colorize(), simple()), // 控制台输出带颜色和简洁格式
      }),
      // 配置按日期滚动的文件传输器
      new DailyRotateFile({
        dirname: logsDir,
        filename: 'app-%DATE%.log',
        datePattern: config.log?.datePattern || 'YYYY-MM-DD',
        zippedArchive: config.log?.zippedArchive ?? true,
        maxSize: config.log?.maxSize || '20m',
        // 支持天数(如 '14d')或数量(如 '30')。
        maxFiles: config.log?.maxFiles || '14d',
        level: config.log.level,
      }),
    ],
  });

  // TODO: 未来可集成 Sentry 进行错误上报

  return logger;
}

/**
 * 创建增强的日志器实例（推荐使用）
 * @param config - 应用程序配置，用于获取日志级别
 * @returns {Logger} 配置好的增强日志器实例
 */
export function createEnhancedLoggerFromConfig(config: AppConfig): Logger {
  const enhancedLogger = createEnhancedLogger(config);
  return new LoggerAdapter(enhancedLogger, LogTag.SYSTEM);
}

/**
 * 默认的日志器实例，方便在未明确配置时使用
 * 其配置是最小化的，仅为满足 AppConfig 接口要求
 */
export const logger: Logger = createLogger({
  log: { level: 'info' },
  // 为满足 AppConfig 接口，提供模拟值。在实际应用中，应使用完整配置创建 Logger
  openai: { baseUrl: '', apiKey: '', model: '' },
  llm: {
    provider: 'openai',
    apiKey: '',
    baseUrl: '',
    model: '',
    maxTokens: 0,
    temperature: 0,
    timeout: 0,
    semanticSplitting: {
      enabled: false,
      targetChunkSize: 1000,
      chunkOverlap: 100,
      maxChunks: 0,
      strategy: 'balanced',
      enableFallback: true,
      fallbackStrategy: 'auto',
      maxRetries: 1,
      retryDelay: 0,
      enableCache: false,
      cacheTTL: 0,
    },
  },
  db: { type: 'sqlite', path: '' },
  qdrant: { url: '', collection: '', vectorSize: 0 },
  embedding: { batchSize: 0 },
  api: { port: 0 },
  gc: { intervalHours: 0 }, // 新增 gc 属性以符合 AppConfig 接口
  rateLimit: {
    enabled: false,
    global: { enabled: false },
    ip: { enabled: false },
    user: { enabled: false },
    path: { enabled: false },
    search: { enabled: false },
    upload: { enabled: false },
    metrics: { enabled: false },
    middleware: {
      includeHeaders: false,
      logEvents: false,
      logOnlyBlocked: false,
      skipHealthCheck: true,
      skipOptions: true,
    },
  },
});

// 重新导出增强日志系统的相关类型和函数
/**
 * 重新导出增强 Logger 相关的类型。
 */
export type { EnhancedLogger, LogContext } from './EnhancedLogger.js';

/**
 * 重新导出增强 Logger 的实现与辅助工具（从 `EnhancedLogger` 单一源导出以避免重复）。
 */
export {
  LogTag,
  LogLevel,
  TraceIdGenerator,
  createEnhancedLogger,
  WinstonEnhancedLogger,
  LoggerAdapter,
} from './EnhancedLogger.js';
