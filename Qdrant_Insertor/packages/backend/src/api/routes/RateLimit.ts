import express from 'express';
import { Request, Response } from 'express';
import {
  IRateLimitStrategy,
  IRateLimitMetrics,
} from '@domain/interfaces/IRateLimiter.js';
import { RateLimitMetrics } from '@domain/services/RateLimitMetrics.js';
import { RateLimiterFactory } from '@domain/services/RateLimitStrategy.js';
import { TokenBucketRateLimiter } from '@domain/services/TokenBucketRateLimiter.js';
import { Logger } from '@infrastructure/logging/logger.js';
import { validate, ValidatedRequest } from '../../middlewares/validate.js';
import { z } from 'zod';

/**
 * 限流状态查询参数验证模式
 */
const rateLimitQuerySchema = z.object({
  limiterType: z.string().optional(),
  timeRange: z.coerce
    .number()
    .min(60000)
    .max(24 * 60 * 60 * 1000)
    .optional()
    .default(60 * 60 * 1000), // 默认1小时，最大24小时
  limit: z.coerce.number().min(1).max(100).optional().default(10),
});

/**
 * 限流配置更新参数验证模式
 */
const rateLimitConfigSchema = z.object({
  type: z.string(),
  maxTokens: z.coerce.number().min(1).max(10000).optional(),
  refillRate: z.coerce.number().min(0.1).max(1000).optional(),
  enabled: z.coerce.boolean().optional(),
  whitelist: z.array(z.string()).optional(),
});

type RateLimitQuery = z.infer<typeof rateLimitQuerySchema>;
type RateLimitConfig = z.infer<typeof rateLimitConfigSchema>;

/**
 * 创建限流管理API路由
 *
 * 提供以下功能：
 * - 查询限流状态和统计
 * - 查看限流配置
 * - 更新限流配置
 * - 重置限流器
 * - 查看热门限流键
 *
 * @param rateLimitStrategy 限流策略
 * @param logger 日志记录器
 * @returns Express路由实例
 */
export function createRateLimitRoutes(
  rateLimitStrategy: IRateLimitStrategy,
  logger: Logger,
): express.Router {
  const router = express.Router();

  // 创建指标收集器（如果还没有的话）
  const metrics = new RateLimitMetrics(logger);

  /**
   * @api {get} /rate-limit/status 获取限流状态概览
   * @apiGroup RateLimit
   * @apiDescription 获取所有限流器的状态概览
   * @apiSuccess {Object} data 状态概览数据
   * @apiSuccess {Array} data.configs 限流配置列表
   * @apiSuccess {Object} data.overview 数据概览
   * @apiSuccess {Number} data.overview.totalEvents 总事件数
   * @apiSuccess {Array} data.overview.limiterTypes 限流器类型列表
   * @apiSuccess {Number} data.overview.oldestEvent 最旧事件时间戳
   * @apiSuccess {Number} data.overview.newestEvent 最新事件时间戳
   */
  router.get('/status', (req: Request, res: Response) => {
    try {
      const configs = rateLimitStrategy.getConfigs();
      const overview = metrics.getOverview();

      res.json({
        success: true,
        data: {
          configs: configs.map((config) => ({
            type: config.type,
            maxTokens: config.maxTokens,
            refillRate: config.refillRate,
            enabled: config.enabled,
            priority: config.priority,
            whitelist: config.whitelist,
          })),
          overview: {
            totalEvents: overview.totalEvents,
            limiterTypes: overview.limiterTypes,
            oldestEvent: overview.oldestEvent
              ? new Date(overview.oldestEvent).toISOString()
              : null,
            newestEvent: overview.newestEvent
              ? new Date(overview.newestEvent).toISOString()
              : null,
          },
        },
      });
    } catch (error) {
      logger.error('获取限流状态失败', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: '获取限流状态失败',
        details: (error as Error).message,
      });
    }
  });

  /**
   * @api {get} /rate-limit/statistics 获取限流统计数据
   * @apiGroup RateLimit
   * @apiDescription 获取指定限流器的统计数据
   * @apiParam {String} [limiterType] 限流器类型，不指定则返回所有类型
   * @apiParam {Number} [timeRange=3600000] 时间范围（毫秒），默认1小时
   * @apiSuccess {Object} data 统计数据
   */
  router.get(
    '/statistics',
    validate({ query: rateLimitQuerySchema }),
    (req: ValidatedRequest<unknown, RateLimitQuery>, res: Response) => {
      try {
        const { limiterType, timeRange } = req.validated!
          .query as RateLimitQuery;

        if (limiterType) {
          const stats = metrics.getStatistics(limiterType, timeRange);
          res.json({
            success: true,
            data: {
              ...stats,
              startTime: new Date(stats.startTime).toISOString(),
              endTime: new Date(stats.endTime).toISOString(),
            },
          });
        } else {
          const allStats = metrics.getAllStatistics(timeRange);
          const statsArray = Array.from(allStats.entries()).map(
            ([type, stats]) => ({
              ...stats,
              startTime: new Date(stats.startTime).toISOString(),
              endTime: new Date(stats.endTime).toISOString(),
            }),
          );

          res.json({
            success: true,
            data: statsArray,
          });
        }
      } catch (error) {
        logger.error('获取限流统计失败', { error: (error as Error).message });
        res.status(500).json({
          success: false,
          error: '获取限流统计失败',
          details: (error as Error).message,
        });
      }
    },
  );

  /**
   * @api {get} /rate-limit/hot-keys 获取热门限流键
   * @apiGroup RateLimit
   * @apiDescription 获取指定限流器的热门键（按请求次数排序）
   * @apiParam {String} limiterType 限流器类型
   * @apiParam {Number} [timeRange=3600000] 时间范围（毫秒），默认1小时
   * @apiParam {Number} [limit=10] 返回数量限制
   * @apiSuccess {Array} data 热门键列表
   */
  router.get(
    '/hot-keys',
    validate({ query: rateLimitQuerySchema }),
    (req: ValidatedRequest<unknown, RateLimitQuery>, res: Response) => {
      try {
        const { limiterType, timeRange, limit } = req.validated!
          .query as RateLimitQuery;

        if (!limiterType) {
          return res.status(400).json({
            success: false,
            error: 'limiterType 参数是必需的',
          });
        }

        const hotKeys = metrics.getHotKeys(limiterType, timeRange, limit);

        res.json({
          success: true,
          data: hotKeys,
        });
      } catch (error) {
        logger.error('获取热门限流键失败', { error: (error as Error).message });
        res.status(500).json({
          success: false,
          error: '获取热门限流键失败',
          details: (error as Error).message,
        });
      }
    },
  );

  /**
   * @api {get} /rate-limit/trend 获取限流趋势数据
   * @apiGroup RateLimit
   * @apiDescription 获取指定限流器的趋势数据
   * @apiParam {String} limiterType 限流器类型
   * @apiParam {Number} [timeRange=3600000] 时间范围（毫秒），默认1小时
   * @apiParam {Number} [bucketSize=3600000] 时间桶大小（毫秒），默认1小时
   * @apiSuccess {Array} data 趋势数据数组
   */
  router.get(
    '/trend',
    validate({ query: rateLimitQuerySchema }),
    (req: ValidatedRequest<unknown, RateLimitQuery>, res: Response) => {
      try {
        const { limiterType, timeRange } = req.validated!
          .query as RateLimitQuery;
        const bucketSize =
          Number((req.query as Record<string, unknown>).bucketSize) ||
          60 * 60 * 1000; // 默认1小时

        if (!limiterType) {
          return res.status(400).json({
            success: false,
            error: 'limiterType 参数是必需的',
          });
        }

        const trendData = metrics.getTrendData(
          limiterType,
          timeRange,
          bucketSize,
        );

        res.json({
          success: true,
          data: trendData.map((item) => ({
            ...item,
            timestamp: new Date(item.timestamp).toISOString(),
          })),
        });
      } catch (error) {
        logger.error('获取限流趋势失败', { error: (error as Error).message });
        res.status(500).json({
          success: false,
          error: '获取限流趋势失败',
          details: (error as Error).message,
        });
      }
    },
  );

  /**
   * @api {get} /rate-limit/config 获取限流配置
   * @apiGroup RateLimit
   * @apiDescription 获取所有限流配置或指定类型的配置
   * @apiParam {String} [type] 限流器类型，不指定则返回所有配置
   * @apiSuccess {Object} data 限流配置
   */
  router.get('/config', (req: Request, res: Response) => {
    try {
      const { type } = req.query;

      if (type) {
        const config = rateLimitStrategy.getConfig(type as string);
        if (!config) {
          return res.status(404).json({
            success: false,
            error: `未找到类型为 ${type} 的限流配置`,
          });
        }

        res.json({
          success: true,
          data: config,
        });
      } else {
        const configs = rateLimitStrategy.getConfigs();
        res.json({
          success: true,
          data: configs,
        });
      }
    } catch (error) {
      logger.error('获取限流配置失败', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: '获取限流配置失败',
        details: (error as Error).message,
      });
    }
  });

  /**
   * @api {put} /rate-limit/config 更新限流配置
   * @apiGroup RateLimit
   * @apiDescription 更新指定类型的限流配置
   * @apiParam {String} type 限流器类型
   * @apiParam {Number} [maxTokens] 最大令牌数
   * @apiParam {Number} [refillRate] 令牌补充速率
   * @apiParam {Boolean} [enabled] 是否启用
   * @apiParam {Array} [whitelist] 白名单
   * @apiSuccess {Object} data 更新后的配置
   */
  router.put(
    '/config',
    validate({ body: rateLimitConfigSchema }),
    (req: ValidatedRequest<RateLimitConfig, unknown>, res: Response) => {
      try {
        const configData = req.validated!.body as RateLimitConfig;
        const existingConfig = rateLimitStrategy.getConfig(configData.type);

        if (!existingConfig) {
          return res.status(404).json({
            success: false,
            error: `未找到类型为 ${configData.type} 的限流配置`,
          });
        }

        // 更新配置（保留未指定的字段）
        const updatedConfig = {
          ...existingConfig,
          ...configData,
        };

        rateLimitStrategy.updateConfig(configData.type, updatedConfig);

        logger.info('限流配置已更新', {
          type: configData.type,
          oldConfig: existingConfig,
          newConfig: updatedConfig,
        });

        res.json({
          success: true,
          data: updatedConfig,
        });
      } catch (error) {
        logger.error('更新限流配置失败', { error: (error as Error).message });
        res.status(500).json({
          success: false,
          error: '更新限流配置失败',
          details: (error as Error).message,
        });
      }
    },
  );

  /**
   * @api {post} /rate-limit/reset 重置限流器
   * @apiGroup RateLimit
   * @apiDescription 重置指定键的限流器状态
   * @apiParam {String} limiterType 限流器类型
   * @apiParam {String} key 限流键
   * @apiSuccess {Object} data 重置结果
   */
  router.post('/reset', (req, res) => {
    try {
      const { limiterType, key } = req.body;

      if (!limiterType || !key) {
        return res.status(400).json({
          success: false,
          error: 'limiterType 和 key 参数是必需的',
        });
      }

      const config = rateLimitStrategy.getConfig(limiterType);
      if (!config) {
        return res.status(404).json({
          success: false,
          error: `未找到类型为 ${limiterType} 的限流配置`,
        });
      }

      // 获取限流器并重置
      const factory = new RateLimiterFactory(logger);
      const limiter = factory.getLimiter('token-bucket');
      limiter.reset(key, config);

      logger.info('限流器已重置', {
        limiterType,
        key,
      });

      res.json({
        success: true,
        data: {
          limiterType,
          key,
          resetAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('重置限流器失败', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: '重置限流器失败',
        details: (error as Error).message,
      });
    }
  });

  /**
   * @api {post} /rate-limit/clear 清理限流数据
   * @apiGroup RateLimit
   * @apiDescription 清理限流指标数据
   * @apiSuccess {Object} data 清理结果
   */
  router.post('/clear', (req, res) => {
    try {
      metrics.clearAll();

      logger.info('限流指标数据已清理');

      res.json({
        success: true,
        data: {
          clearedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('清理限流数据失败', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: '清理限流数据失败',
        details: (error as Error).message,
      });
    }
  });

  return router;
}
