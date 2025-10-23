import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import { CollectionId, DocId } from '@domain/types.js';
import { IImportService } from './domain/IImportService.js';
import { ISearchService } from './domain/ISearchService.js';
import { IGraphService } from './domain/graph.js';
import { ICollectionService } from './domain/ICollectionService.js';
import { IDocumentService } from './domain/IDocumentService.js';
import { validate, ValidatedRequest } from './middlewares/validate.js';
import { SearchQuerySchema } from './api/contracts/search.js';

/**
 * @interface ApiServices
 * @description API 层所需的应用服务接口集合
 */
interface ApiServices {
  importService: IImportService;
  searchService: ISearchService;
  graphService: IGraphService;
  collectionService: ICollectionService;
  documentService: IDocumentService;
}

/**
 * @function createApiRouter
 * @description 创建并配置 Express API 路由。
 *   此函数作为 Express 控制器层，负责接收请求、解构参数、调用应用服务、封装响应。
 *   它不包含任何业务逻辑，也不应包含 try...catch 块，错误将由全局错误处理中间件统一处理。
 * @param {ApiServices} services - 包含所有必要应用服务实例的对象。
 * @returns {express.Router} 配置好的 Express 路由实例。
 */
export function createApiRouter(services: ApiServices): express.Router {
  const {
    importService,
    searchService,
    graphService,
    collectionService,
    documentService,
  } = services;
  const router = express.Router();

  // 配置multer用于文件上传
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB限制
    },
  });

  /**
   * @api {get} /health 健康检查
   * @apiGroup Common
   * @apiDescription 检查 API 服务的健康状态。
   * @apiSuccess {boolean} ok - 表示服务是否正常运行。
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "ok": true
   *     }
   */
  router.get('/health', (_req, res) => res.json({ ok: true }));

  // -------------------- Collection 路由 --------------------

  /**
   * @api {post} /collections 创建新的 Collection
   * @apiGroup Collections
   * @apiDescription 创建一个新的 Collection。
   * @apiBody {string} name - Collection 的名称。
   * @apiBody {string} [description] - Collection 的描述。
   * @apiSuccess {Collection} collection - 创建成功的 Collection 对象。
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 201 Created
   *     {
   *       "id": "coll-xxxx",
   *       "name": "My New Collection",
   *       "description": "A collection of documents."
   *     }
   */
  router.post('/collections', async (req, res) => {
    // TODO: 添加验证中间件
    const { name, description } = req.body;
    const newCollection = collectionService.createCollection(name, description);
    res.status(201).json(newCollection);
  });

  /**
   * @api {get} /collections 列出所有 Collections
   * @apiGroup Collections
   * @apiDescription 获取所有 Collections 的列表。
   * @apiSuccess {Collection[]} collections - 所有 Collection 对象的数组。
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     [
   *       { "id": "coll-xxxx", "name": "Collection 1" },
   *       { "id": "coll-yyyy", "name": "Collection 2" }
   *     ]
   */
  router.get('/collections', async (_req, res) => {
    const collections = collectionService.listAllCollections();
    res.status(200).json(collections);
  });

  /**
   * @api {get} /collections/:collectionId 获取指定的 Collection
   * @apiGroup Collections
   * @apiDescription 根据 Collection ID 获取单个 Collection。
   * @apiParam {string} collectionId - 要获取的 Collection 的唯一标识符。
   * @apiSuccess {Collection} collection - 找到的 Collection 对象。
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "id": "coll-xxxx",
   *       "name": "My Collection",
   *       "description": "Description of my collection."
   *     }
   * @apiError (404 Not Found) CollectionNotFound - 如果找不到具有给定 ID 的 Collection。
   */
  router.get('/collections/:collectionId', async (req, res) => {
    const { collectionId } = req.params;
    const collection = collectionService.getCollectionById(
      collectionId as CollectionId,
    );
    // 统一错误处理中间件将处理未找到的情况
    res.status(200).json(collection);
  });

  /**
   * @api {delete} /collections/:collectionId 删除 Collection
   * @apiGroup Collections
   * @apiDescription 根据 Collection ID 删除一个 Collection 及其所有相关文档和块。
   * @apiParam {string} collectionId - 要删除的 Collection 的唯一标识符。
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 204 No Content
   */
  router.delete('/collections/:collectionId', async (req, res) => {
    const { collectionId } = req.params;
    await collectionService.deleteCollection(collectionId as CollectionId);
    res.status(204).end();
  });

  // -------------------- Document 路由 --------------------

  /**
   * @api {post} /upload 上传文档
   * @apiGroup Documents
   * @apiDescription 上传一个新文档，使用multipart/form-data格式。
   * @apiParam (FormData) {File} file - 要上传的文档文件。
   * @apiSuccess {string} docId - 上传成功后返回的文档 ID。
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 201 Created
   *     {
   *       "docId": "doc-xxxx"
   *     }
   */
  router.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No file uploaded'
        }
      });
    }

    // 根据OpenAPI规范，不需要collectionId，使用默认集合
    // 先尝试获取或创建默认集合
    const collections = await collectionService.listAllCollections();
    let defaultCollection = collections.find(c => c.name === 'default');
    
    if (!defaultCollection) {
      defaultCollection = collectionService.createCollection('default', 'Default collection for uploads');
    }
    
    const doc = await importService.importUploadedFile(
      req.file,
      defaultCollection.collectionId,
    );
    res.status(201).json({ docId: doc.docId });
  });

  /**
   * @api {post} /docs 导入新文档 (已弃用)
   * @apiGroup Documents
   * @apiDescription 从文件路径导入一个新文档到指定的 Collection。此端点已弃用，请使用 /upload。
   * @apiBody {string} filePath - 文档源文件的路径。
   * @apiBody {string} collectionId - 文档所属 Collection 的 ID。
   * @apiSuccess {Doc} document - 导入成功的文档对象。
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 201 Created
   *     {
   *       "id": "doc-xxxx",
   *       "name": "My Document",
   *       "collectionId": "coll-xxxx"
   *     }
   */
  router.post('/docs', async (req, res) => {
    // TODO: 添加验证中间件
    const { filePath, collectionId } = req.body;
    const doc = await importService.importDocument(
      filePath,
      collectionId as CollectionId,
    );
    res.status(201).json(doc);
  });

  /**
   * @api {get} /docs 列出所有文档
   * @apiGroup Documents
   * @apiDescription 获取所有文档的列表。
   * @apiSuccess {Doc[]} documents - 所有文档对象的数组。
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     [
   *       { "id": "doc-xxxx", "name": "Document 1" },
   *       { "id": "doc-yyyy", "name": "Document 2" }
   *     ]
   */
  router.get('/docs', async (_req, res) => {
    const docs = documentService.listAllDocuments();
    res.status(200).json(docs);
  });

  /**
   * @api {get} /docs/:docId 获取指定的文档
   * @apiGroup Documents
   * @apiDescription 根据文档 ID 获取单个文档。
   * @apiParam {string} docId - 要获取的文档的唯一标识符。
   * @apiSuccess {Doc} document - 找到的文档对象。
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "id": "doc-xxxx",
   *       "name": "My Document",
   *       "collectionId": "coll-xxxx"
   *     }
   * @apiError (404 Not Found) DocumentNotFound - 如果找不到具有给定 ID 的文档。
   */
  router.get('/docs/:docId', async (req, res) => {
    const { docId } = req.params;
    const doc = documentService.getDocumentById(docId as DocId);
    // 统一错误处理中间件将处理未找到的情况
    res.status(200).json(doc);
  });

  /**
   * @api {put} /docs/:docId/resync 重新同步文档
   * @apiGroup Documents
   * @apiDescription 根据文档 ID 重新同步文档内容（从其源文件）。
   * @apiParam {string} docId - 要重新同步的文档的唯一标识符。
   * @apiSuccess {Doc} document - 更新后的文档对象。
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "id": "doc-xxxx",
   *       "name": "My Document (Updated)",
   *       "collectionId": "coll-xxxx"
   *     }
   */
  router.put('/docs/:docId/resync', async (req, res) => {
    const { docId } = req.params;
    const updatedDoc = await documentService.resyncDocument(docId as DocId);
    res.status(200).json(updatedDoc);
  });

  /**
   * @api {delete} /docs/:docId 删除文档
   * @apiGroup Documents
   * @apiDescription 根据文档 ID 删除文档。
   * @apiParam {string} docId - 要删除的文档的唯一标识符。
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 204 No Content
   */
  router.delete('/docs/:docId', async (req, res) => {
    const { docId } = req.params;
    await documentService.deleteDocument(docId as DocId);
    res.status(204).end();
  });

  // -------------------- Graph 路由 --------------------

  /**
   * @api {post} /docs/:docId/extract-graph 提取并存储文档图谱
   * @apiGroup Graph
   * @apiDescription 为指定的文档触发知识图谱的提取和存储过程。
   * @apiParam {string} docId - 要提取图谱的文档的唯一标识符。
   * @apiSuccess {object} message - 描述操作状态的消息。
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 202 Accepted
   *     {
   *       "message": "Graph extraction initiated for document ID: doc-xxxx"
   *     }
   */
  router.post('/docs/:docId/extract-graph', async (req, res) => {
    const { docId } = req.params;
    await graphService.extractAndStoreGraph(docId as DocId);
    res.status(202).json({
      message: `Graph extraction initiated for document ID: ${docId}`,
    });
  });

  // -------------------- Search 路由 --------------------

  /**
   * @api {get} /search 执行向量搜索
   * @apiGroup Search
   * @apiDescription 根据查询和可选的 Collection ID 执行向量相似度搜索。
   * @apiParam {string} q - 搜索查询字符串。
   * @apiParam {string} collectionId - 要在其中执行搜索的集合的 ID。
   * @apiParam {number} [limit=10] - 返回结果的最大数量。
   * @apiSuccess {SearchResult[]} results - 搜索结果数组。
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "results": [
   *         { "pointId": "chunk-xxxx", "content": "...", "score": 0.95 }
   *       ]
   *     }
   */
  router.get(
    '/search',
    validate({ query: SearchQuerySchema }),
    async (
      req: ValidatedRequest<unknown, z.infer<typeof SearchQuerySchema>>,
      res,
    ) => {
      const validatedQuery = req.validated!.query;
      if (!validatedQuery) {
        // This should not happen with validation middleware, but TypeScript needs it
        return res.status(400).json({ error: 'Invalid query parameters' });
      }
      const { q: query, collectionId, limit } = validatedQuery;
      const results = await searchService.search(
        query,
        collectionId as CollectionId,
        { limit },
      );
      // 根据OpenAPI规范，直接返回RetrievalResultDTO数组
      res.status(200).json(results);
    },
  );

  return router;
}
