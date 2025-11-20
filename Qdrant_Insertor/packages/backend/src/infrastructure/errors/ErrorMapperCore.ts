import { AppError } from '@api/contracts/error.js';
import { CoreError } from '@domain/errors/CoreError.js';
import { ErrorFactory, ErrorContext } from '@domain/errors/index.js';
import { ErrorCategory } from '@domain/sync/retry.js';
import {
  ErrorMappingStrategy,
  UnifiedErrorMappingStrategy,
} from './ErrorMapperInterfaces.js';

const toAppError = (error: Error): AppError =>
  error instanceof AppError ? error : AppError.fromError(error);

const toCoreError = (error: Error, context?: ErrorContext): CoreError =>
  error instanceof CoreError ? error : CoreError.fromError(error, context);

/**
 * 错误映射器类
 * 提供错误映射策略的管理和执行
 */
export class ErrorMapper {
  private strategies: ErrorMappingStrategy[] = [];
  private unifiedStrategies: UnifiedErrorMappingStrategy[] = [];

  constructor() {
    // 策略在 index.ts 中注册
    // 导入默认策略（使用已定义接口类型以避免 `any`）
    let DefaultErrorMappingStrategy: { new (): ErrorMappingStrategy };
    try {
      const DefaultStrategy = require('./ErrorStrategiesBase.js') as {
        DefaultErrorMappingStrategy: { new (): ErrorMappingStrategy };
      };
      DefaultErrorMappingStrategy = DefaultStrategy.DefaultErrorMappingStrategy;
    } catch {
      // 使用内联实现
      DefaultErrorMappingStrategy = class DefaultErrorMappingStrategy
        implements ErrorMappingStrategy
      {
        name = 'DefaultErrorMapping';
        priority = 999;
        canHandle(error: Error): boolean {
          return true;
        }
        map(error: Error, context?: ErrorContext): AppError {
          const ErrorFactory = require('@domain/errors/index.js').ErrorFactory;
          return toAppError(ErrorFactory.fromError(error, context));
        }
      };
    }
  }

  /**
   * 注册错误映射策略
   * @param strategy 映射策略
   */
  registerStrategy(strategy: ErrorMappingStrategy): void {
    this.strategies.push(strategy);
    // 按优先级排序
    this.strategies.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 移除错误映射策略
   * @param strategyName 策略名称
   */
  removeStrategy(strategyName: string): void {
    this.strategies = this.strategies.filter((s) => s.name !== strategyName);
  }

  /**
   * 获取所有已注册的策略
   * @returns 策略列表
   */
  getStrategies(): ErrorMappingStrategy[] {
    return [...this.strategies];
  }

  /**
   * 将错误映射为AppError
   * @param error 原始错误
   * @param context 错误上下文
   * @returns 映射后的AppError
   */
  map(error: Error, context?: ErrorContext): AppError {
    // 如果已经是AppError，直接返回
    if (error instanceof AppError) {
      return error;
    }

    // 遍历策略，找到第一个可以处理的策略
    for (const strategy of this.strategies) {
      if (strategy.canHandle(error)) {
        try {
          return strategy.map(error, context);
        } catch (mappingError) {
          // 如果映射失败，记录错误并继续尝试下一个策略
          console.error(
            `Error mapping strategy '${strategy.name}' failed:`,
            mappingError,
          );
          continue;
        }
      }
    }

    // 如果所有策略都失败，使用默认策略
    return toAppError(toCoreError(error, context));
  }

  /**
   * 批量映射错误
   * @param errors 错误数组
   * @param context 错误上下文
   * @returns 映射后的AppError数组
   */
  mapBatch(errors: Error[], context?: ErrorContext): AppError[] {
    return errors.map((error) => this.map(error, context));
  }

  /**
   * 创建带有上下文的错误映射器
   * @param baseContext 基础上下文
   * @returns 带有上下文的错误映射器
   */
  withContext(baseContext: ErrorContext): {
    map: (error: Error, additionalContext?: ErrorContext) => AppError;
    mapBatch: (errors: Error[], additionalContext?: ErrorContext) => AppError[];
  } {
    return {
      map: (error: Error, additionalContext?: ErrorContext) => {
        const mergedContext = { ...baseContext, ...additionalContext };
        return this.map(error, mergedContext);
      },
      mapBatch: (errors: Error[], additionalContext?: ErrorContext) => {
        const mergedContext = { ...baseContext, ...additionalContext };
        return this.mapBatch(errors, mergedContext);
      },
    };
  }

  /**
   * 注册统一错误映射策略
   * @param strategy 统一错误映射策略
   */
  registerUnifiedStrategy(strategy: UnifiedErrorMappingStrategy): void {
    this.unifiedStrategies.push(strategy);
    // 按优先级排序
    this.unifiedStrategies.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 移除统一错误映射策略
   * @param strategyName 策略名称
   */
  removeUnifiedStrategy(strategyName: string): void {
    this.unifiedStrategies = this.unifiedStrategies.filter(
      (s) => s.name !== strategyName,
    );
  }

  /**
   * 获取所有已注册的统一策略
   * @returns 统一策略列表
   */
  getUnifiedStrategies(): UnifiedErrorMappingStrategy[] {
    return [...this.unifiedStrategies];
  }

  /**
   * 将错误映射为UnifiedError
   * @param error 原始错误
   * @param context 错误上下文
   * @returns 映射后的UnifiedError
   */
  mapToUnified(error: Error, context?: ErrorContext): CoreError {
    // 如果已经是CoreError，直接返回
    if (error instanceof CoreError) {
      return error;
    }

    // 遍历统一策略，找到第一个可以处理的策略
    for (const strategy of this.unifiedStrategies) {
      if (strategy.canHandle(error)) {
        try {
          return strategy.map(error, context);
        } catch (mappingError) {
          // 如果映射失败，记录错误并继续尝试下一个策略
          console.error(
            `Unified error mapping strategy '${strategy.name}' failed:`,
            mappingError,
          );
          continue;
        }
      }
    }

    // 如果所有策略都失败，使用默认策略
    return toCoreError(error, context);
  }

  /**
   * 批量映射为统一错误
   * @param errors 错误数组
   * @param context 错误上下文
   * @returns 映射后的UnifiedError数组
   */
  mapBatchToUnified(errors: Error[], context?: ErrorContext): CoreError[] {
    return errors.map((error) => this.mapToUnified(error, context));
  }

  /**
   * 根据错误分类映射为统一错误
   * @param category 错误分类
   * @param error 原始错误
   * @param context 错误上下文
   * @returns 映射后的UnifiedError
   */
  mapByCategoryToUnified(
    category: ErrorCategory,
    error: Error,
    context?: ErrorContext,
  ): CoreError {
    return toCoreError(error, context);
  }

  /**
   * 智能映射错误（优先使用统一错误，回退到AppError）
   * @param error 原始错误
   * @param context 错误上下文
   * @param preferUnified 是否优先使用统一错误
   * @returns 映射后的错误
   */
  smartMap(
    error: Error,
    context?: ErrorContext,
    preferUnified: boolean = true,
  ): AppError | CoreError {
    if (preferUnified) {
      try {
        return this.mapToUnified(error, context);
      } catch {
        // 如果统一错误映射失败，回退到AppError
        return this.map(error, context);
      }
    } else {
      try {
        return this.map(error, context);
      } catch {
        // 如果AppError映射失败，尝试统一错误
        return this.mapToUnified(error, context);
      }
    }
  }

  /**
   * 分析错误类型
   * @param error 错误对象
   * @returns 错误分析结果
   */
  analyzeError(error: Error): {
    isAppError: boolean;
    isCoreError: boolean;
    isTransactionError: boolean;
    errorType: string;
    suggestedStrategy: string;
    shouldRetry: boolean;
    shouldAlert: boolean;
  } {
    const isAppError = error instanceof AppError;
    const isCoreError = error instanceof CoreError;
    const isTransactionError = false; // 简化后不再有单独的事务错误类

    let errorType = 'Unknown';
    let suggestedStrategy = 'DefaultErrorMapping';
    let shouldRetry = false;
    let shouldAlert = false;

    if (isAppError) {
      errorType = 'AppError';
      suggestedStrategy = 'AppErrorMapping';
      shouldRetry = [500, 502, 503, 504].includes(error.httpStatus);
      shouldAlert = error.httpStatus >= 500;
    } else if (isCoreError) {
      errorType = 'CoreError';
      suggestedStrategy = 'CoreErrorMapping';
      shouldRetry = error.isTemporary();
      shouldAlert = error.isCritical();
    }

    return {
      isAppError,
      isCoreError,
      isTransactionError,
      errorType,
      suggestedStrategy,
      shouldRetry,
      shouldAlert,
    };
  }

  /**
   * 根据错误分类映射错误
   * @param category 错误分类
   * @param error 原始错误
   * @param context 错误上下文
   * @returns 映射后的AppError
   */
  mapByCategory(
    category: ErrorCategory,
    error: Error,
    context?: ErrorContext,
  ): AppError {
    return toAppError(toCoreError(error, context));
  }
}
