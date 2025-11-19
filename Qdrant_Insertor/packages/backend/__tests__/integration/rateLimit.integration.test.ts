import request from 'supertest';
import express from 'express';
import {
  RateLimitStrategy,
  RateLimiterFactory,
} from '@domain/services/RateLimitStrategy.js';
import { RateLimitMetrics } from '@domain/services/RateLimitMetrics.js';
import { createRateLimitRoutes } from '@api/routes/RateLimit.js';
import { createSimpleRateLimitMiddleware } from '@middlewares/rateLimit.js';
import { Logger } from '@infrastructure/logging/logger.js';
import { AppConfig } from '@infrastructure/config/config.js';

describe('Rate Limit Integration Tests', () => {
  let app: express.Application;
  let rateLimitStrategy: RateLimitStrategy;
  let rateLimitMetrics: RateLimitMetrics;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    // 创建限流组件
    const limiterFactory = new RateLimiterFactory(mockLogger);
    rateLimitStrategy = new RateLimitStrategy(limiterFactory, mockLogger);
    rateLimitMetrics = new RateLimitMetrics(mockLogger);

    // 创建Express应用
    app = express();
    app.use(express.json());

    // 添加限流中间件
    app.use('/api', createSimpleRateLimitMiddleware(rateLimitStrategy));

    // 添加限流管理路由
    app.use(
      '/api/rate-limit',
      createRateLimitRoutes(rateLimitStrategy, mockLogger),
    );

    // 添加测试路由
    app.get('/api/test', (req, res) => {
      res.json({
        message: 'test endpoint',
        timestamp: new Date().toISOString(),
      });
    });

    app.get('/api/search', (req, res) => {
      res.json({
        message: 'search endpoint',
        timestamp: new Date().toISOString(),
      });
    });

    app.post('/api/upload', (req, res) => {
      res.json({
        message: 'upload endpoint',
        timestamp: new Date().toISOString(),
      });
    });
  });

  describe('基本限流功能', () => {
    test('应该允许正常频率的请求', async () => {
      // 发送几个请求，但不超过限制
      for (let i = 0; i < 5; i++) {
        const response = await request(app).get('/api/test').expect(200);

        expect(response.headers).toHaveProperty('x-ratelimit-remaining');
        expect(response.headers).toHaveProperty('x-ratelimit-limit');
        expect(response.headers).toHaveProperty('x-ratelimit-reset');
      }
    });

    test('应该在超过限制时返回429', async () => {
      // 快速发送多个请求以触发IP限流
      const promises = [];
      for (let i = 0; i < 15; i++) {
        // 超过IP限制的10个请求
        promises.push(
          request(app).get('/api/test').set('X-Forwarded-For', '192.168.1.100'),
        );
      }

      const results = await Promise.allSettled(promises);

      // 检查有多少请求成功
      const successful = results.filter(
        (r) => r.status === 'fulfilled' && r.value.status === 200,
      );
      const rejected = results.filter(
        (r) => r.status === 'fulfilled' && r.value.status === 429,
      );

      expect(successful).toHaveLength(10); // IP限制是10个请求
      expect(rejected.length).toBeGreaterThan(0);

      // 检查429响应的格式
      const rejectedResponse = rejected[0].value;
      expect(rejectedResponse.status).toBe(429);
      expect(rejectedResponse.body).toHaveProperty('errorCode');
      expect(rejectedResponse.body).toHaveProperty('message');
      expect(rejectedResponse.body).toHaveProperty('details');
      expect(rejectedResponse.body.details).toHaveProperty('retryAfter');
      expect(rejectedResponse.body.details).toHaveProperty('limitType');
    });

    test('应该在响应头中包含限流信息', async () => {
      const response = await request(app).get('/api/test').expect(200);

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
      expect(response.headers).toHaveProperty('x-ratelimit-policy');
      expect(response.headers).toHaveProperty('x-ratelimit-key');
      expect(response.headers).toHaveProperty('x-ratelimit-details');
    });
  });

  describe('多级限流测试', () => {
    test('应该对搜索API应用更严格的限制', async () => {
      // 先用普通请求消耗一些IP配额
      for (let i = 0; i < 8; i++) {
        await request(app)
          .get('/api/test')
          .set('X-Forwarded-For', '192.168.1.100')
          .expect(200);
      }

      // 现在搜索请求应该被搜索限流限制（30个令牌）
      const searchPromises = [];
      for (let i = 0; i < 35; i++) {
        searchPromises.push(
          request(app)
            .get('/api/search')
            .set('X-Forwarded-For', '192.168.1.100'),
        );
      }

      const searchResults = await Promise.allSettled(searchPromises);
      const successfulSearches = searchResults.filter(
        (r) => r.status === 'fulfilled' && r.value.status === 200,
      );

      expect(successfulSearches).toHaveLength(30); // 搜索限制是30个请求
    });

    test('应该对上传API应用最严格的限制', async () => {
      // 上传限制是10个请求
      const uploadPromises = [];
      for (let i = 0; i < 15; i++) {
        uploadPromises.push(
          request(app)
            .post('/api/upload')
            .set('X-Forwarded-For', '192.168.1.100'),
        );
      }

      const uploadResults = await Promise.allSettled(uploadPromises);
      const successfulUploads = uploadResults.filter(
        (r) => r.status === 'fulfilled' && r.value.status === 200,
      );

      expect(successfulUploads).toHaveLength(10); // 上传限制是10个请求
    });
  });

  describe('限流管理API测试', () => {
    test('GET /api/rate-limit/status 应该返回限流状态', async () => {
      const response = await request(app)
        .get('/api/rate-limit/status')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('configs');
      expect(response.body.data).toHaveProperty('overview');
      expect(response.body.data.configs).toBeInstanceOf(Array);
      expect(response.body.data.configs).toHaveLength(6); // 默认6个配置
    });

    test('GET /api/rate-limit/statistics 应该返回统计数据', async () => {
      // 先发送一些请求以生成统计数据
      for (let i = 0; i < 5; i++) {
        await request(app).get('/api/test').expect(200);
      }

      const response = await request(app)
        .get('/api/rate-limit/statistics')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toBeInstanceOf(Array);

      // 检查统计数据格式
      const globalStats = response.body.data.find(
        (s: any) => s.limiterType === 'global',
      );
      expect(globalStats).toHaveProperty('totalRequests');
      expect(globalStats).toHaveProperty('allowedRequests');
      expect(globalStats).toHaveProperty('rejectedRequests');
      expect(globalStats).toHaveProperty('allowRate');
    });

    test('GET /api/rate-limit/config 应该返回配置信息', async () => {
      const response = await request(app)
        .get('/api/rate-limit/config')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toBeInstanceOf(Array);

      // 检查配置格式
      const globalConfig = response.body.data.find(
        (c: any) => c.type === 'global',
      );
      expect(globalConfig).toHaveProperty('type', 'global');
      expect(globalConfig).toHaveProperty('maxTokens');
      expect(globalConfig).toHaveProperty('refillRate');
      expect(globalConfig).toHaveProperty('enabled');
      expect(globalConfig).toHaveProperty('priority');
    });

    test('PUT /api/rate-limit/config 应该更新配置', async () => {
      const updateData = {
        type: 'global',
        maxTokens: 2000,
        refillRate: 200,
        enabled: true,
      };

      const response = await request(app)
        .put('/api/rate-limit/config')
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.maxTokens).toBe(2000);
      expect(response.body.data.refillRate).toBe(200);
    });

    test('POST /api/rate-limit/reset 应该重置限流器', async () => {
      // 先消耗一些令牌
      for (let i = 0; i < 5; i++) {
        await request(app)
          .get('/api/test')
          .set('X-Forwarded-For', '192.168.1.200')
          .expect(200);
      }

      // 重置指定IP的限流器
      const resetData = {
        limiterType: 'ip',
        key: '192.168.1.200',
      };

      const response = await request(app)
        .post('/api/rate-limit/reset')
        .send(resetData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('limiterType', 'ip');
      expect(response.body.data).toHaveProperty('key', '192.168.1.200');
      expect(response.body.data).toHaveProperty('resetAt');

      // 重置后应该能够再次请求
      await request(app)
        .get('/api/test')
        .set('X-Forwarded-For', '192.168.1.200')
        .expect(200);
    });

    test('GET /api/rate-limit/hot-keys 应该返回热门键', async () => {
      // 从不同IP发送请求以生成热门键数据
      const ips = ['192.168.1.100', '192.168.1.101', '192.168.1.102'];
      for (const ip of ips) {
        for (let i = 0; i < 3; i++) {
          await request(app)
            .get('/api/test')
            .set('X-Forwarded-For', ip)
            .expect(200);
        }
      }

      const response = await request(app)
        .get('/api/rate-limit/hot-keys')
        .query({ limiterType: 'ip', limit: 5 })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data).toHaveLength(3);

      // 检查热门键格式
      response.body.data.forEach((key: any) => {
        expect(key).toHaveProperty('key');
        expect(key).toHaveProperty('count');
        expect(key).toHaveProperty('blockedCount');
      });
    });

    test('GET /api/rate-limit/trend 应该返回趋势数据', async () => {
      // 发送一些请求以生成趋势数据
      for (let i = 0; i < 10; i++) {
        await request(app).get('/api/test').expect(200);
        await new Promise((resolve) => setTimeout(resolve, 100)); // 间隔100ms
      }

      const response = await request(app)
        .get('/api/rate-limit/trend')
        .query({ limiterType: 'global', timeRange: 3600000 }) // 1小时
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toBeInstanceOf(Array);

      // 检查趋势数据格式
      response.body.data.forEach((item: any) => {
        expect(item).toHaveProperty('timestamp');
        expect(item).toHaveProperty('total');
        expect(item).toHaveProperty('allowed');
        expect(item).toHaveProperty('blocked');
        expect(item).toHaveProperty('blockRate');
      });
    });
  });

  describe('错误处理测试', () => {
    test('应该处理无效的查询参数', async () => {
      const response = await request(app)
        .get('/api/rate-limit/statistics')
        .query({ timeRange: 'invalid' })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    test('应该处理缺失的必需参数', async () => {
      const response = await request(app)
        .get('/api/rate-limit/hot-keys')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('limiterType 参数是必需的');
    });

    test('应该处理不存在的配置类型', async () => {
      const response = await request(app)
        .get('/api/rate-limit/config')
        .query({ type: 'nonexistent' })
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain(
        '未找到类型为 nonexistent 的限流配置',
      );
    });

    test('应该处理无效的配置更新数据', async () => {
      const invalidData = {
        type: 'global',
        maxTokens: -1, // 无效值
      };

      const response = await request(app)
        .put('/api/rate-limit/config')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('性能测试', () => {
    test('应该在高并发下正常工作', async () => {
      const concurrentRequests = 50;
      const promises = [];

      const startTime = Date.now();

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(app)
            .get('/api/test')
            .set('X-Forwarded-For', `192.168.1.${i % 255}`),
        );
      }

      const results = await Promise.allSettled(promises);
      const endTime = Date.now();

      // 检查响应时间
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(5000); // 应该在5秒内完成

      // 检查成功率（应该有一些请求被限流）
      const successful = results.filter(
        (r) => r.status === 'fulfilled' && r.value.status === 200,
      );
      const rateLimited = results.filter(
        (r) => r.status === 'fulfilled' && r.value.status === 429,
      );

      expect(successful.length + rateLimited.length).toBe(concurrentRequests);
      expect(rateLimited.length).toBeGreaterThan(0); // 应该有一些请求被限流
    });

    test('应该正确处理内存使用', async () => {
      // 发送大量请求以测试内存使用
      const uniqueIPs = Array.from(
        { length: 100 },
        (_, i) => `192.168.${Math.floor(i / 255)}.${i % 255}`,
      );

      for (const ip of uniqueIPs) {
        await request(app)
          .get('/api/test')
          .set('X-Forwarded-For', ip)
          .expect(200);
      }

      // 检查系统是否仍然响应
      const response = await request(app)
        .get('/api/rate-limit/status')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('白名单功能测试', () => {
    test('应该允许白名单IP的无限请求', async () => {
      // 更新IP限流配置以包含白名单
      const whitelistUpdate = {
        type: 'ip',
        whitelist: ['192.168.1.250'],
      };

      await request(app)
        .put('/api/rate-limit/config')
        .send(whitelistUpdate)
        .expect(200);

      // 从白名单IP发送大量请求
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          request(app).get('/api/test').set('X-Forwarded-For', '192.168.1.250'),
        );
      }

      const results = await Promise.allSettled(promises);
      const successful = results.filter(
        (r) => r.status === 'fulfilled' && r.value.status === 200,
      );

      // 白名单IP的所有请求都应该成功
      expect(successful).toHaveLength(50);
    });
  });
});
