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

  return router;
}
