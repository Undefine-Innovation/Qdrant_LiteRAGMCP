import { Router } from 'express';
import { MonitoringApiService } from '../application/MonitoringApiService.js';
import { validate, ValidatedRequest } from '../middlewares/validate.js';
import {
  HealthCheckRequestSchema,
  SyncJobStatsRequestSchema,
  SystemMetricsRequestSchema,
  CreateAlertRuleRequestSchema,
  UpdateAlertRuleRequestSchema,
  AlertHistoryRequestSchema,
  DashboardDataRequestSchema,
  CreateNotificationChannelRequestSchema,
  UpdateNotificationChannelRequestSchema,
  TestNotificationRequestSchema,
} from '../api/contracts/monitoring.js';
import { logger } from '../logger.js';

export function createMonitoringRoutes(
  monitoringApiService: MonitoringApiService,
): Router {
  const router = Router();

  // 健康检查API
  router.get(
    '/health',
    validate({ query: HealthCheckRequestSchema }),
    async (req: ValidatedRequest, res) => {
      try {
        const result = await monitoringApiService.getHealthCheck(
          req.validated!.query!,
        );
        res.json(result);
      } catch (error) {
        logger.error('Health check failed', { error });
        res.status(500).json({ error: 'Health check failed' });
      }
    },
  );

  // 同步作业统计API
  router.get(
    '/sync-jobs/stats',
    validate({ query: SyncJobStatsRequestSchema }),
    async (req: ValidatedRequest, res) => {
      try {
        const result = await monitoringApiService.getSyncJobStats(
          req.validated!.query as any,
        );
        res.json(result);
      } catch (error) {
        logger.error('Get sync job stats failed', { error });
        res.status(500).json({ error: 'Failed to get sync job stats' });
      }
    },
  );

  // 系统指标API
  router.get(
    '/metrics',
    validate({ query: SystemMetricsRequestSchema }),
    async (req: ValidatedRequest, res) => {
      try {
        const result = await monitoringApiService.getSystemMetrics(
          req.validated!.query as any,
        );
        res.json(result);
      } catch (error) {
        logger.error('Get system metrics failed', { error });
        res.status(500).json({ error: 'Failed to get system metrics' });
      }
    },
  );

  // 告警规则API
  const alertRulesRouter = Router();

  // 创建告警规则
  alertRulesRouter.post(
    '/',
    validate({ body: CreateAlertRuleRequestSchema }),
    async (req: ValidatedRequest, res) => {
      try {
        const result = await monitoringApiService.createAlertRule(
          req.validated!.body as any,
        );
        res.status(201).json(result);
      } catch (error) {
        logger.error('Create alert rule failed', { error });
        res.status(500).json({ error: 'Failed to create alert rule' });
      }
    },
  );

  // 获取告警规则列表
  alertRulesRouter.get('/', async (req, res) => {
    try {
      // 检查是否提供了分页参数，如果没有则返回所有结果（向后兼容）
      const hasPaginationParams = req.query.page || req.query.limit;

      if (hasPaginationParams) {
        const page = req.query.page
          ? parseInt(req.query.page as string, 10)
          : 1;
        const limit = req.query.limit
          ? parseInt(req.query.limit as string, 10)
          : 20;
        const sort = (req.query.sort as string) || 'created_at';
        const order = (req.query.order as string) === 'asc' ? 'asc' : 'desc';
        const activeOnly = req.query.activeOnly === 'true';

        const result = await monitoringApiService.getAlertRulesPaginated(
          page,
          limit,
          sort,
          order,
          activeOnly,
        );

        // 构建分页响应
        const totalPages = Math.ceil(result.total / limit);
        const response = {
          data: result.rules,
          pagination: {
            page,
            limit,
            total: result.total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        };

        res.json(response);
      } else {
        // 向后兼容：如果没有分页参数，返回所有结果
        const result = await monitoringApiService.getAlertRules();
        res.json(result);
      }
    } catch (error) {
      logger.error('Get alert rules failed', { error });
      res.status(500).json({ error: 'Failed to get alert rules' });
    }
  });

  // 更新告警规则
  alertRulesRouter.put(
    '/:ruleId',
    validate({ body: UpdateAlertRuleRequestSchema }),
    async (req: ValidatedRequest, res) => {
      try {
        const { ruleId } = req.params;
        const result = await monitoringApiService.updateAlertRule(
          ruleId,
          req.validated!.body!,
        );
        res.json(result);
      } catch (error) {
        logger.error('Update alert rule failed', { error });
        res.status(500).json({ error: 'Failed to update alert rule' });
      }
    },
  );

  // 删除告警规则
  alertRulesRouter.delete('/:ruleId', async (req, res) => {
    try {
      const { ruleId } = req.params;
      await monitoringApiService.deleteAlertRule(ruleId);
      res.status(204).send();
    } catch (error) {
      logger.error('Delete alert rule failed', { error });
      res.status(500).json({ error: 'Failed to delete alert rule' });
    }
  });

  router.use('/alert-rules', alertRulesRouter);

  // 告警历史API
  router.get(
    '/alerts/history',
    validate({ query: AlertHistoryRequestSchema }),
    async (req: ValidatedRequest, res) => {
      try {
        const result = await monitoringApiService.getAlertHistory(
          req.validated!.query as any,
        );
        res.json(result);
      } catch (error) {
        logger.error('Get alert history failed', { error });
        res.status(500).json({ error: 'Failed to get alert history' });
      }
    },
  );

  // 仪表板数据API
  router.get(
    '/dashboard',
    validate({ query: DashboardDataRequestSchema }),
    async (req: ValidatedRequest, res) => {
      try {
        const result = await monitoringApiService.getDashboardData(
          req.validated!.query as any,
        );
        res.json(result);
      } catch (error) {
        logger.error('Get dashboard data failed', { error });
        res.status(500).json({ error: 'Failed to get dashboard data' });
      }
    },
  );

  // 通知渠道API
  const notificationChannelsRouter = Router();

  // 创建通知渠道
  notificationChannelsRouter.post(
    '/',
    validate({ body: CreateNotificationChannelRequestSchema }),
    async (req: ValidatedRequest, res) => {
      try {
        const result = await monitoringApiService.createNotificationChannel(
          req.validated!.body as any,
        );
        res.status(201).json(result);
      } catch (error) {
        logger.error('Create notification channel failed', { error });
        res
          .status(500)
          .json({ error: 'Failed to create notification channel' });
      }
    },
  );

  // 获取通知渠道列表
  notificationChannelsRouter.get('/', async (req, res) => {
    try {
      const result = await monitoringApiService.getNotificationChannels();
      res.json(result);
    } catch (error) {
      logger.error('Get notification channels failed', { error });
      res.status(500).json({ error: 'Failed to get notification channels' });
    }
  });

  // 更新通知渠道
  notificationChannelsRouter.put(
    '/:channelId',
    validate({ body: UpdateNotificationChannelRequestSchema }),
    async (req: ValidatedRequest, res) => {
      try {
        const { channelId } = req.params;
        const result = await monitoringApiService.updateNotificationChannel(
          channelId,
          req.validated!.body!,
        );
        res.json(result);
      } catch (error) {
        logger.error('Update notification channel failed', { error });
        res
          .status(500)
          .json({ error: 'Failed to update notification channel' });
      }
    },
  );

  // 删除通知渠道
  notificationChannelsRouter.delete('/:channelId', async (req, res) => {
    try {
      const { channelId } = req.params;
      await monitoringApiService.deleteNotificationChannel(channelId);
      res.status(204).send();
    } catch (error) {
      logger.error('Delete notification channel failed', { error });
      res.status(500).json({ error: 'Failed to delete notification channel' });
    }
  });

  // 测试通知
  notificationChannelsRouter.post(
    '/:channelId/test',
    validate({ body: TestNotificationRequestSchema }),
    async (req: ValidatedRequest, res) => {
      try {
        const { channelId } = req.params;
        const result = await monitoringApiService.testNotification({
          channelId,
          ...(req.validated!.body as any),
        });
        res.json(result);
      } catch (error) {
        logger.error('Test notification failed', { error });
        res.status(500).json({ error: 'Failed to test notification' });
      }
    },
  );

  router.use('/notification-channels', notificationChannelsRouter);

  return router;
}
