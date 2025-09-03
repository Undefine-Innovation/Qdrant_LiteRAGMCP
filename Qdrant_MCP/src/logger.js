import winston from 'winston';
import path from 'path';

/**
 * @summary This module sets up a centralized logging system using the Winston library.
 * It's configured to output logs to both files and the console, ensuring that
 * debugging information can be captured without interfering with the MCP's stdio communication.
 *
 * @summary 此模块使用 Winston 库建立一个集中的日志系统。
 * 它被配置为将日志同时输出到文件和控制台，确保在不干扰 MCP 的 stdio 通信的情况下
 * 捕获调试信息。
 */

// Step 1: Define log directory and file paths.
// 步骤 1: 定义日志目录和文件路径。
const logDir = 'logs';
const logFile = path.join(logDir, 'server.log');

// Step 2: Create a logger instance with specific configurations.
// 步骤 2: 创建一个具有特定配置的 logger 实例。
const logger = winston.createLogger({
  // Set the default minimum logging level. 'info' means logs of level 'info', 'warn', and 'error' will be processed.
  // 设置默认的最低日志级别。'info' 表示 'info'、'warn' 和 'error' 级别的日志都将被处理。
  level: 'info',

  // Define the format for log entries.
  // 定义日志条目的格式。
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), // Add a timestamp. 添加时间戳。
    winston.format.errors({ stack: true }), // Log the full error stack trace. 记录完整的错误堆栈。
    winston.format.splat(), // Enable string interpolation. 启用字符串插值。
    winston.format.json() // Format logs as JSON. 将日志格式化为 JSON。
  ),

  // Define default metadata to be included in all logs from this logger.
  // 定义将包含在此 logger 所有日志中的默认元数据。
  defaultMeta: { service: 'qdrant-mcp-server' },

  // Define "transports" - the destinations for the logs.
  // 定义“传输层” - 即日志的目标位置。
  transports: [
    // Transport 1: Write all logs of level 'info' and below to `server.log`.
    // 传输 1: 将所有 'info' 及以下级别的日志写入 `server.log`。
    new winston.transports.File({ filename: logFile, level: 'info' }),

    // Transport 2: Write all logs of level 'error' and below to `error.log`.
    // 传输 2: 将所有 'error' 及以下级别的日志写入 `error.log`。
    new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }),

    // Transport 3: Output logs to the console.
    // 传输 3: 将日志输出到控制台。
    new winston.transports.Console({
      // Use a simpler, colorized format for console readability.
      // 为控制台使用更简洁、带颜色的格式以提高可读性。
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
      // CRITICAL: Direct all log levels to stderr. This prevents log messages from being
      // interpreted as MCP responses on stdout, which would break the communication protocol.
      // 关键: 将所有日志级别都导向 stderr。这可以防止日志消息在 stdout 上被误解为
      // MCP 响应，从而避免破坏通信协议。
      stderrLevels: ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']
    })
  ],

  // Configure handling for uncaught exceptions.
  // 配置对未捕获异常的处理。
  exceptionHandlers: [
    new winston.transports.File({ filename: path.join(logDir, 'exceptions.log') })
  ],
  exitOnError: false, // Prevent the application from exiting on a handled exception.
});

// Step 3: Export the configured logger for use in other modules.
// 步骤 3: 导出已配置的 logger，以便在其他模块中使用。
export default logger;