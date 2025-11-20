/**
 * 增强的日志模块，基于 Winston 实现结构化、分级别的日志输出
 * 支持 TAG、traceID、模块化日志等功能
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppConfig } from '@config/config.js';
import type { Logger } from './logger.js';

/**
 * 日志级别枚举
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * 日志模块TAG枚举
 */
export enum LogTag {
  // 核心模块
  API = 'API',
  DATABASE = 'DATABASE',
  QDRANT = 'QDRANT',
  EMBEDDING = 'EMBEDDING',

  // 业务模块
  COLLECTION = 'COLLECTION',
  DOCUMENT = 'DOCUMENT',
  SEARCH = 'SEARCH',
  IMPORT = 'IMPORT',
  BATCH = 'BATCH',
  SCRAPE = 'SCRAPE',

  // 系统模块
  SYSTEM = 'SYSTEM',
  MONITORING = 'MONITORING',
  GC = 'GC',
  SCHEDULER = 'SCHEDULER',

  // 通用模块
  AUTH = 'AUTH',
  MIDDLEWARE = 'MIDDLEWARE',
  ERROR = 'ERROR',
  UTILS = 'UTILS',
}

/**
 * 日志上下文接口
 */
export interface LogContext {
  traceId?: string;
  userId?: string;
  requestId?: string;
  [key: string]: unknown;
}

/**
 * 增强的日志器接口，支持不同级别的日志输出和上下文信息
 */
export interface EnhancedLogger {
  /**
   * 输出调试级别日志
   * @param message - 日志消息
   * @param tag - 日志模块TAG（可选，如果使用withTag则不需要）
   * @param context - 日志上下文信息
   */
  debug(message: string, tag?: LogTag, context?: LogContext): void;

  /**
   * 输出信息级别日志
   * @param message - 日志消息
   * @param tag - 日志模块TAG（可选，如果使用withTag则不需要）
   * @param context - 日志上下文信息
   */
  info(message: string, tag?: LogTag, context?: LogContext): void;

  /**
   * 输出警告级别日志
   * @param message - 日志消息
   * @param tag - 日志模块TAG（可选，如果使用withTag则不需要）
   * @param context - 日志上下文信息
   */
  warn(message: string, tag?: LogTag, context?: LogContext): void;

  /**
   * 输出错误级别日志
   * @param message - 日志消息
   * @param tag - 日志模块TAG（可选，如果使用withTag则不需要）
   * @param context - 日志上下文信息
   */
  error(message: string, tag?: LogTag, context?: LogContext): void;

  /**
   * 创建带有特定上下文的子日志器
   * @param context - 上下文信息
   * @returns 带有上下文的日志器
   */
  withContext(context: LogContext): EnhancedLogger;

  /**
   * 创建带有特定TAG的子日志器
   * @param tag - 日志模块TAG
   * @returns 带有TAG的日志器
   */
  withTag(tag: LogTag): EnhancedLogger;
}

/**
 * 增强的日志器实现类
 */
export class WinstonEnhancedLogger implements EnhancedLogger {
  private logger: winston.Logger;
  private defaultContext: LogContext;
  private presetTag?: LogTag;

  constructor(
    logger: winston.Logger,
    defaultContext: LogContext = {},
    presetTag?: LogTag,
  ) {
    this.logger = logger;
    this.defaultContext = defaultContext;
    this.presetTag = presetTag;
  }

  /**
   * 写入调试级别日志。
   * @param message 日志内容
   * @param tag 自定义标签
   * @param context 附加上下文
   */
  debug(message: string, tag?: LogTag, context?: LogContext): void {
    const actualTag = tag || this.presetTag || LogTag.SYSTEM;
    this.log(LogLevel.DEBUG, actualTag, message, context);
  }

  /**
   * 写入信息级别日志。
   * @param message 日志内容
   * @param tag 自定义标签
   * @param context 附加上下文
   */
  info(message: string, tag?: LogTag, context?: LogContext): void {
    const actualTag = tag || this.presetTag || LogTag.SYSTEM;
    this.log(LogLevel.INFO, actualTag, message, context);
  }

  /**
   * 写入警告级别日志。
   * @param message 日志内容
   * @param tag 自定义标签
   * @param context 附加上下文
   */
  warn(message: string, tag?: LogTag, context?: LogContext): void {
    const actualTag = tag || this.presetTag || LogTag.SYSTEM;
    this.log(LogLevel.WARN, actualTag, message, context);
  }

  /**
   * 写入错误级别日志。
   * @param message 日志内容
   * @param tag 自定义标签
   * @param context 附加上下文
   */
  error(message: string, tag?: LogTag, context?: LogContext): void {
    const actualTag = tag || this.presetTag || LogTag.SYSTEM;
    this.log(LogLevel.ERROR, actualTag, message, context);
  }

  /**
   * 新建附加默认上下文的 Logger。
   * @param context 默认上下文字段
   * @returns 带默认上下文的 Logger
   */
  withContext(context: LogContext): EnhancedLogger {
    return new WinstonEnhancedLogger(
      this.logger,
      { ...this.defaultContext, ...context },
      this.presetTag,
    );
  }

  /**
   * 为当前实例追加预设标签。
   * @param tag 需要绑定的标签
   * @returns 带默认标签的 Logger
   */
  withTag(tag: LogTag): EnhancedLogger {
    return new WinstonEnhancedLogger(
      this.logger,
      { ...this.defaultContext, tag },
      tag, // 存储预设的TAG
    );
  }

  /**
   * 统一的日志落地实现。
   * @param level 日志级别
   * @param tag 标签
   * @param message 日志内容
   * @param context 附加上下文
   */
  private log(
    level: LogLevel,
    tag: LogTag,
    message: string,
    context?: LogContext,
  ): void {
    const logData = {
      level,
      tag,
      message,
      timestamp: new Date().toISOString(),
      ...this.defaultContext,
      ...context,
    };

    this.logger.log(level, message, logData);
  }
}

/**
 * TraceID 生成器
 */
export class TraceIdGenerator {
  /**
   * 生成新的traceID
   * @returns 新的traceID字符串
   */
  static generate(): string {
    return randomUUID();
  }

  /**
   * 从请求头中提取traceID，如果不存在则生成新的
   * @param headers - 请求头对象
   * @returns traceID字符串
   */
  static extractOrGenerate(headers: Record<string, string>): string {
    const traceId = headers['x-trace-id'] || headers['trace-id'];
    return traceId || this.generate();
  }
}

/**
 * 创建一个增强的 Winston Logger 实例
 * @param config - 应用程序配置，用于获取日志级别
 * @returns 配置好的增强日志器实例
 */
export function createEnhancedLogger(config: AppConfig): EnhancedLogger {
  const { combine, timestamp, json, colorize, simple, printf } = winston.format;

  // 确保日志目录存在
  const logsDir = path.resolve(process.cwd(), 'logs');
  try {
    fs.mkdirSync(logsDir, { recursive: true });
  } catch {
    // 目录创建失败不应阻断应用启动，继续使用控制台输出
  }

  // 自定义日志格式
  const customFormat = printf(
    ({ level, message, tag, traceId, timestamp, ...meta }) => {
      const logObj = {
        timestamp,
        level: level.toUpperCase(),
        tag: tag || 'UNKNOWN',
        traceId: traceId || 'N/A',
        message,
        ...meta,
      };
      return JSON.stringify(logObj);
    },
  );

  const logger = winston.createLogger({
    level: config.log.level, // 从配置中获取日志级别
    format: combine(timestamp(), customFormat), // 使用自定义格式进行结构化日志输出
    transports: [
      // 配置控制台传输器
      new winston.transports.Console({
        format: combine(
          colorize(),
          printf(({ level, message, tag, traceId, timestamp, ...meta }) => {
            const traceIdStr = traceId ? `[${traceId}]` : '';
            return `${timestamp} ${level} [${tag || 'UNKNOWN'}]${traceIdStr} ${message} ${
              Object.keys(meta).length > 0 ? JSON.stringify(meta) : ''
            }`;
          }),
        ),
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
      // 错误日志单独文件
      new DailyRotateFile({
        dirname: logsDir,
        filename: 'error-%DATE%.log',
        datePattern: config.log?.datePattern || 'YYYY-MM-DD',
        zippedArchive: config.log?.zippedArchive ?? true,
        maxSize: config.log?.maxSize || '20m',
        maxFiles: config.log?.maxFiles || '14d',
        level: 'error',
      }),
    ],
  });

  // TODO: 未来可集成 Sentry 进行错误上报

  return new WinstonEnhancedLogger(logger);
}

/**
 * 默认的增强日志器实例，方便在未明确配置时使用
 * 其配置是最小化的，仅为满足 AppConfig 接口要求
 */
export const enhancedLogger: EnhancedLogger = createEnhancedLogger({
  log: { level: 'info' },
  // 为满足 AppConfig 接口，提供模拟值（实际应用中请使用真实配置）
  openai: { baseUrl: '', apiKey: '', model: '' },
  llm: {
    provider: 'openai',
    apiKey: '',
    model: '',
    semanticSplitting: { enabled: false },
  },
  db: { type: 'sqlite', path: '' },
  qdrant: { url: '', collection: '', vectorSize: 0 },
  embedding: { batchSize: 0 },
  api: { port: 0 },
  gc: { intervalHours: 0 },
  rateLimit: {},
});

/**
 * 兼容性适配器，将增强的日志器适配为原始日志器接口
 */
export class LoggerAdapter implements Logger {
  private enhancedLogger: EnhancedLogger;
  private defaultTag: LogTag;

  constructor(
    enhancedLogger: EnhancedLogger,
    defaultTag: LogTag = LogTag.SYSTEM,
  ) {
    this.enhancedLogger = enhancedLogger;
    this.defaultTag = defaultTag;
  }

  /**
   * 通过增强 Logger 输出调试日志。
   * @param message 日志消息
   * @param args 其他上下文
   */
  debug(message: string, ...args: unknown[]): void {
    this.enhancedLogger.debug(message, this.defaultTag, { args });
  }

  /**
   * 输出信息级别日志。
   * @param message 日志消息
   * @param args 其他上下文
   */
  info(message: string, ...args: unknown[]): void {
    this.enhancedLogger.info(message, this.defaultTag, { args });
  }

  /**
   * 输出警告级别日志。
   * @param message 日志消息
   * @param args 其他上下文
   */
  warn(message: string, ...args: unknown[]): void {
    this.enhancedLogger.warn(message, this.defaultTag, { args });
  }

  /**
   * 输出错误级别日志。
   * @param message 日志消息
   * @param args 其他上下文
   */
  error(message: string, ...args: unknown[]): void {
    this.enhancedLogger.error(message, this.defaultTag, { args });
  }
}

