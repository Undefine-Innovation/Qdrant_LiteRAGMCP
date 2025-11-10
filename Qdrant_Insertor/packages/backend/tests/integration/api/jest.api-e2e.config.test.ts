/**
 * Jest API E2E测试配置
 * 专门用于API端到端测试的Jest配置
 */

import { Config } from '@jest/types';

const config: Config = {
  // 测试环境
  testEnvironment: 'node',
  
  // 测试文件匹配模式
  testMatch: [
    '**/api/**/*-e2e.test.ts',
    '**/api/**/*-e2e.test.js',
  ],
  
  // 设置文件
  setupFilesAfterEnv: ['<rootDir>/../setup.ts'],
  
  // 测试超时
  testTimeout: 30000, // 30秒
  
  // 详细输出
  verbose: true,
  
  // 覆盖率配置
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
  
  // 覆盖率收集范围
  collectCoverageFrom: [
    'src/**/*.ts',
    'src/**/*.js',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.test.js',
  ],
  
  // 忽略的路径
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
  ],
  
  // 模块路径映射
  moduleNameMapping: {
    '^@domain/(.*)$': '<rootDir>/src/domain/$1',
    '^@infrastructure/(.*)$': '<rootDir>/src/infrastructure/$1',
    '^@application/(.*)$': '<rootDir>/src/application/$1',
    '^@api/(.*)$': '<rootDir>/src/api/$1',
    '^@logging/(.*)$': '<rootDir>/src/infrastructure/logging/$1',
  },
  
  // 转换配置
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.ts$': 'ts-jest',
  },
  
  // 忽略转换的路径
  transformIgnorePatterns: [
    '/node_modules/',
  ],
  
  // 清理模拟
  clearMocks: true,
  restoreMocks: true,
  
  // 错误处理
  errorOnDeprecated: true,
};

export default config;

test('config loads', () => {
  expect(true).toBe(true);
});
