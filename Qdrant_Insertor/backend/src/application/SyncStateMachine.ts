import { SQLiteRepo } from '../infrastructure/SQLiteRepo.js';
import { IQdrantRepo } from '../../src/domain/IQdrantRepo.js';
import { IEmbeddingProvider } from '../../src/domain/embedding.js';
import { ISplitter } from '../../src/domain/splitter.js';
import { Logger } from '../logger.js';
import { DocId, ChunkMeta, Doc, DocumentChunk } from '@domain/types.js';
import { Point } from '@domain/IQdrantRepo.js';
import { makePointId } from '@domain/utils/id.js';

// 定义 SyncJob 状态
enum SyncJobStatus {
  NEW = 'NEW',
  SPLIT_OK = 'SPLIT_OK',
  EMBED_OK = 'EMBED_OK',
  SYNCED = 'SYNCED',
  FAILED = 'FAILED',
}

/**
 * @class SyncStateMachine
 * @description 管理文档同步的状态机，负责协调文档的分割、嵌入生成和 Qdrant 同步。
 */
export class SyncStateMachine {
  /**
   * @constructor
   * @param {SQLiteRepo} sqliteRepo - SQLite 仓库实例，用于访问 SQLite 数据库。
   * @param {IQdrantRepo} qdrantRepo - Qdrant 仓库实例，用于与 Qdrant 向量数据库交互。
   * @param {IEmbeddingProvider} embeddingProvider - 嵌入提供者实例，用于生成文档内容的嵌入向量。
   * @param {ISplitter} splitter - 文档分割器实例，用于将文档内容分割成块。
   * @param {Logger} logger - 日志记录器实例，用于记录同步过程中的信息和错误。
   */
  constructor(
    private readonly sqliteRepo: SQLiteRepo,
    private readonly qdrantRepo: IQdrantRepo,
    private readonly embeddingProvider: IEmbeddingProvider,
    private readonly splitter: ISplitter,
    private readonly logger: Logger,
  ) {}

  /**
   * @method triggerSync
   * @description 触发指定文档的同步过程。包括文档分割、嵌入生成和 Qdrant 向量数据库的更新。
   * @param {DocId} docId - 需要同步的文档 ID。
   * @returns {Promise<void>}
   */
  public async triggerSync(docId: DocId): Promise<void> {
    this.logger.info(`触发文档同步: ${docId}`); // 记录同步触发信息
    let currentStatus: SyncJobStatus = SyncJobStatus.NEW;

    try {
      // 1. 分割文档
      this.logger.info(`[${docId}] 开始分割文档...`); // 记录分割开始信息
      const doc: Doc | undefined = await this.sqliteRepo.getDoc(docId);
      if (!doc) {
        throw new Error(`文档 ${docId} 未找到`); // 如果文档不存在，抛出错误
      }

      if (!doc.content || doc.content.trim().length === 0) {
        this.logger.warn(`[${docId}] 文档内容为空，跳过分割和嵌入生成。`);
        // 标记为已同步
        await this.sqliteRepo.markDocAsSynced(docId);
        currentStatus = SyncJobStatus.SYNCED;
        this.logger.info(`[${docId}] 文档同步完成，状态: ${currentStatus}`); // 记录同步完成信息
        return;
      }
      // 确保 name 属性为 string 类型。如果 doc.name 为 undefined，则使用空字符串。
      const chunks: DocumentChunk[] = this.splitter.split(doc.content as string, { name: doc.name ?? '' });
      await this.sqliteRepo.addChunks(docId, chunks);
      currentStatus = SyncJobStatus.SPLIT_OK;
      this.logger.info(`[${docId}] 文档分割完成，状态: ${currentStatus}`); // 记录分割完成信息

      // 2. 生成嵌入
      this.logger.info(`[${docId}] 开始生成嵌入...`);
      const chunkMetas: ChunkMeta[] = await this.sqliteRepo.getChunkMetasByDocId(docId);
      // 需要从 SQLiteRepo 获取带有 content 的 ChunkMeta。
      // TODO: 优化此处为批量获取 chunkText 以提高性能，而不是在 map 中循环调用 getChunkTexts。
      const chunkMetasWithContent = await Promise.all(chunkMetas.map(async (cm) => {
        const chunkText = await this.sqliteRepo.getChunkTexts([cm.pointId]);
        return { ...cm, content: chunkText?.[cm.pointId]?.content || '' }; // 如果没有内容，则默认为空字符串
      }));

      const contents = chunkMetasWithContent.map((cm) => cm.content);
      const embeddings = await this.embeddingProvider.generate(contents);

      if (embeddings.length !== chunkMetasWithContent.length) {
        throw new Error('嵌入数量与分块数量不匹配');
      }

      const points: Point[] = chunkMetasWithContent.map((chunkMeta: ChunkMeta & { content: string }, index: number) => ({
        id: makePointId(chunkMeta.docId, chunkMeta.chunkIndex), // makePointId 函数的返回类型已是 PointId，此处无需强制转换
        vector: embeddings[index],
        payload: {
          docId: chunkMeta.docId,
          collectionId: chunkMeta.collectionId,
          chunkIndex: chunkMeta.chunkIndex,
          content: chunkMeta.content,
          contentHash: chunkMeta.contentHash,
          titleChain: chunkMeta.titleChain,
        },
      }));
      await this.qdrantRepo.upsertCollection(doc.collectionId, points); // 将生成的向量点插入 Qdrant
      currentStatus = SyncJobStatus.EMBED_OK;
      this.logger.info(`[${docId}] 嵌入生成完成，状态: ${currentStatus}`); // 记录嵌入生成完成信息

      // 3. 标记为已同步
      await this.sqliteRepo.markDocAsSynced(docId); // 在 SQLite 中标记文档为已同步
      currentStatus = SyncJobStatus.SYNCED;
      this.logger.info(`[${docId}] 文档同步完成，状态: ${currentStatus}`); // 记录同步完成信息

    } catch (error: unknown) {
      this.logger.error(`[${docId}] 同步失败，状态: ${SyncJobStatus.FAILED}，错误: ${(error as Error).message}`);
      // 可以在这里更新 SyncJob 状态为 FAILED
      // await this.sqliteRepo.updateSyncJobStatus(docId, SyncJobStatus.FAILED);
    }
  }
}


