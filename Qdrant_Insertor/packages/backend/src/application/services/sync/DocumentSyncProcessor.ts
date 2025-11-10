import { ISQLiteRepo } from '@domain/repositories/ISQLiteRepo.js';
import { IQdrantRepo } from '@domain/repositories/IQdrantRepo.js';
import { IEmbeddingProvider } from '@domain/entities/embedding.js';
import { ISplitter } from '@domain/services/splitter.js';
import { Logger } from '@logging/logger.js';
import {
  DocId,
  ChunkMeta,
  Doc,
  DocumentChunk,
  PointId,
} from '@domain/entities/types.js';
import { Point } from '@domain/repositories/IQdrantRepo.js';
import { makePointId } from '@domain/utils/id.js';
import { SyncJobStatus } from '@domain/sync/types.js';

/**
 * 文档同步处理器
 * 负责处理文档的分割、嵌入生成和向量存储
 */
export class DocumentSyncProcessor {
  /**
   * 创建文档同步处理器实例
   * @param sqliteRepo SQLite 仓库实例
   * @param qdrantRepo Qdrant 仓库实例
   * @param embeddingProvider 嵌入提供者
   * @param splitter 文本分割器
   * @param logger 日志记录器
   */
  constructor(
    private readonly sqliteRepo: ISQLiteRepo,
    private readonly qdrantRepo: IQdrantRepo,
    private readonly embeddingProvider: IEmbeddingProvider,
    private readonly splitter: ISplitter,
    private readonly logger: Logger,
  ) {}

  /**
   * 分割文档
   *
   * @param docId - 文档ID
   */
  async splitDocument(docId: DocId): Promise<void> {
    this.logger.info(`[${docId}] 开始分割文档...`);

    const doc: Doc | undefined = await this.sqliteRepo.getDoc(docId);
    if (!doc) {
      throw new Error(`文档 ${docId} 未找到`);
    }

    if (!doc.content || doc.content.trim().length === 0) {
      this.logger.warn(`[${docId}] 文档内容为空，跳过分割和嵌入生成。`);
      return;
    }

    const chunks: DocumentChunk[] = this.splitter.split(doc.content, {
      name: doc.name ?? '',
    });

    try {
      this.logger.info(
        `[${docId}] 开始添加chunks到数据库，数量 ${chunks.length}`,
      );
      await this.sqliteRepo.addChunks(docId, chunks);
      this.logger.info(`[${docId}] 文档分割完成`);
    } catch (error) {
      this.logger.error(`[${docId}] 添加chunks到数据库失败`, {
        error: (error as Error).message,
        stack: (error as Error).stack,
        chunksCount: chunks.length,
      });
      throw error;
    }
  }

  /**
   * 生成嵌入
   *
   * @param docId - 文档ID
   */
  async generateEmbeddings(docId: DocId): Promise<void> {
    this.logger.info(`[${docId}] 开始生成嵌入...`);

    const chunkMetas: ChunkMeta[] =
      await this.sqliteRepo.getChunkMetasByDocId(docId);
    const chunkMetasWithContent = await Promise.all(
      chunkMetas.map(async (cm) => {
        const chunkText = await this.sqliteRepo.getChunkTexts([cm.pointId]);
        return { ...cm, content: chunkText?.[cm.pointId]?.content || '' };
      }),
    );

    const contents = chunkMetasWithContent.map((cm) => cm.content);
    const embeddings = await this.embeddingProvider.generate(contents);

    if (embeddings.length !== chunkMetasWithContent.length) {
      throw new Error('嵌入数量与分块数量不匹配');
    }

    const doc = await this.sqliteRepo.getDoc(docId);
    if (!doc) {
      throw new Error(`文档 ${docId} 未找到`);
    }

    const points: Point[] = chunkMetasWithContent.map(
      (chunkMeta: ChunkMeta & { content: string }, index: number) => ({
        id: makePointId(chunkMeta.docId, chunkMeta.chunkIndex) as PointId,
        vector: embeddings[index],
        payload: {
          docId: chunkMeta.docId,
          collectionId: chunkMeta.collectionId,
          chunkIndex: chunkMeta.chunkIndex,
          content: chunkMeta.content,
          contentHash: chunkMeta.contentHash,
          titleChain: chunkMeta.titleChain,
        },
      }),
    );

    // 先执行Qdrant插入操作
    await this.qdrantRepo.upsertCollection(doc.collectionId, points);
    this.logger.info(`[${docId}] 嵌入生成完成，向量点已成功插入Qdrant`);
  }

  /**
   * 标记文档为已同步
   *
   * @param docId - 文档ID
   */
  async markDocAsSynced(docId: DocId): Promise<void> {
    // 先更新数据库中的同步状态
    await this.sqliteRepo.markDocAsSynced(docId);
    this.logger.info(`[${docId}] 文档数据库同步状态已更新`);
  }
}
