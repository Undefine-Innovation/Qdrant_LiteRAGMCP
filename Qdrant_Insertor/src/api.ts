import express, { Request, Response } from 'express';
import { DB, Version } from './db.js';
import { runSearch } from './search.js';

import { validateConfig } from "../config.js"; // Corrected path for config

export function createApp(deps?: { db?: DB }) {
  const app = express();
  app.use(express.json());

  const cfg = validateConfig();
  const db = deps?.db ?? new DB(cfg.db.path);

  // 健康检查
  app.get("/health", (_req, res) => res.json({ ok: true }));

  // RESTful /collections 路由
  app.post("/collections", (req, res, next) => {
    try {
      const { name, description } = req.body || {};
      if (!name || typeof name !== "string") {
        return res.status(400).json({ error: "BadRequest: name required" });
      }
      const col = db.createCollection(name, description);
      res.status(201).json(col);
    } catch (e) { next(e); }
  });
  app.get("/collections", (_req, res, next) => {
    try {
      const cols = db.listCollections();
      res.status(200).json(cols);
    } catch (e) { next(e); }
  });
  app.get("/collections/:collectionId", (req, res, next) => {
    try {
      const col = db.getCollectionById(req.params.collectionId);
      if (!col) return res.status(404).json({ error: "Collection not found" });
      res.status(200).json(col);
    } catch (e) { next(e); }
  });

  // 新增：获取某 Collection 下所有版本
  app.get("/collections/:collectionId/versions", (req, res, next) => {
    try {
      const col = db.getCollectionById(req.params.collectionId);
      if (!col) return res.status(404).json({ error: "Collection not found" });
      const versions = db.listVersions(req.params.collectionId);
      res.status(200).json(versions);
    } catch (e) { next(e); }
  });

  // 新增：创建某 Collection 下新版本
  app.post("/collections/:collectionId/versions", (req, res, next) => {
    try {
      const { name, description } = req.body || {};
      if (!name || typeof name !== "string") {
        return res.status(400).json({ error: "BadRequest: name required." });
      }
      const col = db.getCollectionById(req.params.collectionId);
      if (!col) return res.status(404).json({ error: "Collection not found" });
      const version = db.createVersion(req.params.collectionId, name, description);
      res.status(201).json(version);
    } catch (e) { next(e); }
  });
  app.delete("/collections/:collectionId", (req, res, next) => {
    try {
      const col = db.getCollectionById(req.params.collectionId);
      if (!col) {
        // 统一错误格式，返回 404 + 统一错误消息
        return res.status(404).json({ error: "Collection not found" });
      }
      db.deleteCollection(req.params.collectionId);
      res.status(204).end();
    } catch (e) { next(e); }
  });
  // RESTful /versions 路由
  app.get('/versions', async (req, res) => {
    try {
      const { collectionId } = req.query as { collectionId?: string };
      let versions: Version[];
      if (collectionId) {
        versions = db.listVersions(collectionId);
      } else {
        versions = db.listCollections().flatMap(c => db.listVersions(c.collectionId));
      }
      res.json(versions);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });
  app.get('/versions/:versionId', async (req, res) => {
    const { versionId } = req.params;
    const version = db.getVersion(versionId);
    if (!version) return res.status(404).json({ error: 'Version not found' });
    res.json(version);
  });
  app.delete('/versions/:versionId', async (req, res) => {
    const { versionId } = req.params;
    const ok = db.deleteVersion(versionId);
    if (!ok) return res.status(404).json({ error: 'Version not found' });
    res.status(204).end();
  });
  app.put('/versions/:versionId/status', async (req, res) => {
    const { versionId } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'BadRequest: status required' });
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
  app.post('/versions/:versionId/finalize', async (req, res) => {
    const { versionId } = req.params;
    const version = db.getVersion(versionId);
    if (!version) return res.status(404).json({ error: 'Version not found' });
    if (version.status !== 'EDITING') {
      return res.status(400).json({ error: 'BadRequest: Only versions in "EDITING" status can be finalized.' });
    }
    try {
      const { finalVersionId, isNew } = db.finalizeVersion(versionId);
      res.status(200).json({ finalVersionId, isNew });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });
  app.post('/versions', async (req, res) => {
    const { collectionId, docIds } = req.body;
    if (!collectionId || !Array.isArray(docIds)) {
      return res.status(400).json({ error: 'BadRequest: collectionId and docIds required' });
    }
    try {
      const { name, description } = req.body;
      if (!name || !collectionId) {
        return res.status(400).json({ error: 'BadRequest: collectionId and name required' });
      }
      const version = db.createVersion(collectionId, name, description);
      res.status(201).json(version);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // RESTful /docs 路由
  app.get('/docs', async (req, res) => {
    try {
      const docs = db.getAllDocs();
      res.json(docs);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });
  app.get('/docs/:docId', async (req, res) => {
    const { docId } = req.params;
    const doc = db.getDocById(docId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json(doc);
  });
  app.post('/docs', async (req, res) => {
    const { content, collectionId, versionId, key, name, mimeType, metadata } = req.body;
    if (!content || !collectionId || !versionId || !key) {
      return res.status(400).json({ error: 'BadRequest: content, collectionId, versionId, and key required' });
    }
    try {
      const { splitDocument: splitDocumentCreate } = await import('./splitter.js');
      const chunksCreate = await splitDocumentCreate(content, { strategy: 'markdown' });
      const metasCreate = chunksCreate.map((chunk, index) => ({
        pointId: `${doc.docId}#${index}`,
        chunkIndex: index,
        titleChain: chunk.titleChain ? chunk.titleChain.join(' > ') : '',
        contentHash: doc.docId,
      }));
      const textsCreate = chunksCreate.map((chunk, index) => ({
        pointId: `${doc.docId}#${index}`,
        content: chunk.content,
        title: chunk.titleChain ? chunk.titleChain[chunk.titleChain.length - 1] : '',
      }));
      const doc = db.createDoc(versionId, collectionId, key, content, name ?? metadata?.title ?? '', mimeType || 'text/plain');
      await db.insertChunkBatch({
        collectionId,
        versionId,
        docId: doc.docId,
        metas: metasCreate,
        texts: textsCreate,
      });
      res.status(201).json(doc);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });
  app.put('/docs/:docId', async (req, res) => {
    const { docId } = req.params;
    const { content, name, mimeType, metadata } = req.body;
    if (!content) return res.status(400).json({ error: 'BadRequest: content required' });
    const doc = db.getDocById(docId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    try {
      const { splitDocument: splitDocumentUpdate } = await import('./splitter.js');
      const chunksUpdate = await splitDocumentUpdate(content, { strategy: 'markdown' });
      const updated = db.updateDoc(docId, content, name || doc.name, mimeType || doc.mime);
      if (!updated) throw new Error('Document update failed');
      const metasUpdate = chunksUpdate.map((chunk, index) => ({
        pointId: `${updated.docId}#${index}`,
        chunkIndex: index,
        titleChain: chunk.titleChain ? chunk.titleChain.join(' > ') : '',
        contentHash: updated.docId,
      }));
      const textsUpdate = chunksUpdate.map((chunk, index) => ({
        pointId: `${updated.docId}#${index}`,
        content: chunk.content,
        title: chunk.titleChain ? chunk.titleChain[chunk.titleChain.length - 1] : '',
      }));
      await db.insertChunkBatch({
        collectionId: updated.collectionId,
        versionId: updated.versionId,
        docId: updated.docId,
        metas: metasUpdate,
        texts: textsUpdate,
      });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });
  app.delete('/docs/:docId', async (req, res) => {
    const { docId } = req.params;
    const ok = db.deleteDoc(docId);
    if (!ok) return res.status(404).json({ error: 'Document not found' });
    res.status(204).end();
  });

  // RESTful /search 路由
  app.post('/search', async (req, res) => {
    const { query, collectionId, limit, filters } = req.body;
    if (!query) return res.status(400).json({ error: 'BadRequest: query required' });
    try {
      const results = await runSearch(query, collectionId, limit, false, filters);
      res.json(results);
    } catch (err) {
      console.error('Search error:', err);
      res.status(500).json({ error: (err as Error).message || 'InternalError' });
    }
  });

  // 统一错误处理（把 500 变成可读 JSON）
  app.use((err: any, _req: any, res: any, _next: any) => {
    // 统一错误消息格式，去除句号
    let msg = err?.message || "InternalError";
    if (typeof msg === "string" && msg.endsWith(".")) {
      msg = msg.slice(0, -1);
    }
    // 统一 500 错误消息为 InternalError，避免泄露内部信息
    if (res.statusCode === 500) {
      msg = "InternalError";
    }
    console.error('API error:', err);
    res.status(500).json({ error: msg });
  });

  return app;
}