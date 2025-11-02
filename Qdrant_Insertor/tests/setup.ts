// Jest setup file
import { jest } from '@jest/globals';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to ignore a specific log level
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Set up global test timeout
jest.setTimeout(10000);

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