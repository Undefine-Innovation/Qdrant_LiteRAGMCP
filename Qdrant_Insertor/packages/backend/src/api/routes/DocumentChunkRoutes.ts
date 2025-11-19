import express from 'express';
import { DocId } from '@domain/entities/types.js';
import { IDocumentService } from '@application/services/index.js';
import { LoggedRequest } from '@middleware/logging.js';
import { LogTag } from '@logging/logger.js';

/**
 * 创建文档块相关的API路由
 *
 * @param documentService - 文档服务实例
 * @returns 配置好的 Express 路由实例
 */
export function createDocumentChunkRoutes(
  documentService: IDocumentService,
): express.Router {
  const router = express.Router();

  /**
   * @api {get} /docs/:docId/chunks 获取文档的块列表
   * @apiGroup Documents
   * @apiDescription 根据文档ID获取该文档的所有块。支持分页参数
   * @apiParam {string} docId - 文档的唯一标识符
   * @apiParam {number} [page=1] - 页码，从1开始
   * @apiParam {number} [limit=20] - 每页数量，最多100
   * @apiParam {string} [sort=chunkIndex] - 排序字段
   * @apiParam {string} [order=asc] - 排序方向，asc或desc
   * @apiSuccess {Object} response - 分页响应对象
   * @apiSuccess {Object[]} response.data - 文档块数组
   * @apiSuccess {string} response.data.pointId - 块的点ID
   * @apiSuccess {string} response.data.docId - 文档ID
   * @apiSuccess {string} response.data.collectionId - 集合ID
   * @apiSuccess {number} response.data.chunkIndex - 块索引
   * @apiSuccess {string} response.data.title - 块标题（可选）
   * @apiSuccess {string} response.data.content - 块内容
   * @apiSuccess {Object} response.pagination - 分页元数据
   * @apiSuccess {number} response.pagination.page - 当前页码
   * @apiSuccess {number} response.pagination.limit - 每页数量
   * @apiSuccess {number} response.pagination.total - 总记录数量
   * @apiSuccess {number} response.pagination.totalPages - 总页数
   * @apiSuccess {boolean} response.pagination.hasNext - 是否有下一页
   * @apiSuccess {boolean} response.pagination.hasPrev - 是否有上一页
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "data": [
   *         {
   *           "pointId": "doc-1_0",
   *           "docId": "doc-1",
   *           "collectionId": "coll-1",
   *           "chunkIndex": 0,
   *           "title": "Introduction",
   *           "content": "This is the first chunk..."
   *         }
   *       ],
   *       "pagination": {
   *         "page": 1,
   *         "limit": 20,
   *         "total": 1,
   *         "totalPages": 1,
   *         "hasNext": false,
   *         "hasPrev": false
   *       }
   *     }
   */
  router.get('/docs/:docId/chunks', async (req: LoggedRequest, res) => {
    const startTime = Date.now();
    const apiLogger = req.logger?.withTag(LogTag.API);

    apiLogger?.info('开始获取文档块API请求', undefined, {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });

    try {
      const { docId } = req.params;

      apiLogger?.info('开始获取文档块', undefined, {
        docId,
      });

      // 检查是否提供了分页参数，如果没有则返回所有结果（向后兼容）
      const hasPaginationParams = req.query.page || req.query.limit;

      if (hasPaginationParams) {
        // 构建分页查询参数
        const paginationQuery = {
          page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
          limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
          sort: (req.query.sort as string) || 'chunkIndex',
          order: ((req.query.order as string) || 'asc') as 'asc' | 'desc',
        };

        apiLogger?.info('开始分页查询文档块', undefined, {
          docId,
          pagination: paginationQuery,
        });

        const paginatedChunks =
          await documentService.getDocumentChunksPaginated(
            docId as DocId,
            paginationQuery,
          );

        apiLogger?.info('分页查询文档块成功', undefined, {
          docId,
          count: paginatedChunks.data.length,
          total: paginatedChunks.pagination.total,
          duration: Date.now() - startTime,
        });

        res.status(200).json(paginatedChunks);
      } else {
        // 向后兼容：如果没有分页参数，返回所有结果
        apiLogger?.info('开始查询所有文档块（向后兼容）', undefined, {
          docId,
        });

        const chunks = await documentService.getDocumentChunks(docId as DocId);

        apiLogger?.info('查询所有文档块成功', undefined, {
          docId,
          count: chunks.length,
          duration: Date.now() - startTime,
        });

        res.status(200).json(chunks);
      }
    } catch (error) {
      apiLogger?.error('获取文档块失败', undefined, {
        docId: req.params.docId,
        query: req.query,
        error: (error as Error).message,
        stack: (error as Error).stack,
        duration: Date.now() - startTime,
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
      });
    }
  });

  return router;
}
