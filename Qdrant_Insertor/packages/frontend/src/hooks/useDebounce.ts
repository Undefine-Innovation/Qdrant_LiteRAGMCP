import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * 防抖Hook配置接口
 */
interface DebounceConfig {
  /** 延迟时间（毫秒） */
  delay: number;
  /** 是否在延迟开始前立即执行 */
  leading?: boolean;
  /** 是否在延迟结束后立即执行 */
  trailing?: boolean;
  /** 最大等待时间（毫秒），超过此时间将强制执行 */
  maxWait?: number;
}

/**
 * 防抖Hook返回值接口
 */
interface DebounceReturn<T> {
  /** 防抖后的值 */
  debouncedValue: T;
  /** 取消防抖 */
  cancel: () => void;
  /** 立即执行防抖函数 */
  flush: () => void;
  /** 检查是否有待执行的防抖函数 */
  pending: () => boolean;
}

/**
 * 高级防抖Hook
 * @param value 需要防抖的值
 * @param config 防抖配置
 * @returns 防抖后的值和控制函数
 */
export const useDebounce = <T>(
  value: T,
  config: number | DebounceConfig,
): DebounceReturn<T> => {
  const {
    delay,
    leading = false,
    trailing = true,
    maxWait,
  } = typeof config === 'number' ? { delay: config } : config;

  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastCallTimeRef = useRef<number>(Date.now());
  const lastInvokeTimeRef = useRef<number>(0);
  const pendingRef = useRef<boolean>(false);

  const invokeFunc = useCallback(() => {
    const time = Date.now();
    const timeSinceLastCall = time - lastCallTimeRef.current;
    const timeSinceLastInvoke = time - lastInvokeTimeRef.current;

    // 检查是否应该执行
    if (timeSinceLastCall >= delay && timeSinceLastInvoke >= delay) {
      setDebouncedValue(value);
      lastInvokeTimeRef.current = time;
      pendingRef.current = false;
    }
  }, [value, delay]);

  const startTimer = useCallback((pendingFunc: () => void, wait: number) => {
    timeoutRef.current = setTimeout(pendingFunc, wait);
  }, []);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (maxTimeoutRef.current) {
      clearTimeout(maxTimeoutRef.current);
      maxTimeoutRef.current = null;
    }
    pendingRef.current = false;
  }, []);

  const flush = useCallback(() => {
    if (pendingRef.current) {
      invokeFunc();
      cancel();
    }
  }, [invokeFunc, cancel]);

  const pending = useCallback(() => pendingRef.current, []);

  useEffect(() => {
    lastCallTimeRef.current = Date.now();
    pendingRef.current = true;

    // Leading edge
    if (leading && lastInvokeTimeRef.current === 0) {
      setDebouncedValue(value);
      lastInvokeTimeRef.current = Date.now();
    }

    // Trailing edge
    if (trailing) {
      startTimer(invokeFunc, delay);
    }

    // Max wait
    if (maxWait) {
      const remainingWait = maxWait - (Date.now() - lastInvokeTimeRef.current);
      maxTimeoutRef.current = setTimeout(invokeFunc, remainingWait);
    }

    return cancel;
  }, [
    value,
    delay,
    leading,
    trailing,
    maxWait,
    startTimer,
    invokeFunc,
    cancel,
  ]);

  return {
    debouncedValue,
    cancel,
    flush,
    pending,
  };
};

/**
 * 简单防抖Hook（向后兼容）
 * @param value 需要防抖的值
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的值
 */
export const useSimpleDebounce = <T>(value: T, delay: number): T => {
  const { debouncedValue } = useDebounce(value, { delay });
  return debouncedValue;
};

export default useDebounce;
