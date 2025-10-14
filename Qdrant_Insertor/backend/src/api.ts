import express from 'express';
import { DB} from './db.js';
import { Version } from '../../share/type.js';
import { runSearch } from './search.js';

import { ensureCollection, upsertChunks, deletePointsByDoc } from './qdrant.js';
import { createEmbedding } from './embedding.js';
import { makeDocId } from '../../share/utils/id.js';
import { validateConfig } from './config.js'; // Corrected path for config

/**
 * API 应用工厂
 *
 * 这个模块负责创建并导出一个 Express 应用，封装所有后端的 REST 路由：
 * - Collections: 管理集合（创建、列出、获取、删除）
 * - Versions: 管理版本（创建、列出、设置状态、finalize、设置为当前版本）
 * - Docs: 文档的 CRUD（创建时会做拆分、入库、生成 embedding 并同步到 Qdrant）
 * - Search: 基于 embedding 的向量检索
 *
 * 实现要点：
 * - 依赖注入：可传入 `deps.db` 以便测试或替换底层存储实现，否则使用默认的 `DB`。
 * - 错误处理：路由内部捕获错误并传递，末尾统一返回 500 JSON。
 * - Qdrant 相关操作会调用 `ensureCollection`, `upsertChunks`, `deletePointsByDoc` 等函数。
 *
 * 注意：本函数只负责路由和流程控制，具体的 DB、splitter、embedding、qdrant 实现位于对应模块。
 *
 * @param deps 可选依赖注入对象，当前仅支持 { db?: DB }
 * @returns 已配置好的 Express 应用实例
 */
export function createApp(deps?: { db?: DB }) {
  const app = express();
  app.use(express.json());

  const cfg = validateConfig();
  const db = deps?.db ?? new DB(cfg.db.path);

  route(app, db);

  return app;
}


function route(app: express.Express, db: DB) {
  // 健康检查：用于容器/负载均衡器检查服务存活
  app.get('/health', (_req, res) => res.json({ ok: true }));

  // -------------------- Collections 路由 --------------------
  /**
   * 创建 Collection
   * 请求体: { name: string, description?: string }
   * 返回: 201 + 新创建的 collection 对象
   */
  app.post('/collections', (req, res, next) => {
    try {
      const { name, description } = req.body || {};
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'BadRequest: name required' });
      }
      const col = db.createCollection(name, description);
      res.status(201).json(col);
    } catch (e) {
      next(e);
    }
  });

  /**
   * 列出所有 Collections
   */
  app.get('/collections', (_req, res, next) => {
    try {
      const cols = db.listCollections();
      res.status(200).json(cols);
    } catch (e) {
      next(e);
    }
  });

  /**
   * 获取指定 Collection
   */
  app.get('/collections/:collectionId', (req, res, next) => {
    try {
      const col = db.getCollectionById(req.params.collectionId);
      if (!col) return res.status(404).json({ error: 'Collection not found' });
      res.status(200).json(col);
    } catch (e) {
      next(e);
    }
  });

  /**
   * 获取某 Collection 下的所有 Version
   */
  app.get('/collections/:collectionId/versions', (req, res, next) => {
    try {
      const col = db.getCollectionById(req.params.collectionId);
      if (!col) return res.status(404).json({ error: 'Collection not found' });
      const versions = db.listVersions(req.params.collectionId);
      res.status(200).json(versions);
    } catch (e) {
      next(e);
    }
  });

  /**
   * 为指定 Collection 创建一个新的 Version
   * 请求体: { name: string, description?: string }
   */
  app.post('/collections/:collectionId/versions', (req, res, next) => {
    try {
      const { name, description } = req.body || {};
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'BadRequest: name required' });
      }
      const col = db.getCollectionById(req.params.collectionId);
      if (!col) return res.status(404).json({ error: 'Collection not found' });
      const version = db.createVersion(
        req.params.collectionId,
        name,
        description,
      );
      res.status(201).json(version);
    } catch (e) {
      next(e);
    }
  });

  /**
   * 删除指定 Collection（数据库中删除）
   */
  app.delete('/collections/:collectionId', (req, res, next) => {
    try {
      const col = db.getCollectionById(req.params.collectionId);
      if (!col) {
        // 统一错误格式，返回 404 + 统一错误消息
        return res.status(404).json({ error: 'Collection not found' });
      }
      db.deleteCollection(req.params.collectionId);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  // -------------------- Versions 路由 --------------------
  /**
   * 列出 Versions，可通过 query.collectionId 过滤
   */
  app.get('/versions', async (req, res) => {
    try {
      const { collectionId } = req.query as { collectionId?: string };
      let versions: Version[];
      if (collectionId) {
        versions = db.listVersions(collectionId);
      } else {
        versions = db
          .listCollections()
          .flatMap((c) => db.listVersions(c.collectionId));
      }
      res.json(versions);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /**
   * 获取单个 Version
   */
  app.get('/versions/:versionId', async (req, res) => {
    const { versionId } = req.params;
    const version = db.getVersion(versionId);
    if (!version) return res.status(404).json({ error: 'Version not found' });
    res.json(version);
  });

  /**
   * 删除单个 Version
   */
  app.delete('/versions/:versionId', async (req, res) => {
    const { versionId } = req.params;
    const ok = db.deleteVersion(versionId);
    if (!ok) return res.status(404).json({ error: 'Version not found' });
    res.status(204).end();
  });

  /**
   * 更新 Version 的 status 字段
   * 请求体: { status: string }
   */
  app.put('/versions/:versionId/status', async (req, res) => {
    const { versionId } = req.params;
    const { status } = req.body;
    if (!status)
      return res.status(400).json({ error: 'BadRequest: status required' });
    const version = db.getVersion(versionId);
    if (!version) return res.status(404).json({ error: 'Version not found' });
    try {
      db.setVersionStatus(versionId, status);
      const updatedVersion = db.getVersion(versionId);
      res.status(200).json(updatedVersion);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /**
   * 将指定 Version 设为当前版本（is_current）
   */
  app.post('/versions/:versionId/set-current', async (req, res) => {
    const { versionId } = req.params;
    const version = db.getVersion(versionId);
    if (!version) return res.status(404).json({ error: 'Version not found' });
    try {
      db.setCurrentVersion(versionId, version.collectionId);
      const updated = db.getVersion(versionId);
      res.status(200).json({ is_current: updated?.is_current === true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /**
   * finalize 操作：仅允许在 status === 'EDITING' 时调用
   */
  app.post('/versions/:versionId/finalize', async (req, res) => {
    const { versionId } = req.params;
    const version = db.getVersion(versionId);
    if (!version) return res.status(404).json({ error: 'Version not found' });
    if (version.status !== 'EDITING') {
      return res.status(400).json({
        error: 'BadRequest: Only versions in "EDITING" status can be finalized',
      });
    }
    try {
      const { finalVersionId, isNew } = db.finalizeVersion(versionId);
      res.status(200).json({ finalVersionId, isNew });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /**
   * 创建 Version（备用入口）
   * 请求体需包含: { collectionId, docIds, name }
   */
  app.post('/versions', async (req, res) => {
    const { collectionId, docIds } = req.body;
    if (!collectionId || !Array.isArray(docIds)) {
      return res
        .status(400)
        .json({ error: 'BadRequest: collectionId and docIds required' });
    }
    try {
      const { name, description } = req.body;
      if (!name || !collectionId) {
        return res
          .status(400)
          .json({ error: 'BadRequest: collectionId and name required' });
      }
      const version = db.createVersion(collectionId, name, description);
      res.status(201).json(version);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // -------------------- Docs 路由 --------------------
  /**
   * 列出所有文档
   */
  app.get('/docs', async (req, res) => {
    try {
      const docs = db.getAllDocs();
      res.json(docs);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /**
   * 获取单个文档
   */
  app.get('/docs/:docId', async (req, res) => {
    const { docId } = req.params;
    const doc = db.getDocById(docId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json(doc);
  });

  /**
   * 创建文档：流程说明
   * 1. 在本地 DB 创建 doc
   * 2. 使用 splitter 将文本拆分为 chunks
   * 3. 将 chunk 的 meta / text 存入 DB
   * 4. 调用 embedding 服务生成向量
   * 5. 对每个 chunk 组装 upsert 对象并调用 Qdrant upsert
   */
  app.post('/docs', async (req, res) => {
    const { content, collectionId, versionId, key, name, mimeType, metadata } =
      req.body;
    if (!content || !collectionId || !versionId || !key) {
      return res.status(400).json({
        error: 'BadRequest: content, collectionId, versionId, and key required',
      });
    }
    try {
      const doc = db.createDoc(
        versionId,
        collectionId,
        key,
        content,
        name ?? metadata?.title ?? '',
        mimeType || 'text/plain',
      );
      const { splitDocument: splitDocumentCreate } = await import(
        './splitter.js'
      );
      const chunksCreate = await splitDocumentCreate(content, {
        strategy: 'markdown',
      });
      const metasCreate = chunksCreate.map((chunk, index) => ({
        pointId: `${doc.docId}#${index}`,
        chunkIndex: index,
        titleChain: chunk.titleChain ? chunk.titleChain.join(' > ') : '',
        contentHash: doc.docId,
      }));
      const textsCreate = chunksCreate.map((chunk, index) => ({
        pointId: `${doc.docId}#${index}`,
        content: chunk.content,
        title: chunk.titleChain
          ? chunk.titleChain[chunk.titleChain.length - 1]
          : '',
      }));
      await db.insertChunkBatch({
        collectionId,
        versionId,
        docId: doc.docId,
        metas: metasCreate,
        texts: textsCreate,
      });
      // === Embedding + Qdrant upsert (create) ===
      await ensureCollection();
      const _vecsC = await createEmbedding(
        chunksCreate.map((ch) => ch.content),
        { forceLive: true },
      );
      const vectorsCreate = (Array.isArray(_vecsC) ? _vecsC : []) as number[][];

      const upsertsCreate = chunksCreate.map((chunk, index) => ({
        collectionId,
        versionId,
        docId: doc.docId,
        chunkIndex: index,
        content: chunk.content,
        titleChain: chunk.titleChain ? chunk.titleChain.join(' > ') : '',
        contentHash: makeDocId(chunk.content),
        vector:
          vectorsCreate[index] ?? new Array(cfg.qdrant.vectorSize).fill(0),
        pointId: `${doc.docId}#${index}`,
      }));
      await upsertChunks(upsertsCreate);
      res.status(201).json(doc);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /**
   * 更新文档：流程说明
   * - 更新本地 DB
   * - 重新拆分、入库 chunk
   * - 删除旧的 Qdrant 向量（按 docId）
   * - 生成 embedding 并 upsert 新向量
   */
  app.put('/docs/:docId', async (req, res) => {
    const { docId } = req.params;
    const { content, name, mimeType, metadata } = req.body;
    if (!content)
      return res.status(400).json({ error: 'BadRequest: content required' });
    const doc = db.getDocById(docId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    try {
      const updated = db.updateDoc(
        docId,
        content,
        name || doc.name,
        mimeType || doc.mime,
      );
      if (!updated) throw new Error('Document update failed');
      const { splitDocument: splitDocumentUpdate } = await import(
        './splitter.js'
      );
      const chunksUpdate = await splitDocumentUpdate(content, {
        strategy: 'markdown',
      });
      const metasUpdate = chunksUpdate.map((chunk, index) => ({
        pointId: `${updated.docId}#${index}`,
        chunkIndex: index,
        titleChain: chunk.titleChain ? chunk.titleChain.join(' > ') : '',
        contentHash: updated.docId,
      }));
      const textsUpdate = chunksUpdate.map((chunk, index) => ({
        pointId: `${updated.docId}#${index}`,
        content: chunk.content,
        title: chunk.titleChain
          ? chunk.titleChain[chunk.titleChain.length - 1]
          : '',
      }));
      await db.insertChunkBatch({
        collectionId: updated.collectionId,
        versionId: updated.versionId,
        docId: updated.docId,
        metas: metasUpdate,
        texts: textsUpdate,
      });
      // 先删除旧 docId 的向量，避免残留
      await deletePointsByDoc(docId);
      // === Embedding + Qdrant upsert (update) ===
      await ensureCollection();
      const _vecsU = await createEmbedding(
        chunksUpdate.map((ch) => ch.content),
        { forceLive: true },
      );
      const vectorsUpdate = (Array.isArray(_vecsU) ? _vecsU : []) as number[][];

      const upsertsUpdate = chunksUpdate.map((chunk, index) => ({
        collectionId: updated.collectionId,
        versionId: updated.versionId,
        docId: updated.docId,
        chunkIndex: index,
        content: chunk.content,
        titleChain: chunk.titleChain ? chunk.titleChain.join(' > ') : '',
        contentHash: makeDocId(chunk.content),
        vector:
          vectorsUpdate[index] ?? new Array(cfg.qdrant.vectorSize).fill(0),
        pointId: `${updated.docId}#${index}`,
      }));
      await upsertChunks(upsertsUpdate);

      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /**
   * 删除文档，并同步删除 Qdrant 中该文档的所有向量
   */
  app.delete('/docs/:docId', async (req, res) => {
    const { docId } = req.params;
    const ok = db.deleteDoc(docId);
    if (!ok) return res.status(404).json({ error: 'Document not found' });
    // 同步删除 Qdrant 中该文档的所有向量
    await deletePointsByDoc(docId);
    res.status(204).end();
  });

  // -------------------- Search 路由 --------------------
  /**
   * 向量检索接口
   * 请求体: { query: string, collectionId: string, limit?: number, filters?: any, latestOnly?: boolean }
   * 返回: runSearch 的结果（已经封装好的相似度和元数据）
   */
  app.post('/search', async (req, res) => {
    const { query, collectionId, limit, filters, latestOnly } = req.body ?? {};
    if (!query)
      return res.status(400).json({ error: 'BadRequest: query required' });
    if (!collectionId)
      return res
        .status(400)
        .json({ error: 'BadRequest: collectionId required' });

    const safeLimit =
      Number.isInteger(limit) && limit > 0 ? Math.min(limit, 50) : 10;
    const onlyLatest = Boolean(latestOnly);

    try {
      const results = await runSearch(
        query,
        collectionId,
        safeLimit,
        onlyLatest,
        filters,
      );
      res.json(results);
    } catch (err) {
      console.error('Search error:', err);
      res
        .status(500)
        .json({ error: (err as Error).message || 'InternalError' });
    }
  });

  // 统一错误处理（把 500 变成可读 JSON）
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error('API error:', err);
    res.status(500).json({ error: 'InternalError' });
  });
}