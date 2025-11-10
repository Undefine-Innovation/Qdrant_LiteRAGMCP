/**
 * 错误处理机制测试
 * 用于验证错误处理组件和工具的功能
 */

import type { ApiError } from '../services/api-client';
import { getErrorMessage } from '../components/ErrorMessage';
import { RetryHandler } from './errorHandler';

/**
 * 测试错误消息映射
 */
export const testErrorMessageMapping = () => {
  console.log('测试错误消息映射...');

  const testCases: Array<{ code: string; expectedMessage: string }> = [
    {
      code: 'VALIDATION_ERROR',
      expectedMessage: '输入数据验证失败，请检查您的输入',
    },
    { code: 'NOT_FOUND', expectedMessage: '请求的资源不存在' },
    { code: 'UNAUTHORIZED', expectedMessage: '您没有权限执行此操作' },
    {
      code: 'INTERNAL_SERVER_ERROR',
      expectedMessage: '服务器内部错误，请稍后重试',
    },
    { code: 'NETWORK_ERROR', expectedMessage: '网络连接失败，请检查网络' },
    { code: 'UNKNOWN_ERROR', expectedMessage: '发生未知错误' },
  ];

  testCases.forEach(({ code, expectedMessage }) => {
    const error: ApiError = { code, message: 'Test message' };
    const actualMessage = getErrorMessage(error);

    if (actualMessage === expectedMessage) {
      console.log(`✅ ${code}: ${actualMessage}`);
    } else {
      console.error(
        `❌ ${code}: 期望 "${expectedMessage}", 实际 "${actualMessage}"`,
      );
    }
  });
};

/**
 * 测试重试机制
 */
export const testRetryMechanism = async () => {
  console.log('测试重试机制...');

  let attemptCount = 0;
  const mockFn = async () => {
    attemptCount++;
    console.log(`尝试第 ${attemptCount} 次`);

    if (attemptCount < 3) {
      const error: ApiError = {
        code: 'NETWORK_ERROR',
        message: '模拟网络错误',
      };
      throw error;
    }

    return '成功';
  };

  try {
    const result = await RetryHandler.withRetry(mockFn, {
      maxRetries: 3,
      delay: 100,
      shouldRetry: error => {
        const apiError = error as ApiError;
        return apiError.code === 'NETWORK_ERROR';
      },
    });

    console.log(`✅ 重试成功，结果: ${result}`);
  } catch (error) {
    console.error(`❌ 重试失败:`, error);
  }
};

/**
 * 测试错误分类
 */
export const testErrorClassification = () => {
  console.log('测试错误分类...');

  const testErrors: Array<ApiError> = [
    { code: 'VALIDATION_ERROR', message: '验证失败' },
    { code: 'NOT_FOUND', message: '资源未找到' },
    { code: 'FILE_TOO_LARGE', message: '文件过大' },
    { code: 'UNSUPPORTED_FILE_TYPE', message: '不支持的文件类型' },
    { code: 'INTERNAL_SERVER_ERROR', message: '服务器错误' },
  ];

  testErrors.forEach(error => {
    const message = getErrorMessage(error);
    console.log(`错误分类: ${error.code} -> ${message}`);
  });
};

/**
 * 运行所有测试
 */
export const runErrorHandlingTests = async () => {
  console.log('🧪 开始错误处理机制测试...\n');

  try {
    testErrorMessageMapping();
    console.log('\n');

    await testRetryMechanism();
    console.log('\n');

    testErrorClassification();

    console.log('\n✅ 所有错误处理测试完成');
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
};

// 如果在浏览器环境中，将测试函数暴露到全局对象
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).errorHandlingTests = {
    runErrorHandlingTests,
    testErrorMessageMapping,
    testRetryMechanism,
    testErrorClassification,
  };

  console.log('错误处理测试函数已暴露到 window.errorHandlingTests');
  console.log(
    '在控制台中运行: window.errorHandlingTests.runErrorHandlingTests()',
  );
}
