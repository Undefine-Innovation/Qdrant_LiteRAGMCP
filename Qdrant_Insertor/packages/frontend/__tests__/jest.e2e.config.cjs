/**
 * Jest配置文件 - 端到端测试
 * 用于配置前端e2e测试环境
 */

module.exports = {
  // 测试环境
  testEnvironment: 'jsdom',
  
  // 测试文件匹配模式
  testMatch: [
    '<rootDir>/e2e/**/*.test.ts',
    '<rootDir>/e2e/**/*.test.tsx',
  ],
  
  // 设置文件
  setupFilesAfterEnv: ['<rootDir>/e2e/setup.ts'],
  
  // 模块路径映射
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../src/$1',
  },
  
  // 模块文件扩展名
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // 转换配置
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: '<rootDir>/../tsconfig.json',
    }],
  },
  
  // 忽略转换的文件
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))',
  ],
  
  // 覆盖率配置
  collectCoverage: false, // E2E测试通常不收集覆盖率
  
  // 测试超时
  testTimeout: 30000,
  
  // 最大工作进程数
  maxWorkers: 1, // E2E测试使用单线程避免并发问题
  
  // 详细输出
  verbose: true,
  
  // 清除模拟
  clearMocks: true,
  
  // 重置模拟
  resetMocks: true,
  
  // 恢复模拟
  restoreMocks: true,
  
  // 全局变量
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/../tsconfig.json',
    },
  },
  
  // 测试结果处理器
  reporters: [
    'default',
  ],
};