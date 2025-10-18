import { IDocumentService, ILogger, ServiceError } from './interfaces.js';
import { SQLiteRepo } from '../infrastructure/SQLiteRepo.js';
import { Doc, DocId, CollectionId, PointId } from '../../../share/type.js';

// DEPRECATED: Version concept has been removed from the architecture
import { splitDocument } from '../splitter.js';
import { createEmbedding } from '../embedding.js';
import { ensureCollection, upsertChunks, deletePointsByDoc } from '../qdrant.js';
import { makeDocId } from '../../../share/utils/id.js';
import { AppConfig } from '../config.js';

/**
 * @class DocumentService
 * @description Document 服务的实现，负责 Document 的业务逻辑，包括与 DB、Splitter、Embedding 和 Qdrant 的交互。
 */
export class DocumentService implements IDocumentService {
  private db: SQLiteRepo;
  private logger: ILogger;
  private config: AppConfig;

  constructor(db: SQLiteRepo, logger: ILogger, config: AppConfig) {
    this.db = db;
    this.logger = logger;
    this.config = config;
  }

  /**
   * 创建一个新的 Document。
   * 流程说明：
   * 1. 在本地 DB 创建 doc
   * 2. 使用 splitter 将文本拆分为 chunks
   * 3. 将 chunk 的 meta / text 存入 DB
   * 4. 调用 embedding 服务生成向量
   * 5. 对每个 chunk 组装 upsert 对象并调用 Qdrant upsert
   * @param collectionId 所属 Collection 的 ID。
   * @param key 文档的唯一键。
   * @param content 文档的原始内容。
   * @param name 文档名称（可选）。
   * @param mime 文档的 MIME 类型（可选）。
   * @returns 包含新创建 Document 信息的 Promise。
   * @throws {ServiceError} 如果参数无效、Version 或 Collection 不存在、或操作失败。
   */
  async createDoc(
    collectionId: CollectionId,
    key: string,
    content: string | Uint8Array,
    name?: string,
    mime?: string,
  ): Promise<Doc> {
    if (!content || !collectionId || !key) {
      throw { code: 'BAD_REQUEST', message: 'Content, collectionId, and key are required.' } as ServiceError;
    }

    try {
      // 1. 在本地 DB 创建 doc
      const docId = this.db.docs.create({
        collectionId,
        key,
        content: typeof content === 'string' ? content : new TextDecoder().decode(content),
        name,
        mime,
        size_bytes: typeof content === 'string' ? new TextEncoder().encode(content).length : content.byteLength,
      });
      const doc = this.db.docs.getById(docId);
      if (!doc) {
        throw new Error('Failed to create or retrieve document after creation.');
      }
      this.logger.info(`Document created in DB: ${doc.docId}`);

      // 2. 使用 splitter 将文本拆分为 chunks
      const chunks = splitDocument({ path: key, content: typeof content === 'string' ? content : new TextDecoder().decode(content) }, {
        strategy: 'markdown', // 默认使用 markdown 策略
      });
      this.logger.info(`Document split into ${chunks.length} chunks.`);

      // 3. 将 chunk 的 meta 存入 DB
      const metas = chunks.map((chunk, index) => ({
        pointId: `${doc.docId}#${index}` as PointId,
        docId: doc.docId,
        collectionId: doc.collectionId,
        chunkIndex: index,
        titleChain: chunk.titleChain ? chunk.titleChain.join(' > ') : '',
        contentHash: makeDocId(chunk.content),
      }));
      this.db.chunkMeta.createBatch(metas);
      this.logger.info(`Chunks metadata and text inserted into DB for doc: ${doc.docId}`);

      // 4. 调用 embedding 服务生成向量
      await ensureCollection(); // 确保 Qdrant 集合存在
      const vectors = await createEmbedding(
        chunks.map((ch) => ch.content),
        { forceLive: true },
      );
      const vectorsArray = (Array.isArray(vectors) ? vectors : []) as number[][];
      this.logger.info(`Embeddings created for ${vectorsArray.length} chunks.`);

      // 5. 对每个 chunk 组装 upsert 对象并调用 Qdrant upsert
      const upserts = chunks.map((chunk, index) => ({
        collectionId,
        docId: doc.docId,
        chunkIndex: index,
        content: chunk.content,
        titleChain: chunk.titleChain ? chunk.titleChain.join(' > ') : '',
        contentHash: makeDocId(chunk.content),
        vector:
          vectorsArray[index] ?? new Array(this.config.qdrant.vectorSize).fill(0),
        pointId: `${doc.docId}#${index}`,
      }));
      await upsertChunks(upserts);
      this.logger.info(`Chunks upserted to Qdrant for doc: ${doc.docId}`);

      return doc;
    } catch (error) {
      const err = error as Error;
      const code = (typeof error === 'object' && error !== null && 'code' in error) ? String((error as {code: string}).code) : 'CREATE_DOCUMENT_FAILED';
      this.logger.error(`Failed to create document: ${err.message}`, err);
      throw { code, message: err.message } as ServiceError;
    }
  }

  /**
   * 根据 ID 获取指定 Document。
   * @param docId Document 的唯一标识符。
   * @returns 包含 Document 信息或 null 的 Promise。
   * @throws {ServiceError} 如果数据库操作失败。
   */
  async getDocById(docId: DocId): Promise<Doc | null> {
    try {
      const doc = this.db.docs.getById(docId);
      if (!doc) {
        this.logger.warn(`Document not found: ${docId}`);
        return null;
      } else {
        this.logger.debug(`Retrieved document: ${docId}`);
        return doc;
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to get document by ID ${docId}: ${err.message}`, err);
      throw { code: 'GET_DOCUMENT_FAILED', message: err.message } as ServiceError;
    }
  }

  /**
   * 更新指定 Document 的内容和元数据。
   * 流程说明：
   * - 更新本地 DB
   * - 重新拆分、入库 chunk
   * - 删除旧的 Qdrant 向量（按 docId）
   * - 生成 embedding 并 upsert 新向量
   * @param docId Document 的唯一标识符。
   * @param content 文档的新内容。
   * @param name 文档的新名称（可选）。
   * @param mime 文档的新 MIME 类型（可选）。
   * @returns 包含更新后 Document 信息或 null 的 Promise。
   * @throws {ServiceError} 如果 Document 不存在或操作失败。
   */
  async updateDoc(
    docId: DocId,
    content: string | Uint8Array,
    name?: string,
    mime?: string,
  ): Promise<Doc | null> {
    if (!content) {
      throw { code: 'BAD_REQUEST', message: 'Content is required for update.' } as ServiceError;
    }

    try {
      const existingDoc = this.db.docs.getById(docId);
      if (!existingDoc) {
        throw { code: 'DOCUMENT_NOT_FOUND', message: `Document with ID '${docId}' not found.` } as ServiceError;
      }

      const updated = this.db.updateDoc(
        docId,
        content,
        name || existingDoc.name,
        mime || existingDoc.mime,
      );
      if (!updated) {
        throw { code: 'UPDATE_DOCUMENT_FAILED', message: 'Document update failed in DB.' } as ServiceError;
      }
      this.logger.info(`Document updated in DB: ${docId}`);

      // 重新拆分、入库 chunk
      const chunks = splitDocument({ path: updated.key, content: typeof content === 'string' ? content : new TextDecoder().decode(content) }, {
        strategy: 'markdown',
      });
      this.logger.info(`Document re-split into ${chunks.length} chunks for update.`);

      const metas = chunks.map((chunk, index) => ({
        pointId: `${updated.docId}#${index}` as PointId,
        docId: updated.docId,
        collectionId: updated.collectionId,
        chunkIndex: index,
        titleChain: chunk.titleChain ? chunk.titleChain.join(' > ') : '',
        contentHash: makeDocId(chunk.content),
      }));
      this.db.chunkMeta.createBatch(metas);
      this.logger.info(`Chunks metadata and text re-inserted into DB for updated doc: ${updated.docId}`);

      // 删除旧的 Qdrant 向量（按 docId）
      await deletePointsByDoc(docId);
      this.logger.info(`Old Qdrant points deleted for doc: ${docId}`);

      // 生成 embedding 并 upsert 新向量
      await ensureCollection();
      const vectors = await createEmbedding(
        chunks.map((ch) => ch.content),
        { forceLive: true },
      );
      const vectorsArray = (Array.isArray(vectors) ? vectors : []) as number[][];
      this.logger.info(`Embeddings re-created for ${vectorsArray.length} chunks for updated doc.`);

      const upserts = chunks.map((chunk, index) => ({
        collectionId: updated.collectionId,
        docId: updated.docId,
        chunkIndex: index,
        content: chunk.content,
        titleChain: chunk.titleChain ? chunk.titleChain.join(' > ') : '',
        contentHash: makeDocId(chunk.content),
        vector:
          vectorsArray[index] ?? new Array(this.config.qdrant.vectorSize).fill(0),
        pointId: `${updated.docId}#${index}`,
      }));
      await upsertChunks(upserts);
      this.logger.info(`New chunks upserted to Qdrant for updated doc: ${updated.docId}`);

      return updated;
    } catch (error) {
      const err = error as Error;
      const code = (typeof error === 'object' && error !== null && 'code' in error) ? String((error as {code: string}).code) : 'UPDATE_DOCUMENT_FAILED';
      this.logger.error(`Failed to update document ${docId}: ${err.message}`, err);
      throw { code, message: err.message } as ServiceError;
    }
  }

  /**
   * 删除指定 Document。
   * @param docId Document 的唯一标识符。
   * @returns 表示删除是否成功的 Promise。
   * @throws {ServiceError} 如果 Document 不存在或操作失败。
   */
  async deleteDoc(docId: DocId): Promise<boolean> {
    try {
      const existingDoc = this.db.docs.getById(docId);
      if (!existingDoc) {
        throw { code: 'DOCUMENT_NOT_FOUND', message: `Document with ID '${docId}' not found.` } as ServiceError;
      }
      const success = this.db.deleteDoc(docId);
      if (success) {
        await deletePointsByDoc(docId); // 同步删除 Qdrant 中的向量
        this.logger.info(`Document and its Qdrant points deleted: ${docId}`);
      } else {
        this.logger.warn(`Failed to delete document: ${docId} (DB operation returned false)`);
      }
      return success;
    } catch (error) {
      const err = error as Error;
      const code = (typeof error === 'object' && error !== null && 'code' in error) ? String((error as {code: string}).code) : 'DELETE_DOCUMENT_FAILED';
      this.logger.error(`Failed to delete document ${docId}: ${err.message}`, err);
      throw { code, message: err.message } as ServiceError;
    }
  }

  /**
   * 获取所有 Document。
   * @returns 包含所有 Document 数组的 Promise。
   * @throws {ServiceError} 如果数据库操作失败。
   */
  async getAllDocs(): Promise<Doc[]> {
    try {
      const docs = this.db.docs.listAll();
      this.logger.debug(`Retrieved ${docs.length} documents.`);
      return docs;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to get all documents: ${err.message}`, err);
      throw { code: 'GET_ALL_DOCS_FAILED', message: err.message } as ServiceError;
    }
  }

  /**
   * 列出指定 Collection 下的所有 Document。
   * @param collectionId 所属 Collection 的 ID。
   * @returns 包含所有 Document 数组的 Promise。
   * @throws {ServiceError} 如果数据库操作失败。
   */
  async listDocs(collectionId: CollectionId): Promise<Doc[]> {
    try {
      const docs = this.db.docs.listByCollection(collectionId);
      this.logger.debug(`Listed ${docs.length} documents for collection: ${collectionId}`);
      return docs;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to list documents for collection ${collectionId}: ${err.message}`, err);
      throw { code: 'LIST_DOCS_FAILED', message: err.message } as ServiceError;
    }
  }
}