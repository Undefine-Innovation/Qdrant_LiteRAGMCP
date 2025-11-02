import express from 'express';
import { DocId } from '@domain/entities/types.js';
import { IGraphService } from '@domain/entities/graph.js';

/**
 * 创建图谱相关的API路由
 * @param {IGraphService} graphService - 图谱服务实例
 * @returns {express.Router} 配置好的 Express 路由实例
 */
export function createGraphRoutes(graphService: IGraphService): express.Router {
  const router = express.Router();

  /**
   * @api {post} /docs/:docId/extract-graph 提取并存储文档图谱
   * @apiGroup Graph
   * @apiDescription 为指定的文档触发知识图谱的提取和存储过程
   * @apiParam {string} docId - 要提取图谱的文档的唯一标识符
   * @apiSuccess {object} message - 描述操作状态的消息
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 202 Accepted
   *     {
   *       "message": "Graph extraction initiated for document ID: doc-xxxx"
   *     }
   */
  router.post('/docs/:docId/extract-graph', async (req, res) => {
    const { docId } = req.params;
    // 触发图谱提取但不等待完成
    void graphService.extractAndStoreGraph(docId as DocId);
    res.status(202).json({
      message: `Graph extraction initiated for document ID: ${docId}`,
    });
  });

  return router;
}