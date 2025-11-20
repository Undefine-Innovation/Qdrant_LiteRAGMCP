import { ErrorContext } from '@domain/errors/index.js';
import { ErrorFactory } from '@domain/errors/index.js';
import { AppError } from '@api/contracts/error.js';
import { ErrorMappingStrategy } from './ErrorMapperInterfaces.js';

const toAppError = (error: Error): AppError =>
  error instanceof AppError ? error : AppError.fromError(error);

/**
 * 默认错误映射策略
 */
export class DefaultErrorMappingStrategy implements ErrorMappingStrategy {
  name = 'DefaultErrorMapping';
  priority = 999;

  canHandle(error: Error): boolean {
    return true; // 默认策略总是可以处理
  }

  map(error: Error, context?: ErrorContext): AppError {
    return toAppError(ErrorFactory.fromError(error, context));
  }
}

/**
 * 基础错误映射策略抽象类
 */
export abstract class BaseErrorMappingStrategy implements ErrorMappingStrategy {
  abstract name: string;
  abstract priority: number;

  abstract canHandle(error: Error): boolean;
  abstract map(error: Error, context?: ErrorContext): AppError;

  /**
   * 检查错误消息是否包含指定关键词
   * @param error 错误对象
   * @param keywords 关键词列表
   * @returns 是否包含关键词
   */
  protected containsKeywords(error: Error, keywords: string[]): boolean {
    const message = error.message.toLowerCase();
    const name = error.constructor.name.toLowerCase();
    return keywords.some(
      (keyword) => message.includes(keyword) || name.includes(keyword),
    );
  }

  /**
   * 解析数据库错误消息对应的约束类型
   * @param message 错误消息
   * @returns 约束类型
   */
  protected extractConstraintType(message: string): string {
    if (message.includes('unique')) return 'UNIQUE';
    if (message.includes('foreign key')) return 'FOREIGN_KEY';
    if (message.includes('not null')) return 'NOT_NULL';
    if (message.includes('check')) return 'CHECK';
    return 'UNKNOWN';
  }
}
