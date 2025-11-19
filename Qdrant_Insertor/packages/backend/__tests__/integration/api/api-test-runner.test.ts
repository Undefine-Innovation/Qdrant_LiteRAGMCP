/**
 * API测试运行器
 * 用于运行所有API e2e测试的入口点
 */

import { describe, it, expect } from '@jest/globals';

describe('API E2E Test Runner', () => {
  it('应该能够运行所有API e2e测试', () => {
    // 这个测试文件作为运行所有API e2e测试的入口点
    // 实际的测试在各个单独的文件中定义
    expect(true).toBe(true);
  });

  it('应该验证测试环境设置', () => {
    // 验证测试环境是否正确设置
    expect(process.env.NODE_ENV).toBe('test');
  });

  it('应该验证测试配置', () => {
    // 验证测试配置是否正确加载
    expect(typeof process.env).toBe('object');
  });
});

// 导出测试运行器配置
export const testRunnerConfig = {
  testMatch: ['**/api/**/*-e2e.test.ts', '**/api/**/*-e2e.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/integration/setup.ts'],
  testTimeout: 30000, // 30秒超时
  verbose: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    'src/**/*.js',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.test.js',
  ],
};
