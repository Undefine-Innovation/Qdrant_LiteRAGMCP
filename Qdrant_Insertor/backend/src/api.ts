import express, { Request, Response, NextFunction } from 'express';
import Database from 'better-sqlite3';
import { SQLiteRepo } from './infrastructure/SQLiteRepo.js';
import { runSearch } from './search.js';
import { AppError } from '../contracts/error.js';
import { CollectionId, DocId, PointId } from '../../share/type.js';
import { QdrantRepo } from './infrastructure/QdrantRepo.js';
import { makeDocId } from '../../share/utils/id.js';
import { validateConfig } from './config.js';
import { IEmbeddingProvider } from './domain/embedding.js';
import { createOpenAIEmbeddingProviderFromConfig } from './infrastructure/OpenAIEmbeddingProvider.js';
import { MarkdownSplitter } from './infrastructure/MarkdownSplitter.js';

/**
 * API Application Factory
 *
 * This module creates and exports an Express application that encapsulates all backend REST routes.
 * It handles dependency injection for the database and provides centralized error handling.
 *
 * @param deps Optional dependency injection object, currently supporting { db?: SQLiteRepo }.
 * @returns A configured Express application instance.
 */
export function createApp(deps?: { db?: SQLiteRepo, embeddingProvider?: IEmbeddingProvider }) {
  const app = express();
  app.use(express.json());

  // Initialize the database connection and repository
  const dbInstance = new Database(cfg.db.path);
  const db = deps?.db ?? new SQLiteRepo(dbInstance);
  const qdrantRepo = new QdrantRepo(cfg);
  const embeddingProvider = deps?.embeddingProvider ?? createOpenAIEmbeddingProviderFromConfig();
  const splitter = new MarkdownSplitter();

  route(app, db, qdrantRepo, embeddingProvider, splitter);

  return app;
}

function route(
  app: express.Express,
  db: SQLiteRepo,
  qdrantRepo: QdrantRepo,
  embeddingProvider: IEmbeddingProvider,
  splitter: MarkdownSplitter,
) {
  // Health check endpoint
  app.get('/health', (_req, res) => res.json({ ok: true }));

  // -------------------- Collections Routes --------------------
  app.post('/collections', (req, res, next) => {
    try {
      const { name, description } = req.body || {};
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'BadRequest: name is required' });
      }
      const collectionId = db.collections.create({ name, description });
      const newCollection = db.collections.getById(collectionId);
      res.status(201).json(newCollection);
    } catch (e) {
      next(e);
    }
  });

  app.get('/collections', (_req, res, next) => {
    try {
      const cols = db.collections.listAll();
      res.status(200).json(cols);
    } catch (e) {
      next(e);
    }
  });

  app.get('/collections/:collectionId', (req, res, next) => {
    try {
      const col = db.collections.getById(req.params.collectionId as CollectionId);
      if (!col) return res.status(404).json({ error: 'Collection not found' });
      res.status(200).json(col);
    } catch (e) {
      next(e);
    }
  });

  app.delete('/collections/:collectionId', (req, res, next) => {
    try {
      const collectionId = req.params.collectionId as CollectionId;
      const col = db.collections.getById(collectionId);
      if (!col) {
        return res.status(404).json({ error: 'Collection not found' });
      }
      db.deleteCollection(collectionId);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  // -------------------- Docs Routes --------------------
  app.get('/docs', async (req, res, next) => {
    try {
      const docs = db.docs.listAll();
      res.json(docs);
    } catch (err) {
      next(err);
    }
  });

  app.get('/docs/:docId', async (req, res, next) => {
    try {
      const { docId } = req.params;
      const doc = db.docs.getById(docId as DocId);
      if (!doc) return res.status(404).json({ error: 'Document not found' });
      res.json(doc);
    } catch (e) {
      next(e);
    }
  });

  app.post('/docs', async (req, res, next) => {
    const { content, collectionId, key, name, mimeType } = req.body;
    if (!content || !collectionId || !key) {
      return res.status(400).json({
        error: 'BadRequest: content, collectionId, and key are required',
      });
    }
    try {
      const docId = db.docs.create({
        collectionId: collectionId as CollectionId,
        key,
        content,
        name: name ?? '',
        mime: mimeType || 'text/plain',
        size_bytes: new TextEncoder().encode(content).length,
      });
      const doc = db.docs.getById(docId);
      if (!doc) throw new Error('Failed to create document');

      const chunks = splitter.split(content, { docPath: key });

      const metas = chunks.map((chunk, index) => ({
        pointId: `${doc.docId}#${index}` as PointId,
        docId: doc.docId,
        collectionId: doc.collectionId,
        chunkIndex: index,
        titleChain: chunk.titleChain ? chunk.titleChain.join(' > ') : '',
        contentHash: makeDocId(chunk.content),
      }));
      db.chunkMeta.createBatch(metas);

      await qdrantRepo.ensureCollection();
      const vectors = await embeddingProvider.generate(chunks.map((ch) => ch.content));

      const upserts = chunks.map((chunk, index) => ({
        collectionId: doc.collectionId,
        docId: doc.docId,
        chunkIndex: index,
        content: chunk.content,
        titleChain: chunk.titleChain ? chunk.titleChain.join(' > ') : '',
        contentHash: makeDocId(chunk.content),
        vector: (vectors as number[][])[index] ?? new Array(cfg.qdrant.vectorSize).fill(0),
        pointId: `${doc.docId}#${index}`,
      }));
      await qdrantRepo.upsertChunks(upserts);

      res.status(201).json(doc);
    } catch (err) {
      next(err);
    }
  });

  app.put('/docs/:docId', async (req, res, next) => {
    const { docId } = req.params;
    const { content, name, mimeType } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'BadRequest: content is required' });
    }
    const doc = db.docs.getById(docId as DocId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    try {
      const updated = db.updateDoc(
        docId as DocId,
        content,
        name || doc.name,
        mimeType || doc.mime,
      );
      if (!updated) throw new Error('Document update failed');

      const chunks = splitter.split(content, { docPath: doc.key });

      const metas = chunks.map((chunk, index) => ({
        pointId: `${updated.docId}#${index}` as PointId,
        docId: updated.docId,
        collectionId: updated.collectionId,
        chunkIndex: index,
        titleChain: chunk.titleChain ? chunk.titleChain.join(' > ') : '',
        contentHash: makeDocId(chunk.content),
      }));
      db.chunkMeta.createBatch(metas);

      await qdrantRepo.deletePointsByDoc(docId as DocId);
      await qdrantRepo.ensureCollection();
      const vectors = await embeddingProvider.generate(chunks.map((ch) => ch.content));

      const upserts = chunks.map((chunk, index) => ({
        collectionId: updated.collectionId,
        docId: updated.docId,
        chunkIndex: index,
        content: chunk.content,
        titleChain: chunk.titleChain ? chunk.titleChain.join(' > ') : '',
        contentHash: makeDocId(chunk.content),
        vector: (vectors as number[][])[index] ?? new Array(cfg.qdrant.vectorSize).fill(0),
        pointId: `${updated.docId}#${index}`,
      }));
      await qdrantRepo.upsertChunks(upserts);

      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  app.delete('/docs/:docId', async (req, res, next) => {
    try {
      const { docId } = req.params;
      const ok = db.deleteDoc(docId as DocId);
      if (!ok) return res.status(404).json({ error: 'Document not found' });
      await qdrantRepo.deletePointsByDoc(docId as DocId);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  // -------------------- Search 路由 --------------------
  /**
   * 向量检索接口
   * 请求体: { query: string, collectionId: string, limit?: number, filters?: any, latestOnly?: boolean }
   * 返回: runSearch 的结果（已经封装好的相似度和元数据）
   */
  app.post('/search', async (req, res, next) => {
    const { query, collectionId, limit, latestOnly } = req.body ?? {};
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
        embeddingProvider,
        query,
        collectionId,
        safeLimit,
        onlyLatest,
      );
      res.json(results);
    } catch (err) {
      console.error('Search error:', err);
      next(err);
    }
  });

  // 统一错误处理（把 500 变成可读 JSON）
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof AppError) {
      console.error(`AppError: [${err.code}] ${err.message}`, err.details);
      res.status(err.httpStatus).json(err.toJSON());
    } else {
      console.error('API Internal Server Error:', err);
      const internalError = AppError.createInternalServerError(
        'An unexpected internal server error occurred.',
        { stack: err.stack, message: err.message },
      );
      res.status(internalError.httpStatus).json(internalError.toJSON());
    }
  });
}

const cfg = validateConfig();