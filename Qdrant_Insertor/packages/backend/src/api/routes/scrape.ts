// src/api/routes/scrape.ts

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
} from '@api/contracts/scrape.js';
import { IScrapeService, IScrapeTask } from '@domain/entities/scrape.js';

/**
 * 创建爬虫相关路由
 * @param scrapeService - 爬虫服务实例
 * @param logger - 日志记录器
 * @returns Express路由器
 */
export function createScrapeRoutes(
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

  /**
   * GET /scrape/results
   * 列出已持久化的爬取结果（默认仅返回 PENDING）
   */
  router.get('/results', async (req: Request, res: Response) => {
    try {
      const status = (req.query.status as string) || 'PENDING';
      const taskId = (req.query.taskId as string) || undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const offset = req.query.offset ? Number(req.query.offset) : undefined;
      const includeContent = req.query.includeContent === 'true' ? true : false;
      const items = await (scrapeService as any).listScrapeResults?.({
        status: status as any,
        taskId,
        limit,
        offset,
        includeContent,
      });
      res.json({ success: true, items: items ?? [] });
    } catch (error) {
      logger.error(`获取爬取结果列表失败: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /scrape/results/:id
   * 获取单条抓取结果详情（包含全文）
   */
  router.get('/results/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const item = await (scrapeService as any).getScrapeResult?.(id);
      if (!item) {
        res.status(404).json({ success: false, error: 'Not found' });
        return;
      }
      res.json({ success: true, item });
    } catch (error) {
      logger.error(`获取爬取结果详情失败: ${error}`);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  /**
   * POST /scrape/results/:id/import
   * 将抓取结果导入为文档
   */
  router.post('/results/:id/import', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { collectionId, name } = (req.body || {}) as {
        collectionId?: string;
        name?: string;
      };
      if (!id || !collectionId) {
        res.status(400).json({ success: false, error: 'id and collectionId are required' });
        return;
      }
      const result = await (scrapeService as any).importScrapeResult?.(id, collectionId, name);
      if (!result?.success) {
        res.status(400).json({ success: false, error: result?.error || 'Import failed' });
        return;
      }
      res.json({ success: true, docId: result.docId });
    } catch (error) {
      logger.error(`导入抓取结果失败: ${error}`);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  /**
   * POST /scrape/results/:id/delete
   * 软删除抓取结果
   */
  router.post('/results/:id/delete', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ success: false, error: 'id is required' });
        return;
      }
      const result = await (scrapeService as any).deleteScrapeResult?.(id);
      if (!result?.success) {
        res.status(400).json({ success: false, error: 'Delete failed' });
        return;
      }
      res.json({ success: true });
    } catch (error) {
      logger.error(`删除抓取结果失败: ${error}`);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  /**
   * GET /scrape/results/groups
   * 按任务分组的统计信息
   */
  router.get('/results-groups', async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const offset = req.query.offset ? Number(req.query.offset) : undefined;
      const groups = await (scrapeService as any).listScrapeTaskGroups?.({ limit, offset });
      res.json({ success: true, groups: groups ?? [] });
    } catch (error) {
      logger.error(`获取抓取任务分组失败: ${error}`);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  /**
   * POST /scrape/results/task/:taskId/import
   * 批量导入某个任务的所有PENDING结果
   */
  router.post('/results/task/:taskId/import', async (req: Request, res: Response) => {
    try {
      const { taskId } = req.params;
      const { collectionId, namePrefix } = (req.body || {}) as { collectionId?: string; namePrefix?: string };
      if (!collectionId) {
        res.status(400).json({ success: false, error: 'collectionId is required' });
        return;
      }
      const r = await (scrapeService as any).importTaskResults?.(taskId, collectionId, namePrefix);
      res.json(r ?? { success: false, imported: 0 });
    } catch (error) {
      logger.error(`批量导入任务结果失败: ${error}`);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  /**
   * POST /scrape/results/task/:taskId/delete
   * 批量删除（软删除）某个任务的PENDING结果
   */
  router.post('/results/task/:taskId/delete', async (req: Request, res: Response) => {
    try {
      const { taskId } = req.params;
      const r = await (scrapeService as any).deleteTaskResults?.(taskId);
      res.json(r ?? { success: false });
    } catch (error) {
      logger.error(`批量删除任务结果失败: ${error}`);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  return router;
}
