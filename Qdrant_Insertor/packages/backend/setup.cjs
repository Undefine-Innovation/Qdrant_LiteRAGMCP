/* eslint-disable no-undef */
// Jest setup file - CommonJS format for ESM compatibility
// This file runs after Jest is initialized but before tests run

// Import jest from the current context (provided by Jest at runtime)
// In setupFilesAfterEnv, jest is available as a global

// Global Jest timeout increased for integration tests
jest.setTimeout(30000);

// Expose jest to global if not already there
if (!global.jest) {
  global.jest = jest;
}

// Mock console methods to reduce test noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
};

// 全局清理函数：确保每个测试套件后正确清理资源
let activeConnections = new Set();
let activeTimers = new Set();

// 清理数据库连接
global.registerConnection = (connection) => {
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
    } catch {
      // 忽略清理错误，避免阻塞测试退出
    }
  }
  activeConnections.clear();
};

// 清理定时器
global.registerTimer = (timer) => {
  activeTimers.add(timer);
};

global.cleanupTimers = () => {
  for (const timer of activeTimers) {
    clearTimeout(timer);
    clearInterval(timer);
  }
  activeTimers.clear();
};

// 拦截 setInterval 和 setTimeout 自动追踪定时器
const originalSetInterval = global.setInterval;
const originalSetTimeout = global.setTimeout;

global.setInterval = function(...args) {
  const timer = originalSetInterval.apply(this, args);
  activeTimers.add(timer);
  return timer;
};

global.setTimeout = function(...args) {
  const timer = originalSetTimeout.apply(this, args);
  activeTimers.add(timer);
  return timer;
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

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JEST_WORKER_ID = '1';
// Provide minimal env defaults so config validation passes in tests
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
process.env.OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
process.env.OPENAI_MODEL = process.env.OPENAI_MODEL || 'text-embedding-ada-002';
process.env.DB_PATH = process.env.DB_PATH || ':memory:';
process.env.QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
process.env.API_PORT = process.env.API_PORT || '0';

// Custom matchers
expect.extend({
  toBeValidTransactionId(received) {
    const pass = typeof received === 'string' && received.length > 0;
    return {
      message: () =>
        pass
          ? `expected ${received} not to be a valid transaction ID`
          : `expected ${received} to be a valid transaction ID`,
      pass,
    };
  },
  toBeInTransactionStatus(received, status) {
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

