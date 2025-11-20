import { AppError } from '@api/contracts/error.js';
import { CoreError } from '@domain/errors/CoreError.js';
import { ErrorContext } from '@domain/errors/index.js';

/**
 * 错误映射策略接口
 */
export interface ErrorMappingStrategy {
  /** 策略名称 */
  name: string;
  /** 优先级（数字越小优先级越高） */
  priority: number;
  /** 是否可以处理指定的错误 */
  canHandle(error: Error): boolean;
  /** 将错误映射为AppError */
  map(error: Error, context?: ErrorContext): AppError;
  /** 将错误映射为CoreError（可选） */
  mapToUnified?(error: Error, context?: ErrorContext): CoreError;
}

/**
 * 统一错误映射策略接口
 */
export interface UnifiedErrorMappingStrategy {
  /** 策略名称 */
  name: string;
  /** 优先级（数字越小优先级越高） */
  priority: number;
  /** 是否可以处理指定的错误 */
  canHandle(error: Error): boolean;
  /** 将错误映射为CoreError */
  map(error: Error, context?: ErrorContext): CoreError;
}
