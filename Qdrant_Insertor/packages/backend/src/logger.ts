/**
 * @file 日志模块，基于 Winston 实现结构化、分级别的日志输出。
 */

import winston from 'winston';
import { AppConfig } from './config.js';

/**
 * @interface Logger
 * @description 定义日志器接口，支持不同级别的日志输出。
 */
export interface Logger {
  /**
   * @method debug
   * @description 输出调试级别日志。
   * @param {string} message - 日志消息。
   * @param {...unknown[]} args - 额外参数。
   */
  debug(message: string, ...args: unknown[]): void;
  /**
   * @method info
   * @description 输出信息级别日志。
   * @param {string} message - 日志消息。
   * @param {...unknown[]} args - 额外参数。
   */
  info(message: string, ...args: unknown[]): void;
  /**
   * @method warn
   * @description 输出警告级别日志。
   * @param {string} message - 日志消息。
   * @param {...unknown[]} args - 额外参数。
   */
  warn(message: string, ...args: unknown[]): void;
  /**
   * @method error
   * @description 输出错误级别日志。
   * @param {string} message - 日志消息。
   * @param {...unknown[]} args - 额外参数。
   */
  error(message: string, ...args: unknown[]): void;
}

/**
 * @function createLogger
 * @description 创建一个 Winston Logger 实例。
 * @param {AppConfig} config - 应用程序配置，用于获取日志级别。
 * @returns {Logger} 配置好的日志器实例。
 */
export function createLogger(config: AppConfig): Logger {
  const { combine, timestamp, json, colorize, simple } = winston.format;

  const logger = winston.createLogger({
    level: config.log.level, // 从配置中获取日志级别
    format: combine(timestamp(), json()), // 结合时间戳和 JSON 格式进行结构化日志输出
    transports: [
      // 配置控制台传输器
      new winston.transports.Console({
        format: combine(colorize(), simple()), // 控制台输出带颜色和简洁格式
      }),
      // 配置文件传输器，日志写入 logs/app.log
      new winston.transports.File({ filename: 'logs/app.log' }),
    ],
  });

  // TODO: 未来可集成 Sentry 进行错误上报。

  return logger;
}

/**
 * @constant logger
 * @description 默认的日志器实例，方便在未明确配置时使用。
 *              其配置是最小化的，仅为满足 AppConfig 接口要求。
 */
export const logger: Logger = createLogger({
  log: { level: 'info' },
  // 为满足 AppConfig 接口，提供模拟值。在实际应用中，应使用完整配置创建 Logger。
  openai: { baseUrl: '', apiKey: '', model: '' },
  db: { path: '' },
  qdrant: { url: '', collection: '', vectorSize: 0 },
  embedding: { batchSize: 0 },
  api: { port: 0 },
  gc: { intervalHours: 0 }, // 新增 gc 属性以符合 AppConfig 接口
});
