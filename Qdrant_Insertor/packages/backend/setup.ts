// Jest setup file
import { jest } from '@jest/globals';

// Ensure ESM tests can access the global `jest` helper (legacy API)
(global as unknown as { jest: typeof jest }).jest = jest;

// Global Jest timeout increased for integration tests
jest.setTimeout(30000);

// Mock console methods to reduce test noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
};

// Expose Jest to global scope for easier access in test files
global.jest = jest;

// 全局清理函数：确保每个测试套件后正确清理资源
let activeConnections: Set<any> = new Set();
let activeTimers: Set<NodeJS.Timeout> = new Set();

// 清理数据库连接
global.registerConnection = (connection: any) => {
  activeConnections.add(connection);
};

global.cleanupConnections = async () => {
  for (const connection of activeConnections) {
    try {
      if (connection && typeof connection.close === 'function') {
        await connection.close();
      } else if (connection && typeof connection.destroy === 'function') {
        connection.destroy();
      }
    } catch (error) {
      // 忽略清理错误，避免阻塞测试退出
    }
  }
  activeConnections.clear();
};

// 清理定时器
global.registerTimer = (timer: NodeJS.Timeout) => {
  activeTimers.add(timer);
};

global.cleanupTimers = () => {
  for (const timer of activeTimers) {
    clearTimeout(timer);
    clearInterval(timer);
  }
  activeTimers.clear();
};

// Jest环境清理：每个测试套件后执行
afterEach(async () => {
  // 确保清理定时器
  global.cleanupTimers();
});

// 全局测试套件清理
afterAll(async () => {
  // 清理所有活跃连接
  await global.cleanupConnections();
  
  // 清理所有定时器
  global.cleanupTimers();
  
  // 强制垃圾回收（如果可用）
  if (global.gc) {
    global.gc();
  }
  
  // 等待短时间以确保异步操作完成
  await new Promise(resolve => setTimeout(resolve, 100));
});
global.console = {
  ...console,
  // Uncomment to ignore a specific log level
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Set up global test timeout - 增加超时时间以处理数据库操作
jest.setTimeout(30000);

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JEST_WORKER_ID = '1';

// Global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidTransactionId(): R;
      toBeInTransactionStatus(status: string): R;
    }
  }
}

// Custom matchers
expect.extend({
  toBeValidTransactionId(received: string) {
    const pass = typeof received === 'string' && received.length > 0;
    return {
      message: () =>
        pass
          ? `expected ${received} not to be a valid transaction ID`
          : `expected ${received} to be a valid transaction ID`,
      pass,
    };
  },
  toBeInTransactionStatus(received: any, status: string) {
    const pass = received && received.status === status;
    return {
      message: () =>
        pass
          ? `expected transaction status not to be ${status}`
          : `expected transaction status to be ${status}, but got ${received?.status}`,
      pass,
    };
  },
});
