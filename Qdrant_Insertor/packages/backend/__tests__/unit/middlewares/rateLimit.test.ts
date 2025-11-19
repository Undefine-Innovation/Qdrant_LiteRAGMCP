import { Request, Response, NextFunction } from 'express';
import {
  createRateLimitMiddleware,
  createSimpleRateLimitMiddleware,
  createStrictRateLimitMiddleware,
  createLenientRateLimitMiddleware,
} from '../../../src/middlewares/rateLimit.js';
import {
  IRateLimitStrategy,
  RateLimitResult,
} from '@domain/interfaces/IRateLimiter.js';
import { AppError, ErrorCode } from '@api/contracts/Error.js';
import { Logger } from '@infrastructure/logging/logger.js';

describe('Rate Limit Middleware', () => {
  let mockRateLimitStrategy: jest.Mocked<IRateLimitStrategy>;
  let mockLogger: jest.Mocked<Logger>;
  let mockReq: jest.Mocked<Request>;
  let mockRes: jest.Mocked<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    mockRateLimitStrategy = {
      getConfigs: jest.fn(),
      checkRequest: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    mockReq = {
      method: 'GET',
      url: '/api/test',
      path: '/api/test',
      ip: '192.168.1.1',
      headers: {},
      get: jest.fn(),
    } as any;

    mockRes = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as any;

    mockNext = jest.fn();
  });

  describe('createRateLimitMiddleware', () => {
    test('应该使用默认配置创建中间件', () => {
      const middleware = createRateLimitMiddleware({
        strategy: mockRateLimitStrategy,
      });

      expect(typeof middleware).toBe('function');
    });

    test('应该调用策略的checkRequest方法', () => {
      const mockResults: RateLimitResult[] = [
        {
          allowed: true,
          remaining: 9,
          resetTime: Date.now() + 1000,
          limiterType: 'test',
          key: 'test-key',
        },
      ];

      mockRateLimitStrategy.checkRequest.mockReturnValue(mockResults);

      const middleware = createRateLimitMiddleware({
        strategy: mockRateLimitStrategy,
      });

      middleware(mockReq, mockRes, mockNext);

      expect(mockRateLimitStrategy.checkRequest).toHaveBeenCalledWith(mockReq);
    });

    test('应该在请求被允许时调用next', () => {
      const mockResults: RateLimitResult[] = [
        {
          allowed: true,
          remaining: 9,
          resetTime: Date.now() + 1000,
          limiterType: 'test',
          key: 'test-key',
        },
      ];

      mockRateLimitStrategy.checkRequest.mockReturnValue(mockResults);

      const middleware = createRateLimitMiddleware({
        strategy: mockRateLimitStrategy,
      });

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    test('应该在请求被限流时返回429错误', () => {
      const mockResults: RateLimitResult[] = [
        {
          allowed: false,
          remaining: 0,
          resetTime: Date.now() + 5000,
          limiterType: 'test',
          key: 'test-key',
        },
      ];

      mockRateLimitStrategy.checkRequest.mockReturnValue(mockResults);

      const middleware = createRateLimitMiddleware({
        strategy: mockRateLimitStrategy,
      });

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.any(AppError), // 检查是否为AppError实例
      );

      // 检查传递给next的错误对象的属性
      const nextCall = mockNext.mock.calls[0][0];
      expect(nextCall).toBeInstanceOf(AppError);
      expect(nextCall.errorCode).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
      expect(nextCall.statusCode).toBeUndefined(); // AppError可能没有statusCode属性
      expect(nextCall.details).toEqual(
        expect.objectContaining({
          retryAfter: expect.any(Number),
          limitType: 'test',
          resetTime: expect.any(String),
        }),
      );
    });

    test('应该在响应头中包含限流信息', () => {
      const mockResults: RateLimitResult[] = [
        {
          allowed: true,
          remaining: 8,
          resetTime: Date.now() + 1000,
          limiterType: 'test',
          key: 'test-key',
          maxTokens: 10,
        },
      ];

      mockRateLimitStrategy.checkRequest.mockReturnValue(mockResults);

      const middleware = createRateLimitMiddleware({
        strategy: mockRateLimitStrategy,
        includeHeaders: true,
      });

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 10);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Remaining',
        8,
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Reset',
        expect.any(Number),
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Policy',
        'test',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Key',
        'test-key',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Details',
        expect.any(String),
      );
    });

    test('应该在includeHeaders为false时不设置响应头', () => {
      const mockResults: RateLimitResult[] = [
        {
          allowed: true,
          remaining: 8,
          resetTime: Date.now() + 1000,
          limiterType: 'test',
          key: 'test-key',
        },
      ];

      mockRateLimitStrategy.checkRequest.mockReturnValue(mockResults);

      const middleware = createRateLimitMiddleware({
        strategy: mockRateLimitStrategy,
        includeHeaders: false,
      });

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.setHeader).not.toHaveBeenCalled();
    });

    test('应该使用自定义错误消息', () => {
      const mockResults: RateLimitResult[] = [
        {
          allowed: false,
          remaining: 0,
          resetTime: Date.now() + 5000,
          limiterType: 'test',
          key: 'test-key',
        },
      ];

      mockRateLimitStrategy.checkRequest.mockReturnValue(mockResults);

      const middleware = createRateLimitMiddleware({
        strategy: mockRateLimitStrategy,
        errorMessage: '自定义限流消息',
      });

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '自定义限流消息',
        }),
      );
    });

    test('应该在中间件出错时允许请求通过', () => {
      mockRateLimitStrategy.checkRequest.mockImplementation(() => {
        throw new Error('策略错误');
      });

      const middleware = createRateLimitMiddleware({
        strategy: mockRateLimitStrategy,
      });

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(); // 即使出错也应该调用next
    });

    test('应该在中间件出错时记录错误日志', () => {
      mockRateLimitStrategy.checkRequest.mockImplementation(() => {
        throw new Error('策略错误');
      });

      const middleware = createRateLimitMiddleware({
        strategy: mockRateLimitStrategy,
      });

      // 添加logger属性到req
      (mockReq as any).logger = mockLogger;

      middleware(mockReq, mockRes, mockNext);

      expect(mockLogger.error).toHaveBeenCalledWith('限流中间件错误', {
        error: '策略错误',
        stack: expect.any(String),
        url: '/api/test',
        method: 'GET',
      });
    });
  });

  describe('便捷中间件函数', () => {
    test('createSimpleRateLimitMiddleware应该使用默认配置', () => {
      const middleware = createSimpleRateLimitMiddleware(mockRateLimitStrategy);

      expect(typeof middleware).toBe('function');
    });

    test('createStrictRateLimitMiddleware应该使用严格配置', () => {
      const middleware = createStrictRateLimitMiddleware(mockRateLimitStrategy);

      expect(typeof middleware).toBe('function');
    });

    test('createLenientRateLimitMiddleware应该使用宽松配置', () => {
      const middleware = createLenientRateLimitMiddleware(
        mockRateLimitStrategy,
      );

      expect(typeof middleware).toBe('function');
    });
  });

  describe('多级限流测试', () => {
    test('应该处理多个限流器结果', () => {
      const mockResults: RateLimitResult[] = [
        {
          allowed: true,
          remaining: 9,
          resetTime: Date.now() + 1000,
          limiterType: 'global',
          key: 'global',
        },
        {
          allowed: true,
          remaining: 4,
          resetTime: Date.now() + 2000,
          limiterType: 'ip',
          key: '192.168.1.1',
        },
        {
          allowed: false,
          remaining: 0,
          resetTime: Date.now() + 3000,
          limiterType: 'path',
          key: 'GET:/api/test',
        },
      ];

      mockRateLimitStrategy.checkRequest.mockReturnValue(mockResults);

      const middleware = createRateLimitMiddleware({
        strategy: mockRateLimitStrategy,
      });

      middleware(mockReq, mockRes, mockNext);

      // 应该被限流（因为有一个结果不允许）
      expect(mockNext).toHaveBeenCalledWith(
        expect.any(Object), // AppError instance
      );

      // 应该使用第一个被限流的结果
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            limitType: 'path', // 第一个被限流的类型
          }),
        }),
      );
    });

    test('应该选择最严格的限制设置响应头', () => {
      const mockResults: RateLimitResult[] = [
        {
          allowed: true,
          remaining: 9,
          resetTime: Date.now() + 1000,
          limiterType: 'global',
          key: 'global',
          maxTokens: 1000,
        },
        {
          allowed: true,
          remaining: 2,
          resetTime: Date.now() + 2000,
          limiterType: 'ip',
          key: '192.168.1.1',
          maxTokens: 100,
        },
      ];

      mockRateLimitStrategy.checkRequest.mockReturnValue(mockResults);

      const middleware = createRateLimitMiddleware({
        strategy: mockRateLimitStrategy,
        includeHeaders: true,
      });

      middleware(mockReq, mockRes, mockNext);

      // 应该使用最严格的限制（剩余令牌最少）
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Remaining',
        2,
      );
    });
  });

  describe('日志记录测试', () => {
    test('应该记录限流事件', () => {
      const mockResults: RateLimitResult[] = [
        {
          allowed: false,
          remaining: 0,
          resetTime: Date.now() + 5000,
          limiterType: 'test',
          key: 'test-key',
        },
      ];

      mockRateLimitStrategy.checkRequest.mockReturnValue(mockResults);

      const middleware = createRateLimitMiddleware({
        strategy: mockRateLimitStrategy,
        logEvents: true,
      });

      // 添加logger属性到req
      (mockReq as any).logger = mockLogger;

      middleware(mockReq, mockRes, mockNext);

      expect(mockLogger.warn).toHaveBeenCalledWith('请求被限流', {
        url: '/api/test',
        method: 'GET',
        ip: '192.168.1.1',
        userAgent: undefined,
        blockedBy: 'test',
        key: 'test-key',
        remaining: 0,
        resetTime: expect.any(String),
        allResults: expect.any(Array),
      });
    });

    test('应该在logOnlyBlocked为true时只记录被限流的请求', () => {
      const allowedResults: RateLimitResult[] = [
        {
          allowed: true,
          remaining: 9,
          resetTime: Date.now() + 1000,
          limiterType: 'test',
          key: 'test-key',
        },
      ];

      mockRateLimitStrategy.checkRequest.mockReturnValue(allowedResults);

      const middleware = createRateLimitMiddleware({
        strategy: mockRateLimitStrategy,
        logEvents: true,
        logOnlyBlocked: true,
      });

      // 添加logger属性到req
      (mockReq as any).logger = mockLogger;

      middleware(mockReq, mockRes, mockNext);

      // 允许的请求不应该被记录
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        '限流检查通过',
        expect.any(Object),
      );
    });

    test('应该在logOnlyBlocked为false时记录所有请求', () => {
      const allowedResults: RateLimitResult[] = [
        {
          allowed: true,
          remaining: 9,
          resetTime: Date.now() + 1000,
          limiterType: 'test',
          key: 'test-key',
        },
      ];

      mockRateLimitStrategy.checkRequest.mockReturnValue(allowedResults);

      const middleware = createRateLimitMiddleware({
        strategy: mockRateLimitStrategy,
        logEvents: true,
        logOnlyBlocked: false,
      });

      // 添加logger属性到req
      (mockReq as any).logger = mockLogger;

      middleware(mockReq, mockRes, mockNext);

      // 允许的请求应该被记录
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '限流检查通过',
        expect.any(Object),
      );
    });
  });

  describe('请求属性扩展测试', () => {
    test('应该在请求对象上添加限流结果属性', () => {
      const mockResults: RateLimitResult[] = [
        {
          allowed: true,
          remaining: 9,
          resetTime: Date.now() + 1000,
          limiterType: 'test',
          key: 'test-key',
        },
      ];

      mockRateLimitStrategy.checkRequest.mockReturnValue(mockResults);

      const middleware = createRateLimitMiddleware({
        strategy: mockRateLimitStrategy,
      });

      middleware(mockReq, mockRes, mockNext);

      expect((mockReq as any).rateLimitResults).toEqual(mockResults);
      expect((mockReq as any).rateLimited).toBe(false);
    });

    test('应该正确设置rateLimited属性', () => {
      const blockedResults: RateLimitResult[] = [
        {
          allowed: false,
          remaining: 0,
          resetTime: Date.now() + 5000,
          limiterType: 'test',
          key: 'test-key',
        },
      ];

      mockRateLimitStrategy.checkRequest.mockReturnValue(blockedResults);

      const middleware = createRateLimitMiddleware({
        strategy: mockRateLimitStrategy,
      });

      middleware(mockReq, mockRes, mockNext);

      expect((mockReq as any).rateLimited).toBe(true);
    });
  });
});
