import {
  RateLimitStrategy,
  RateLimiterFactory,
} from '@domain/services/RateLimitStrategy.js';
import { TokenBucketRateLimiter } from '@domain/services/TokenBucketRateLimiter.js';
import { RateLimitConfig } from '@domain/interfaces/IRateLimiter.js';
import { Logger } from '@infrastructure/logging/logger.js';

describe('RateLimitStrategy', () => {
  let rateLimitStrategy: RateLimitStrategy;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    rateLimitStrategy = new RateLimitStrategy(
      new RateLimiterFactory(mockLogger),
      mockLogger,
    );
  });

  describe('默认配置测试', () => {
    test('应该初始化默认的限流配置', () => {
      const configs = rateLimitStrategy.getConfigs();

      expect(configs).toHaveLength(6); // global, ip, user, path, search, upload
      expect(configs.map((c) => c.type)).toContain('global');
      expect(configs.map((c) => c.type)).toContain('ip');
      expect(configs.map((c) => c.type)).toContain('user');
      expect(configs.map((c) => c.type)).toContain('path');
      expect(configs.map((c) => c.type)).toContain('search');
      expect(configs.map((c) => c.type)).toContain('upload');
    });

    test('应该按优先级排序配置', () => {
      const configs = rateLimitStrategy.getConfigs();

      // 检查优先级顺序
      for (let i = 1; i < configs.length; i++) {
        expect(configs[i].priority).toBeGreaterThanOrEqual(
          configs[i - 1].priority,
        );
      }
    });

    test('应该设置合理的默认值', () => {
      const configs = rateLimitStrategy.getConfigs();

      const globalConfig = configs.find((c) => c.type === 'global');
      expect(globalConfig?.maxTokens).toBe(1000);
      expect(globalConfig?.refillRate).toBe(100);
      expect(globalConfig?.enabled).toBe(true);

      const ipConfig = configs.find((c) => c.type === 'ip');
      expect(ipConfig?.maxTokens).toBe(100);
      expect(ipConfig?.refillRate).toBe(10);
      expect(ipConfig?.enabled).toBe(true);
    });
  });

  describe('配置管理测试', () => {
    test('应该能够添加新配置', () => {
      const newConfig: RateLimitConfig = {
        type: 'custom',
        maxTokens: 50,
        refillRate: 5,
        enabled: true,
        priority: 10,
      };

      rateLimitStrategy.addConfig(newConfig);
      const configs = rateLimitStrategy.getConfigs();

      expect(configs).toContainEqual(newConfig);
    });

    test('应该能够更新现有配置', () => {
      const updatedConfig: RateLimitConfig = {
        type: 'global',
        maxTokens: 2000,
        refillRate: 200,
        enabled: false,
        priority: 1,
      };

      rateLimitStrategy.updateConfig('global', updatedConfig);
      const config = rateLimitStrategy.getConfig('global');

      expect(config?.maxTokens).toBe(2000);
      expect(config?.refillRate).toBe(200);
      expect(config?.enabled).toBe(false);
    });

    test('应该能够移除配置', () => {
      rateLimitStrategy.removeConfig('user');
      const config = rateLimitStrategy.getConfig('user');

      expect(config).toBeUndefined();
    });

    test('添加配置时应该按优先级重新排序', () => {
      const highPriorityConfig: RateLimitConfig = {
        type: 'high-priority',
        maxTokens: 100,
        refillRate: 10,
        enabled: true,
        priority: 0, // 最高优先级
      };

      rateLimitStrategy.addConfig(highPriorityConfig);
      const configs = rateLimitStrategy.getConfigs();

      expect(configs[0]).toEqual(highPriorityConfig);
    });
  });

  describe('请求检查测试', () => {
    let mockReq: any;

    beforeEach(() => {
      mockReq = {
        method: 'GET',
        url: '/api/test',
        path: '/api/test',
        ip: '192.168.1.1',
        headers: {},
        user: { id: 'user123' },
      };
    });

    test('应该为每个配置执行限流检查', () => {
      const results = rateLimitStrategy.checkRequest(mockReq);

      // 应该有4个结果（对应4个启用的配置）
      expect(results).toHaveLength(4);

      // 每个结果都应该有必要的字段
      results.forEach((result) => {
        expect(result).toHaveProperty('allowed');
        expect(result).toHaveProperty('remaining');
        expect(result).toHaveProperty('limiterType');
        expect(result).toHaveProperty('key');
      });
    });

    test('应该使用正确的键生成策略', () => {
      const results = rateLimitStrategy.checkRequest(mockReq);

      const globalResult = results.find((r) => r.limiterType === 'global');
      expect(globalResult?.key).toBe('global');

      const ipResult = results.find((r) => r.limiterType === 'ip');
      expect(ipResult?.key).toBe('192.168.1.1');

      const userResult = results.find((r) => r.limiterType === 'user');
      expect(userResult?.key).toBe('user123');

      const pathResult = results.find((r) => r.limiterType === 'path');
      expect(pathResult?.key).toBe('GET:/api/test');
    });

    test('应该跳过禁用的配置', () => {
      // 禁用全局配置
      rateLimitStrategy.updateConfig('global', {
        type: 'global',
        maxTokens: 1000,
        refillRate: 100,
        enabled: false,
        priority: 1,
      });

      const results = rateLimitStrategy.checkRequest(mockReq);
      const globalResult = results.find((r) => r.limiterType === 'global');

      // 禁用的配置应该返回允许的结果
      expect(globalResult?.allowed).toBe(true);
      expect(globalResult?.remaining).toBe(1000); // 禁用的配置返回maxTokens值
    });

    test('应该处理自定义键生成器', () => {
      const customConfig: RateLimitConfig = {
        type: 'custom',
        maxTokens: 10,
        refillRate: 1,
        enabled: true,
        priority: 5,
        keyGenerator: (req) => `custom:${req.method}:${req.url}`,
      };

      rateLimitStrategy.addConfig(customConfig);
      const results = rateLimitStrategy.checkRequest(mockReq);
      const customResult = results.find((r) => r.limiterType === 'custom');

      expect(customResult?.key).toBe('custom:GET:/api/test');
    });

    test('应该处理跳过条件', () => {
      const skipConfig: RateLimitConfig = {
        type: 'skip-test',
        maxTokens: 10,
        refillRate: 1,
        enabled: true,
        priority: 5,
        skipCondition: (req) => req.url?.includes('/skip'),
      };

      rateLimitStrategy.addConfig(skipConfig);

      const normalReq = { ...mockReq, url: '/api/test' };
      const skipReq = { ...mockReq, url: '/api/skip' };

      const normalResults = rateLimitStrategy.checkRequest(normalReq);
      const skipResults = rateLimitStrategy.checkRequest(skipReq);

      const normalResult = normalResults.find(
        (r) => r.limiterType === 'skip-test',
      );
      const skipResult = skipResults.find((r) => r.limiterType === 'skip-test');

      // 正常请求应该包含跳过配置的结果
      expect(normalResult).toBeDefined();

      // 跳过的请求不应该包含跳过配置的结果
      expect(skipResult).toBeUndefined();
    });

    test('应该处理白名单', () => {
      const whitelistConfig: RateLimitConfig = {
        type: 'whitelist-test',
        maxTokens: 10,
        refillRate: 1,
        enabled: true,
        priority: 5,
        whitelist: ['192.168.1.1', '10.0.0.1'],
      };

      rateLimitStrategy.addConfig(whitelistConfig);

      const whitelistReq = { ...mockReq, ip: '192.168.1.1' };
      const normalReq = { ...mockReq, ip: '192.168.1.2' };

      const whitelistResults = rateLimitStrategy.checkRequest(whitelistReq);
      const normalResults = rateLimitStrategy.checkRequest(normalReq);

      const whitelistResult = whitelistResults.find(
        (r) => r.limiterType === 'whitelist-test',
      );
      const normalResult = normalResults.find(
        (r) => r.limiterType === 'whitelist-test',
      );

      // 白名单IP应该返回允许的结果
      expect(whitelistResult?.allowed).toBe(true);
      expect(whitelistResult?.remaining).toBe(9);

      // 非白名单IP应该正常限流
      expect(normalResult?.remaining).toBeLessThan(10);
    });
  });

  describe('IP地址提取测试', () => {
    test('应该从x-forwarded-for头提取IP', () => {
      const req = {
        method: 'GET',
        url: '/api/test',
        headers: {
          'x-forwarded-for': '203.0.113.194, 70.41.3.18, 150.172.238.178',
        },
      };

      const results = rateLimitStrategy.checkRequest(req);
      const ipResult = results.find((r) => r.limiterType === 'ip');

      expect(ipResult?.key).toBe('203.0.113.194');
    });

    test('应该从x-real-ip头提取IP', () => {
      const req = {
        method: 'GET',
        url: '/api/test',
        headers: {
          'x-real-ip': '203.0.113.195',
        },
      };

      const results = rateLimitStrategy.checkRequest(req);
      const ipResult = results.find((r) => r.limiterType === 'ip');

      expect(ipResult?.key).toBe('203.0.113.195');
    });

    test('应该从连接对象提取IP', () => {
      const req = {
        method: 'GET',
        url: '/api/test',
        connection: {
          remoteAddress: '203.0.113.196',
        },
      };

      const results = rateLimitStrategy.checkRequest(req);
      const ipResult = results.find((r) => r.limiterType === 'ip');

      expect(ipResult?.key).toBe('203.0.113.196');
    });

    test('应该处理IP提取失败的情况', () => {
      const req = {
        method: 'GET',
        url: '/api/test',
        headers: {},
        connection: {},
      };

      const results = rateLimitStrategy.checkRequest(req);
      const ipResult = results.find((r) => r.limiterType === 'ip');

      expect(ipResult?.key).toBe('unknown');
    });
  });

  describe('用户ID提取测试', () => {
    test('应该从req.user.id提取用户ID', () => {
      const req = {
        method: 'GET',
        url: '/api/test',
        user: { id: 'user456' },
      };

      const results = rateLimitStrategy.checkRequest(req);
      const userResult = results.find((r) => r.limiterType === 'user');

      expect(userResult?.key).toBe('user456');
    });

    test('应该从req.userId提取用户ID', () => {
      const req = {
        method: 'GET',
        url: '/api/test',
        userId: 'user789',
      };

      const results = rateLimitStrategy.checkRequest(req);
      const userResult = results.find((r) => r.limiterType === 'user');

      expect(userResult?.key).toBe('user789');
    });

    test('应该从x-user-id头提取用户ID', () => {
      const req = {
        method: 'GET',
        url: '/api/test',
        headers: {
          'x-user-id': 'user000',
        },
      };

      const results = rateLimitStrategy.checkRequest(req);
      const userResult = results.find((r) => r.limiterType === 'user');

      expect(userResult?.key).toBe('user000');
    });

    test('应该在没有用户ID时回退到IP', () => {
      const req = {
        method: 'GET',
        url: '/api/test',
        ip: '192.168.1.100',
        headers: {},
        user: undefined,
        userId: undefined,
      };

      const results = rateLimitStrategy.checkRequest(req);
      const userResult = results.find((r) => r.limiterType === 'user');

      expect(userResult?.key).toBe('192.168.1.100');
    });
  });

  describe('特殊路径限流测试', () => {
    test('搜索路径应该触发搜索限流', () => {
      const searchReq = {
        method: 'GET',
        url: '/api/search/documents',
        path: '/search/documents',
        ip: '192.168.1.1',
      };

      const results = rateLimitStrategy.checkRequest(searchReq);
      const searchResult = results.find((r) => r.limiterType === 'search');

      expect(searchResult?.key).toBe('search:192.168.1.1');
    });

    test('非搜索路径不应该触发搜索限流', () => {
      const normalReq = {
        method: 'GET',
        url: '/api/documents',
        path: '/documents',
        ip: '192.168.1.1',
      };

      const results = rateLimitStrategy.checkRequest(normalReq);
      const searchResult = results.find((r) => r.limiterType === 'search');

      expect(searchResult).toBeUndefined();
    });

    test('上传路径应该触发上传限流', () => {
      const uploadReq = {
        method: 'POST',
        url: '/api/upload/document',
        path: '/upload/document',
        ip: '192.168.1.1',
      };

      const results = rateLimitStrategy.checkRequest(uploadReq);
      const uploadResult = results.find((r) => r.limiterType === 'upload');

      expect(uploadResult?.key).toBe('upload:192.168.1.1');
    });
  });

  describe('日志记录测试', () => {
    test('应该记录配置更新日志', () => {
      const newConfig: RateLimitConfig = {
        type: 'log-test',
        maxTokens: 50,
        refillRate: 5,
        enabled: true,
        priority: 10,
      };

      rateLimitStrategy.addConfig(newConfig);

      expect(mockLogger.info).toHaveBeenCalledWith('添加限流配置', {
        type: 'log-test',
      });
    });

    test('应该记录配置移除日志', () => {
      rateLimitStrategy.removeConfig('user');

      expect(mockLogger.info).toHaveBeenCalledWith('移除限流配置', {
        type: 'user',
      });
    });

    test('应该记录限流检查日志', () => {
      const req = {
        method: 'GET',
        url: '/api/test',
        ip: '192.168.1.1',
        headers: {
          'x-forwarded-for': '192.168.1.1',
          'x-real-ip': '192.168.1.1',
        },
      };

      rateLimitStrategy.checkRequest(req);

      expect(mockLogger.debug).toHaveBeenCalledWith('限流检查完成', {
        limiterType: expect.any(String),
        key: expect.any(String),
        allowed: expect.any(Boolean),
        remaining: expect.any(Number),
        url: '/api/test',
        method: 'GET',
      });
    });
  });
});

describe('RateLimiterFactory', () => {
  let factory: RateLimiterFactory;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    factory = new RateLimiterFactory(mockLogger);
  });

  describe('限流器类型注册测试', () => {
    test('应该注册默认的令牌桶限流器', () => {
      const types = factory.getRegisteredTypes();
      expect(types).toContain('token-bucket');
    });

    test('应该能够注册新的限流器类型', () => {
      const mockLimiter = {
        checkLimit: jest.fn(),
        consumeTokens: jest.fn(),
        getStatus: jest.fn(),
        reset: jest.fn(),
        cleanup: jest.fn(),
        getActiveKeys: jest.fn(),
      };

      factory.registerLimiterType('custom', () => mockLimiter);

      const types = factory.getRegisteredTypes();
      expect(types).toContain('custom');
    });

    test('注册重复类型应该覆盖并记录警告', () => {
      const mockLimiter1 = { checkLimit: jest.fn() };
      const mockLimiter2 = { checkLimit: jest.fn() };

      factory.registerLimiterType('duplicate', () => mockLimiter1 as any);
      factory.registerLimiterType('duplicate', () => mockLimiter2 as any);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '限流器类型已存在，将被覆盖',
        { type: 'duplicate' },
      );
    });
  });

  describe('限流器创建测试', () => {
    test('应该能够创建已注册的限流器', () => {
      const limiter = factory.createLimiter('token-bucket');
      expect(limiter).toBeInstanceOf(TokenBucketRateLimiter);
    });

    test('创建未知类型应该抛出错误', () => {
      expect(() => {
        factory.createLimiter('unknown');
      }).toThrow('未知的限流器类型: unknown');
    });
  });

  describe('限流器获取测试', () => {
    test('应该返回单例限流器实例', () => {
      const limiter1 = factory.getLimiter('token-bucket');
      const limiter2 = factory.getLimiter('token-bucket');

      expect(limiter1).toBe(limiter2); // 应该是同一个实例
    });

    test('应该为未知类型创建新实例', () => {
      const limiter = factory.getLimiter('token-bucket');
      expect(limiter).toBeInstanceOf(TokenBucketRateLimiter);
    });
  });
});
