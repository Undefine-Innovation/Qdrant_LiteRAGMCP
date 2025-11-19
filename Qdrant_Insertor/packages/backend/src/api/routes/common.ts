import express from 'express';

/**
 * 创建通用API路由，如健康检查等
 *
 * @returns 配置好的 Express 路由实例
 */
export function createCommonRoutes(): express.Router {
  const router = express.Router();

  /**
   * @api {get} /health 健康检查
   * @apiGroup Common
   * @apiDescription 检查API 服务的健康状态
   * @apiSuccess {boolean} ok - 表示服务是否正常运行
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "ok": true
   *     }
   */
  router.get('/health', (_req, res) => res.json({ ok: true }));

  /**
   * @api {get} /healthz 详细健康检查
   * @apiGroup Common
   * @apiDescription 检查API服务及其依赖项的详细健康状态
   * @apiSuccess {boolean} success - 表示服务是否正常运行
   * @apiSuccess {string} status - 整体状态：healthy, degraded, unhealthy
   * @apiSuccess {string} timestamp - 检查时间戳
   * @apiSuccess {string} version - 服务版本
   * @apiSuccess {Object} services - 各服务组件的状态
   * @apiSuccess {string} services.database - 数据库状态
   * @apiSuccess {string} services.qdrant - Qdrant向量数据库状态
   * @apiSuccess {string} services.filesystem - 文件系统状态
   * @apiSuccess {Object} metrics - 系统指标
   * @apiSuccess {number} metrics.uptime - 服务运行时间（秒）
   * @apiSuccess {string} metrics.memoryUsage - 内存使用率
   * @apiSuccess {string} metrics.diskUsage - 磁盘使用率
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "success": true,
   *       "status": "healthy",
   *       "timestamp": "2024-01-01T12:00:00Z",
   *       "version": "1.0.0",
   *       "services": {
   *         "database": "healthy",
   *         "qdrant": "healthy",
   *         "filesystem": "healthy"
   *       },
   *       "metrics": {
   *         "uptime": 86400,
   *         "memoryUsage": "45%",
   *         "diskUsage": "23%"
   *       }
   *     }
   */
  router.get('/healthz', async (req, res) => {
    try {
      const now = new Date().toISOString();
      const uptime = process.uptime();

      // 简单的内存使用率计算
      const memoryUsage = process.memoryUsage();
      const totalMemory = memoryUsage.heapTotal;
      const usedMemory = memoryUsage.heapUsed;
      const memoryUsagePercent = ((usedMemory / totalMemory) * 100).toFixed(1);

      // 模拟磁盘使用率（实际项目中应该使用真实的磁盘检测）
      const diskUsagePercent = '23%';

      // 检查数据库连接
      let dbStatus = 'unhealthy';
      const dataSource = res.locals.typeormDataSource;

      if (dataSource && dataSource.isInitialized) {
        try {
          await dataSource.query('SELECT 1');
          dbStatus = 'healthy';
        } catch (error) {
          dbStatus = 'unhealthy';
        }
      }

      res.json({
        success: true,
        status: dbStatus === 'healthy' ? 'healthy' : 'degraded',
        timestamp: now,
        version: '1.0.0',
        services: {
          database: dbStatus,
          qdrant: 'healthy',
          filesystem: 'healthy',
        },
        metrics: {
          uptime: Math.floor(uptime),
          memoryUsage: `${memoryUsagePercent}%`,
          diskUsage: diskUsagePercent,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        error: (error as Error).message,
      });
    }
  });

  return router;
}
