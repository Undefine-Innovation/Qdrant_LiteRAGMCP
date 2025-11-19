import { Router, Request, Response } from 'express';
import { Logger } from '@logging/logger.js';
import { IScrapeService } from '@domain/entities/scrape.js';

/**
 * 创建爬虫结果管理相关的API路由
 * @param scrapeService - 爬虫服务实例
 * @param logger - 日志记录器
 * @returns Express路由器
 */
export function createScrapeResultRoutes(
  scrapeService: IScrapeService,
  logger: Logger,
): Router {
  /**
   * 扩展的 ScrapeService 类型（某些实现会提供额外方法）
   */
  type ExtendedScrapeService = IScrapeService & {
    listScrapeResults?: (params?: {
      status?: 'PENDING' | 'IMPORTED' | 'DELETED';
      taskId?: string;
      limit?: number;
      offset?: number;
      includeContent?: boolean;
    }) => Promise<
      Array<{
        id: string;
        taskId: string;
        url: string;
        title?: string;
        content?: string;
        links?: Array<{ url: string; text?: string; title?: string }>;
        status: 'PENDING' | 'IMPORTED' | 'DELETED';
        created_at: number;
        updated_at: number;
        imported_doc_id?: string | null;
      }>
    >;
    getScrapeResult?: (id: string) => Promise<{
      id: string;
      taskId: string;
      url: string;
      title?: string;
      content?: string;
      links?: Array<{ url: string; text?: string; title?: string }>;
      status: 'PENDING' | 'IMPORTED' | 'DELETED';
      created_at: number;
      updated_at: number;
      imported_doc_id?: string | null;
    } | null>;
    importScrapeResult?: (
      id: string,
      collectionId: string,
      name?: string,
    ) => Promise<{ success: boolean; docId?: string; error?: string }>;
    deleteScrapeResult?: (id: string) => Promise<{ success: boolean }>;
    listScrapeTaskGroups?: (params?: {
      limit?: number;
      offset?: number;
    }) => Promise<
      Array<{
        taskId: string;
        total: number;
        pending: number;
        imported: number;
        deleted: number;
        first_at: number;
        last_at: number;
      }>
    >;
    importTaskResults?: (
      taskId: string,
      collectionId: string,
      namePrefix?: string,
    ) => Promise<{
      success: boolean;
      imported: number;
      errors?: Array<{ id: string; error: string }>;
    }>;
    deleteTaskResults?: (taskId: string) => Promise<{ success: boolean }>;
  };

  const svc = scrapeService as ExtendedScrapeService;
  const router = Router();

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
      const items = await svc.listScrapeResults?.({
        status: status as 'PENDING' | 'IMPORTED' | 'DELETED',
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
      const item = await svc.getScrapeResult?.(id);
      if (!item) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Not found',
          },
        });
        return;
      }
      res.json({ success: true, item });
    } catch (error) {
      logger.error(`获取爬取结果详情失败: ${error}`);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
        },
      });
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
        res
          .status(400)
          .json({ success: false, error: 'id and collectionId are required' });
        return;
      }
      const result = await svc.importScrapeResult?.(id, collectionId, name);
      if (!result?.success) {
        res
          .status(400)
          .json({ success: false, error: result?.error || 'Import failed' });
        return;
      }
      res.json({ success: true, docId: result.docId });
    } catch (error) {
      logger.error(`导入抓取结果失败: ${error}`);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
        },
      });
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
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'id is required',
          },
        });
        return;
      }
      const result = await svc.deleteScrapeResult?.(id);
      if (!result?.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Delete failed',
          },
        });
        return;
      }
      res.json({ success: true });
    } catch (error) {
      logger.error(`删除抓取结果失败: ${error}`);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
        },
      });
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
      const groups = await svc.listScrapeTaskGroups?.({ limit, offset });
      res.json({ success: true, groups: groups ?? [] });
    } catch (error) {
      logger.error(`获取抓取任务分组失败: ${error}`);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
        },
      });
    }
  });

  /**
   * POST /scrape/results/task/:taskId/import
   * 批量导入某个任务的所有PENDING结果
   */
  router.post(
    '/results/task/:taskId/import',
    async (req: Request, res: Response) => {
      try {
        const { taskId } = req.params;
        const { collectionId, namePrefix } = (req.body || {}) as {
          collectionId?: string;
          namePrefix?: string;
        };
        if (!collectionId) {
          res
            .status(400)
            .json({ success: false, error: 'collectionId is required' });
          return;
        }
        const r = await svc.importTaskResults?.(
          taskId,
          collectionId,
          namePrefix,
        );
        res.json(r ?? { success: false, imported: 0 });
      } catch (error) {
        logger.error(`批量导入任务结果失败: ${error}`);
        res
          .status(500)
          .json({ success: false, error: 'Internal server error' });
      }
    },
  );

  /**
   * POST /scrape/results/task/:taskId/delete
   * 批量删除（软删除）某个任务的PENDING结果
   */
  router.post(
    '/results/task/:taskId/delete',
    async (req: Request, res: Response) => {
      try {
        const { taskId } = req.params;
        const r = await svc.deleteTaskResults?.(taskId);
        res.json(r ?? { success: false });
      } catch (error) {
        logger.error(`批量删除任务结果失败: ${error}`);
        res
          .status(500)
          .json({ success: false, error: 'Internal server error' });
      }
    },
  );

  return router;
}
