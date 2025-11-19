import { ErrorContext } from './CoreError.js';

/**
 * 错误上下文管理器
 * 负责创建和管理错误上下文
 */
export class ErrorHandler {
  /**
   * 创建错误上下文
   * @param options 上下文选项对象
   * @param options.operation 操作名称
   * @param options.userId 用户ID
   * @param options.requestId 请求ID
   * @param options.transactionId 事务ID
   * @param options.resourceId 资源ID
   * @param options.sessionId 会话ID
   * @param options.traceId 跟踪ID
   * @param options.module 模块名称
   * @param options.function 函数名称
   * @param options.line 行号
   * @param options.file 文件名
   * @returns 错误上下文
   */
  static createContext(options: {
    operation?: string;
    userId?: string;
    requestId?: string;
    transactionId?: string;
    resourceId?: string;
    sessionId?: string;
    traceId?: string;
    module?: string;
    function?: string;
    line?: number;
    file?: string;
    [key: string]: unknown;
  }): ErrorContext {
    return { ...options };
  }

  /**
   * 合并错误上下文
   * @param baseContext 基础上下文
   * @param additionalContext 额外上下文
   * @returns 合并后的上下文
   */
  static mergeContext(
    baseContext?: ErrorContext,
    additionalContext?: ErrorContext,
  ): ErrorContext | undefined {
    if (!baseContext && !additionalContext) {
      return undefined;
    }

    return {
      ...baseContext,
      ...additionalContext,
    };
  }

  /**
   * 合并错误详情和上下文
   * @param details 错误详情
   * @param context 错误上下文
   * @returns 合并后的详情对象
   */
  static mergeDetails(
    details?: Record<string, unknown>,
    context?: ErrorContext,
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = {};

    if (details) {
      Object.assign(merged, details);
    }

    if (context) {
      Object.assign(merged, { context });
    }

    return merged;
  }

  /**
   * 从调用堆栈中提取上下文信息
   * @param stack 堆栈信息
   * @returns 提取的上下文信息
   */
  static extractContextFromStack(stack?: string): Partial<ErrorContext> {
    if (!stack) {
      return {};
    }

    const context: Partial<ErrorContext> = {};

    try {
      const lines = stack.split('\n');
      for (const line of lines) {
        // 尝试提取文件名和行号
        const match = line.match(/at\s+.*\((.*):(\d+):\d+\)/);
        if (match) {
          context.file = match[1];
          context.line = parseInt(match[2], 10);
          break;
        }
      }
    } catch (error) {
      // 忽略堆栈解析错误
    }

    return context;
  }

  /**
   * 创建带有调用堆栈信息的上下文
   * @param options 上下文选项
   * @param stack 堆栈信息
   * @returns 带有堆栈信息的上下文
   */
  static createContextWithStack(
    options: Parameters<typeof ErrorHandler.createContext>[0],
    stack?: string,
  ): ErrorContext {
    const stackContext = ErrorHandler.extractContextFromStack(stack);
    return ErrorHandler.createContext({
      ...options,
      ...stackContext,
    });
  }

  /**
   * 创建操作上下文
   * @param operation 操作名称
   * @param additionalOptions 额外选项
   * @returns 操作上下文
   */
  static createOperationContext(
    operation: string,
    additionalOptions?: Partial<
      Parameters<typeof ErrorHandler.createContext>[0]
    >,
  ): ErrorContext {
    return ErrorHandler.createContext({
      operation,
      ...additionalOptions,
    });
  }

  /**
   * 创建事务上下文
   * @param transactionId 事务ID
   * @param additionalOptions 额外选项
   * @returns 事务上下文
   */
  static createTransactionContext(
    transactionId: string,
    additionalOptions?: Partial<
      Parameters<typeof ErrorHandler.createContext>[0]
    >,
  ): ErrorContext {
    return ErrorHandler.createContext({
      transactionId,
      ...additionalOptions,
    });
  }

  /**
   * 创建用户上下文
   * @param userId 用户ID
   * @param additionalOptions 额外选项
   * @returns 用户上下文
   */
  static createUserContext(
    userId: string,
    additionalOptions?: Partial<
      Parameters<typeof ErrorHandler.createContext>[0]
    >,
  ): ErrorContext {
    return ErrorHandler.createContext({
      userId,
      ...additionalOptions,
    });
  }

  /**
   * 创建请求上下文
   * @param requestId 请求ID
   * @param additionalOptions 额外选项
   * @returns 请求上下文
   */
  static createRequestContext(
    requestId: string,
    additionalOptions?: Partial<
      Parameters<typeof ErrorHandler.createContext>[0]
    >,
  ): ErrorContext {
    return ErrorHandler.createContext({
      requestId,
      ...additionalOptions,
    });
  }

  /**
   * 创建资源上下文
   * @param resourceId 资源ID
   * @param additionalOptions 额外选项
   * @returns 资源上下文
   */
  static createResourceContext(
    resourceId: string,
    additionalOptions?: Partial<
      Parameters<typeof ErrorHandler.createContext>[0]
    >,
  ): ErrorContext {
    return ErrorHandler.createContext({
      resourceId,
      ...additionalOptions,
    });
  }

  /**
   * 创建模块上下文
   * @param module 模块名称
   * @param functionName 函数名称
   * @param additionalOptions 额外选项
   * @returns 模块上下文
   */
  static createModuleContext(
    module: string,
    functionName?: string,
    additionalOptions?: Partial<
      Parameters<typeof ErrorHandler.createContext>[0]
    >,
  ): ErrorContext {
    return ErrorHandler.createContext({
      module,
      function: functionName,
      ...additionalOptions,
    });
  }

  /**
   * 验证上下文完整性
   * @param context 错误上下文
   * @returns 验证结果
   */
  static validateContext(context: ErrorContext): {
    valid: boolean;
    missing: string[];
  } {
    const missing: string[] = [];

    // 检查必需的字段
    if (!context.operation && !context.module) {
      missing.push('operation or module');
    }

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * 清理上下文中的敏感信息
   * @param context 原始上下文
   * @param sensitiveFields 敏感字段列表
   * @returns 清理后的上下文
   */
  static sanitizeContext(
    context: ErrorContext,
    sensitiveFields: string[] = ['password', 'token', 'secret', 'key'],
  ): ErrorContext {
    const sanitized = { ...context };

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * 序列化上下文为JSON字符串
   * @param context 错误上下文
   * @returns JSON字符串
   */
  static serializeContext(context: ErrorContext): string {
    try {
      return JSON.stringify(context, null, 2);
    } catch (error) {
      return JSON.stringify({
        error: 'Failed to serialize context',
        originalError: String(error),
      });
    }
  }

  /**
   * 从JSON字符串反序列化上下文
   * @param contextJson JSON字符串
   * @returns 错误上下文
   */
  static deserializeContext(contextJson: string): ErrorContext | undefined {
    try {
      return JSON.parse(contextJson) as ErrorContext;
    } catch (error) {
      return undefined;
    }
  }
}

/**
 * 初始化全局错误日志记录器
 * @param logger 日志记录器
 */
export function initializeGlobalErrorLogger(logger: unknown): void {
  // 全局错误日志记录器初始化逻辑
}

/**
 * 记录错误
 * @param error 错误对象
 * @param context 错误上下文
 */
export function logError(error: Error, context?: unknown): void {
  // 错误记录逻辑
}

/**
 * 记录错误恢复
 * @param error 错误对象
 * @param recoveryAction 恢复操作
 */
export function logRecovery(error: Error, recoveryAction: string): void {
  // 错误恢复记录逻辑
}
