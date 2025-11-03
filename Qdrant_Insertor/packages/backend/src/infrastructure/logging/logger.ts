/**
 * @file 日志模块，基�?Winston 实现结构化、分级别的日志输出�?
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import fs from 'node:fs';
import path from 'node:path';
import { AppConfig } from '@config/config.js';

/**
 * @interface Logger
 * @description 定义日志器接口，支持不同级别的日志输出�?
 */
export interface Logger {
  /**
   * @method debug
   * @description 输出调试级别日志�?
   * @param {string} message - 日志消息�?
   * @param {...unknown[]} args - 额外参数�?
   */
  debug(message: string, ...args: unknown[]): void;
  /**
   * @method info
   * @description 输出信息级别日志�?
   * @param {string} message - 日志消息�?
   * @param {...unknown[]} args - 额外参数�?
   */
  info(message: string, ...args: unknown[]): void;
  /**
   * @method warn
   * @description 输出警告级别日志�?
   * @param {string} message - 日志消息�?
   * @param {...unknown[]} args - 额外参数�?
   */
  warn(message: string, ...args: unknown[]): void;
  /**
   * @method error
   * @description 输出错误级别日志�?
   * @param {string} message - 日志消息�?
   * @param {...unknown[]} args - 额外参数�?
   */
  error(message: string, ...args: unknown[]): void;
}

/**
 * @function createLogger
 * @description 创建一�?Winston Logger 实例�?
 * @param {AppConfig} config - 应用程序配置，用于获取日志级别�?
 * @returns {Logger} 配置好的日志器实例�?
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
    format: combine(timestamp(), json()), // 结合时间戳和 JSON 格式进行结构化日志输�?
    transports: [
      // 配置控制台传输器
      new winston.transports.Console({
        format: combine(colorize(), simple()), // 控制台输出带颜色和简洁格�?
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

  // TODO: 未来可集�?Sentry 进行错误上报�?

  return logger;
}

/**
 * @constant logger
 * @description 默认的日志器实例，方便在未明确配置时使用�?
 *              其配置是最小化的，仅为满足 AppConfig 接口要求�?
 */
export const logger: Logger = createLogger({
  log: { level: 'info' },
  // 为满�?AppConfig 接口，提供模拟值。在实际应用中，应使用完整配置创�?Logger�?
  openai: { baseUrl: '', apiKey: '', model: '' },
  db: { path: '' },
  qdrant: { url: '', collection: '', vectorSize: 0 },
  embedding: { batchSize: 0 },
  api: { port: 0 },
  gc: { intervalHours: 0 }, // 新增 gc 属性以符合 AppConfig 接口
});
