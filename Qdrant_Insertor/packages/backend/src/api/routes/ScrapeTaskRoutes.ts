import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Logger } from '@logging/logger.js';
import {
  ScrapeStartRequestSchema,
  ScrapeStatusResponseSchema,
  ScrapeListResponseSchema,
  ScrapeCancelRequestSchema,
  ScrapeCancelResponseSchema,
  ScrapeRetryRequestSchema,
  ScrapeRetryResponseSchema,
  ScrapeStatsResponseSchema,
  ScrapeStartRequest,
  ScrapeStatusResponse,
  ScrapeListResponse,
  ScrapeCancelRequest,
  ScrapeCancelResponse,
  ScrapeRetryRequest,
  ScrapeRetryResponse,
  ScrapeStatsResponse,
} from '@api/contracts/Scrape.js';
import { IScrapeService, IScrapeTask } from '@domain/entities/scrape.js';

/**
 * 创建爬虫任务管理相关的API路由
 * @param scrapeService - 爬虫服务实例
 * @param logger - 日志记录器
 * @returns Express路由器
 */
export function createScrapeTaskRoutes(
  scrapeService: IScrapeService,
  logger: Logger,
): Router {
  const router = Router();

  /**
   * POST /scrape/start
   * 启动新的爬虫任务
   */
  router.post('/start', async (req: Request, res: Response) => {
    try {
      // 验证请求体
      const validationResult = ScrapeStartRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: validationResult.error.issues,
        });
        return;
      }

      const {
        url,
        maxDepth,
        followLinks,
        selectors,
        headers,
        timeout,
        userAgent,
      } = validationResult.data;

      logger.info(`收到爬虫启动请求: ${url}`);

      // 创建爬虫任务
      const taskId = await scrapeService.createScrapeTask({
        url,
        maxDepth,
        followLinks,
        selectors,
        headers,
        timeout,
        userAgent,
      });

      res.status(202).json({
        success: true,
        message: '爬虫任务已启动',
        taskId,
      });
    } catch (error) {
      logger.error(`启动爬虫任务失败: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /scrape/status/:id
   * 查询爬虫任务状态
   */
  router.get('/status/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Task ID is required',
        });
        return;
      }

      logger.info(`查询爬虫任务状态: ${id}`);

      // 获取任务状态
      const task = await scrapeService.getScrapeTask(id);

      if (!task) {
        res.status(404).json({
          success: false,
          error: 'Task not found',
        });
        return;
      }

      // 返回任务状态
      const response: ScrapeStatusResponse = {
        success: true,
        task: {
          id: task.id,
          taskType: task.taskType,
          status: task.status,
          retries: task.retries,
          lastAttemptAt: task.lastAttemptAt,
          error: task.error,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
          startedAt: task.startedAt,
          completedAt: task.completedAt,
          progress: task.progress,
          context: task.context,
        },
      };

      res.json(response);
    } catch (error) {
      logger.error(`查询爬虫任务状态失败: ${req.params.id}, 错误: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /scrape/list
   * 获取所有爬虫任务列表
   */
  router.get('/list', async (req: Request, res: Response) => {
    try {
      logger.info('获取爬虫任务列表');

      // 获取所有任务
      const tasks = await scrapeService.getAllScrapeTasks();

      // 返回任务列表
      const response: ScrapeListResponse = {
        success: true,
        tasks: tasks.map((task: IScrapeTask) => ({
          id: task.id,
          taskType: task.taskType,
          status: task.status,
          retries: task.retries,
          lastAttemptAt: task.lastAttemptAt,
          error: task.error,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
          startedAt: task.startedAt,
          completedAt: task.completedAt,
          progress: task.progress,
          context: task.context,
        })),
      };

      res.json(response);
    } catch (error) {
      logger.error(`获取爬虫任务列表失败: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /scrape/cancel/:id
   * 取消爬虫任务
   */
  router.post('/cancel/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Task ID is required',
        });
        return;
      }

      // 验证请求体
      const validationResult = ScrapeCancelRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: validationResult.error.issues,
        });
        return;
      }

      const { reason } = validationResult.data;

      logger.info(`取消爬虫任务: ${id}, 原因: ${reason || '用户请求'}`);

      // 取消任务
      const success = await scrapeService.cancelScrapeTask(id);

      const response: ScrapeCancelResponse = {
        success,
        message: success ? '爬虫任务已取消' : '取消爬虫任务失败',
      };

      res.json(response);
    } catch (error) {
      logger.error(`取消爬虫任务失败: ${req.params.id}, 错误: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /scrape/retry/:id
   * 重试爬虫任务
   */
  router.post('/retry/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Task ID is required',
        });
        return;
      }

      // 验证请求体
      const validationResult = ScrapeRetryRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: validationResult.error.issues,
        });
        return;
      }

      const { reason } = validationResult.data;

      logger.info(`重试爬虫任务: ${id}, 原因: ${reason || '用户请求'}`);

      // 重试任务
      const success = await scrapeService.retryScrapeTask(id);

      const response: ScrapeRetryResponse = {
        success,
        message: success ? '爬虫任务已重试' : '重试爬虫任务失败',
      };

      res.json(response);
    } catch (error) {
      logger.error(`重试爬虫任务失败: ${req.params.id}, 错误: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /scrape/stats
   * 获取爬虫任务统计信息
   */
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      logger.info('获取爬虫任务统计');

      // 获取统计信息
      const stats = await scrapeService.getScrapeTaskStats();

      const response: ScrapeStatsResponse = {
        success: true,
        stats,
      };

      res.json(response);
    } catch (error) {
      logger.error(`获取爬虫任务统计失败: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}
