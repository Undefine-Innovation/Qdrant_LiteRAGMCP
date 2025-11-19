import { TokenBucketRateLimiter } from '@domain/services/TokenBucketRateLimiter.js';
import { RateLimitConfig } from '@domain/interfaces/IRateLimiter.js';
import { Logger } from '@infrastructure/logging/logger.js';

describe('TokenBucketRateLimiter', () => {
  let rateLimiter: TokenBucketRateLimiter;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    rateLimiter = new TokenBucketRateLimiter(mockLogger, 1000, 30000); // 1秒清理间隔，30秒TTL
  });

  afterEach(() => {
    rateLimiter.destroy();
  });

  describe('基本功能测试', () => {
    test('应该成功创建限流器', () => {
      expect(rateLimiter).toBeInstanceOf(TokenBucketRateLimiter);
      expect(mockLogger.info).toHaveBeenCalledWith('令牌桶限流器已初始化', {
        cleanupInterval: 1000,
        stateTTL: 30000,
      });
    });

    test('应该允许在令牌充足时的请求', () => {
      const config: RateLimitConfig = {
        type: 'test',
        maxTokens: 10,
        refillRate: 1, // 每秒1个令牌
        enabled: true,
        priority: 1,
      };

      const result = rateLimiter.checkLimit('test-key', config);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9); // 消耗了1个令牌
      expect(result.limiterType).toBe('test');
      expect(result.key).toBe('test-key');
      expect(result.tokens).toBe(9);
      expect(result.maxTokens).toBe(10);
      expect(result.refillRate).toBe(1);
    });

    test('应该在令牌不足时拒绝请求', () => {
      const config: RateLimitConfig = {
        type: 'test',
        maxTokens: 1,
        refillRate: 0.1, // 每10秒0.1个令牌
        enabled: true,
        priority: 1,
      };

      // 第一次请求应该通过
      const result1 = rateLimiter.checkLimit('test-key', config);
      expect(result1.allowed).toBe(true);

      // 第二次请求应该被拒绝
      const result2 = rateLimiter.checkLimit('test-key', config);
      expect(result2.allowed).toBe(false);
      expect(result2.remaining).toBe(0);
      expect(result2.resetTime).toBeGreaterThan(Date.now());
    });

    test('应该在禁用时允许所有请求', () => {
      const config: RateLimitConfig = {
        type: 'test',
        maxTokens: 1,
        refillRate: 0.1,
        enabled: false,
        priority: 1,
      };

      const result = rateLimiter.checkLimit('test-key', config);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
    });
  });

  describe('令牌补充测试', () => {
    test('应该随时间补充令牌', (done) => {
      const config: RateLimitConfig = {
        type: 'test',
        maxTokens: 10,
        refillRate: 10, // 每秒10个令牌
        enabled: true,
        priority: 1,
      };

      // 消耗所有令牌
      for (let i = 0; i < 10; i++) {
        rateLimiter.checkLimit('test-key', config);
      }

      // 现在应该没有令牌了
      const result1 = rateLimiter.checkLimit('test-key', config);
      expect(result1.allowed).toBe(false);

      // 等待1秒后应该有令牌
      setTimeout(() => {
        const result2 = rateLimiter.checkLimit('test-key', config);
        expect(result2.allowed).toBe(true);
        expect(result2.remaining).toBeGreaterThanOrEqual(0);
        done();
      }, 1100); // 稍微超过1秒以确保令牌补充
    });

    test('不应该超过最大令牌数', (done) => {
      const config: RateLimitConfig = {
        type: 'test',
        maxTokens: 5,
        refillRate: 10, // 快速补充
        enabled: true,
        priority: 1,
      };

      // 消耗一些令牌
      rateLimiter.checkLimit('test-key', config);
      rateLimiter.checkLimit('test-key', config);

      // 等待足够时间让令牌补充到最大值
      setTimeout(() => {
        const result = rateLimiter.checkLimit('test-key', config);
        expect(result.tokens).toBeLessThanOrEqual(5); // 不应该超过最大值
        expect(result.maxTokens).toBe(5);
        done();
      }, 1000);
    });
  });

  describe('多键隔离测试', () => {
    test('应该为不同的键维护独立的令牌桶', () => {
      const config: RateLimitConfig = {
        type: 'test',
        maxTokens: 5,
        refillRate: 1,
        enabled: true,
        priority: 1,
      };

      // 为key1消耗所有令牌
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkLimit('key1', config);
      }

      // key1应该被限流
      const result1 = rateLimiter.checkLimit('key1', config);
      expect(result1.allowed).toBe(false);

      // key2应该仍然有完整的令牌
      const result2 = rateLimiter.checkLimit('key2', config);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(4);
    });
  });

  describe('consumeTokens方法测试', () => {
    test('应该能够消耗指定数量的令牌', () => {
      const config: RateLimitConfig = {
        type: 'test',
        maxTokens: 10,
        refillRate: 1,
        enabled: true,
        priority: 1,
      };

      const result = rateLimiter.consumeTokens('test-key', 3, config);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(7); // 10 - 3 = 7
    });

    test('应该在令牌不足时拒绝消耗请求', () => {
      const config: RateLimitConfig = {
        type: 'test',
        maxTokens: 5,
        refillRate: 1,
        enabled: true,
        priority: 1,
      };

      // 先消耗4个令牌
      rateLimiter.consumeTokens('test-key', 4, config);

      // 尝试消耗3个令牌应该失败
      const result = rateLimiter.consumeTokens('test-key', 3, config);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0); // 剩余0个令牌
    });

    test('应该拒绝消耗0个或负数令牌的请求', () => {
      const config: RateLimitConfig = {
        type: 'test',
        maxTokens: 10,
        refillRate: 1,
        enabled: true,
        priority: 1,
      };

      expect(() => {
        rateLimiter.consumeTokens('test-key', 0, config);
      }).toThrow('消耗的令牌数必须大于0');

      expect(() => {
        rateLimiter.consumeTokens('test-key', -1, config);
      }).toThrow('消耗的令牌数必须大于0');
    });
  });

  describe('getStatus方法测试', () => {
    test('应该返回当前状态而不消耗令牌', () => {
      const config: RateLimitConfig = {
        type: 'test',
        maxTokens: 10,
        refillRate: 1,
        enabled: true,
        priority: 1,
      };

      // 消耗一些令牌
      rateLimiter.checkLimit('test-key', config);
      rateLimiter.checkLimit('test-key', config);

      const status = rateLimiter.getStatus('test-key', config);

      expect(status.allowed).toBe(true); // 还有8个令牌，所以允许
      expect(status.remaining).toBe(8);
      expect(status.limiterType).toBe('test');
      expect(status.key).toBe('test-key');
    });
  });

  describe('reset方法测试', () => {
    test('应该重置指定键的令牌桶', () => {
      const config: RateLimitConfig = {
        type: 'test',
        maxTokens: 10,
        refillRate: 1,
        enabled: true,
        priority: 1,
      };

      // 消耗一些令牌
      rateLimiter.checkLimit('test-key', config);
      rateLimiter.checkLimit('test-key', config);

      // 重置
      rateLimiter.reset('test-key', config);

      // 应该恢复到初始状态
      const result = rateLimiter.checkLimit('test-key', config);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9); // 10 - 1 = 9
    });
  });

  describe('getActiveKeys方法测试', () => {
    test('应该返回所有活跃的键', () => {
      const config: RateLimitConfig = {
        type: 'test',
        maxTokens: 10,
        refillRate: 1,
        enabled: true,
        priority: 1,
      };

      // 创建多个键
      rateLimiter.checkLimit('key1', config);
      rateLimiter.checkLimit('key2', config);
      rateLimiter.checkLimit('key3', config);

      const activeKeys = rateLimiter.getActiveKeys();

      expect(activeKeys).toContain('key1');
      expect(activeKeys).toContain('key2');
      expect(activeKeys).toContain('key3');
      expect(activeKeys).toHaveLength(3);
    });
  });

  describe('cleanup方法测试', () => {
    test('应该清理过期的令牌桶状态', () => {
      const config: RateLimitConfig = {
        type: 'test',
        maxTokens: 10,
        refillRate: 1,
        enabled: true,
        priority: 1,
      };

      // 创建一个令牌桶
      rateLimiter.checkLimit('test-key', config);

      // 使用Jest的定时器控制，等待超过TTL时间
      jest.advanceTimersByTime(31000); // 稍微超过30秒TTL

      // 手动触发清理
      rateLimiter.cleanup();

      // 键应该被清理
      const activeKeys = rateLimiter.getActiveKeys();
      expect(activeKeys).not.toContain('test-key');
    });
  });

  describe('日志记录测试', () => {
    test('应该记录调试日志', () => {
      const config: RateLimitConfig = {
        type: 'test',
        maxTokens: 10,
        refillRate: 1,
        enabled: true,
        priority: 1,
      };

      rateLimiter.checkLimit('test-key', config);

      expect(mockLogger.debug).toHaveBeenCalledWith('创建新的令牌桶', {
        key: 'test-key',
        limiterType: 'test',
        maxTokens: 10,
        refillRate: 1,
      });

      expect(mockLogger.debug).toHaveBeenCalledWith('请求被允许', {
        key: 'test-key',
        limiterType: 'test',
        remainingTokens: 9,
        maxTokens: 10,
      });
    });

    test('应该记录限流日志', () => {
      const config: RateLimitConfig = {
        type: 'test',
        maxTokens: 1,
        refillRate: 0.1,
        enabled: true,
        priority: 1,
      };

      // 消耗所有令牌
      rateLimiter.checkLimit('test-key', config);

      // 下一个请求应该被限流
      rateLimiter.checkLimit('test-key', config);

      expect(mockLogger.debug).toHaveBeenCalledWith('请求被限流', {
        key: 'test-key',
        limiterType: 'test',
        remainingTokens: 0,
        maxTokens: 1,
        resetTime: expect.any(Number),
      });
    });
  });
});
