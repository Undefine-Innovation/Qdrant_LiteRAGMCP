import { RetryStrategy } from './retry.js';

/**
 * 计算延迟时间（指数退避 + 随机抖动）
 * @param retryCount 重试次数
 * @param strategy 重试策略
 * @returns 延迟时间（毫秒）
 */
export function calculateDelay(
  retryCount: number,
  strategy: RetryStrategy,
): number {
  // 指数退避计算: delay = initialDelay * (backoffMultiplier ^ (retryCount - 1))
  let delay =
    strategy.initialDelayMs *
    Math.pow(strategy.backoffMultiplier, retryCount - 1);

  // 限制最大延迟
  delay = Math.min(delay, strategy.maxDelayMs);

  // 添加随机抖动
  if (strategy.jitter) {
    const jitterAmount = delay * strategy.jitterRange;
    const randomJitter = (Math.random() * 2 - 1) * jitterAmount; // -jitterAmount 到 +jitterAmount
    delay = delay + randomJitter;
  }

  // 确保延迟不为负数
  return Math.max(0, Math.floor(delay));
}

/**
 * 生成唯一的任务ID
 * @param docId 文档ID
 * @returns 任务ID
 */
export function generateTaskId(docId: string): string {
  return `retry_${docId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 格式化延迟时间为可读字符串
 * @param delayMs 延迟时间（毫秒）
 * @returns 格式化的延迟时间字符串
 */
export function formatDelay(delayMs: number): string {
  if (delayMs < 1000) {
    return `${delayMs}ms`;
  } else if (delayMs < 60000) {
    return `${(delayMs / 1000).toFixed(1)}s`;
  } else {
    return `${(delayMs / 60000).toFixed(1)}m`;
  }
}

/**
 * 计算重试成功率
 * @param successfulRetries 成功重试次数
 * @param totalRetries 总重试次数
 * @returns 成功率（0-1之间）
 */
export function calculateSuccessRate(
  successfulRetries: number,
  totalRetries: number,
): number {
  if (totalRetries === 0) {
    return 0;
  }
  return successfulRetries / totalRetries;
}

/**
 * 计算平均重试时间
 * @param retryTimes 重试时间数组
 * @returns 平均重试时间（毫秒）
 */
export function calculateAverageRetryTime(retryTimes: number[]): number {
  if (retryTimes.length === 0) {
    return 0;
  }

  const sum = retryTimes.reduce((acc, time) => acc + time, 0);
  return sum / retryTimes.length;
}

/**
 * 更新重试时间数组，保持最大长度
 * @param retryTimes 重试时间数组
 * @param newTime 新的重试时间
 * @param maxLength 最大长度
 * @returns 更新后的重试时间数组
 */
export function updateRetryTimes(
  retryTimes: number[],
  newTime: number,
  maxLength: number = 1000,
): number[] {
  retryTimes.push(newTime);
  if (retryTimes.length > maxLength) {
    return retryTimes.slice(-maxLength);
  }
  return retryTimes;
}
